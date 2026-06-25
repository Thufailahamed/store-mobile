/**
 * Mobile feature flag mirrors. Read from EXPO_PUBLIC_* env vars (inlined
 * into the bundle by Expo). Mirror the web flags so the same deployment
 * controls both surfaces.
 *
 * Two flags govern the courier migration:
 *
 *   EXPO_PUBLIC_INTERNAL_DELIVERY_PORTAL_VISIBLE
 *     - When `true`, the rider / delivery-company screens remain visible.
 *     - When `false` (default), those routes render a "managed externally"
 *       notice.
 *
 *   EXPO_PUBLIC_EXTERNAL_COURIER_ENABLED
 *     - When `true`, the new admin/courier screens are reachable; customer
 *       tracking pages surface external links + provider name.
 *     - When `false` (default), the new path is dormant.
 */

function readBool(name: string, def = false): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const env = (globalThis as any)?.process?.env ?? {};
  const v = env[name];
  if (typeof v !== "string") return def;
  return v === "true" || v === "1" || v === "yes";
}

export const MOBILE_FEATURE_FLAGS = {
  internalDeliveryPortalVisible: readBool(
    "EXPO_PUBLIC_INTERNAL_DELIVERY_PORTAL_VISIBLE",
    false,
  ),
  externalCourierEnabled: readBool(
    "EXPO_PUBLIC_EXTERNAL_COURIER_ENABLED",
    false,
  ),
} as const;

export function isInternalDeliveryVisibleMobile(): boolean {
  return MOBILE_FEATURE_FLAGS.internalDeliveryPortalVisible;
}

export function isExternalCourierEnabledMobile(): boolean {
  return MOBILE_FEATURE_FLAGS.externalCourierEnabled;
}