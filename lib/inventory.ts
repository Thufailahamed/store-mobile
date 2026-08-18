/**
 * Sellable stock helpers. Server source of truth: inventory.quantity - inventory.reserved.
 */

export type InventoryRow = {
  quantity?: number | null;
  reserved?: number | null;
};

export function getAvailableStock(
  inventory: InventoryRow | null | undefined,
  fallback = 0,
): number {
  if (!inventory) return fallback;
  const quantity = Math.max(0, Number(inventory.quantity ?? 0));
  const reserved = Math.max(0, Number(inventory.reserved ?? 0));
  return Math.max(0, quantity - reserved);
}

export type VariantWithInventory = {
  stock?: number | null;
  inventory?: InventoryRow[] | InventoryRow | null;
};

/** Available units for a variant (prefers joined inventory row over cached stock). */
export function getVariantAvailableStock(
  variant: VariantWithInventory | null | undefined,
  fallback = 0,
): number {
  if (!variant) return fallback;
  // Multi-warehouse: a variant may have several inventory rows (one per
  // store) — sum across all rows so the storefront reports total sellable
  // stock rather than picking the first row's number.
  if (Array.isArray(variant.inventory)) {
    if (variant.inventory.length === 0) {
      // fall through to stock field below
    } else {
      let quantity = 0;
      let reserved = 0;
      for (const row of variant.inventory) {
        if (!row) continue;
        quantity += Math.max(0, Number(row.quantity ?? 0));
        reserved += Math.max(0, Number(row.reserved ?? 0));
      }
      return Math.max(0, quantity - reserved);
    }
  } else if (variant.inventory && (variant.inventory.quantity != null || variant.inventory.reserved != null)) {
    return getAvailableStock(variant.inventory, fallback);
  }
  if (variant.stock != null) return Math.max(0, Number(variant.stock));
  return fallback;
}
