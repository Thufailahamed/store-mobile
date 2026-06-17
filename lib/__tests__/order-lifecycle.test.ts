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
    expect(getSellerNextStatus("processing")).toBeNull();
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
      "delivered", "cancelled", "returned", "refunded",
    ];
    for (const s of statuses) {
      expect(SELLER_NEXT_STATUS[s]).toBeDefined();
    }
  });
});
