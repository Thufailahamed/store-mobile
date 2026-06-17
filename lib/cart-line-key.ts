import type { CartItem } from "@/lib/stores/cart-store";

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
