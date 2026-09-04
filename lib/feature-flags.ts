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
 *
 * LUXE roll-out flags (mirror NEXT_PUBLIC_* from the web store):
 *
 *   EXPO_PUBLIC_LUXE_BRAND_WITHDRAWAL      — brand bank/PayPal withdraw UI (0310)
 *   EXPO_PUBLIC_LUXE_ANALYTICS_SLICE_B     — marketing analytics tabs (Slice B)
 *   EXPO_PUBLIC_LUXE_AI_STUDIO             — paid AI Product Studio (0250)
 *   EXPO_PUBLIC_LUXE_STOREFRONT_BUILDER    — Shopify-style builder (0201-0203)
 *   EXPO_PUBLIC_LUXE_TWO_FACTOR            — mobile 2FA enrollment surface
 *
 * Implemented LUXE surfaces default ON so a local Expo build shows working
 * storefront / AI studio / payouts / withdraw UI. Set EXPO_PUBLIC_*=false to
 * hide them when a caller wires FeatureOffScreen. Courier flags stay off.
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
  // Implemented LUXE surfaces default ON. Courier migration flags stay off.
  luxeBrandWithdrawal: readBool("EXPO_PUBLIC_LUXE_BRAND_WITHDRAWAL", true),
  luxeAnalyticsSliceB: readBool("EXPO_PUBLIC_LUXE_ANALYTICS_SLICE_B", true),
  luxeAiStudio: readBool("EXPO_PUBLIC_LUXE_AI_STUDIO", true),
  luxeStorefrontBuilder: readBool("EXPO_PUBLIC_LUXE_STOREFRONT_BUILDER", true),
  luxeTwoFactor: readBool("EXPO_PUBLIC_LUXE_TWO_FACTOR", true),
} as const;

export function isInternalDeliveryVisibleMobile(): boolean {
  return MOBILE_FEATURE_FLAGS.internalDeliveryPortalVisible;
}

export function isExternalCourierEnabledMobile(): boolean {
  return MOBILE_FEATURE_FLAGS.externalCourierEnabled;
}

export function isLuxeBrandWithdrawalMobile(): boolean {
  return MOBILE_FEATURE_FLAGS.luxeBrandWithdrawal;
}

export function isLuxeAnalyticsSliceBMobile(): boolean {
  return MOBILE_FEATURE_FLAGS.luxeAnalyticsSliceB;
}

export function isLuxeAiStudioMobile(): boolean {
  return MOBILE_FEATURE_FLAGS.luxeAiStudio;
}

export function isLuxeStorefrontBuilderMobile(): boolean {
  return MOBILE_FEATURE_FLAGS.luxeStorefrontBuilder;
}

export function isLuxeTwoFactorMobile(): boolean {
  return MOBILE_FEATURE_FLAGS.luxeTwoFactor;
}