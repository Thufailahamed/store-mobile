import { describe, it, expect, beforeEach, vi } from "vitest";

const { store, supabaseMock } = vi.hoisted(() => {
  const store = new Map<string, string>();
  let mockProducts: any[] = [];
  let mockViews: any[] = [];

  const createQueryMock = (data: any, error: any = null) => {
    const mock: any = {
      select: vi.fn().mockImplementation(() => mock),
      eq: vi.fn().mockImplementation(() => mock),
      neq: vi.fn().mockImplementation(() => mock),
      in: vi.fn().mockImplementation(() => mock),
      order: vi.fn().mockImplementation(() => mock),
      limit: vi.fn().mockImplementation(() => mock),
      then: vi.fn().mockImplementation((resolve) => resolve({ data, error })),
    };
    return mock;
  };

  const supabaseMock = {
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "product_views") {
        return createQueryMock(mockViews);
      }
      return createQueryMock(mockProducts);
    }),
    __setMockProducts: (products: any[]) => {
      mockProducts = products;
    },
    __setMockViews: (views: any[]) => {
      mockViews = views;
    },
  };

  return { store, supabaseMock };
});

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (k: string) => store.get(k) ?? null,
    setItem: async (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: async (k: string) => {
      store.delete(k);
    },
  },
}));

vi.mock("@/lib/supabase/client", () => ({
  supabase: supabaseMock,
}));

vi.mock("@/lib/api/product-mapper", () => ({
  mapProducts: (products: any[]) => products,
}));

const wishlistStoreState = { items: {} as Record<string, boolean> };
vi.mock("@/lib/stores", () => ({
  useWishlist: {
    getState: () => wishlistStoreState,
  },
  useCart: {
    getState: () => ({ items: {} }),
  },
}));

import {
  getForYouRail,
  getSimilarProducts,
  getYouMayAlsoLike,
  getPairsWellWithRail,
  getRecentlyViewedRail,
  getFromWishlistRail,
  getCurrentWishlistIds,
} from "../engine";
import { appendEvent, snapshotProduct } from "../events";
import { recordRecentlyViewed } from "@/lib/account-local";
import type { Product } from "@/lib/types";

// Helper to construct a basic product shape
function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "p-1",
    store_id: "store-1",
    name: "Sample Product",
    slug: "sample-product",
    product_type: "simple",
    mrp: 100,
    price: 100,
    currency: "LKR",
    discount_pct: 0,
    tax_rate: 0,
    status: "active",
    is_featured: false,
    is_active: true,
    rating: 4.5,
    total_reviews: 10,
    total_sales: 50,
    view_count: 100,
    wishlist_count: 5,
    created_at: new Date().toISOString(),
    variants: [
      {
        id: "v-1",
        product_id: "p-1",
        size: "M",
        color: "Black",
        position: 1,
        is_active: true,
        stock: 10,
      },
    ],
    ...overrides,
  } as Product;
}

const CATALOG = [
  makeProduct({
    id: "nike-shoes-1",
    name: "Nike Pegasus Running Shoes",
    category_id: "shoes",
    brand_id: "nike",
    material: "mesh",
    price: 120,
    mrp: 120,
    tags: ["running", "shoes", "nike"],
  }),
  makeProduct({
    id: "nike-shirt-1",
    name: "Nike Dry-Fit Tee",
    category_id: "shirts",
    brand_id: "nike",
    material: "polyester",
    price: 35,
    mrp: 35,
    tags: ["activewear", "shirt", "nike"],
  }),
  makeProduct({
    id: "nike-jacket-1",
    name: "Nike Windrunner Jacket",
    category_id: "jackets",
    brand_id: "nike",
    material: "nylon",
    price: 85,
    mrp: 85,
    tags: ["outerwear", "jacket", "nike"],
  }),
  makeProduct({
    id: "nike-shoes-2",
    name: "Nike Air Max",
    category_id: "shoes",
    brand_id: "nike",
    material: "leather",
    price: 80,
    mrp: 80,
    tags: ["sneakers", "shoes", "nike"],
  }),
  makeProduct({
    id: "adidas-shirt-1",
    name: "Adidas Cotton Polo",
    category_id: "shirts",
    brand_id: "adidas",
    material: "cotton",
    price: 45,
    mrp: 45,
    tags: ["casual", "shirt", "adidas"],
  }),
  makeProduct({
    id: "linen-pants-1",
    name: "Linen Drawstring Trousers",
    category_id: "pants",
    brand_id: "unbranded",
    material: "linen",
    price: 75,
    mrp: 75,
    tags: ["casual", "pants", "summer"],
  }),
  makeProduct({
    id: "cotton-pants-1",
    name: "Slim Fit Cotton Chinos",
    category_id: "pants",
    brand_id: "unbranded",
    material: "cotton",
    price: 65,
    mrp: 65,
    tags: ["casual", "pants"],
  }),
  makeProduct({
    id: "wool-pants-1",
    name: "Tailored Wool Dress Pants",
    category_id: "pants",
    brand_id: "unbranded",
    material: "wool",
    price: 110,
    mrp: 110,
    tags: ["formal", "pants"],
  }),
  makeProduct({
    id: "cargo-pants-1",
    name: "Casual Cargo Pants",
    category_id: "pants",
    brand_id: "unbranded",
    material: "cotton",
    price: 70,
    mrp: 70,
    tags: ["casual", "pants"],
  }),
];

describe("recommender engine", () => {
  const USER_ID = "test-user-123";

  beforeEach(() => {
    store.clear();
    wishlistStoreState.items = {};
    vi.clearAllMocks();
    supabaseMock.__setMockProducts(CATALOG);
    supabaseMock.__setMockViews([]);
  });

  describe("getForYouRail", () => {
    it("returns cold-start fallback when there is no user signal", async () => {
      // 0 events tracked
      const res = await getForYouRail(USER_ID, 2);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data.hasSignal).toBe(false);
        expect(res.data.products.length).toBeLessThanOrEqual(2);
      }
    });

    it("returns personalized results when user has enough signal (3+ events)", async () => {
      // Track views on 3 distinct Nike products (CATALOG[0], CATALOG[1], CATALOG[2])
      await appendEvent(USER_ID, {
        type: "view",
        t: Date.now(),
        product: snapshotProduct(CATALOG[0]),
        dwellMs: 10000,
      });
      await appendEvent(USER_ID, {
        type: "view",
        t: Date.now(),
        product: snapshotProduct(CATALOG[1]),
        dwellMs: 10000,
      });
      await appendEvent(USER_ID, {
        type: "view",
        t: Date.now(),
        product: snapshotProduct(CATALOG[2]),
        dwellMs: 10000,
      });

      const res = await getForYouRail(USER_ID, 4);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data.hasSignal).toBe(true);
        // nike-shoes-2 is the unviewed Nike product in the pool and should be recommended
        expect(res.data.products[0].brand_id).toBe("nike");
        expect(res.data.products[0].id).toBe("nike-shoes-2");
      }
    });

    it("uses caching for repeat requests unless bypassed", async () => {
      const res1 = await getForYouRail(USER_ID, 4);
      const res2 = await getForYouRail(USER_ID, 4);

      // Verify they return the same object from cache
      expect(res1).toBe(res2);
    });
  });

  describe("getSimilarProducts", () => {
    it("returns products ordered by overlap score", async () => {
      const anchor = CATALOG[1]; // Nike Dry-Fit Tee (shirts, nike, polyester)
      const res = await getSimilarProducts(anchor, 3);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data.length).toBeGreaterThan(0);
        // Adidas Cotton Polo shares category (shirts)
        // Nike Pegasus Running Shoes shares brand (nike)
        const ids = res.data.map((p) => p.id);
        expect(ids).toContain("adidas-shirt-1");
        expect(ids).toContain("nike-shoes-1");
        expect(ids).not.toContain(anchor.id); // Should exclude anchor product itself
      }
    });
  });

  describe("getYouMayAlsoLike", () => {
    it("provides personalized recommendations that exclude the anchor", async () => {
      // Track views on 3 distinct pants products (CATALOG[5], CATALOG[6], CATALOG[7]) to build pants affinity
      await appendEvent(USER_ID, {
        type: "view",
        t: Date.now(),
        product: snapshotProduct(CATALOG[5]),
        dwellMs: 5000,
      });
      await appendEvent(USER_ID, {
        type: "view",
        t: Date.now(),
        product: snapshotProduct(CATALOG[6]),
        dwellMs: 5000,
      });
      await appendEvent(USER_ID, {
        type: "view",
        t: Date.now(),
        product: snapshotProduct(CATALOG[7]),
        dwellMs: 5000,
      });

      const anchor = CATALOG[5]; // Linen Drawstring Trousers (pants)
      const res = await getYouMayAlsoLike(USER_ID, anchor, 2);
      expect(res.ok).toBe(true);
      if (res.ok) {
        const ids = res.data.map((p) => p.id);
        expect(ids).not.toContain(anchor.id);
        // Should recommend cargo-pants-1 (which is unviewed)
        expect(ids).toContain("cargo-pants-1");
      }
    });
  });

  describe("getPairsWellWithRail", () => {
    it("falls back to category/brand affinity when no co-view statistics exist", async () => {
      const anchor = CATALOG[1]; // Nike Dry-Fit Tee (shirts)
      const res = await getPairsWellWithRail(USER_ID, anchor, 2);
      expect(res.ok).toBe(true);
      if (res.ok) {
        // Without co-views, fallback kicks in.
        // Complementary logic for tops (shirts) suggests bottoms (pants), accessories, shoes.
        // So linen-pants-1 or nike-shoes-1 should be returned.
        const categories = res.data.map((p) => p.category_id);
        expect(categories.some((c) => ["pants", "shoes"].includes(c ?? ""))).toBe(true);
      }
    });
  });

  describe("getRecentlyViewedRail", () => {
    it("correctly fetches recently viewed products in order", async () => {
      const pNike = CATALOG[0];
      const pAdidas = CATALOG[4];

      // Record recently viewed products
      await recordRecentlyViewed(USER_ID, pNike.id);
      await recordRecentlyViewed(USER_ID, pAdidas.id);

      const res = await getRecentlyViewedRail(USER_ID, 2);
      expect(res.ok).toBe(true);
      if (res.ok) {
        // Most recent first
        expect(res.data[0].id).toBe("adidas-shirt-1");
        expect(res.data[1].id).toBe("nike-shoes-1");
      }
    });
  });

  describe("getFromWishlistRail", () => {
    it("returns wishlist items and companion recommendations", async () => {
      wishlistStoreState.items = { "nike-shoes-1": true };
      const res = await getFromWishlistRail(USER_ID, ["nike-shoes-1"], 2);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data.wishlist.length).toBe(1);
        expect(res.data.wishlist[0].id).toBe("nike-shoes-1");
        // Companions should exclude wishlist items
        const companionIds = res.data.companions.map((c) => c.id);
        expect(companionIds).not.toContain("nike-shoes-1");
      }
    });
  });

  describe("getCurrentWishlistIds", () => {
    it("retrieves the active wishlist product ids", () => {
      wishlistStoreState.items = { "nike-shirt-1": true, "linen-pants-1": true };
      const ids = getCurrentWishlistIds();
      expect(ids).toContain("nike-shirt-1");
      expect(ids).toContain("linen-pants-1");
      expect(ids.length).toBe(2);
    });
  });
});
