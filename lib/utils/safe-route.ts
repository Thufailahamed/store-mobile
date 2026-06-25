import type { Router } from "expo-router";

/**
 * Hardcoded allow-list of internal route prefixes/screens we will ever
 * navigate to from untrusted inputs (deep links, push notifications,
 * share URLs, etc). Anything not on this list is dropped with a warning.
 *
 * Update this list when adding a new top-level route that needs to be
 * reachable from outside the app.
 */
export const ALLOWED_ROUTES = new Set<string>([
  "/(main)",
  "/(main)/orders",
  "/(main)/cart",
  "/(main)/products",
  "/(main)/products/[slug]",
  "/(main)/gift-cards",
  "/(main)/gift-cards/redeem",
  "/(main)/account",
  "/(main)/account/orders",
  "/(main)/account/orders/[id]",
  "/(main)/account/gift-cards",
  "/(main)/account/price-alerts",
  "/(main)/checkout",
  "/(main)/checkout/success",
  "/(main)/search",
  "/(main)/wishlist",
  "/(delivery)",
  "/(delivery)/orders",
  "/(delivery)/orders/[id]",
  "/(delivery-company)",
  "/(delivery-company)/accept",
  "/(auth)/login",
  "/(auth)/register",
  "/(auth)/forgot-password",
  "/(auth)/reset-password",
]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Accept UUID or a base64url-ish JWT segment (~20+ chars of [A-Za-z0-9_-]). */
const TOKEN_RE = /^[A-Za-z0-9_-]{16,}$/;
const SLUG_RE = /^[a-zA-Z0-9_-]+$/;

export function isAllowedRoute(screen: string): boolean {
  if (!screen || typeof screen !== "string") return false;
  // Normalize: strip leading "//" and trim.
  const normalized = screen.replace(/^\/+/, "/").trim();
  // Strip query string for matching against allow-list.
  const base = normalized.split("?")[0];
  if (ALLOWED_ROUTES.has(base)) return true;
  // Allow dynamic segment routes by replacing [param] placeholders.
  // E.g. "/(main)/products/abc-123" -> "/(main)/products/[slug]"
  for (const allowed of ALLOWED_ROUTES) {
    if (!allowed.includes("[")) continue;
    const re = new RegExp(
      "^" +
        allowed
          .replace(/[.+^${}()|[\]\\]/g, "\\$&")
          .replace(/\[([a-zA-Z0-9_]+)\]/g, "[^/?#]+") +
        "(?:[/?#].*)?$",
    );
    if (re.test(base)) return true;
  }
  return false;
}

export function sanitizeSlug(value: string | null | undefined): string {
  if (!value) return "";
  const trimmed = String(value).trim();
  const cleaned = trimmed.replace(/[^a-zA-Z0-9_-]/g, "");
  return cleaned;
}

export function isUuid(value: string | null | undefined): boolean {
  if (!value) return false;
  return UUID_RE.test(String(value).trim());
}

export function isValidToken(value: string | null | undefined): boolean {
  if (!value) return false;
  return TOKEN_RE.test(String(value).trim());
}

/**
 * Safe wrapper around `router.push` for untrusted screen identifiers
 * (deep links, notification payloads, etc). Validates against the
 * allow-list, sanitizes dynamic segment params, and silently drops
 * anything that fails validation.
 */
export function safeRoutePush(
  router: Router,
  screen: string,
  params?: Record<string, string>,
): boolean {
  if (!screen || typeof screen !== "string") {
    console.warn("[safe-route] rejected empty screen");
    return false;
  }
  const base = screen.split("?")[0];
  if (!isAllowedRoute(base)) {
    console.warn("[safe-route] rejected non-allow-listed screen:", screen);
    return false;
  }
  // Build the final path by interpolating params into the [param] slots.
  let path = base;
  if (params) {
    for (const [key, raw] of Object.entries(params)) {
      const placeholder = `[${key}]`;
      if (!path.includes(placeholder)) continue;
      let safe = "";
      if (key.toLowerCase().includes("slug")) {
        safe = sanitizeSlug(raw);
      } else if (key.toLowerCase().includes("id") || key.toLowerCase().includes("order")) {
        if (!isUuid(raw)) {
          console.warn(`[safe-route] rejected param ${key}=${raw} (not a UUID)`);
          return false;
        }
        safe = String(raw).trim();
      } else if (key.toLowerCase().includes("token")) {
        if (!isValidToken(raw)) {
          console.warn(`[safe-route] rejected param ${key} (not a valid token)`);
          return false;
        }
        safe = String(raw).trim();
      } else {
        // Generic params: strip anything dangerous.
        safe = String(raw ?? "").replace(/[^a-zA-Z0-9_:-]/g, "").slice(0, 128);
      }
      if (!safe) {
        console.warn(`[safe-route] rejected param ${key} (empty after sanitize)`);
        return false;
      }
      path = path.replace(placeholder, encodeURIComponent(safe));
    }
  }
  try {
    // Pass the leftover query string + any new params through expo-router.
    router.push(path as never);
    return true;
  } catch (err) {
    console.warn("[safe-route] router.push failed:", err);
    return false;
  }
}