import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Alert, Platform } from "react-native";
import Constants from "expo-constants";
import { registerPushTokenBackend, unregisterPushTokenBackend } from "@/lib/api/backend";
import { hasStoreApi } from "@/lib/api/delivery-api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
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
  if (!Device.isDevice) {
    lastState = { status: "unsupported" };
    return null;
  }

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
    }).catch(async () => {
      // Fallback to default projectId lookup
      return await Notifications.getExpoPushTokenAsync();
    });
    token = tokenData.data;
  } catch (err) {
    const reason = err instanceof Error ? err.message : "token fetch failed";
    lastState = { status: "failed", reason };
    // Missing FCM / google-services.json on local APK builds is common —
    // not something the user can fix from this dialog.
    console.warn("[notifications] getExpoPushTokenAsync failed:", reason);
    return null;
  }

  if (Platform.OS === "android") {
    try {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#535e2c",
      });
    } catch (err) {
      // Channel setup is best-effort — push can still work without
      // it on some devices.
      console.warn("[notifications] setNotificationChannelAsync failed:", err);
    }
  }

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

let alertShownThisSession = false;
function surfaceFailureOnce(message: string) {
  if (alertShownThisSession) return;
  alertShownThisSession = true;
  // setTimeout 0 so we don't Alert during render
  setTimeout(() => {
    Alert.alert("Push notifications", message, [{ text: "OK" }]);
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
