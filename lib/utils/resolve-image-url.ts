import { Platform } from "react-native";
import Constants from "expo-constants";

/** Serves /public/images/* referenced by product_images.url in the database. */
const DEFAULT_STORE_API_URL = "https://store-three-xi-58.vercel.app";

function normalizeHost(host: string): string {
  let h = host.replace(/\/$/, "");
  if (Platform.OS === "android" && h.includes("localhost")) {
    h = h.replace("localhost", "10.0.2.2");
  }
  return h;
}

function getStoreApiHost(): string {
  const fromEnv = process.env.EXPO_PUBLIC_STORE_API_URL?.replace(/\/$/, "");
  const fromExtra = Constants.expoConfig?.extra?.storeApiUrl as string | undefined;
  const host = fromEnv || fromExtra?.replace(/\/$/, "") || DEFAULT_STORE_API_URL;
  return normalizeHost(host);
}

/** Turn database image paths into absolute URLs the app can load. */
export function resolveImageUrl(url?: string | null): string {
  if (!url) return "";
  const trimmed = url.trim();
  if (!trimmed) return "";
  // Reject script-bearing schemes outright. Without this guard an attacker
  // could store "javascript:alert(1)" or a data:text/html URL in
  // product_images.url and have the app evaluate it.
  if (trimmed.startsWith("javascript:")) return "";
  if (trimmed.startsWith("data:text/html")) return "";
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("data:")
  ) {
    return trimmed;
  }

  const supabaseUrl =
    process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ||
    (Constants.expoConfig?.extra?.supabaseUrl as string | undefined)?.replace(/\/$/, "");
  if (
    supabaseUrl &&
    !trimmed.startsWith("/") &&
    (trimmed.startsWith("storage/") || /^[a-z0-9-]+\//i.test(trimmed))
  ) {
    return `${supabaseUrl}/storage/v1/object/public/${trimmed.replace(/^\//, "")}`;
  }

  const host = getStoreApiHost();
  const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return `${host}${path}`;
}
