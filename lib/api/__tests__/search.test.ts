import { describe, it, expect, vi, beforeEach } from "vitest";

const backendMocks = vi.hoisted(() => ({
  searchProductsBackend: vi.fn(),
  getProductsByIdsBackend: vi.fn(),
  getProductsBackend: vi.fn(),
  imageSearchBackend: vi.fn(),
}));

const catalogVisibilityMocks = vi.hoisted(() => ({
  getBrowsableStoreIds: vi.fn(),
  isPublicCatalogProduct: vi.fn(),
}));

vi.mock("@/lib/api/backend", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api/backend")>();
  return {
    ...original,
    ...backendMocks,
  };
});

vi.mock("@/lib/catalog-visibility", () => catalogVisibilityMocks);

import { searchProducts, reverseImageSearch } from "@/lib/api";

describe("searchProducts", () => {
  beforeEach(() => {
    backendMocks.searchProductsBackend.mockReset();
    backendMocks.getProductsByIdsBackend.mockReset();
    backendMocks.getProductsBackend.mockReset();
    backendMocks.getProductsBackend.mockResolvedValue({ ok: true, data: { count: 0, products: [] } });
    catalogVisibilityMocks.getBrowsableStoreIds.mockReset();
    catalogVisibilityMocks.isPublicCatalogProduct.mockReset();
  });

  it("fetches, detailed matches by id, maps, scores and filters products properly", async () => {
    catalogVisibilityMocks.getBrowsableStoreIds.mockResolvedValue(new Set(["store-1"]));
    catalogVisibilityMocks.isPublicCatalogProduct.mockReturnValue(true);

    backendMocks.searchProductsBackend.mockResolvedValueOnce({
      ok: true,
      data: {
        query: "polo",
        count: 1,
        products: [
          {
            id: "p-1",
            name: "Polo Tee",
            slug: "polo-tee",
            storeId: "store-1",
          },
        ],
      },
    });

    backendMocks.getProductsByIdsBackend.mockResolvedValueOnce({
      ok: true,
      data: {
        products: [
          {
            id: "p-1",
            name: "Polo Tee",
            slug: "polo-tee",
            price: 500,
            mrp: 1000,
            currency: "LKR",
            status: "active",
            is_active: true,
            store: { id: "store-1", name: "Store One", slug: "store-one" },
            variants: [
              { id: "v-1", color: "Blue", size: "M", price: 500, stock: 5 }
            ],
            images: [{ url: "polo.png", is_primary: true }]
          },
        ],
      },
    });

    const res = await searchProducts("polo");
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.length).toBe(1);
      expect(res.data[0].id).toBe("p-1");
      expect(res.data[0].name).toBe("Polo Tee");
    }

    expect(backendMocks.searchProductsBackend).toHaveBeenCalledWith({
      q: "polo",
      sort: "relevance",
      limit: 40,
    });
    expect(backendMocks.getProductsByIdsBackend).toHaveBeenCalledWith(["p-1"]);
  });

  it("returns ok([]) when query search yields no matches", async () => {
    backendMocks.searchProductsBackend.mockResolvedValueOnce({
      ok: true,
      data: {
        query: "non-existent",
        count: 0,
        products: [],
      },
    });

    const res = await searchProducts("non-existent");
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.length).toBe(0);
    }
    expect(backendMocks.getProductsByIdsBackend).not.toHaveBeenCalled();
  });
});

describe("reverseImageSearch", () => {
  beforeEach(() => {
    backendMocks.imageSearchBackend.mockReset();
  });

  it("maps backend image + preserves GLM confidence/brand", async () => {
    backendMocks.imageSearchBackend.mockResolvedValueOnce({
      ok: true,
      data: {
        matches: [
          { id: "p-9", name: "Velvet Gown", slug: "velvet-gown", price: 12000, image: "https://cdn/gown.jpg", brand: "Atelier", confidence: 0.91, matchType: "Color & Texture Match" },
        ],
        fallback: false,
      },
    });
    const res = await reverseImageSearch("https://x.com/q.jpg", 12);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.length).toBe(1);
      expect(res.data[0].images?.[0]?.url).toContain("gown.jpg");
      const visual = (res.data[0] as unknown as { _visual?: { confidence?: number; brand?: string } })._visual;
      expect(visual?.confidence).toBe(0.91);
      expect(visual?.brand).toBe("Atelier");
    }
    expect(backendMocks.imageSearchBackend).toHaveBeenCalledWith("https://x.com/q.jpg", 12);
  });

  it("propagates backend failure", async () => {
    backendMocks.imageSearchBackend.mockResolvedValueOnce({ ok: false, error: "boom" });
    const res = await reverseImageSearch("https://x.com/q.jpg", 12);
    expect(res.ok).toBe(false);
  });
});
