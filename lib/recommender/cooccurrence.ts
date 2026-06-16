/**
 * Co-occurrence ("Pairs well with") engine.
 *
 * Surfaces products that pair naturally with an anchor product. Tries
 * (in order):
 *   1. Aggregate co-view data from a `product_views` table if available.
 *   2. The user's own view history (their co-viewed items).
 *   3. A content-based complementary category fallback (e.g. a "top" pairs
 *      with "bottom" or "accessory").
 *   4. Brand-companion fallback (other items from the same brand, different
 *      category).
 *
 * Co-view and content signals are blended. Items out of stock are filtered.
 */

import { supabase } from "@/lib/supabase/client";
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

async function tryAggregateCoViews(anchorId: string, limit: number): Promise<string[]> {
  // Attempt a typical co-view query. The exact schema may vary; we only
  // return ids if the call succeeds and yields rows.
  try {
    const { data, error } = await supabase
      .from("product_views")
      .select("product_id, session_id, user_id, viewed_at")
      .order("viewed_at", { ascending: false })
      .limit(2000);
    if (error || !data || !Array.isArray(data) || data.length === 0) return [];

    type Row = { product_id: string; session_id?: string | null; user_id?: string | null; viewed_at?: string };
    const rows = data as Row[];

    // Find sessions/users that viewed the anchor.
    const coSessionIds = new Set<string>();
    const coUserIds = new Set<string>();
    for (const r of rows) {
      if (r.product_id === anchorId) {
        if (r.session_id) coSessionIds.add(r.session_id);
        if (r.user_id) coUserIds.add(r.user_id);
      }
    }
    if (coSessionIds.size === 0 && coUserIds.size === 0) return [];

    const counts = new Map<string, number>();
    for (const r of rows) {
      if (r.product_id === anchorId) continue;
      const matches =
        (r.session_id && coSessionIds.has(r.session_id)) ||
        (r.user_id && coUserIds.has(r.user_id));
      if (!matches) continue;
      counts.set(r.product_id, (counts.get(r.product_id) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => id);
  } catch {
    return [];
  }
}

async function userCoViews(userId: string | null | undefined, anchorId: string, limit: number): Promise<string[]> {
  try {
    const events = await readEvents(userId);
    // Products the user has viewed within a 30-min window of the anchor.
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
    const { data, error } = await supabase
      .from("products")
      .select("*, images:product_images(*), variants:product_variants(*, inventory(*)), brand:brands(*), category:categories(slug, name)")
      .eq("status", "active")
      .eq("is_active", true)
      .in("category->>slug", compSlugs)
      .neq("id", anchor.id)
      .order("total_sales", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    const products = mapProducts(data as any[]).filter(isProductInStock);
    return products;
  } catch {
    return [];
  }
}

async function brandCompanions(anchor: Product, limit: number): Promise<Product[]> {
  if (!anchor.brand_id) return [];
  try {
    const { data, error } = await supabase
      .from("products")
      .select("*, images:product_images(*), variants:product_variants(*, inventory(*)), brand:brands(*), category:categories(slug, name)")
      .eq("status", "active")
      .eq("is_active", true)
      .eq("brand_id", anchor.brand_id)
      .neq("id", anchor.id)
      .neq("category_id", anchor.category_id ?? "")
      .order("total_sales", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return mapProducts(data as any[]).filter(isProductInStock);
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
    // Tier 1: aggregate co-views.
    const aggIds = await tryAggregateCoViews(anchor.id, limit * 2);
    let products: Product[] = [];
    if (aggIds.length > 0) {
      const { data, error } = await supabase
        .from("products")
        .select("*, images:product_images(*), variants:product_variants(*, inventory(*)), brand:brands(*), category:categories(slug, name)")
        .eq("status", "active")
        .eq("is_active", true)
        .in("id", aggIds);
      if (!error && data) {
        const byId = new Map(mapProducts(data as any[]).map((p) => [p.id, p]));
        products = aggIds
          .map((id) => byId.get(id))
          .filter((p): p is Product => p != null && isProductInStock(p));
      }
    }

    // Tier 2: user's own co-views.
    if (products.length < limit) {
      const userIds = await userCoViews(userId, anchor.id, limit);
      if (userIds.length > 0) {
        const { data, error } = await supabase
          .from("products")
          .select("*, images:product_images(*), variants:product_variants(*, inventory(*)), brand:brands(*), category:categories(slug, name)")
          .eq("status", "active")
          .eq("is_active", true)
          .in("id", userIds);
        if (!error && data) {
          const seen = new Set(products.map((p) => p.id));
          for (const p of mapProducts(data as any[])) {
            if (seen.has(p.id) || !isProductInStock(p)) continue;
            products.push(p);
            seen.add(p.id);
          }
        }
      }
    }

    // Tier 3: complementary category.
    if (products.length < limit) {
      const comp = await complementaryCandidates(anchor, limit - products.length);
      const seen = new Set(products.map((p) => p.id));
      for (const p of comp) {
        if (seen.has(p.id)) continue;
        products.push(p);
        seen.add(p.id);
      }
    }

    // Tier 4: same brand, different category.
    if (products.length < limit) {
      const comp = await brandCompanions(anchor, limit - products.length);
      const seen = new Set(products.map((p) => p.id));
      for (const p of comp) {
        if (seen.has(p.id)) continue;
        products.push(p);
        seen.add(p.id);
      }
    }

    return ok(products.slice(0, limit));
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch pairs well with");
  }
}
