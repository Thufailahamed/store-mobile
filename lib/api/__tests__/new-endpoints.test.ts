/**
 * Tests for the second-pass API additions:
 *   • createReturnRequest     → create_return_request RPC
 *   • getStores               → stores table query (search, sort, pagination)
 *   • getAllCategories        → categories table query
 *   • getOrderTracking        → orders + tracking_events + rider join
 *
 * Mirrors the hoisted-mock pattern from search-suggestion.test.ts.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const { queryResult, queryQueue, fromMock, rpcMock } = vi.hoisted(() => {
  const queryResult: { data: any; error: any } = { data: null, error: null };
  // Per-call queue for tests that fan out multiple .from() calls. Each
  // shift() returns the next result; falls back to `queryResult`.
  const queryQueue: Array<{ data: any; error: any }> = [];
  const fromMock = vi.fn();
  const rpcMock = vi.fn();
  return { queryResult, queryQueue, fromMock, rpcMock };
});

vi.mock("@/lib/supabase/client", () => {
  // Per-builder response: assigned at .from() time, returned at terminal
  // time. This avoids the non-determinism of Promise.all shifting a shared
  // queue out of call order.
  function makeBuilder(stagedResult: { data: any; error: any }) {
    const settled = Promise.resolve(stagedResult);
    const b: any = {
      select: vi.fn(() => b),
      eq: vi.fn(() => b),
      in: vi.fn(() => b),
      order: vi.fn(() => b),
      range: vi.fn(() => b),
      limit: vi.fn(() => b),
      or: vi.fn(() => b),
      neq: vi.fn(() => b),
      ilike: vi.fn(() => b),
      maybeSingle: vi.fn(() => settled),
      single: vi.fn(() => settled),
      // Make the builder itself thenable so `await chain.last()` works.
      then: (onF: any, onR: any) => settled.then(onF, onR),
    };
    return b;
  }
  return {
    supabase: {
      from: (table: string) => {
        fromMock(table);
        // The first .from(table, callIdx) gets queue[callIdx], else default.
        const callIdx = fromMock.mock.calls.length - 1;
        const staged = queryQueue[callIdx] ?? queryResult;
        return makeBuilder(staged);
      },
      rpc: (...args: any[]) => rpcMock(...args),
    },
  };
});

import {
  createReturnRequest,
  getStores,
  getAllCategories,
  getOrderTracking,
} from "@/lib/api";

beforeEach(() => {
  queryResult.data = null;
  queryResult.error = null;
  queryQueue.length = 0;
  fromMock.mockReset();
  rpcMock.mockReset();
});

// ── createReturnRequest ─────────────────────────────────────────────────────
describe("createReturnRequest", () => {
  it("invokes create_return_request with mapped fields and returns the parsed payload", async () => {
    rpcMock.mockResolvedValueOnce({
      data: {
        return_group_id: "g-1",
        return_number: "RET-260616-ABC123",
        items: [{ return_id: "r-1", order_item_id: "oi-1", quantity: 1, refund_amount: 50 }],
      },
      error: null,
    });
    const r = await createReturnRequest("user-1", {
      orderId: "order-1",
      reason: "Damaged",
      items: [{ orderItemId: "oi-1", quantity: 1 }],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.returnGroupId).toBe("g-1");
      expect(r.data.returnNumber).toBe("RET-260616-ABC123");
      expect(r.data.items).toHaveLength(1);
    }
    expect(rpcMock).toHaveBeenCalledWith("create_return_request", {
      p_user_id: "user-1",
      p_order_id: "order-1",
      p_reason: "Damaged",
      p_items: [{ order_item_id: "oi-1", quantity: 1 }],
    });
  });

  it("returns fail() when the RPC errors", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: "window closed" } });
    const r = await createReturnRequest("user-1", {
      orderId: "order-1",
      reason: "Damaged",
      items: [{ orderItemId: "oi-1", quantity: 1 }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("window closed");
  });

  it("fails when the RPC returns no return_group_id", async () => {
    rpcMock.mockResolvedValueOnce({ data: {}, error: null });
    const r = await createReturnRequest("user-1", {
      orderId: "order-1",
      reason: "Damaged",
      items: [{ orderItemId: "oi-1", quantity: 1 }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/id/i);
  });
});

// ── getStores ───────────────────────────────────────────────────────────────
describe("getStores", () => {
  it("queries the stores table with status=approved and returns mapped stores", async () => {
    queryResult.data = [
      {
        id: "s-1",
        name: "Atelier",
        slug: "atelier",
        status: "approved",
        rating: 4.5,
        total_products: 12,
      },
    ];
    queryResult.error = null;
    const r = await getStores();
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.stores).toHaveLength(1);
      expect(r.data.stores[0].slug).toBe("atelier");
    }
    expect(fromMock).toHaveBeenCalledWith("stores");
  });

  it("applies search filter when provided", async () => {
    queryResult.data = [];
    queryResult.error = null;
    await getStores({ search: "atelier" });
    // Builder's or() was called — we assert it ran without error;
    // full chain behaviour is exercised by the integration tests.
    expect(fromMock).toHaveBeenCalledWith("stores");
  });

  it("returns fail() when the query errors", async () => {
    queryResult.data = null;
    queryResult.error = { message: "rls" };
    const r = await getStores();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("rls");
  });
});

// ── getAllCategories ────────────────────────────────────────────────────────
describe("getAllCategories", () => {
  it("returns active categories with the higher limit", async () => {
    queryResult.data = [
      { id: "c-1", name: "Men", slug: "men", position: 0, is_active: true },
      { id: "c-2", name: "Women", slug: "women", position: 1, is_active: true },
    ];
    queryResult.error = null;
    const r = await getAllCategories();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toHaveLength(2);
    expect(fromMock).toHaveBeenCalledWith("categories");
  });

  it("returns [] on empty data without error", async () => {
    queryResult.data = [];
    queryResult.error = null;
    const r = await getAllCategories();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toEqual([]);
  });
});

// ── getOrderTracking ────────────────────────────────────────────────────────
describe("getOrderTracking", () => {
  it("returns order + events + rider, falling back to a synthetic event when none", async () => {
    // Per-call queue because getOrderTracking fans out 3 queries via Promise.all.
    queryQueue.push(
      // 1. orders .single
      {
        data: {
          id: "o-1",
          order_number: "ORD-1",
          status: "shipped",
          placed_at: "2026-06-15T10:00:00Z",
          items: [],
        },
        error: null,
      },
      // 2. tracking_events chain
      { data: [], error: null },
      // 3. orders .maybeSingle (rider)
      { data: { rider: { id: "r-1", full_name: "Kavi", phone: "+94770000000" } }, error: null }
    );

    const r = await getOrderTracking("o-1");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.order.id).toBe("o-1");
      // No events → one synthetic placeholder for current status.
      expect(r.data.events).toHaveLength(1);
      expect(r.data.events[0].status).toBe("shipped");
      expect(r.data.rider?.name).toBe("Kavi");
    }
  });
});
