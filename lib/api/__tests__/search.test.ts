import { describe, it, expect, vi, beforeEach } from "vitest";

const backendMocks = vi.hoisted(() => ({
  searchProductsBackend: vi.fn(),
  getProductsByIdsBackend: vi.fn(),
  getProductsBackend: vi.fn(),
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

import { searchProducts } from "@/lib/api";

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
