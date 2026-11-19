import { getVariantAvailableStock } from "@/lib/inventory";

/**
 * Client-side guard for browse/search/rail lists: deleted, inactive and
 * sold-out products are never shown. The backend already filters on
 * products.in_stock / deleted_at; this catches cached or RPC-shaped rows.
 *
 * Sold out = not a WhatsApp-order product, has live variants with a stock
 * signal, and none of them has sellable units. Rows without any stock signal
 * (e.g. slim RPC rows) are kept — the server already vetted them.
 *
 * Mirrored verbatim in store/src/lib/listable.ts and store-mobile/lib/listable.ts.
 */
type ListableRow = {
  status?: string | null;
  is_active?: boolean | null;
  deleted_at?: string | null;
  in_stock?: boolean | null;
  order_channel?: string | null;
  variants?: Array<{
    is_active?: boolean | null;
    deleted_at?: string | null;
    stock?: number | string | null;
    inventory?: unknown;
  } | null> | null;
};

function hasStockSignal(v: NonNullable<NonNullable<ListableRow["variants"]>[number]>): boolean {
  if (v.stock != null && v.stock !== "" && Number.isFinite(Number(v.stock))) return true;
  const inv = v.inventory as { quantity?: unknown; on_hand?: unknown } | Array<{ quantity?: unknown; on_hand?: unknown } | null> | null | undefined;
  if (Array.isArray(inv)) return inv.some((row) => row && (row.quantity != null || row.on_hand != null));
  return !!inv && (inv.quantity != null || inv.on_hand != null);
}

export function isListableProduct(p: ListableRow | null | undefined): boolean {
  if (!p) return false;
  if (p.deleted_at) return false;
  if (p.is_active === false) return false;
  if (p.status && p.status !== "active") return false;
  if (p.in_stock === false) return false;
  if (p.order_channel === "whatsapp") return true;
  const variants = (p.variants ?? []).filter((v): v is NonNullable<typeof v> => !!v);
  if (variants.length === 0) return true;
  const live = variants.filter((v) => v.is_active !== false && !v.deleted_at);
  if (live.length === 0) return false;
  const signalled = live.filter(hasStockSignal);
  if (signalled.length === 0) return true;
  const units = signalled.reduce(
    (sum, v) => sum + getVariantAvailableStock(v as Parameters<typeof getVariantAvailableStock>[0], 0),
    0,
  );
  return units > 0;
}

export function onlyListable<T extends ListableRow>(rows: readonly T[] | null | undefined): T[] {
  return (rows ?? []).filter(isListableProduct);
}
