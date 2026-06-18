/**
 * Pure delivery-workflow state machine + guards.
 * Single source of truth for "is action X legal from state Y with context Z".
 *
 * Mirrors the pattern used by lib/order-lifecycle.ts (status edges) and
 * lib/utils/rider-filters.ts (pure helpers + tests). Server-side enforcement
 * (RLS, RPCs, store-api routes) is the authority — these guards prevent
 * the rider UI from offering actions that would otherwise be rejected or
 * that would skip a required predecessor step.
 */

import {
  ISSUE_REASON_BY_VALUE,
  type IssueReason,
} from "@/lib/utils/delivery-format";

/** All actions exposed to the rider UI through scan + detail screens. */
export type DeliveryAction =
  | "pack"
  | "pickup"
  | "pickup:direct"
  | "pickup:transit_to_warehouse"
  | "receive"
  | "dispatch"
  | "start_delivery"
  | "verify_otp"
  | "verify_customer_qr"
  | "fail_delivery"
  | "cancel"
  | "regenerate";

/** Linear happy-path sequence; legal action progression on a healthy order. */
export const DELIVERY_SEQUENCE: DeliveryAction[] = [
  "pack",
  "pickup",
  "receive",
  "dispatch",
  "start_delivery",
  "verify_otp",
];

/** Terminal order statuses — no further rider-driven transitions. */
export const TERMINAL_ORDER_STATUSES = [
  "delivered",
  "returned",
  "refunded",
  "cancelled",
] as const;

export type TerminalOrderStatus = (typeof TERMINAL_ORDER_STATUSES)[number];

/** Strict order statuses from which `start_delivery` is legal. */
export const START_DELIVERY_FROM_STATUSES = ["shipped"] as const;

/** Statuses that allow a rider-initiated verify. */
export const VERIFY_FROM_STATUSES = ["out_for_delivery"] as const;

/** OTP contract — exactly 6 digits, no whitespace, no leading zeros stripped. */
export const OTP_LENGTH = 6;
export const OTP_REGEX = /^\d{6}$/;

export function isValidOtp(otp: string | null | undefined): boolean {
  if (!otp) return false;
  return OTP_REGEX.test(otp.trim());
}

export interface ProofContext {
  /** True after the rider takes a photo and the upload succeeds. */
  hasProofPhoto: boolean;
  /** Public URL returned by the upload step. */
  proofUrl?: string | null;
  /** True after the rider signs on the canvas and the upload succeeds. */
  hasSignature?: boolean;
  /** Public URL of the uploaded signature PNG. */
  signatureUrl?: string | null;
}

/** Actions that require a proof-of-delivery photo before they fire. */
export function isProofRequired(action: DeliveryAction): boolean {
  return action === "verify_otp" || action === "verify_customer_qr";
}

/**
 * Signature is recommended for the verify_* actions, but not enforced at the
 * server gate (touchpads aren't always viable in the field). The mobile UI
 * should still gate the verify button on the signature so the buyer tracking
 * page surfaces it.
 */
export function isSignatureRequired(action: DeliveryAction): boolean {
  return action === "verify_otp" || action === "verify_customer_qr";
}

export function hasProof(ctx: ProofContext): boolean {
  return Boolean(ctx.hasProofPhoto && ctx.proofUrl);
}

export function hasSignature(ctx: ProofContext): boolean {
  return Boolean(ctx.hasSignature && ctx.signatureUrl);
}

export function canStartDelivery(orderStatus: string): boolean {
  return (START_DELIVERY_FROM_STATUSES as readonly string[]).includes(orderStatus);
}

export function canVerifyDelivery(orderStatus: string): boolean {
  return (VERIFY_FROM_STATUSES as readonly string[]).includes(orderStatus);
}

export function isDeliveryTerminal(orderStatus: string): boolean {
  return (TERMINAL_ORDER_STATUSES as readonly string[]).includes(orderStatus);
}

export type ScanLegality =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Decide whether a scan action is legal given current package + order state,
 * the rider's proof context, and the failure-recovery context.
 *
 * Reject reasons (in priority order):
 *  1. Order already terminal.
 *  2. fail_delivery blocked by MAX_DELIVERY_ATTEMPTS (recovery policy).
 *  3. start_delivery called before status === "shipped".
 *  4. verify_* called before status === "out_for_delivery".
 *  5. verify_* called without proof photo.
 *  6. verify_* signature flagged true but signature URL missing.
 *
 * Failure-evidence photo is **not** gating — `fail_delivery` is allowed
 * without a photo so riders in low-signal field conditions can still report.
 * All other actions are passed through — the server (RLS/RPC) is the final
 * authority on whether the action is permitted.
 */
export function isScanActionLegal(
  action: DeliveryAction,
  _packageStatus: string,
  orderStatus: string,
  ctx: ProofContext,
  failureCtx: DeliveryFailureContext = EMPTY_FAILURE_CTX,
): ScanLegality {
  if (isDeliveryTerminal(orderStatus)) {
    return { ok: false, reason: `Order already ${orderStatus}` };
  }
  if (action === "fail_delivery" && failureCtx.attemptCount >= MAX_DELIVERY_ATTEMPTS) {
    return {
      ok: false,
      reason: `Maximum delivery attempts (${MAX_DELIVERY_ATTEMPTS}) reached — escalate to admin`,
    };
  }
  if (action === "start_delivery" && !canStartDelivery(orderStatus)) {
    return {
      ok: false,
      reason: `Order must be shipped before start_delivery (current: ${orderStatus})`,
    };
  }
  if (
    (action === "verify_otp" || action === "verify_customer_qr") &&
    !canVerifyDelivery(orderStatus)
  ) {
    return {
      ok: false,
      reason: `Order must be out_for_delivery before verify (current: ${orderStatus})`,
    };
  }
  if (isProofRequired(action) && !hasProof(ctx)) {
    return { ok: false, reason: "Proof of delivery photo is required" };
  }
  // Signature is recommended (not server-enforced) for verify_*; reject at
  // the client so the buyer tracking page has both photo + signature rendered.
  if (isSignatureRequired(action) && ctx.hasSignature === true && !hasSignature(ctx)) {
    return { ok: false, reason: "Signature upload failed — try again" };
  }
  return { ok: true };
}

/** Filter an action list down to only those currently legal. */
export function legalActions(
  actions: DeliveryAction[],
  packageStatus: string,
  orderStatus: string,
  ctx: ProofContext,
  failureCtx: DeliveryFailureContext = EMPTY_FAILURE_CTX,
): DeliveryAction[] {
  return actions.filter(
    (a) => isScanActionLegal(a, packageStatus, orderStatus, ctx, failureCtx).ok,
  );
}

/* ------------------------------------------------------------------ */
/*  Failure recovery policy                                            */
/* ------------------------------------------------------------------ */

/** Hard cap on how many times a single order may transition into fail_delivery. */
export const MAX_DELIVERY_ATTEMPTS = 3;
/** Hard cap on how many times a single pickup may be marked failed. */
export const MAX_PICKUP_ATTEMPTS = 2;

export interface DeliveryFailureContext {
  /** Number of prior fail_delivery transitions already on this order. */
  attemptCount: number;
  /** Categorical reason for the current/most-recent failure. */
  failureReason?: IssueReason | null;
  /** Public URL of the uploaded failure-evidence photo, if any. */
  failureEvidenceUrl?: string | null;
  /** Previous rider id, set when admin or system reassigned. */
  previousRiderId?: string | null;
  /** ISO timestamp of last failure; used for cooldown UI hints. */
  lastFailedAt?: string | null;
  /** Mobile-only probe: server's /api/delivery/reassign route is reachable. */
  reassignAvailable?: boolean;
}

const EMPTY_FAILURE_CTX: DeliveryFailureContext = { attemptCount: 0 };

/**
 * Reads attempt count from the `attempt_count` column when present, falling
 * back to the legacy `[attempts:N]` marker in `notes`. Mobile is defensive —
 * server is still the authority.
 */
export function attemptCount(order: {
  attempt_count?: number | null;
  notes?: string | null;
}): number {
  if (typeof order.attempt_count === "number") return order.attempt_count;
  const match = (order.notes ?? "").match(/\[attempts:(\d+)\]/);
  return match ? Number(match[1]) : 0;
}

/** Pure helper: derive the target status from a categorical reason. */
export function targetStatusForReason(reason: IssueReason): "returned" | "cancelled" {
  return ISSUE_REASON_BY_VALUE[reason].targetStatus;
}

/** Recoverable reasons are eligible for reschedule from returned / out_for_delivery. */
export function canReschedule(
  order: { status: string },
  reason: IssueReason | null,
): boolean {
  if (!reason) return false;
  const meta = ISSUE_REASON_BY_VALUE[reason];
  return (
    meta.retryEligible &&
    (order.status === "returned" || order.status === "out_for_delivery")
  );
}

/** Reschedule / retry is allowed when under the attempt cap and status matches. */
export function isRetryAllowed(
  order: { status: string },
  ctx: DeliveryFailureContext,
): boolean {
  return (
    ctx.attemptCount < MAX_DELIVERY_ATTEMPTS &&
    (order.status === "returned" || order.status === "out_for_delivery")
  );
}

/**
 * Reassignment (rider-to-rider handoff) is permitted only when:
 *  - the order already had a rider (`delivery_person_id` set),
 *  - the status is in-flight or recoverable,
 *  - at least one failure has been recorded, and
 *  - the server has confirmed the /api/delivery/reassign route is reachable.
 *
 * The button is hidden until the last condition is true; see
 * `isReassignAvailable` in `lib/api/delivery-api.ts`.
 */
export function canReassign(
  order: { status: string; delivery_person_id?: string | null },
  ctx: DeliveryFailureContext,
): boolean {
  return (
    Boolean(order.delivery_person_id) &&
    (order.status === "shipped" ||
      order.status === "out_for_delivery" ||
      order.status === "returned") &&
    ctx.attemptCount > 0 &&
    ctx.reassignAvailable === true
  );
}

/** Soft requirement: failure-evidence photo is recommended, not gating. */
export function isFailureEvidenceRequired(action: DeliveryAction): boolean {
  return action === "fail_delivery";
}

export function hasFailureEvidence(ctx: DeliveryFailureContext): boolean {
  return Boolean(ctx.failureEvidenceUrl && ctx.failureEvidenceUrl.trim());
}