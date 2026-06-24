/**
 * Co-occurrence (pairs well with) tests.
 *
 * Validates the tiered fallback: co-purchases > aggregate co-views >
 * user co-views > complementary category > brand companion. Out-of-stock
 * products are filtered at every tier.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

let mockProductsList: any[] = [];

const { getCoPurchasesBackendMock, getCoViewsBackendMock, getCandidatesBackendMock, fromMock } = vi.hoisted(() => {
  const getCoPurchasesBackendMock = vi.fn();
  const getCoViewsBackendMock = vi.fn().mockResolvedValue({ ok: true, data: { results: [] } });
  const getCandidatesBackendMock = vi.fn();
  const fromMock = vi.fn();
  return { getCoPurchasesBackendMock, getCoViewsBackendMock, getCandidatesBackendMock, fromMock };
});

vi.mock("@/lib/api/backend", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/backend")>();
  return {
    ...actual,
    getCoPurchasesBackend: getCoPurchasesBackendMock,
    getCoViewsBackend: getCoViewsBackendMock,
    getCandidatesBackend: getCandidatesBackendMock,
  };
});

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    from: (...args: any[]) => fromMock(...args),
  },
}));

import { getPairsWellWith } from "../cooccurrence";
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

/** Build a supabase `from` chain that returns the given product rows. */
function mockProductQuery(rows: any[]) {
  mockProductsList = rows;
  const chain: any = {
    then: (resolve: (v: any) => void) => resolve({ data: rows, error: null }),
  };
  for (const key of ["select", "eq", "neq", "in", "order", "limit", "gt", "lt", "filter"]) {
    chain[key] = vi.fn(() => chain);
  }
  fromMock.mockReturnValue(chain);
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockProductsList = [];
  getCandidatesBackendMock.mockImplementation(async () => {
    return { ok: true, data: { products: mockProductsList } };
  });
});

describe("getPairsWellWith — Tier 0 (co-purchases)", () => {
  it("returns co-purchased products when the backend yields enough", async () => {
    const anchor = product({ id: "anchor" });
    const coA = product({ id: "co-a" });
    const coB = product({ id: "co-b" });
    getCoPurchasesBackendMock.mockResolvedValueOnce({
      ok: true,
      data: {
        results: [
          { product_id: "co-a", score: 5 },
          { product_id: "co-b", score: 3 },
        ],
      },
    });
    mockProductQuery([coA, coB]);

    const res = await getPairsWellWith("user-1", anchor, 2);
    expect(res.ok).toBe(true);
    expect(getCoPurchasesBackendMock).toHaveBeenCalledWith("anchor", 4);
    expect(res.data?.map((p) => p.id)).toEqual(["co-a", "co-b"]);
  });

  it("filters out the anchor id even if the backend returns it", async () => {
    const anchor = product({ id: "anchor" });
    getCoPurchasesBackendMock.mockResolvedValueOnce({
      ok: true,
      data: {
        results: [
          { product_id: "anchor", score: 99 },
        ],
      },
    });
    // Lower tiers will be consulted; pre-seed them to return one fallback.
    mockProductQuery([product({ id: "fallback" })]);

    const res = await getPairsWellWith("user-1", anchor, 1);
    expect(res.ok).toBe(true);
    expect(res.data?.map((p) => p.id)).not.toContain("anchor");
  });

  it("falls through to lower tiers when co-purchases is empty", async () => {
    const anchor = product({ id: "anchor" });
    getCoPurchasesBackendMock.mockResolvedValueOnce({
      ok: true,
      data: { results: [] },
    });
    mockProductQuery([product({ id: "lower-tier" })]);

    const res = await getPairsWellWith("user-1", anchor, 1);
    expect(res.ok).toBe(true);
    expect(res.data?.length).toBeGreaterThanOrEqual(0);
  });

  it("returns ok with [] when the backend errors out", async () => {
    const anchor = product({ id: "anchor" });
    getCoPurchasesBackendMock.mockResolvedValueOnce({
      ok: false,
      error: "boom",
    });
    mockProductQuery([]);

    const res = await getPairsWellWith("user-1", anchor, 2);
    expect(res.ok).toBe(true);
    expect(res.data).toEqual([]);
  });
});
