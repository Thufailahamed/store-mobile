import { describe, it, expect } from "vitest";
import {
  buildCartLineKey,
  buildCartLineKeyFromItem,
  isStoreScopedCartLineKey,
  mergeCartItemRecords,
  migrateCartItemRecord,
} from "@/lib/cart-line-key";
import type { CartItem } from "@/lib/stores/cart-store";

function makeItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    productId: "prod-1",
    variantId: "var-1",
    storeId: "store-a",
    name: "Tee",
    price: 1000,
    quantity: 1,
    stock: 5,
    ...overrides,
  };
}

describe("cart-line-key", () => {
  it("scopes keys by store, product, and variant", () => {
    expect(buildCartLineKey("store-a", "prod-1", "var-1")).toBe("store-a:prod-1:var-1");
    expect(buildCartLineKey("store-b", "prod-1", "var-1")).toBe("store-b:prod-1:var-1");
    expect(buildCartLineKeyFromItem(makeItem({ variantId: null }))).toBe("store-a:prod-1:default");
  });

  it("detects legacy keys", () => {
    expect(isStoreScopedCartLineKey("prod-1-var-1")).toBe(false);
    expect(isStoreScopedCartLineKey("store-a:prod-1:var-1")).toBe(true);
  });

  it("migrates legacy keys without collapsing different stores", () => {
    const legacyA = makeItem({ storeId: "store-a", quantity: 2 });
    const legacyB = makeItem({ storeId: "store-b", quantity: 3 });
    const migrated = migrateCartItemRecord({
      "prod-1-var-1": legacyA,
      "prod-1-var-1-duplicate-should-not-happen": legacyB,
    });

    expect(Object.keys(migrated)).toEqual([
      "store-a:prod-1:var-1",
      "store-b:prod-1:var-1",
    ]);
    expect(migrated["store-a:prod-1:var-1"].quantity).toBe(2);
    expect(migrated["store-b:prod-1:var-1"].quantity).toBe(3);
  });

  it("merges shared keys using the higher quantity capped by stock", () => {
    const server = {
      [buildCartLineKey("store-a", "prod-1", "var-1")]: makeItem({ quantity: 2, stock: 5 }),
    };
    const local = {
      [buildCartLineKey("store-a", "prod-1", "var-1")]: makeItem({ quantity: 4, stock: 5 }),
    };
    const { items, quantityConflicts } = mergeCartItemRecords(server, local);
    expect(quantityConflicts).toBe(1);
    expect(items[buildCartLineKey("store-a", "prod-1", "var-1")].quantity).toBe(4);
  });
});
