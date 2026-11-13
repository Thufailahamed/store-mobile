/**
 * Batched seller lookup for product cards.
 *
 * Many home rails come from flat RPC/feed rows that carry no store or brand,
 * so their cards had no seller line. Cards call `loadProductSeller(id)`;
 * ids requested in the same tick are collected into one by-ids request and
 * the result is cached for the session.
 */
import * as B from "@/lib/api/backend";
import { mapStore, mapBrand } from "@/lib/api/product-mapper";
import type { Product } from "@/lib/types";

export type ProductSeller = {
  store: Product["store"] | null;
  brand: Product["brand"] | null;
  mrp: number | null;
};

const cache = new Map<string, Promise<ProductSeller | null>>();
let queue: Array<{ id: string; resolve: (v: ProductSeller | null) => void }> = [];
let timer: ReturnType<typeof setTimeout> | null = null;

const BATCH_MS = 40;
const MAX_BATCH = 60;

async function flush() {
  timer = null;
  const batch = queue;
  queue = [];
  for (let i = 0; i < batch.length; i += MAX_BATCH) {
    const chunk = batch.slice(i, i + MAX_BATCH);
    let byId = new Map<string, ProductSeller>();
    try {
      const res = await B.getProductsByIdsBackend(chunk.map((c) => c.id));
      if (res.ok) {
        byId = new Map(
          (res.data.products ?? []).map((p: any) => [
            p.id,
            {
              store: mapStore(p.store) ?? null,
              brand: mapBrand(p.brand) ?? null,
              mrp: p.mrp != null ? Number(p.mrp) : null,
            },
          ]),
        );
      }
    } catch {
      // Leave byId empty; cards just keep showing no seller line.
    }
    for (const { id, resolve } of chunk) resolve(byId.get(id) ?? null);
  }
}

export function loadProductSeller(id: string): Promise<ProductSeller | null> {
  const hit = cache.get(id);
  if (hit) return hit;
  const p = new Promise<ProductSeller | null>((resolve) => {
    queue.push({ id, resolve });
    if (!timer) timer = setTimeout(flush, BATCH_MS);
  });
  // Failed lookups are not cached forever: drop null so a later mount retries.
  p.then((v) => {
    if (!v) cache.delete(id);
  });
  cache.set(id, p);
  return p;
}
