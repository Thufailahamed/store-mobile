import type { CartItem } from "@/lib/stores/cart-store";
import type { Product } from "@/lib/types";

const DEFAULT_VARIANT = "default";

/** Stable cart line identity across multi-store bags. */
export function buildCartLineKey(
  storeId: string,
  productId: string,
  variantId?: string | null,
): string {
  return `${storeId}:${productId}:${variantId ?? DEFAULT_VARIANT}`;
}

export function buildCartLineKeyFromItem(item: Pick<CartItem, "storeId" | "productId" | "variantId">): string {
  return buildCartLineKey(item.storeId, item.productId, item.variantId);
}

export function isStoreScopedCartLineKey(key: string): boolean {
  return key.split(":").length >= 3;
}

/** Re-key persisted/local cart rows that used product+variant only. */
export function migrateCartItemRecord(items: Record<string, CartItem>): Record<string, CartItem> {
  const migrated: Record<string, CartItem> = {};

  for (const [key, item] of Object.entries(items)) {
    const nextKey = isStoreScopedCartLineKey(key)
      ? key
      : buildCartLineKeyFromItem(item);
    const existing = migrated[nextKey];

    if (existing) {
      migrated[nextKey] = {
        ...existing,
        quantity: Math.min(existing.quantity + item.quantity, existing.stock),
      };
      continue;
    }

    migrated[nextKey] = item;
  }

  return migrated;
}

/**
 * Merge server cart with local lines after login.
 * Shared keys use the higher quantity (capped by stock); server metadata wins.
 */
export function mergeCartItemRecords(
  server: Record<string, CartItem>,
  local: Record<string, CartItem>,
): { items: Record<string, CartItem>; quantityConflicts: number } {
  const merged: Record<string, CartItem> = { ...server };
  let quantityConflicts = 0;

  for (const [key, localItem] of Object.entries(local)) {
    if (!merged[key]) {
      merged[key] = localItem;
      continue;
    }

    const serverItem = merged[key];
    const stockCap = serverItem.stock ?? localItem.stock ?? 99;
    if (localItem.quantity !== serverItem.quantity) {
      quantityConflicts += 1;
    }

    merged[key] = {
      ...serverItem,
      quantity: Math.min(Math.max(serverItem.quantity, localItem.quantity), stockCap),
    };
  }

  return { items: merged, quantityConflicts };
}

export interface StoreConsistencyResult {
  /** Items that were re-keyed because the product moved to a different store. */
  rekeyed: CartItem[];
  /** Items that were dropped because the product is no longer in the catalogue. */
  dropped: CartItem[];
  /** Items whose quantity was capped to the fresh stock value. */
  recapped: Array<{ key: string; from: number; to: number }>;
  /** Items that were left untouched (also re-keyed items in their final form). */
  next: Record<string, CartItem>;
}

/**
 * Multi-vendor cart integrity check. Cart lines are keyed by
 * `storeId:productId:variantId` so cross-store collisions are physically
 * prevented, but a product may be transferred between stores after the line
 * was added. This helper walks the cart and reconciles each line against the
 * fresh product snapshot map.
 *
 * - If the product's current `store_id` differs from the cart line's
 *   `storeId`, the line is re-keyed (new key built from the fresh store).
 * - If the product is missing or no longer in the catalogue, the line is
 *   dropped.
 * - If the fresh variant stock is lower than the line quantity, the quantity
 *   is capped.
 */
export function assertStoreConsistency(
  items: Record<string, CartItem>,
  productsById: Record<string, Pick<Product, "id" | "store_id"> & { variants?: Array<{ id: string; stock?: number | null }> }>,
  stockByVariantId?: Record<string, number | null | undefined>,
): StoreConsistencyResult {
  const result: StoreConsistencyResult = { rekeyed: [], dropped: [], recapped: [], next: {} };

  for (const [key, item] of Object.entries(items)) {
    const product = productsById[item.productId];
    if (!product) {
      result.dropped.push(item);
      continue;
    }

    const transferred = product.store_id !== item.storeId;
    const nextStoreId = product.store_id;
    const stockLookup = stockByVariantId?.[item.variantId ?? ""];
    const variantStock = product.variants?.find((v) => v.id === item.variantId)?.stock;
    const freshStock = stockLookup ?? variantStock;
    const overStock =
      typeof freshStock === "number" && Number.isFinite(freshStock) && item.quantity > freshStock;

    if (transferred) {
      const nextKey = buildCartLineKey(nextStoreId, item.productId, item.variantId);
      const rekeyedItem: CartItem = { ...item, storeId: nextStoreId };
      if (overStock && typeof freshStock === "number") {
        const capped: CartItem = { ...rekeyedItem, quantity: freshStock, stock: freshStock };
        result.rekeyed.push(capped);
        result.recapped.push({ key: nextKey, from: item.quantity, to: freshStock });
        result.next[nextKey] = capped;
      } else {
        result.rekeyed.push(rekeyedItem);
        result.next[nextKey] = rekeyedItem;
      }
      continue;
    }

    if (overStock && typeof freshStock === "number") {
      const capped: CartItem = { ...item, quantity: freshStock, stock: freshStock };
      result.recapped.push({ key, from: item.quantity, to: freshStock });
      result.next[key] = capped;
      continue;
    }

    result.next[key] = item;
  }

  return result;
}

