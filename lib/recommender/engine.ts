/**
 * Public recommendation engine.
 *
 * Wraps the event log, profile, ranker, cache, and cold-start fallback into
 * a few high-level calls used by the UI:
 *
 *   - getForYouRail(userId)             → home page "Recommended for you"
 *   - getSimilarProducts(product)        → product page "Similar pieces"
 *   - getYouMayAlsoLike(userId, product) → product page "You may also like"
 *   - getPairsWellWith(userId, product)  → product page "Pairs well with"
 *   - getRecentlyViewed(userId)          → home / product page history rail
 *   - getFromWishlist(userId)            → home page "From your wishlist"
 *   - getPersonalizedSearch(products, userId) → re-rank search results
 *   - getFallbackRecs(userId)            → empty-state / "based on history"
 *
 * All entry points are async, return a `Result<...>`, and never throw.
 * The candidate pull defaults to a broad query of active products; callers
 * can scope by category/brand/gender if they want.
 */

import { supabase } from "@/lib/supabase/client";
import { mapProducts } from "@/lib/api/product-mapper";
import type { Product } from "@/lib/types";
import type { Result } from "@/lib/api";
import { loadProfile, type UserProfile } from "./profile";
import {
  rankProducts,
  rankSimilarTo,
  personalizeResults,
  type RankedProduct,
} from "./rank";
import { fetchColdStartProducts, fetchColdStartSimilar } from "./cold-start";
import { fetchRecentlyViewed } from "./recently-viewed";
import { getPairsWellWith } from "./cooccurrence";
import { cacheGet, cacheSet, cacheKey as makeKey, cacheBustPrefix } from "./cache";
import { useWishlist } from "@/lib/stores";
import { isProductInStock } from "./inventory";
import { pullPersonalizedCandidates } from "./personalized-candidates";

const ok = <T>(data: T): Result<T> => ({ ok: true, data });
const fail = (e: string): Result<never> => ({ ok: false, error: e });

const CANDIDATE_POOL = 80;
const HARD_CAP = 60;
const TTL_FOR_YOU = 60_000;
const TTL_SIMILAR = 120_000;

export interface RailContext {
  categoryId?: string;
  brandId?: string;
  gender?: string;
}

/* ------------------------------------------------------------------ */
/*  Candidate pullers                                                  */
/* ------------------------------------------------------------------ */

/**
 * Generic candidate puller (no user). Kept for callers that need a
 * broad pool — search-result rerank, similar products, etc.
 */
async function pullCandidates(
  limit: number = CANDIDATE_POOL,
  ctx: RailContext = {},
): Promise<Product[]> {
  try {
    let query = supabase
      .from("products")
      .select("*, images:product_images(*), variants:product_variants(*, inventory(*)), brand:brands(*), category:categories(id, name, slug)")
      .eq("status", "active")
      .eq("is_active", true)
      .limit(Math.min(limit, HARD_CAP));
    if (ctx.categoryId) query = query.eq("category_id", ctx.categoryId);
    if (ctx.brandId) query = query.eq("brand_id", ctx.brandId);
    if (ctx.gender) query = query.eq("gender", ctx.gender);
    query = query.order("total_sales", { ascending: false });
    const { data, error } = await query;
    if (error) return [];
    return mapProducts(data as any[]);
  } catch {
    return [];
  }
}

/**
 * Personalized candidate puller. Splits the pool between the user's
 * top affinity categories and the general top-sellers. Falls back to
 * `pullCandidates` when the user has no signal (no events yet) or the
 * server RPC fails.
 */
async function pullCandidatesForUser(
  userId: string | null | undefined,
  limit: number = CANDIDATE_POOL,
  ctx: RailContext = {},
): Promise<Product[]> {
  if (!userId) return pullCandidates(limit, ctx);
  const personalized = await pullPersonalizedCandidates(userId, limit, ctx);
  if (personalized.length > 0) return personalized;
  return pullCandidates(limit, ctx);
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

export interface ForYouResult {
  products: Product[];
  hasSignal: boolean;
  /** When the underlying result was last computed. */
  computedAt: number;
}

export async function getForYouRail(
  userId: string | null | undefined,
  limit: number = 12,
  ctx: RailContext = {},
  options: { skipCache?: boolean } = {},
): Promise<Result<ForYouResult>> {
  const key = makeKey("foryou", userId ?? "guest", limit, ctx.categoryId ?? "", ctx.brandId ?? "", ctx.gender ?? "");
  if (!options.skipCache) {
    const cached = cacheGet<Result<ForYouResult>>(key);
    if (cached) return cached;
  }
  try {
    const profile = await loadProfile(userId);
    if (!profile.hasSignal) {
      const cold = await fetchColdStartProducts(limit);
      if (!cold.ok) return cold;
      const result: ForYouResult = {
        products: cold.data,
        hasSignal: false,
        computedAt: Date.now(),
      };
      const wrapped: Result<ForYouResult> = ok(result);
      cacheSet(key, wrapped, TTL_FOR_YOU);
      return wrapped;
    }
    const candidates = await pullCandidatesForUser(userId, CANDIDATE_POOL, ctx);
    if (candidates.length === 0) {
      const cold = await fetchColdStartProducts(limit);
      if (!cold.ok) return cold;
      const result: ForYouResult = { products: cold.data, hasSignal: true, computedAt: Date.now() };
      const wrapped: Result<ForYouResult> = ok(result);
      cacheSet(key, wrapped, TTL_FOR_YOU);
      return wrapped;
    }
    const ranked = rankProducts(candidates, profile, {
      limit,
      excludeIds: profile.recentProductIds.slice(0, 4),
    });
    const result: ForYouResult = {
      products: ranked.map((r) => r.product),
      hasSignal: true,
      computedAt: Date.now(),
    };
    const wrapped: Result<ForYouResult> = ok(result);
    cacheSet(key, wrapped, TTL_FOR_YOU);
    return wrapped;
  } catch (e: any) {
    return fail(e?.message ?? "Failed to load For you rail");
  }
}

/** Force-refresh the For You rail (e.g. after a dismiss). */
export async function refreshForYouRail(
  userId: string | null | undefined,
  limit: number = 12,
  ctx: RailContext = {},
): Promise<Result<ForYouResult>> {
  cacheBustPrefix("foryou");
  return getForYouRail(userId, limit, ctx, { skipCache: true });
}

export async function getSimilarProducts(
  product: Product,
  limit: number = 8,
  options: { skipCache?: boolean } = {},
): Promise<Result<Product[]>> {
  const key = makeKey("similar", product.id, limit);
  if (!options.skipCache) {
    const cached = cacheGet<Result<Product[]>>(key);
    if (cached) return cached;
  }
  try {
    const candidates = await pullCandidates(40, { categoryId: product.category_id });
    const pool = candidates.length > 0 ? candidates : await pullCandidates(40);
    if (pool.length === 0) {
      const cold = await fetchColdStartSimilar(product.category_id, product.brand_id, limit);
      if (cold.ok) cacheSet(key, cold, TTL_SIMILAR);
      return cold;
    }
    const ranked = rankSimilarTo(pool, product, { limit });
    if (ranked.length >= Math.min(limit, 3)) {
      const out: Result<Product[]> = ok(ranked.map((r) => r.product));
      cacheSet(key, out, TTL_SIMILAR);
      return out;
    }
    const cold = await fetchColdStartSimilar(product.category_id, product.brand_id, limit);
    if (!cold.ok) {
      const out: Result<Product[]> = ok(ranked.map((r) => r.product));
      cacheSet(key, out, TTL_SIMILAR);
      return out;
    }
    const seen = new Set([...ranked.map((r) => r.product.id), product.id]);
    const topUp = cold.data.filter((p) => !seen.has(p.id));
    const merged = [...ranked.map((r) => r.product), ...topUp].slice(0, limit);
    const out: Result<Product[]> = ok(merged);
    cacheSet(key, out, TTL_SIMILAR);
    return out;
  } catch (e: any) {
    return fail(e?.message ?? "Failed to load similar products");
  }
}

export async function getYouMayAlsoLike(
  userId: string | null | undefined,
  product: Product,
  limit: number = 8,
): Promise<Result<Product[]>> {
  const key = makeKey("ymal", userId ?? "guest", product.id, limit);
  const cached = cacheGet<Result<Product[]>>(key);
  if (cached) return cached;
  try {
    const profile = await loadProfile(userId);
    if (!profile.hasSignal) {
      return getSimilarProducts(product, limit);
    }
    const candidates = await pullCandidatesForUser(userId, CANDIDATE_POOL);
    if (candidates.length === 0) return getSimilarProducts(product, limit);
    const ranked = rankProducts(candidates, profile, {
      limit,
      excludeIds: [product.id, ...profile.recentProductIds.slice(0, 6)],
      anchorProduct: product,
    });
    if (ranked.length >= 4) {
      const out: Result<Product[]> = ok(ranked.map((r) => r.product));
      cacheSet(key, out, TTL_SIMILAR);
      return out;
    }
    const similar = await getSimilarProducts(product, limit);
    if (!similar.ok) {
      const out: Result<Product[]> = ok(ranked.map((r) => r.product));
      cacheSet(key, out, TTL_SIMILAR);
      return out;
    }
    const seen = new Set([...ranked.map((r) => r.product.id), product.id]);
    const topUp = similar.data.filter((p) => !seen.has(p.id));
    const out: Result<Product[]> = ok([...ranked.map((r) => r.product), ...topUp].slice(0, limit));
    cacheSet(key, out, TTL_SIMILAR);
    return out;
  } catch (e: any) {
    return fail(e?.message ?? "Failed to load You may also like");
  }
}

export async function getPairsWellWithRail(
  userId: string | null | undefined,
  product: Product,
  limit: number = 6,
): Promise<Result<Product[]>> {
  const key = makeKey("pairs", userId ?? "guest", product.id, limit);
  const cached = cacheGet<Result<Product[]>>(key);
  if (cached) return cached;
  const res = await getPairsWellWith(userId, product, limit);
  if (res.ok) cacheSet(key, res, TTL_SIMILAR);
  return res;
}

export async function getRecentlyViewedRail(
  userId: string | null | undefined,
  limit: number = 8,
  excludeIds: string[] = [],
): Promise<Result<Product[]>> {
  const key = makeKey("recent", userId ?? "guest", limit, ...excludeIds);
  const cached = cacheGet<Result<Product[]>>(key);
  if (cached) return cached;
  const res = await fetchRecentlyViewed(userId, limit, excludeIds);
  if (res.ok) cacheSet(key, res, TTL_SIMILAR);
  return res;
}

/**
 * "From your wishlist" rail — pairs the user's wishlist items with a
 * personalized "you might also like these" companion set.
 */
export interface WishlistRail {
  wishlist: Product[];
  companions: Product[];
}

export async function getFromWishlistRail(
  userId: string | null | undefined,
  wishlistIds: string[],
  limit: number = 6,
): Promise<Result<WishlistRail>> {
  const key = makeKey("wish", userId ?? "guest", limit, wishlistIds.join("|"));
  const cached = cacheGet<Result<WishlistRail>>(key);
  if (cached) return cached;
  try {
    if (wishlistIds.length === 0) {
      const out: Result<WishlistRail> = ok({ wishlist: [], companions: [] });
      cacheSet(key, out, TTL_FOR_YOU);
      return out;
    }
    const { data, error } = await supabase
      .from("products")
      .select("*, images:product_images(*), variants:product_variants(*, inventory(*)), brand:brands(*)")
      .eq("status", "active")
      .eq("is_active", true)
      .in("id", wishlistIds);
    if (error) return fail(error.message);
    const products = mapProducts(data as any[]).filter(isProductInStock);
    const byId = new Map(products.map((p) => [p.id, p]));
    const wishlist = wishlistIds
      .map((id) => byId.get(id))
      .filter((p): p is Product => Boolean(p));

    // Companions: personalized recs excluding wishlist items.
    const profile = await loadProfile(userId);
    let companions: Product[] = [];
    if (profile.hasSignal) {
      const candidates = await pullCandidatesForUser(userId, CANDIDATE_POOL);
      const ranked = rankProducts(candidates, profile, {
        limit,
        excludeIds: wishlistIds,
      });
      companions = ranked.map((r) => r.product);
    } else {
      const cold = await fetchColdStartProducts(limit);
      if (cold.ok) companions = cold.data.filter((p) => !wishlistIds.includes(p.id));
    }
    const out: Result<WishlistRail> = ok({ wishlist, companions });
    cacheSet(key, out, TTL_FOR_YOU);
    return out;
  } catch (e: any) {
    return fail(e?.message ?? "Failed to load wishlist rail");
  }
}

/** Re-rank search results against the user profile. */
export async function getPersonalizedSearch(
  userId: string | null | undefined,
  results: Product[],
  limit?: number,
): Promise<Result<Product[]>> {
  const key = makeKey("search", userId ?? "guest", limit ?? 0, results.length);
  const cached = cacheGet<Result<Product[]>>(key);
  if (cached) return cached;
  try {
    const profile = await loadProfile(userId);
    const reranked = personalizeResults(results, profile, { limit });
    const out: Result<Product[]> = ok(reranked);
    cacheSet(key, out, 30_000);
    return out;
  } catch (e: any) {
    return fail(e?.message ?? "Failed to personalize search");
  }
}

export async function getFallbackRecs(
  userId: string | null | undefined,
  limit: number = 8,
  ctx: RailContext = {},
): Promise<Result<ForYouResult>> {
  return getForYouRail(userId, limit, ctx);
}

/** Expose the ranker for advanced callers. */
export async function debugRankSample(
  userId: string | null | undefined,
  sample: Product[],
  limit: number = 8,
): Promise<{ profile: UserProfile; ranked: RankedProduct[] }> {
  const profile = await loadProfile(userId);
  const ranked = rankProducts(sample, profile, { limit });
  return { profile, ranked };
}

/** Convenience: pull current wishlist ids directly from the zustand store. */
export function getCurrentWishlistIds(): string[] {
  try {
    const items = useWishlist.getState().items;
    return Object.keys(items);
  } catch {
    return [];
  }
}
