import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Device-local settings preferences. These never leave the device.
 * Server-side prefs (locale, currency, notifications, privacy) live in Supabase.
 */

export type TextSize = "sm" | "md" | "lg";

export type LocalSettingsPrefs = {
  textSize: TextSize;
  reduceMotion: boolean;
  biometricLock: boolean;
};

export const DEFAULT_LOCAL_PREFS: LocalSettingsPrefs = {
  textSize: "md",
  reduceMotion: false,
  biometricLock: false,
};

const KEY = "luxe:local:settings";

export async function getLocalSettingsPrefs(): Promise<LocalSettingsPrefs> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return DEFAULT_LOCAL_PREFS;
    return { ...DEFAULT_LOCAL_PREFS, ...(JSON.parse(raw) as Partial<LocalSettingsPrefs>) };
  } catch {
    return DEFAULT_LOCAL_PREFS;
  }
}

export async function setLocalSettingsPrefs(
  patch: Partial<LocalSettingsPrefs>
): Promise<LocalSettingsPrefs> {
  const current = await getLocalSettingsPrefs();
  const next = { ...current, ...patch };
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export async function resetLocalSettingsPrefs(): Promise<LocalSettingsPrefs> {
  await AsyncStorage.removeItem(KEY);
  return DEFAULT_LOCAL_PREFS;
}
