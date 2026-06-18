/**
 * Pure scan-action decision resolution.
 * Mirrors the inline logic in app/(delivery)/scan/index.tsx runAction().
 *
 * Given a `PackageScanAction` like "pickup:direct" or "verify_otp",
 * derive the wire-format (bare action + pickup decision) we send to
 * POST /api/packages/scan. Failure metadata is forwarded when provided
 * so the server can persist categorical reason + evidence URL alongside
 * the bare `fail_delivery` action.
 */

import type { IssueReason } from "@/lib/utils/delivery-format";

export type PickupDecision = "direct" | "transit_to_warehouse";

export interface ResolvedScanAction {
  /** Action key the server expects (e.g. "pickup" not "pickup:direct"). */
  bareAction: string;
  /** Pickup routing decision, if applicable. */
  pickupDecision?: PickupDecision;
  /** Categorical failure reason, set when bareAction === "fail_delivery". */
  failureReason?: IssueReason;
  /** Failure-evidence photo URL, set when bareAction === "fail_delivery". */
  failureEvidenceUrl?: string | null;
}

export interface ResolveScanActionOptions {
  failureReason?: IssueReason;
  failureEvidenceUrl?: string | null;
}

export function resolveScanAction(
  action: string,
  opts?: ResolveScanActionOptions,
): ResolvedScanAction {
  if (action === "pickup:direct") {
    return { bareAction: "pickup", pickupDecision: "direct" };
  }
  if (action === "pickup:transit_to_warehouse") {
    return { bareAction: "pickup", pickupDecision: "transit_to_warehouse" };
  }
  const result: ResolvedScanAction = { bareAction: action };
  if (action === "fail_delivery") {
    if (opts?.failureReason) result.failureReason = opts.failureReason;
    if (opts?.failureEvidenceUrl !== undefined) {
      result.failureEvidenceUrl = opts.failureEvidenceUrl;
    }
  }
  return result;
}
