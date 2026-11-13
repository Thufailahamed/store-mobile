import { AppState, Platform } from "react-native";
import { createClient } from "@supabase/supabase-js";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? (Constants.expoConfig?.extra?.supabaseUrl as string | undefined) ?? "";
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? (Constants.expoConfig?.extra?.supabaseAnonKey as string | undefined) ?? "";

if (!URL || !ANON_KEY) {
  console.error(
    "[supabase] EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY must be set. " +
      "Add them to store-mobile/.env.local and restart Metro.",
  );
}

/**
 * Robust persistent storage adapter.
 * Uses AsyncStorage as primary to ensure unbounded payload storage
 * (SecureStore is capped at 2048 bytes on iOS/Android, which causes token refresh
 * or sessions with user metadata to fail and silently log the user out).
 * SecureStore is mirrored for defense-in-depth and read as fallback for migration.
 */
const storageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      const val = await AsyncStorage.getItem(key);
      if (val) return val;
    } catch {
      // fall through
    }
    try {
      const secure = await SecureStore.getItemAsync(key);
      if (secure) {
        // Migrate to AsyncStorage so future reads are seamless and never truncated
        await AsyncStorage.setItem(key, secure).catch(() => {});
        return secure;
      }
    } catch {
      // fall through
    }
    return null;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (err) {
      console.warn("[supabase] failed to persist session to AsyncStorage:", err);
    }
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      // SecureStore may fail if value exceeds 2048 bytes; AsyncStorage already holds the valid session
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      // fall through
    }
    try {
      await SecureStore.deleteItemAsync(key);
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
 * Auto-refresh token management based on AppState.
 * When the app returns from background to active foreground, resume auto-refresh
 * and refresh the token immediately if it expired or is close to expiry while backgrounded.
 */
if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") {
      supabase.auth.startAutoRefresh();
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
          const now = Date.now();
          if (expiresAt > 0 && expiresAt - now < 5 * 60 * 1000) {
            void refreshSessionOnce();
          }
        }
      }).catch(() => {});
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}

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
