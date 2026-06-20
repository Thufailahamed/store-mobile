import type { OrderStatus } from "@/lib/types";

/** Legal single-step seller transitions (fulfillment uses scan / fulfill RPCs). */
export const SELLER_NEXT_STATUS: Record<OrderStatus, OrderStatus | null> = {
  pending: "confirmed",
  confirmed: "processing",
  processing: "shipped",
  shipped: null,
  out_for_delivery: null,
  delivered: null,
  cancelled: null,
  returned: null,
  refunded: null,
  // Phase 14 soft-fail marker. Recovery edges (to cancelled/returned) live in
  // ORDER_STATUS_EDGES below; SELLER_NEXT_STATUS points to the preferred one.
  failed_attempt: "cancelled",
};

/** Buyer-facing timeline — includes delivery stages. */
export const CUSTOMER_STATUS_STEPS: OrderStatus[] = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "out_for_delivery",
  "delivered",
];

/** Explicit transition edges enforced in Postgres (see 0097 migration). */
export const ORDER_STATUS_EDGES: ReadonlyArray<readonly [OrderStatus, OrderStatus]> = [
  ["pending", "confirmed"],
  ["pending", "cancelled"],
  ["confirmed", "processing"],
  ["confirmed", "shipped"],
  ["confirmed", "cancelled"],
  ["confirmed", "out_for_delivery"],
  ["processing", "shipped"],
  ["processing", "cancelled"],
  ["processing", "out_for_delivery"],
  ["shipped", "out_for_delivery"],
  ["shipped", "delivered"],
  ["shipped", "cancelled"],
  ["out_for_delivery", "delivered"],
  ["out_for_delivery", "returned"],
  ["out_for_delivery", "cancelled"],
  ["out_for_delivery", "shipped"],
  ["delivered", "returned"],
  ["delivered", "refunded"],
  ["returned", "refunded"],
  // Multi-vendor partial-cancel recovery (migration 0117): failed_attempt
  // is no longer a dead-end. Sellers can escalate back into the lifecycle.
  ["failed_attempt", "cancelled"],
  ["failed_attempt", "returned"],
  ["failed_attempt", "confirmed"],
  ["failed_attempt", "processing"],
];

const EDGE_SET = new Set(ORDER_STATUS_EDGES.map(([a, b]) => `${a}->${b}`));

const ADMIN_OVERRIDE_EDGES = new Set([
  "shipped->delivered",
  "processing->delivered",
  "confirmed->delivered",
  "shipped->cancelled",
  "shipped->returned",
  "processing->confirmed",
  "confirmed->pending",
]);

export function isValidOrderStatusTransition(
  from: OrderStatus,
  to: OrderStatus,
  adminOverride = false,
): boolean {
  if (from === to) return true;
  if (from === "cancelled" || from === "refunded") return false;
  if (from === "returned" && to !== "refunded") return false;
  if (EDGE_SET.has(`${from}->${to}`)) return true;
  if (adminOverride && ADMIN_OVERRIDE_EDGES.has(`${from}->${to}`)) return true;
  return false;
}

export function getSellerNextStatus(status: OrderStatus): OrderStatus | null {
  return SELLER_NEXT_STATUS[status] ?? null;
}

export function getCustomerStepIndex(status: OrderStatus): number {
  if (status === "cancelled" || status === "returned" || status === "refunded") {
    return -1;
  }
  return CUSTOMER_STATUS_STEPS.indexOf(status);
}

export function canBuyerCancel(status: OrderStatus): boolean {
  return status === "pending" || status === "confirmed";
}

/** Statuses an admin may set via transition_order_status from the current state. */
export function getAdminTransitionTargets(
  status: OrderStatus,
  opts?: { hasAssignedRider?: boolean; hasDeliveryOtp?: boolean },
): OrderStatus[] {
  const targets = new Set<OrderStatus>();
  const sellerNext = getSellerNextStatus(status);
  if (sellerNext) targets.add(sellerNext);

  if (!["delivered", "cancelled", "returned", "refunded"].includes(status)) {
    if (isValidOrderStatusTransition(status, "cancelled")) targets.add("cancelled");
  }
  if (status === "delivered" || status === "returned") {
    targets.add("refunded");
  }
  const riderLocked = Boolean(opts?.hasAssignedRider && opts?.hasDeliveryOtp);
  if (!riderLocked) {
    if (
      isValidOrderStatusTransition(status, "delivered", true)
      || isValidOrderStatusTransition(status, "delivered", false)
    ) {
      targets.add("delivered");
    }
  }
  targets.delete(status);
  return [...targets];
}

export const ADMIN_FILTER_STATUSES: OrderStatus[] = [
  "pending", "confirmed", "processing", "shipped", "out_for_delivery",
  "delivered", "cancelled", "returned", "refunded",
];

export const SELLER_MANUAL_RPC_STATUSES = ["confirmed", "processing", "cancelled"] as const;
export type SellerManualRpcStatus = (typeof SELLER_MANUAL_RPC_STATUSES)[number];

export function isSellerManualRpcStatus(status: string): status is SellerManualRpcStatus {
  return (SELLER_MANUAL_RPC_STATUSES as readonly string[]).includes(status);
}

/** 2-hour buyer cancellation window — mirrors web parity. */
export const BUYER_CANCEL_WINDOW_MS = 2 * 60 * 60 * 1000;

/**
 * Buyer cancellation eligibility: status must be in `pending`/`confirmed` and
 * the order must have been placed within the last 2 hours. When `placed_at`
 * is missing/unparseable we fail closed (deny) rather than allow — the
 * window check is a safety belt, not optional.
 */
export function canBuyerCancelInWindow(
  status: OrderStatus,
  placedAt: string | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (!canBuyerCancel(status)) return false;
  if (!placedAt) return false;
  const placedMs = new Date(placedAt).getTime();
  if (Number.isNaN(placedMs)) return false;
  return nowMs - placedMs <= BUYER_CANCEL_WINDOW_MS;
}

/** Statuses that have a live delivery timeline worth showing to the buyer. */
export const TRACKABLE_STATUSES: ReadonlyArray<OrderStatus> = [
  "shipped",
  "out_for_delivery",
];

export function isTrackableStatus(status: OrderStatus): boolean {
  return (TRACKABLE_STATUSES as readonly OrderStatus[]).includes(status);
}
