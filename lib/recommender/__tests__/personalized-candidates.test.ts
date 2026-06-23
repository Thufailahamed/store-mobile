/**
 * Personalized candidate puller tests.
 *
 * Validates the 50/50 split between affinity categories (from
 * getUserTopCategoriesBackend) and the general top-sellers pool, and
 * the fall-back paths.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const { getUserTopCategoriesBackendMock, fromMock } = vi.hoisted(() => {
  const getUserTopCategoriesBackendMock = vi.fn();
  const fromMock = vi.fn();
  return { getUserTopCategoriesBackendMock, fromMock };
});

vi.mock("@/lib/api/backend", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/backend")>();
  return {
    ...actual,
    getUserTopCategoriesBackend: getUserTopCategoriesBackendMock,
  };
});

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    from: (...args: any[]) => fromMock(...args),
  },
}));

import { pullPersonalizedCandidates } from "../personalized-candidates";
import type { Product, ProductVariant } from "@/lib/types";

function variant(over: Partial<ProductVariant> = {}): ProductVariant {
  return {
    id: "v",
    product_id: "p",
    size: "M",
    color: "Black",
    position: 0,
    is_active: true,
    stock: 5,
    ...over,
  };
}

function product(over: Partial<Product> = {}): Product {
  return {
    id: "p1",
    store_id: "s1",
    name: "P",
    slug: "p",
    product_type: "simple",
    mrp: 100,
    price: 100,
    currency: "LKR",
    discount_pct: 0,
    tax_rate: 0,
    status: "active",
    tags: [],
    is_featured: false,
    is_active: true,
    rating: 0,
    total_reviews: 0,
    total_sales: 0,
    view_count: 0,
    wishlist_count: 0,
    created_at: new Date().toISOString(),
    variants: [variant()],
    ...over,
  };
}

/** Mock the products table chain. Each `from()` call returns this chain. */
function mockProductQuery(rows: any[]) {
  const chain: any = {
    then: (resolve: (v: any) => void) => resolve({ data: rows, error: null }),
  };
  for (const key of ["select", "eq", "neq", "in", "order", "limit"]) {
    chain[key] = vi.fn(() => chain);
  }
  fromMock.mockReturnValue(chain);
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("pullPersonalizedCandidates", () => {
  it("uses the general pool when userId is null", async () => {
    const p1 = product({ id: "g1" });
    mockProductQuery([p1]);
    const out = await pullPersonalizedCandidates(null, 10);
    expect(out.map((p) => p.id)).toEqual(["g1"]);
  });

  it("uses the general pool when the top-categories backend returns no rows", async () => {
    getUserTopCategoriesBackendMock.mockResolvedValueOnce({
      ok: true,
      data: { categories: [] },
    });
    mockProductQuery([product({ id: "g1" })]);
    const out = await pullPersonalizedCandidates("user-1", 10);
    expect(out.map((p) => p.id)).toEqual(["g1"]);
  });

  it("uses the general pool when the top-categories backend errors", async () => {
    getUserTopCategoriesBackendMock.mockResolvedValueOnce({
      ok: false,
      error: "boom",
    });
    mockProductQuery([product({ id: "g1" })]);
    const out = await pullPersonalizedCandidates("user-1", 10);
    expect(out.map((p) => p.id)).toEqual(["g1"]);
  });

  it("queries top categories + product pools when signal exists", async () => {
    getUserTopCategoriesBackendMock.mockResolvedValueOnce({
      ok: true,
      data: {
        categories: [
          { category_id: "shirts", score: 12 },
          { category_id: "jeans", score: 8 },
        ],
      },
    });
    const aff = product({ id: "shirt-1", category_id: "shirts" });
    const gen = product({ id: "general-1" });
    // Each `from()` call returns a fresh chain; the first resolves to the
    // affinity pool, the second to the general pool.
    const calls: any[][] = [];
    fromMock.mockImplementation(() => {
      const rows = calls.length === 0 ? [aff] : [gen];
      calls.push(rows);
      const chain: any = {
        then: (resolve: (v: any) => void) => resolve({ data: rows, error: null }),
      };
      for (const key of ["select", "eq", "neq", "in", "order", "limit"]) {
        chain[key] = vi.fn(() => chain);
      }
      return chain;
    });

    const out = await pullPersonalizedCandidates("user-1", 10);
    expect(getUserTopCategoriesBackendMock).toHaveBeenCalledWith(2);
    expect(out.find((p) => p.id === "shirt-1")).toBeTruthy();
    expect(out.find((p) => p.id === "general-1")).toBeTruthy();
  });

  it("dedupes products that appear in both affinity and general pools", async () => {
    getUserTopCategoriesBackendMock.mockResolvedValueOnce({
      ok: true,
      data: { categories: [{ category_id: "shirts", score: 5 }] },
    });
    const shared = product({ id: "shared", category_id: "shirts" });
    // Both .from() calls return [shared]. After merge, list should have
    // exactly one entry.
    fromMock.mockImplementation(() => {
      const chain: any = {
        then: (resolve: (v: any) => void) => resolve({ data: [shared], error: null }),
      };
      for (const key of ["select", "eq", "neq", "in", "order", "limit"]) {
        chain[key] = vi.fn(() => chain);
      }
      return chain;
    });
    const out = await pullPersonalizedCandidates("user-1", 10);
    expect(out.filter((p) => p.id === "shared")).toHaveLength(1);
  });

  it("falls back to general pool when affinity branch returns nothing", async () => {
    getUserTopCategoriesBackendMock.mockResolvedValueOnce({
      ok: true,
      data: { categories: [{ category_id: "shirts", score: 5 }] },
    });
    const gen = product({ id: "general-1" });
    // To force affinity branch to return empty, override: first from() = []
    // second from() = [gen].
    let callIndex = 0;
    fromMock.mockImplementation(() => {
      const rows = callIndex++ === 0 ? [] : [gen];
      const chain: any = {
        then: (resolve: (v: any) => void) => resolve({ data: rows, error: null }),
      };
      for (const key of ["select", "eq", "neq", "in", "order", "limit"]) {
        chain[key] = vi.fn(() => chain);
      }
      return chain;
    });
    const out = await pullPersonalizedCandidates("user-1", 10);
    expect(out.map((p) => p.id)).toEqual(["general-1"]);
  });
});
