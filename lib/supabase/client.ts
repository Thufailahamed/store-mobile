import { createClient } from "@supabase/supabase-js";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

function readEnv(key: string, extraKey: string): string {
  const fromProcess = process.env[key];
  if (fromProcess) return fromProcess;
  const extra = Constants.expoConfig?.extra as Record<string, string | undefined> | undefined;
  return extra?.[extraKey] ?? "";
}

const URL = readEnv("EXPO_PUBLIC_SUPABASE_URL", "supabaseUrl");
const ANON_KEY = readEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY", "supabaseAnonKey");

if (!URL || !ANON_KEY) {
  console.error(
    "[supabase] EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY must be set. " +
      "Add them to store-mobile/.env.local and restart Metro.",
  );
}

/**
 * Prefer SecureStore; fall back to AsyncStorage when SecureStore is
 * unavailable (Expo web, simulators with keychain issues).
 */
const storageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      const secure = await SecureStore.getItemAsync(key);
      if (secure) return secure;
    } catch {
      // fall through
    }
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await SecureStore.setItemAsync(key, value);
      return;
    } catch {
      // fall through
    }
    try {
      await AsyncStorage.setItem(key, value);
    } catch (err) {
      console.warn("[supabase] failed to persist session:", err);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // fall through
    }
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      // fall through
    }
  },
};

export const supabase = createClient(URL, ANON_KEY, {
  auth: {
    storage: storageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // PKCE (not the 'implicit' default) is required for the OAuth/deep-link
    // callback flow in oauth.ts, which exchanges a `?code=` query param.
    flowType: "pkce",
  },
});

/**
 * Single-flight refresh.
 *
 * Concurrent calls to `supabase.auth.refreshSession()` can race and each
 * mint a fresh refresh token, which then invalidates the other call.
 * Centralising the call here means a second caller awaits the in-flight
 * promise instead of starting its own refresh.
 */
let inFlightRefresh: Promise<Awaited<ReturnType<typeof supabase.auth.refreshSession>>> | null = null;

export async function refreshSessionOnce() {
  if (inFlightRefresh) return inFlightRefresh;
  inFlightRefresh = (async () => {
    try {
      return await supabase.auth.refreshSession();
    } finally {
      inFlightRefresh = null;
    }
  })();
  return inFlightRefresh;
}
