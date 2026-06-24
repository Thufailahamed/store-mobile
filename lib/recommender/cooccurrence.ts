/**
 * Co-occurrence ("Pairs well with") engine.
 *
 * Surfaces products that pair naturally with an anchor product. Tries
 * (in order):
 *   0. Purchase co-occurrence (server-side aggregation: products
 *      bought together in the same paid order). Strongest signal —
 *      actual conversion, not passive viewing.
 *   1. Aggregate co-view data from `product_views` via the backend RPC
 *      added in migration 0153.
 *   2. The user's own view history (their co-viewed items).
 *   3. A content-based complementary category fallback (e.g. a "top" pairs
 *      with "bottom" or "accessory").
 *   4. Brand-companion fallback (other items from the same brand, different
 *      category).
 *
 * Tier 0 wins when it yields enough products; the lower tiers fill in.
 * Out-of-stock items are filtered at every tier.
 *
 * All product reads route through the Hono backend.
 */

import { getCoPurchasesBackend, getCoViewsBackend, getCandidatesBackend } from "@/lib/api/backend";
import { mapProducts } from "@/lib/api/product-mapper";
import { readEvents, type ViewEvent } from "./events";
import { isProductInStock } from "./inventory";
import type { Result } from "@/lib/api";
import type { Product } from "@/lib/types";

const ok = <T>(data: T): Result<T> => ({ ok: true, data });
const fail = (e: string): Result<never> => ({ ok: false, error: e });

/** Optional category slugs considered "complementary" to a given category. */
const COMPLEMENTARY: Record<string, string[]> = {
  tops: ["bottoms", "accessories", "shoes"],
  bottoms: ["tops", "shoes", "accessories"],
  dresses: ["shoes", "accessories", "bags"],
  shoes: ["tops", "bottoms", "accessories", "bags"],
  bags: ["tops", "bottoms", "shoes", "accessories"],
  accessories: ["tops", "bottoms", "dresses", "shoes"],
  outerwear: ["tops", "bottoms", "accessories"],
  jewelry: ["dresses", "tops", "accessories"],
  watches: ["accessories", "tops"],
};

function categorySlug(product: Product): string {
  const cat = (product as Product & { category?: { slug?: string; name?: string } }).category;
  if (cat?.slug) return cat.slug.toLowerCase();
  if (cat?.name) return cat.name.toLowerCase();
  return "";
}

/**
 * Hydrate a list of product ids to full Product rows via the backend
 * candidates endpoint (full product shape, scoped to active products).
 * Preserves input order in the returned array.
 */
async function hydrateIds(ids: string[]): Promise<Product[]> {
  if (ids.length === 0) return [];
  try {
    const res = await getCandidatesBackend({ limit: Math.max(60, ids.length * 2) });
    if (!res.ok) return [];
    const rows = (res.data?.products ?? []).filter((p) => ids.includes(p.id));
    const products = mapProducts(rows as unknown as Array<Record<string, unknown>>).filter(isProductInStock);
    const byId = new Map(products.map((p) => [p.id, p]));
    return ids.map((id) => byId.get(id)).filter((p): p is Product => Boolean(p));
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/*  Tier 0 — purchase co-occurrence                                    */
/* ------------------------------------------------------------------ */

interface CoPurchaseRow {
  co_product_id: string;
  pair_count: number;
  last_purchased_at: string;
}

async function tryCoPurchases(anchorId: string, limit: number): Promise<string[]> {
  try {
    const res = await getCoPurchasesBackend(anchorId, limit * 2);
    if (!res.ok || !Array.isArray(res.data.results)) return [];
    const rows = (res.data.results as unknown as Array<{ product_id: string; score: number }>).map((r) => ({
      co_product_id: r.product_id,
      pair_count: Number(r.score ?? 0),
      last_purchased_at: new Date(0).toISOString(),
    })) as CoPurchaseRow[];
    return rows
      .sort((a, b) => {
        if (b.pair_count !== a.pair_count) return b.pair_count - a.pair_count;
        return b.last_purchased_at.localeCompare(a.last_purchased_at);
      })
      .slice(0, limit)
      .map((r) => r.co_product_id);
  } catch {
    return [];
  }
}

async function tryAggregateCoViews(anchorId: string, limit: number): Promise<string[]> {
  try {
    const res = await getCoViewsBackend(anchorId, limit * 2);
    if (!res.ok || !Array.isArray(res.data.results)) return [];
    type Row = { co_product_id: string; view_count: number; last_viewed_at: string };
    const rows = (res.data.results as unknown as Row[]).slice();
    return rows
      .sort((a, b) => {
        if (b.view_count !== a.view_count) return Number(b.view_count) - Number(a.view_count);
        return b.last_viewed_at.localeCompare(a.last_viewed_at);
      })
      .slice(0, limit)
      .map((r) => r.co_product_id);
  } catch {
    return [];
  }
}

async function userCoViews(userId: string | null | undefined, anchorId: string, limit: number): Promise<string[]> {
  try {
    const events = await readEvents(userId);
    const recentViews = events
      .filter((e): e is ViewEvent => e.type === "view")
      .slice(0, 200);
    const anchorView = recentViews.find((e) => e.product.id === anchorId);
    if (!anchorView) return [];
    const windowMs = 30 * 60 * 1000;
    const coIds = new Set<string>();
    for (const v of recentViews) {
      if (v.product.id === anchorId) continue;
      if (Math.abs(v.t - anchorView.t) <= windowMs) {
        coIds.add(v.product.id);
      }
    }
    return Array.from(coIds).slice(0, limit);
  } catch {
    return [];
  }
}

async function complementaryCandidates(anchor: Product, limit: number): Promise<Product[]> {
  const slug = categorySlug(anchor);
  const compSlugs = COMPLEMENTARY[slug] ?? Object.keys(COMPLEMENTARY).filter((k) => k !== slug);
  if (compSlugs.length === 0) return [];
  try {
    // Pull a wide pool; filter by complementary category slugs client-side.
    const res = await getCandidatesBackend({ limit: Math.max(60, limit * 3) });
    if (!res.ok) return [];
    const rows = (res.data?.products ?? []).filter((p) => {
      const ps = ((p as { category?: { slug?: string; name?: string } }).category?.slug ?? "").toLowerCase();
      return p.id !== anchor.id && compSlugs.includes(ps);
    });
    const products = mapProducts(rows as unknown as Array<Record<string, unknown>>).filter(isProductInStock);
    return products.slice(0, limit);
  } catch {
    return [];
  }
}

async function brandCompanions(anchor: Product, limit: number): Promise<Product[]> {
  if (!anchor.brand_id) return [];
  try {
    const res = await getCandidatesBackend({ limit: Math.max(60, limit * 3), brand_id: anchor.brand_id });
    if (!res.ok) return [];
    const rows = (res.data?.products ?? []).filter(
      (p) => p.id !== anchor.id && (p as { category_id?: string }).category_id !== (anchor.category_id ?? ""),
    );
    const products = mapProducts(rows as unknown as Array<Record<string, unknown>>).filter(isProductInStock);
    return products.slice(0, limit);
  } catch {
    return [];
  }
}

/** Get "pairs well with" recommendations for an anchor product. */
export async function getPairsWellWith(
  userId: string | null | undefined,
  anchor: Product,
  limit: number = 6,
): Promise<Result<Product[]>> {
  try {
    let products: Product[] = [];

    // Tier 0: purchase co-occurrence.
    const coIds = await tryCoPurchases(anchor.id, limit);
    if (coIds.length > 0) {
      const hydrated = await hydrateIds(coIds);
      products = hydrated.filter((p) => p.id !== anchor.id && isProductInStock(p));
    }
    if (products.length >= limit) {
      return ok(products.slice(0, limit));
    }

    // Tier 1: aggregate co-views.
    if (products.length < limit) {
      const aggIds = await tryAggregateCoViews(anchor.id, (limit - products.length) * 2);
      if (aggIds.length > 0) {
        const hydrated = await hydrateIds(aggIds);
        const seen = new Set(products.map((p) => p.id));
        for (const p of hydrated) {
          if (seen.has(p.id) || p.id === anchor.id || !isProductInStock(p)) continue;
          products.push(p);
          seen.add(p.id);
          if (products.length >= limit) break;
        }
      }
    }

    // Tier 2: user's own co-views.
    if (products.length < limit) {
      const userIds = await userCoViews(userId, anchor.id, limit);
      if (userIds.length > 0) {
        const hydrated = await hydrateIds(userIds);
        const seen = new Set(products.map((p) => p.id));
        for (const p of hydrated) {
          if (seen.has(p.id) || p.id === anchor.id || !isProductInStock(p)) continue;
          products.push(p);
          seen.add(p.id);
          if (products.length >= limit) break;
        }
      }
    }

    // Tier 3: complementary category.
    if (products.length < limit) {
      const comp = await complementaryCandidates(anchor, (limit - products.length) * 2);
      const seen = new Set(products.map((p) => p.id));
      for (const p of comp) {
        if (seen.has(p.id) || p.id === anchor.id) continue;
        products.push(p);
        seen.add(p.id);
        if (products.length >= limit) break;
      }
    }

    // Tier 4: same brand, different category.
    if (products.length < limit) {
      const comp = await brandCompanions(anchor, (limit - products.length) * 2);
      const seen = new Set(products.map((p) => p.id));
      for (const p of comp) {
        if (seen.has(p.id) || p.id === anchor.id) continue;
        products.push(p);
        seen.add(p.id);
        if (products.length >= limit) break;
      }
    }

    return ok(products.slice(0, limit));
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch pairs well with");
  }
}