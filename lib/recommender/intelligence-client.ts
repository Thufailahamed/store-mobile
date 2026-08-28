/**
 * Mobile client for the recommendation intelligence facade (0260).
 *
 * Mirrors web's `intelligence-client.ts`. Used by surfaces that want
 * the new personalized payloads (homepage, product, category, cart,
 * cold_start, trending, similar). Each helper returns Result<T> so
 * callers fall back gracefully to the legacy engine/cold-start.
 */

import { fetchJson, hasStoreApi } from "@/lib/api/_fetch";
import type { Product } from "@/lib/types";

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const ok = <T,>(data: T): Result<T> => ({ ok: true, data });
const fail = (e: string): Result<never> => ({ ok: false, error: e });

export type RecommendationContext =
  | "homepage"
  | "product"
  | "category"
  | "collection"
  | "store"
  | "cart"
  | "cold_start";

export interface FetchRecommendationsOptions {
  context: RecommendationContext;
  product_id?: string;
  category_id?: string;
  collection_id?: string;
  store_id?: string;
  limit?: number;
}

export interface FetchRecommendationsResponse {
  products: Product[];
  sources?: Record<string, number>;
  cached?: boolean;
}

export async function fetchRecommendations(
  options: FetchRecommendationsOptions,
): Promise<Result<FetchRecommendationsResponse>> {
  if (!hasStoreApi()) return fail("api_base_unset");
  const params: Record<string, string> = { context: options.context };
  if (options.product_id) params.product_id = options.product_id;
  if (options.category_id) params.category_id = options.category_id;
  if (options.collection_id) params.collection_id = options.collection_id;
  if (options.store_id) params.store_id = options.store_id;
  params.limit = String(Math.min(options.limit ?? 12, 60));
  const res = await fetchJson<FetchRecommendationsResponse>("/api/recommendations", { query: params });
  if (!res.ok) return fail((res as { ok: false; error: string }).error);
  return ok(res.data);
}

export interface FetchTrendingOptions {
  limit?: number;
  surface?: string;
}

export async function fetchTrending(
  options: FetchTrendingOptions = {},
): Promise<Result<{ products: Product[]; sources?: Record<string, number> }>> {
  if (!hasStoreApi()) return fail("api_base_unset");
  const params: Record<string, string> = { limit: String(Math.min(options.limit ?? 12, 60)) };
  if (options.surface) params.surface = options.surface;
  const res = await fetchJson<{ products: Product[]; sources?: Record<string, number> }>(
    "/api/recommender/trending",
    { query: params },
  );
  if (!res.ok) return fail((res as { ok: false; error: string }).error);
  return ok(res.data);
}

export async function fetchSimilarById(
  productId: string,
  limit = 12,
): Promise<Result<{ products: Product[] }>> {
  if (!hasStoreApi()) return fail("api_base_unset");
  const res = await fetchJson<{ products: Product[] }>("/api/recommender/similar", {
    query: { product_id: productId, limit: String(Math.min(limit, 50)) },
  });
  if (!res.ok) return fail((res as { ok: false; error: string }).error);
  return ok(res.data);
}