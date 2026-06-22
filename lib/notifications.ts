import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Alert, Platform } from "react-native";
import Constants from "expo-constants";
import { supabase } from "./supabase/client";

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

/**
 * Register for Expo push notifications and persist the token to the
 * backend via `/api/notifications/push-token` (which writes to the
 * `push_tokens` table introduced in migration 0140 — the legacy
 * `users.push_token` write the previous version used silently failed
 * because no migration ever created that column).
 *
 * On any failure we update `lastState` AND raise a single non-blocking
 * Alert the first time per session so the user can act on it
 * (open Settings to grant permission, retry, etc.).
 */
export async function registerForPushNotifications(userId: string): Promise<string | null> {
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
    lastState = {
      status: "failed",
      reason: err instanceof Error ? err.message : "token fetch failed",
    };
    surfaceFailureOnce("Couldn't get a push token. Check your network and try again.");
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

  // Persist via the server route. We send the session JWT so the
  // server can authenticate the upsert against the `push_tokens`
  // RLS policy.
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      lastState = { status: "failed", reason: "no session" };
      surfaceFailureOnce("You're not signed in. Push notifications will resume after you sign in.");
      return null;
    }
    const res = await fetch("/api/notifications/push-token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        token,
        platform: "expo",
        appVersion: (Constants?.expoConfig?.version as string | undefined) ?? null,
        userAgent: `${Platform.OS} ${Platform.Version}`,
      }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      lastState = {
        status: "failed",
        reason: `register ${res.status}: ${txt.slice(0, 200)}`,
      };
      surfaceFailureOnce("Couldn't register this device for push. We'll retry on next launch.");
      return null;
    }
    lastState = { status: "registered", token };
    return token;
  } catch (err) {
    lastState = {
      status: "failed",
      reason: err instanceof Error ? err.message : "network failed",
    };
    surfaceFailureOnce("Network error registering for push. We'll retry next time you open the app.");
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
export async function clearPushToken(userId: string): Promise<void> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      // Fallback: try the legacy direct write so the column at least
      // gets nulled out for callers that still read it.
      await supabase.from("users").update({ push_token: null }).eq("id", userId);
      return;
    }
    await fetch("/api/notifications/push-token", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });
  } catch (err) {
    console.warn("[notifications] clearPushToken threw:", err);
  }
}