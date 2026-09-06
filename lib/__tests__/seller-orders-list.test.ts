import { describe, it, expect } from "vitest";
import {
  countOrderUnits,
  countOrdersByStatus,
  filterSellerOrders,
  firstLineItem,
  formatCheckoutPayment,
  formatOrderStatusLabel,
  formatPaymentStatus,
  isAmbiguousRelationshipError,
  mapSellerOrderRow,
  readShippingContact,
  SELLER_ORDERS_LIST_SELECT,
} from "@/lib/orders/seller-list";

describe("formatCheckoutPayment", () => {
  it("labels live card checkout as PayHere", () => {
    expect(formatCheckoutPayment("payhere")).toBe("PayHere");
    expect(formatCheckoutPayment("stripe")).toBe("PayHere");
  });

  it("labels cash on delivery in full", () => {
    expect(formatCheckoutPayment("cod")).toBe("Cash on delivery");
  });

  it("keeps other gateways readable", () => {
    expect(formatCheckoutPayment("paypal")).toBe("PayPal");
    expect(formatCheckoutPayment("wallet")).toBe("Wallet");
  });

  it("does not invent a method", () => {
    expect(formatCheckoutPayment(null)).toBe("—");
    expect(formatCheckoutPayment("")).toBe("—");
  });
});

describe("formatPaymentStatus", () => {
  it("uses seller-facing copy", () => {
    expect(formatPaymentStatus("paid")).toBe("Paid");
    expect(formatPaymentStatus("pending")).toBe("Unpaid");
    expect(formatPaymentStatus("refunded")).toBe("Refunded");
  });

  it("does not invent a status", () => {
    expect(formatPaymentStatus(undefined)).toBe("—");
  });
});

describe("formatOrderStatusLabel", () => {
  it("matches the packing tab label", () => {
    expect(formatOrderStatusLabel("processing")).toBe("Packing");
  });

  it("title-cases known statuses", () => {
    expect(formatOrderStatusLabel("out_for_delivery")).toBe("Out for delivery");
    expect(formatOrderStatusLabel("delivered")).toBe("Delivered");
  });
});

describe("countOrderUnits", () => {
  it("sums quantities", () => {
    expect(countOrderUnits([{ quantity: 1 }, { quantity: 2 }])).toBe(3);
  });

  it("stays unknown when items are missing", () => {
    expect(countOrderUnits(undefined)).toBeNull();
    expect(countOrderUnits([])).toBeNull();
  });
});

describe("readShippingContact", () => {
  it("reads jsonb shipping_address", () => {
    expect(
      readShippingContact({
        shipping_address: { full_name: "Asha Perera", city: "Colombo", state: "Western" },
      }),
    ).toEqual({ name: "Asha Perera", place: "Colombo" });
  });

  it("parses a JSON string address", () => {
    expect(
      readShippingContact({
        shipping_address: JSON.stringify({ full_name: "Nimal", city: "Kandy" }),
      }),
    ).toEqual({ name: "Nimal", place: "Kandy" });
  });
});

describe("firstLineItem", () => {
  it("prefers product_name then nested product.name", () => {
    const item = firstLineItem([
      {
        quantity: 1,
        product_name: "",
        product: {
          name: "Silk scarf",
          images: [{ url: "https://cdn.example/scarf.jpg", is_primary: true }],
        },
      },
    ]);
    expect(item?.name).toBe("Silk scarf");
    expect(item?.imageUrl).toBe("https://cdn.example/scarf.jpg");
  });
});

describe("mapSellerOrderRow", () => {
  it("normalizes nested product and payment fields", () => {
    const order = mapSellerOrderRow({
      id: "o1",
      order_number: "LX-1",
      user_id: "u1",
      status: "processing",
      payment_status: "paid",
      payment_method: "payhere",
      total: 15552,
      currency: "LKR",
      placed_at: "2026-08-30T10:00:00Z",
      shipping_address: { full_name: "Asha", city: "Colombo" },
      items: [
        {
          id: "i1",
          quantity: 2,
          product: { name: "Blazer", images: [{ url: "/img.jpg", is_primary: true }] },
        },
      ],
    });
    expect(order.payment_method).toBe("payhere");
    expect(order.items?.[0]?.product_name).toBe("Blazer");
    expect(order.items?.[0]?.quantity).toBe(2);
    expect(order.items?.[0]?.image_url).toBe("https://store-api.test.invalid/img.jpg");
    expect(order.shipping_address?.full_name).toBe("Asha");
  });
});

describe("isAmbiguousRelationshipError", () => {
  it("detects the PostgREST orders/users embed failure", () => {
    expect(
      isAmbiguousRelationshipError(
        "upstream: Could not embed because more than one relationship was found for 'orders' and 'users'",
      ),
    ).toBe(true);
    expect(isAmbiguousRelationshipError("Not signed in")).toBe(false);
  });

  it("uses a disambiguated list select without users", () => {
    expect(SELLER_ORDERS_LIST_SELECT).toContain("order_items!order_items_order_id_fkey");
    expect(SELLER_ORDERS_LIST_SELECT).not.toMatch(/users\s*\(/);
  });
});

describe("filterSellerOrders / counts", () => {
  const rows = [
    mapSellerOrderRow({
      id: "1",
      order_number: "LX-A",
      status: "processing",
      payment_method: "payhere",
      payment_status: "paid",
      total: 1,
      currency: "LKR",
      placed_at: "2026-01-01T00:00:00Z",
      shipping_address: { full_name: "Asha Perera", city: "Colombo" },
      items: [{ product_name: "Blazer", quantity: 1 }],
    }),
    mapSellerOrderRow({
      id: "2",
      order_number: "LX-B",
      status: "delivered",
      payment_method: "cod",
      payment_status: "pending",
      total: 1,
      currency: "LKR",
      placed_at: "2026-01-02T00:00:00Z",
      shipping_address: { full_name: "Nimal", city: "Kandy" },
      items: [{ product_name: "Scarf", quantity: 1 }],
    }),
  ];

  it("filters by packing status without losing other counts", () => {
    const packing = filterSellerOrders(rows, { status: "processing", search: "" });
    expect(packing.map((o) => o.id)).toEqual(["1"]);
    expect(countOrdersByStatus(rows)).toEqual({ all: 2, processing: 1, delivered: 1 });
  });

  it("searches order number, customer, city, and product", () => {
    expect(filterSellerOrders(rows, { status: "all", search: "kandy" }).map((o) => o.id)).toEqual(["2"]);
    expect(filterSellerOrders(rows, { status: "all", search: "blazer" }).map((o) => o.id)).toEqual(["1"]);
    expect(filterSellerOrders(rows, { status: "all", search: "lx-a" }).map((o) => o.id)).toEqual(["1"]);
  });
});
