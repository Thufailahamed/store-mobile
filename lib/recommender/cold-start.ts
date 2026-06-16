/**
 * Cold-start fallback for new users.
 *
 * When the user has too few events to personalize, surface a high-quality mix
 * of featured + trending + popular products. The goal is to make a strong
 * first impression while we collect signal.
 */

import { supabase } from "@/lib/supabase/client";
import { mapProducts } from "@/lib/api/product-mapper";
import { PRODUCT_CARD_SELECT } from "@/lib/api/product-queries";
import type { Product } from "@/lib/types";
import type { Result } from "@/lib/api";

const ok = <T>(data: T): Result<T> => ({ ok: true, data });

/** Pull a curated mix: featured + top-rated + recent. */
export async function fetchColdStartProducts(limit = 12): Promise<Result<Product[]>> {
  try {
    const [featuredRes, topRatedRes, recentRes] = await Promise.all([
      supabase
        .from("products")
        .select(PRODUCT_CARD_SELECT)
        .eq("status", "active")
        .eq("is_active", true)
        .eq("is_featured", true)
        .order("total_sales", { ascending: false })
        .limit(limit),
      supabase
        .from("products")
        .select(PRODUCT_CARD_SELECT)
        .eq("status", "active")
        .eq("is_active", true)
        .order("rating", { ascending: false })
        .limit(limit),
      supabase
        .from("products")
        .select(PRODUCT_CARD_SELECT)
        .eq("status", "active")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(limit),
    ]);

    const seen = new Set<string>();
    const merged: Product[] = [];
    for (const list of [featuredRes.data, topRatedRes.data, recentRes.data] as any[][]) {
      for (const row of list ?? []) {
        const p = mapProducts([row])[0];
        if (!p || seen.has(p.id)) continue;
        seen.add(p.id);
        merged.push(p);
        if (merged.length >= limit) break;
      }
      if (merged.length >= limit) break;
    }

    return ok(merged);
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
    let query = supabase
      .from("products")
      .select("*, images:product_images(*), variants:product_variants(*, inventory(*)), brand:brands(*)")
      .eq("status", "active")
      .eq("is_active", true)
      .order("total_sales", { ascending: false })
      .limit(limit);
    if (categoryId) query = query.eq("category_id", categoryId);
    const { data, error } = await query;
    if (error) return { ok: false, error: error.message };
    const products = mapProducts(data as any[]);
    // If we have a brand, mix in some same-brand products for variety.
    if (brandId) {
      const sameBrand = products.filter((p) => p.brand_id === brandId);
      if (sameBrand.length >= 2) {
        const others = products.filter((p) => p.brand_id !== brandId);
        return ok([...sameBrand.slice(0, 3), ...others].slice(0, limit));
      }
    }
    return ok(products);
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Failed to fetch similar products" };
  }
}
