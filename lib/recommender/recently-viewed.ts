/**
 * Recently viewed module.
 *
 * Wraps the existing `recordRecentlyViewed` + `getRecentlyViewedIds` helpers
 * with a higher-level API that hydrates product ids into full Product rows
 * and ranks them. Used by the home page and product page.
 */

import { supabase } from "@/lib/supabase/client";
import { mapProducts } from "@/lib/api/product-mapper";
import { PRODUCT_CARD_SELECT } from "@/lib/api/product-queries";
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

    const { data, error } = await supabase
      .from("products")
      .select(PRODUCT_CARD_SELECT)
      .eq("status", "active")
      .eq("is_active", true)
      .in("id", ids);

    if (error) return fail(error.message);
    const products = mapProducts(data as any[]);
    // Preserve recency order — `in` doesn't guarantee the input order.
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
