import { describe, it, expect, vi, beforeEach } from "vitest";

const fetchJsonMock = vi.fn();
vi.mock("@/lib/api/_fetch", () => ({
  fetchJson: (...args: unknown[]) => fetchJsonMock(...args),
}));

import { placeOrderGroupBackend, getCheckoutOptionsBackend } from "@/lib/api/backend";

beforeEach(() => {
  fetchJsonMock.mockReset();
});

describe("placeOrderGroupBackend", () => {
  it("POSTs /api/orders/group with orders[] not cart_groups", async () => {
    fetchJsonMock.mockResolvedValueOnce({
      ok: true,
      data: { group_id: "g1", orders: [{ id: "o1" }] },
    });
    await placeOrderGroupBackend({
      orders: [{
        store_id: "00000000-0000-0000-0000-000000000001",
        items: [{
          product_id: "00000000-0000-0000-0000-000000000002",
          variant_id: "00000000-0000-0000-0000-000000000003",
          quantity: 1,
          unit_price: 2500,
        }],
        subtotal: 2500,
        total: 2500,
      }],
      address_id: "00000000-0000-0000-0000-000000000004",
      shipping_address: { full_name: "A", line1: "1 St", city: "Colombo", postal_code: "00100" },
      payment_method: "cod",
      loyalty_points_redeemed: 100,
      group_id: "00000000-0000-0000-0000-000000000005",
    });
    expect(fetchJsonMock).toHaveBeenCalledWith("/api/orders/group", expect.objectContaining({
      method: "POST",
      body: expect.objectContaining({
        orders: expect.any(Array),
        payment_method: "cod",
        address_id: "00000000-0000-0000-0000-000000000004",
        loyalty_points_redeemed: 100,
        group_id: "00000000-0000-0000-0000-000000000005",
      }),
    }));
    const body = fetchJsonMock.mock.calls[0][1].body as Record<string, unknown>;
    expect(body).not.toHaveProperty("cart_groups");
    expect(body).not.toHaveProperty("points_redeemed");
  });
});

describe("getCheckoutOptionsBackend", () => {
  it("POSTs store ids to /api/checkout/options", async () => {
    fetchJsonMock.mockResolvedValueOnce({ ok: true, data: { cod_allowed: true, stores: {} } });
    await getCheckoutOptionsBackend(["00000000-0000-0000-0000-000000000001"]);
    expect(fetchJsonMock).toHaveBeenCalledWith("/api/checkout/options", {
      method: "POST",
      body: { store_ids: ["00000000-0000-0000-0000-000000000001"] },
    });
  });
});
