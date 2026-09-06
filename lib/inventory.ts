/**
 * Sellable stock helpers. Server source of truth: inventory.quantity - inventory.reserved.
 */

export const LOW_STOCK_THRESHOLD = 5;

export type InventoryRow = {
  quantity?: number | null;
  reserved?: number | null;
  on_hand?: number | null;
};

function firstFiniteNumber(...vals: unknown[]): number | null {
  for (const v of vals) {
    if (v == null || v === "") continue;
    const n = typeof v === "number" ? v : Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function getAvailableStock(
  inventory: InventoryRow | null | undefined,
  fallback = 0,
): number {
  if (!inventory) return fallback;
  const quantity = Math.max(0, firstFiniteNumber(inventory.quantity, inventory.on_hand) ?? 0);
  const reserved = Math.max(0, firstFiniteNumber(inventory.reserved) ?? 0);
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
        quantity += Math.max(0, firstFiniteNumber(row.quantity, row.on_hand) ?? 0);
        reserved += Math.max(0, firstFiniteNumber(row.reserved) ?? 0);
      }
      return Math.max(0, quantity - reserved);
    }
  } else if (variant.inventory && (variant.inventory.quantity != null || variant.inventory.reserved != null)) {
    return getAvailableStock(variant.inventory, fallback);
  }
  if (variant.stock != null) return Math.max(0, Number(variant.stock));
  return fallback;
}

export type InventoryHealthRow = {
  product?: { status?: string | null } | null;
  inventory?: InventoryRow | InventoryRow[] | null;
  quantity?: number | null;
  reserved?: number | null;
  stock?: number | null;
  available?: number | null;
  on_hand?: number | null;
  qty?: number | null;
  available_quantity?: number | null;
};

function nestedInventory(row: InventoryHealthRow): InventoryRow | null {
  if (!row.inventory || Array.isArray(row.inventory)) return null;
  return row.inventory;
}

function rowHasStockSignal(row: InventoryHealthRow): boolean {
  const nested = nestedInventory(row);
  if (Array.isArray(row.inventory) && row.inventory.length > 0) return true;
  return firstFiniteNumber(
    row.available,
    row.available_quantity,
    row.quantity,
    row.on_hand,
    row.stock,
    row.qty,
    nested?.quantity,
    nested?.on_hand,
  ) != null;
}

export type InventoryHealth = {
  totalSkus: number;
  healthyCount: number;
  lowStockVariants: number;
  outOfStockVariants: number;
};

const SKIP_STATUSES = new Set(["archived", "rejected"]);

/**
 * Roll up variant rows into catalogue health. Accepts nested
 * `{ inventory: { quantity, reserved } }` rows, flat quantity/stock fields,
 * and aliases (`on_hand`, `qty`). Rows with no stock fields are skipped so
 * unknown API shapes are never counted as out of stock.
 */
export function summarizeInventoryHealth(rows: InventoryHealthRow[] | null | undefined): InventoryHealth {
  let totalSkus = 0;
  let lowStockVariants = 0;
  let outOfStockVariants = 0;

  for (const row of rows ?? []) {
    const status = row.product?.status?.toLowerCase();
    if (status && SKIP_STATUSES.has(status)) continue;
    if (!rowHasStockSignal(row)) continue;

    totalSkus += 1;

    const nested = nestedInventory(row);
    const available =
      firstFiniteNumber(row.available, row.available_quantity) ??
      getVariantAvailableStock(
        {
          inventory: row.inventory ?? (
            firstFiniteNumber(row.quantity, row.on_hand, row.qty, nested?.quantity, nested?.on_hand) != null
              ? { quantity: firstFiniteNumber(row.quantity, row.on_hand, row.qty, nested?.quantity, nested?.on_hand), reserved: row.reserved ?? nested?.reserved }
              : null
          ),
          stock: firstFiniteNumber(row.stock, row.quantity, row.on_hand, row.qty),
        },
        0,
      );

    if (available <= 0) outOfStockVariants += 1;
    else if (available <= LOW_STOCK_THRESHOLD) lowStockVariants += 1;
  }

  return {
    totalSkus,
    healthyCount: Math.max(0, totalSkus - lowStockVariants - outOfStockVariants),
    lowStockVariants,
    outOfStockVariants,
  };
}
