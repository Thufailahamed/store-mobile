import { describe, it, expect } from "vitest";
import {
  CUSTOMER_STATUS_STEPS,
  SELLER_NEXT_STATUS,
  getCustomerStepIndex,
  getSellerNextStatus,
  isValidOrderStatusTransition,
  canBuyerCancel,
} from "@/lib/order-lifecycle";
import type { OrderStatus } from "@/lib/types";

describe("order-lifecycle", () => {
  it("defines seller next status for early pipeline only", () => {
    expect(getSellerNextStatus("pending")).toBe("confirmed");
    expect(getSellerNextStatus("confirmed")).toBe("processing");
    expect(getSellerNextStatus("processing")).toBe("shipped");
  });

  it("rejects skipped-state jumps", () => {
    expect(isValidOrderStatusTransition("pending", "processing")).toBe(false);
    expect(isValidOrderStatusTransition("pending", "delivered")).toBe(false);
    expect(isValidOrderStatusTransition("confirmed", "delivered")).toBe(false);
  });

  it("allows delivery pipeline edges", () => {
    expect(isValidOrderStatusTransition("shipped", "out_for_delivery")).toBe(true);
    expect(isValidOrderStatusTransition("out_for_delivery", "delivered")).toBe(true);
  });

  it("maps customer timeline", () => {
    expect(getCustomerStepIndex("shipped")).toBe(3);
    expect(CUSTOMER_STATUS_STEPS).toHaveLength(6);
  });

  it("limits buyer cancel statuses", () => {
    expect(canBuyerCancel("pending")).toBe(true);
    expect(canBuyerCancel("processing")).toBe(false);
  });

  it("covers seller map keys", () => {
    const statuses: OrderStatus[] = [
      "pending", "confirmed", "processing", "shipped", "out_for_delivery",
      "delivered", "cancelled", "returned", "refunded", "failed_attempt",
    ];
    for (const s of statuses) {
      expect(SELLER_NEXT_STATUS[s]).toBeDefined();
    }
  });
});

describe("order-lifecycle — reschedule edge", () => {
  // Phase 14 — reschedule (returned → out_for_delivery) is intentionally NOT
  // a direct edge in ORDER_STATUS_EDGES. The rider-side recovery flow goes
  // through `deliveryTransition("out_for_delivery", undefined, {next_retry_at})`
  // (see `riderReschedule` in lib/api/index.ts), which the server-side RPC
  // `rider_reschedule_delivery` enforces with attempt-count policy.
  it("does NOT model reschedule as a direct lifecycle edge", () => {
    expect(isValidOrderStatusTransition("returned", "out_for_delivery")).toBe(false);
    expect(isValidOrderStatusTransition("out_for_delivery", "returned")).toBe(true);
    expect(isValidOrderStatusTransition("cancelled", "out_for_delivery")).toBe(false);
  });

  it("seller next from `returned` is terminal (not out_for_delivery)", () => {
    expect(getSellerNextStatus("returned")).toBeNull();
  });

  // Multi-vendor partial-cancel recovery (migration 0117): failed_attempt
  // is no longer a dead-end. SELLER_NEXT_STATUS points to "cancelled" as
  // the preferred recovery, and ORDER_STATUS_EDGES covers the rest.
  it("seller next from `failed_attempt` is the recovery target `cancelled`", () => {
    expect(getSellerNextStatus("failed_attempt")).toBe("cancelled");
  });

  it("allows failed_attempt recovery edges", () => {
    expect(isValidOrderStatusTransition("failed_attempt", "cancelled")).toBe(true);
    expect(isValidOrderStatusTransition("failed_attempt", "returned")).toBe(true);
    expect(isValidOrderStatusTransition("failed_attempt", "confirmed")).toBe(true);
    expect(isValidOrderStatusTransition("failed_attempt", "processing")).toBe(true);
    // Random other transition still blocked.
    expect(isValidOrderStatusTransition("failed_attempt", "delivered")).toBe(false);
  });
});
