import type { BrandInventoryRow } from "@/lib/api/backend";
import { LOW_STOCK_THRESHOLD } from "@/lib/inventory";

export type StockStatus = "out" | "low" | "healthy";
export type StockFilter = "all" | "low" | "out" | "healthy";
export type StockSort = "urgency" | "lowest" | "name";

export function getAvailable(row: BrandInventoryRow): number {
  const q = row.inventory?.quantity ?? 0;
  const r = row.inventory?.reserved ?? 0;
  return Math.max(0, q - r);
}

export function getStatus(available: number): StockStatus {
  if (available <= 0) return "out";
  if (available <= LOW_STOCK_THRESHOLD) return "low";
  return "healthy";
}

export type InventoryGroup = {
  key: string;
  productName: string;
  rows: BrandInventoryRow[];
  worst: StockStatus;
};

const RANK: Record<StockStatus, number> = { out: 0, low: 1, healthy: 2 };

export function groupByProduct(rows: BrandInventoryRow[]): InventoryGroup[] {
  const map = new Map<string, InventoryGroup>();
  for (const r of rows) {
    const name = r.product?.name?.trim() || "Uncategorized";
    const key = r.product?.id ?? `name:${name}`;
    const g = map.get(key) ?? { key, productName: name, rows: [], worst: "healthy" as StockStatus };
    g.rows.push(r);
    map.set(key, g);
  }
  for (const g of map.values()) {
    let worst: StockStatus = "healthy";
    for (const r of g.rows) {
      const s = getStatus(getAvailable(r));
      if (RANK[s] < RANK[worst]) worst = s;
    }
    g.worst = worst;
  }
  return [...map.values()];
}

export function filterRows(rows: BrandInventoryRow[], filter: StockFilter, query: string): BrandInventoryRow[] {
  const q = query.trim().toLowerCase();
  return rows.filter((r) => {
    const avail = getAvailable(r);
    const s = getStatus(avail);
    if (filter !== "all" && s !== filter) return false;
    if (!q) return true;
    const hay = `${r.product?.name ?? ""} ${r.sku ?? ""} ${r.size ?? ""} ${r.color ?? ""}`.toLowerCase();
    return hay.includes(q);
  });
}

export function sortRows(rows: BrandInventoryRow[], sort: StockSort): BrandInventoryRow[] {
  const copy = [...rows];
  if (sort === "name") {
    return copy.sort((a, b) => (a.product?.name ?? "").localeCompare(b.product?.name ?? "") || (a.sku ?? "").localeCompare(b.sku ?? ""));
  }
  if (sort === "lowest") {
    return copy.sort((a, b) => getAvailable(a) - getAvailable(b));
  }
  return copy.sort((a, b) => RANK[getStatus(getAvailable(a))] - RANK[getStatus(getAvailable(b))] || getAvailable(a) - getAvailable(b));
}

export function buildOptimisticQuantity(row: BrandInventoryRow, newAvailable: number): number {
  const reserved = Math.max(0, row.inventory?.reserved ?? 0);
  return reserved + Math.max(0, Math.min(9999, Math.floor(newAvailable)));
}

export function parseStockInput(text: string): number | null {
  const t = text.trim();
  if (!/^\d{1,4}$/.test(t)) return null;
  const n = Number(t);
  if (!Number.isInteger(n) || n < 0 || n > 9999) return null;
  return n;
}
