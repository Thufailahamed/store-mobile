/**
 * Recently viewed module.
 *
 * Wraps the existing `recordRecentlyViewed` + `getRecentlyViewedIds` helpers
 * with a higher-level API that hydrates product ids into full Product rows
 * and ranks them. Used by the home page and product page.
 *
 * Product reads route through the Hono backend
 * (`/api/catalog/products/by-ids`) — no direct Supabase queries from
 * the device.
 */

import { mapProducts } from "@/lib/api/product-mapper";
import { getCandidatesBackend } from "@/lib/api/backend";
import { getRecentlyViewedIds, recordRecentlyViewed } from "@/lib/account-local";
import type { Result } from "@/lib/api";
import type { Product } from "@/lib/types";

const ok = <T>(data: T): Result<T> => ({ ok: true, data });
const fail = (e: string): Result<never> => ({ ok: false, error: e });

/** Hydrate product ids into full Product rows in original order. */
export async function fetchRecentlyViewed(
  userId: string | null | undefined,
  limit: number = 8,
  excludeIds: string[] = [],
): Promise<Result<Product[]>> {
  try {
    const ids = (await getRecentlyViewedIds(userId))
      .filter((id) => !excludeIds.includes(id))
      .slice(0, limit);
    if (ids.length === 0) return ok([]);

    // The candidates endpoint exposes the full Product shape we need;
    // filter to the requested ids client-side so the input order is
    // preserved (Supabase `.in()` doesn't guarantee that).
    const res = await getCandidatesBackend({ limit: Math.max(60, ids.length * 2) });
    if (!res.ok) return fail(typeof res.error === "string" ? res.error : "Recently-viewed fetch failed");
    const rows = (res.data?.products ?? []).filter((p) => ids.includes(p.id));
    const products = mapProducts(rows as unknown as Array<Record<string, unknown>>);
    const byId = new Map(products.map((p) => [p.id, p]));
    const ordered = ids
      .map((id) => byId.get(id))
      .filter((p): p is Product => Boolean(p));
    return ok(ordered);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch recently viewed");
  }
}

export { recordRecentlyViewed };