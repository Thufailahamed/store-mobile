import { supabase } from "@/lib/supabase/client";
import { mapProducts } from "./product-mapper";
import type { Product } from "@/lib/types";

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };
const ok = <T>(data: T): Result<T> => ({ ok: true, data });
const fail = (e: string): Result<never> => ({ ok: false, error: e });

const GENDER_SLUGS = new Set(["men", "women", "kids", "unisex"]);

/** Lightweight select for product cards on home, rails, and rec lists. */
export const PRODUCT_CARD_SELECT =
  "id, name, slug, price, mrp, currency, discount_pct, rating, total_reviews, total_sales, status, is_active, gender, material, created_at, category_id, brand_id, store_id, tags, " +
  "images:product_images(url, is_primary, position), " +
  "store:stores!products_store_id_fkey(name, logo_url, slug), " +
  "brand:brands(name, logo_url, slug), " +
  "category:categories(id, name, slug)";

export type ProductCardSort = "newest" | "rating" | "sale" | "price_asc" | "price_desc" | "popular";

export async function getProductCards(opts: {
  limit?: number;
  offset?: number;
  sort?: ProductCardSort;
  categorySlug?: string;
  brandSlug?: string;
  storeSlug?: string;
  gender?: string;
  featuredOnly?: boolean;
} = {}): Promise<Result<Product[]>> {
  const {
    limit = 20,
    offset = 0,
    sort = "newest",
    categorySlug,
    brandSlug,
    storeSlug,
    gender,
    featuredOnly,
  } = opts;

  try {
    let query = supabase
      .from("products")
      .select(PRODUCT_CARD_SELECT)
      .eq("status", "active")
      .eq("is_active", true);

    if (featuredOnly) query = query.eq("is_featured", true);

    if (categorySlug && GENDER_SLUGS.has(categorySlug)) {
      query = query.eq("gender", categorySlug);
    } else if (categorySlug) {
      const { data: cat, error: catError } = await supabase
        .from("categories")
        .select("id")
        .eq("slug", categorySlug)
        .maybeSingle();
      if (catError) return fail(catError.message);
      if (cat) query = query.eq("category_id", cat.id);
      else return ok([]);
    }

    if (brandSlug) {
      const { data: brand, error: brandError } = await supabase
        .from("brands")
        .select("id")
        .eq("slug", brandSlug)
        .eq("status", "approved")
        .maybeSingle();
      if (brandError) return fail(brandError.message);
      if (brand) query = query.eq("brand_id", brand.id);
      else return ok([]);
    }

    if (storeSlug) {
      const { data: store, error: storeError } = await supabase
        .from("stores")
        .select("id")
        .eq("slug", storeSlug)
        .in("status", ["approved", "pending"])
        .maybeSingle();
      if (storeError) return fail(storeError.message);
      if (store) query = query.eq("store_id", store.id);
      else return ok([]);
    }

    if (gender) query = query.eq("gender", gender);

    switch (sort) {
      case "rating":
        query = query.order("rating", { ascending: false });
        break;
      case "sale":
        query = query.order("discount_pct", { ascending: false });
        break;
      case "price_asc":
        query = query.order("price", { ascending: true });
        break;
      case "price_desc":
        query = query.order("price", { ascending: false });
        break;
      case "popular":
        query = query.order("total_sales", { ascending: false });
        break;
      default:
        query = query.order("created_at", { ascending: false });
    }

    query = query.range(offset, offset + limit - 1);
    const { data, error } = await query;
    if (error) return fail(error.message);
    return ok(mapProducts((data as Product[]) ?? []));
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch products");
  }
}

export async function getProductCardsByIds(ids: string[]): Promise<Result<Product[]>> {
  if (ids.length === 0) return ok([]);
  try {
    const { data, error } = await supabase
      .from("products")
      .select(PRODUCT_CARD_SELECT)
      .in("id", ids)
      .eq("is_active", true);
    if (error) return fail(error.message);
    return ok(mapProducts((data as Product[]) ?? []));
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch products");
  }
}
