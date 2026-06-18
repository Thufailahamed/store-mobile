/**
 * Phase 14 — Delivery failure flow smoke (workflow-level).
 *
 * Models the rider's full failure → recovery journey as a sequence of
 * pure-function assertions. No network, no UI mounting — this is the
 * contract test for the orchestration layer that backs the e2e flow.
 *
 * If you later wire up a Playwright spec against the real Expo app, this
 * file should mirror that flow 1:1 — these are the assertions the device
 * test should reproduce.
 */

import { describe, it, expect } from "vitest";
import {
  MAX_DELIVERY_ATTEMPTS,
  attemptCount,
  canReassign,
  canReschedule,
  isRetryAllowed,
  targetStatusForReason,
  type DeliveryFailureContext,
} from "@/lib/delivery-workflow";
import { ISSUE_REASONS } from "@/lib/utils/delivery-format";
import type { Order, OrderStatus } from "@/lib/types";

function makeOrder(over: Partial<Order> = {}): Order {
  return {
    id: "order-1",
    order_number: "LX-0001",
    status: "returned",
    placed_at: new Date().toISOString(),
    subtotal: 1000,
    discount: 0,
    shipping_fee: 200,
    tax: 0,
    total: 1200,
    payment_method: "cod",
    payment_status: "pending",
    delivery_person_id: "rider-1",
    items: [],
    ...over,
  } as Order;
}

describe("e2e: delivery failure flow", () => {
  it("targetStatusForReason picks `returned` for recoverable reasons", () => {
    const recoverable = ISSUE_REASONS.filter((r) => r.severity === "recoverable");
    expect(recoverable.length).toBeGreaterThan(0);
    for (const r of recoverable) {
      expect(targetStatusForReason(r.value)).toBe("returned");
    }
  });

  it("targetStatusForReason picks `cancelled` for terminal + claim reasons", () => {
    const terminalOrClaim = ISSUE_REASONS.filter(
      (r) => r.severity === "terminal" || r.severity === "claim",
    );
    for (const r of terminalOrClaim) {
      expect(targetStatusForReason(r.value)).toBe("cancelled");
    }
  });

  it("step 1: rider opens a returned order with 1 prior attempt", () => {
    const order = makeOrder({ attempt_count: 1 });
    expect(attemptCount(order)).toBe(1);
    expect(order.status as OrderStatus).toBe("returned");
  });

  it("step 2: rider picks `customer_absent` and submits", () => {
    const order = makeOrder();
    const reason = "customer_absent";
    expect(targetStatusForReason(reason)).toBe("returned");
    // Server-side `rider_fail_delivery` accepts the same `returned` status
    // because we're already there — mobile idempotency is preserved.
  });

  it("step 3: recovery banner shows because status=returned and attempts>0", () => {
    const order = makeOrder({ attempt_count: 1 });
    const showBanner = order.status === "returned" && attemptCount(order) > 0;
    expect(showBanner).toBe(true);
  });

  it("step 4: reschedule button visible when isRetryAllowed", () => {
    const order = makeOrder({ attempt_count: 1, status: "returned" });
    const ctx: DeliveryFailureContext = { attemptCount: attemptCount(order) };
    const ok = isRetryAllowed(order, ctx) && canReschedule(order, "customer_absent");
    expect(ok).toBe(true);
  });

  it("step 5: reassign button HIDDEN when reassignAvailable is false (server 404)", () => {
    const order = makeOrder({ attempt_count: 1, status: "returned" });
    const ctx: DeliveryFailureContext = { attemptCount: 1, reassignAvailable: false };
    expect(canReassign(order, ctx)).toBe(false);
  });

  it("step 6: reassign button VISIBLE only when reassignAvailable=true AND attemptCount>0 AND has rider", () => {
    const order = makeOrder({ attempt_count: 1, status: "returned" });
    const ctx: DeliveryFailureContext = { attemptCount: 1, reassignAvailable: true };
    expect(canReassign(order, ctx)).toBe(true);
  });

  it("step 7: max-attempts gate — fail action hidden beyond MAX_DELIVERY_ATTEMPTS", () => {
    const order = makeOrder({ attempt_count: MAX_DELIVERY_ATTEMPTS });
    const ctx: DeliveryFailureContext = { attemptCount: attemptCount(order) };
    const blocked = ctx.attemptCount >= MAX_DELIVERY_ATTEMPTS;
    expect(blocked).toBe(true);
    expect(isRetryAllowed(order, ctx)).toBe(false);
  });

  it("step 8: terminal reasons block reschedule even under the cap", () => {
    const order = makeOrder({ status: "returned", attempt_count: 1 });
    expect(canReschedule(order, "refused")).toBe(false);
    expect(canReschedule(order, "damaged")).toBe(false);
    expect(canReschedule(order, "security_incident")).toBe(false);
  });

  it("step 9: terminal reasons still produce a valid targetStatus", () => {
    expect(targetStatusForReason("refused")).toBe("cancelled");
    expect(targetStatusForReason("damaged")).toBe("cancelled");
    expect(targetStatusForReason("lost_in_transit")).toBe("cancelled");
  });
});