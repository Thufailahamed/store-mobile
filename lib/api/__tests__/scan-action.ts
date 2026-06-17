/**
 * Pure scan-action decision resolution.
 * Mirrors the inline logic in app/(delivery)/scan/index.tsx runAction().
 *
 * Given a `PackageScanAction` like "pickup:direct" or "verify_otp",
 * derive the wire-format (bare action + pickup decision) we send to
 * POST /api/packages/scan.
 */

export type PickupDecision = "direct" | "transit_to_warehouse";

export type ResolvedScanAction = {
  /** Action key the server expects (e.g. "pickup" not "pickup:direct"). */
  bareAction: string;
  /** Pickup routing decision, if applicable. */
  pickupDecision?: PickupDecision;
};

export function resolveScanAction(action: string): ResolvedScanAction {
  if (action === "pickup:direct") {
    return { bareAction: "pickup", pickupDecision: "direct" };
  }
  if (action === "pickup:transit_to_warehouse") {
    return { bareAction: "pickup", pickupDecision: "transit_to_warehouse" };
  }
  return { bareAction: action };
}
