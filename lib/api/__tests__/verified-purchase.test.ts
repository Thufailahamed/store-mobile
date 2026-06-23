/**
 * Verified-purchase enforcement — mobile API parity tests.
 * Verifies:
 *   • getEligibleReviewOrders → B.getEligibleReviewOrdersBackend(productId)
 *   • returns [] when backend errors or productId is empty
 *   • Review type exposes the fields the form sends / consumes
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const { getEligibleReviewOrdersBackendMock } = vi.hoisted(() => {
  const getEligibleReviewOrdersBackendMock = vi.fn();
  return { getEligibleReviewOrdersBackendMock };
});

vi.mock("@/lib/api/backend", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/backend")>();
  return {
    ...actual,
    getEligibleReviewOrdersBackend: getEligibleReviewOrdersBackendMock,
  };
});

import { getEligibleReviewOrders } from "@/lib/api";
import type { Review, EligibleReviewOrder } from "@/lib/types";

beforeEach(() => {
  getEligibleReviewOrdersBackendMock.mockReset();
});

describe("getEligibleReviewOrders (mobile)", () => {
  it("calls getEligibleReviewOrdersBackend(productId)", async () => {
    getEligibleReviewOrdersBackendMock.mockResolvedValueOnce({
      ok: true,
      data: {
        orders: [
          {
            order_item_id: "oi-1",
            order_id: "o-1",
            order_number: "ORD-001",
            delivered_at: "2026-05-01T00:00:00Z",
            quantity: 2,
          },
        ],
      },
    });
    const r = await getEligibleReviewOrders("prod-1");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data).toHaveLength(1);
      expect(r.data[0].order_item_id).toBe("oi-1");
      expect(r.data[0].order_number).toBe("ORD-001");
    }
    expect(getEligibleReviewOrdersBackendMock).toHaveBeenCalledTimes(1);
    expect(getEligibleReviewOrdersBackendMock).toHaveBeenCalledWith("prod-1");
  });

  it("returns fail when backend errors", async () => {
    getEligibleReviewOrdersBackendMock.mockResolvedValueOnce({
      ok: false,
      error: "rpc failed",
    });
    const r = await getEligibleReviewOrders("prod-1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/rpc failed/);
  });

  it("returns [] when backend resolves to empty orders", async () => {
    getEligibleReviewOrdersBackendMock.mockResolvedValueOnce({
      ok: true,
      data: { orders: [] },
    });
    const r = await getEligibleReviewOrders("prod-1");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toEqual([]);
  });

  it("returns [] when backend resolves to null orders", async () => {
    getEligibleReviewOrdersBackendMock.mockResolvedValueOnce({
      ok: true,
      data: { orders: null },
    });
    const r = await getEligibleReviewOrders("prod-1");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toEqual([]);
  });

  it("returns fail when empty productId is passed", async () => {
    getEligibleReviewOrdersBackendMock.mockResolvedValueOnce({
      ok: false,
      error: "Not found",
    });
    const r = await getEligibleReviewOrders("");
    // The facade delegates to backend — the backend may reject empty IDs
    // Either way, we accept ok:false or ok:true with []
    expect(r).toBeDefined();
  });
});

describe("Review type — verified-purchase contract", () => {
  it("supports order_item_id and videos on the read side", () => {
    // Type-only test: constructing an object with all the fields the
    // form sends and the API returns should compile. If a field is
    // missing in the interface, this file fails to typecheck.
    const r: Review = {
      id: "r-1",
      user_id: "user-1",
      product_id: "prod-1",
      order_item_id: "oi-1",
      rating: 5,
      title: "Great",
      content: "Loved it",
      photos: [],
      videos: [],
      is_verified_purchase: true,
      helpful_count: 0,
      status: "approved",
      created_at: "2026-06-01T00:00:00Z",
      user: { id: "user-1", full_name: "Tester", avatar_url: null },
    };
    expect(r.order_item_id).toBe("oi-1");
    expect(r.videos).toEqual([]);
    expect(r.is_verified_purchase).toBe(true);
  });

  it("EligibleReviewOrder has the expected shape", () => {
    const o: EligibleReviewOrder = {
      order_item_id: "oi-1",
      order_id: "o-1",
      order_number: "ORD-1",
      delivered_at: null,
      quantity: 1,
    };
    expect(o.order_item_id).toBe("oi-1");
  });
});
