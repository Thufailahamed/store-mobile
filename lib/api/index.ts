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
  type ApiResult,
} from "@/lib/api/backend";
export type { ApiResult } from "@/lib/api/backend";
import * as B from "@/lib/api/backend";
import { hasStoreApi } from "@/lib/api/delivery-api";
import { supabase } from "@/lib/supabase/client";
import { mapProduct, mapProducts, mapStore, mapBrand, mapCategory, mapBanner } from "@/lib/api/product-mapper";
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
import { getSellerAccessState, getSellerComplianceGaps, type SellerPayoutCompliance, type SellerComplianceDocument, type ComplianceDocType } from "@/lib/seller-access";
import { getBrowsableStoreIds, isPublicCatalogProduct } from "@/lib/catalog-visibility";
import { getAvailableStock } from "@/lib/inventory";
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

export { mapProduct, mapProducts, mapStore, mapBrand } from "./product-mapper";
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

export async function getBrands(opts: { limit?: number; search?: string } = {}): Promise<Result<Brand[]>> {
  const res = await B.getBrandsBackend({ limit: opts.limit ?? 200 });
  if (!res.ok) return fail(res.error);
  return ok(loose<Brand[]>(res.data.brands ?? []));
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

export async function getFeaturedProducts(limit = 12): Promise<Result<Product[]>> {
  const res = await getProductCards({ limit, featuredOnly: true, sort: "popular" });
  return res;
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

export async function getFlashSaleProducts(limit = 5): Promise<Result<Product[]>> {
  const res = await B.getHomepageBackend();
  if (!res.ok) return fail(res.error);
  const drops = (res.data.drops ?? []) as Array<{ product: any }>;
  const products = drops
    .map((d) => d.product)
    .filter(Boolean)
    .map(mapProduct);
  return ok(products.slice(0, limit));
}

export async function getFlashSaleEndsAt(): Promise<string> {
  // No dedicated endpoint; fall back to a safe default 6h ahead.
  return new Date(Date.now() + 6 * 3600_000).toISOString();
}

// ============================================================================
// Search
// ============================================================================

export async function searchProducts(query: string, limit = 20): Promise<Result<Product[]>> {
  const term = query.trim();
  if (!term) return ok([]);
  const words = tokenizeQuery(term);
  if (words.length === 0) return ok([]);

  // Use backend's /api/catalog/search RPC.
  const res = await B.searchProductsBackend({
    q: term,
    sort: "relevance",
    limit: Math.max(limit * 2, 40),
  });
  if (!res.ok) {
    // Fuzzy fallback via /api/catalog/products with text search.
    const fallback = await B.getProductsBackend({ search: term, limit });
    if (!fallback.ok) return fail(fallback.error);
    return ok(mapProducts(fallback.data.products) ?? []);
  }

  const rawProducts = res.data.products ?? [];
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

  // Fuzzy fallback if too few.
  if (backendProducts.length + colorHits.length < 3 && term.length >= 3) {
    const all = await B.getProductsBackend({ search: term, limit: 80 });
    if (all.ok) {
      const lower = term.toLowerCase();
      const mapped = mapProducts(all.data.products) ?? [];
      const seen = new Set([...backendProducts, ...colorHits].map((p) => p.id));
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
  return ok(loose<Store | null>(res.data.store ?? null));
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
  return ok(loose<Store>(res.data.store));
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
  limit?: number;
  offset?: number;
} = {}): Promise<Result<{ products: Product[]; total: number }>> {
  const res = await B.getSellerProductsBackend({
    limit: opts.limit,
    offset: opts.offset,
    status: opts.status && opts.status !== "all" ? opts.status : undefined,
    search: opts.search,
  });
  if (!res.ok) return fail(res.error);
  void storeId;
  const products = (res.data.products as unknown[]).map((p) => mapProduct(p));
  return ok({ products: products ?? [], total: res.data.total ?? products.length });
}

export async function createSellerProduct(product: Partial<Product>): Promise<Result<Product>> {
  if (!product.store_id) return fail("Store is required");
  const guard = await assertSellerCanOperate(product.store_id);
  if (!guard.ok) return guard;
  const res = await B.createSellerProductBackend(product as Partial<B.CatalogProduct> & { name: string; price: number });
  if (!res.ok) return fail(res.error);
  return ok(mapProduct(res.data.product));
}

export async function updateSellerProduct(id: string, patch: Partial<Product>): Promise<Result<Product>> {
  const res = await B.updateSellerProductBackend(id, patch as Partial<B.CatalogProduct>);
  if (!res.ok) return fail(res.error);
  return ok(mapProduct(res.data.product));
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

export async function deleteSellerProductImage(_imageId: string): Promise<Result<void>> {
  // Backend has no specific image-delete endpoint yet — the seller image
  // set is rebuilt on each PATCH product call. Return success and let the
  // caller re-PATCH the product with the desired image list.
  return ok(undefined);
}

export async function setSellerProductImagePrimary(_productId: string, _imageId: string): Promise<Result<void>> {
  // Same as above — re-PATCH with the chosen primary image.
  return ok(undefined);
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
  _removedIds: string[] = [],
): Promise<Result<void>> {
  const guard = await assertSellerCanOperate(storeId);
  if (!guard.ok) return guard;
  // Translate variant list to backend PATCH product call. Backend doesn't
  // yet expose a dedicated /api/seller/products/:id/variants endpoint, so
  // fall back to inline update with the new variant set.
  const res = await B.updateSellerProductBackend(productId, {
    variants: variants as unknown as B.CatalogProduct["variants"],
  } as Partial<B.CatalogProduct>);
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
} = {}): Promise<Result<Order[]>> {
  const res = await B.getSellerOrdersBackend({
    limit: opts.limit,
    offset: opts.offset,
    status: opts.status && opts.status !== "all" ? opts.status : undefined,
  });
  if (!res.ok) return fail(res.error);
  void storeId;
  return ok(loose<Order[]>(res.data.orders ?? []));
}

export async function getSellerOrderById(orderId: string, storeId: string): Promise<Result<Order | null>> {
  const res = await B.getOrderByIdBackend(orderId);
  if (!res.ok) return fail(res.error);
  if (!res.data.order) return ok(null);
  return ok(scopeOrderToStore(loose<Order>(res.data.order), storeId));
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

export async function cancelOrder(orderId: string): Promise<Result<{ status: string }>> {
  const res = await B.cancelOrderBackend(orderId);
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
  variants: (ProductVariant & { quantity: number; reserved: number; available: number; stock: number })[];
}[]>> {
  const res = await B.getSellerInventoryBackend();
  if (!res.ok) return fail(res.error);
  const list = (res.data.inventory as unknown[]).map((row) => {
    const r = row as {
      variant_id: string; sku: string; size?: string; color?: string; color_hex?: string;
      price: number;
      product: { id: string; name: string; status: string };
      inventory: { quantity: number; reserved: number };
    };
    const quantity = Math.max(0, Number(r.inventory?.quantity ?? 0));
    const reserved = Math.max(0, Number(r.inventory?.reserved ?? 0));
    const available = getAvailableStock(r.inventory, quantity - reserved);
    const variant: ProductVariant & { quantity: number; reserved: number; available: number; stock: number } = {
      id: r.variant_id,
      sku: r.sku,
      size: r.size,
      color: r.color,
      color_hex: r.color_hex,
      price: r.price,
      quantity,
      reserved,
      available,
      stock: quantity,
      is_active: true,
    } as unknown as ProductVariant & { quantity: number; reserved: number; available: number; stock: number };
    return { product: { id: r.product.id, name: r.product.name } as unknown as Product, variants: [variant] };
  });
  return ok(list);
}

export async function updateVariantStock(variantId: string, stock: number): Promise<Result<void>> {
  const res = await B.updateVariantStockBackend(variantId, stock);
  if (!res.ok) return fail(res.error);
  return ok(undefined);
}

export async function getSellerKPIs(storeId: string): Promise<Result<{
  totalRevenue: number;
  totalOrders: number;
  totalProducts: number;
  pendingOrders: number;
  lowStockVariants: number;
  recentOrders: Order[];
}>> {
  const [kpis, orders, products] = await Promise.all([
    B.getSellerKPIsBackend(),
    B.getSellerOrdersBackend({ limit: 100 }),
    B.getSellerProductsBackend({ limit: 100 }),
  ]);
  if (!kpis.ok) return fail(kpis.error);
  const recentOrders = orders.ok ? loose<Order[]>(orders.data.orders ?? []).slice(0, 5) : [];
  return ok({
    totalRevenue: kpis.data.revenue ?? 0,
    totalOrders: kpis.data.orders ?? 0,
    totalProducts: products.ok ? (products.data.products?.length ?? 0) : 0,
    pendingOrders: kpis.data.pending ?? 0,
    lowStockVariants: 0,
    recentOrders,
  });
  void storeId;
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
    totalProducts: 0,
    activeProducts: 0,
    totalOrders: res.data.orders ?? 0,
    totalRevenue: res.data.revenue ?? 0,
  });
  void brandId;
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
  const res = await B.getAdminStatsBackend();
  if (!res.ok) return fail(res.error);
  return ok({
    totalUsers: (res.data as { users?: number }).users ?? 0,
    totalStores: (res.data as { stores?: number }).stores ?? 0,
    totalProducts: (res.data as { products?: number }).products ?? 0,
    totalOrders: (res.data as { orders?: number }).orders ?? 0,
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
  const res = await B.getAdminUsersBackend(opts);
  if (!res.ok) return fail(res.error);
  return ok({ users: loose<User[]>(res.data.users ?? []), total: res.data.total ?? 0 });
}

export async function updateUserRole(userId: string, role: string): Promise<Result<void>> {
  const res = await B.updateUserRoleBackend(userId, role);
  if (!res.ok) return fail(res.error);
  return ok(undefined);
}

export async function getAdminStores(opts: {
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<Result<{ stores: (Store & { complianceGaps: string[] })[]; total: number }>> {
  const res = await B.getAdminStoresBackend(opts);
  if (!res.ok) return fail(res.error);
  const stores = (res.data.stores as (Store & { complianceGaps?: string[] })[]).map((s) => ({
    ...s,
    complianceGaps: s.complianceGaps ?? [],
  }));
  return ok({ stores, total: res.data.total ?? stores.length });
}

export async function approveStore(storeId: string, status: "approved" | "rejected"): Promise<Result<void>> {
  const res = await B.approveStoreBackend(storeId, status === "approved" ? "approved" : "rejected");
  if (!res.ok) return fail(res.error);
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
  const res = await B.getAdminStoreDetailBackend(id);
  if (!res.ok) return fail(res.error);
  void res; // unused in shim
  return ok(null);
}

export async function getAdminOrders(opts: {
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<Result<Order[]>> {
  const res = await B.getAdminOrdersBackend(opts);
  if (!res.ok) return fail(res.error);
  return ok(loose<Order[]>(res.data.orders ?? []));
}

export async function getAdminProducts(opts: {
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<Result<{ products: Product[]; total: number }>> {
  const res = await B.getAdminProductsBackend(opts);
  if (!res.ok) return fail(res.error);
  return ok({ products: (res.data.products as Product[]) ?? [], total: res.data.total ?? 0 });
}

export async function getAdminBrands(opts: {
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<Result<{ brands: Brand[]; total: number }>> {
  const res = await B.getAdminBrandsBackend(opts);
  if (!res.ok) return fail(res.error);
  return ok({ brands: loose<Brand[]>(res.data.brands ?? []), total: res.data.total ?? 0 });
}

export async function approveBrand(brandId: string, status: "approved" | "rejected"): Promise<Result<void>> {
  const res = await B.approveBrandBackend(brandId, status);
  if (!res.ok) return fail(res.error);
  return ok(undefined);
}

export async function approveProduct(productId: string, status: "active" | "rejected" | "archived"): Promise<Result<void>> {
  const res = await B.approveProductBackend(productId, status);
  if (!res.ok) return fail(res.error);
  return ok(undefined);
}

export async function setProductFeatured(productId: string, isFeatured: boolean): Promise<Result<void>> {
  const res = await B.setProductFeaturedBackend(productId, isFeatured);
  if (!res.ok) return fail(res.error);
  return ok(undefined);
}

export async function setProductActive(productId: string, isActive: boolean): Promise<Result<void>> {
  const res = await B.setProductActiveBackend(productId, isActive);
  if (!res.ok) return fail(res.error);
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
  const res = await B.getAdminBannersBackend();
  if (!res.ok) return fail(res.error);
  return ok(loose<Banner[]>(res.data.banners ?? []));
}

export async function createBanner(b: Partial<Banner>): Promise<Result<Banner>> {
  const res = await B.createBannerBackend(b);
  if (!res.ok) return fail(res.error);
  return ok(loose<Banner>(res.data.banner));
}

export async function updateBanner(id: string, patch: Partial<Banner>): Promise<Result<Banner>> {
  const res = await B.updateBannerBackend(id, patch);
  if (!res.ok) return fail(res.error);
  return ok(loose<Banner>(res.data.banner));
}

export async function deleteBanner(id: string): Promise<Result<void>> {
  const res = await B.deleteBannerBackend(id);
  if (!res.ok) return fail(res.error);
  return ok(undefined);
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
}).superRefine((v, ctx) => {
  if (v.type === "percentage" && v.value > 100) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["value"], message: "Percentage coupons cannot exceed 100%" });
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
  const res = await B.getAdminAuditLogBackend(limit);
  if (!res.ok) return fail(res.error);
  return ok((res.data.entries as AuditEntry[]) ?? []);
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

export async function getAdminDeliveryCompanyDetail(_id: string): Promise<Result<AdminDeliveryCompanyDetail>> {
  // Skipped — out of scope per user.
  return fail("Delivery company admin skipped");
}

export async function updateAdminDeliveryCompanyStatus(_id: string, _status: "pending" | "active" | "suspended" | "rejected"): Promise<Result<DeliveryCompany>> {
  return fail("Delivery company admin skipped");
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

export async function getAdminGiftCards(): Promise<Result<GiftCard[]>> {
  const res = await B.getAdminGiftCardsBackend();
  if (!res.ok) return fail(res.error);
  return ok((res.data.cards as GiftCard[]) ?? []);
}

export async function createGiftCard(g: Partial<GiftCard>): Promise<Result<GiftCard>> {
  const res = await B.createGiftCardBackend(g as Record<string, unknown>);
  if (!res.ok) return fail(res.error);
  return ok(res.data.card as GiftCard);
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
  const res = await B.getAdminLowStockBackend(limit);
  if (!res.ok) return fail(res.error);
  return ok(loose<LowStockItem[]>(res.data.items ?? []));
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
  const res = await B.getAdminOverviewStatsBackend();
  if (!res.ok) return fail(res.error);
  return ok(res.data as unknown as AdminOverviewStats);
}

export async function getAdminRecentSignups(limit = 8): Promise<Result<User[]>> {
  const res = await B.getAdminRecentSignupsBackend(limit);
  if (!res.ok) return fail(res.error);
  return ok((res.data.users as User[]) ?? []);
}

export async function getAdminRecentOrders(limit = 6): Promise<Result<Order[]>> {
  const res = await B.getAdminRecentOrdersBackend(limit);
  if (!res.ok) return fail(res.error);
  return ok(loose<Order[]>(res.data.orders ?? []));
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
  const res = await B.getAdminPendingApprovalsBackend();
  if (!res.ok) return fail(res.error);
  return ok(res.data as unknown as AdminApprovals);
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
  tags: string[];
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

export type SellerReturnRequest = MobileReturnRequest & { buyer_name: string | null };

export async function getReturns(_userId: string): Promise<Result<MobileReturnRequest[]>> {
  const res = await B.listReturnsBackend();
  if (!res.ok) return fail(res.error);
  return ok((res.data.returns as unknown[] as MobileReturnRequest[]) ?? []);
}

export async function getReturnByGroupId(userId: string, returnGroupId: string): Promise<Result<MobileReturnRequest | null>> {
  const res = await B.getReturnByGroupIdBackend(returnGroupId);
  if (!res.ok) return fail(res.error);
  const found = (res.data.returns as unknown[] as MobileReturnRequest[]).find((r) => r.return_group_id === returnGroupId);
  void userId;
  return ok(found ?? null);
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

export async function getSellerReturns(_storeId: string, _opts: { status?: string; search?: string } = {}): Promise<Result<SellerReturnRequest[]>> {
  const res = await B.getSellerReturnsBackend();
  if (!res.ok) return fail(res.error);
  return ok((res.data.returns as unknown[] as SellerReturnRequest[]) ?? []);
}

export async function getSellerReturnByGroupId(storeId: string, returnGroupId: string): Promise<Result<SellerReturnRequest | null>> {
  const res = await getSellerReturns(storeId);
  if (!res.ok) return res;
  return ok(res.data.find((r) => r.return_group_id === returnGroupId) ?? null);
}

export async function decideSellerReturn(
  _actorUserId: string,
  returnId: string,
  action: SellerReturnAction,
  opts: { note?: string; refundAmount?: number } = {},
): Promise<Result<{ refund_id?: string }>> {
  const res = await B.decideSellerReturnBackend(returnId, action, opts.note);
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

export async function getStoreReviews(_storeId: string, opts: {
  rating?: number;
  search?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<Result<{ reviews: Review[]; total: number; avgRating: number; ratingBreakdown: Record<number, number> }>> {
  const res = await B.getStoreReviewsBackend("", opts);
  if (!res.ok) return fail(res.error);
  const reviews = loose<Review[]>(res.data.reviews ?? []);
  const total = res.data.total ?? reviews.length;
  const ratings = reviews.map((r) => r.rating ?? 0);
  const avgRating = ratings.length ? ratings.reduce((s, r) => s + r, 0) / ratings.length : 0;
  const breakdown: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  for (const r of ratings) breakdown[r] = (breakdown[r] ?? 0) + 1;
  return ok({ reviews, total, avgRating, ratingBreakdown: breakdown });
}

// ============================================================================
// Seller — Coupons + analytics
// ============================================================================

export async function getStoreCoupons(_storeId: string): Promise<Result<AdminCoupon[]>> {
  const res = await B.getStoreCouponsBackend();
  if (!res.ok) return fail(res.error);
  return ok((res.data.coupons as unknown[] as AdminCoupon[]) ?? []);
}

export async function createStoreCoupon(coupon: Partial<AdminCoupon>): Promise<Result<AdminCoupon>> {
  const parsed = CouponCreateSchema.safeParse(coupon);
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
    discount_type: parsed.data.type === "percentage" ? "percent" : (parsed.data.type as "percent" | "fixed" | "free_shipping"),
    discount_value: parsed.data.value,
    min_order_amount: parsed.data.min_order_value,
    max_uses: parsed.data.usage_limit,
    is_active: parsed.data.is_active ?? true,
    scope: "store",
    scope_id: storeId,
  });
  if (!res.ok) return fail(res.error);
  return ok(res.data.coupon as unknown as AdminCoupon);
}

export async function getStoreAnalytics(_storeId: string): Promise<Result<{
  totalRevenue: number;
  totalOrders: number;
  totalProducts: number;
  avgOrderValue: number;
  conversionRate: number;
  revenueByMonth: { month: string; revenue: number; orders: number }[];
  topProducts: { name: string; revenue: number; units: number; image?: string }[];
  ordersByStatus: Record<string, number>;
}>> {
  const res = await B.getSellerAnalyticsBackend();
  if (!res.ok) return fail(res.error);
  return ok({
    totalRevenue: 0,
    totalOrders: 0,
    totalProducts: 0,
    avgOrderValue: 0,
    conversionRate: 0,
    revenueByMonth: [],
    topProducts: [],
    ordersByStatus: {},
  });
}

// ============================================================================
// Search v2 + wishlist price drops + image scan
// ============================================================================

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

export async function getSearchSuggestionsV2(term: string): Promise<Result<V2Suggestion[]>> {
  const cleanTerm = term.trim();
  if (cleanTerm.length < 1) return ok([]);
  // Reuse v1 endpoint and reshape — backend doesn't yet expose the v2 RPC.
  const res = await B.getSearchSuggestionsBackend(cleanTerm);
  if (!res.ok) return fail(res.error);
  const shaped: V2Suggestion[] = (res.data.suggestions as unknown[]).map((s) => {
    const row = s as { type: string; label: string; slug?: string; count?: number; logo_url?: string; followers?: number; is_verified?: boolean };
    const kind = row.type === "store" ? "store" : row.type === "brand" ? "brand" : "keyword";
    return { kind, label: row.label, slug: row.slug, count: row.count, logo_url: row.logo_url, followers: row.followers, is_verified: row.is_verified, trend_pct: 0 };
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
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes?.user) return fail("Not authenticated");
    const { data: sessionRes } = await supabase.auth.getSession();
    const token = sessionRes?.session?.access_token;
    if (!token) return fail("Not authenticated");
    const ext = (uri.split(".").pop() ?? "jpg").toLowerCase().split("?")[0] || "jpg";
    const filename = `${Date.now()}.${ext}`;
    const contentType = `image/${ext}`;
    const blob = await fetch(uri).then((r) => r.blob());
    const host = (process.env.EXPO_PUBLIC_STORE_API_URL ?? "https://store-three-xi-58.vercel.app").replace(/\/$/, "");
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

// Re-export helper for call-sites needing direct access.
export { getAccessToken, fetchJson };
