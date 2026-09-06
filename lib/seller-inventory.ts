import { LOW_STOCK_THRESHOLD } from "@/lib/inventory";

export interface SellerInventoryRow {
  productId: string;
  productName: string;
  variantId: string;
  sku: string;
  size?: string;
  color?: string;
  onHand: number | null;
  reserved: number;
  available: number | null;
  price: number | null;
  currency: string;
  image?: string;
}

export type SellerStockStatus = "out" | "low" | "ok" | "unknown";

export function sellerStatus(available: number | null): SellerStockStatus {
  if (available == null) return "unknown";
  if (available <= 0) return "out";
  if (available <= LOW_STOCK_THRESHOLD) return "low";
  return "ok";
}

export interface SellerGroup {
  key: string;
  productId: string;
  productName: string;
  image?: string;
  rows: SellerInventoryRow[];
  worst: SellerStockStatus;
}

const RANK: Record<SellerStockStatus, number> = { out: 0, low: 1, unknown: 2, ok: 3 };

export function groupSellerRows(rows: SellerInventoryRow[]): SellerGroup[] {
  const map = new Map<string, SellerGroup>();
  for (const r of rows) {
    const g = map.get(r.productId) ?? {
      key: r.productId,
      productId: r.productId,
      productName: r.productName,
      image: r.image,
      rows: [],
      worst: "ok" as SellerStockStatus,
    };
    if (!g.image && r.image) g.image = r.image;
    g.rows.push(r);
    map.set(r.productId, g);
  }
  for (const g of map.values()) {
    let worst: SellerStockStatus = "ok";
    for (const r of g.rows) {
      const s = sellerStatus(r.available);
      if (RANK[s] < RANK[worst]) worst = s;
    }
    g.worst = worst;
  }
  return [...map.values()];
}

export function sellerBarPct(available: number | null): number {
  if (available == null) return 0;
  return Math.max(0, Math.min(100, (available / 20) * 100));
}
