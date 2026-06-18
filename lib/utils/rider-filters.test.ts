import { describe, it, expect } from "vitest";
import {
  matchesSearch,
  matchesFilter,
  filterOrders,
  countByFilter,
  type OrdersFilter,
} from "./rider-filters";
import type { Order } from "@/lib/types";

function mkOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: overrides.id ?? "o1",
    order_number: overrides.order_number ?? "ORD-001",
    status: overrides.status ?? "processing",
    placed_at: overrides.placed_at ?? new Date().toISOString(),
    total: overrides.total ?? 1000,
    shipping_address: overrides.shipping_address ?? { full_name: "Alice", phone: "+1000000000", line1: "1 St", city: "Colombo", state: "WP", postal_code: "00100", country: "LK" },
    payment_method: overrides.payment_method ?? "card",
    payment_status: overrides.payment_status ?? "paid",
  } as Order;
}

describe("matchesSearch", () => {
  const o = mkOrder({ order_number: "ORD-99", shipping_address: { full_name: "Bob Smith", phone: "+1000000000", line1: "1 St", city: "Kandy", state: "CP", postal_code: "20000", country: "LK" } });

  it("empty query matches anything", () => {
    expect(matchesSearch(o, "")).toBe(true);
  });

  it("matches order number (case-insensitive)", () => {
    expect(matchesSearch(o, "ord-99")).toBe(true);
  });

  it("matches customer name", () => {
    expect(matchesSearch(o, "bob")).toBe(true);
  });

  it("matches city", () => {
    expect(matchesSearch(o, "kandy")).toBe(true);
  });

  it("rejects non-match", () => {
    expect(matchesSearch(o, "galle")).toBe(false);
  });
});

describe("matchesFilter", () => {
  it("all returns true for any status", () => {
    expect(matchesFilter(mkOrder({ status: "cancelled" }), "all")).toBe(true);
  });

  it("assigned excludes delivered/returned/refunded/cancelled AND out_for_delivery", () => {
    expect(matchesFilter(mkOrder({ status: "processing" }), "assigned")).toBe(true);
    expect(matchesFilter(mkOrder({ status: "shipped" }), "assigned")).toBe(true);
    expect(matchesFilter(mkOrder({ status: "out_for_delivery" }), "assigned")).toBe(false);
    expect(matchesFilter(mkOrder({ status: "delivered" }), "assigned")).toBe(false);
    expect(matchesFilter(mkOrder({ status: "cancelled" }), "assigned")).toBe(false);
  });

  it("out_for_delivery is exact", () => {
    expect(matchesFilter(mkOrder({ status: "out_for_delivery" }), "out_for_delivery")).toBe(true);
    expect(matchesFilter(mkOrder({ status: "shipped" }), "out_for_delivery")).toBe(false);
  });

  it("completed only matches terminal states", () => {
    expect(matchesFilter(mkOrder({ status: "delivered" }), "completed")).toBe(true);
    expect(matchesFilter(mkOrder({ status: "returned" }), "completed")).toBe(true);
    expect(matchesFilter(mkOrder({ status: "refunded" }), "completed")).toBe(true);
    expect(matchesFilter(mkOrder({ status: "cancelled" }), "completed")).toBe(true);
    expect(matchesFilter(mkOrder({ status: "processing" }), "completed")).toBe(false);
  });
});

describe("filterOrders", () => {
  const orders: Order[] = [
    mkOrder({ id: "1", order_number: "ORD-1", status: "processing" }),
    mkOrder({ id: "2", order_number: "ORD-2", status: "out_for_delivery" }),
    mkOrder({ id: "3", order_number: "ORD-3", status: "delivered" }),
    mkOrder({ id: "4", order_number: "ORD-9", status: "shipped" }),
  ];

  it("combines search + filter", () => {
    const out = filterOrders(orders, "ord-9", "assigned");
    expect(out.map((o) => o.id)).toEqual(["4"]);
  });

  it("search only when filter is all", () => {
    const out = filterOrders(orders, "ord", "all");
    expect(out).toHaveLength(4);
  });
});

describe("countByFilter", () => {
  const orders: Order[] = [
    mkOrder({ id: "1", status: "processing" }),
    mkOrder({ id: "2", status: "shipped" }),
    mkOrder({ id: "3", status: "out_for_delivery" }),
    mkOrder({ id: "4", status: "delivered" }),
    mkOrder({ id: "5", status: "cancelled" }),
  ];

  it("counts each bucket correctly", () => {
    const c = countByFilter(orders);
    expect(c.all).toBe(5);
    expect(c.assigned).toBe(2);
    expect(c.out_for_delivery).toBe(1);
    expect(c.completed).toBe(2);
  });
});
