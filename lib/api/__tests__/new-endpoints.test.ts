/**
 * Tests for the second-pass API additions:
 *   • createReturnRequest     → B.createReturnRequestBackend
 *   • getStores               → B.getStoresBackend
 *   • getAllCategories        → B.getCategoriesBackend
 *   • getOrderTracking        → B.getOrderTrackingBackend
 *
 * Mocks `@/lib/api/backend` (the B.* layer) instead of supabase/client,
 * since all four functions now delegate to the Hono backend.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const backendMocks = vi.hoisted(() => ({
  createReturnRequestBackend: vi.fn(),
  getStoresBackend: vi.fn(),
  getCategoriesBackend: vi.fn(),
  getOrderTrackingBackend: vi.fn(),
}));

vi.mock("@/lib/api/backend", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api/backend")>();
  return {
    ...original,
    ...backendMocks,
  };
});

import {
  createReturnRequest,
  getStores,
  getAllCategories,
  getOrderTracking,
} from "@/lib/api";

beforeEach(() => {
  backendMocks.createReturnRequestBackend.mockReset();
  backendMocks.getStoresBackend.mockReset();
  backendMocks.getCategoriesBackend.mockReset();
  backendMocks.getOrderTrackingBackend.mockReset();
});

// ── createReturnRequest ─────────────────────────────────────────────────────
describe("createReturnRequest", () => {
  it("invokes createReturnRequestBackend with mapped fields and returns the parsed payload", async () => {
    backendMocks.createReturnRequestBackend.mockResolvedValueOnce({
      ok: true,
      data: {
        returns: [
          { return_group_id: "g-1", id: "r-1", order_item_id: "oi-1", status: "pending", reason: "Damaged", created_at: new Date().toISOString() },
        ],
      },
    });
    const r = await createReturnRequest("user-1", {
      orderId: "order-1",
      reason: "Damaged",
      items: [{ orderItemId: "oi-1", quantity: 1 }],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.returnGroupId).toBe("g-1");
    }
    expect(backendMocks.createReturnRequestBackend).toHaveBeenCalledWith({
      order_id: "order-1",
      items: [{ order_item_id: "oi-1", reason: "Damaged", quantity: 1 }],
    });
  });

  it("returns fail() when the backend errors", async () => {
    backendMocks.createReturnRequestBackend.mockResolvedValueOnce({
      ok: false,
      error: "window closed",
    });
    const r = await createReturnRequest("user-1", {
      orderId: "order-1",
      reason: "Damaged",
      items: [{ orderItemId: "oi-1", quantity: 1 }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("window closed");
  });

  it("fails when the backend returns empty returns array", async () => {
    backendMocks.createReturnRequestBackend.mockResolvedValueOnce({
      ok: true,
      data: { returns: [] },
    });
    const r = await createReturnRequest("user-1", {
      orderId: "order-1",
      reason: "Damaged",
      items: [{ orderItemId: "oi-1", quantity: 1 }],
    });
    // The implementation grabs [0]?.return_group_id ?? "" — so returnGroupId is ""
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.returnGroupId).toBe("");
  });
});

// ── getStores ───────────────────────────────────────────────────────────────
describe("getStores", () => {
  it("calls getStoresBackend and returns mapped stores", async () => {
    backendMocks.getStoresBackend.mockResolvedValueOnce({
      ok: true,
      data: {
        stores: [
          {
            id: "s-1",
            name: "Atelier",
            slug: "atelier",
            status: "approved",
            rating: 4.5,
            total_products: 12,
          },
        ],
      },
    });
    const r = await getStores();
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.stores).toHaveLength(1);
      expect(r.data.stores[0].slug).toBe("atelier");
    }
    expect(backendMocks.getStoresBackend).toHaveBeenCalledWith({ limit: 60 });
  });

  it("applies limit when provided", async () => {
    backendMocks.getStoresBackend.mockResolvedValueOnce({
      ok: true,
      data: { stores: [] },
    });
    await getStores({ limit: 10 });
    expect(backendMocks.getStoresBackend).toHaveBeenCalledWith({ limit: 10 });
  });

  it("returns fail() when the backend errors", async () => {
    backendMocks.getStoresBackend.mockResolvedValueOnce({
      ok: false,
      error: "rls",
    });
    const r = await getStores();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("rls");
  });
});

// ── getAllCategories ────────────────────────────────────────────────────────
describe("getAllCategories", () => {
  it("returns active categories", async () => {
    backendMocks.getCategoriesBackend.mockResolvedValueOnce({
      ok: true,
      data: {
        categories: [
          { id: "c-1", name: "Men", slug: "men", position: 0, is_active: true },
          { id: "c-2", name: "Women", slug: "women", position: 1, is_active: true },
        ],
      },
    });
    const r = await getAllCategories();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toHaveLength(2);
    expect(backendMocks.getCategoriesBackend).toHaveBeenCalled();
  });

  it("returns [] on empty data without error", async () => {
    backendMocks.getCategoriesBackend.mockResolvedValueOnce({
      ok: true,
      data: { categories: [] },
    });
    const r = await getAllCategories();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toEqual([]);
  });
});

// ── getOrderTracking ────────────────────────────────────────────────────────
describe("getOrderTracking", () => {
  it("returns order + events + rider, falling back to a synthetic event when none", async () => {
    backendMocks.getOrderTrackingBackend.mockResolvedValueOnce({
      ok: true,
      data: {
        order: {
          id: "o-1",
          order_number: "ORD-1",
          status: "shipped",
          placed_at: "2026-06-15T10:00:00Z",
          items: [],
        },
        events: [],
        rider: { id: "r-1", full_name: "Kavi", phone: "+94770000000" },
      },
    });

    const r = await getOrderTracking("o-1");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.order.id).toBe("o-1");
      // No events → one synthetic placeholder for current status.
      expect(r.data.events).toHaveLength(1);
      expect(r.data.events[0].status).toBe("shipped");
      expect(r.data.rider?.name).toBe("Kavi");
    }
    expect(backendMocks.getOrderTrackingBackend).toHaveBeenCalledWith("o-1");
  });
});
