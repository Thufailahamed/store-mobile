import { Platform } from "react-native";
import Constants from "expo-constants";

// H-01 AUDIT: No hardcoded fallback host. If EXPO_PUBLIC_STORE_API_URL is
// unset, image paths that need a host resolution return "" (empty string)
// instead of silently routing through a personal Vercel subdomain.

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
  const host = fromEnv || fromExtra?.replace(/\/$/, "") || "";
  return host ? normalizeHost(host) : "";
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

  const cdnUrl =
    process.env.EXPO_PUBLIC_CDN_URL?.replace(/\/$/, "") ||
    (Constants.expoConfig?.extra?.cdnUrl as string | undefined)?.replace(/\/$/, "");
  if (
    !trimmed.startsWith("/") &&
    (trimmed.startsWith("storage/") || /^[a-z0-9-]+\//i.test(trimmed))
  ) {
    if (cdnUrl) {
      const cleanPath = trimmed.replace(/^storage\/v1\/object\/public\//, "").replace(/^\//, "");
      return `${cdnUrl}/${cleanPath}`;
    }

    const supabaseUrl =
      process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ||
      (Constants.expoConfig?.extra?.supabaseUrl as string | undefined)?.replace(/\/$/, "");
    if (supabaseUrl) {
      return `${supabaseUrl}/storage/v1/object/public/${trimmed.replace(/^\//, "")}`;
    }
  }

  const host = getStoreApiHost();
  const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return `${host}${path}`;
}
