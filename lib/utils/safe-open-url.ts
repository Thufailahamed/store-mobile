import * as Linking from "expo-linking";

/**
 * Schemes we trust for outbound `Linking.openURL`. Anything else is
 * dropped with a warning. `javascript:` and `data:` URLs are explicitly
 * blocked to prevent script injection.
 */
const ALLOWED_PREFIXES = [
  "https://",
  "tel:",
  "mailto:",
  "sms:",
  "whatsapp:",
];

export function isSafeExternalUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  if (lower.startsWith("javascript:") || lower.startsWith("data:")) return false;
  return ALLOWED_PREFIXES.some((p) => lower.startsWith(p));
}

/**
 * Validate and open an outbound URL. Falls back to a console.warn on
 * disallowed URLs so the caller doesn't have to.
 */
export async function safeOpenUrl(url: string | null | undefined): Promise<boolean> {
  if (!isSafeExternalUrl(url)) {
    console.warn("[safe-open-url] rejected url:", url);
    return false;
  }
  try {
    await Linking.openURL(url as string);
    return true;
  } catch (err) {
    console.warn("[safe-open-url] openURL failed:", err);
    return false;
  }
}