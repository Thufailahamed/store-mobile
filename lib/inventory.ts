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

/** True when the payload actually sent a stock figure — 0 is a value, missing is not. */
export function variantHasStockSignal(variant: VariantWithInventory | null | undefined): boolean {
  if (!variant) return false;
  if (firstFiniteNumber(variant.stock) != null) return true;
  if (Array.isArray(variant.inventory)) {
    return variant.inventory.some(
      (row) => row && firstFiniteNumber(row.quantity, row.on_hand) != null,
    );
  }
  if (variant.inventory) {
    return firstFiniteNumber(variant.inventory.quantity, variant.inventory.on_hand) != null;
  }
  return false;
}

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

/**
 * Sellable units for a catalogue product. Returns null when the payload has
 * no stock signal so callers can show "—" instead of inventing 0 in stock.
 */
export function getProductAvailableStock(
  product: { variants?: VariantWithInventory[] | null; stock?: number | null } | null | undefined,
): number | null {
  if (!product) return null;
  const variants = product.variants ?? [];
  if (variants.length > 0) {
    const signaled = variants.filter(variantHasStockSignal);
    if (signaled.length === 0) return null;
    return signaled.reduce((sum, v) => sum + getVariantAvailableStock(v, 0), 0);
  }
  return firstFiniteNumber(product.stock);
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
  if (!row.inventory) return null;
  if (Array.isArray(row.inventory)) {
    let quantity = 0;
    let reserved = 0;
    let sawQty = false;
    for (const item of row.inventory) {
      if (!item) continue;
      const q = firstFiniteNumber(item.quantity, item.on_hand);
      if (q != null) {
        quantity += Math.max(0, q);
        sawQty = true;
      }
      reserved += Math.max(0, firstFiniteNumber(item.reserved) ?? 0);
    }
    if (!sawQty) return null;
    return { quantity, reserved, on_hand: quantity };
  }
  return row.inventory;
}

function rowHasStockSignal(row: InventoryHealthRow): boolean {
  const nested = nestedInventory(row);
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

export type InventoryQuantities = {
  quantity: number | null;
  reserved: number;
  available: number | null;
};

/**
 * Read sellable quantities from a live inventory payload. Missing stock
 * fields stay null so callers can show "—" instead of inventing 0 / Out.
 */
export function readInventoryQuantities(row: InventoryHealthRow): InventoryQuantities {
  const nested = nestedInventory(row);
  const reserved = Math.max(0, firstFiniteNumber(row.reserved, nested?.reserved) ?? 0);
  if (!rowHasStockSignal(row)) {
    return { quantity: null, reserved, available: null };
  }
  const availableDirect = firstFiniteNumber(row.available, row.available_quantity);
  const quantity = firstFiniteNumber(
    row.quantity,
    row.on_hand,
    row.qty,
    nested?.quantity,
    nested?.on_hand,
    row.stock,
  );
  const available =
    availableDirect ?? (quantity != null ? Math.max(0, quantity - reserved) : null);
  return {
    quantity: quantity != null ? Math.max(0, quantity) : null,
    reserved,
    available: available != null ? Math.max(0, available) : null,
  };
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
