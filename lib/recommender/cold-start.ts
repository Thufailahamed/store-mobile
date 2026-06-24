/**
 * Cold-start fallback for new users.
 *
 * When the user has too few events to personalize, surface a curated
 * mix of featured + top-rated + recent. The backend
 * `/api/recommender/cold-start` route performs the merge server-side
 * (no direct Supabase reads from the device).
 */

import { getColdStartBackend, getCandidatesBackend, getSimilarProductsBackend } from "@/lib/api/backend";
import { mapProducts } from "@/lib/api/product-mapper";
import type { Product } from "@/lib/types";
import type { Result } from "@/lib/api";

const ok = <T>(data: T): Result<T> => ({ ok: true, data });

/** Pull a curated mix: featured + top-rated + recent (server-merged). */
export async function fetchColdStartProducts(limit = 12): Promise<Result<Product[]>> {
  try {
    const res = await getColdStartBackend(limit);
    if (!res.ok) return { ok: false, error: typeof res.error === "string" ? res.error : "Cold-start fetch failed" };
    const products = mapProducts((res.data?.products ?? []) as unknown as Array<Record<string, unknown>>);
    return ok(products.slice(0, limit));
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Failed to fetch cold-start products" };
  }
}

/** Cold-start "you-may-also-like" rail for product pages. */
export async function fetchColdStartSimilar(
  categoryId: string | undefined,
  brandId: string | undefined,
  limit = 8,
): Promise<Result<Product[]>> {
  try {
    // Try the Jaccard-style similar RPC first when we have an anchor.
    if (categoryId) {
      const res = await getCandidatesBackend({ limit, category_id: categoryId });
      if (res.ok) {
        const products = mapProducts((res.data?.products ?? []) as unknown as Array<Record<string, unknown>>);
        return ok(products.slice(0, limit));
      }
    }
    if (brandId && !categoryId) {
      const res = await getCandidatesBackend({ limit, brand_id: brandId });
      if (res.ok) {
        const products = mapProducts((res.data?.products ?? []) as unknown as Array<Record<string, unknown>>);
        return ok(products.slice(0, limit));
      }
    }
    const fallback = await fetchColdStartProducts(limit);
    return fallback;
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Failed to fetch similar products" };
  }
}

/** Helper: similar products for a specific anchor product id (uses /api/recommender/similar). */
export async function fetchSimilarToAnchor(
  productId: string,
  limit = 8,
): Promise<Result<Product[]>> {
  try {
    const idsRes = await getSimilarProductsBackend(productId, limit);
    if (!idsRes.ok) return { ok: false, error: typeof idsRes.error === "string" ? idsRes.error : "Similar fetch failed" };
    const ids = (idsRes.data?.results ?? []).map((r) => r.product_id).filter(Boolean);
    if (ids.length === 0) return ok([]);
    // Hydrate via the candidates endpoint (full product shape with images/variants).
    const cand = await getCandidatesBackend({ limit: ids.length });
    if (!cand.ok) return { ok: false, error: typeof cand.error === "string" ? cand.error : "Hydration failed" };
    const rows = (cand.data?.products ?? []).filter((p) => ids.includes(p.id));
    const products = mapProducts(rows as unknown as Array<Record<string, unknown>>);
    // Preserve the similarity ranking.
    const ordered = ids
      .map((id) => products.find((p) => p.id === id))
      .filter((p): p is Product => Boolean(p));
    return ok(ordered);
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Failed to fetch similar products" };
  }
}