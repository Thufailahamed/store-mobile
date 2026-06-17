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
  const inv = Array.isArray(variant.inventory)
    ? variant.inventory[0]
    : variant.inventory ?? undefined;
  if (inv && (inv.quantity != null || inv.reserved != null)) {
    return getAvailableStock(inv, fallback);
  }
  if (variant.stock != null) return Math.max(0, Number(variant.stock));
  return fallback;
}
