/**
 * Verified-purchase enforcement — mobile API parity tests.
 * Verifies:
 *   • getEligibleReviewOrders → rpc('fn_eligible_review_orders', { p_product_id })
 *   • filters rows missing order_item_id
 *   • returns [] when rpc errors or productId is empty
 *   • Review type exposes the fields the form sends / consumes
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const { rpcMock, queryResult, queryQueue } = vi.hoisted(() => {
  const rpcMock = vi.fn();
  const queryResult: { data: any; error: any } = { data: null, error: null };
  const queryQueue: Array<{ data: any; error: any }> = [];
  return { rpcMock, queryResult, queryQueue };
});

vi.mock("@/lib/supabase/client", () => {
  function makeBuilder(stagedResult: { data: any; error: any }) {
    const settled = Promise.resolve(stagedResult);
    const b: any = {
      select: vi.fn(() => b),
      eq: vi.fn(() => b),
      order: vi.fn(() => b),
      limit: vi.fn(() => b),
      maybeSingle: vi.fn(() => settled),
      single: vi.fn(() => settled),
      then: (onF: any, onR: any) => settled.then(onF, onR),
    };
    return b;
  }
  return {
    supabase: {
      from: () => makeBuilder(queryResult),
      rpc: (...args: any[]) => rpcMock(...args),
    },
  };
});

import { getEligibleReviewOrders } from "@/lib/api";
import type { Review, EligibleReviewOrder } from "@/lib/types";

beforeEach(() => {
  rpcMock.mockReset();
  queryResult.data = null;
  queryResult.error = null;
  queryQueue.length = 0;
});

describe("getEligibleReviewOrders (mobile)", () => {
  it("calls rpc('fn_eligible_review_orders', { p_product_id })", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [
        {
          order_item_id: "oi-1",
          order_id: "o-1",
          order_number: "ORD-001",
          delivered_at: "2026-05-01T00:00:00Z",
          quantity: 2,
        },
      ],
      error: null,
    });
    const r = await getEligibleReviewOrders("prod-1");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data).toHaveLength(1);
      expect(r.data[0].order_item_id).toBe("oi-1");
      expect(r.data[0].order_number).toBe("ORD-001");
    }
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith("fn_eligible_review_orders", {
      p_product_id: "prod-1",
    });
  });

  it("returns [] without calling rpc when productId is empty", async () => {
    const r = await getEligibleReviewOrders("");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toEqual([]);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("filters out rows whose order_item_id is null", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [
        { order_item_id: "oi-1", order_id: "o-1", order_number: "A", delivered_at: null, quantity: 1 },
        { order_item_id: null, order_id: "o-2", order_number: "B", delivered_at: null, quantity: 1 },
      ],
      error: null,
    });
    const r = await getEligibleReviewOrders("prod-1");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.map((x) => x.order_item_id)).toEqual(["oi-1"]);
  });

  it("returns fail when rpc errors", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: "rpc failed" } });
    const r = await getEligibleReviewOrders("prod-1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/rpc failed/);
  });

  it("returns [] when rpc resolves to null data", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: null });
    const r = await getEligibleReviewOrders("prod-1");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toEqual([]);
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
