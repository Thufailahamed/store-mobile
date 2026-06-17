import { supabase } from "@/lib/supabase/client";
import {
  mapProduct,
  mapProducts,
  mapStore,
  mapBrand,
  mapCategory,
  mapBanner,
} from "@/lib/api/product-mapper";
import { getProductCards, getProductCardsByIds } from "@/lib/api/product-queries";
import {
  tokenizeQuery,
  buildSearchOrParts,
  expandColorTerms,
  fuzzyMatch,
  scoreProduct,
} from "@/lib/utils/search-utils";
import type {
  Product, ProductVariant, ProductImage, Brand, Store, Category,
  Review, Order, OrderItem, Address, Banner, Notification, User,
  Testimonial, Tenet, HeroMeta, ApprovalStatus, HomepageSection,
} from "@/lib/types";

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };
const ok = <T>(data: T): Result<T> => ({ ok: true, data });
const fail = (e: string): Result<never> => ({ ok: false, error: e });

export { mapProduct, mapProducts, mapStore, mapBrand } from "./product-mapper";
export {
  PRODUCT_CARD_SELECT,
  getProductCards,
  getProductCardsByIds,
  type ProductCardSort,
} from "./product-queries";

const GENDER_SLUGS = new Set(["men", "women", "kids", "unisex"]);

export async function getProducts(opts: {
  limit?: number;
  offset?: number;
  sort?: "newest" | "rating" | "sale" | "price_asc" | "price_desc";
  categorySlug?: string;
  brandSlug?: string;
  storeSlug?: string;
  gender?: string;
  search?: string;
} = {}): Promise<Result<{ products: Product[]; total: number }>> {
  const { limit = 20, offset = 0, sort = "newest", categorySlug, brandSlug, storeSlug, gender, search } = opts;

  try {
    let query = supabase
      .from("products")
      .select("*, images:product_images(*), variants:product_variants(*, inventory(*)), brand:brands(*), store:stores!products_store_id_fkey(*), category:categories(*)", { count: "exact" })
      .eq("status", "active")
      .eq("is_active", true);

    if (categorySlug && GENDER_SLUGS.has(categorySlug)) {
      query = query.eq("gender", categorySlug);
    } else if (categorySlug) {
      const { data: cat, error: catError } = await supabase
        .from("categories")
        .select("id")
        .eq("slug", categorySlug)
        .maybeSingle();
      if (catError) return fail(catError.message);
      if (cat) {
        query = query.eq("category_id", cat.id);
      } else {
        return ok({ products: [], total: 0 });
      }
    }
    if (brandSlug) {
      const { data: brand, error: brandError } = await supabase
        .from("brands")
        .select("id")
        .eq("slug", brandSlug)
        .eq("status", "approved")
        .maybeSingle();
      if (brandError) return fail(brandError.message);
      if (brand) {
        query = query.eq("brand_id", brand.id);
      } else {
        return ok({ products: [], total: 0 });
      }
    }
    if (storeSlug) {
      const { data: store, error: storeError } = await supabase
        .from("stores")
        .select("id")
        .eq("slug", storeSlug)
        .in("status", ["approved", "pending"])
        .maybeSingle();
      if (storeError) return fail(storeError.message);
      if (store) {
        query = query.eq("store_id", store.id);
      } else {
        return ok({ products: [], total: 0 });
      }
    }
    if (gender) query = query.eq("gender", gender);
    if (search) query = query.textSearch("name", search, { type: "websearch" });

    switch (sort) {
      case "rating": query = query.order("rating", { ascending: false }); break;
      case "sale": query = query.order("discount_pct", { ascending: false }); break;
      case "price_asc": query = query.order("price", { ascending: true }); break;
      case "price_desc": query = query.order("price", { ascending: false }); break;
      default: query = query.order("created_at", { ascending: false });
    }

    query = query.range(offset, offset + limit - 1);
    const { data, error, count } = await query;
    if (error) return fail(error.message);
    return ok({ products: mapProducts(data as any[]) ?? [], total: count ?? 0 });
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch products");
  }
}

/** Approved brands for the filter sheet's brand chip rail. */
export async function getBrands(opts: { limit?: number; search?: string } = {}): Promise<Result<Brand[]>> {
  const { limit = 200, search } = opts;
  try {
    let query = supabase
      .from("brands")
      .select("*")
      .eq("status", "approved")
      .order("is_featured", { ascending: false })
      .order("name")
      .limit(limit);
    if (search) query = query.ilike("name", `%${search}%`);
    const { data, error } = await query;
    if (error) return fail(error.message);
    return ok((data as Brand[]) ?? []);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch brands");
  }
}

export async function getProductBySlug(slug: string): Promise<Result<Product | null>> {
  try {
    const { data, error } = await supabase
      .from("products")
      .select("*, images:product_images(*), variants:product_variants(*, inventory(*)), brand:brands(*), store:stores!products_store_id_fkey(*), category:categories(*)")
      .eq("slug", slug)
      .single();
    if (error) return fail(error.message);
    return ok(mapProduct(data));
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch product by slug");
  }
}

export async function getRelatedProducts(productId: string, categoryId?: string, limit = 8): Promise<Result<Product[]>> {
  try {
    let query = supabase
      .from("products")
      .select("*, images:product_images(*), variants:product_variants(*, inventory(*))")
      .eq("status", "active")
      .eq("is_active", true)
      .neq("id", productId)
      .limit(limit);
    if (categoryId) query = query.eq("category_id", categoryId);
    const { data, error } = await query;
    if (error) return fail(error.message);
    return ok(mapProducts(data as any[]));
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch related products");
  }
}

export async function getReviews(productId: string, limit = 20): Promise<Result<Review[]>> {
  try {
    const { data, error } = await supabase
      .from("reviews")
      .select("*, user:users(id, full_name, avatar_url)")
      .eq("product_id", productId)
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return fail(error.message);
    return ok((data as Review[]) ?? []);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch reviews");
  }
}

/* ------------------------------------------------------------------ */
/*  Homepage                                                           */
/* ------------------------------------------------------------------ */

export async function getHomepageSections(): Promise<Result<HomepageSection[]>> {
  try {
    const { data, error } = await supabase
      .from("homepage_sections")
      .select("*")
      .eq("enabled", true)
      .order("position");
    if (error) return fail(error.message);
    return ok((data as HomepageSection[]) ?? []);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch homepage sections");
  }
}

export async function getHomepageProductPicks(
  section: import("@/lib/types").HomepageProductSection
): Promise<Result<Product[]>> {
  try {
    const { data: picks, error } = await supabase
      .from("homepage_product_picks")
      .select("product_id, display_order")
      .eq("section", section)
      .order("display_order");
    if (error || !picks?.length) {
      switch (section) {
        case "new_arrivals_rail": {
          const r = await getProductCards({ limit: 12, sort: "newest" });
          return r.ok ? ok(r.data) : fail(r.error);
        }
        case "trending_rail": {
          const r = await getProductCards({ limit: 12, sort: "rating" });
          return r.ok ? ok(r.data) : fail(r.error);
        }
        case "editors_picks_rail": {
          const featured = await getFeaturedProducts(12);
          if (featured.ok && featured.data.length) return ok(featured.data);
          const r = await getProductCards({ limit: 12, sort: "price_desc" });
          return r.ok ? ok(r.data) : fail(r.error);
        }
        case "todays_edit": {
          const offset = (new Date().getDate() % 6) * 2;
          const r = await getProductCards({ limit: 4, offset, sort: "newest" });
          return r.ok ? ok(r.data) : fail(r.error);
        }
        case "parallax_grid": {
          const r = await getProductCards({ limit: 8, sort: "sale" });
          return r.ok ? ok(r.data) : fail(r.error);
        }
        default: {
          const r = await getProductCards({ limit: 12, sort: "newest" });
          return r.ok ? ok(r.data) : fail(r.error);
        }
      }
    }
    const ids = picks.map((p) => p.product_id);
    const cardsRes = await getProductCardsByIds(ids);
    if (!cardsRes.ok) return fail(cardsRes.error);
    const order = new Map(ids.map((id, i) => [id, i]));
    const sorted = cardsRes.data.sort(
      (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
    );
    return ok(sorted);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch homepage product picks");
  }
}

export async function getHomepagePromises(): Promise<Result<import("@/lib/types").HomepagePromise[]>> {
  try {
    const { data, error } = await supabase
      .from("homepage_promises")
      .select("n, title, description, icon")
      .order("display_order");
    if (error) return fail(error.message);
    return ok((data as import("@/lib/types").HomepagePromise[]) ?? []);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch homepage promises");
  }
}

export async function getFeaturedBlogPosts(limit = 3): Promise<Result<import("@/lib/types").BlogPost[]>> {
  try {
    const { data, error } = await supabase
      .from("blog_posts")
      .select("id, title, slug, excerpt, cover_image, published_at")
      .eq("is_published", true)
      .eq("is_featured_on_home", true)
      .order("homepage_order")
      .limit(limit);
    if (error) return fail(error.message);
    return ok((data as import("@/lib/types").BlogPost[]) ?? []);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch featured blog posts");
  }
}

export async function getFeaturedProducts(limit = 12): Promise<Result<Product[]>> {
  return getProductCards({ limit, featuredOnly: true, sort: "popular" });
}

export async function getFeaturedBrands(limit = 6): Promise<Result<Brand[]>> {
  try {
    const { data, error } = await supabase
      .from("brands")
      .select("*")
      .eq("status", "approved")
      .eq("is_featured", true)
      .order("homepage_order")
      .limit(limit);
    if (error) return fail(error.message);
    return ok((data as Brand[]) ?? []);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch featured brands");
  }
}

export async function getFeaturedStores(limit = 6): Promise<Result<Store[]>> {
  try {
    const { data, error } = await supabase
      .from("stores")
      .select("*")
      .eq("status", "approved")
      .eq("is_featured", true)
      .order("homepage_order")
      .limit(limit);
    if (error) return fail(error.message);
    const stores = ((data as Store[]) ?? []).map((s) => mapStore(s));
    return ok(stores);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch featured stores");
  }
}

export async function getStores(opts: {
  search?: string;
  sort?: "popular" | "newest" | "rating";
  limit?: number;
  offset?: number;
} = {}): Promise<Result<{ stores: Store[]; total: number }>> {
  const { search, sort = "popular", limit = 30, offset = 0 } = opts;
  try {
    let query = supabase
      .from("stores")
      .select("*", { count: "exact" })
      .eq("status", "approved");
    if (search) query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    switch (sort) {
      case "newest":
        query = query.order("created_at", { ascending: false });
        break;
      case "rating":
        query = query.order("rating", { ascending: false });
        break;
      default:
        query = query
          .order("is_featured", { ascending: false })
          .order("total_sales", { ascending: false });
    }
    query = query.range(offset, offset + limit - 1);
    const { data, error, count } = await query;
    if (error) return fail(error.message);
    return ok({
      stores: ((data as Store[]) ?? []).map((s) => mapStore(s)),
      total: count ?? 0,
    });
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch stores");
  }
}

export async function getCategories(limit = 20): Promise<Result<Category[]>> {
  try {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .eq("is_active", true)
      .order("position")
      .limit(limit);
    if (error) return fail(error.message);
    const categories = ((data as Category[]) ?? []).map(mapCategory);
    return ok(categories);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch categories");
  }
}

export async function getAllCategories(): Promise<Result<Category[]>> {
  try {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .eq("is_active", true)
      .order("position")
      .limit(200);
    if (error) return fail(error.message);
    const categories = ((data as Category[]) ?? []).map(mapCategory);
    return ok(categories);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch categories");
  }
}

export async function getBanners(position?: string): Promise<Result<Banner[]>> {
  try {
    let query = supabase
      .from("banners")
      .select("*")
      .eq("is_active", true)
      .order("display_order");
    if (position) query = query.eq("position", position);
    const { data, error } = await query;
    if (error) return fail(error.message);
    const banners = ((data as Banner[]) ?? []).map(mapBanner);
    return ok(banners);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch banners");
  }
}

export type OnboardingSlide = {
  title: string;
  description: string;
  imageUrl: string;
};

export async function getOnboardingSlides(): Promise<Result<OnboardingSlide[]>> {
  const positions = ["mobile_onboarding", "home_hero"];
  for (const position of positions) {
    const res = await getBanners(position);
    if (res.ok && res.data.length > 0) {
      return ok(
        res.data.slice(0, 3).map((b) => ({
          title: b.title,
          description: b.subtitle ?? "",
          imageUrl: b.image_url,
        }))
      );
    }
  }
  return ok([]);
}

export async function getTestimonials(limit = 6): Promise<Result<Testimonial[]>> {
  try {
    const { data, error } = await supabase
      .from("testimonials")
      .select("id, body, name, place, piece, accent, display_order")
      .eq("is_published", true)
      .order("display_order")
      .limit(limit);
    if (error) return fail(error.message);
    return ok((data as Testimonial[]) ?? []);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch testimonials");
  }
}

export async function getTenets(limit = 6): Promise<Result<Tenet[]>> {
  try {
    const { data, error } = await supabase
      .from("tenets")
      .select("id, n, title, body, tag, display_order")
      .order("display_order")
      .limit(limit);
    if (error) return fail(error.message);
    return ok((data as Tenet[]) ?? []);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch tenets");
  }
}

export async function getHeroMeta(): Promise<Result<HeroMeta | null>> {
  try {
    const { data, error } = await supabase
      .from("homepage_hero_meta")
      .select("*")
      .eq("id", "default")
      .maybeSingle();
    if (error) return fail(error.message);
    return ok((data as HeroMeta) ?? null);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch hero meta");
  }
}

export async function getFlashSaleProducts(limit = 5): Promise<Result<Product[]>> {
  const r = await getProductCards({ limit, sort: "sale" });
  if (!r.ok) return r;
  const items = (r.data ?? []).filter((p) => (p.discount_pct ?? 0) > 0);
  return ok(items.length ? items.slice(0, limit) : r.data.slice(0, limit));
}

export async function getFlashSaleEndsAt(): Promise<string> {
  try {
    const { data, error } = await supabase
      .from("homepage_flash_sale")
      .select("ends_at")
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error || !data?.ends_at) {
      return new Date(Date.now() + 6 * 3600_000).toISOString();
    }
    return data.ends_at as string;
  } catch {
    return new Date(Date.now() + 6 * 3600_000).toISOString();
  }
}

export async function searchProducts(query: string, limit = 20): Promise<Result<Product[]>> {
  try {
    const term = query.trim();
    const words = tokenizeQuery(term);
    if (words.length === 0) return ok([]);

    // --- Step 1: enhanced ILIKE query across product-level fields ---
    const orParts = buildSearchOrParts(term);
    const { data: productData, error: productError } = await supabase
      .from("products")
      .select("*, images:product_images(*), variants:product_variants(*, inventory(*)), brand:brands(*), store:stores!products_store_id_fkey(*), category:categories(*)")
      .eq("status", "active")
      .eq("is_active", true)
      .or(orParts.join(","));

    if (productError) {
      return fail(productError.message);
    }
    
    const productResults = mapProducts(productData as any[]) ?? [];
    const resultIds = new Set(productResults.map((p) => p.id));

    // --- Step 2: find products with matching variant colors ---
    const colorTerms = new Set<string>();
    for (const word of words) {
      for (const variantVal of expandColorTerms(word)) {
        colorTerms.add(variantVal);
      }
    }
    if (colorTerms.size > 0) {
      const colorOrParts = [...colorTerms].map(
        (c) => `color.ilike.%${c}%`
      );
      const { data: colorData } = await supabase
        .from("product_variants")
        .select("product_id")
        .eq("is_active", true)
        .or(colorOrParts.join(","));
      
      const variantProductIds = [
        ...new Set((colorData as { product_id: string }[] | null ?? []).map((r) => r.product_id)),
      ].filter((id) => !resultIds.has(id));

      if (variantProductIds.length > 0) {
        const { data: extraData } = await supabase
          .from("products")
          .select("*, images:product_images(*), variants:product_variants(*, inventory(*)), brand:brands(*), store:stores!products_store_id_fkey(*), category:categories(*)")
          .eq("status", "active")
          .eq("is_active", true)
          .in("id", variantProductIds);
        
        for (const p of (mapProducts(extraData as any[]) ?? [])) {
          if (!resultIds.has(p.id)) {
            productResults.push(p);
            resultIds.add(p.id);
          }
        }
      }
    }

    // --- Step 3: fuzzy fallback if few results ---
    if (productResults.length < 3 && term.length >= 3) {
      const lowerTerm = term.toLowerCase();
      const { data: allData } = await supabase
        .from("products")
        .select("*, images:product_images(*), variants:product_variants(*, inventory(*)), brand:brands(*), store:stores!products_store_id_fkey(*), category:categories(*)")
        .eq("status", "active")
        .eq("is_active", true);
      
      const allProducts = mapProducts(allData as any[]) ?? [];
      const fuzzyHits = allProducts.filter((p) => {
        const name = (p.name ?? "").toLowerCase();
        const desc = (p.description ?? "").toLowerCase();
        const short = (p.short_description ?? "").toLowerCase();
        return (
          fuzzyMatch(name, lowerTerm, 2) ||
          fuzzyMatch(desc, lowerTerm, 2) ||
          fuzzyMatch(short, lowerTerm, 2)
        );
      });
      for (const hit of fuzzyHits) {
        if (!resultIds.has(hit.id)) {
          productResults.push(hit);
          resultIds.add(hit.id);
        }
      }
    }

    // --- Step 4: score and rank ---
    const scored = productResults.map((p) => ({
      product: p,
      score: scoreProduct(p, words, term.toLowerCase()),
    }));

    const finalResults = scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((s) => s.product)
      .slice(0, limit);

    return ok(finalResults);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to search products");
  }
}

export type SearchSuggestion = {
  id: string;
  label: string;
  type: "product" | "brand" | "category" | "store" | "recent" | "trending";
  slug?: string;
  count?: number;
  logo_url?: string;
  followers?: number;
  is_verified?: boolean;
};

export async function getSearchSuggestions(query: string): Promise<Result<SearchSuggestion[]>> {
  const term = query.trim();
  if (term.length < 2) return ok([]);

  try {
    const [productsRes, brandsRes, categoriesRes, storesRes] = await Promise.all([
      supabase
        .from("products")
        .select("id, name, slug")
        .eq("status", "active")
        .eq("is_active", true)
        .ilike("name", `%${term}%`)
        .limit(5),
      supabase
        .from("brands")
        .select("id, name, slug, logo_url, total_followers, is_featured")
        .eq("status", "approved")
        .ilike("name", `%${term}%`)
        .limit(3),
      supabase
        .from("categories")
        .select("id, name, slug")
        .eq("is_active", true)
        .ilike("name", `%${term}%`)
        .limit(3),
      supabase
        .from("stores")
        .select("id, name, slug, logo_url, total_followers, is_featured")
        .eq("status", "approved")
        .ilike("name", `%${term}%`)
        .limit(3),
    ]);

    const suggestions: SearchSuggestion[] = [];

    const productData = productsRes.data ?? [];
    const productCounts = await Promise.all(
      productData.map(async (p) => {
        try {
          const { count } = await supabase
            .from("products")
            .select("id", { count: "exact", head: true })
            .eq("status", "active")
            .eq("is_active", true)
            .ilike("name", `%${p.name}%`);
          return count ?? 1;
        } catch {
          return 1;
        }
      })
    );

    const categoryData = categoriesRes.data ?? [];
    const categoryCounts = await Promise.all(
      categoryData.map(async (c) => {
        try {
          const { count } = await supabase
            .from("products")
            .select("id", { count: "exact", head: true })
            .eq("status", "active")
            .eq("is_active", true)
            .eq("category_id", c.id);
          return count ?? 0;
        } catch {
          return 0;
        }
      })
    );

    for (let i = 0; i < productData.length; i++) {
      const p = productData[i];
      suggestions.push({
        id: `p-${p.id}`,
        label: p.name,
        type: "product",
        slug: p.slug,
        count: productCounts[i],
      });
    }

    for (const b of brandsRes.data ?? []) {
      suggestions.push({
        id: `b-${b.id}`,
        label: b.name,
        type: "brand",
        slug: b.slug,
        logo_url: b.logo_url ?? undefined,
        followers: b.total_followers ?? 0,
        is_verified: true,
      });
    }

    for (let i = 0; i < categoryData.length; i++) {
      const c = categoryData[i];
      suggestions.push({
        id: `c-${c.id}`,
        label: c.name,
        type: "category",
        slug: c.slug,
        count: categoryCounts[i],
      });
    }

    for (const s of storesRes.data ?? []) {
      suggestions.push({
        id: `s-${s.id}`,
        label: s.name,
        type: "store",
        slug: s.slug,
        logo_url: s.logo_url ?? undefined,
        followers: s.total_followers ?? 0,
        is_verified: true,
      });
    }

    const seen = new Set<string>();
    const unique = suggestions.filter((s) => {
      const key = s.label.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return ok(unique.slice(0, 10));
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch suggestions");
  }
}

/* ------------------------------------------------------------------ */
/*  Orders                                                             */
/* ------------------------------------------------------------------ */

export async function getOrders(userId: string, limit = 20): Promise<Result<Order[]>> {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select("*, items:order_items(*, product:products(id, name, images:product_images(url, is_primary))), address:addresses(*)")
      .eq("user_id", userId)
      .order("placed_at", { ascending: false })
      .limit(limit);
    if (error) return fail(error.message);
    return ok((data as Order[]) ?? []);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch orders");
  }
}

export async function getOrderById(orderId: string): Promise<Result<Order | null>> {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select("*, items:order_items(*, product:products(id, name, images:product_images(url, is_primary, position))), address:addresses(*)")
      .eq("id", orderId)
      .single();
    if (error) return fail(error.message);
    return ok(data as Order | null);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch order");
  }
}

export interface TrackingEvent {
  id: string;
  order_id: string;
  status: string;
  description?: string | null;
  location?: string | null;
  carrier?: string | null;
  tracking_number?: string | null;
  created_at: string;
}

export interface OrderTracking {
  order: Order;
  events: TrackingEvent[];
  rider?: {
    id: string;
    name: string;
    phone?: string | null;
    vehicle?: string | null;
  } | null;
}

export async function getOrderTracking(orderId: string): Promise<Result<OrderTracking>> {
  try {
    const [orderRes, eventsRes, riderRes] = await Promise.all([
      supabase
        .from("orders")
        .select("*, items:order_items(*, product:products(id, name, images:product_images(url, is_primary, position))), address:addresses(*)")
        .eq("id", orderId)
        .single(),
      supabase
        .from("tracking_events")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: true }),
      supabase
        .from("orders")
        .select("delivery_person_id, rider:users!orders_delivery_person_id_fkey(id, full_name, phone)")
        .eq("id", orderId)
        .maybeSingle(),
    ]);
    if (orderRes.error) return fail(orderRes.error.message);
    const order = orderRes.data as Order;
    const events = (eventsRes.data ?? []) as TrackingEvent[];

    // Synthesise a placeholder event for the current status if no events
    // exist yet for the order — keeps the timeline never empty.
    if (events.length === 0) {
      const fallback: TrackingEvent = {
        id: "synthetic",
        order_id: order.id,
        status: order.status,
        description: `Order is ${order.status.replace(/_/g, " ")}`,
        created_at: order.placed_at,
      };
      events.push(fallback);
    }

    const riderRow = riderRes.data as
      | { rider?: { id: string; full_name: string; phone?: string | null } | null }
      | null;

    return ok({
      order,
      events,
      rider: riderRow?.rider
        ? { id: riderRow.rider.id, name: riderRow.rider.full_name, phone: riderRow.rider.phone }
        : null,
    });
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch tracking");
  }
}

/* ------------------------------------------------------------------ */
/*  Addresses                                                          */
/* ------------------------------------------------------------------ */

export async function getAddresses(userId: string): Promise<Result<Address[]>> {
  try {
    const { data, error } = await supabase
      .from("addresses")
      .select("*")
      .eq("user_id", userId)
      .order("is_default", { ascending: false });
    if (error) return fail(error.message);
    return ok((data as Address[]) ?? []);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch addresses");
  }
}

export async function createAddress(addr: Omit<Address, "id">): Promise<Result<Address>> {
  try {
    const { data, error } = await supabase
      .from("addresses")
      .insert(addr)
      .select()
      .single();
    if (error) return fail(error.message);
    return ok(data as Address);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to create address");
  }
}

export interface CouponValidation {
  couponId: string | null;
  discount: number;
  message: string;
}

export async function validateCoupon(
  code: string,
  userId: string,
  orderTotal: number
): Promise<Result<CouponValidation>> {
  try {
    const { data, error } = await supabase.rpc("validate_coupon", {
      p_code: code,
      p_user_id: userId,
      p_order_total: orderTotal,
    });
    if (error) return fail(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return fail("Invalid coupon response");
    return ok({
      couponId: row.coupon_id ?? null,
      discount: Number(row.discount ?? 0),
      message: row.message ?? "",
    });
  } catch (e: any) {
    return fail(e?.message ?? "Failed to validate coupon");
  }
}

export async function updateAddress(id: string, patch: Partial<Address>): Promise<Result<Address>> {
  try {
    const { data, error } = await supabase
      .from("addresses")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) return fail(error.message);
    return ok(data as Address);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to update address");
  }
}

export async function deleteAddress(id: string): Promise<Result<void>> {
  try {
    const { data: linkedOrders, error: fetchError } = await supabase
      .from("orders")
      .select("id, shipping_address, address:addresses(*)")
      .eq("address_id", id);

    if (fetchError) return fail(fetchError.message);

    if (linkedOrders?.length) {
      for (const order of linkedOrders) {
        const snap = order.shipping_address as Order["shipping_address"] | null;
        const addr = (Array.isArray(order.address)
          ? order.address[0]
          : order.address) as Address | null | undefined;

        if (!snap?.line1 && addr) {
          const { error: snapshotError } = await supabase
            .from("orders")
            .update({
              shipping_address: {
                full_name: addr.full_name,
                phone: addr.phone,
                line1: addr.line1,
                line2: addr.line2 ?? null,
                city: addr.city,
                state: addr.state,
                postal_code: addr.postal_code,
                country: addr.country,
              },
            })
            .eq("id", order.id);
          if (snapshotError) return fail(snapshotError.message);
        }
      }

      const { error: unlinkError } = await supabase
        .from("orders")
        .update({ address_id: null })
        .eq("address_id", id);

      if (unlinkError) return fail(unlinkError.message);
    }

    const { error } = await supabase.from("addresses").delete().eq("id", id);
    if (error) return fail(error.message);
    return ok(undefined);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to delete address");
  }
}

/* ------------------------------------------------------------------ */
/*  Notifications                                                      */
/* ------------------------------------------------------------------ */

export async function getNotifications(userId: string, limit = 30): Promise<Result<Notification[]>> {
  try {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return fail(error.message);
    return ok((data as Notification[]) ?? []);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch notifications");
  }
}

export async function markNotificationRead(id: string): Promise<Result<void>> {
  try {
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return fail(error.message);
    return ok(undefined);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to mark notification");
  }
}

export async function markAllNotificationsRead(userId: string): Promise<Result<void>> {
  try {
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("read_at", null);
    if (error) return fail(error.message);
    return ok(undefined);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to mark all notifications");
  }
}

/* ------------------------------------------------------------------ */
/*  Seller — Store                                                     */
/* ------------------------------------------------------------------ */

function slugFromName(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return base || `store-${Date.now()}`;
}

function scopeOrderToStore(order: Order, storeId: string): Order | null {
  const items = (order.items ?? []).filter((i) => i.store_id === storeId);
  if (items.length === 0) return null;
  const subtotal = items.reduce((s, i) => s + (i.total ?? 0), 0);
  return {
    ...order,
    items,
    subtotal,
    total: subtotal,
    discount: 0,
    shipping_fee: 0,
    tax: 0,
  };
}

export async function getSellerStore(ownerId: string): Promise<Result<Store | null>> {
  try {
    const { data, error } = await supabase
      .from("stores")
      .select("*")
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (error) return fail(error.message);
    return ok((data as Store | null) ?? null);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch store");
  }
}

export async function createSellerStore(
  ownerId: string,
  input: { name: string; slug?: string; description?: string },
): Promise<Result<Store>> {
  try {
    const name = input.name.trim();
    if (!name) return fail("Store name is required");

    const slug = (input.slug?.trim() || slugFromName(name)).toLowerCase();
    const { data, error } = await supabase
      .from("stores")
      .insert({
        owner_id: ownerId,
        name,
        slug,
        description: input.description?.trim() || null,
        status: "pending",
      })
      .select()
      .single();
    if (error) return fail(error.message);
    return ok(data as Store);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to create store");
  }
}

export async function updateSellerStore(id: string, patch: Partial<Store>): Promise<Result<Store>> {
  try {
    const { data, error } = await supabase
      .from("stores")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) return fail(error.message);
    return ok(data as Store);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to update store");
  }
}

/* ------------------------------------------------------------------ */
/*  Seller — Products                                                  */
/* ------------------------------------------------------------------ */

export async function getSellerProducts(storeId: string, opts: {
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<Result<{ products: Product[]; total: number }>> {
  const { status, search, limit = 50, offset = 0 } = opts;
  try {
    let query = supabase
      .from("products")
      .select("*, images:product_images(*), variants:product_variants(*, inventory(*))", { count: "exact" })
      .eq("store_id", storeId)
      .order("created_at", { ascending: false });
    if (status && status !== "all") query = query.eq("status", status);
    if (search) query = query.ilike("name", `%${search}%`);
    query = query.range(offset, offset + limit - 1);
    const { data, error, count } = await query;
    if (error) return fail(error.message);
    return ok({ products: mapProducts(data as any[]) ?? [], total: count ?? 0 });
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch seller products");
  }
}

export async function createSellerProduct(product: Partial<Product>): Promise<Result<Product>> {
  try {
    const slug =
      product.slug?.trim() ||
      (await ensureUniqueProductSlug(product.name ?? "product"));
    const row = {
      product_type: "simple" as const,
      tax_rate: 0,
      currency: "LKR",
      is_featured: false,
      discount_pct: 0,
      ...product,
      slug,
    };
    const { data, error } = await supabase
      .from("products")
      .insert(row)
      .select()
      .single();
    if (error) return fail(error.message);
    return ok(data as Product);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to create product");
  }
}

export async function updateSellerProduct(id: string, patch: Partial<Product>): Promise<Result<Product>> {
  try {
    const { data, error } = await supabase
      .from("products")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) return fail(error.message);
    return ok(data as Product);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to update product");
  }
}

export async function deleteSellerProduct(id: string): Promise<Result<void>> {
  try {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return fail(error.message);
    return ok(undefined);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to delete product");
  }
}

export async function getSellerProductById(productId: string): Promise<Result<Product | null>> {
  try {
    const { data, error } = await supabase
      .from("products")
      .select("*, images:product_images(*), variants:product_variants(*, inventory(*))")
      .eq("id", productId)
      .single();
    if (error) return fail(error.message);
    return ok(mapProduct(data));
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch product");
  }
}

function slugifyProductName(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || `product-${Date.now()}`
  );
}

async function ensureUniqueProductSlug(
  name: string,
  excludeId?: string,
): Promise<string> {
  const base = slugifyProductName(name);
  let candidate = base;
  let suffix = 1;
  while (true) {
    let query = supabase.from("products").select("id").eq("slug", candidate);
    if (excludeId) query = query.neq("id", excludeId);
    const { data } = await query.maybeSingle();
    if (!data) return candidate;
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
}

export async function deleteSellerProductImage(imageId: string): Promise<Result<void>> {
  try {
    const { error } = await supabase.from("product_images").delete().eq("id", imageId);
    if (error) return fail(error.message);
    return ok(undefined);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to delete image");
  }
}

export async function setSellerProductImagePrimary(
  productId: string,
  imageId: string,
): Promise<Result<void>> {
  try {
    const { error: clearError } = await supabase
      .from("product_images")
      .update({ is_primary: false })
      .eq("product_id", productId);
    if (clearError) return fail(clearError.message);

    const { error } = await supabase
      .from("product_images")
      .update({ is_primary: true })
      .eq("id", imageId);
    if (error) return fail(error.message);
    return ok(undefined);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to set primary image");
  }
}

export interface SellerVariantInput {
  id?: string;
  sku?: string;
  size?: string;
  color?: string;
  price?: number;
  mrp?: number;
  stock: number;
  position: number;
  is_active?: boolean;
}

export async function saveSellerVariants(
  productId: string,
  storeId: string,
  variants: SellerVariantInput[],
  removedIds: string[] = [],
): Promise<Result<void>> {
  try {
    if (removedIds.length > 0) {
      const { error } = await supabase
        .from("product_variants")
        .delete()
        .in("id", removedIds);
      if (error) return fail(error.message);
    }

    for (let i = 0; i < variants.length; i++) {
      const variant = variants[i];
      const payload = {
        product_id: productId,
        sku: variant.sku?.trim() || null,
        size: variant.size?.trim() || null,
        color: variant.color?.trim() || null,
        price: variant.price ?? null,
        mrp: variant.mrp ?? null,
        position: variant.position ?? i,
        is_active: variant.is_active ?? true,
      };

      let variantId = variant.id;
      if (variantId) {
        const { error } = await supabase
          .from("product_variants")
          .update(payload)
          .eq("id", variantId);
        if (error) return fail(error.message);
      } else {
        const { data, error } = await supabase
          .from("product_variants")
          .insert(payload)
          .select("id")
          .single();
        if (error) return fail(error.message);
        variantId = data.id;
      }

      const { data: existingInv, error: lookupError } = await supabase
        .from("inventory")
        .select("id")
        .eq("variant_id", variantId)
        .eq("store_id", storeId)
        .maybeSingle();
      if (lookupError) return fail(lookupError.message);

      if (existingInv) {
        const { error } = await supabase
          .from("inventory")
          .update({ quantity: variant.stock })
          .eq("variant_id", variantId)
          .eq("store_id", storeId);
        if (error) return fail(error.message);
      } else {
        const { error } = await supabase.from("inventory").insert({
          variant_id: variantId,
          store_id: storeId,
          quantity: variant.stock,
        });
        if (error) return fail(error.message);
      }
    }

    return ok(undefined);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to save variants");
  }
}

/* ------------------------------------------------------------------ */
/*  Seller — Orders                                                    */
/* ------------------------------------------------------------------ */

export async function getSellerOrders(storeId: string, opts: {
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<Result<Order[]>> {
  const { status, search, limit = 50, offset = 0 } = opts;
  try {
    let query = supabase
      .from("orders")
      .select("*, items:order_items!inner(*), address:addresses(*)")
      .eq("items.store_id", storeId)
      .order("placed_at", { ascending: false });
    if (status && status !== "all") {
      query = query.eq("status", status);
    }
    if (search) {
      query = query.ilike("order_number", `%${search}%`);
    }
    query = query.range(offset, offset + limit - 1);
    const { data, error } = await query;
    if (error) return fail(error.message);

    const orders = ((data ?? []) as Order[])
      .map((order) => scopeOrderToStore(order, storeId))
      .filter((order): order is Order => order !== null);
    return ok(orders);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch seller orders");
  }
}

export async function getSellerOrderById(
  orderId: string,
  storeId: string,
): Promise<Result<Order | null>> {
  try {
    const res = await getOrderById(orderId);
    if (!res.ok) return res;
    if (!res.data) return ok(null);
    return ok(scopeOrderToStore(res.data, storeId));
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch seller order");
  }
}

export async function transitionOrderStatus(orderId: string, status: string): Promise<Result<void>> {
  try {
    const { error } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", orderId);
    if (error) return fail(error.message);
    return ok(undefined);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to update order status");
  }
}

/* ------------------------------------------------------------------ */
/*  Seller — Inventory                                                 */
/* ------------------------------------------------------------------ */

export async function getSellerInventory(storeId: string): Promise<Result<{
  product: Product;
  variants: (ProductVariant & { stock: number })[];
}[]>> {
  try {
    const { data: products, error } = await supabase
      .from("products")
      .select("*, variants:product_variants(*, inventory(*)), images:product_images(url, is_primary)")
      .eq("store_id", storeId)
      .order("name");
    if (error) return fail(error.message);

    const result = ((products ?? []) as any[]).map((p) => ({
      product: p as Product,
      variants: (p.variants ?? []).map((v: any) => ({
        ...v,
        stock: v.inventory?.[0]?.quantity ?? v.stock ?? 0,
      })),
    }));
    return ok(result);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch inventory");
  }
}

export async function updateVariantStock(variantId: string, stock: number): Promise<Result<void>> {
  try {
    const { data: existing, error: lookupError } = await supabase
      .from("inventory")
      .select("id")
      .eq("variant_id", variantId)
      .maybeSingle();
    if (lookupError) return fail(lookupError.message);

    if (existing) {
      const { error } = await supabase
        .from("inventory")
        .update({ quantity: stock })
        .eq("variant_id", variantId);
      if (error) return fail(error.message);
    } else {
      const { data: variantRow, error: variantLookupError } = await supabase
        .from("product_variants")
        .select("product_id, product:products(store_id)")
        .eq("id", variantId)
        .maybeSingle();
      if (variantLookupError) return fail(variantLookupError.message);
      const storeId = (variantRow as any)?.product?.store_id;
      if (!storeId) return fail("Store not found for variant");

      const { error } = await supabase
        .from("inventory")
        .insert({ variant_id: variantId, store_id: storeId, quantity: stock });
      if (error) return fail(error.message);
    }
    return ok(undefined);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to update stock");
  }
}

/* ------------------------------------------------------------------ */
/*  Seller — Dashboard KPIs                                            */
/* ------------------------------------------------------------------ */

export async function getSellerKPIs(storeId: string): Promise<Result<{
  totalRevenue: number;
  totalOrders: number;
  totalProducts: number;
  pendingOrders: number;
  lowStockVariants: number;
  recentOrders: Order[];
}>> {
  try {
    const [ordersRes, productsRes, inventoryRes] = await Promise.all([
      supabase
        .from("order_items")
        .select("*, order:orders(id, order_number, total, status, placed_at, payment_method, payment_status, shipping_address)")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("products")
        .select("id, status", { count: "exact" })
        .eq("store_id", storeId),
      supabase
        .from("products")
        .select("id, variants:product_variants(id, inventory(quantity))")
        .eq("store_id", storeId),
    ]);

    if (ordersRes.error) return fail(ordersRes.error.message);

    const items = (ordersRes.data ?? []) as any[];
    const orderMap = new Map<string, any>();
    let totalRevenue = 0;
    for (const row of items) {
      totalRevenue += row.total ?? 0;
      const o = row.order;
      if (o && !orderMap.has(o.id)) orderMap.set(o.id, o);
    }
    const orders = Array.from(orderMap.values());
    const pendingOrders = orders.filter((o: any) => ["pending", "confirmed", "processing"].includes(o.status)).length;

    const totalProducts = (productsRes.count ?? 0);

    let lowStockVariants = 0;
    for (const p of ((inventoryRes.data ?? []) as any[])) {
      for (const v of (p.variants ?? [])) {
        const stock = v.inventory?.[0]?.quantity ?? 0;
        if (stock > 0 && stock < 5) lowStockVariants++;
      }
    }

    const recentOrders = Array.from(orderMap.entries())
      .map(([orderId, order]) => {
        const sellerTotal = items
          .filter((row) => row.order?.id === orderId)
          .reduce((sum, row) => sum + (row.total ?? 0), 0);
        return { ...order, total: sellerTotal } as Order;
      })
      .sort((a, b) => new Date(b.placed_at).getTime() - new Date(a.placed_at).getTime())
      .slice(0, 5);

    return ok({
      totalRevenue,
      totalOrders: orders.length,
      totalProducts,
      pendingOrders,
      lowStockVariants,
      recentOrders,
    });
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch KPIs");
  }
}

/* ------------------------------------------------------------------ */
/*  Delivery — Rider orders                                            */
/* ------------------------------------------------------------------ */

export async function getRiderOrders(riderId: string): Promise<Result<Order[]>> {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select("*, items:order_items(*), address:addresses(*)")
      .eq("delivery_person_id", riderId)
      .order("placed_at", { ascending: false });
    if (error) return fail(error.message);
    return ok((data as Order[]) ?? []);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch rider orders");
  }
}

export async function riderStartDelivery(orderId: string): Promise<Result<{ otp: string }>> {
  try {
    const { data: existing, error: fetchErr } = await supabase
      .from("orders")
      .select("status, delivery_otp")
      .eq("id", orderId)
      .single();
    if (fetchErr) return fail(fetchErr.message);

    if (!["shipped", "processing", "confirmed"].includes(existing.status)) {
      return fail(`Cannot start delivery from status "${existing.status}"`);
    }

    const otp = existing.delivery_otp ?? String(Math.floor(100000 + Math.random() * 900000));
    const { error } = await supabase
      .from("orders")
      .update({ status: "out_for_delivery", delivery_otp: otp })
      .eq("id", orderId);
    if (error) return fail(error.message);

    await supabase
      .from("order_items")
      .update({ status: "out_for_delivery" })
      .eq("order_id", orderId);

    return ok({ otp });
  } catch (e: any) {
    return fail(e?.message ?? "Failed to start delivery");
  }
}

export async function riderVerifyDelivery(orderId: string, otp: string): Promise<Result<void>> {
  try {
    const { data: order, error: fetchErr } = await supabase
      .from("orders")
      .select("status, delivery_otp, payment_method, payment_status")
      .eq("id", orderId)
      .single();
    if (fetchErr) return fail(fetchErr.message);

    if (order.status === "delivered") return ok(undefined);

    const cleanedOtp = otp.replace(/\s/g, "");
    const orderOtp = order.delivery_otp ? order.delivery_otp.replace(/\s/g, "") : "";
    if (!orderOtp || cleanedOtp !== orderOtp) {
      return fail("Invalid verification code");
    }

    const now = new Date().toISOString();
    const isCOD = order.payment_method === "cod";
    const nextPaymentStatus = isCOD ? "paid" : order.payment_status;

    const { error } = await supabase
      .from("orders")
      .update({
        status: "delivered",
        payment_status: nextPaymentStatus,
        delivered_at: now,
        delivery_otp: null,
      })
      .eq("id", orderId);
    if (error) return fail(error.message);

    await supabase
      .from("order_items")
      .update({ status: "delivered", delivered_at: now })
      .eq("order_id", orderId);

    if (isCOD && order.payment_status !== "paid") {
      await supabase
        .from("payments")
        .update({ status: "paid", paid_at: now })
        .eq("order_id", orderId)
        .eq("status", "pending");
    }

    return ok(undefined);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to verify delivery");
  }
}

export async function riderReportIssue(orderId: string, reason: string, status: "returned" | "cancelled"): Promise<Result<void>> {
  try {
    const { error } = await supabase
      .from("orders")
      .update({ status, notes: reason })
      .eq("id", orderId);
    if (error) return fail(error.message);

    await supabase
      .from("order_items")
      .update({ status })
      .eq("order_id", orderId);

    return ok(undefined);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to report issue");
  }
}

export async function getRiderHistory(riderId: string): Promise<Result<Order[]>> {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select("*, items:order_items(*), address:addresses(*)")
      .eq("delivery_person_id", riderId)
      .in("status", ["delivered", "returned", "refunded", "cancelled"])
      .order("delivered_at", { ascending: false });
    if (error) return fail(error.message);
    return ok((data as Order[]) ?? []);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch delivery history");
  }
}

/* ------------------------------------------------------------------ */
/*  Brand — Owner                                                      */
/* ------------------------------------------------------------------ */

export async function getBrandByOwner(ownerId: string): Promise<Result<Brand | null>> {
  try {
    const { data, error } = await supabase
      .from("brands")
      .select("*")
      .eq("owner_id", ownerId)
      .single();
    if (error) return fail(error.message);
    return ok(data as Brand | null);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch brand");
  }
}

export async function updateBrand(id: string, patch: Partial<Brand>): Promise<Result<Brand>> {
  try {
    const { data, error } = await supabase
      .from("brands")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) return fail(error.message);
    return ok(data as Brand);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to update brand");
  }
}

export async function getBrandProducts(brandId: string, opts: {
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<Result<{ products: Product[]; total: number }>> {
  const { status, search, limit = 50, offset = 0 } = opts;
  try {
    let query = supabase
      .from("products")
      .select("*, images:product_images(*), variants:product_variants(*, inventory(*)), store:stores!products_store_id_fkey(name, slug)", { count: "exact" })
      .eq("brand_id", brandId)
      .order("created_at", { ascending: false });
    if (status && status !== "all") query = query.eq("status", status);
    if (search) query = query.ilike("name", `%${search}%`);
    query = query.range(offset, offset + limit - 1);
    const { data, error, count } = await query;
    if (error) return fail(error.message);
    return ok({ products: mapProducts(data as any[]) ?? [], total: count ?? 0 });
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch brand products");
  }
}

export async function getBrandOrders(brandId: string, opts: {
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<Result<Order[]>> {
  const { status, search, limit = 50, offset = 0 } = opts;
  try {
    let query = supabase
      .from("order_items")
      .select("*, order:orders(*, items:order_items(*), address:addresses(*)), product:products(brand_id)")
      .eq("product.brand_id", brandId)
      .order("created_at", { ascending: false });
    if (status && status !== "all") query = query.eq("status", status);
    query = query.range(offset, offset + limit - 1);
    const { data, error } = await query;
    if (error) return fail(error.message);
    const orderMap = new Map<string, Order>();
    for (const row of (data ?? []) as any[]) {
      const order = row.order as Order;
      if (order && !orderMap.has(order.id)) orderMap.set(order.id, order);
    }
    let orders = Array.from(orderMap.values());
    if (search) {
      const q = search.toLowerCase();
      orders = orders.filter(o => o.order_number?.toLowerCase().includes(q));
    }
    return ok(orders);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch brand orders");
  }
}

export async function getBrandKPIs(brandId: string): Promise<Result<{
  totalProducts: number;
  activeProducts: number;
  totalOrders: number;
  totalRevenue: number;
}>> {
  try {
    const [productsRes, ordersRes] = await Promise.all([
      supabase
        .from("products")
        .select("id, status", { count: "exact" })
        .eq("brand_id", brandId),
      supabase
        .from("order_items")
        .select("*, order:orders(id, total, status), product:products(brand_id)")
        .eq("product.brand_id", brandId)
        .limit(200),
    ]);
    const totalProducts = productsRes.count ?? 0;
    const activeProducts = ((productsRes.data ?? []) as any[]).filter(p => p.status === "active").length;
    const items = (ordersRes.data ?? []) as any[];
    const orderMap = new Map<string, any>();
    for (const row of items) {
      const o = row.order;
      if (o && !orderMap.has(o.id)) orderMap.set(o.id, o);
    }
    const orders = Array.from(orderMap.values());
    return ok({
      totalProducts,
      activeProducts,
      totalOrders: orders.length,
      totalRevenue: orders.reduce((s: number, o: any) => s + (o.total ?? 0), 0),
    });
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch brand KPIs");
  }
}

/* ------------------------------------------------------------------ */
/*  Admin — Platform                                                   */
/* ------------------------------------------------------------------ */

export async function getAdminStats(): Promise<Result<{
  totalUsers: number;
  totalStores: number;
  totalProducts: number;
  totalOrders: number;
  totalRevenue: number;
  pendingStores: number;
  pendingProducts: number;
}>> {
  try {
    const [usersRes, storesRes, productsRes, ordersRes] = await Promise.all([
      supabase.from("users").select("id", { count: "exact", head: true }),
      supabase.from("stores").select("id, status", { count: "exact" }),
      supabase.from("products").select("id, status", { count: "exact" }),
      supabase.from("orders").select("id, total, status", { count: "exact" }).limit(500),
    ]);
    const stores = (storesRes.data ?? []) as any[];
    const products = (productsRes.data ?? []) as any[];
    const orders = (ordersRes.data ?? []) as any[];
    return ok({
      totalUsers: usersRes.count ?? 0,
      totalStores: storesRes.count ?? 0,
      totalProducts: productsRes.count ?? 0,
      totalOrders: ordersRes.count ?? 0,
      totalRevenue: orders.reduce((s: number, o: any) => s + (o.total ?? 0), 0),
      pendingStores: stores.filter(s => s.status === "pending").length,
      pendingProducts: products.filter(p => p.status === "pending").length,
    });
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch admin stats");
  }
}

export async function getAdminUsers(opts: {
  role?: string;
  search?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<Result<{ users: User[]; total: number }>> {
  const { role, search, limit = 50, offset = 0 } = opts;
  try {
    let query = supabase
      .from("users")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });
    if (role && role !== "all") query = query.eq("role", role);
    if (search) query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
    query = query.range(offset, offset + limit - 1);
    const { data, error, count } = await query;
    if (error) return fail(error.message);
    return ok({ users: (data as User[]) ?? [], total: count ?? 0 });
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch users");
  }
}

export async function updateUserRole(userId: string, role: string): Promise<Result<void>> {
  try {
    const { error } = await supabase
      .from("users")
      .update({ role })
      .eq("id", userId);
    if (error) return fail(error.message);
    return ok(undefined);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to update user role");
  }
}

export async function getAdminStores(opts: {
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<Result<{ stores: Store[]; total: number }>> {
  const { status, search, limit = 50, offset = 0 } = opts;
  try {
    let query = supabase
      .from("stores")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });
    if (status && status !== "all") query = query.eq("status", status);
    if (search) query = query.ilike("name", `%${search}%`);
    query = query.range(offset, offset + limit - 1);
    const { data, error, count } = await query;
    if (error) return fail(error.message);
    return ok({ stores: (data as Store[]) ?? [], total: count ?? 0 });
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch stores");
  }
}

export async function approveStore(storeId: string, status: "approved" | "rejected"): Promise<Result<void>> {
  try {
    const { error } = await supabase
      .from("stores")
      .update({ status })
      .eq("id", storeId);
    if (error) return fail(error.message);
    return ok(undefined);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to update store status");
  }
}

export async function getAdminOrders(opts: {
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<Result<Order[]>> {
  const { status, search, limit = 50, offset = 0 } = opts;
  try {
    let query = supabase
      .from("orders")
      .select("*, items:order_items(*), address:addresses(*)")
      .order("placed_at", { ascending: false });
    if (status && status !== "all") query = query.eq("status", status);
    if (search) query = query.or(`order_number.ilike.%${search}%`);
    query = query.range(offset, offset + limit - 1);
    const { data, error } = await query;
    if (error) return fail(error.message);
    return ok((data as Order[]) ?? []);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch admin orders");
  }
}

export async function getAdminProducts(opts: {
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<Result<{ products: Product[]; total: number }>> {
  const { status, search, limit = 50, offset = 0 } = opts;
  try {
    let query = supabase
      .from("products")
      .select("*, images:product_images(*), store:stores!products_store_id_fkey(name), brand:brands(name)", { count: "exact" })
      .order("created_at", { ascending: false });
    if (status && status !== "all") query = query.eq("status", status);
    if (search) query = query.ilike("name", `%${search}%`);
    query = query.range(offset, offset + limit - 1);
    const { data, error, count } = await query;
    if (error) return fail(error.message);
    return ok({ products: (data as Product[]) ?? [], total: count ?? 0 });
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch admin products");
  }
}

export async function getAdminBrands(opts: {
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<Result<{ brands: Brand[]; total: number }>> {
  const { status, search, limit = 50, offset = 0 } = opts;
  try {
    let query = supabase
      .from("brands")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });
    if (status && status !== "all") query = query.eq("status", status);
    if (search) query = query.ilike("name", `%${search}%`);
    query = query.range(offset, offset + limit - 1);
    const { data, error, count } = await query;
    if (error) return fail(error.message);
    return ok({ brands: (data as Brand[]) ?? [], total: count ?? 0 });
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch admin brands");
  }
}

export async function approveBrand(brandId: string, status: "approved" | "rejected"): Promise<Result<void>> {
  try {
    const { error } = await supabase.from("brands").update({ status }).eq("id", brandId);
    if (error) return fail(error.message);
    return ok(undefined);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to update brand");
  }
}

export async function approveProduct(productId: string, status: "active" | "rejected" | "archived"): Promise<Result<void>> {
  try {
    const { error } = await supabase.from("products").update({ status }).eq("id", productId);
    if (error) return fail(error.message);
    return ok(undefined);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to update product");
  }
}

export async function getAdminCategories(): Promise<Result<Category[]>> {
  try {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("position");
    if (error) return fail(error.message);
    return ok((data as Category[]) ?? []);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch categories");
  }
}

export async function createCategory(c: Partial<Category>): Promise<Result<Category>> {
  try {
    const { data, error } = await supabase.from("categories").insert(c).select().single();
    if (error) return fail(error.message);
    return ok(data as Category);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to create category");
  }
}

export async function updateCategory(id: string, patch: Partial<Category>): Promise<Result<Category>> {
  try {
    const { data, error } = await supabase.from("categories").update(patch).eq("id", id).select().single();
    if (error) return fail(error.message);
    return ok(data as Category);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to update category");
  }
}

export async function deleteCategory(id: string): Promise<Result<void>> {
  try {
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) return fail(error.message);
    return ok(undefined);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to delete category");
  }
}

export async function getAdminBanners(): Promise<Result<Banner[]>> {
  try {
    const { data, error } = await supabase
      .from("banners")
      .select("*")
      .order("display_order");
    if (error) return fail(error.message);
    return ok((data as Banner[]) ?? []);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch banners");
  }
}

export async function createBanner(b: Partial<Banner>): Promise<Result<Banner>> {
  try {
    const { data, error } = await supabase.from("banners").insert(b).select().single();
    if (error) return fail(error.message);
    return ok(data as Banner);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to create banner");
  }
}

export async function updateBanner(id: string, patch: Partial<Banner>): Promise<Result<Banner>> {
  try {
    const { data, error } = await supabase.from("banners").update(patch).eq("id", id).select().single();
    if (error) return fail(error.message);
    return ok(data as Banner);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to update banner");
  }
}

export async function deleteBanner(id: string): Promise<Result<void>> {
  try {
    const { error } = await supabase.from("banners").delete().eq("id", id);
    if (error) return fail(error.message);
    return ok(undefined);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to delete banner");
  }
}

export interface AdminCoupon {
  id: string;
  code: string;
  type: "percentage" | "fixed" | "free_shipping" | "bxgy";
  value: number;
  min_order_total?: number;
  max_uses?: number;
  current_uses: number;
  starts_at?: string;
  ends_at?: string;
  is_active: boolean;
  scope?: string;
  created_at: string;
}

export async function getAdminCoupons(opts: {
  search?: string;
  is_active?: string;
} = {}): Promise<Result<AdminCoupon[]>> {
  try {
    let query = supabase
      .from("coupons")
      .select("*")
      .order("created_at", { ascending: false });
    if (opts.search) query = query.ilike("code", `%${opts.search}%`);
    if (opts.is_active && opts.is_active !== "all") query = query.eq("is_active", opts.is_active === "true");
    const { data, error } = await query;
    if (error) return fail(error.message);
    return ok((data as AdminCoupon[]) ?? []);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch coupons");
  }
}

export async function createCoupon(c: Partial<AdminCoupon>): Promise<Result<AdminCoupon>> {
  try {
    const { data, error } = await supabase.from("coupons").insert(c).select().single();
    if (error) return fail(error.message);
    return ok(data as AdminCoupon);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to create coupon");
  }
}

export async function toggleCoupon(id: string, isActive: boolean): Promise<Result<void>> {
  try {
    const { error } = await supabase.from("coupons").update({ is_active: isActive }).eq("id", id);
    if (error) return fail(error.message);
    return ok(undefined);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to toggle coupon");
  }
}

export interface AdminCampaign {
  id: string;
  name: string;
  description?: string;
  kind?: string;
  starts_at?: string;
  ends_at?: string;
  is_active: boolean;
  banner_url?: string;
  created_at: string;
}

export async function getAdminCampaigns(): Promise<Result<AdminCampaign[]>> {
  try {
    const { data, error } = await supabase
      .from("campaigns")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return fail(error.message);
    return ok((data as AdminCampaign[]) ?? []);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch campaigns");
  }
}

export async function toggleCampaign(id: string, isActive: boolean): Promise<Result<void>> {
  try {
    const { error } = await supabase.from("campaigns").update({ is_active: isActive }).eq("id", id);
    if (error) return fail(error.message);
    return ok(undefined);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to toggle campaign");
  }
}

export interface NotificationBroadcast {
  id: string;
  title: string;
  body: string;
  audience: string;
  channel: string;
  sent_at: string;
  created_by?: string;
}

export async function getAdminBroadcasts(): Promise<Result<NotificationBroadcast[]>> {
  try {
    const { data, error } = await supabase
      .from("notification_broadcasts")
      .select("*")
      .order("sent_at", { ascending: false });
    if (error) return fail(error.message);
    return ok((data as NotificationBroadcast[]) ?? []);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch broadcasts");
  }
}

export async function sendBroadcast(b: Partial<NotificationBroadcast>): Promise<Result<NotificationBroadcast>> {
  try {
    const row = { ...b, sent_at: new Date().toISOString() };
    const { data, error } = await supabase.from("notification_broadcasts").insert(row).select().single();
    if (error) return fail(error.message);
    return ok(data as NotificationBroadcast);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to send broadcast");
  }
}

export interface AuditEntry {
  id: string;
  actor_id?: string;
  actor_name?: string;
  action: string;
  target_type?: string;
  target_id?: string;
  metadata?: any;
  created_at: string;
}

export async function getAdminAuditLog(limit = 50): Promise<Result<AuditEntry[]>> {
  try {
    const { data, error } = await supabase
      .from("admin_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return fail(error.message);
    return ok((data as AuditEntry[]) ?? []);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch audit log");
  }
}

export interface AdminBlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  cover_image?: string;
  author?: string;
  tags: string[];
  status: "draft" | "published";
  published_at?: string;
  created_at: string;
}

export async function getAdminBlogPosts(): Promise<Result<AdminBlogPost[]>> {
  try {
    const { data, error } = await supabase
      .from("blog_posts")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return fail(error.message);
    return ok((data as AdminBlogPost[]) ?? []);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch blog posts");
  }
}

export async function createBlogPost(p: Partial<AdminBlogPost>): Promise<Result<AdminBlogPost>> {
  try {
    const { data, error } = await supabase.from("blog_posts").insert(p).select().single();
    if (error) return fail(error.message);
    return ok(data as AdminBlogPost);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to create blog post");
  }
}

export async function toggleBlogPost(id: string, status: "draft" | "published"): Promise<Result<void>> {
  try {
    const { error } = await supabase.from("blog_posts").update({ status }).eq("id", id);
    if (error) return fail(error.message);
    return ok(undefined);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to toggle post");
  }
}

export interface ModerationReview {
  id: string;
  product_id: string;
  product_name?: string;
  user_id: string;
  user_name?: string;
  rating: number;
  title?: string;
  body: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

export interface ModerationQA {
  id: string;
  product_id: string;
  product_name?: string;
  user_id: string;
  user_name?: string;
  question: string;
  answer?: string;
  status: "pending" | "answered" | "rejected";
  created_at: string;
}

export async function getAdminReviews(status = "pending"): Promise<Result<ModerationReview[]>> {
  try {
    let q = supabase
      .from("reviews")
      .select("*, product:products(name)")
      .order("created_at", { ascending: false });
    if (status !== "all") q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return fail(error.message);
    return ok((data as any) ?? []);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch reviews");
  }
}

export async function moderateReview(id: string, status: "approved" | "rejected"): Promise<Result<void>> {
  try {
    const { error } = await supabase.from("reviews").update({ status }).eq("id", id);
    if (error) return fail(error.message);
    return ok(undefined);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to moderate review");
  }
}

export async function getAdminQA(status = "pending"): Promise<Result<ModerationQA[]>> {
  try {
    let q = supabase
      .from("product_questions")
      .select("*, product:products(name)")
      .order("created_at", { ascending: false });
    if (status !== "all") q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return fail(error.message);
    return ok((data as any) ?? []);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch questions");
  }
}

export interface DeliveryCompany {
  id: string;
  name: string;
  slug: string;
  status: ApprovalStatus;
  contact_email?: string;
  contact_phone?: string;
  coverage_areas?: string[];
  rating?: number;
  total_deliveries?: number;
  created_at: string;
}

export async function getAdminDeliveryCompanies(): Promise<Result<DeliveryCompany[]>> {
  try {
    const { data, error } = await supabase
      .from("delivery_companies")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return fail(error.message);
    return ok((data as DeliveryCompany[]) ?? []);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch delivery companies");
  }
}

export interface CommissionTier {
  id: string;
  name: string;
  min_gmv: number;
  max_gmv?: number;
  rate_pct: number;
  is_active: boolean;
  position: number;
}

export async function getAdminCommissions(): Promise<Result<CommissionTier[]>> {
  try {
    const { data, error } = await supabase
      .from("commission_tiers")
      .select("*")
      .order("position");
    if (error) return fail(error.message);
    return ok((data as CommissionTier[]) ?? []);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch commission tiers");
  }
}

export async function updateCommissionTier(id: string, patch: Partial<CommissionTier>): Promise<Result<CommissionTier>> {
  try {
    const { data, error } = await supabase.from("commission_tiers").update(patch).eq("id", id).select().single();
    if (error) return fail(error.message);
    return ok(data as CommissionTier);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to update tier");
  }
}

export interface GiftCard {
  id: string;
  code: string;
  initial_balance: number;
  current_balance: number;
  currency: string;
  issued_to_email?: string;
  is_active: boolean;
  expires_at?: string;
  created_at: string;
}

export async function getAdminGiftCards(): Promise<Result<GiftCard[]>> {
  try {
    const { data, error } = await supabase
      .from("gift_cards")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return fail(error.message);
    return ok((data as GiftCard[]) ?? []);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch gift cards");
  }
}

export async function createGiftCard(g: Partial<GiftCard>): Promise<Result<GiftCard>> {
  try {
    const code = g.code ?? `LUXE-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const row = { ...g, code, created_at: new Date().toISOString() };
    const { data, error } = await supabase.from("gift_cards").insert(row).select().single();
    if (error) return fail(error.message);
    return ok(data as GiftCard);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to create gift card");
  }
}

export interface AdminHomepageSection {
  id: string;
  key: string;
  title: string;
  enabled: boolean;
  position: number;
  config?: any;
}

export async function getAdminHomepageSections(): Promise<Result<AdminHomepageSection[]>> {
  try {
    const { data, error } = await supabase
      .from("homepage_sections")
      .select("*")
      .order("position");
    if (error) return fail(error.message);
    return ok((data as AdminHomepageSection[]) ?? []);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch homepage sections");
  }
}

export async function toggleHomepageSection(id: string, enabled: boolean): Promise<Result<void>> {
  try {
    const { error } = await supabase.from("homepage_sections").update({ enabled }).eq("id", id);
    if (error) return fail(error.message);
    return ok(undefined);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to toggle section");
  }
}

export interface ContactSubmission {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  subject: string;
  message: string;
  status: "new" | "in_progress" | "resolved";
  created_at: string;
}

export interface SubmitContactInput {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  userId?: string;
}

export async function submitContactSubmission(
  input: SubmitContactInput,
): Promise<Result<{ submitted: true }>> {
  try {
    const { error } = await supabase.from("contact_submissions").insert({
      name: input.name.trim(),
      email: input.email.trim(),
      phone: input.phone?.trim() || null,
      subject: input.subject.trim(),
      message: input.message.trim(),
      user_id: input.userId ?? null,
      status: "new",
    });
    if (error) return fail(error.message);
    return ok({ submitted: true });
  } catch (e: any) {
    return fail(e?.message ?? "Failed to submit message");
  }
}

export async function getAdminContactSubmissions(): Promise<Result<ContactSubmission[]>> {
  try {
    const { data, error } = await supabase
      .from("contact_submissions")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return fail(error.message);
    return ok((data as ContactSubmission[]) ?? []);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch contact submissions");
  }
}

export interface LowStockItem {
  id: string;
  variant_id: string;
  product_name?: string;
  quantity: number;
  low_stock_threshold: number;
}

export async function getAdminLowStock(limit = 10): Promise<Result<LowStockItem[]>> {
  try {
    const { data, error } = await supabase
      .from("inventory")
      .select("id, variant_id, quantity, low_stock_threshold, variant:product_variants(product:products(name))")
      .filter("quantity", "lte", 5)
      .limit(limit);
    if (error) return fail(error.message);
    return ok((data as any) ?? []);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch low stock");
  }
}

export interface PlatformSetting {
  id?: string;
  key: string;
  value: any;
  updated_at?: string;
}

export async function getAdminPlatformSettings(): Promise<Result<Record<string, any>>> {
  try {
    const { data, error } = await supabase.from("platform_settings").select("*");
    if (error) return fail(error.message);
    const map: Record<string, any> = {};
    for (const row of (data as any[]) ?? []) {
      map[row.key] = row.value;
    }
    return ok(map);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch settings");
  }
}

export async function setAdminPlatformSetting(key: string, value: any): Promise<Result<void>> {
  try {
    const { error } = await supabase
      .from("platform_settings")
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) return fail(error.message);
    return ok(undefined);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to save setting");
  }
}

export interface AdminOverviewStats {
  users: number;
  customers: number;
  stores: number;
  activeStores: number;
  brands: number;
  products: number;
  orders: number;
  revenue: number;
  pendingStores: number;
  pendingBrands: number;
  pendingProducts: number;
  aov: number;
}

export async function getAdminOverviewStats(): Promise<Result<AdminOverviewStats>> {
  try {
    const [u, st, br, pr, ord, ps, pb, pp, cust, act, rev] = await Promise.all([
      supabase.from("users").select("id", { count: "exact", head: true }),
      supabase.from("stores").select("id", { count: "exact", head: true }),
      supabase.from("brands").select("id", { count: "exact", head: true }),
      supabase.from("products").select("id", { count: "exact", head: true }),
      supabase.from("orders").select("id, total, payment_status", { count: "exact" }),
      supabase.from("stores").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("brands").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("products").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("users").select("id", { count: "exact", head: true }).eq("role", "customer"),
      supabase.from("stores").select("id", { count: "exact", head: true }).eq("status", "approved"),
      supabase.from("orders").select("total").eq("payment_status", "paid"),
    ]);
    const revenue = ((rev.data ?? []) as any[]).reduce((s, r) => s + Number(r.total ?? 0), 0);
    const totalOrders = ord.count ?? 0;
    const aov = totalOrders > 0 ? Math.round(revenue / totalOrders) : 0;
    return ok({
      users: u.count ?? 0,
      customers: cust.count ?? 0,
      stores: st.count ?? 0,
      activeStores: act.count ?? 0,
      brands: br.count ?? 0,
      products: pr.count ?? 0,
      orders: totalOrders,
      revenue,
      pendingStores: ps.count ?? 0,
      pendingBrands: pb.count ?? 0,
      pendingProducts: pp.count ?? 0,
      aov,
    });
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch overview stats");
  }
}

export async function getAdminRecentSignups(limit = 8): Promise<Result<User[]>> {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return fail(error.message);
    return ok((data as User[]) ?? []);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch signups");
  }
}

export async function getAdminRecentOrders(limit = 6): Promise<Result<any[]>> {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select("id, order_number, total, status, placed_at, currency, user:users(full_name)")
      .order("placed_at", { ascending: false })
      .limit(limit);
    if (error) return fail(error.message);
    return ok(data ?? []);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch recent orders");
  }
}

export interface AdminApproval {
  id: string;
  name: string;
  created_at: string;
  status?: string;
}

export interface AdminApprovals {
  stores: AdminApproval[];
  brands: AdminApproval[];
  products: AdminApproval[];
}

export async function getAdminPendingApprovals(limit = 20): Promise<Result<AdminApprovals>> {
  try {
    const [st, br, pr] = await Promise.all([
      supabase.from("stores").select("id, name, status, created_at")
        .eq("status", "pending").order("created_at", { ascending: false }).limit(limit),
      supabase.from("brands").select("id, name, status, created_at")
        .eq("status", "pending").order("created_at", { ascending: false }).limit(limit),
      supabase.from("products").select("id, name, status, created_at")
        .eq("status", "pending").order("created_at", { ascending: false }).limit(limit),
    ]);
    return ok({
      stores: (st.data as AdminApproval[]) ?? [],
      brands: (br.data as AdminApproval[]) ?? [],
      products: (pr.data as AdminApproval[]) ?? [],
    });
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch approvals");
  }
}

export async function getStoreById(id: string): Promise<Result<Store | null>> {
  try {
    const { data, error } = await supabase
      .from("stores")
      .select("*, products:products(id, name, status, total_sales)")
      .eq("id", id)
      .maybeSingle();
    if (error) return fail(error.message);
    return ok(data as Store | null);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch store");
  }
}

export async function getProductById(id: string): Promise<Result<Product | null>> {
  try {
    const { data, error } = await supabase
      .from("products")
      .select("*, images:product_images(*), variants:product_variants(*, inventory(*)), store:stores!products_store_id_fkey(name, slug), brand:brands(name, slug), category:categories(name, slug)")
      .eq("id", id)
      .maybeSingle();
    if (error) return fail(error.message);
    return ok(mapProduct(data));
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch product");
  }
}

/* ------------------------------------------------------------------ */
/*  Blog                                                               */
/* ------------------------------------------------------------------ */

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  content?: string;
  cover_image?: string;
  author?: string;
  tags: string[];
  status: "draft" | "published";
  published_at?: string;
  created_at: string;
}

export async function getBlogPosts(limit = 20): Promise<Result<BlogPost[]>> {
  try {
    const { data, error } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(limit);
    if (error) return fail(error.message);
    return ok((data as BlogPost[]) ?? []);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch blog posts");
  }
}

export async function getBlogPostBySlug(slug: string): Promise<Result<BlogPost | null>> {
  try {
    const { data, error } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("slug", slug)
      .single();
    if (error) return fail(error.message);
    return ok(data as BlogPost | null);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch blog post by slug");
  }
}

/* ------------------------------------------------------------------ */
/*  Account                                                            */
/* ------------------------------------------------------------------ */

export type NotificationPreferenceKey =
  | "orders_email"
  | "orders_sms"
  | "orders_push"
  | "marketing_email"
  | "marketing_sms"
  | "marketing_push"
  | "social_email"
  | "social_push"
  | "security_email"
  | "security_sms"
  | "security_push";

export type NotificationPrefs = Record<NotificationPreferenceKey, boolean>;

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  orders_email: true,
  orders_sms: false,
  orders_push: true,
  marketing_email: true,
  marketing_sms: false,
  marketing_push: false,
  social_email: true,
  social_push: true,
  security_email: true,
  security_sms: true,
  security_push: true,
};

export async function getNotificationPrefs(userId: string): Promise<Result<NotificationPrefs>> {
  try {
    const { data, error } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) return fail(error.message);
    return ok({
      ...DEFAULT_NOTIFICATION_PREFS,
      ...(data ?? {}),
      orders_email: Boolean(data?.orders_email),
      orders_sms: Boolean(data?.orders_sms),
      orders_push: Boolean(data?.orders_push),
      marketing_email: Boolean(data?.marketing_email),
      marketing_sms: Boolean(data?.marketing_sms),
      marketing_push: Boolean(data?.marketing_push),
      social_email: Boolean(data?.social_email),
      social_push: Boolean(data?.social_push),
      security_email: Boolean(data?.security_email),
      security_sms: Boolean(data?.security_sms),
      security_push: Boolean(data?.security_push),
    });
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch notification preferences");
  }
}

export async function saveNotificationPrefs(
  userId: string,
  prefs: Partial<NotificationPrefs>
): Promise<Result<NotificationPrefs>> {
  try {
    const row = {
      user_id: userId,
      ...DEFAULT_NOTIFICATION_PREFS,
      ...prefs,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from("notification_preferences")
      .upsert(row, { onConflict: "user_id" })
      .select()
      .single();
    if (error) return fail(error.message);
    return ok({
      ...DEFAULT_NOTIFICATION_PREFS,
      ...(data ?? {}),
      orders_email: Boolean(data?.orders_email),
      orders_sms: Boolean(data?.orders_sms),
      orders_push: Boolean(data?.orders_push),
      marketing_email: Boolean(data?.marketing_email),
      marketing_sms: Boolean(data?.marketing_sms),
      marketing_push: Boolean(data?.marketing_push),
      social_email: Boolean(data?.social_email),
      social_push: Boolean(data?.social_push),
      security_email: Boolean(data?.security_email),
      security_sms: Boolean(data?.security_sms),
      security_push: Boolean(data?.security_push),
    });
  } catch (e: any) {
    return fail(e?.message ?? "Failed to save notification preferences");
  }
}

export type FollowedStore = {
  id: string;
  store_id: string;
  store: Store;
  created_at: string;
};

export type FollowedBrand = {
  id: string;
  brand_id: string;
  brand: Brand;
  created_at: string;
};

export async function getFollowedStores(userId: string): Promise<Result<FollowedStore[]>> {
  try {
    const { data, error } = await supabase
      .from("followers")
      .select("id, store_id, created_at, store:stores(*)")
      .eq("user_id", userId)
      .not("store_id", "is", null)
      .order("created_at", { ascending: false });
    if (error) return fail(error.message);
    return ok(
      ((data as any as FollowedStore[]) ?? []).map((row) => ({
        ...row,
        store: mapStore(row.store),
      }))
    );
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch followed stores");
  }
}

export async function getFollowedBrands(userId: string): Promise<Result<FollowedBrand[]>> {
  try {
    const { data, error } = await supabase
      .from("followers")
      .select("id, brand_id, created_at, brand:brands(*)")
      .eq("user_id", userId)
      .not("brand_id", "is", null)
      .order("created_at", { ascending: false });
    if (error) return fail(error.message);
    return ok(
      ((data as any as FollowedBrand[]) ?? []).map((row) => ({
        ...row,
        brand: mapBrand(row.brand),
      }))
    );
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch followed brands");
  }
}

export type MobileReturnRequest = {
  id: string;
  return_group_id: string;
  return_number: string;
  order_id: string;
  order_number: string;
  order_status: string;
  currency: string;
  reason: string;
  status: "requested" | "approved" | "rejected" | "received" | "refunded";
  refund_amount: number;
  created_at: string;
  updated_at: string;
  received_at: string | null;
  seller_note: string | null;
  items: {
    return_id: string;
    order_item_id: string;
    product_name: string;
    variant_label: string | null;
    quantity: number;
    unit_price: number;
    refund_amount: number;
  }[];
};

export type SellerReturnRequest = MobileReturnRequest & {
  buyer_name: string | null;
};

const RETURN_ROW_SELECT =
  "id, return_group_id, return_number, reason, status, refund_amount, " +
  "created_at, updated_at, received_at, seller_note, " +
  "order_item:order_items(id, product_name, variant_label, quantity, unit_price, total, " +
  "order:orders(id, order_number, total, currency, status, user_id, shipping_address))";

const SELLER_RETURN_ROW_SELECT =
  "id, return_group_id, return_number, reason, status, refund_amount, " +
  "created_at, updated_at, received_at, seller_note, " +
  "order_item:order_items!inner(id, store_id, product_name, variant_label, quantity, unit_price, total, " +
  "order:orders(id, order_number, total, currency, status, user_id, shipping_address))";

function groupReturnRows(rows: any[]): MobileReturnRequest[] {
  const groups = new Map<string, MobileReturnRequest>();
  for (const r of rows) {
    const existing = groups.get(r.return_group_id) ?? {
      id: r.return_group_id,
      return_group_id: r.return_group_id,
      return_number: r.return_number,
      order_id: r.order_item?.order?.id ?? "",
      order_number: r.order_item?.order?.order_number ?? "",
      order_status: r.order_item?.order?.status ?? "",
      currency: r.order_item?.order?.currency ?? "LKR",
      reason: r.reason ?? "",
      status: r.status,
      refund_amount: 0,
      created_at: r.created_at,
      updated_at: r.updated_at,
      received_at: r.received_at ?? null,
      seller_note: r.seller_note ?? null,
      items: [] as MobileReturnRequest["items"],
    };
    const rank = { requested: 0, approved: 1, received: 2, refunded: 3, rejected: 4 } as const;
    const statusKey = r.status as keyof typeof rank;
    const existingStatusKey = existing.status as keyof typeof rank;
    if (rank[existingStatusKey] < rank[statusKey]) existing.status = r.status;
    existing.refund_amount += Number(r.refund_amount ?? 0);
    existing.items.push({
      return_id: r.id,
      order_item_id: r.order_item.id,
      product_name: r.order_item.product_name,
      variant_label: r.order_item.variant_label ?? null,
      quantity: r.order_item.quantity,
      unit_price: r.order_item.unit_price,
      refund_amount: Number(r.refund_amount ?? 0),
    });
    groups.set(r.return_group_id, existing);
  }
  return Array.from(groups.values());
}

function groupSellerReturnRows(rows: any[]): SellerReturnRequest[] {
  return groupReturnRows(rows).map((group) => {
    const row = rows.find((r) => r.return_group_id === group.return_group_id);
    const buyerName =
      (row?.order_item?.order?.shipping_address as { full_name?: string } | null)?.full_name ?? null;
    return { ...group, buyer_name: buyerName };
  });
}

export async function getReturns(userId: string): Promise<Result<MobileReturnRequest[]>> {
  try {
    const { data, error } = await supabase
      .from("returns")
      .select(RETURN_ROW_SELECT)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) return fail(error.message);
    return ok(groupReturnRows((data as any[]) ?? []));
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch returns");
  }
}

export async function getReturnByGroupId(
  userId: string,
  returnGroupId: string
): Promise<Result<MobileReturnRequest | null>> {
  const res = await getReturns(userId);
  if (!res.ok) return res;
  return ok(res.data.find((r) => r.return_group_id === returnGroupId) ?? null);
}

export interface CreateReturnInput {
  orderId: string;
  reason: string;
  items: { orderItemId: string; quantity: number }[];
}

export interface CreateReturnResult {
  returnGroupId: string;
  returnNumber: string;
  items: {
    return_id: string;
    order_item_id: string;
    quantity: number;
    refund_amount: number;
  }[];
}

export async function createReturnRequest(
  userId: string,
  input: CreateReturnInput
): Promise<Result<CreateReturnResult>> {
  try {
    const { data, error } = await supabase.rpc("create_return_request", {
      p_user_id: userId,
      p_order_id: input.orderId,
      p_reason: input.reason,
      p_items: input.items.map((i) => ({
        order_item_id: i.orderItemId,
        quantity: i.quantity,
      })),
    });
    if (error) return fail(error.message);
    const row = (data ?? {}) as {
      return_group_id?: string;
      return_number?: string;
      items?: CreateReturnResult["items"];
    };
    if (!row.return_group_id) return fail("Return request did not return an id");
    return ok({
      returnGroupId: row.return_group_id,
      returnNumber: row.return_number ?? "",
      items: row.items ?? [],
    });
  } catch (e: any) {
    return fail(e?.message ?? "Failed to create return");
  }
}

/* ------------------------------------------------------------------ */
/*  Seller — Returns                                                   */
/* ------------------------------------------------------------------ */

export type SellerReturnAction = "approve" | "reject" | "receive" | "refund";

export async function getSellerReturns(
  storeId: string,
  opts: { status?: string; search?: string } = {},
): Promise<Result<SellerReturnRequest[]>> {
  const { status, search } = opts;
  try {
    let query = supabase
      .from("returns")
      .select(SELLER_RETURN_ROW_SELECT)
      .eq("order_item.store_id", storeId)
      .order("created_at", { ascending: false });
    if (status && status !== "all") {
      query = query.eq("status", status);
    }
    const { data, error } = await query;
    if (error) return fail(error.message);

    let groups = groupSellerReturnRows((data as any[]) ?? []);
    if (search?.trim()) {
      const q = search.trim().toLowerCase();
      groups = groups.filter(
        (r) =>
          r.return_number.toLowerCase().includes(q) ||
          r.order_number.toLowerCase().includes(q) ||
          (r.buyer_name?.toLowerCase().includes(q) ?? false) ||
          r.items.some((i) => i.product_name.toLowerCase().includes(q)),
      );
    }
    return ok(groups);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch seller returns");
  }
}

export async function getSellerReturnByGroupId(
  storeId: string,
  returnGroupId: string,
): Promise<Result<SellerReturnRequest | null>> {
  const res = await getSellerReturns(storeId);
  if (!res.ok) return res;
  return ok(res.data.find((r) => r.return_group_id === returnGroupId) ?? null);
}

export async function decideSellerReturn(
  actorUserId: string,
  returnId: string,
  action: SellerReturnAction,
  opts: { note?: string; refundAmount?: number } = {},
): Promise<Result<{ refund_id?: string }>> {
  try {
    const { data, error } = await supabase.rpc("decide_return", {
      p_actor: actorUserId,
      p_return_id: returnId,
      p_action: action,
      p_refund_amount: opts.refundAmount ?? null,
      p_note: opts.note ?? null,
    });
    if (error) return fail(error.message);
    const row = (data ?? {}) as { refund_id?: string };
    return ok({ refund_id: row.refund_id });
  } catch (e: any) {
    return fail(e?.message ?? "Failed to update return");
  }
}

export async function decideSellerReturnGroup(
  actorUserId: string,
  storeId: string,
  returnGroupId: string,
  action: SellerReturnAction,
  opts: { note?: string } = {},
): Promise<Result<void>> {
  const detail = await getSellerReturnByGroupId(storeId, returnGroupId);
  if (!detail.ok) return detail;
  if (!detail.data) return fail("Return not found");

  const returnIds = detail.data.items.map((i) => i.return_id);
  if (returnIds.length === 0) return fail("No return items found");

  if (action === "refund") {
    const res = await decideSellerReturn(actorUserId, returnIds[0], "refund", {
      note: opts.note,
      refundAmount: detail.data.refund_amount,
    });
    return res.ok ? ok(undefined) : res;
  }

  for (const returnId of returnIds) {
    const res = await decideSellerReturn(actorUserId, returnId, action, opts);
    if (!res.ok) return res;
  }
  return ok(undefined);
}

export async function getMyReviews(userId: string): Promise<Result<Review[]>> {
  try {
    const { data, error } = await supabase
      .from("reviews")
      .select("*, product:products(name, slug)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) return fail(error.message);
    return ok((data as Review[]) ?? []);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch reviews");
  }
}

export async function deleteReview(reviewId: string, userId: string): Promise<Result<void>> {
  try {
    const { error } = await supabase.from("reviews").delete().eq("id", reviewId).eq("user_id", userId);
    if (error) return fail(error.message);
    return ok(undefined);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to delete review");
  }
}

/* ------------------------------------------------------------------ */
/*  Seller — Reviews                                                   */
/* ------------------------------------------------------------------ */

export async function getStoreReviews(storeId: string, opts: {
  rating?: number;
  search?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<Result<{ reviews: Review[]; total: number; avgRating: number; ratingBreakdown: Record<number, number> }>> {
  const { rating, search, limit = 50, offset = 0 } = opts;
  try {
    let query = supabase
      .from("reviews")
      .select("*, product:products!inner(store_id, name, slug), user:users(id, full_name, avatar_url)", { count: "exact" })
      .eq("product.store_id", storeId)
      .eq("status", "approved")
      .order("created_at", { ascending: false });
    if (rating) query = query.eq("rating", rating);
    if (search) query = query.ilike("title", `%${search}%`);
    query = query.range(offset, offset + limit - 1);
    const { data, error, count } = await query;
    if (error) return fail(error.message);
    const reviews = (data as any[]) ?? [];
    const total = count ?? 0;

    const allRes = await supabase
      .from("reviews")
      .select("rating")
      .eq("status", "approved")
      .eq("product.store_id", storeId);
    const allRatings = ((allRes.data ?? []) as { rating: number }[]);
    const avgRating = allRatings.length > 0
      ? allRatings.reduce((s, r) => s + r.rating, 0) / allRatings.length
      : 0;
    const ratingBreakdown: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    for (const r of allRatings) {
      ratingBreakdown[r.rating] = (ratingBreakdown[r.rating] ?? 0) + 1;
    }

    return ok({ reviews, total, avgRating, ratingBreakdown });
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch store reviews");
  }
}

/* ------------------------------------------------------------------ */
/*  Seller — Coupons                                                   */
/* ------------------------------------------------------------------ */

export async function getStoreCoupons(storeId: string): Promise<Result<AdminCoupon[]>> {
  try {
    const { data, error } = await supabase
      .from("coupons")
      .select("*")
      .eq("scope", storeId)
      .order("created_at", { ascending: false });
    if (error) return fail(error.message);
    return ok((data as AdminCoupon[]) ?? []);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch store coupons");
  }
}

export async function createStoreCoupon(coupon: Partial<AdminCoupon>): Promise<Result<AdminCoupon>> {
  try {
    const { data, error } = await supabase.from("coupons").insert(coupon).select().single();
    if (error) return fail(error.message);
    return ok(data as AdminCoupon);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to create coupon");
  }
}

/* ------------------------------------------------------------------ */
/*  Seller — Analytics                                                 */
/* ------------------------------------------------------------------ */

export async function getStoreAnalytics(storeId: string): Promise<Result<{
  totalRevenue: number;
  totalOrders: number;
  totalProducts: number;
  avgOrderValue: number;
  conversionRate: number;
  revenueByMonth: { month: string; revenue: number; orders: number }[];
  topProducts: { name: string; revenue: number; units: number; image?: string }[];
  ordersByStatus: Record<string, number>;
}>> {
  try {
    const [ordersRes, productsRes, viewsRes] = await Promise.all([
      supabase
        .from("order_items")
        .select("*, order:orders(id, total, status, placed_at, payment_status), product:products(name)")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("products")
        .select("id, name, total_sales, price, images:product_images(url, is_primary)")
        .eq("store_id", storeId),
      supabase
        .from("products")
        .select("id, view_count")
        .eq("store_id", storeId),
    ]);

    if (ordersRes.error) return fail(ordersRes.error.message);

    const items = (ordersRes.data ?? []) as any[];
    const orderMap = new Map<string, any>();
    for (const row of items) {
      const o = row.order;
      if (o && !orderMap.has(o.id)) orderMap.set(o.id, o);
    }
    const orders = Array.from(orderMap.values());
    const totalRevenue = orders
      .filter((o: any) => o.payment_status === "paid")
      .reduce((s: number, o: any) => s + (o.total ?? 0), 0);
    const totalOrders = orders.length;
    const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

    const totalViews = ((viewsRes.data ?? []) as any[]).reduce(
      (s: number, p: any) => s + (p.view_count ?? 0), 0
    );
    const conversionRate = totalViews > 0
      ? Math.round((totalOrders / totalViews) * 10000) / 100
      : 0;

    const monthMap = new Map<string, { revenue: number; orders: number }>();
    for (const o of orders) {
      const d = new Date(o.placed_at ?? o.id);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const entry = monthMap.get(key) ?? { revenue: 0, orders: 0 };
      if (o.payment_status === "paid") entry.revenue += o.total ?? 0;
      entry.orders += 1;
      monthMap.set(key, entry);
    }
    const revenueByMonth = Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, data]) => ({ month, ...data }));

    const productSales = new Map<string, { name: string; revenue: number; units: number; image?: string }>();
    for (const row of items) {
      const pname = row.product?.name ?? "Unknown";
      const existing = productSales.get(pname) ?? { name: pname, revenue: 0, units: 0 };
      existing.revenue += row.total ?? row.unit_price * row.quantity;
      existing.units += row.quantity;
      productSales.set(pname, existing);
    }
    const topProducts = Array.from(productSales.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    const ordersByStatus: Record<string, number> = {};
    for (const o of orders) {
      ordersByStatus[o.status] = (ordersByStatus[o.status] ?? 0) + 1;
    }

    return ok({
      totalRevenue,
      totalOrders,
      totalProducts: (productsRes.data ?? []).length,
      avgOrderValue,
      conversionRate,
      revenueByMonth,
      topProducts,
      ordersByStatus,
    });
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch store analytics");
  }
}

/* ------------------------------------------------------------------ */
/*  Search recommendation system — keywords, image/camera, price drops */
/* ------------------------------------------------------------------ */

export type V2Suggestion = {
  kind: "keyword" | "store" | "brand";
  label: string;
  slug?: string;
  count?: number;
  logo_url?: string;
  followers?: number;
  is_verified?: boolean;
  trend_pct?: number;
};

/**
 * Typeahead suggestions: 6 keywords (with count), 3 stores, 2 brands.
 * Backed by the `search_suggestions_v2` RPC so it stays fast at 250ms debounce.
 */
export async function getSearchSuggestionsV2(term: string): Promise<Result<V2Suggestion[]>> {
  const cleanTerm = term.trim();
  if (cleanTerm.length < 1) return ok([]);
  try {
    const { data, error } = await supabase.rpc("search_suggestions_v2", {
      p_term: cleanTerm,
    });
    if (!error) {
      return ok((data ?? []) as V2Suggestion[]);
    }
    
    // If the RPC function is missing/fails, query the tables directly.
    if (typeof supabase.from === "function") {
      const [productsRes, storesRes, brandsRes] = await Promise.all([
        supabase
          .from("products")
          .select("name, slug")
          .eq("status", "active")
          .eq("is_active", true)
          .ilike("name", `${cleanTerm}%`)
          .order("total_sales", { ascending: false })
          .limit(6),
        supabase
          .from("stores")
          .select("name, slug, logo_url, total_followers, is_featured")
          .eq("status", "approved")
          .ilike("name", `%${cleanTerm}%`)
          .order("total_followers", { ascending: false })
          .limit(3),
        supabase
          .from("brands")
          .select("name, slug, logo_url, total_followers")
          .eq("status", "approved")
          .ilike("name", `%${cleanTerm}%`)
          .order("total_followers", { ascending: false })
          .limit(2),
      ]);

      const suggestions: V2Suggestion[] = [];

      if (productsRes.data && productsRes.data.length > 0) {
        const kwCount = productsRes.data.length;
        for (const p of productsRes.data) {
          suggestions.push({
            kind: "keyword",
            label: p.name,
            slug: p.slug,
            count: kwCount,
            trend_pct: 0,
          });
        }
      }

      if (storesRes.data) {
        for (const s of storesRes.data) {
          suggestions.push({
            kind: "store",
            label: s.name,
            slug: s.slug,
            logo_url: s.logo_url ?? undefined,
            followers: s.total_followers ?? 0,
            is_verified: !!s.is_featured,
            trend_pct: 0,
          });
        }
      }

      if (brandsRes.data) {
        for (const b of brandsRes.data) {
          suggestions.push({
            kind: "brand",
            label: b.name,
            slug: b.slug,
            logo_url: b.logo_url ?? undefined,
            followers: b.total_followers ?? 0,
            is_verified: true,
            trend_pct: 0,
          });
        }
      }

      return ok(suggestions);
    }
    
    return fail(error.message);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch suggestions");
  }
}

export type WishlistPriceDrop = {
  product_id: string;
  slug: string;
  name: string;
  image_url?: string;
  old_price: number;
  new_price: number;
  drop_pct: number;
};

/** Wishlist items whose current price is below the price at time of add. */
export async function getWishlistPriceDrops(): Promise<Result<WishlistPriceDrop[]>> {
  try {
    const { data: userRes } = await supabase.auth.getUser();
    const userId = userRes?.user?.id;
    if (!userId) return ok([]);
    const { data, error } = await supabase.rpc("wishlist_price_drops", { p_user: userId });
    if (error) return fail(error.message);
    return ok((data ?? []) as WishlistPriceDrop[]);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch price drops");
  }
}

export type ScanMatch = {
  kind: "product" | "store" | "none";
  product_id?: string;
  store_id?: string;
  slug?: string;
  confidence: number;
};

/** Upload a captured/picked image to the private `scan-uploads` bucket. */
export async function uploadScanImage(
  uri: string,
  source: "library" | "camera",
): Promise<Result<{ path: string; url: string }>> {
  try {
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) return fail("Not authenticated");
    const ext = (uri.split(".").pop() ?? "jpg").toLowerCase().split("?")[0] || "jpg";
    const path = `${user.id}/${Date.now()}.${ext}`;
    const blob = await fetch(uri).then((r) => r.blob());
    const { error } = await supabase.storage
      .from("scan-uploads")
      .upload(path, blob, { contentType: `image/${ext}` });
    if (error) return fail(error.message);
    const { data: pub } = supabase.storage.from("scan-uploads").getPublicUrl(path);
    return ok({ path, url: pub?.publicUrl ?? "" });
  } catch (e: any) {
    return fail(e?.message ?? "Failed to upload scan");
  }
}

/** Match a previously-uploaded scan path against the catalogue. */
export async function reverseImageMatch(path: string): Promise<Result<ScanMatch>> {
  try {
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) return fail("Not authenticated");
    const { data, error } = await supabase.rpc("reverse_image_match", {
      p_path: path,
      p_user: user.id,
    });
    if (error) return fail(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || row.kind === "none") return ok({ kind: "none", confidence: 0 });
    return ok({
      kind: row.kind,
      product_id: row.product_id ?? undefined,
      store_id: row.store_id ?? undefined,
      slug: row.slug ?? undefined,
      confidence: Number(row.confidence ?? 0),
    });
  } catch (e: any) {
    return fail(e?.message ?? "Failed to match image");
  }
}
