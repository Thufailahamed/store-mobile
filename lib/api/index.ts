/**
 * Mobile API façade — backend-first architecture.
 *
 * Each exported function delegates to `lib/api/backend.ts` (typed
 * Hono wrappers). Auth helpers and a few remaining client-side
 * composites still touch Supabase directly. New code should use
 * `backend.ts` directly; this file is the legacy call-site shim.
 */

import {
  fetchJson,
  getAccessToken,
  getStoreApiUrl,
  type ApiResult,
} from "@/lib/api/backend";
export type { ApiResult, BulkSellerProductInput, BulkSellerProductsResponse } from "@/lib/api/backend";
import * as B from "@/lib/api/backend";
import { hasStoreApi } from "@/lib/api/delivery-api";
import { supabase } from "@/lib/supabase/client";
import { mapProduct, mapProducts, mapStore, mapBrand, mapCategory, mapBanner, mapFlatProductRows, mapFlatProductRow } from "@/lib/api/product-mapper";
import { getProductCards, getProductCardsByIds } from "@/lib/api/product-queries";
import {
  tokenizeQuery,
  buildSearchOrParts,
  expandColorTerms,
  fuzzyMatch,
  scoreProduct,
  isColorWord,
} from "@/lib/utils/search-utils";
import type {
  Product, ProductVariant, ProductImage, Brand, Store, Category,
  Review, Order, OrderItem, Address, Banner, Notification, User,
  Testimonial, Tenet, HeroMeta, ApprovalStatus, HomepageSection,
  EligibleReviewOrder, BlogPost as LibBlogPost, HomepagePromise, HomepageProductSection,
} from "@/lib/types";
import { z } from "zod";
import type { IssueReason } from "@/lib/utils/delivery-format";
import {
  deliveryTransition,
  deliveryVerify,
  deliveryPickupVerify,
  deliveryProofUpload,
  getReturnPickups,
  getOrderPackage,
  resolvePackageQr,
  scanPackage,
  verifyPackageDelivery,
  extractPackageToken,
  getDeliveryPipelineZones,
  isReassignAvailable,
  reassignDelivery,
} from "@/lib/api/delivery-api";
import { getSellerAccessState, getSellerComplianceGaps, readStorefrontContact, type SellerPayoutCompliance, type SellerComplianceDocument, type ComplianceDocType } from "@/lib/seller-access";
import { getBrowsableStoreIds, isPublicCatalogProduct } from "@/lib/catalog-visibility";
import { summarizeInventoryHealth, readInventoryQuantities } from "@/lib/inventory";
import { mapSellerOrderRow, isAmbiguousRelationshipError, SELLER_ORDERS_LIST_SELECT } from "@/lib/orders/seller-list";
import { mapSellerReturnRow } from "@/lib/returns/seller-list";
import { resolveImageUrl } from "@/lib/utils/resolve-image-url";
import {
  getAdminCategoriesEnriched,
  getCategoryDeleteImpact,
  createCategory,
  updateCategory,
  deleteCategory,
  deleteCategoryWithOptions,
  type AdminCategory,
} from "@/lib/api/category-admin";

// ============================================================================
// Local Result / ok / fail — preserved for consumer compatibility.
// ============================================================================

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };
const ok = <T>(data: T): Result<T> => ({ ok: true, data });
const fail = (e: string): Result<never> => ({ ok: false, error: e });

const fromB = <T>(r: ApiResult<T>): Result<T> => (r.ok ? ok(r.data) : fail(r.error));

/** Cast through unknown to bridge structural gaps between backend.ts and
 *  the legacy `lib/types` shapes. Both originate from the same Postgres
 *  tables — the gaps are field-naming drift, not real schema differences. */
const loose = <T>(data: unknown): T => data as T;

export { mapProduct, mapProducts, mapStore, mapBrand, mapFlatProductRows } from "./product-mapper";
export {
  PRODUCT_CARD_SELECT,
  getProductCards,
  getProductCardsByIds,
  type ProductCardSort,
} from "./product-queries";

const GENDER_SLUGS = new Set(["men", "women", "kids", "unisex"]);

// ============================================================================
// Catalogue — products, brands, stores, categories
// ============================================================================

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
  const { limit = 20, offset = 0, sort = "newest", categorySlug, brandSlug, storeSlug, search } = opts;
  let gender = opts.gender;
  // Resolve slug → id via backend list endpoints so callers don't need to
  // hit Supabase directly. The backend's /api/catalog/products expects ids.
  let category_id: string | undefined;
  let brand_id: string | undefined;
  let store_id: string | undefined;
  if (categorySlug && GENDER_SLUGS.has(categorySlug)) {
    gender = gender ?? categorySlug;
  } else if (categorySlug) {
    const cat = await B.getCategoryBySlugBackend(categorySlug);
    if (!cat.ok) return fail(cat.error);
    if (!cat.data.category) return ok({ products: [], total: 0 });
    category_id = cat.data.category.id;
  }
  if (brandSlug) {
    const br = await B.getBrandBySlugBackend(brandSlug);
    if (!br.ok) return fail(br.error);
    if (!br.data.brand) return ok({ products: [], total: 0 });
    brand_id = br.data.brand.id;
  }
  if (storeSlug) {
    const st = await B.getStoreBySlugBackend(storeSlug);
    if (!st.ok) return fail(st.error);
    if (!st.data.store) return ok({ products: [], total: 0 });
    store_id = st.data.store.id;
  }
  const res = await B.getProductsBackend({
    brand: brand_id,
    store: store_id,
    category: category_id,
    gender,
    search,
    sort: sort as "newest" | "price_asc" | "price_desc" | "rating" | "popularity" | undefined,
    limit,
    offset,
  });
  if (!res.ok) return fail(res.error);
  return ok({ products: mapProducts(res.data.products as unknown[]) ?? [], total: res.data.count });
}

export async function getBrands(opts: { limit?: number; search?: string; offset?: number } = {}): Promise<Result<Brand[]>> {
  const res = await B.getBrandsBackend({
    limit: opts.limit ?? 200,
    search: opts.search,
    offset: opts.offset,
  });
  if (!res.ok) return fail(res.error);
  return ok(loose<Brand[]>(res.data.brands ?? []));
}

export async function getBrandBySlug(slug: string): Promise<Result<Brand | null>> {
  const res = await B.getBrandBySlugBackend(slug);
  if (!res.ok) return fail(res.error);
  if (!res.data.brand) return ok(null);
  return ok(loose<Brand>(mapBrand(res.data.brand as Parameters<typeof mapBrand>[0])));
}

export async function getBrandById(id: string): Promise<Result<Brand | null>> {
  const res = await B.getBrandByIdBackend(id);
  if (!res.ok) return fail(res.error);
  if (!res.data.brand) return ok(null);
  return ok(loose<Brand>(mapBrand(res.data.brand as Parameters<typeof mapBrand>[0])));
}

export async function getAdminBrandById(id: string): Promise<Result<{
  id: string;
  owner_id?: string | null;
  name: string;
  slug: string;
  tagline?: string | null;
  description?: string | null;
  logo_url?: string | null;
  banner_url?: string | null;
  status?: string;
  rating?: number;
  total_followers?: number;
  total_products?: number;
  products?: Array<{ id: string; name: string; status: string; total_sales: number }>;
} | null>> {
  const res = await B.getAdminBrandByIdBackend(id);
  if (!res.ok) return fail(res.error);
  return ok((res.data.brand ?? null) as never);
}

export async function getProductBySlug(slug: string): Promise<Result<Product | null>> {
  const res = await B.getProductBySlugBackend(slug);
  if (!res.ok) return fail(res.error);
  if (!res.data.product) return ok(null);
  return ok(mapProduct(res.data.product));
}

export async function getRelatedProducts(productId: string, _categoryId?: string, limit = 8): Promise<Result<Product[]>> {
  // Backend has no /related endpoint yet — fetch the product to read its
  // category, then call the catalogue list with that filter.
  const pdp = await B.getProductByIdBackend(productId);
  if (!pdp.ok) return fail(pdp.error);
  const category = (pdp.data.product as { category?: { id?: string } })?.category?.id;
  const res = await B.getProductsBackend({ category, limit });
  if (!res.ok) return fail(res.error);
  const rows = (res.data.products as unknown[]).filter((p) => (p as { id?: string }).id !== productId);
  return ok(mapProducts(rows) ?? []);
}

export async function getReviews(productId: string, limit = 20): Promise<Result<Review[]>> {
  const res = await B.listReviewsBackend(productId, limit);
  if (!res.ok) return fail(res.error);
  return ok(loose<Review[]>(res.data.reviews ?? []));
}

export async function getEligibleReviewOrders(productId: string): Promise<Result<EligibleReviewOrder[]>> {
  const res = await B.getEligibleReviewOrdersBackend(productId);
  if (!res.ok) return fail(res.error);
  return ok(loose<EligibleReviewOrder[]>(res.data.orders ?? []));
}

// ============================================================================
// Homepage
// ============================================================================

export async function getHomepageSections(): Promise<Result<HomepageSection[]>> {
  const res = await B.getAdminHomepageSectionsBackend();
  if (!res.ok) return fail(res.error);
  const sections = (res.data.sections as unknown[]).map((s) => {
    const row = s as { id: string; key?: string; title: string; enabled: boolean; position: number };
    return { slug: row.key ?? row.id, label: row.title, enabled: row.enabled, position: row.position } as HomepageSection;
  });
  return ok(sections.filter((s) => s.enabled));
}

export async function getHomepageProductPicks(
  section: HomepageProductSection,
): Promise<Result<Product[]>> {
  const res = await B.getHomepageBackend();
  if (!res.ok) return fail(res.error);
  const picks = (res.data.productPicks ?? []) as Array<{ product: any; section: string }>;
  const filtered = picks
    .filter((p) => p.section === section && p.product)
    .map((p) => mapProduct(p.product));
  return ok(filtered);
}

export async function getHomepagePromises(): Promise<Result<HomepagePromise[]>> {
  // Backend returns a bundled homepage payload; promises is one slice.
  const res = await B.getHomepageBackend();
  if (!res.ok) return fail(res.error);
  const promises = (res.data.promises ?? []) as HomepagePromise[];
  return ok(promises);
}

export async function getFeaturedBlogPosts(limit = 3): Promise<Result<LibBlogPost[]>> {
  const res = await B.getBlogPostsBackend({ limit });
  if (!res.ok) return fail(res.error);
  return ok((res.data.posts as LibBlogPost[]) ?? []);
}

export async function getTopStoriesOfWeek(limit = 8): Promise<Result<LibBlogPost[]>> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const res = await B.getBlogPostsBackend({ limit, since });
  if (!res.ok) return fail(res.error);
  return ok((res.data.posts as LibBlogPost[]) ?? []);
}

export async function getFeaturedProducts(limit = 12): Promise<Result<Product[]>> {
  const res = await getProductCards({ limit, featuredOnly: true, sort: "popular" });
  return res;
}

export async function getMostLovedToday(limit = 12): Promise<Result<Product[]>> {
  const res = await B.getHomepageBackend();
  if (!res.ok) return fail(res.error);
  const products = mapFlatProductRows((res.data.mostLoved as unknown[]) ?? []);
  return ok(products.slice(0, limit));
}

export async function getFeaturedBrands(limit = 6): Promise<Result<Brand[]>> {
  const res = await B.getBrandsBackend({ limit });
  if (!res.ok) return fail(res.error);
  const featured = loose<Array<{ is_featured?: boolean }>>(res.data.brands ?? []).filter((b) => b.is_featured);
  return ok((featured.length ? featured : res.data.brands).slice(0, limit) as Brand[]);
}

export async function getFeaturedStores(limit = 6): Promise<Result<Store[]>> {
  const res = await B.getStoresBackend({ limit });
  if (!res.ok) return fail(res.error);
  const featured = loose<Array<{ is_featured?: boolean }>>(res.data.stores ?? []).filter((s) => s.is_featured);
  return ok((featured.length ? featured : res.data.stores).slice(0, limit) as Store[]);
}

export async function getStores(opts: {
  search?: string;
  sort?: "popular" | "newest" | "rating";
  limit?: number;
  offset?: number;
} = {}): Promise<Result<{ stores: Store[]; total: number }>> {
  const res = await B.getStoresBackend({ limit: opts.limit ?? 60 });
  if (!res.ok) return fail(res.error);
  const stores = loose<Store[]>(res.data.stores ?? []).map(mapStore);
  return ok({ stores, total: stores.length });
}

export async function getCategories(limit = 20): Promise<Result<Category[]>> {
  const res = await B.getCategoriesBackend();
  if (!res.ok) return fail(res.error);
  const cats = (res.data.categories as Category[]).slice(0, limit).map(mapCategory);
  return ok(cats);
}

export async function getAllCategories(): Promise<Result<Category[]>> {
  const res = await B.getCategoriesBackend();
  if (!res.ok) return fail(res.error);
  return ok((res.data.categories as Category[]).map(mapCategory));
}

export async function getBanners(position?: string): Promise<Result<Banner[]>> {
  const res = await B.getBannersBackend(position ? { placement: position } : {});
  if (!res.ok) return fail(res.error);
  return ok(loose<Banner[]>(res.data.banners ?? []).map(mapBanner));
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

// ============================================================================
// Testimonials / tenets / hero / flash sale — homepage payload slices
// ============================================================================

export async function getTestimonials(limit = 6): Promise<Result<Testimonial[]>> {
  const res = await B.getHomepageBackend();
  if (!res.ok) return fail(res.error);
  const list = ((res.data.testimonials ?? []) as Testimonial[]).slice(0, limit);
  return ok(list);
}

export async function getTenets(limit = 6): Promise<Result<Tenet[]>> {
  const res = await B.getHomepageBackend();
  if (!res.ok) return fail(res.error);
  const list = ((res.data.tenets ?? []) as Tenet[]).slice(0, limit);
  return ok(list);
}

export async function getHeroMeta(): Promise<Result<HeroMeta | null>> {
  const res = await B.getHomepageBackend();
  if (!res.ok) return fail(res.error);
  return ok((res.data.hero as HeroMeta | undefined) ?? null);
}

export async function getFlashSaleRail(limit = 5): Promise<Result<{ products: Product[]; endsAt: string }>> {
  const fallbackEnds = () => new Date(Date.now() + 6 * 3600_000).toISOString();
  const res = await B.getHomepageBackend();
  if (!res.ok) return fail(res.error);
  const drops = (res.data.drops ?? []) as Array<{ product: any; ends_at?: string | null }>;
  const products = drops
    .map((d) => d.product)
    .filter(Boolean)
    .map(mapProduct);
  const times = drops
    .map((d) => d.ends_at)
    .filter((t): t is string => typeof t === "string" && t.length > 0)
    .sort();
  return ok({
    products: products.slice(0, limit),
    endsAt: times[0] ?? fallbackEnds(),
  });
}

export async function getFlashSaleProducts(limit = 5): Promise<Result<Product[]>> {
  const res = await getFlashSaleRail(limit);
  if (!res.ok) return fail(res.error);
  return ok(res.data.products);
}

export async function getFlashSaleEndsAt(): Promise<string> {
  const res = await getFlashSaleRail(1);
  if (res.ok) return res.data.endsAt;
  return new Date(Date.now() + 6 * 3600_000).toISOString();
}

// ============================================================================
// Search
// ============================================================================

export async function searchProducts(
  query: string,
  limit = 20,
  opts?: { gender?: "men" | "women" | "kids" | "unisex" },
): Promise<Result<Product[]>> {
  const term = query.trim();
  if (!term) return ok([]);
  const words = tokenizeQuery(term);
  if (words.length === 0) return ok([]);

  // Use backend's /api/catalog/search RPC. The backend runs
  // expand_search_query server-side and forwards synonyms to
  // search_products so "girls dress" → kids+dresses matches.
  const res = await B.searchProductsBackend({
    q: term,
    sort: "relevance",
    limit: Math.max(limit * 2, 40),
    gender: opts?.gender,
  });

  let rawProducts: Array<{ id: string }> = [];
  if (res.ok) {
    rawProducts = res.data.products ?? [];
  }

  // Per-word OR fallback: when the full query returns nothing and
  // contains multiple words (e.g. "girls dress"), retry each word
  // individually and merge the results so partial matches surface.
  if (rawProducts.length === 0 && words.length >= 2) {
    const seen = new Set<string>();
    for (const word of words) {
      const wordRes = await B.searchProductsBackend({
        q: word,
        sort: "relevance",
        limit: Math.max(limit * 2, 40),
      });
      if (wordRes.ok) {
        for (const p of (wordRes.data.products ?? [])) {
          if (!seen.has(p.id)) {
            seen.add(p.id);
            rawProducts.push(p);
          }
        }
      }
    }
  }

  if (!res.ok && rawProducts.length === 0) {
    // Fuzzy fallback via /api/catalog/products with text search.
    const fallback = await B.getProductsBackend({ search: term, limit });
    if (!fallback.ok) return fail(fallback.error);
    return ok(mapProducts(fallback.data.products) ?? []);
  }

  const matchedIds = rawProducts.map((p) => p.id);

  let backendProducts: Product[] = [];
  if (matchedIds.length > 0) {
    const detailsRes = await B.getProductsByIdsBackend(matchedIds);
    if (!detailsRes.ok) return fail(detailsRes.error);
    const browsableStoreIds = await getBrowsableStoreIds();
    backendProducts = (mapProducts(detailsRes.data.products) ?? []).filter((p) =>
      isPublicCatalogProduct(p, browsableStoreIds)
    );
  }

  // Color expansion: also fetch products whose variants match colour terms.
  const colorTerms = new Set<string>();
  for (const word of words) {
    if (isColorWord(word)) {
      for (const variantVal of expandColorTerms(word)) {
        colorTerms.add(variantVal);
      }
    }
  }
  const colorHits: Product[] = [];
  if (colorTerms.size > 0) {
    const colorQ = [...colorTerms].join(" ");
    const extra = await B.getProductsBackend({ search: colorQ, limit });
    if (extra.ok) {
      for (const p of mapProducts(extra.data.products) ?? []) {
        if (!backendProducts.find((b) => b.id === p.id)) colorHits.push(p);
      }
    }
  }

  // Fuzzy fallback if too few — try individual words for broader coverage.
  if (backendProducts.length + colorHits.length < 3 && term.length >= 3) {
    const searchTerms = words.length >= 2 ? [term, ...words] : [term];
    const seen = new Set([...backendProducts, ...colorHits].map((p) => p.id));
    for (const searchTerm of searchTerms) {
      const all = await B.getProductsBackend({ search: searchTerm, limit: 80 });
      if (all.ok) {
        const lower = searchTerm.toLowerCase();
        const mapped = mapProducts(all.data.products) ?? [];
        const fuzzy = mapped.filter((p) => {
          const name = (p.name ?? "").toLowerCase();
          const desc = (p.description ?? "").toLowerCase();
          const short = (p.short_description ?? "").toLowerCase();
          return fuzzyMatch(name, lower, 2) || fuzzyMatch(desc, lower, 2) || fuzzyMatch(short, lower, 2);
        });
        for (const p of fuzzy) {
          if (!seen.has(p.id)) {
            colorHits.push(p);
            seen.add(p.id);
          }
        }
      }
      if (backendProducts.length + colorHits.length >= limit) break;
    }
  }

  // Rank locally by scoring utility, then cap to limit.
  const combined = [...backendProducts, ...colorHits];
  const scored = combined.map((p) => ({ product: p, score: scoreProduct(p, words, term.toLowerCase()) }));
  const ranked = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score).map((s) => s.product);
  return ok(ranked.slice(0, limit));

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
  const res = await B.getSearchSuggestionsBackend(term);
  if (!res.ok) return fail(res.error);
  return ok((res.data.suggestions as SearchSuggestion[]) ?? []);
}

// ============================================================================
// Orders
// ============================================================================

export async function getOrders(_userId: string, limit = 20): Promise<Result<Order[]>> {
  const res = await B.listOrdersBackend(limit);
  if (!res.ok) return fail(res.error);
  const rows = loose<Array<Record<string, unknown>>>(res.data.orders ?? []);
  return ok(rows.map(normalizeOrder));
}

function normalizeOrder(row: Record<string, unknown>): Order {
  return {
    ...(row as unknown as Order),
    order_number: String(row.order_number ?? ""),
    user_id: String(row.user_id ?? ""),
    placed_at: String(row.placed_at ?? row.created_at ?? new Date().toISOString()),
    subtotal: Number(row.subtotal ?? 0),
    discount: Number(row.discount ?? 0),
    shipping_fee: Number(row.shipping_fee ?? 0),
    tax: Number(row.tax ?? 0),
    total: Number(row.total ?? 0),
    currency: String(row.currency ?? "LKR"),
    status: (row.status ?? "pending") as Order["status"],
    payment_status: (row.payment_status ?? "pending") as Order["payment_status"],
    items: Array.isArray(row.items) ? (row.items as Order["items"]) : [],
  };
}

export async function getOrderById(orderId: string): Promise<Result<Order | null>> {
  const res = await B.getOrderByIdBackend(orderId);
  if (!res.ok) return fail(res.error);
  const row = res.data.order;
  return ok(row ? normalizeOrder(row as unknown as Record<string, unknown>) : null);
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
  const res = await B.getOrderTrackingBackend(orderId);
  if (!res.ok) return fail(res.error);
  const events = loose<TrackingEvent[]>(res.data.events ?? []);
  if (events.length === 0 && res.data.order) {
    events.push({
      id: "synthetic",
      order_id: res.data.order.id,
      status: res.data.order.status,
      description: `Order is ${res.data.order.status?.replace?.(/_/g, " ") ?? res.data.order.status}`,
      created_at: (res.data.order as { placed_at?: string }).placed_at ?? new Date().toISOString(),
    });
  }
  const rider = res.data.rider
    ? {
        id: res.data.rider.id,
        name: (res.data.rider as { full_name?: string | null }).full_name ?? "",
        phone: res.data.rider.phone ?? null,
      }
    : null;
  return ok({ order: loose<Order>(res.data.order), events, rider });
}

// ============================================================================
// Addresses
// ============================================================================

export async function getAddresses(_userId: string): Promise<Result<Address[]>> {
  const res = await B.listAddressesBackend();
  if (!res.ok) return fail(res.error);
  return ok(loose<Address[]>(res.data.addresses ?? []));
}

export async function createAddress(addr: Omit<Address, "id">): Promise<Result<Address>> {
  const res = await B.createAddressBackend(addr);
  if (!res.ok) return fail(res.error);
  return ok(loose<Address>(res.data.address));
}

export interface CouponValidation {
  couponId: string | null;
  discount: number;
  message: string;
}

export async function validateCoupon(
  code: string,
  _userId: string,
  orderTotal: number,
  items?: Array<{ product_id: string; store_id: string; quantity: number; unit_price: number }>,
): Promise<Result<CouponValidation>> {
  const res = await B.validateCouponBackend(code, orderTotal, items ?? []);
  if (!res.ok) return fail(res.error);
  if (!res.data.valid) return ok({ couponId: null, discount: 0, message: res.data.reason ?? "Invalid coupon" });
  return ok({
    couponId: res.data.couponId ?? null,
    discount: Number(res.data.discount ?? 0),
    message: res.data.freeShipping ? "Free shipping" : "Coupon applied",
  });
}

export async function updateAddress(id: string, patch: Partial<Address>): Promise<Result<Address>> {
  const res = await B.updateAddressBackend(id, patch);
  if (!res.ok) return fail(res.error);
  return ok(loose<Address>(res.data.address));
}

export async function deleteAddress(id: string): Promise<Result<void>> {
  const res = await B.deleteAddressBackend(id);
  if (!res.ok) return fail(res.error);
  return ok(undefined);
}

// ============================================================================
// Notifications
// ============================================================================

export async function getNotifications(_userId: string, limit = 30): Promise<Result<Notification[]>> {
  const res = await B.listNotificationsBackend(limit);
  if (!res.ok) return fail(res.error);
  return ok(loose<Notification[]>(res.data.notifications ?? []));
}

export async function getSellerNotifications(_limit = 50): Promise<Result<Notification[]>> {
  const res = await B.listSellerNotificationsBackend();
  if (!res.ok) return fail(res.error);
  return ok(loose<Notification[]>(res.data.notifications ?? []));
}

export async function markSellerNotificationRead(id: string): Promise<Result<void>> {
  const res = await B.markSellerNotificationReadBackend(id);
  if (!res.ok) return fail(res.error);
  return ok(undefined);
}

export async function markAllSellerNotificationsRead(): Promise<Result<void>> {
  const res = await B.markAllSellerNotificationsReadBackend();
  if (!res.ok) return fail(res.error);
  return ok(undefined);
}

export async function markNotificationRead(id: string): Promise<Result<void>> {
  const res = await B.markNotificationReadBackend(id);
  if (!res.ok) return fail(res.error);
  return ok(undefined);
}

export async function markAllNotificationsRead(_userId: string): Promise<Result<void>> {
  const res = await B.markAllNotificationsReadBackend();
  if (!res.ok) return fail(res.error);
  return ok(undefined);
}

export async function deleteNotification(id: string): Promise<Result<void>> {
  const res = await B.deleteNotificationBackend(id);
  if (!res.ok) return fail(res.error);
  return ok(undefined);
}

export async function clearAllNotifications(): Promise<Result<void>> {
  const res = await B.clearAllNotificationsBackend();
  if (!res.ok) return fail(res.error);
  return ok(undefined);
}

export async function getReferralInfo(): Promise<Result<B.ReferralInfo>> {
  const res = await B.getReferralInfoBackend();
  if (!res.ok) return fail(res.error);
  return ok(res.data);
}

export async function applyReferralCode(
  code: string,
): Promise<Result<{ applied: boolean; already?: boolean }>> {
  const normalized = code.trim().toUpperCase();
  if (!B.isValidReferralCode(normalized)) {
    return fail("Enter a valid referral code (4–12 letters/numbers).");
  }
  const res = await B.applyReferralCodeBackend(normalized);
  if (!res.ok) return fail(res.error);
  return ok(res.data);
}

export async function listProductQuestions(productId: string): Promise<Result<B.Question[]>> {
  const res = await B.listQuestionsBackend(productId);
  if (!res.ok) return fail(res.error);
  return ok(res.data.questions ?? []);
}

export async function addProductQuestion(productId: string, question: string): Promise<Result<B.Question>> {
  const res = await B.addQuestionBackend(productId, question);
  if (!res.ok) return fail(res.error);
  return ok(res.data.question);
}

// ============================================================================
// Seller — Store, payouts, compliance
// ============================================================================

function slugFromName(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return base || `store-${Date.now()}`;
}

function scopeOrderToStore(order: Order, storeId: string): Order | null {
  const items = (order.items ?? []).filter((i) => (i as { store_id?: string }).store_id === storeId);
  if (items.length === 0) return null;
  const subtotal = items.reduce((s, i) => s + ((i as { total?: number }).total ?? 0), 0);
  return {
    ...order,
    items: items as OrderItem[],
    subtotal,
    total: subtotal,
    discount: 0,
    shipping_fee: 0,
    tax: 0,
  };
}

export async function getSellerStore(_ownerId: string): Promise<Result<Store | null>> {
  const res = await B.getSellerStoreBackend();
  if (!res.ok) return fail(res.error);
  const raw = res.data.store as (Store & Record<string, unknown>) | null;
  if (!raw) return ok(null);
  const mapped = mapStore(raw);
  const contact = readStorefrontContact(mapped as Store & Record<string, unknown>);
  const online =
    typeof mapped.is_online === "boolean"
      ? mapped.is_online
      : typeof (mapped as Store & { is_active?: boolean }).is_active === "boolean"
      ? Boolean((mapped as Store & { is_active?: boolean }).is_active)
      : mapped.is_online;
  return ok(
    loose<Store>({
      ...mapped,
      contact_phone: contact.phone,
      contact_email: contact.email,
      is_online: online,
    }),
  );
}

export async function createSellerStore(
  _ownerId: string,
  input: { name: string; slug?: string; description?: string },
): Promise<Result<Store>> {
  const name = input.name.trim();
  if (!name) return fail("Store name is required");
  const res = await B.createSellerStoreBackend({
    name,
    slug: input.slug?.trim() || undefined,
    description: input.description?.trim() || undefined,
  });
  if (!res.ok) return fail(res.error);
  return ok(loose<Store>(res.data.store));
}

export async function updateSellerStore(id: string, patch: Partial<Store>): Promise<Result<Store>> {
  const res = await B.updateSellerStoreBackend(patch);
  if (!res.ok) return fail(res.error);
  const mapped = mapStore(res.data.store as Store & Record<string, unknown>);
  const contact = readStorefrontContact(mapped as Store & Record<string, unknown>);
  void id;
  return ok(
    loose<Store>({
      ...mapped,
      contact_phone: contact.phone,
      contact_email: contact.email,
    }),
  );
}

export async function getSellerPayoutSettings(_storeId: string): Promise<Result<SellerPayoutCompliance | null>> {
  const res = await B.getSellerPayoutSettingsBackend();
  if (!res.ok) return fail(res.error);
  return ok((res.data.settings as SellerPayoutCompliance | null) ?? null);
}

export async function upsertSellerPayoutSettings(
  _storeId: string,
  patch: SellerPayoutCompliance & { method?: string; schedule?: string },
): Promise<Result<SellerPayoutCompliance>> {
  const res = await B.upsertSellerPayoutSettingsBackend(patch as Record<string, unknown>);
  if (!res.ok) return fail(res.error);
  return ok(res.data.settings as SellerPayoutCompliance);
}

export async function getSellerComplianceDocuments(_storeId: string): Promise<Result<SellerComplianceDocument[]>> {
  const res = await B.getSellerComplianceDocsBackend();
  if (!res.ok) return fail(res.error);
  return ok((res.data.documents as unknown[] as SellerComplianceDocument[]) ?? []);
}

export async function upsertSellerComplianceDocument(
  storeId: string,
  docType: ComplianceDocType,
  fileUrl: string,
  fileName?: string,
): Promise<Result<SellerComplianceDocument>> {
  const res = await B.upsertSellerComplianceDocBackend({
    store_id: storeId,
    doc_type: docType,
    file_url: fileUrl,
    file_name: fileName,
  });
  if (!res.ok) return fail(res.error);
  return ok(res.data.document as SellerComplianceDocument);
}

export async function reviewComplianceDocument(
  docId: string,
  status: "approved" | "rejected",
  reviewNotes?: string,
): Promise<Result<void>> {
  const res = await B.reviewComplianceDocumentBackend(
    docId,
    status,
    { reviewNotes },
  );
  if (!res.ok) return fail(res.error);
  return ok(undefined);
}

export async function assertSellerCanOperate(storeId: string): Promise<Result<void>> {
  // Backend will reject mutations if the seller isn't eligible — call out
  // to /api/seller/store to read the row + payouts + docs and compute the
  // gate locally. This mirrors the legacy client-side check while the
  // server-side enforcement is the real guard.
  try {
    const [storeRes, payoutRes, docsRes] = await Promise.all([
      B.getSellerStoreBackend(),
      B.getSellerPayoutSettingsBackend(),
      B.getSellerComplianceDocsBackend(),
    ]);
    const store = (storeRes.ok ? (storeRes.data.store as Store & Record<string, unknown>) : null);
    if (!store) return fail("Store not found");
    const access = getSellerAccessState(
      store,
      payoutRes.ok ? (payoutRes.data.settings as SellerPayoutCompliance | null) : null,
      docsRes.ok ? (docsRes.data.documents as unknown[] as SellerComplianceDocument[]) : null,
    );
    if (!access.canAccessSellerTools) return fail(access.lockReason ?? "Seller account is not active.");
    void storeId;
    return ok(undefined);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to check seller access");
  }
}

// ============================================================================
// Seller — Products
// ============================================================================

export async function getSellerProducts(storeId: string, opts: {
  status?: string;
  search?: string;
  sort?: "newest" | "oldest" | "price_asc" | "price_desc" | "sales_desc" | "name_asc";
  limit?: number;
  offset?: number;
} = {}): Promise<Result<{ products: Product[]; total: number; stats?: Record<string, number> }>> {
  const res = await B.getSellerProductsBackend({
    limit: opts.limit,
    offset: opts.offset,
    status: opts.status && opts.status !== "all" ? opts.status : undefined,
    search: opts.search,
    sort: opts.sort,
  });
  if (!res.ok) return fail(res.error);
  void storeId;
  const products = (res.data.products as unknown[]).map((p) => mapProduct(p));
  const stats = res.data.stats && typeof res.data.stats === "object" ? res.data.stats : undefined;
  return ok({ products: products ?? [], total: res.data.total ?? products.length, stats });
}

export async function createSellerProduct(product: Partial<Product>): Promise<Result<{ product: Product; moderation: B.SellerModerationBlock }>> {
  if (!product.store_id) return fail("Store is required");
  const guard = await assertSellerCanOperate(product.store_id);
  if (!guard.ok) return guard;
  const res = await B.createSellerProductBackend(product as Partial<B.CatalogProduct> & { name: string; price: number });
  if (!res.ok) return fail(res.error);
  return ok({ product: mapProduct(res.data.product), moderation: res.data.moderation ?? null });
}

export async function updateSellerProduct(id: string, patch: Partial<Product>): Promise<Result<{ product: Product; moderation: B.SellerModerationBlock }>> {
  const res = await B.updateSellerProductBackend(id, patch as Partial<B.CatalogProduct>);
  if (!res.ok) return fail(res.error);
  return ok({ product: mapProduct(res.data.product), moderation: res.data.moderation ?? null });
}

export async function deleteSellerProduct(id: string): Promise<Result<void>> {
  const res = await B.deleteSellerProductBackend(id);
  if (!res.ok) return fail(res.error);
  return ok(undefined);
}

export async function getSellerProductById(productId: string): Promise<Result<Product | null>> {
  const res = await B.getSellerProductByIdBackend(productId);
  if (!res.ok) return fail(res.error);
  return ok(mapProduct(res.data.product));
}

export async function deleteSellerProductImage(productId: string, imageId: string): Promise<Result<void>> {
  const res = await B.deleteSellerProductImageBackend(productId, imageId);
  if (!res.ok) return fail(res.error);
  return ok(undefined);
}

export async function setSellerProductImagePrimary(productId: string, imageId: string): Promise<Result<void>> {
  const res = await B.updateSellerProductImageBackend(productId, imageId, { is_primary: true });
  if (!res.ok) return fail(res.error);
  return ok(undefined);
}

export async function updateSellerProductImage(
  productId: string,
  imageId: string,
  patch: { alt_text?: string | null; position?: number; media_type?: "image" | "video" | "360" },
): Promise<Result<void>> {
  const res = await B.updateSellerProductImageBackend(productId, imageId, patch);
  if (!res.ok) return fail(res.error);
  return ok(undefined);
}

export async function reorderSellerProductImages(
  productId: string,
  order: Array<{ id: string; position: number }>,
): Promise<Result<void>> {
  const res = await B.reorderSellerProductImagesBackend(productId, order);
  if (!res.ok) return fail(res.error);
  return ok(undefined);
}

export async function duplicateSellerProduct(productId: string, storeId: string): Promise<Result<{ id: string }>> {
  const guard = await assertSellerCanOperate(storeId);
  if (!guard.ok) return guard;
  const res = await B.duplicateSellerProductBackend(productId);
  if (!res.ok) return fail(res.error);
  return ok({ id: (res.data as { id: string }).id });
}

export async function bulkSetSellerStatus(
  ids: string[],
  status: "draft" | "active" | "archived",
  storeId: string,
): Promise<Result<{ updated: number }>> {
  const guard = await assertSellerCanOperate(storeId);
  if (!guard.ok) return guard;
  const res = await B.bulkSellerStatusBackend(ids, status);
  if (!res.ok) return fail(res.error);
  return ok({ updated: (res.data as { updated: number }).updated });
}

export async function checkSellerSkuUnique(skus: string[]): Promise<Result<Record<string, boolean>>> {
  if (skus.length === 0) return ok({});
  const res = await B.checkSellerSkuBackend(skus);
  if (!res.ok) return fail(res.error);
  return ok((res.data as { results: Record<string, boolean> }).results);
}

export async function bulkCreateSellerProducts(
  storeId: string,
  products: B.BulkSellerProductInput[],
): Promise<Result<B.BulkSellerProductsResponse>> {
  const guard = await assertSellerCanOperate(storeId);
  if (!guard.ok) return guard;
  const res = await B.bulkSellerProductsBackend(products);
  if (!res.ok) return fail(res.error);
  return ok(res.data);
}

export async function preflightModeration(input: {
  name: string;
  description?: string | null;
  price: number;
  mrp?: number | null;
  brand_id?: string | null;
  category_id?: string | null;
  image_urls?: string[];
  variant_count?: number;
}): Promise<Result<{
  auto_approved: boolean;
  score: number;
  threshold: number;
  flagged: boolean;
  reasons: Array<{ rule_id: string; message: string; weight: number; blocking: boolean }>;
}>> {
  const res = await B.preflightModerationBackend(input);
  if (!res.ok) return fail(res.error);
  return ok(res.data);
}

export interface SellerVariantInput {
  id?: string;
  sku?: string;
  size?: string;
  color?: string;
  color_hex?: string;
  material?: string;
  pattern?: string;
  fit?: string;
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
  const guard = await assertSellerCanOperate(storeId);
  if (!guard.ok) return guard;
  const res = await B.setSellerProductVariantsBackend(productId, {
    variants: variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      size: v.size,
      color: v.color,
      color_hex: v.color_hex,
      material: v.material,
      pattern: v.pattern,
      fit: v.fit,
      price: v.price,
      mrp: v.mrp,
      stock: v.stock,
      position: v.position,
      is_active: v.is_active,
    })),
    removedIds,
  });
  if (!res.ok) return fail(res.error);
  return ok(undefined);
}

// ============================================================================
// Seller — Orders + Inventory
// ============================================================================

export async function getSellerOrders(storeId: string, opts: {
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<Result<{ orders: Order[]; total: number }>> {
  const limit = opts.limit ?? 100;
  const offset = opts.offset ?? 0;
  const res = await B.getSellerOrdersBackend({
    limit,
    offset,
    status: opts.status,
    search: opts.search,
  });
  if (res.ok) {
    const orders = (res.data.orders ?? []).map((row) => mapSellerOrderRow(row));
    const totalRaw = res.data.total;
    const total = typeof totalRaw === "number" && Number.isFinite(totalRaw) ? totalRaw : orders.length;
    return ok({ orders, total });
  }
  if (!isAmbiguousRelationshipError(res.error)) return fail(res.error);
  return loadSellerOrdersDirect(storeId, limit, offset, opts.status, opts.search);
}

async function loadSellerOrdersDirect(
  storeId: string,
  limit: number,
  offset: number,
  status?: string,
  search?: string,
): Promise<Result<{ orders: Order[]; total: number }>> {
  let itemQuery = supabase
    .from("order_items")
    .select("order_id, orders!inner(id, status, order_number)")
    .eq("store_id", storeId)
    .order("order_id", { ascending: false })
    .limit(Math.min(limit + offset + 500, 2000));
  if (status) itemQuery = itemQuery.eq("orders.status", status);
  const { data: itemRows, error: itemErr } = await itemQuery;
  if (itemErr) return fail(itemErr.message);
  const seen = new Set<string>();
  const orderIds: string[] = [];
  const searchLower = (search ?? "").trim().toLowerCase();
  for (const row of itemRows ?? []) {
    const oid = (row as { order_id?: string }).order_id;
    if (!oid || seen.has(oid)) continue;
    if (searchLower) {
      const ord = (row as { orders?: { order_number?: string } | null }).orders;
      const num = String(ord?.order_number ?? "").toLowerCase();
      if (!num.includes(searchLower) && !oid.toLowerCase().includes(searchLower)) continue;
    }
    seen.add(oid);
    orderIds.push(oid);
  }
  const pageIds = orderIds.slice(offset, offset + limit);
  if (pageIds.length === 0) return ok({ orders: [], total: orderIds.length });
  const { data, error } = await supabase
    .from("orders")
    .select(SELLER_ORDERS_LIST_SELECT)
    .in("id", pageIds)
    .order("placed_at", { ascending: false });
  if (error) return fail(error.message);
  return ok({
    orders: (data ?? []).map((row) => mapSellerOrderRow(row)),
    total: orderIds.length,
  });
}

export async function getSellerOrderById(orderId: string, storeId: string): Promise<Result<Order | null>> {
  const seller = await B.getSellerOrderByIdBackend(orderId);
  let raw: unknown = null;
  if (seller.ok) {
    const payload = seller.data as { order?: unknown } & Record<string, unknown>;
    raw = payload.order ?? (typeof payload.id === "string" ? payload : null);
  }
  // Never embed users here — orders has 3 FKs to users and PostgREST rejects
  // unqualified embeds. Seller UI reads buyer contact from shipping_address.
  const safeDetailSelect =
    "id, order_number, status, payment_status, payment_method, subtotal, discount, shipping_fee, tax, total, currency, placed_at, updated_at, delivered_at, user_id, notes, shipping_address, delivery_person_id, delivery_otp, courier_mode, address_id, metadata, " +
    "items:order_items!order_items_order_id_fkey!inner(" +
    "id, order_id, product_id, variant_id, store_id, product_name, variant_label, sku, quantity, unit_price, total, status, " +
    "product:products!order_items_product_id_fkey(name, images:product_images!product_images_product_id_fkey(url, is_primary))" +
    "), " +
    "address:addresses!address_id(*)";

  if (!raw && !seller.ok) {
    const { data, error } = await supabase
      .from("orders")
      .select(safeDetailSelect)
      .eq("id", orderId)
      .eq("items.store_id", storeId)
      .maybeSingle();
    if (!error && data) raw = data;
  }
  if (!raw) {
    const res = await B.getOrderByIdBackend(orderId);
    if (!res.ok) {
      const msg = seller.ok
        ? "Order not found"
        : isAmbiguousRelationshipError(seller.error)
          ? "Couldn’t load this order. Pull to refresh, or try again in a moment."
          : seller.error;
      return fail(msg);
    }
    raw = res.data.order;
  }
  if (!raw) return ok(null);
  return ok(scopeOrderToStore(loose<Order>(raw), storeId));
}

export async function transitionOrderStatus(
  orderId: string,
  status: string,
  opts?: { reason?: string; adminOverride?: boolean; skipClientGuard?: boolean },
): Promise<Result<{ status: string }>> {
  if (!opts?.skipClientGuard) {
    const sellerStore = await B.getSellerStoreBackend();
    if (!sellerStore.ok) return fail(sellerStore.error);
  }
  const res = await B.transitionOrderBackend(orderId, status, opts?.reason);
  if (!res.ok) return fail(res.error);
  return ok({ status: res.data.order?.status ?? status });
}

export async function cancelOrder(orderId: string, reason?: string): Promise<Result<{ status: string }>> {
  const res = await B.cancelOrderBackend(orderId, reason);
  if (!res.ok) return fail(res.error);
  return ok({ status: res.data.order?.status ?? "cancelled" });
}

export async function cancelOrderItems(
  orderId: string,
  itemIds: string[],
): Promise<Result<{ cancelled: number; remaining_items: number }>> {
  if (itemIds.length === 0) return fail("No items selected for cancellation");
  const res = await B.cancelOrderItemsBackend(orderId, itemIds);
  if (!res.ok) return fail(res.error);
  return ok({ cancelled: 0, remaining_items: res.data.order?.items?.length ?? 0 });
}

export async function getSellerInventory(_storeId: string): Promise<Result<{
  product: Product;
  variants: (ProductVariant & { quantity: number | null; reserved: number; available: number | null; stock: number | null })[];
}[]>> {
  const res = await B.getSellerInventoryBackend();
  if (!res.ok) return fail(res.error);
  const list = (res.data.inventory as unknown[]).map((row) => {
    const r = row as {
      id?: string;
      variant_id?: string;
      sku: string;
      size?: string;
      color?: string;
      color_hex?: string;
      price?: number;
      mrp?: number;
      quantity?: number;
      reserved?: number;
      stock?: number;
      on_hand?: number;
      available?: number;
      image?: string;
      image_url?: string;
      product?: {
        id: string;
        name: string;
        status?: string;
        price?: number;
        image_url?: string;
        image?: string;
        images?: { url: string; is_primary?: boolean }[];
      };
      inventory?: { quantity?: number; reserved?: number; on_hand?: number } | Array<{ quantity?: number; reserved?: number; on_hand?: number }>;
    };
    const qty = readInventoryQuantities({
      quantity: r.quantity,
      reserved: r.reserved,
      stock: r.stock,
      on_hand: r.on_hand,
      available: r.available,
      inventory: r.inventory,
      product: r.product,
    });
    const priceRaw = r.price ?? r.product?.price ?? r.mrp;
    const price = typeof priceRaw === "number" ? priceRaw : Number(priceRaw);
    const imgs = r.product?.images;
    const fromImgs = Array.isArray(imgs)
      ? (imgs.find((i) => i?.is_primary)?.url || imgs[0]?.url)
      : undefined;
    const imageRaw = fromImgs || r.product?.image_url || r.product?.image || r.image_url || r.image;
    const image = imageRaw ? resolveImageUrl(String(imageRaw)) : undefined;
    const variant: ProductVariant & { quantity: number | null; reserved: number; available: number | null; stock: number | null } = {
      id: r.variant_id ?? r.id ?? r.sku,
      sku: r.sku,
      size: r.size,
      color: r.color,
      color_hex: r.color_hex,
      price: Number.isFinite(price) ? price : undefined,
      quantity: qty.quantity,
      reserved: qty.reserved,
      available: qty.available,
      stock: qty.quantity,
      is_active: true,
    } as ProductVariant & { quantity: number | null; reserved: number; available: number | null; stock: number | null };
    return {
      product: {
        id: r.product?.id ?? "",
        name: r.product?.name ?? r.sku,
        status: r.product?.status,
        images: image ? [{ url: image, is_primary: true, position: 0 }] : [],
      } as unknown as Product,
      variants: [variant],
    };
  });
  return ok(list);
}

export async function updateVariantStock(productId: string, variantId: string, stock: number): Promise<Result<void>> {
  const res = await B.updateVariantStockBackend(productId, variantId, stock);
  if (!res.ok) return fail(res.error);
  return ok(undefined);
}

function firstFiniteNumber(...vals: unknown[]): number | null {
  for (const v of vals) {
    const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export async function getSellerKPIs(_storeId: string): Promise<Result<{
  totalRevenue: number;
  totalOrders: number;
  totalProducts: number;
  pendingOrders: number;
  returnsCount: number;
  lowStockVariants: number;
  outOfStockVariants: number;
  totalSkus: number;
  recentOrders: Order[];
  topProducts: Array<{ id: string; name: string; revenue: number }>;
  revenueSeries: Array<{ date: string; revenue: number; orders: number }>;
  revenueDelta: number;
  ordersDelta: number;
  aov: number;
  refundRate: number;
  analyticsReady: boolean;
  inventoryReady: boolean;
  productsReady: boolean;
  ordersReady: boolean;
  pendingReady: boolean;
  returnsReady: boolean;
}>> {
  const [kpis, orders, products, inventory, pending, returns] = await Promise.all([
    B.getSellerKPIsBackend(),
    B.getSellerOrdersBackend({ limit: 5 }),
    B.getSellerProductsBackend({ limit: 1 }),
    B.getSellerInventoryBackend(),
    // `pending` and `returns` are not part of the analytics payload, so
    // count them off their own endpoints instead of reporting zero.
    B.getSellerOrdersBackend({ status: "pending", limit: 1 }),
    B.getSellerReturnsBackend({ status: "requested" }),
  ]);

  if (!kpis.ok && !orders.ok && !products.ok && !inventory.ok) {
    return fail(kpis.error || orders.error || products.error || inventory.error || "Could not load seller metrics");
  }

  const recentOrders = orders.ok ? loose<Order[]>(orders.data.orders ?? []).slice(0, 5) : [];

  const stats = products.ok && products.data.stats && typeof products.data.stats === "object"
    ? products.data.stats
    : undefined;
  const listedCount = products.ok
    ? firstFiniteNumber(products.data.total, stats?.all, stats?.total)
    : null;

  const health = inventory.ok
    ? summarizeInventoryHealth(inventory.data.inventory ?? [])
    : { totalSkus: 0, healthyCount: 0, lowStockVariants: 0, outOfStockVariants: 0 };
  const kpiData = kpis.ok ? kpis.data : null;
  const pendingCount = pending.ok
    ? (firstFiniteNumber(pending.data.total) ?? (pending.data.orders ?? []).length)
    : 0;
  const returnsCount = returns.ok ? (returns.data.returns ?? []).length : 0;

  return ok({
    totalRevenue: Number(kpiData?.revenue ?? 0),
    totalOrders: Number(kpiData?.orders ?? 0),
    totalProducts: listedCount ?? 0,
    pendingOrders: pendingCount,
    returnsCount,
    lowStockVariants: health.lowStockVariants,
    outOfStockVariants: health.outOfStockVariants,
    totalSkus: health.totalSkus,
    recentOrders,
    topProducts: kpiData?.topProducts ?? [],
    revenueSeries: kpiData?.series ?? [],
    revenueDelta: kpiData?.deltas.revenue ?? 0,
    ordersDelta: kpiData?.deltas.orders ?? 0,
    aov: Number(kpiData?.aov ?? 0),
    refundRate: Number(kpiData?.refundRate ?? 0),
    analyticsReady: kpis.ok,
    inventoryReady: inventory.ok,
    productsReady: products.ok && listedCount != null,
    ordersReady: orders.ok,
    pendingReady: pending.ok,
    returnsReady: returns.ok,
  });
}

// ============================================================================
// Delivery — re-export wrappers from delivery-api (skip rider-portal pieces)
// ============================================================================

export {
  deliveryTransition,
  deliveryVerify,
  deliveryPickupVerify,
  deliveryProofUpload,
  getReturnPickups,
  getOrderPackage,
  resolvePackageQr,
  scanPackage,
  verifyPackageDelivery,
  extractPackageToken,
  hasStoreApi,
  getDeliveryPipelineZones,
  isReassignAvailable,
  reassignDelivery,
} from "./delivery-api";
export type { ReturnPickup, PackageMeta, PackageScanAction, DeliveryPipelineZone } from "./delivery-api";

export async function getRiderOrders(_riderId: string): Promise<Result<Order[]>> {
  // Skipped per user — delivery company + rider portal out of scope.
  return ok([]);
}

export async function getRiderPickupRuns(_riderId: string): Promise<Result<Order[]>> {
  return ok([]);
}

export async function riderStartDelivery(orderId: string): Promise<Result<{ otp: string }>> {
  if (hasStoreApi()) {
    const res = await deliveryTransition(orderId, "out_for_delivery");
    if (!res.ok) return fail(res.error);
    return ok({ otp: "------" });
  }
  return fail("Delivery rider portal skipped in mobile flip");
}

export async function riderVerifyDelivery(
  orderId: string,
  otp: string,
  proofUrl?: string | null,
  signatureUrl?: string | null,
): Promise<Result<void>> {
  if (hasStoreApi()) {
    const res = await deliveryVerify(orderId, otp, {
      proof_url: proofUrl,
      signature_url: signatureUrl,
    });
    return res.ok ? ok(undefined) : fail(res.error);
  }
  return fail("Delivery rider portal skipped in mobile flip");
}

export async function riderReportIssue(
  orderId: string,
  reason: string,
  status: "returned" | "cancelled",
  opts?: {
    failure_reason?: IssueReason;
    failure_notes?: string;
    failure_evidence_url?: string | null;
    attempt_count?: number;
    next_retry_at?: string | null;
  },
): Promise<Result<void>> {
  if (hasStoreApi()) {
    const res = await deliveryTransition(orderId, status, reason, opts);
    return res.ok ? ok(undefined) : fail(res.error);
  }
  return fail("Delivery rider portal skipped in mobile flip");
}

export async function riderReschedule(orderId: string, opts?: { next_retry_at?: string }): Promise<Result<void>> {
  if (hasStoreApi()) {
    const res = await deliveryTransition(orderId, "out_for_delivery", undefined, {
      next_retry_at: opts?.next_retry_at ?? null,
    });
    return res.ok ? ok(undefined) : fail(res.error);
  }
  return fail("Delivery rider portal skipped in mobile flip");
}

export async function getRiderHistory(_riderId: string): Promise<Result<Order[]>> {
  return ok([]);
}

// ============================================================================
// Brand owner
// ============================================================================

export async function getBrandByOwner(_ownerId: string): Promise<Result<Brand | null>> {
  const res = await B.getBrandByOwnerBackend();
  if (!res.ok) return fail(res.error);
  return ok(loose<Brand | null>(res.data.brand ?? null));
}

export async function updateBrand(id: string, patch: Partial<Brand>): Promise<Result<Brand>> {
  const res = await B.updateBrandBackend(patch);
  if (!res.ok) return fail(res.error);
  return ok(loose<Brand>(res.data.brand));
}

export async function getBrandProducts(brandId: string, opts: {
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<Result<{ products: Product[]; total: number }>> {
  const res = await B.getBrandProductsBackend({
    limit: opts.limit,
    offset: opts.offset,
    status: opts.status && opts.status !== "all" ? opts.status : undefined,
    search: opts.search,
  });
  if (!res.ok) return fail(res.error);
  void brandId;
  return ok({ products: mapProducts(res.data.products) ?? [], total: res.data.products?.length ?? 0 });
}

export async function getBrandOrders(brandId: string, opts: {
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<Result<Order[]>> {
  const res = await B.getBrandOrdersBackend({
    limit: opts.limit,
    offset: opts.offset,
    status: opts.status && opts.status !== "all" ? opts.status : undefined,
  });
  if (!res.ok) return fail(res.error);
  void brandId;
  return ok(loose<Order[]>(res.data.orders ?? []));
}

export async function getBrandKPIs(brandId: string): Promise<Result<{
  totalProducts: number;
  activeProducts: number;
  totalOrders: number;
  totalRevenue: number;
}>> {
  const res = await B.getBrandKPIsBackend();
  if (!res.ok) return fail(res.error);
  return ok({
    totalProducts: (res.data as { totalProducts?: number }).totalProducts ?? 0,
    activeProducts: (res.data as { activeProducts?: number }).activeProducts ?? 0,
    totalOrders: res.data.orders ?? 0,
    totalRevenue: res.data.revenue ?? 0,
  });
  void brandId;
}

// ----- Brand portal reads -----

export async function getBrandAnalytics(): Promise<Result<B.BrandAnalytics>> {
  return fromB(await B.getBrandAnalyticsBackend());
}
export async function getBrandInventory(): Promise<Result<B.BrandInventoryRow[]>> {
  const r = await B.getBrandInventoryBackend();
  return r.ok ? ok(r.data.inventory ?? []) : fail(r.error);
}
export async function getBrandReturns(): Promise<Result<B.BrandReturn[]>> {
  const r = await B.getBrandReturnsBackend();
  return r.ok ? ok(r.data.returns ?? []) : fail(r.error);
}
export async function getBrandReviews(): Promise<Result<B.BrandReview[]>> {
  const r = await B.getBrandReviewsBackend();
  return r.ok ? ok(r.data.reviews ?? []) : fail(r.error);
}
export async function getBrandCoupons(): Promise<Result<B.BrandCoupon[]>> {
  const r = await B.getBrandCouponsBackend();
  return r.ok ? ok(r.data.coupons ?? []) : fail(r.error);
}
export async function getBrandFollowers(): Promise<Result<B.BrandFollower[]>> {
  const r = await B.getBrandFollowersBackend();
  return r.ok ? ok(r.data.followers ?? []) : fail(r.error);
}
export async function getBrandInfluencers(): Promise<Result<B.BrandInfluencer[]>> {
  const r = await B.getBrandInfluencersBackend();
  return r.ok ? ok(r.data.collaborations ?? []) : fail(r.error);
}
export async function getBrandCollections(): Promise<Result<B.BrandCollection[]>> {
  const r = await B.getBrandCollectionsBackend();
  return r.ok ? ok(r.data.collections ?? []) : fail(r.error);
}
export async function getBrandCampaigns(): Promise<Result<B.BrandCampaign[]>> {
  const r = await B.getBrandCampaignsBackend();
  return r.ok ? ok(r.data.campaigns ?? []) : fail(r.error);
}
export async function getBrandPayouts(): Promise<Result<B.BrandPayout[]>> {
  const r = await B.getBrandPayoutsBackend();
  return r.ok ? ok(r.data.payouts ?? []) : fail(r.error);
}
export async function getBrandPayoutsBalance(): Promise<Result<B.BrandPayoutsBalance>> {
  return fromB(await B.getBrandPayoutsBalanceBackend());
}
export async function getBrandNotifications(): Promise<Result<B.BrandNotification[]>> {
  const r = await B.getBrandNotificationsBackend();
  return r.ok ? ok(r.data.notifications ?? []) : fail(r.error);
}
export async function getBrandTeam(): Promise<Result<B.BrandTeamMember[]>> {
  const r = await B.getBrandTeamBackend();
  return r.ok ? ok(r.data.members ?? []) : fail(r.error);
}
export async function getBrandTeamInvites(): Promise<Result<B.BrandTeamInvite[]>> {
  const r = await B.getBrandTeamInvitesBackend();
  return r.ok ? ok(r.data.invites ?? []) : fail(r.error);
}
export async function getBrandSettings(): Promise<Result<B.BrandSettings>> {
  const r = await B.getBrandSettingsBackend();
  return r.ok ? ok(loose<B.BrandSettings>(r.data.settings ?? {})) : fail(r.error);
}
export async function getBrandBranding(): Promise<Result<B.BrandBranding>> {
  const r = await B.getBrandBrandingBackend();
  return r.ok ? ok(loose<B.BrandBranding>(r.data.branding ?? {})) : fail(r.error);
}
export async function getBrandOrderById(id: string): Promise<Result<Order>> {
  const r = await B.getBrandOrderByIdBackend(id);
  return r.ok ? ok(loose<Order>(r.data.order)) : fail(r.error);
}

// ----- Brand portal mutations -----

export async function updateBrandBranding(patch: Partial<B.BrandBranding>): Promise<Result<B.BrandBranding>> {
  const r = await B.updateBrandBrandingBackend(patch);
  return r.ok ? ok(loose<B.BrandBranding>(r.data.branding ?? {})) : fail(r.error);
}
export async function updateBrandSettings(patch: Partial<B.BrandSettings>): Promise<Result<B.BrandSettings>> {
  const r = await B.updateBrandSettingsBackend(patch);
  return r.ok ? ok(loose<B.BrandSettings>(r.data.settings ?? {})) : fail(r.error);
}

export async function createBrandCampaign(input: Parameters<typeof B.createBrandCampaignBackend>[0]): Promise<Result<B.BrandCampaign>> {
  const r = await B.createBrandCampaignBackend(input);
  return r.ok ? ok(loose<B.BrandCampaign>(r.data.campaign)) : fail(r.error);
}
export async function updateBrandCampaign(id: string, patch: Parameters<typeof B.updateBrandCampaignBackend>[1]): Promise<Result<B.BrandCampaign>> {
  const r = await B.updateBrandCampaignBackend(id, patch);
  return r.ok ? ok(loose<B.BrandCampaign>(r.data.campaign)) : fail(r.error);
}
export async function deleteBrandCampaign(id: string): Promise<Result<{ deleted: boolean; id: string }>> {
  return fromB(await B.deleteBrandCampaignBackend(id));
}

export async function createBrandCollection(input: Parameters<typeof B.createBrandCollectionBackend>[0]): Promise<Result<B.BrandCollection>> {
  const r = await B.createBrandCollectionBackend(input);
  return r.ok ? ok(loose<B.BrandCollection>(r.data.collection)) : fail(r.error);
}
export async function updateBrandCollection(id: string, patch: Parameters<typeof B.updateBrandCollectionBackend>[1]): Promise<Result<B.BrandCollection>> {
  const r = await B.updateBrandCollectionBackend(id, patch);
  return r.ok ? ok(loose<B.BrandCollection>(r.data.collection)) : fail(r.error);
}
export async function deleteBrandCollection(id: string): Promise<Result<{ deleted: boolean; id: string }>> {
  return fromB(await B.deleteBrandCollectionBackend(id));
}

export async function createBrandCoupon(input: Parameters<typeof B.createBrandCouponBackend>[0]): Promise<Result<B.BrandCoupon>> {
  const r = await B.createBrandCouponBackend(input);
  return r.ok ? ok(loose<B.BrandCoupon>(r.data.coupon)) : fail(r.error);
}
export async function updateBrandCoupon(id: string, patch: Parameters<typeof B.updateBrandCouponBackend>[1]): Promise<Result<B.BrandCoupon>> {
  const r = await B.updateBrandCouponBackend(id, patch);
  return r.ok ? ok(loose<B.BrandCoupon>(r.data.coupon)) : fail(r.error);
}
export async function deleteBrandCoupon(id: string): Promise<Result<{ deleted: boolean; id: string }>> {
  return fromB(await B.deleteBrandCouponBackend(id));
}

export async function deleteBrandProduct(id: string): Promise<Result<{ deleted: boolean; id: string }>> {
  return fromB(await B.deleteBrandProductBackend(id));
}

export async function markBrandNotifications(input: { ids?: string[]; mark_all?: boolean }): Promise<Result<{ marked: number }>> {
  return fromB(await B.markBrandNotificationsBackend(input));
}

export async function inviteBrandTeamMember(input: { email: string; role: "manager" | "staff" | "viewer" }): Promise<Result<{ id: string; email: string; role: string; token: string }>> {
  const r = await B.inviteBrandTeamMemberBackend(input);
  return r.ok ? ok(r.data.invite) : fail(r.error);
}
export async function cancelBrandInvite(inviteId: string): Promise<Result<{ cancelled: boolean; id: string }>> {
  return fromB(await B.cancelBrandInviteBackend(inviteId));
}
export async function resendBrandInvite(inviteId: string): Promise<Result<{ invite: B.BrandTeamInvite; resent: boolean }>> {
  return fromB(await B.resendBrandInviteBackend(inviteId));
}
export async function removeBrandMember(memberId: string): Promise<Result<{ removed: boolean; id: string }>> {
  return fromB(await B.removeBrandMemberBackend(memberId));
}
export async function updateBrandMember(memberId: string, patch: { role?: "manager" | "staff" | "viewer"; status?: "active" | "suspended" }): Promise<Result<B.BrandTeamMember>> {
  const r = await B.updateBrandMemberBackend(memberId, patch);
  return r.ok ? ok(loose<B.BrandTeamMember>(r.data.member)) : fail(r.error);
}

// ----- Public brand flows -----

export async function checkBrandSlug(slug: string): Promise<Result<{ available: boolean }>> {
  return fromB(await B.checkBrandSlugBackend(slug));
}
export async function submitBrandApplication(input: Parameters<typeof B.submitBrandApplicationBackend>[0]): Promise<Result<Brand>> {
  const r = await B.submitBrandApplicationBackend(input);
  return r.ok ? ok(loose<Brand>(r.data.brand)) : fail(r.error);
}
export async function acceptBrandInvite(token: string): Promise<Result<{ accepted: boolean; brand_id: string }>> {
  return fromB(await B.acceptBrandInviteBackend(token));
}

// ============================================================================
// Admin
// ============================================================================

export async function getAdminStats(): Promise<Result<{
  totalUsers: number;
  totalStores: number;
  totalProducts: number;
  totalOrders: number;
  totalRevenue: number;
  pendingStores: number;
  pendingProducts: number;
}>> {
  const res = await getAdminOverviewStats();
  if (res.ok && res.data) {
    return ok({
      totalUsers: res.data.users,
      totalStores: res.data.stores,
      totalProducts: res.data.products,
      totalOrders: res.data.orders,
      totalRevenue: res.data.revenue,
      pendingStores: res.data.pendingStores,
      pendingProducts: res.data.pendingProducts,
    });
  }
  const backendRes = await B.getAdminStatsBackend();
  if (!backendRes.ok) return fail(backendRes.error);
  return ok({
    totalUsers: (backendRes.data as { users?: number }).users ?? 0,
    totalStores: (backendRes.data as { stores?: number }).stores ?? 0,
    totalProducts: (backendRes.data as { products?: number }).products ?? 0,
    totalOrders: (backendRes.data as { orders?: number }).orders ?? 0,
    totalRevenue: 0,
    pendingStores: 0,
    pendingProducts: 0,
  });
}

export async function getAdminUsers(opts: {
  role?: string;
  search?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<Result<{ users: User[]; total: number }>> {
  const cleanOpts = { ...opts };
  if (cleanOpts.role === "all") delete cleanOpts.role;

  try {
    const res = await B.getAdminUsersBackend(cleanOpts);
    if (res.ok && res.data && Array.isArray(res.data.users)) {
      return ok({
        users: loose<User[]>(res.data.users),
        total: res.data.total ?? res.data.users.length,
      });
    }
  } catch (_e) {}

  try {
    let q = supabase
      .from("users")
      .select("id, email, full_name, role, is_suspended, is_verified, created_at", { count: "exact" });

    if (cleanOpts.role && cleanOpts.role !== "all") {
      q = q.eq("role", cleanOpts.role);
    }
    if (cleanOpts.search && cleanOpts.search.trim()) {
      const s = `%${cleanOpts.search.trim()}%`;
      q = q.or(`full_name.ilike.${s},email.ilike.${s}`);
    }

    const limit = cleanOpts.limit ?? 50;
    const offset = cleanOpts.offset ?? 0;
    const { data, count, error } = await q
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return fail(error.message);
    return ok({
      users: loose<User[]>((data ?? []) as unknown as User[]),
      total: count ?? (data?.length ?? 0),
    });
  } catch (err: any) {
    return fail(err?.message ?? "Failed to fetch users");
  }
}

export async function updateUserRole(userId: string, role: string): Promise<Result<void>> {
  try {
    const res = await B.updateUserRoleBackend(userId, role);
    if (res.ok) return ok(undefined);
  } catch (_e) {}

  try {
    const { error } = await supabase.from("users").update({ role }).eq("id", userId);
    if (error) return fail(error.message);
    return ok(undefined);
  } catch (err: any) {
    return fail(err?.message ?? "Failed to update user role");
  }
}

export async function getAdminStores(opts: {
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<Result<{ stores: (Store & { complianceGaps: string[] })[]; total: number }>> {
  const cleanOpts = { ...opts };
  if (cleanOpts.status === "all") delete cleanOpts.status;

  try {
    const res = await B.getAdminStoresBackend(cleanOpts);
    if (res.ok && res.data && Array.isArray(res.data.stores)) {
      const stores = (res.data.stores as (Store & { complianceGaps?: string[] })[]).map((s) => ({
        ...s,
        complianceGaps: s.complianceGaps ?? [],
      }));
      return ok({ stores, total: res.data.total ?? stores.length });
    }
  } catch (_e) {}

  try {
    const { status, search, limit = 50, offset = 0 } = opts;
    let q = supabase
      .from("stores")
      .select("id, name, slug, owner_id, is_verified, is_suspended, status, logo_url, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status && status !== "all") q = q.eq("status", status);
    if (search && search.trim()) q = q.ilike("name", `%${search.trim()}%`);

    const { data, count, error } = await q;
    if (error) return fail(error.message);
    const rows = ((data ?? []) as unknown as Store[]).map((s) => ({ ...s, complianceGaps: [] }));
    return ok({ stores: rows as (Store & { complianceGaps: string[] })[], total: count ?? rows.length });
  } catch (err: any) {
    return fail(err?.message ?? "Failed to fetch stores");
  }
}

export async function approveStore(storeId: string, status: "approved" | "rejected"): Promise<Result<void>> {
  try {
    const res = await B.approveStoreBackend(storeId, status === "approved" ? "approved" : "rejected");
    if (res.ok) return ok(undefined);
  } catch (_e) {}

  const patch = {
    status,
    ...(status === "approved" ? { approved_at: new Date().toISOString() } : {}),
  };
  const { error } = await supabase.from("stores").update(patch).eq("id", storeId);
  if (error) return fail(error.message);
  return ok(undefined);
}

export async function updateStoreStatus(storeId: string, status: string): Promise<Result<void>> {
  if (status === "approved") return approveStore(storeId, "approved");
  const res = await B.approveStoreBackend(storeId, status as "approved" | "rejected" | "suspended");
  if (!res.ok) return fail(res.error);
  return ok(undefined);
}

export interface AdminStoreDetail {
  store: Store & {
    owner?: { id: string; full_name?: string | null; email?: string | null; phone?: string | null } | null;
    products?: { id: string; name: string; status: string; total_sales?: number }[];
  };
  payout: SellerPayoutCompliance | null;
  documents: SellerComplianceDocument[];
  complianceGaps: string[];
}

export async function getAdminStoreDetail(id: string): Promise<Result<AdminStoreDetail | null>> {
  // Backend-first: GET /api/admin/stores/:id returns { store, owner, products }.
  // There is no admin payout endpoint, so payout stays null (the detail
  // screen already renders payout rows as missing). Compliance docs are
  // best-effort via Supabase; failures degrade to an empty list, never null.
  try {
    const res = await B.getAdminStoreDetailBackend(id);
    if (res.ok && res.data) {
      const raw = res.data as {
        store?: Record<string, unknown>;
        owner?: AdminStoreDetail["store"]["owner"];
        products?: AdminStoreDetail["store"]["products"];
      };
      if (raw.store && typeof raw.store === "object") {
        let documents: SellerComplianceDocument[] = [];
        try {
          const { data } = await supabase
            .from("compliance_documents")
            .select("id, doc_type, file_url, file_name, status")
            .eq("store_id", id);
          if (Array.isArray(data)) documents = data as unknown as SellerComplianceDocument[];
        } catch (_e) {}
        const store = {
          ...(raw.store as unknown as Store),
          owner: raw.owner ?? null,
          products: raw.products ?? [],
        } as AdminStoreDetail["store"];
        return ok({
          store,
          payout: null,
          documents,
          complianceGaps: getSellerComplianceGaps(
            store as unknown as Store & Record<string, unknown>,
            null,
            documents,
          ),
        });
      }
    }
  } catch (_e) {}

  // Supabase fallback for environments where the detail route is unavailable.
  try {
    const [{ data: storeRow }, { data: ownerRow }, { data: productRows }, { data: docRows }] = await Promise.all([
      supabase.from("stores").select("*").eq("id", id).maybeSingle(),
      supabase.from("stores").select("owner_id").eq("id", id).maybeSingle().then(async (s) => {
        const ownerId = (s.data as { owner_id?: string } | null)?.owner_id;
        if (!ownerId) return { data: null };
        return supabase.from("users").select("id, full_name, email, phone").eq("id", ownerId).maybeSingle();
      }),
      supabase.from("products").select("id, name, status, total_sales").eq("store_id", id).limit(100),
      supabase.from("compliance_documents").select("id, doc_type, file_url, file_name, status").eq("store_id", id),
    ]);
    if (!storeRow) return ok(null);
    const documents = (Array.isArray(docRows) ? docRows : []) as unknown as SellerComplianceDocument[];
    const store = {
      ...(storeRow as unknown as Store),
      owner: (ownerRow as AdminStoreDetail["store"]["owner"]) ?? null,
      products: ((Array.isArray(productRows) ? productRows : []) as AdminStoreDetail["store"]["products"]) ?? [],
    } as AdminStoreDetail["store"];
    return ok({
      store,
      payout: null,
      documents,
      complianceGaps: getSellerComplianceGaps(
        store as unknown as Store & Record<string, unknown>,
        null,
        documents,
      ),
    });
  } catch (err: any) {
    return fail(err?.message ?? "Failed to fetch store detail");
  }
}

export async function getAdminOrders(opts: {
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<Result<Order[]>> {
  const cleanOpts = { ...opts };
  if (cleanOpts.status === "all") delete cleanOpts.status;

  try {
    const res = await B.getAdminOrdersBackend(cleanOpts);
    if (res.ok && res.data && Array.isArray(res.data.orders)) {
      return ok(loose<Order[]>(res.data.orders));
    }
  } catch (_e) {
    // fall through to direct Supabase
  }

  try {
    const { status, search, limit = 50, offset = 0 } = opts;
    let q = supabase
      .from("orders")
      .select(
        "id, order_number, user_id, status, payment_status, payment_method, subtotal, discount, shipping_fee, tax, total, currency, placed_at, delivered_at, created_at, user:users!orders_user_id_fkey(id, full_name, email), order_items:order_items(id, product_id, quantity, unit_price, total, product:products(name, slug))",
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status && status !== "all") {
      q = q.eq("status", status);
    }
    if (search && search.trim()) {
      q = q.or(`order_number.ilike.%${search.trim()}%,id.ilike.%${search.trim()}%`);
    }

    const { data, error } = await q;
    if (error) {
      const fallbackQ = await supabase
        .from("orders")
        .select(
          "id, order_number, user_id, status, payment_status, payment_method, subtotal, discount, shipping_fee, tax, total, currency, placed_at, delivered_at, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(limit);
      if (fallbackQ.data) return ok(loose<Order[]>(fallbackQ.data));
      return fail(error.message);
    }
    return ok(loose<Order[]>(data ?? []));
  } catch (err: any) {
    return fail(err?.message ?? "Failed to fetch orders");
  }
}

export async function getAdminProducts(opts: {
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<Result<{ products: Product[]; total: number }>> {
  try {
    const res = await B.getAdminProductsBackend(opts);
    if (res.ok && res.data && Array.isArray(res.data.products)) {
      return ok({
        products: mapProducts(res.data.products as unknown[]) ?? (res.data.products as Product[]) ?? [],
        total: res.data.total ?? res.data.products.length,
      });
    }
  } catch (_e) {
    // fall through to direct Supabase
  }

  // Resilient fallback to direct Supabase query
  try {
    const { status, search, limit = 50, offset = 0 } = opts;
    let q = supabase
      .from("products")
      .select(
        "id, name, slug, price, mrp, currency, discount_pct, status, is_active, is_featured, stock, total_sales, created_at, category_id, brand_id, store_id, " +
        "images:product_images(url, is_primary, position), " +
        "store:stores!products_store_id_fkey(id, name, slug, logo_url), " +
        "brand:brands(id, name, slug, logo_url), " +
        "category:categories(id, name, slug)",
        { count: "exact" },
      );

    if (status && status !== "all") {
      q = q.eq("status", status);
    }
    if (search && search.trim()) {
      q = q.ilike("name", `%${search.trim()}%`);
    }

    q = q.order("created_at", { ascending: false }).range(offset, offset + limit - 1);

    const { data, count, error } = await q;
    if (error) return fail(error.message);
    const mapped = mapProducts((data ?? []) as unknown[]) ?? [];
    return ok({ products: mapped, total: count ?? mapped.length });
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
  const cleanOpts = { ...opts };
  if (cleanOpts.status === "all") delete cleanOpts.status;

  try {
    const res = await B.getAdminBrandsBackend(cleanOpts);
    if (res.ok && res.data && Array.isArray(res.data.brands)) {
      return ok({ brands: loose<Brand[]>(res.data.brands), total: res.data.total ?? res.data.brands.length });
    }
  } catch (_e) {}

  try {
    const { status, search, limit = 50, offset = 0 } = opts;
    let q = supabase
      .from("brands")
      .select("id, name, slug, logo_url, banner_url, status, is_verified, is_featured, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status && status !== "all") q = q.eq("status", status);
    if (search && search.trim()) q = q.ilike("name", `%${search.trim()}%`);

    const { data, count, error } = await q;
    if (error) return fail(error.message);
    return ok({ brands: loose<Brand[]>(data ?? []), total: count ?? (data?.length ?? 0) });
  } catch (err: any) {
    return fail(err?.message ?? "Failed to fetch brands");
  }
}

export async function approveBrand(brandId: string, status: "approved" | "rejected"): Promise<Result<void>> {
  try {
    const res = await B.approveBrandBackend(brandId, status);
    if (res.ok) return ok(undefined);
  } catch (_e) {}

  const patch = {
    status,
    ...(status === "approved" ? { approved_at: new Date().toISOString() } : {}),
  };
  const { error } = await supabase.from("brands").update(patch).eq("id", brandId);
  if (error) return fail(error.message);
  return ok(undefined);
}

export async function approveProduct(productId: string, status: "active" | "rejected" | "archived"): Promise<Result<void>> {
  try {
    const res = await B.approveProductBackend(productId, status);
    if (res.ok) return ok(undefined);
  } catch (_e) {}

  const patch: Record<string, unknown> = { status };
  if (status === "active") {
    patch.is_active = true;
    patch.approved_at = new Date().toISOString();
  } else if (status === "archived") {
    patch.is_active = false;
  }
  const { error } = await supabase.from("products").update(patch).eq("id", productId);
  if (error) return fail(error.message);
  return ok(undefined);
}

export async function setProductFeatured(productId: string, isFeatured: boolean): Promise<Result<void>> {
  try {
    const res = await B.setProductFeaturedBackend(productId, isFeatured);
    if (res.ok) return ok(undefined);
  } catch (_e) {}

  const { error } = await supabase.from("products").update({ is_featured: isFeatured }).eq("id", productId);
  if (error) return fail(error.message);
  return ok(undefined);
}

export async function setProductActive(productId: string, isActive: boolean): Promise<Result<void>> {
  try {
    const res = await B.setProductActiveBackend(productId, isActive);
    if (res.ok) return ok(undefined);
  } catch (_e) {}

  const { error } = await supabase.from("products").update({ is_active: isActive }).eq("id", productId);
  if (error) return fail(error.message);
  return ok(undefined);
}

export async function archiveProductAdmin(productId: string): Promise<Result<void>> {
  return approveProduct(productId, "archived");
}

export async function getAdminCategories(): Promise<Result<Category[]>> {
  const enriched = await getAdminCategoriesEnriched();
  if (!enriched.ok) return enriched;
  return ok(enriched.data);
}

export {
  getAdminCategoriesEnriched,
  getCategoryDeleteImpact,
  createCategory,
  updateCategory,
  deleteCategory,
  deleteCategoryWithOptions,
  type AdminCategory,
} from "./category-admin";

export async function getAdminBanners(): Promise<Result<Banner[]>> {
  try {
    const res = await B.getAdminBannersBackend();
    if (res.ok && res.data && Array.isArray(res.data.banners)) {
      return ok(loose<Banner[]>(res.data.banners));
    }
  } catch (_e) {}

  try {
    const { data, error } = await supabase
      .from("banners")
      .select("*")
      .order("position", { ascending: true });
    if (error) return fail(error.message);
    return ok(loose<Banner[]>((data ?? []) as unknown as Banner[]));
  } catch (err: any) {
    return fail(err?.message ?? "Failed to fetch banners");
  }
}

export async function createBanner(b: Partial<Banner>): Promise<Result<Banner>> {
  try {
    const res = await B.createBannerBackend(b);
    if (res.ok && res.data?.banner) return ok(loose<Banner>(res.data.banner));
  } catch (_e) {}

  try {
    const { data, error } = await supabase.from("banners").insert(b).select("*").single();
    if (error) return fail(error.message);
    return ok(loose<Banner>(data as unknown as Banner));
  } catch (err: any) {
    return fail(err?.message ?? "Failed to create banner");
  }
}

export async function updateBanner(id: string, patch: Partial<Banner>): Promise<Result<Banner>> {
  try {
    const res = await B.updateBannerBackend(id, patch);
    if (res.ok && res.data?.banner) return ok(loose<Banner>(res.data.banner));
  } catch (_e) {}

  try {
    const { data, error } = await supabase.from("banners").update(patch).eq("id", id).select("*").single();
    if (error) return fail(error.message);
    return ok(loose<Banner>(data as unknown as Banner));
  } catch (err: any) {
    return fail(err?.message ?? "Failed to update banner");
  }
}

export async function deleteBanner(id: string): Promise<Result<void>> {
  try {
    const res = await B.deleteBannerBackend(id);
    if (res.ok) return ok(undefined);
  } catch (_e) {}

  try {
    const { error } = await supabase.from("banners").delete().eq("id", id);
    if (error) return fail(error.message);
    return ok(undefined);
  } catch (err: any) {
    return fail(err?.message ?? "Failed to delete banner");
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
  // BXGY (Buy X Get Y) — surfaced so the mobile /seller/coupons edit
  // modal can round-trip without losing fields the seller already set.
  bxgy_buy_product_ids?: string[];
  bxgy_buy_quantity?: number;
  bxgy_get_product_ids?: string[];
  bxgy_get_quantity?: number;
  bxgy_get_discount_pct?: number;
}

export async function getAdminCoupons(opts: {
  search?: string;
  is_active?: string;
} = {}): Promise<Result<AdminCoupon[]>> {
  const res = await B.getAdminCouponsBackend();
  if (!res.ok) return fail(res.error);
  let list = (res.data.coupons as unknown[]).map((c) => {
    const row = c as {
      id: string; code: string; discount_type: string; discount_value: number;
      min_order_amount?: number; max_uses?: number | null; used_count?: number;
      starts_at?: string; ends_at?: string | null; is_active: boolean;
      scope?: string; created_at?: string;
    };
    return {
      id: row.id,
      code: row.code,
      type: (row.discount_type === "percent" ? "percentage" : row.discount_type === "fixed" ? "fixed" : row.discount_type === "free_shipping" ? "free_shipping" : "percentage") as AdminCoupon["type"],
      value: row.discount_value,
      min_order_total: row.min_order_amount,
      max_uses: row.max_uses ?? undefined,
      current_uses: row.used_count ?? 0,
      starts_at: row.starts_at,
      ends_at: row.ends_at ?? undefined,
      is_active: row.is_active,
      scope: row.scope,
      created_at: row.created_at ?? new Date().toISOString(),
    } satisfies AdminCoupon;
  });
  if (opts.search) {
    const q = opts.search.toLowerCase();
    list = list.filter((c) => c.code.toLowerCase().includes(q));
  }
  if (opts.is_active && opts.is_active !== "all") {
    const want = opts.is_active === "true";
    list = list.filter((c) => c.is_active === want);
  }
  return ok(list);
}

const CouponCreateSchema = z.object({
  code: z.string().min(2).max(40).transform((s) => s.toUpperCase()),
  type: z.enum(["percentage", "fixed", "free_shipping", "bxgy"]),
  value: z.number().min(0).default(0),
  min_order_value: z.number().min(0).default(0),
  max_discount: z.number().min(0).optional(),
  usage_limit: z.number().int().min(1).optional(),
  per_user_limit: z.number().int().min(1).default(1),
  starts_at: z.string().optional(),
  expires_at: z.string().optional(),
  is_active: z.boolean().optional(),
  store_id: z.string().optional(),
  scope: z.string().optional(),
  // BXGY (mirrors backend CouponSchema since migration 0291). The seller
  // mobile form sends these only when type === "bxgy" so non-bxgy
  // coupons never carry them.
  bxgy_buy_product_ids: z.array(z.string().uuid()).max(64).optional(),
  bxgy_get_product_ids: z.array(z.string().uuid()).max(64).optional(),
  bxgy_buy_quantity: z.number().int().min(1).max(1000).optional(),
  bxgy_get_quantity: z.number().int().min(1).max(1000).optional(),
  bxgy_get_discount_pct: z.number().min(0).max(100).optional(),
}).superRefine((v, ctx) => {
  if (v.type === "percentage" && v.value > 100) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["value"], message: "Percentage coupons cannot exceed 100%" });
  }
  if (v.type === "bxgy") {
    if (!v.bxgy_buy_product_ids?.length || !v.bxgy_get_product_ids?.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["bxgy_buy_product_ids"], message: "BXGY coupons require at least one buy and one get product" });
    }
  }
  if (v.starts_at && v.expires_at) {
    const s = Date.parse(v.starts_at);
    const e = Date.parse(v.expires_at);
    if (Number.isFinite(s) && Number.isFinite(e) && e <= s) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["expires_at"], message: "expires_at must be after starts_at" });
    }
  }
});

export async function createCoupon(c: Partial<AdminCoupon>): Promise<Result<AdminCoupon>> {
  const parsed = CouponCreateSchema.safeParse(c);
  if (!parsed.success) {
    return fail(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  }
  const res = await B.createCouponAdminBackend({
    code: parsed.data.code,
    discount_type: parsed.data.type === "percentage" ? "percent" : parsed.data.type === "bxgy" ? "fixed" : (parsed.data.type as "percent" | "fixed" | "free_shipping"),
    discount_value: parsed.data.value,
    min_order_amount: parsed.data.min_order_value,
    max_uses: parsed.data.usage_limit,
    is_active: parsed.data.is_active ?? true,
    scope: "global",
  });
  if (!res.ok) return fail(res.error);
  return ok(loose<AdminCoupon>(res.data.coupon));
}

export async function toggleCoupon(id: string, isActive: boolean): Promise<Result<void>> {
  const res = await B.toggleCouponBackend(id, isActive);
  if (!res.ok) return fail(res.error);
  return ok(undefined);
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
  const res = await B.getAdminCampaignsBackend();
  if (!res.ok) return fail(res.error);
  return ok((res.data.campaigns as AdminCampaign[]) ?? []);
}

export async function toggleCampaign(id: string, isActive: boolean): Promise<Result<void>> {
  const res = await B.toggleCampaignBackend(id, isActive);
  if (!res.ok) return fail(res.error);
  return ok(undefined);
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
  const res = await B.getAdminBroadcastsBackend();
  if (!res.ok) return fail(res.error);
  return ok(loose<NotificationBroadcast[]>(res.data.broadcasts ?? []));
}

export async function sendBroadcast(b: Partial<NotificationBroadcast>): Promise<Result<NotificationBroadcast>> {
  const res = await B.sendBroadcastBackend(b as Record<string, unknown>);
  if (!res.ok) return fail(res.error);
  return ok(loose<NotificationBroadcast>(res.data.broadcast));
}

export interface AuditEntry {
  id: string;
  actor_id?: string;
  actor_name?: string;
  action: string;
  target_type?: string;
  target_id?: string;
  metadata?: unknown;
  created_at: string;
}

export async function getAdminAuditLog(limit = 50): Promise<Result<AuditEntry[]>> {
  try {
    const res = await B.getAdminAuditLogBackend(limit);
    if (res.ok && res.data && Array.isArray(res.data.entries)) {
      return ok((res.data.entries as AuditEntry[]));
    }
  } catch (_e) {}

  try {
    const { data, error } = await supabase
      .from("admin_audit_log")
      .select("id, actor_id, action, target_type, target_id, diff, created_at, actor:users!admin_audit_log_actor_id_fkey(id, full_name, email)")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      const fallback = await supabase
        .from("admin_audit_log")
        .select("id, actor_id, action, target_type, target_id, diff, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (fallback.data) return ok((fallback.data as unknown as AuditEntry[]));
      return fail(error.message);
    }
    return ok((data as unknown as AuditEntry[]) ?? []);
  } catch (err: any) {
    return fail(err?.message ?? "Failed to fetch audit log");
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
  const res = await B.getAdminBlogPostsBackend();
  if (!res.ok) return fail(res.error);
  return ok((res.data.posts as AdminBlogPost[]) ?? []);
}

export async function createBlogPost(p: Partial<AdminBlogPost>): Promise<Result<AdminBlogPost>> {
  const res = await B.createBlogPostBackend(p);
  if (!res.ok) return fail(res.error);
  return ok(res.data.post as AdminBlogPost);
}

export async function toggleBlogPost(id: string, status: "draft" | "published"): Promise<Result<void>> {
  const res = await B.toggleBlogPostBackend(id, status);
  if (!res.ok) return fail(res.error);
  return ok(undefined);
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
  const res = await B.getAdminReviewsBackend(status);
  if (!res.ok) return fail(res.error);
  return ok((res.data.reviews as unknown[] as ModerationReview[]) ?? []);
}

export async function moderateReview(id: string, status: "approved" | "rejected"): Promise<Result<void>> {
  const res = await B.moderateReviewBackend(id, status);
  if (!res.ok) return fail(res.error);
  return ok(undefined);
}

export async function getAdminQA(status = "pending"): Promise<Result<ModerationQA[]>> {
  const res = await B.getAdminQABackend(status);
  if (!res.ok) return fail(res.error);
  return ok((res.data.questions as unknown[] as ModerationQA[]) ?? []);
}

// Delivery companies + commissions + gift cards + homepage sections + low stock + settings + overview

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
  default_assignment_policy?: string;
  owner?: {
    id: string;
    full_name?: string | null;
    email?: string | null;
    status?: string;
  } | null;
}

export async function getAdminDeliveryCompanies(opts?: {
  status?: string;
  search?: string;
}): Promise<Result<DeliveryCompany[]>> {
  const res = await B.getAdminDeliveryCompaniesBackend(opts ?? {});
  if (!res.ok) return fail(res.error);
  return ok(loose<DeliveryCompany[]>((res.data.companies ?? []) as unknown as DeliveryCompany[]));
}

export interface AdminDeliveryCompanyDetail {
  company: DeliveryCompany;
  members: Array<{ id: string; company_role: string; joined_at: string; user?: { id: string; full_name?: string | null; email?: string | null; phone?: string | null; status?: string } | null }>;
  warehouses: Array<{ id: string; name: string; address?: { city?: string; postal_code?: string } | null }>;
  routes: Array<{ id: string; status: string; total_stops?: number; created_at: string; started_at?: string | null; completed_at?: string | null }>;
  audit: Array<{ id: string; action: string; created_at: string; actor?: { id: string; full_name?: string | null; avatar_url?: string | null } | null }>;
}

function normalizeDeliveryCompanyStatus(row: Record<string, unknown>): ApprovalStatus {
  const approved = row.is_approved;
  const active = row.is_active;
  if (typeof row.status === "string" && row.status.trim()) return row.status as ApprovalStatus;
  if (approved === true) return active === false ? "suspended" : "active";
  if (approved === false) return active === false ? "rejected" : "pending";
  return "pending";
}

function normalizeDeliveryCompany(row: Record<string, unknown>): DeliveryCompany {
  return { ...(row as unknown as DeliveryCompany), status: normalizeDeliveryCompanyStatus(row) };
}

function deliveryStatusToFlags(status: "pending" | "active" | "suspended" | "rejected"): {
  is_approved: boolean;
  is_active?: boolean;
} {
  switch (status) {
    case "active":
      return { is_approved: true, is_active: true };
    case "suspended":
      return { is_approved: true, is_active: false };
    case "rejected":
      return { is_approved: false, is_active: false };
    case "pending":
    default:
      return { is_approved: false, is_active: true };
  }
}

export async function getAdminDeliveryCompanyDetail(id: string): Promise<Result<AdminDeliveryCompanyDetail>> {
  const emptyDetail = (company: DeliveryCompany): AdminDeliveryCompanyDetail => ({
    company,
    members: [],
    warehouses: [],
    routes: [],
    audit: [],
  });

  // Backend-first: single-resource route when available.
  try {
    const res = await B.getAdminDeliveryCompanyBackend(id);
    if (res.ok && res.data?.company) {
      return ok(emptyDetail(normalizeDeliveryCompany(res.data.company)));
    }
  } catch (_e) {}

  // Fallback: list endpoint (exists in backend) + find by id. Members,
  // warehouses, routes, and audit have no admin read endpoints, so they
  // honestly resolve to empty lists with empty-state UI downstream.
  try {
    const res = await B.getAdminDeliveryCompaniesBackend({});
    if (res.ok && Array.isArray(res.data.companies)) {
      const found = (res.data.companies as Record<string, unknown>[]).find((c) => c.id === id);
      if (found) return ok(emptyDetail(normalizeDeliveryCompany(found)));
    }
  } catch (_e) {}

  try {
    const { data, error } = await supabase
      .from("delivery_companies")
      .select("id, name, slug, contact_email, contact_phone, coverage_areas, rating, total_deliveries, created_at, is_approved, is_active, status")
      .eq("id", id)
      .maybeSingle();
    if (error) return fail(error.message);
    if (!data) return fail("Company not found");
    return ok(emptyDetail(normalizeDeliveryCompany(data as Record<string, unknown>)));
  } catch (err: any) {
    return fail(err?.message ?? "Failed to fetch delivery company");
  }
}

export async function updateAdminDeliveryCompanyStatus(id: string, status: "pending" | "active" | "suspended" | "rejected"): Promise<Result<DeliveryCompany>> {
  const patch = deliveryStatusToFlags(status);
  try {
    const res = await B.updateAdminDeliveryCompanyBackend(id, patch);
    if (res.ok && res.data?.company) return ok(normalizeDeliveryCompany(res.data.company));
  } catch (_e) {}

  try {
    const { data, error } = await supabase
      .from("delivery_companies")
      .update(patch)
      .eq("id", id)
      .select("id, name, slug, contact_email, contact_phone, coverage_areas, rating, total_deliveries, created_at, is_approved, is_active, status")
      .maybeSingle();
    if (error) return fail(error.message);
    if (!data) return fail("Company not found");
    return ok(normalizeDeliveryCompany(data as Record<string, unknown>));
  } catch (err: any) {
    return fail(err?.message ?? "Failed to update delivery company");
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
  const res = await B.getAdminCommissionsBackend();
  if (!res.ok) return fail(res.error);
  return ok((res.data.tiers as unknown[] as CommissionTier[]) ?? []);
}

export async function updateCommissionTier(id: string, patch: Partial<CommissionTier>): Promise<Result<CommissionTier>> {
  const res = await B.updateCommissionTierBackend(id, patch as Record<string, unknown>);
  if (!res.ok) return fail(res.error);
  return ok(res.data.tier as CommissionTier);
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

export async function getAdminGiftCards(qs?: { search?: string; active?: "true" | "false"; limit?: number; offset?: number }): Promise<Result<GiftCard[]>> {
  const res = await B.getAdminGiftCardsBackend(qs);
  if (!res.ok) return fail(res.error);
  return ok((res.data.cards as GiftCard[]) ?? []);
}

export async function createGiftCard(g: Partial<GiftCard>): Promise<Result<GiftCard>> {
  const res = await B.createGiftCardBackend(g as Record<string, unknown>);
  if (!res.ok) return fail(res.error);
  return ok(res.data.card as GiftCard);
}

export async function adjustAdminGiftCard(id: string, patch: { delta: number; note?: string }) {
  const res = await B.adjustAdminGiftCardBackend(id, patch);
  return res;
}

export async function voidAdminGiftCard(id: string, body: { reason?: string }) {
  return B.voidAdminGiftCardBackend(id, body);
}

export async function getAdminGiftCardTransactions(id: string) {
  return B.getAdminGiftCardTransactionsBackend(id);
}

export async function getAdminAbandonedCartsStats() {
  return B.getAdminAbandonedCartsStatsBackend();
}

export async function getAdminPriceAlertsStats() {
  return B.getAdminPriceAlertsStatsBackend();
}

export async function getMyGiftCards() {
  return B.getMyGiftCardsBackend();
}

export async function getMyGiftCardBalance() {
  return B.getMyGiftCardBalanceBackend();
}

export async function checkGiftCardByCode(code: string) {
  return B.checkGiftCardByCodeBackend(code);
}

export async function validateGiftCardRedemption(input: { code: string; order_currency?: string }) {
  return B.validateGiftCardRedemptionBackend(input);
}

export async function purchaseGiftCard(input: Parameters<typeof B.purchaseGiftCardBackend>[0]) {
  return B.purchaseGiftCardBackend(input);
}

export async function listPriceAlerts() {
  return B.listPriceAlertsBackend();
}

export async function getPriceAlertStatus(productId: string) {
  return B.getPriceAlertStatusBackend(productId);
}

export async function subscribePriceAlert(input: { product_id: string; variant_id?: string | null; threshold_price?: number | null }) {
  return B.subscribePriceAlertBackend(input);
}

export async function updatePriceAlert(id: string, patch: { threshold_price?: number | null; is_active?: boolean }) {
  return B.updatePriceAlertBackend(id, patch);
}

export async function unsubscribePriceAlert(id: string) {
  return B.unsubscribePriceAlertBackend(id);
}

// ----- Personalised home feed (0169) ----------------------------------

import type { HomeFeedResponse, HomeFeedSectionKey, HomeFeedProduct, HomeFeedBrandOrStore } from "@/lib/api/backend";

export type { HomeFeedResponse, HomeFeedSectionKey, HomeFeedProduct, HomeFeedBrandOrStore };

export async function getHomeFeed(opts: { exclude?: string[] } = {}) {
  return B.getHomeFeedBackend(opts);
}

export interface AdminHomepageSection {
  id: string;
  key: string;
  title: string;
  enabled: boolean;
  position: number;
  config?: unknown;
}

export async function getAdminHomepageSections(): Promise<Result<AdminHomepageSection[]>> {
  const res = await B.getAdminHomepageSectionsBackend();
  if (!res.ok) return fail(res.error);
  return ok((res.data.sections as AdminHomepageSection[]) ?? []);
}

export async function toggleHomepageSection(id: string, enabled: boolean): Promise<Result<void>> {
  const res = await B.toggleHomepageSectionBackend(id, enabled);
  if (!res.ok) return fail(res.error);
  return ok(undefined);
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

export async function submitContactSubmission(input: SubmitContactInput): Promise<Result<{ submitted: true }>> {
  const res = await B.submitContactSubmissionBackend({
    name: input.name.trim(),
    email: input.email.trim(),
    phone: input.phone?.trim() ?? null,
    subject: input.subject.trim(),
    message: input.message.trim(),
    user_id: input.userId ?? null,
  });
  if (!res.ok) return fail(res.error);
  return ok({ submitted: true });
}

export async function getAdminContactSubmissions(): Promise<Result<ContactSubmission[]>> {
  const res = await B.getAdminContactSubmissionsBackend();
  if (!res.ok) return fail(res.error);
  return ok((res.data.submissions as ContactSubmission[]) ?? []);
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
    const res = await B.getAdminLowStockBackend(limit);
    if (res.ok && res.data && Array.isArray(res.data.items)) {
      return ok(loose<LowStockItem[]>(res.data.items));
    }
  } catch (_e) {}

  try {
    const { data, error } = await supabase
      .from("products")
      .select("id, sku, name, stock")
      .lte("stock", 10)
      .order("stock", { ascending: true })
      .limit(limit);
    if (error) return fail(error.message);
    const items: LowStockItem[] = (data ?? []).map((p: any) => ({
      id: p.id,
      variant_id: p.id,
      product_name: p.name,
      quantity: p.stock ?? 0,
      low_stock_threshold: 10,
    }));
    return ok(items);
  } catch (err: any) {
    return fail(err?.message ?? "Failed to fetch low stock");
  }
}

export interface PlatformSetting {
  id?: string;
  key: string;
  value: unknown;
  updated_at?: string;
}

export async function getAdminPlatformSettings(): Promise<Result<Record<string, unknown>>> {
  const res = await B.getAdminPlatformSettingsBackend();
  if (!res.ok) return fail(res.error);
  return ok(res.data.settings);
}

export async function setAdminPlatformSetting(key: string, value: unknown): Promise<Result<void>> {
  const res = await B.setAdminPlatformSettingBackend(key, value);
  if (!res.ok) return fail(res.error);
  return ok(undefined);
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
    const res = await B.getAdminOverviewStatsBackend();
    if (res.ok && res.data) return ok(res.data as unknown as AdminOverviewStats);
  } catch (_e) {}

  try {
    const [
      ordersRes,
      productsRes,
      usersRes,
      customersRes,
      storesRes,
      activeStoresRes,
      brandsRes,
      pendingStoresRes,
      pendingBrandsRes,
      pendingProductsRes,
    ] = await Promise.all([
      supabase.from("orders").select("id, total, status"),
      supabase.from("products").select("id", { count: "exact", head: true }),
      supabase.from("users").select("id", { count: "exact", head: true }),
      supabase.from("users").select("id", { count: "exact", head: true }).eq("role", "buyer"),
      supabase.from("stores").select("id", { count: "exact", head: true }),
      supabase.from("stores").select("id", { count: "exact", head: true }).eq("status", "approved"),
      supabase.from("brands").select("id", { count: "exact", head: true }),
      supabase.from("stores").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("brands").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("products").select("id", { count: "exact", head: true }).eq("status", "pending"),
    ]);

    const orders = (ordersRes.data ?? []) as Array<{ id: string; total: number; status: string }>;
    const paidOrders = orders.filter((o) => o.status !== "cancelled" && o.status !== "returned");
    const revenue = paidOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const totalOrders = orders.length;
    const aov = paidOrders.length > 0 ? Math.round(revenue / paidOrders.length) : 0;

    return ok({
      users: usersRes.count ?? 0,
      customers: customersRes.count ?? (usersRes.count ?? 0),
      stores: storesRes.count ?? 0,
      activeStores: activeStoresRes.count ?? 0,
      brands: brandsRes.count ?? 0,
      products: productsRes.count ?? 0,
      orders: totalOrders,
      revenue,
      pendingStores: pendingStoresRes.count ?? 0,
      pendingBrands: pendingBrandsRes.count ?? 0,
      pendingProducts: pendingProductsRes.count ?? 0,
      aov,
    });
  } catch (err: any) {
    return fail(err?.message ?? "Failed to fetch overview stats");
  }
}

export async function getAdminRecentSignups(limit = 8): Promise<Result<User[]>> {
  try {
    const res = await B.getAdminRecentSignupsBackend(limit);
    if (res.ok && res.data?.users) return ok((res.data.users as User[]) ?? []);
  } catch (_e) {}

  try {
    const { data, error } = await supabase
      .from("users")
      .select("id, email, full_name, role, is_verified, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return fail(error.message);
    return ok((data ?? []) as User[]);
  } catch (err: any) {
    return fail(err?.message ?? "Failed to fetch recent signups");
  }
}

export async function getAdminRecentOrders(limit = 6): Promise<Result<Order[]>> {
  try {
    const res = await B.getAdminRecentOrdersBackend(limit);
    if (res.ok && res.data?.orders) return ok(loose<Order[]>(res.data.orders ?? []));
  } catch (_e) {}

  try {
    const { data, error } = await supabase
      .from("orders")
      .select("id, order_number, total, currency, status, created_at, user:users(id, full_name, email)")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return fail(error.message);
    return ok(loose<Order[]>((data ?? []) as unknown as Order[]));
  } catch (err: any) {
    return fail(err?.message ?? "Failed to fetch recent orders");
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

export async function getAdminPendingApprovals(_limit = 20): Promise<Result<AdminApprovals>> {
  try {
    const res = await B.getAdminPendingApprovalsBackend();
    if (res.ok && res.data) return ok(res.data as unknown as AdminApprovals);
  } catch (_e) {}

  try {
    const [storesRes, brandsRes, productsRes] = await Promise.all([
      supabase.from("stores").select("id, name, created_at, status").eq("status", "pending").limit(_limit),
      supabase.from("brands").select("id, name, created_at, status").eq("status", "pending").limit(_limit),
      supabase.from("products").select("id, name, created_at, status").eq("status", "pending").limit(_limit),
    ]);
    return ok({
      stores: (storesRes.data ?? []) as AdminApproval[],
      brands: (brandsRes.data ?? []) as AdminApproval[],
      products: (productsRes.data ?? []) as AdminApproval[],
    });
  } catch (err: any) {
    return fail(err?.message ?? "Failed to fetch pending approvals");
  }
}

export async function getStoreById(id: string): Promise<Result<Store | null>> {
  const res = await B.getStoreByIdBackend(id);
  if (!res.ok) return fail(res.error);
  return ok(loose<Store | null>(res.data.store ?? null));
}

export async function getProductById(id: string): Promise<Result<Product | null>> {
  const res = await B.getProductByIdBackend(id);
  if (!res.ok) return fail(res.error);
  return ok(mapProduct(res.data.product));
}

// ============================================================================
// Blog
// ============================================================================

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  content?: string;
  cover_image?: string;
  author?: string;
  tags?: string[];
  status: "draft" | "published";
  published_at?: string;
  created_at: string;
}

export async function getBlogPosts(limit = 20): Promise<Result<BlogPost[]>> {
  const res = await B.getBlogPostsBackend({ limit });
  if (!res.ok) return fail(res.error);
  return ok((res.data.posts as unknown[] as BlogPost[]) ?? []);
}

export async function getBlogPostBySlug(slug: string): Promise<Result<BlogPost | null>> {
  const res = await B.getBlogPostBySlugBackend(slug);
  if (!res.ok) return fail(res.error);
  return ok((res.data.post as BlogPost | null) ?? null);
}

// ============================================================================
// Account — notification prefs + follows
// ============================================================================

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
  | "security_push"
  | "cart_reminders_email"
  | "cart_reminders_push";

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
  cart_reminders_email: true,
  cart_reminders_push: false,
};

export async function getNotificationPrefs(_userId: string): Promise<Result<NotificationPrefs>> {
  const res = await B.getNotificationPrefsBackend();
  if (!res.ok) return fail(res.error);
  return ok({ ...DEFAULT_NOTIFICATION_PREFS, ...(res.data.prefs as Partial<NotificationPrefs>) });
}

export async function saveNotificationPrefs(
  _userId: string,
  prefs: Partial<NotificationPrefs>,
): Promise<Result<NotificationPrefs>> {
  const res = await B.saveNotificationPrefsBackend(prefs as Record<string, boolean>);
  if (!res.ok) return fail(res.error);
  return ok({ ...DEFAULT_NOTIFICATION_PREFS, ...(res.data.prefs as Partial<NotificationPrefs>) });
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

export async function getFollowedStores(_userId: string): Promise<Result<FollowedStore[]>> {
  const res = await B.listFollowedStoresBackend();
  if (!res.ok) return fail(res.error);
  const follows = (res.data.follows as unknown[]).map((row) => {
    const r = row as { store_id?: string; brand_id?: string; created_at: string; store?: unknown; brand?: unknown };
    return {
      id: `${r.store_id ?? r.brand_id ?? ""}-${r.created_at}`,
      store_id: r.store_id ?? "",
      store: r.store ? mapStore(r.store) : loose<Store>({}),
      created_at: r.created_at,
    } as FollowedStore;
  });
  return ok(follows);
}

export async function getFollowedBrands(_userId: string): Promise<Result<FollowedBrand[]>> {
  const res = await B.listFollowedBrandsBackend();
  if (!res.ok) return fail(res.error);
  const follows = (res.data.follows as unknown[]).map((row) => {
    const r = row as { store_id?: string; brand_id?: string; created_at: string; store?: unknown; brand?: unknown };
    return {
      id: `${r.brand_id ?? r.store_id ?? ""}-${r.created_at}`,
      brand_id: r.brand_id ?? "",
      brand: r.brand ? mapBrand(r.brand) : loose<Brand>({}),
      created_at: r.created_at,
    } as FollowedBrand;
  });
  return ok(follows);
}

export async function followBrand(brandId: string): Promise<Result<{ following: boolean }>> {
  const res = await B.followBrandBackend(brandId);
  if (!res.ok) return fail(res.error);
  return ok({ following: true });
}

export async function unfollowBrand(brandId: string): Promise<Result<{ following: boolean }>> {
  const res = await B.unfollowBrandBackend(brandId);
  if (!res.ok) return fail(res.error);
  return ok({ following: false });
}

export async function isFollowingBrand(brandId: string): Promise<Result<boolean>> {
  const res = await B.listFollowedBrandsBackend();
  if (!res.ok) return fail(res.error);
  const ids = ((res.data.follows as unknown[]) ?? [])
    .map((row) => (row as { brand_id?: string }).brand_id)
    .filter((id): id is string => typeof id === "string");
  return ok(ids.includes(brandId));
}

// ============================================================================
// Returns (buyer + seller)
// ============================================================================

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

export type SellerReturnRequest = Omit<MobileReturnRequest, "refund_amount"> & {
  buyer_name: string | null;
  product_name: string | null;
  variant_label: string | null;
  refund_amount: number | null;
};

export async function getReturns(_userId: string): Promise<Result<MobileReturnRequest[]>> {
  const res = await B.listReturnsBackend();
  if (!res.ok) return fail(res.error);
  return ok((res.data.returns as unknown[] as MobileReturnRequest[]) ?? []);
}

export async function getReturnByGroupId(userId: string, returnGroupId: string): Promise<Result<MobileReturnRequest | null>> {
  const res = await B.getReturnByGroupIdBackend(returnGroupId);
  if (!res.ok) return fail(res.error);
  const payload = res.data as unknown as { returns?: MobileReturnRequest[]; return?: MobileReturnRequest };
  const found =
    payload.return ??
    (payload.returns ?? []).find((r) => r.return_group_id === returnGroupId) ??
    payload.returns?.[0] ??
    null;
  void userId;
  return ok(found);
}

export async function cancelReturn(returnGroupId: string): Promise<Result<{ ok: true; returns: Array<{ id: string; status: string; cancelled_at: string | null }> }>> {
  const res = await B.cancelReturnBackend(returnGroupId);
  if (!res.ok) return fail(res.error);
  return ok({ ok: true, returns: [{ id: returnGroupId, status: "cancelled", cancelled_at: new Date().toISOString() }] });
}

export interface CreateReturnInput {
  orderId: string;
  reason: string;
  items: { orderItemId: string; quantity: number }[];
}

export interface CreateReturnResult {
  returnGroupId: string;
  returnNumber: string;
  items: { return_id: string; order_item_id: string; quantity: number; refund_amount: number }[];
}

export async function createReturnRequest(_userId: string, input: CreateReturnInput): Promise<Result<CreateReturnResult>> {
  const res = await B.createReturnRequestBackend({
    order_id: input.orderId,
    items: input.items.map((i) => ({
      order_item_id: i.orderItemId,
      reason: input.reason,
      quantity: i.quantity,
    })),
  });
  if (!res.ok) return fail(res.error);
  return ok({
    returnGroupId: (res.data.returns as unknown[] as Array<{ return_group_id?: string; id: string }>)[0]?.return_group_id ?? "",
    returnNumber: "",
    items: [],
  });
}

export type SellerReturnAction = "approve" | "reject" | "receive" | "refund";

function mapSellerReturn(row: unknown): SellerReturnRequest {
  const mapped = mapSellerReturnRow(row);
  return mapped as SellerReturnRequest;
}

export async function getSellerReturns(_storeId: string, opts: { status?: string; search?: string } = {}): Promise<Result<SellerReturnRequest[]>> {
  const q = opts.search?.trim();
  const status = opts.status && opts.status !== "all" ? opts.status : undefined;
  const res = await B.getSellerReturnsBackend({ status, search: q });
  if (!res.ok) return fail(res.error);
  let list = ((res.data.returns as unknown[]) ?? []).map(mapSellerReturn);
  // Keep client-side filters as a safety net when the backend ignores params.
  if (status) list = list.filter((r) => r.status === status);
  if (q) {
    const needle = q.toLowerCase();
    list = list.filter((r) =>
      [r.return_number, r.order_number, r.buyer_name, r.product_name, r.variant_label, r.reason]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }
  return ok(list);
}

export async function getSellerReturnByGroupId(storeId: string, returnGroupId: string): Promise<Result<SellerReturnRequest | null>> {
  const res = await getSellerReturns(storeId);
  if (!res.ok) return res;
  return ok(
    res.data.find((r) => r.id === returnGroupId || r.return_group_id === returnGroupId) ?? null,
  );
}

export async function decideSellerReturn(
  _actorUserId: string,
  returnId: string,
  action: SellerReturnAction,
  opts: { note?: string; refundAmount?: number } = {},
): Promise<Result<{ refund_id?: string }>> {
  const res = await B.decideSellerReturnBackend(returnId, action, opts.note, opts.refundAmount);
  if (!res.ok) return fail(res.error);
  return ok({ refund_id: (res.data.return as { refund_id?: string })?.refund_id });
}

export async function decideSellerReturnGroup(
  _actorUserId: string,
  storeId: string,
  returnGroupId: string,
  action: SellerReturnAction,
  opts: { note?: string } = {},
): Promise<Result<void>> {
  const guard = await assertSellerCanOperate(storeId);
  if (!guard.ok) return guard;
  const detail = await getSellerReturnByGroupId(storeId, returnGroupId);
  if (!detail.ok) return detail;
  if (!detail.data) return fail("Return not found");
  for (const item of detail.data.items) {
    const refundAmount = action === "refund" ? item.refund_amount : undefined;
    const res = await decideSellerReturn(_actorUserId, item.return_id, action, {
      ...opts,
      ...(refundAmount !== undefined ? { refundAmount } : {}),
    });
    if (!res.ok) return res;
  }
  return ok(undefined);
}

// ============================================================================
// Reviews (mine / delete / store reviews / create)
// ============================================================================

export async function getMyReviews(_userId: string): Promise<Result<Review[]>> {
  const res = await B.listMyReviewsBackend();
  if (!res.ok) return fail(res.error);
  return ok(loose<Review[]>(res.data.reviews ?? []));
}

export async function deleteReview(reviewId: string, _userId: string): Promise<Result<void>> {
  const res = await B.deleteReviewBackend(reviewId);
  if (!res.ok) return fail(res.error);
  return ok(undefined);
}

/**
 * Seller reply to a review on one of their products. Mirrors POST
 * /api/seller/reviews/:id/reply. Used by the seller reviews ReplyModal.
 *
 * Returns the updated review so callers can render the persisted reply
 * without refetching the whole list.
 */
export async function replyToSellerReview(
  reviewId: string,
  body: string,
): Promise<Result<{ review: Review | null; reply: { body: string; created_at: string } }>> {
  const res = await B.replySellerReviewBackend(reviewId, body);
  if (!res.ok) return fail(res.error);
  const review = (res.data?.review ?? null) as Review | null;
  const replied = review as (Review & { seller_reply?: string; seller_replied_at?: string }) | null;
  return ok({
    review,
    reply: {
      body: replied?.seller_reply ?? body,
      created_at: replied?.seller_replied_at ?? new Date().toISOString(),
    },
  });
}

/**
 * Toggle a helpful vote on a review. Mirrors POST /api/reviews/:id/vote
 * (v2 toggle pattern in the backend). Used by the HelpfulButton on
 * store + product review surfaces.
 */
export async function voteReviewHelpfulBackend(
  reviewId: string,
): Promise<Result<{ helpful_count: number }>> {
  const res = await B.voteReviewHelpfulBackend(reviewId);
  if (!res.ok) return fail(res.error);
  return ok(res.data);
}

export async function getStoreReviews(storeId: string, opts: {
  rating?: number;
  search?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<Result<{ reviews: Review[]; total: number; avgRating: number; ratingBreakdown: Record<number, number> }>> {
  const res = await B.getStoreReviewsBackend(storeId, {
    limit: opts.limit ?? 100,
    offset: opts.offset,
  });
  if (!res.ok) return fail(res.error);
  const all = loose<Review[]>(res.data.reviews ?? []);
  const total = firstFiniteNumber(res.data.total, all.length) ?? all.length;
  const allRatings = all.map((r) => r.rating ?? 0);
  const computedAvg = allRatings.length ? allRatings.reduce((s, n) => s + n, 0) / allRatings.length : 0;
  const avgRating = firstFiniteNumber(res.data.avg_rating, computedAvg) ?? 0;
  const breakdown: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  for (const r of allRatings) breakdown[r] = (breakdown[r] ?? 0) + 1;
  let reviews = all;
  if (opts.rating) reviews = reviews.filter((r) => r.rating === opts.rating);
  if (opts.search?.trim()) {
    const needle = opts.search.trim().toLowerCase();
    reviews = reviews.filter((r) =>
      [r.content, r.title, r.user?.full_name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }
  return ok({ reviews, total, avgRating, ratingBreakdown: breakdown });
}

// ============================================================================
// Seller — Storefront meta (header/footer/announcement/social/contact)
// ============================================================================

export type {
  StoreMeta,
  StoreMetaPatch,
  StoreMetaSocialLinks,
  StoreMetaFooterLink,
} from "@/lib/api/backend";

export async function getStoreMeta(): Promise<Result<B.StoreMeta>> {
  const res = await B.getStoreMetaBackend();
  if (!res.ok) return fail(res.error);
  return ok(res.data.meta);
}

export async function updateStoreMeta(patch: B.StoreMetaPatch): Promise<Result<B.StoreMeta>> {
  const storeRes = await B.getSellerStoreBackend();
  if (!storeRes.ok) return fail(storeRes.error);
  const storeId = storeRes.data.store?.id;
  if (storeId) {
    const guard = await assertSellerCanOperate(storeId);
    if (!guard.ok) return guard;
  }
  const res = await B.updateStoreMetaBackend(patch);
  if (!res.ok) return fail(res.error);
  return ok(res.data.meta);
}

// ============================================================================
// Seller — Coupons + analytics
// ============================================================================

function mapSellerCouponRow(row: B.Coupon | Record<string, unknown>): AdminCoupon {
  const r = row as B.Coupon & {
    type?: string;
    value?: number;
    min_order_value?: number;
    usage_limit?: number | null;
  };
  const rawType = String(r.discount_type ?? r.type ?? "fixed");
  const type = (rawType === "percent" || rawType === "percentage"
    ? "percentage"
    : rawType) as AdminCoupon["type"];
  const value = Number(r.discount_value ?? r.value ?? 0);
  return {
    id: String(r.id),
    code: String(r.code),
    type,
    value,
    min_order_total: Number(r.min_order_amount ?? r.min_order_value ?? 0),
    max_uses: (r.max_uses ?? r.usage_limit) ?? undefined,
    current_uses: r.used_count ?? 0,
    starts_at: undefined,
    ends_at: r.expires_at ?? undefined,
    is_active: r.is_active,
    scope: r.scope_id ?? undefined,
    created_at: new Date().toISOString(),
    bxgy_buy_product_ids: r.bxgy_buy_product_ids,
    bxgy_buy_quantity: r.bxgy_buy_quantity,
    bxgy_get_product_ids: r.bxgy_get_product_ids,
    bxgy_get_quantity: r.bxgy_get_quantity,
    bxgy_get_discount_pct: r.bxgy_get_discount_pct,
  } satisfies AdminCoupon;
}

export async function getStoreCoupons(_storeId: string): Promise<Result<AdminCoupon[]>> {
  const res = await B.getStoreCouponsBackend();
  if (!res.ok) return fail(res.error);
  return ok((res.data.coupons as unknown[]).map((c) => mapSellerCouponRow(c as B.Coupon)));
}

export async function createStoreCoupon(coupon: Partial<AdminCoupon>): Promise<Result<AdminCoupon>> {
  // The seller mobile UI uses `min_order_total` / `max_uses`. CouponCreateSchema
  // (and the backend CouponSchema) use `min_order_value` / `usage_limit`. Remap
  // before validating so a seller-form save doesn't silently drop the fields.
  const remapped = {
    ...coupon,
    // No explicit minimum means no minimum. Falling back to `value` here
    // used to make a "Rs.500 off" coupon require a Rs.500 order.
    min_order_value: coupon.min_order_total ?? 0,
    usage_limit: coupon.max_uses,
  };
  const parsed = CouponCreateSchema.safeParse(remapped);
  if (!parsed.success) {
    return fail(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  }
  const storeId = (parsed.data as { store_id?: string }).store_id ?? parsed.data.scope;
  if (storeId) {
    const guard = await assertSellerCanOperate(storeId);
    if (!guard.ok) return guard;
  }
  const res = await B.createStoreCouponBackend({
    code: parsed.data.code,
    discount_type: parsed.data.type === "percentage" ? "percent" : parsed.data.type,
    discount_value: parsed.data.value,
    // Backend CouponSchema expects these names (Zod strips unknowns).
    min_order_value: parsed.data.min_order_value,
    usage_limit: parsed.data.usage_limit,
    is_active: parsed.data.is_active ?? true,
    scope: "store",
    scope_id: storeId,
    bxgy_buy_product_ids: parsed.data.bxgy_buy_product_ids,
    bxgy_get_product_ids: parsed.data.bxgy_get_product_ids,
    bxgy_buy_quantity: parsed.data.bxgy_buy_quantity,
    bxgy_get_quantity: parsed.data.bxgy_get_quantity,
    bxgy_get_discount_pct: parsed.data.bxgy_get_discount_pct,
  } as Parameters<typeof B.createStoreCouponBackend>[0]);
  if (!res.ok) return fail(res.error);
  return ok(mapSellerCouponRow(res.data.coupon));
}

export async function updateStoreCoupon(id: string, patch: Partial<AdminCoupon>): Promise<Result<AdminCoupon>> {
  const storeRes = await B.getSellerStoreBackend();
  if (!storeRes.ok) return fail(storeRes.error);
  const storeId = storeRes.data.store?.id;
  if (storeId) {
    const guard = await assertSellerCanOperate(storeId);
    if (!guard.ok) return guard;
  }
  const body: Record<string, unknown> = {};
  if (patch.code !== undefined) body.code = patch.code;
  if (patch.type !== undefined) {
    body.discount_type = patch.type === "percentage" ? "percent" : patch.type;
  }
  if (patch.value !== undefined) body.discount_value = patch.value;
  if (patch.min_order_total !== undefined) body.min_order_value = patch.min_order_total;
  if (patch.max_uses !== undefined) body.usage_limit = patch.max_uses;
  if (patch.is_active !== undefined) body.is_active = patch.is_active;
  if (patch.ends_at !== undefined) body.expires_at = patch.ends_at;
  if (patch.bxgy_buy_product_ids !== undefined) body.bxgy_buy_product_ids = patch.bxgy_buy_product_ids;
  if (patch.bxgy_get_product_ids !== undefined) body.bxgy_get_product_ids = patch.bxgy_get_product_ids;
  if (patch.bxgy_buy_quantity !== undefined) body.bxgy_buy_quantity = patch.bxgy_buy_quantity;
  if (patch.bxgy_get_quantity !== undefined) body.bxgy_get_quantity = patch.bxgy_get_quantity;
  if (patch.bxgy_get_discount_pct !== undefined) body.bxgy_get_discount_pct = patch.bxgy_get_discount_pct;
  const res = await B.updateStoreCouponBackend(id, body as Partial<B.Coupon>);
  if (!res.ok) return fail(res.error);
  return ok(mapSellerCouponRow(res.data.coupon));
}

export async function deleteStoreCoupon(id: string): Promise<Result<void>> {
  const storeRes = await B.getSellerStoreBackend();
  if (!storeRes.ok) return fail(storeRes.error);
  const storeId = storeRes.data.store?.id;
  if (storeId) {
    const guard = await assertSellerCanOperate(storeId);
    if (!guard.ok) return guard;
  }
  const res = await B.deleteStoreCouponBackend(id);
  if (!res.ok) return fail(res.error);
  return ok(undefined);
}

export async function getStoreAnalytics(
  _storeId: string,
  range: B.SellerAnalyticsRange = "30d",
): Promise<Result<{
  totalRevenue: number;
  totalOrders: number;
  totalProducts: number;
  avgOrderValue: number;
  refundRate: number;
  revenueByMonth: { month: string; revenue: number; orders: number }[];
  topProducts: { id: string; name: string; revenue: number; units: number }[];
  ordersByStatus: Record<string, number>;
}>> {
  const [analytics, products, orders] = await Promise.all([
    B.getSellerKPIsBackend(range),
    B.getSellerProductsBackend({ limit: 1 }),
    B.getSellerOrdersBackend({ limit: 200 }),
  ]);
  if (!analytics.ok) return fail(analytics.error);

  const stats =
    products.ok && products.data.stats && typeof products.data.stats === "object"
      ? products.data.stats
      : undefined;

  const ordersByStatus: Record<string, number> = {};
  if (orders.ok) {
    for (const order of loose<Order[]>(orders.data.orders ?? [])) {
      const key = String(order?.status ?? "unknown");
      ordersByStatus[key] = (ordersByStatus[key] ?? 0) + 1;
    }
  }

  return ok({
    totalRevenue: analytics.data.revenue,
    totalOrders: analytics.data.orders,
    totalProducts: (products.ok ? firstFiniteNumber(products.data.total, stats?.all, stats?.total) : null) ?? 0,
    avgOrderValue: analytics.data.aov,
    refundRate: analytics.data.refundRate,
    revenueByMonth: analytics.data.series.map((p) => ({
      month: p.date,
      revenue: p.revenue,
      orders: p.orders,
    })),
    topProducts: analytics.data.topProducts.map((p) => ({
      id: p.id,
      name: p.name,
      revenue: p.revenue,
      units: 0,
    })),
    ordersByStatus,
  });
}

// ============================================================================
// Search v2 + wishlist price drops + image scan
// ============================================================================

export type V2Suggestion = {
  kind: "keyword" | "store" | "brand" | "category" | "product";
  label: string;
  slug?: string;
  count?: number;
  logo_url?: string;
  followers?: number;
  is_verified?: boolean;
  trend_pct?: number;
  price?: number;
  mrp?: number;
  brand?: string;
};

export async function getSearchSuggestionsV2(term: string): Promise<Result<V2Suggestion[]>> {
  const cleanTerm = term.trim();
  if (cleanTerm.length < 1) return ok([]);
  // Reuse v1 endpoint and reshape — backend doesn't yet expose the v2 RPC.
  const res = await B.getSearchSuggestionsBackend(cleanTerm);
  if (!res.ok) return fail(res.error);
  const shaped: V2Suggestion[] = (res.data.suggestions as unknown[]).map((s) => {
    const row = s as {
      type: string;
      label: string;
      slug?: string;
      count?: number;
      image_url?: string | null;
      followers?: number;
      is_verified?: boolean;
      price?: number;
      mrp?: number;
      brand?: string;
    };
    const kind: V2Suggestion["kind"] =
      row.type === "store" || row.type === "brand" || row.type === "category" || row.type === "product"
        ? row.type
        : "keyword";
    return {
      kind,
      label: row.label,
      slug: row.slug,
      count: row.count,
      logo_url: row.image_url ?? undefined,
      followers: row.followers,
      is_verified: row.is_verified,
      trend_pct: 0,
      price: row.price,
      mrp: row.mrp,
      brand: row.brand,
    };
  });
  return ok(shaped);
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

export async function getWishlistPriceDrops(): Promise<Result<WishlistPriceDrop[]>> {
  // No dedicated endpoint; return empty — wishlist page can recompute from
  // current prices if needed.
  return ok([]);
}

export type ScanMatch = {
  kind: "product" | "store" | "none";
  product_id?: string;
  store_id?: string;
  slug?: string;
  confidence: number;
};

export async function uploadScanImage(
  uri: string,
  _source: "library" | "camera",
): Promise<Result<{ path: string; url: string }>> {
  try {
    // H-01 AUDIT: Use getStoreApiUrl() — no fallback host.
    const host = getStoreApiUrl().replace(/\/$/, "");
    if (!host) return fail("EXPO_PUBLIC_STORE_API_URL is not configured");

    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes?.user) return fail("Not authenticated");
    const { data: sessionRes } = await supabase.auth.getSession();
    const token = sessionRes?.session?.access_token;
    if (!token) return fail("Not authenticated");

    // M-15 AUDIT: Extension allow-list + 8 MB size cap.
    const SCAN_ALLOWED_EXTS = new Set(["jpg", "jpeg", "png", "webp", "heic", "heif"]);
    const rawExt = (uri.split(".").pop() ?? "jpg").toLowerCase().split("?")[0] || "jpg";
    const ext = rawExt === "jpeg" ? "jpg" : rawExt === "heif" ? "heic" : rawExt;
    if (!SCAN_ALLOWED_EXTS.has(ext)) return fail(`Unsupported image type ".${ext}"`);

    const filename = `${Date.now()}.${ext}`;
    const contentType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : ext === "heic" ? "image/heic" : "image/jpeg";

    const blob = await fetch(uri).then((r) => r.blob());
    const MAX_SCAN_BYTES = 8 * 1024 * 1024;
    if (blob.size > MAX_SCAN_BYTES) {
      return fail(`Image too large (${Math.round(blob.size / 1024 / 1024)} MB; max 8 MB)`);
    }

    const presignedRes = await fetch(`${host}/api/storage/presigned-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ bucket: "scan-uploads", filename, contentType }),
    });
    if (!presignedRes.ok) {
      const errData = await presignedRes.json().catch(() => ({}));
      return fail(errData.error || `Upload registration failed (HTTP ${presignedRes.status})`);
    }
    const { uploadUrl, publicUrl, key } = await presignedRes.json();
    const putRes = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: blob });
    if (!putRes.ok) return fail(`Failed to stream data to Cloudflare (HTTP ${putRes.status})`);
    return ok({ path: key, url: publicUrl });
  } catch (e: any) {
    return fail(e?.message ?? "Failed to upload scan");
  }
}

export async function reverseImageMatch(path: string): Promise<Result<ScanMatch>> {
  const res = await B.imageSearchBackend(path, 1);
  if (!res.ok) return fail(res.error);
  const first = res.data.matches?.[0];
  if (!first) return ok({ kind: "none", confidence: 0 });
  return ok({
    kind: "product",
    product_id: first.id,
    slug: first.slug,
    confidence: first.score ?? 0,
  });
}

/** Full catalogue grid for camera / gallery image search (batch C). */
export async function reverseImageSearch(imageUrl: string, limit = 12): Promise<Result<Product[]>> {
  const res = await B.imageSearchBackend(imageUrl, limit);
  if (!res.ok) return fail(res.error);
  const matches = res.data.matches ?? [];
  return ok(
    matches.map((m) =>
      mapFlatProductRow({
        id: m.id,
        name: m.name,
        slug: m.slug,
        price: m.price,
        image_url: m.image_url ?? m.images?.find((i) => i.is_primary)?.url ?? m.images?.[0]?.url,
      }),
    ),
  );
}

// Re-export helper for call-sites needing direct access.
export { getAccessToken, fetchJson };
export { searchProductsBackend } from "@/lib/api/backend";
export type { SearchResultRow } from "@/lib/api/backend";
