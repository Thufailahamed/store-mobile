import { describe, it, expect } from "vitest";
import {
  extractOrderRef,
  formatNotificationBody,
  isNotificationUnread,
  normalizeSellerNotifType,
  parseOrderAlert,
  sellerNotifHref,
} from "@/lib/notifications/seller-inbox";

describe("normalizeSellerNotifType", () => {
  it("buckets order_placed as order", () => {
    expect(normalizeSellerNotifType("order_placed")).toBe("order");
    expect(normalizeSellerNotifType("sale")).toBe("order");
  });

  it("buckets stock alerts as inventory", () => {
    expect(normalizeSellerNotifType("stock_low")).toBe("inventory");
  });

  it("buckets reviews", () => {
    expect(normalizeSellerNotifType("review_received")).toBe("review");
  });
});

describe("isNotificationUnread", () => {
  it("treats sent + no read_at as unread", () => {
    expect(isNotificationUnread({ status: "sent", read_at: null })).toBe(true);
  });

  it("treats status read as read", () => {
    expect(isNotificationUnread({ status: "read", read_at: null })).toBe(false);
  });

  it("treats read_at as read", () => {
    expect(isNotificationUnread({ status: "sent", read_at: "2026-08-01T00:00:00Z" })).toBe(false);
  });
});

describe("parseOrderAlert", () => {
  it("pulls order number, amount, and store from the template body", () => {
    const parsed = parseOrderAlert(
      "You have a new order LX-20260802-CNGG6 worth 529200.00 LKR at Aura Boutique",
      {},
    );
    expect(parsed.orderNumber).toBe("LX-20260802-CNGG6");
    expect(parsed.amount).toBe(529200);
    expect(parsed.currency).toBe("LKR");
    expect(parsed.storeName).toBe("Aura Boutique");
  });

  it("prefers structured data over body text", () => {
    const parsed = parseOrderAlert("ignored", {
      order_number: "LX-1",
      order_id: "oid-1",
      total: 1500,
      currency: "LKR",
    });
    expect(parsed.orderNumber).toBe("LX-1");
    expect(parsed.orderId).toBe("oid-1");
    expect(parsed.amount).toBe(1500);
  });
});

describe("formatNotificationBody", () => {
  it("does not leave a raw 529200.00 blob", () => {
    const text = formatNotificationBody(
      "You have a new order LX-20260802-CNGG6 worth 529200.00 LKR at Aura Boutique",
      {},
    );
    expect(text).toContain("LX-20260802-CNGG6");
    expect(text).toContain("Aura Boutique");
    expect(text).not.toMatch(/529200\.00/);
    expect(text).toMatch(/529,200/);
  });
});

describe("extractOrderRef / href", () => {
  it("finds LX codes", () => {
    expect(extractOrderRef("order LX-20260805-L3PTR arrived", {})).toBe("LX-20260805-L3PTR");
  });

  it("links to the order when an id is present", () => {
    expect(sellerNotifHref({ type: "order_placed", data: { order_id: "abc" } })).toBe("/(seller)/orders/abc");
  });

  it("falls back to orders search", () => {
    expect(
      sellerNotifHref({
        type: "order_placed",
        body: "You have a new order LX-20260809-YVFGI worth 100 LKR at Aura",
        data: {},
      }),
    ).toBe("/(seller)/orders?search=LX-20260809-YVFGI");
  });

  it("opens inventory for stock alerts", () => {
    expect(sellerNotifHref({ type: "stock_low", data: {} })).toBe("/(seller)/inventory");
  });
});
