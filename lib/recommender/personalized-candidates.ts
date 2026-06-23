/**
 * Personalized candidate pool.
 *
 * Replaces the old "give me 80 random top-sellers" pull with a mix
 * tailored to the user's strongest category affinities. The server-side
 * RPC `get_user_top_categories` reads the `user_events` mirror and
 * returns the top N category ids weighted by event type (purchase > cart
 * > wishlist > view). We then split the pool 50/50 between those
 * affinity categories and the broad top-sellers list.
 *
 * Why split instead of pure-affinity: personalization can over-fit.
 * Keeping 50% of the pool as the global ranking means new arrivals and
 * trending items still get surfaced even when the user is heavily
 * skewed toward a narrow slice.
 *
 * Fallbacks:
 *   - No userId → general pool.
 *   - RPC fails or returns no categories → general pool.
 *   - Affinity categories are too narrow to fill 50% → backfill with
 *     general top-sellers.
 */

import { supabase } from "@/lib/supabase/client";
import { getUserTopCategoriesBackend } from "@/lib/api/backend";
import { mapProducts } from "@/lib/api/product-mapper";
import { PRODUCT_CARD_SELECT } from "@/lib/api/product-queries";
import { isProductInStock } from "./inventory";
import type { Product } from "@/lib/types";
import type { RailContext } from "./engine";

const POOL_LIMIT = 80;
const HARD_CAP = 60;
const AFFINITY_SPLIT = 0.5;

const PRODUCT_SELECT = PRODUCT_CARD_SELECT;

interface TopCategoryRow {
  category_id: string;
  weight: number;
}

async function fetchTopCategories(
  userId: string,
  limit: number = 2,
): Promise<string[]> {
  try {
    const res = await getUserTopCategoriesBackend(limit);
    if (!res.ok || !Array.isArray(res.data.categories)) return [];
    // Backend returns { category_id, score, category }; legacy local shape
    // expected { category_id, weight }. Map score → weight.
    const rows = (res.data.categories as unknown as Array<{ category_id: string; score: number }>).map((r) => ({
      category_id: r.category_id,
      weight: Number(r.score ?? 0),
    })) as TopCategoryRow[];
    return rows
      .filter((r) => r.category_id && r.weight > 0)
      .map((r) => r.category_id);
  } catch {
    return [];
  }
}

async function fetchGeneralPool(limit: number, ctx: RailContext): Promise<Product[]> {
  let query = supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("status", "active")
    .eq("is_active", true)
    .order("total_sales", { ascending: false })
    .limit(Math.min(limit, HARD_CAP));
  if (ctx.categoryId) query = query.eq("category_id", ctx.categoryId);
  if (ctx.brandId) query = query.eq("brand_id", ctx.brandId);
  if (ctx.gender) query = query.eq("gender", ctx.gender);
  try {
    const { data, error } = await query;
    if (error || !data) return [];
    return mapProducts(data as any[]);
  } catch {
    return [];
  }
}

async function fetchAffinityPool(
  categoryIds: string[],
  limit: number,
  ctx: RailContext,
): Promise<Product[]> {
  if (categoryIds.length === 0) return [];
  let query = supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("status", "active")
    .eq("is_active", true)
    .in("category_id", categoryIds)
    .order("total_sales", { ascending: false })
    .limit(Math.min(limit, HARD_CAP));
  // Honor caller-provided brand / gender filters even on the affinity
  // branch — a user searching "women's shirts" should never see men's
  // shirts just because they historically like the category.
  if (ctx.brandId) query = query.eq("brand_id", ctx.brandId);
  if (ctx.gender) query = query.eq("gender", ctx.gender);
  try {
    const { data, error } = await query;
    if (error || !data) return [];
    return mapProducts(data as any[]);
  } catch {
    return [];
  }
}

/**
 * Build the candidate pool for a user. When `userId` is provided AND
 * the server returns at least one top category, the pool is split
 * between affinity categories and the general top-sellers. Otherwise
 * falls back to a pure general pool.
 */
export async function pullPersonalizedCandidates(
  userId: string | null | undefined,
  limit: number = POOL_LIMIT,
  ctx: RailContext = {},
): Promise<Product[]> {
  const half = Math.max(20, Math.floor(limit * AFFINITY_SPLIT));

  // No user or unknown user → general pool, the legacy behavior.
  if (!userId) return fetchGeneralPool(limit, ctx);

  const topCats = await fetchTopCategories(userId, 2);
  if (topCats.length === 0) return fetchGeneralPool(limit, ctx);

  // Fire both queries in parallel. The affinity half-then-general top-up
  // pattern: if the affinity pull comes up short, the general branch
  // fills the gap. If it over-fills, we slice at the end.
  const [affinity, general] = await Promise.all([
    fetchAffinityPool(topCats, half, ctx),
    fetchGeneralPool(limit, ctx),
  ]);

  // If the affinity branch came back empty (e.g. all categories are
  // very narrow), just use the general pool. Avoids the case where we
  // return fewer candidates than the ranker needs.
  if (affinity.length === 0) return general.slice(0, limit);

  const seen = new Set<string>();
  const merged: Product[] = [];
  for (const p of affinity) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    merged.push(p);
  }
  for (const p of general) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    merged.push(p);
  }
  return merged.slice(0, limit);
}

/** Exposed for tests: split ratio is configurable. */
export const POOL_LIMITS = {
  POOL_LIMIT,
  HARD_CAP,
  AFFINITY_SPLIT,
};

/** Re-export in-stock filter so the ranker can be inlined here later. */
export { isProductInStock };
