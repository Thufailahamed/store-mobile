import { describe, expect, it } from "vitest";
import { isNewOrder, isOrderReceivedBySeller, mapSellerOrderRow } from "@/lib/orders/seller-list";

describe("isNewOrder", () => {
  it("counts fresh orders that seller has not received and delivery company has not updated", () => {
    for (const status of ["pending", "confirmed"]) {
      expect(isNewOrder({ status, seller_processed_at: null })).toBe(true);
      expect(isNewOrder({ status })).toBe(true);
    }
  });

  it("still counts as new order when automated courier pickup is scheduled but parcel has not been picked up", () => {
    expect(isNewOrder({ status: "confirmed", courier_status: "pickup_scheduled" })).toBe(true);
    expect(isNewOrder({ status: "pending", courier_status: "pickup_scheduled" })).toBe(true);
    expect(isNewOrder({ status: "confirmed", courier_status: "created" })).toBe(true);
    expect(isNewOrder({ status: "confirmed", courier_status: "pending" })).toBe(true);
  });

  it("stops counting once the seller marks it order received", () => {
    expect(isNewOrder({ status: "pending", seller_processed_at: "2026-11-09T01:00:00Z" })).toBe(false);
    expect(isNewOrder({ status: "confirmed", metadata: { seller_processed_at: "2026-11-09T01:00:00Z" } })).toBe(false);
    expect(isOrderReceivedBySeller({ seller_processed_at: "2026-11-09T01:00:00Z" })).toBe(true);
  });

  it("does not count as new order when delivery company updates the status past confirmed", () => {
    for (const status of ["processing", "packed", "shipped", "out_for_delivery", "delivered", "cancelled", "returned", "refunded"]) {
      expect(isNewOrder({ status, seller_processed_at: null })).toBe(false);
    }
  });

  it("does not count as new order when courier actually picks up or moves the parcel", () => {
    expect(isNewOrder({ status: "confirmed", courier_status: "picked_up" })).toBe(false);
    expect(isNewOrder({ status: "confirmed", courier_status: "in_transit" })).toBe(false);
    expect(isNewOrder({ status: "confirmed", courier_status: "out_for_delivery" })).toBe(false);
    expect(isNewOrder({ status: "confirmed", courier_status: "delivered" })).toBe(false);
  });

  it("mapSellerOrderRow preserves courier_status and metadata for consistent evaluation", () => {
    const raw = {
      id: "ord-1",
      order_number: "LX-123",
      status: "confirmed",
      courier_status: "pickup_scheduled",
      metadata: { placed_via: "checkout_group" },
    };
    const mapped = mapSellerOrderRow(raw);
    expect(mapped.courier_status).toBe("pickup_scheduled");
    expect(isNewOrder(raw)).toBe(true);
    expect(isNewOrder(mapped)).toBe(true);
  });
});
