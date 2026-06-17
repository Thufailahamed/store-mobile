import { describe, it, expect } from "vitest";
import { buildCartReconciliation } from "@/lib/cart-validation";
import { findLocalSkuDuplicate } from "@/lib/product-sku";
import { coerceSellerProductStatus, resolveProductType } from "@/lib/seller-product-status";
import type { CartItem } from "@/lib/stores/cart-store";
import type { Product } from "@/lib/types";

/**
 * Smoke test for the seller → catalog → cart commerce path (pure logic).
 * Validates the guard chain without hitting Supabase.
 */
describe("product commerce flow (mobile)", () => {
  it("seller submit → pending, admin approve → active, cart accepts live SKU", () => {
    const submitted = coerceSellerProductStatus("active");
    expect(submitted).toBe("pending");

    const approved = coerceSellerProductStatus("active", "active");
    expect(approved).toBe("active");

    const skuDup = findLocalSkuDuplicate("TEE-01", [{ sku: "tee-01" }]);
    expect(skuDup).toBe("TEE-01");

    const product: Product = {
      id: "p1",
      store_id: "store-1",
      name: "Tee",
      slug: "tee",
      sku: "TEE-01",
      product_type: resolveProductType(1),
      mrp: 3000,
      price: 2500,
      currency: "LKR",
      discount_pct: 0,
      tax_rate: 0,
      status: "active",
      is_active: true,
      is_featured: false,
      tags: [],
      rating: 0,
      total_reviews: 0,
      total_sales: 0,
      view_count: 0,
      wishlist_count: 0,
      created_at: "2026-01-01",
      variants: [
        {
          id: "v1",
          product_id: "p1",
          sku: "TEE-01-M",
          size: "M",
          price: 2500,
          position: 0,
          is_active: true,
          stock: 5,
        },
      ],
      store: {
        id: "store-1",
        owner_id: "o1",
        name: "Acme",
        slug: "acme",
        status: "approved",
        rating: 0,
        total_reviews: 0,
        total_followers: 0,
        total_products: 1,
        total_sales: 0,
      },
    };

    const item: CartItem = {
      productId: "p1",
      variantId: "v1",
      storeId: "store-1",
      name: "Tee",
      price: 2500,
      quantity: 1,
      stock: 5,
    };

    const reconciliation = buildCartReconciliation(
      { "p1-v1": item },
      { p1: product },
      new Set(["store-1"]),
    );

    expect(reconciliation.remove).toHaveLength(0);
    expect(reconciliation.update.every((patch) => patch.key === "p1-v1")).toBe(true);
  });

  it("removes delisted products from cart after admin rejects listing", () => {
    const item: CartItem = {
      productId: "p1",
      variantId: "v1",
      storeId: "store-1",
      name: "Tee",
      price: 2500,
      quantity: 1,
      stock: 5,
    };

    const reconciliation = buildCartReconciliation(
      { "p1-v1": item },
      {
        p1: {
          id: "p1",
          store_id: "store-1",
          name: "Tee",
          slug: "tee",
          product_type: "simple",
          mrp: 3000,
          price: 2500,
          currency: "LKR",
          discount_pct: 0,
          tax_rate: 0,
          status: "rejected",
          is_active: false,
          is_featured: false,
          tags: [],
          rating: 0,
          total_reviews: 0,
          total_sales: 0,
          view_count: 0,
          wishlist_count: 0,
          created_at: "2026-01-01",
        },
      },
      new Set(["store-1"]),
    );

    expect(reconciliation.remove[0].reason).toBe("product_unavailable");
  });
});
