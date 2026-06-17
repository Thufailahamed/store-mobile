import { describe, it, expect } from "vitest";
import { buildCartReconciliation } from "@/lib/cart-validation";
import type { CartItem } from "@/lib/stores/cart-store";
import type { Product } from "@/lib/types";

const visibleStores = new Set(["store-1"]);

function makeItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    productId: "prod-1",
    variantId: "var-1",
    storeId: "store-1",
    name: "Classic Tee",
    variantLabel: "Black M",
    price: 2500,
    quantity: 2,
    stock: 10,
    ...overrides,
  };
}

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "prod-1",
    store_id: "store-1",
    name: "Classic Tee",
    slug: "classic-tee",
    product_type: "variable",
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
        id: "var-1",
        product_id: "prod-1",
        size: "M",
        color: "Black",
        price: 2500,
        position: 0,
        is_active: true,
        stock: 10,
      },
    ],
    store: {
      id: "store-1",
      owner_id: "owner-1",
      name: "Acme",
      slug: "acme",
      status: "approved",
      rating: 0,
      total_reviews: 0,
      total_followers: 0,
      total_products: 1,
      total_sales: 0,
    },
    ...overrides,
  };
}

describe("cart-validation", () => {
  it("removes deleted products from the bag", () => {
    const items = { "prod-1-var-1": makeItem() };
    const reconciliation = buildCartReconciliation(items, {}, visibleStores);

    expect(reconciliation.remove).toHaveLength(1);
    expect(reconciliation.remove[0].reason).toBe("product_removed");
  });

  it("removes inactive or delisted products", () => {
    const items = { "prod-1-var-1": makeItem() };
    const reconciliation = buildCartReconciliation(
      items,
      { "prod-1": makeProduct({ status: "archived", is_active: false }) },
      visibleStores,
    );

    expect(reconciliation.remove).toHaveLength(1);
    expect(reconciliation.remove[0].reason).toBe("product_unavailable");
  });

  it("removes missing or inactive variants", () => {
    const items = { "prod-1-var-1": makeItem() };
    const reconciliation = buildCartReconciliation(
      items,
      {
        "prod-1": makeProduct({
          variants: [
            {
              id: "var-1",
              product_id: "prod-1",
              position: 0,
              is_active: false,
              stock: 5,
            },
          ],
        }),
      },
      visibleStores,
    );

    expect(reconciliation.remove[0].reason).toBe("variant_unavailable");
  });

  it("clamps quantity and updates price when listing changed", () => {
    const items = { "prod-1-var-1": makeItem({ price: 2000, quantity: 5, stock: 10 }) };
    const reconciliation = buildCartReconciliation(
      items,
      {
        "prod-1": makeProduct({
          variants: [
            {
              id: "var-1",
              product_id: "prod-1",
              size: "M",
              color: "Black",
              price: 2600,
              position: 0,
              is_active: true,
              stock: 3,
            },
          ],
        }),
      },
      visibleStores,
    );

    expect(reconciliation.remove).toHaveLength(0);
    expect(reconciliation.update).toHaveLength(1);
    expect(reconciliation.update[0]).toMatchObject({
      price: 2600,
      stock: 3,
      quantity: 3,
    });
  });

  it("removes out-of-stock items", () => {
    const items = { "prod-1-var-1": makeItem() };
    const reconciliation = buildCartReconciliation(
      items,
      {
        "prod-1": makeProduct({
          variants: [
            {
              id: "var-1",
              product_id: "prod-1",
              position: 0,
              is_active: true,
              stock: 0,
            },
          ],
        }),
      },
      visibleStores,
    );

    expect(reconciliation.remove[0].reason).toBe("out_of_stock");
  });

  it("treats fully reserved inventory as out of stock", () => {
    const items = { "prod-1-var-1": makeItem({ stock: 5, quantity: 1 }) };
    const reconciliation = buildCartReconciliation(
      items,
      {
        "prod-1": makeProduct({
          variants: [
            {
              id: "var-1",
              product_id: "prod-1",
              size: "M",
              color: "Black",
              price: 2500,
              position: 0,
              is_active: true,
              stock: 5,
              inventory: [{ quantity: 5, reserved: 5 }],
            } as Product["variants"][number],
          ],
        }),
      },
      visibleStores,
    );

    expect(reconciliation.remove).toHaveLength(1);
    expect(reconciliation.remove[0].reason).toBe("out_of_stock");
  });
});
