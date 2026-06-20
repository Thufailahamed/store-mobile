import { describe, it, expect } from "vitest";
import {
  buildCartLineKey,
  buildCartLineKeyFromItem,
  isStoreScopedCartLineKey,
  mergeCartItemRecords,
  mergeCartItemRecordsFromRemotePull,
  migrateCartItemRecord,
  assertStoreConsistency,
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

  it("remote pull keeps server quantity and local-only lines", () => {
    const key = buildCartLineKey("store-a", "prod-1", "var-1");
    const localOnlyKey = buildCartLineKey("store-b", "prod-2", "var-2");
    const server = { [key]: makeItem({ quantity: 2 }) };
    const local = {
      [key]: makeItem({ quantity: 5 }),
      [localOnlyKey]: makeItem({ productId: "prod-2", storeId: "store-b", variantId: "var-2", quantity: 1 }),
    };
    const merged = mergeCartItemRecordsFromRemotePull(server, local);
    expect(merged[key].quantity).toBe(2);
    expect(merged[localOnlyKey].quantity).toBe(1);
  });
});

describe("assertStoreConsistency", () => {
  it("leaves a matching line untouched", () => {
    const items = {
      [buildCartLineKey("store-a", "prod-1", "var-1")]: makeItem({ storeId: "store-a", quantity: 2 }),
    };
    const products = { "prod-1": { id: "prod-1", store_id: "store-a" } };
    const result = assertStoreConsistency(items, products);
    expect(result.rekeyed).toEqual([]);
    expect(result.dropped).toEqual([]);
    expect(result.recapped).toEqual([]);
    expect(result.next[buildCartLineKey("store-a", "prod-1", "var-1")].storeId).toBe("store-a");
  });

  it("re-keys a transferred line and reports it", () => {
    const items = {
      [buildCartLineKey("store-a", "prod-1", "var-1")]: makeItem({ storeId: "store-a", quantity: 3 }),
    };
    const products = { "prod-1": { id: "prod-1", store_id: "store-b" } };
    const result = assertStoreConsistency(items, products);
    expect(result.dropped).toEqual([]);
    expect(result.rekeyed).toHaveLength(1);
    expect(result.rekeyed[0].storeId).toBe("store-b");
    // New key now points at the fresh store, not the stale one.
    expect(result.next["store-b:prod-1:var-1"]).toBeDefined();
    expect(result.next["store-a:prod-1:var-1"]).toBeUndefined();
  });

  it("drops a line whose product is gone from the catalogue", () => {
    const items = {
      [buildCartLineKey("store-a", "prod-1", "var-1")]: makeItem(),
      [buildCartLineKey("store-a", "prod-gone", "var-1")]: makeItem({ productId: "prod-gone" }),
    };
    const products = { "prod-1": { id: "prod-1", store_id: "store-a" } };
    const result = assertStoreConsistency(items, products);
    expect(result.dropped.map((i) => i.productId)).toEqual(["prod-gone"]);
    expect(Object.keys(result.next)).toEqual(["store-a:prod-1:var-1"]);
  });

  it("caps quantity to fresh variant stock and reports the recapping", () => {
    const items = {
      [buildCartLineKey("store-a", "prod-1", "var-1")]: makeItem({ quantity: 10, stock: 10 }),
    };
    const products = {
      "prod-1": { id: "prod-1", store_id: "store-a", variants: [{ id: "var-1", stock: 3 }] },
    };
    const result = assertStoreConsistency(items, products);
    expect(result.recapped).toEqual([
      { key: "store-a:prod-1:var-1", from: 10, to: 3 },
    ]);
    expect(result.next["store-a:prod-1:var-1"].quantity).toBe(3);
  });
});
