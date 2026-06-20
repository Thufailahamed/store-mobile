import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { supabase } from "./supabase/client";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications(userId: string): Promise<string | null> {
  if (!Device.isDevice) return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") return null;

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;

    if (Platform.OS === "android") {
      Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#535e2c",
      });
    }

    const { error: pushError } = await supabase
      .from("users")
      .update({ push_token: token })
      .eq("id", userId);
    if (pushError) {
      console.warn("[notifications] push_token update failed:", pushError.message);
    }

    return token;
  } catch {
    return null;
  }
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

/** Null the push_token column for a user — called on sign-out so the
 *  server stops targeting the old device. */
export async function clearPushToken(userId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from("users")
      .update({ push_token: null })
      .eq("id", userId);
    if (error) {
      console.warn("[notifications] push_token null-out failed:", error.message);
    }
  } catch (err) {
    console.warn("[notifications] clearPushToken threw:", err);
  }
}
