import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Alert, Platform } from "react-native";
import Constants from "expo-constants";
import { registerPushTokenBackend, unregisterPushTokenBackend } from "@/lib/api/backend";
import { hasStoreApi } from "@/lib/api/delivery-api";
import { themedAlert } from "@/lib/themed-alert";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Last registration outcome surfaced to the UI. Useful for the
 * notifications preferences screen so users can see *why* pushes
 * aren't arriving (denied / no token / network failed).
 */
export type PushRegistrationState =
  | { status: "idle" }
  | { status: "unsupported" }
  | { status: "denied" }
  | { status: "registered"; token: string }
  | { status: "failed"; reason: string };

let lastState: PushRegistrationState = { status: "idle" };

export function getLastPushRegistrationState(): PushRegistrationState {
  return lastState;
}

let lastRegisteredToken: string | null = null;

/**
 * Register for Expo push notifications and persist the token to the
 * backend via `/api/notifications/push-token` (which writes to the
 * `push_tokens` table introduced in migration 0140).
 *
 * On any failure we update `lastState` AND raise a single non-blocking
 * Alert the first time per session so the user can act on it
 * (open Settings to grant permission, retry, etc.).
 */
export async function registerForPushNotifications(_userId: string): Promise<string | null> {
  // Simulators and emulators go through the same path. Apple-silicon iOS
  // simulators (Xcode 14+) get a real APNs sandbox token, so pushes sent
  // through the backend arrive there and run the Notification Service
  // Extension. Where no token is available, the token step below fails
  // and we stop quietly — permission, channels and categories are still
  // set up so `xcrun simctl push` notifications display.
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    lastState = { status: "denied" };
    surfaceFailureOnce("Notifications are turned off. Enable them in Settings to receive order updates.");
    return null;
  }

  let token: string;
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: (Constants?.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId,
      // iOS simulators only get APNs *sandbox* tokens but carry no
      // provisioning profile, so Expo would assume production and Apple
      // rejects every push with BadDeviceToken. Real devices keep Expo's
      // auto-detection from the embedded profile (dev build vs App Store).
      ...(Platform.OS === "ios" && !Device.isDevice ? { development: true } : {}),
    }).catch(async () => {
      // Fallback to default projectId lookup
      return await Notifications.getExpoPushTokenAsync();
    });
    token = tokenData.data;
  } catch (err) {
    const reason = err instanceof Error ? err.message : "token fetch failed";
    lastState = Device.isDevice ? { status: "failed", reason } : { status: "unsupported" };
    // Missing FCM / google-services.json on local APK builds is common —
    // not something the user can fix from this dialog.
    console.warn("[notifications] getExpoPushTokenAsync failed:", reason);
    return null;
  }

  await setupNotificationPresentation();

  // Persist via the backend wrapper. We only POST when the token
  // actually changes — Expo sometimes re-emits the same token on
  // app foreground, and the server's rate limit (10/min) is per-user.
  if (token === lastRegisteredToken) {
    lastState = { status: "registered", token };
    return token;
  }

  if (!hasStoreApi()) {
    lastState = { status: "failed", reason: "Store API not configured" };
    return null;
  }

  try {
    const res = await registerPushTokenBackend({
      token,
      platform: Platform.OS === "android" ? "android" : "ios",
    });
    if (!res.ok) {
      lastState = {
        status: "failed",
        reason: `register failed: ${res.error}`,
      };
      console.warn("[notifications] push-token register failed:", lastState.reason);
      return null;
    }
    lastRegisteredToken = token;
    lastState = { status: "registered", token };
    return token;
  } catch (err) {
    lastState = {
      status: "failed",
      reason: err instanceof Error ? err.message : "network failed",
    };
    console.warn("[notifications] push-token register threw:", lastState.reason);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Rich push presentation: Android channels + action-button categories.
//
// Must match store-backend/src/lib/rich-push.ts:
//   - channelId "default" (orders/account) and "promotions" (marketing)
//   - categoryId = action set key; every category has one action "open"
// A push naming a category the device doesn't know still shows, just
// without the button, so older app versions degrade safely.
// ---------------------------------------------------------------------------

export const PUSH_ACTION_OPEN = "open";

const PUSH_CATEGORIES: Array<{ id: string; label: string }> = [
  { id: "shop_now", label: "Shop Now" },
  { id: "buy_now", label: "Buy Now" },
  { id: "view_offer", label: "View Offer" },
  { id: "track_order", label: "Track Order" },
];

let presentationReady: Promise<void> | null = null;

/** Idempotent; safe to call before permission is granted. */
export function setupNotificationPresentation(): Promise<void> {
  if (presentationReady) return presentationReady;
  presentationReady = (async () => {
    if (Platform.OS === "android") {
      try {
        await Notifications.setNotificationChannelAsync("default", {
          name: "Orders & account",
          description: "Order updates, delivery and account alerts",
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#535e2c",
        });
        await Notifications.setNotificationChannelAsync("promotions", {
          name: "Offers & recommendations",
          description: "New drops, price drops and offers",
          importance: Notifications.AndroidImportance.HIGH,
          lightColor: "#FF2E7E",
        });
      } catch (err) {
        // Best-effort — pushes still arrive on the FCM fallback channel.
        console.warn("[notifications] setNotificationChannelAsync failed:", err);
      }
    }
    for (const c of PUSH_CATEGORIES) {
      try {
        await Notifications.setNotificationCategoryAsync(c.id, [
          {
            identifier: PUSH_ACTION_OPEN,
            buttonTitle: c.label,
            options: { opensAppToForeground: true },
          },
        ]);
      } catch (err) {
        console.warn("[notifications] setNotificationCategoryAsync failed:", c.id, err);
      }
    }
  })();
  return presentationReady;
}

const FIRST_PARTY_HOSTS = new Set(["vestara.lk", "www.vestara.lk"]);

/**
 * "https://vestara.lk/products/x" → "/products/x" so first-party links
 * open in the app instead of the browser. Anything else returns null.
 */
export function firstPartyPath(url: string): string | null {
  const m = /^https?:\/\/([^/?#]+)([^#]*)/i.exec(url.trim());
  if (!m || !FIRST_PARTY_HOSTS.has(m[1].toLowerCase())) return null;
  return m[2] && m[2].startsWith("/") ? m[2] : `/${m[2] ?? ""}`;
}

let alertShownThisSession = false;
function surfaceFailureOnce(message: string) {
  if (alertShownThisSession) return;
  alertShownThisSession = true;
  // setTimeout 0 so we don't Alert during render
  setTimeout(() => {
    themedAlert("Push notifications", message, [{ text: "OK" }]);
  }, 0);
}

export function addNotificationResponseListener(
  handler: (response: Notifications.NotificationResponse) => void
) {
  return Notifications.addNotificationResponseReceivedListener(handler);
}

export function addNotificationReceivedListener(
  handler: (notification: Notifications.Notification) => void
) {
  return Notifications.addNotificationReceivedListener(handler);
}

/** Deactivate the current device's push token — called on sign-out. */
export async function clearPushToken(_userId: string): Promise<void> {
  const token = lastRegisteredToken;
  if (!token || !hasStoreApi()) {
    lastRegisteredToken = null;
    return;
  }
  try {
    await unregisterPushTokenBackend(token);
    lastRegisteredToken = null;
  } catch (err) {
    console.warn("[notifications] clearPushToken threw:", err);
  }
}

/**
 * Synchronize the app icon badge count on iOS and Android.
 */
export async function syncBadgeCount(unreadCount: number): Promise<void> {
  try {
    await Notifications.setBadgeCountAsync(Math.max(0, unreadCount));
  } catch (err) {
    console.warn("[notifications] setBadgeCountAsync failed:", err);
  }
}

