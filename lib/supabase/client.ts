import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

/**
 * Expo SecureStore adapter for Supabase SSR-compatible auth storage.
 * Stores JWT and refresh token in the device's secure enclave.
 */
const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      // Silently fail — storage might be full or unavailable
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // Silently fail
    }
  },
};

export const supabase = createClient(URL, ANON_KEY, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
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
