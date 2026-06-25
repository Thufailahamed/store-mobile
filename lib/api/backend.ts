/**
 * Backend wrappers — typed Hono-bound functions for every endpoint the
 * mobile app consumes. Replaces the ~250 direct Supabase call sites
 * scattered through `lib/api/index.ts`.
 *
 * Organized by domain to match the backend module structure. Each
 * function returns `ApiResult<T>` from `./_fetch`. Public reads set
 * `requireAuth: false`; everything else defaults to requiring a session.
 */

import { fetchJson, type ApiResult } from "./_fetch";
export type { ApiResult } from "./_fetch";
export { fetchJson, getAccessToken, hasStoreApi, getStoreApiUrl } from "./_fetch";

// =========================================================================
// PUBLIC READS — catalogue, search, categories, banners, blog, homepage
// =========================================================================

export type CatalogProduct = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  sku?: string;
  price: number;
  mrp?: number;
  currency: string;
  status: string;
  is_active: boolean;
  total_sales?: number;
  rating?: number;
  total_reviews?: number;
  created_at: string;
  images?: Array<{ url: string; is_primary?: boolean; position?: number }>;
  brand?: { id: string; name: string; slug: string; logo_url?: string | null };
  store?: { id: string; name: string; slug: string };
  category?: { id: string; name: string; slug: string };
  variants?: Array<{ id: string; sku?: string; size?: string; color?: string; color_hex?: string; price: number; mrp?: number; position?: number; is_active?: boolean; inventory?: { quantity: number; reserved: number } | null }>;
};

export async function getProductsBackend(opts: {
  brand?: string;
  store?: string;
  category?: string;
  gender?: string;
  search?: string;
  sort?: "newest" | "price_asc" | "price_desc" | "rating" | "popularity";
  limit?: number;
  offset?: number;
} = {}): Promise<ApiResult<{ count: number; limit: number; offset: number; products: CatalogProduct[] }>> {
  return fetchJson("/api/catalog/products", { requireAuth: false, query: { ...opts } });
}

export async function getProductByIdBackend(id: string): Promise<ApiResult<{ product: CatalogProduct }>> {
  return fetchJson(`/api/catalog/products/${id}`, { requireAuth: false });
}

export async function getProductBySlugBackend(slug: string): Promise<ApiResult<{ product: CatalogProduct }>> {
  return fetchJson(`/api/catalog/products/slug/${slug}`, { requireAuth: false });
}

export async function getProductsByIdsBackend(ids: string[], includeInactive?: boolean): Promise<ApiResult<{ products: CatalogProduct[] }>> {
  return fetchJson("/api/catalog/products/by-ids", {
    method: "POST",
    requireAuth: false,
    body: { ids, include_inactive: includeInactive },
  });
}

export type SearchResultRow = {
  id: string;
  name: string;
  slug: string;
  mrp: number;
  price: number;
  discountPct: number;
  rating: number;
  totalReviews: number;
  storeId: string;
  brandId: string;
  image: string | null;
};

export async function searchProductsBackend(opts: {
  q: string;
  brand?: string;
  store?: string;
  category?: string;
  gender?: "men" | "women" | "kids" | "unisex";
  min_price?: number;
  max_price?: number;
  min_rating?: number;
  in_stock?: boolean;
  sort?: "relevance" | "newest" | "price_asc" | "price_desc" | "rating" | "popularity";
  limit?: number;
  offset?: number;
} = { q: "" }): Promise<ApiResult<{ query: string; count: number; products: SearchResultRow[]; expansion?: { tokens: string[]; gender: string | null; garment: string | null; suggestions?: string[] } }>> {
  return fetchJson("/api/catalog/search", { requireAuth: false, query: { ...opts } });
}

export type Brand = { id: string; name: string; slug: string; logo_url?: string | null; banner_url?: string | null; tagline?: string | null; description?: string | null; is_active?: boolean; status?: string; followers_count?: number };

export async function getBrandsBackend(opts: { limit?: number; search?: string; offset?: number } = {}): Promise<ApiResult<{ brands: Brand[] }>> {
  return fetchJson("/api/catalog/brands", { requireAuth: false, query: { limit: opts.limit ?? 60, search: opts.search, offset: opts.offset } });
}

export async function getBrandByIdBackend(id: string): Promise<ApiResult<{ brand: Brand & { followers?: Array<{ count: number }> } }>> {
  return fetchJson(`/api/catalog/brands/${id}`, { requireAuth: false });
}

export async function getBrandBySlugBackend(slug: string): Promise<ApiResult<{ brand: Brand & { followers?: Array<{ count: number }> } }>> {
  return fetchJson(`/api/catalog/brands/by-slug/${slug}`, { requireAuth: false });
}

export type Store = { id: string; name: string; slug: string; logo_url?: string | null; banner_url?: string | null; description?: string | null; is_active?: boolean; status?: string; followers_count?: number; total_followers?: number };

export async function getStoresBackend(opts: { limit?: number } = {}): Promise<ApiResult<{ stores: Store[] }>> {
  return fetchJson("/api/catalog/stores", { requireAuth: false, query: { limit: opts.limit ?? 60 } });
}

export async function getStoreByIdBackend(id: string): Promise<ApiResult<{ store: Store }>> {
  return fetchJson(`/api/catalog/stores/${id}`, { requireAuth: false });
}

export async function getStoreBySlugBackend(slug: string): Promise<ApiResult<{ store: Store }>> {
  return fetchJson(`/api/catalog/stores/by-slug/${slug}`, { requireAuth: false });
}

export type Category = { id: string; name: string; slug: string; parent_id?: string | null; image_url?: string | null; is_active?: boolean; position?: number };

export async function getCategoriesBackend(): Promise<ApiResult<{ categories: Category[] }>> {
  return fetchJson("/api/categories", { requireAuth: false });
}

export async function getCategoryBySlugBackend(slug: string): Promise<ApiResult<{ category: Category }>> {
  return fetchJson(`/api/categories/${slug}`, { requireAuth: false });
}

export type Banner = { id: string; title?: string | null; subtitle?: string | null; image_url?: string | null; mobile_image_url?: string | null; link_url?: string | null; link_type?: string | null; placement?: string; sort_order?: number; is_active?: boolean };

export async function getBannersBackend(opts: { placement?: string; limit?: number } = {}): Promise<ApiResult<{ banners: Banner[] }>> {
  return fetchJson("/api/banners", { requireAuth: false, query: { ...opts } });
}

export type BlogPost = { id: string; title: string; slug: string; excerpt?: string | null; cover_image_url?: string | null; author?: string | null; tags?: string[]; published_at?: string; created_at: string; body?: string; seo_title?: string | null; seo_description?: string | null };

export async function getBlogPostsBackend(opts: { tag?: string; limit?: number; offset?: number } = {}): Promise<ApiResult<{ count: number; limit: number; offset: number; posts: BlogPost[] }>> {
  return fetchJson("/api/blog/posts", { requireAuth: false, query: { ...opts } });
}

export async function getBlogPostBySlugBackend(slug: string): Promise<ApiResult<{ post: BlogPost }>> {
  return fetchJson(`/api/blog/posts/${slug}`, { requireAuth: false });
}

export async function getBlogTagsBackend(): Promise<ApiResult<{ tags: string[] }>> {
  return fetchJson("/api/blog/tags", { requireAuth: false });
}

export type HomepagePayload = {
  layout: unknown[];
  hero: unknown;
  marquee: unknown[];
  drops: unknown[];
  productPicks: unknown[];
  tenets: unknown[];
  testimonials: unknown[];
  newsletter: unknown;
  promises: unknown[];
};

let homepageCache: { data: HomepagePayload; timestamp: number } | null = null;
let homepagePromise: Promise<ApiResult<HomepagePayload>> | null = null;

export async function getHomepageBackend(): Promise<ApiResult<HomepagePayload>> {
  const now = Date.now();
  if (homepageCache && now - homepageCache.timestamp < 10000) {
    return { ok: true, data: homepageCache.data };
  }
  if (homepagePromise) {
    return homepagePromise;
  }
  homepagePromise = fetchJson<HomepagePayload>("/api/homepage", { requireAuth: false }).then((res) => {
    homepagePromise = null;
    if (res.ok) {
      homepageCache = { data: res.data, timestamp: Date.now() };
    }
    return res;
  });
  return homepagePromise;
}

export type ImageSearchMatch = { id: string; name: string; slug: string; price: number; score?: number; image_url?: string; images?: Array<{ url: string; is_primary?: boolean }> };

export async function imageSearchBackend(imageUrl: string, limit = 12): Promise<ApiResult<{ matches: ImageSearchMatch[]; fallback?: boolean }>> {
  return fetchJson("/api/catalog/image-search", {
    requireAuth: false,
    method: "POST",
    body: { image_url: imageUrl, limit },
  });
}

// =========================================================================
// USERS — profile, addresses, wishlist, cart, follows, stock-alerts, etc.
// =========================================================================

export type UserProfile = { id: string; email?: string; full_name?: string; phone?: string; role?: string; avatar_url?: string; loyalty_points?: number };

export async function getProfileBackend(): Promise<ApiResult<{ user: UserProfile }>> {
  return fetchJson("/api/account/me");
}

export async function updateProfileBackend(patch: {
  full_name?: string;
  phone?: string | null;
  avatar_url?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<ApiResult<{ user: UserProfile }>> {
  return fetchJson("/api/account/me", { method: "PATCH", body: patch });
}

export type Address = {
  id: string;
  type: "home" | "work" | "other";
  full_name: string;
  phone: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  latitude?: number | null;
  longitude?: number | null;
  is_default: boolean;
};

export async function listAddressesBackend(): Promise<ApiResult<{ addresses: Address[] }>> {
  return fetchJson("/api/users/addresses");
}

export async function createAddressBackend(addr: Omit<Address, "id">): Promise<ApiResult<{ address: Address }>> {
  return fetchJson("/api/users/addresses", { method: "POST", body: addr });
}

export async function updateAddressBackend(id: string, patch: Partial<Address>): Promise<ApiResult<{ address: Address }>> {
  return fetchJson(`/api/users/addresses/${id}`, { method: "PATCH", body: patch });
}

export async function deleteAddressBackend(id: string): Promise<ApiResult<{ deleted: boolean }>> {
  return fetchJson(`/api/users/addresses/${id}`, { method: "DELETE" });
}

export async function setDefaultAddressBackend(id: string): Promise<ApiResult<{ address: Address }>> {
  return fetchJson(`/api/users/addresses/${id}/default`, { method: "POST" });
}

export type WishlistItem = {
  id: string;
  product_id: string;
  created_at: string;
  product?: { id: string; name: string; slug: string; price: number; images?: Array<{ url: string; is_primary?: boolean }> };
};

export async function listWishlistBackend(): Promise<ApiResult<{ items: WishlistItem[] }>> {
  return fetchJson("/api/users/wishlist");
}

export async function addWishlistBackend(productId: string): Promise<ApiResult<{ added: boolean }>> {
  return fetchJson("/api/users/wishlist", { method: "POST", body: { product_id: productId } });
}

export async function removeWishlistBackend(productId: string): Promise<ApiResult<{ removed: boolean }>> {
  return fetchJson(`/api/users/wishlist/${productId}`, { method: "DELETE" });
}

export type CartLine = {
  id: string;
  product_id: string;
  variant_id?: string | null;
  store_id?: string | null;
  quantity: number;
  unit_price?: number;
  product_name?: string;
  variant_label?: string | null;
  sku?: string | null;
  image_url?: string | null;
  created_at?: string;
  updated_at?: string;
};

export async function getCartBackend(): Promise<ApiResult<{ cart_id: string; lines: CartLine[] }>> {
  return fetchJson("/api/users/cart");
}

export type CartLineInput = Omit<CartLine, "id" | "created_at" | "updated_at">;

export async function putCartBackend(lines: CartLineInput[], currency = "LKR"): Promise<ApiResult<{ cart_id: string; lines: CartLine[]; replaced: number }>> {
  return fetchJson("/api/users/cart", { method: "PUT", body: { lines, currency } });
}

export async function clearCartBackend(): Promise<ApiResult<{ cleared: boolean }>> {
  return fetchJson("/api/users/cart", { method: "DELETE" });
}

export async function addCartLineBackend(line: CartLineInput): Promise<ApiResult<{ line: CartLine }>> {
  return fetchJson("/api/users/cart/lines", { method: "POST", body: line });
}

export async function patchCartLineBackend(id: string, quantity: number): Promise<ApiResult<{ line: CartLine; removed?: boolean }>> {
  return fetchJson(`/api/users/cart/lines/${id}`, { method: "PATCH", body: { quantity } });
}

export async function removeCartLineBackend(id: string): Promise<ApiResult<{ removed: boolean }>> {
  return fetchJson(`/api/users/cart/lines/${id}`, { method: "DELETE" });
}

export type FollowEntry = {
  store_id?: string;
  brand_id?: string;
  created_at: string;
  store?: Store;
  brand?: Brand;
};

export async function listFollowedStoresBackend(): Promise<ApiResult<{ follows: FollowEntry[] }>> {
  return fetchJson("/api/users/follows/stores");
}

export async function listFollowedBrandsBackend(): Promise<ApiResult<{ follows: FollowEntry[] }>> {
  return fetchJson("/api/users/follows/brands");
}

export async function followStoreBackend(id: string): Promise<ApiResult<{ following: boolean }>> {
  return fetchJson(`/api/users/follows/stores/${id}`, { method: "POST" });
}

export async function unfollowStoreBackend(id: string): Promise<ApiResult<{ following: boolean }>> {
  return fetchJson(`/api/users/follows/stores/${id}`, { method: "DELETE" });
}

export async function followBrandBackend(id: string): Promise<ApiResult<{ following: boolean }>> {
  return fetchJson(`/api/users/follows/brands/${id}`, { method: "POST" });
}

export async function unfollowBrandBackend(id: string): Promise<ApiResult<{ following: boolean }>> {
  return fetchJson(`/api/users/follows/brands/${id}`, { method: "DELETE" });
}

export type StockAlert = {
  id: string;
  product_id: string;
  variant_id?: string | null;
  status: string;
  created_at: string;
  product?: { id: string; name: string; slug: string; images?: Array<{ url: string; is_primary?: boolean }> };
};

export async function listStockAlertsBackend(): Promise<ApiResult<{ alerts: StockAlert[] }>> {
  return fetchJson("/api/users/stock-alerts");
}

export async function isStockAlertSubscribedBackend(productId: string): Promise<ApiResult<{ subscribed: boolean; alert: { id: string; variant_id?: string | null; status: string } | null }>> {
  return fetchJson(`/api/users/stock-alerts/${productId}/status`);
}

export async function subscribeStockAlertBackend(productId: string, variantId?: string): Promise<ApiResult<{ alert: StockAlert }>> {
  return fetchJson("/api/users/stock-alerts", { method: "POST", body: { product_id: productId, variant_id: variantId ?? null } });
}

export async function cancelStockAlertBackend(productId: string): Promise<ApiResult<{ cancelled: boolean }>> {
  return fetchJson(`/api/users/stock-alerts/${productId}`, { method: "DELETE" });
}

export type LoyaltyBalance = { points: number; tier?: string; transactions?: Array<{ id: string; type: string; points: number; reason: string; created_at: string }> };

export async function getLoyaltyBalanceBackend(): Promise<ApiResult<LoyaltyBalance>> {
  return fetchJson("/api/users/loyalty/balance");
}

export async function redeemLoyaltyBackend(points: number, reason?: string): Promise<ApiResult<{ newBalance: number; transaction_id: string }>> {
  return fetchJson("/api/users/loyalty/redeem", { method: "POST", body: { points, reason: reason ?? "Redeemed" } });
}

export type Notification = {
  id: string;
  type: string;
  channel?: string;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  read_at?: string | null;
  created_at: string;
};

export async function listNotificationsBackend(limit = 30): Promise<ApiResult<{ notifications: Notification[] }>> {
  return fetchJson("/api/notifications", { query: { limit } });
}

export async function markNotificationReadBackend(id: string): Promise<ApiResult<{ read: boolean }>> {
  return fetchJson(`/api/notifications/${id}`, { method: "PATCH", body: { read: true } });
}

export async function markAllNotificationsReadBackend(): Promise<ApiResult<{ updated: number }>> {
  return fetchJson("/api/notifications", { method: "POST", body: { action: "mark_all_read" } });
}

export async function registerPushTokenBackend(
  input: { token: string; platform: "ios" | "android"; device_id?: string },
): Promise<ApiResult<{ push_token: { id: string; token: string; platform: string } | null }>> {
  return fetchJson("/api/notifications/push-token", {
    method: "POST",
    body: {
      token: input.token,
      platform: input.platform,
      ...(input.device_id ? { device_id: input.device_id } : {}),
    },
  });
}

export async function unregisterPushTokenBackend(token: string): Promise<ApiResult<{ removed: boolean }>> {
  return fetchJson(`/api/notifications/push-token?token=${encodeURIComponent(token)}`, {
    method: "DELETE",
  });
}

export type ReferralInfo = { code: string; shareUrl: string; uses?: number };

export async function getReferralInfoBackend(): Promise<ApiResult<ReferralInfo>> {
  return fetchJson("/api/users/referral");
}

export async function applyReferralCodeBackend(code: string): Promise<ApiResult<{ applied: boolean }>> {
  return fetchJson("/api/users/referral/apply", { method: "POST", body: { code } });
}

export type NotificationPrefs = Record<string, boolean>;

/** Maps the app's `orders_email` keys to the backend's `email_orders` keys. */
function toBackendPrefs(prefs: NotificationPrefs): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  const map: Record<string, string> = {
    orders_email: "email_orders",
    orders_sms: "sms_orders",
    orders_push: "push_orders",
    marketing_email: "email_marketing",
    marketing_sms: "sms_marketing",
    marketing_push: "push_marketing",
    social_email: "email_reviews",
    social_push: "push_reviews",
    security_email: "email_marketing",
    security_sms: "sms_marketing",
    security_push: "push_marketing",
  };
  for (const [k, v] of Object.entries(prefs)) {
    const target = map[k] ?? k;
    if (typeof v === "boolean") out[target] = v;
  }
  return out;
}

function fromBackendPrefs(prefs: Record<string, boolean>): NotificationPrefs {
  const out: NotificationPrefs = {};
  const map: Record<string, string> = {
    email_orders: "orders_email",
    sms_orders: "orders_sms",
    push_orders: "orders_push",
    email_marketing: "marketing_email",
    sms_marketing: "marketing_sms",
    push_marketing: "marketing_push",
    email_reviews: "social_email",
    push_reviews: "social_push",
  };
  for (const [k, v] of Object.entries(prefs)) {
    const target = map[k] ?? k;
    if (typeof v === "boolean") out[target] = v;
  }
  return out;
}

export async function getNotificationPrefsBackend(): Promise<ApiResult<{ prefs: NotificationPrefs }>> {
  const res = await fetchJson<{ preferences: Record<string, boolean> }>("/api/users/notification-preferences");
  if (!res.ok) return res;
  return { ok: true, data: { prefs: fromBackendPrefs(res.data.preferences ?? {}) } };
}

export async function saveNotificationPrefsBackend(prefs: NotificationPrefs): Promise<ApiResult<{ prefs: NotificationPrefs }>> {
  const res = await fetchJson<{ preferences: Record<string, boolean> }>("/api/users/notification-preferences", {
    method: "PUT",
    body: toBackendPrefs(prefs),
  });
  if (!res.ok) return res;
  return { ok: true, data: { prefs: fromBackendPrefs(res.data.preferences ?? {}) } };
}

// =========================================================================
// ORDERS, TRACKING, RETURNS, REVIEWS, QUESTIONS, COUPONS
// =========================================================================

export type Order = {
  id: string;
  order_number?: string;
  status: string;
  payment_status?: string | null;
  payment_method?: string | null;
  total: number;
  subtotal?: number;
  discount?: number;
  shipping_fee?: number;
  tax?: number;
  currency: string;
  created_at: string;
  items?: Array<{ id: string; product_id: string; variant_id?: string | null; product_name: string; variant_label?: string | null; sku?: string | null; quantity: number; unit_price: number; image_url?: string | null; product?: { id: string; name: string; slug?: string; images?: Array<{ url: string; is_primary?: boolean }> } }>;
  address?: Address | null;
  store_id?: string;
  group_id?: string;
  store?: { id: string; name: string; slug?: string };
  tracking?: unknown[];
};

export async function listOrdersBackend(limit = 20): Promise<ApiResult<{ orders: Order[] }>> {
  return fetchJson("/api/orders", { query: { limit } });
}

export async function getOrderByIdBackend(id: string): Promise<ApiResult<{ order: Order }>> {
  return fetchJson(`/api/orders/${id}`);
}

export async function placeOrderGroupBackend(input: {
  cart_groups: Array<{ store_id: string; items: Array<{ variant_id: string; quantity: number }> }>;
  address_id: string;
  payment_method: string;
  coupon_code?: string | null;
  currency?: string;
}): Promise<ApiResult<{ orders?: Order[]; results?: Order[]; group_id?: string }>> {
  return fetchJson("/api/orders/group", {
    method: "POST",
    body: {
      cart_groups: input.cart_groups,
      address_id: input.address_id,
      payment_method: input.payment_method,
      currency: input.currency ?? "LKR",
      ...(input.coupon_code ? { coupon_code: input.coupon_code } : {}),
    },
    headers: { "Idempotency-Key": `place-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` },
  });
}

export async function syncCartReservationsBackend(
  items: Array<{ variant_id: string; store_id: string; quantity: number }>,
  ttlMinutes = 15,
): Promise<ApiResult<{ synced: number; expires_at: string | null }>> {
  return fetchJson("/api/orders/reservations/sync", {
    method: "POST",
    body: { items, ttl_minutes: ttlMinutes },
  });
}

export async function releaseCartReservationsBackend(): Promise<ApiResult<{ released: boolean }>> {
  return fetchJson("/api/orders/reservations/release", { method: "POST" });
}

export async function abandonOrderGroupBackend(
  groupId: string,
): Promise<ApiResult<{ cancelled: number; noop: number }>> {
  return fetchJson(`/api/orders/group/${groupId}/abandon`, { method: "POST" });
}

export async function cancelOrderGroupBackend(
  groupId: string,
  reason?: string,
): Promise<ApiResult<{ cancelled: number; refunded: number; noop: number }>> {
  return fetchJson(`/api/orders/group/${groupId}/cancel`, {
    method: "POST",
    body: reason ? { reason } : {},
  });
}

export type TrackingEvent = { id?: string; status: string; description?: string; location?: string | null; occurred_at: string };

export type OrderTracking = { order: Order; events: TrackingEvent[]; rider?: { id: string; full_name?: string; phone?: string } | null };

export async function getOrderTrackingBackend(id: string): Promise<ApiResult<OrderTracking>> {
  return fetchJson(`/api/orders/${id}/tracking`);
}

export async function cancelOrderBackend(id: string, reason?: string): Promise<ApiResult<{ order: Order }>> {
  return fetchJson(`/api/orders/${id}/cancel`, {
    method: "POST",
    body: reason ? { reason } : undefined,
    headers: { "Idempotency-Key": `cancel-${id}-${Date.now()}` },
  });
}

export async function cancelOrderItemsBackend(_orderId: string, itemIds: string[]): Promise<ApiResult<{ order: Order }>> {
  return fetchJson(`/api/orders/items/cancel`, { method: "POST", body: { item_ids: itemIds } });
}

export type ReturnRequest = {
  id: string;
  order_id?: string;
  order_item_id?: string;
  status: string;
  reason: string;
  created_at: string;
  refund_amount?: number;
  items?: Array<{ id: string; order_item_id: string; reason: string; quantity: number; condition?: string }>;
  order?: { id: string; order_number?: string };
};

export async function listReturnsBackend(): Promise<ApiResult<{ returns: ReturnRequest[] }>> {
  return fetchJson("/api/returns");
}

export async function getReturnByGroupIdBackend(groupId: string): Promise<ApiResult<{ returns: ReturnRequest[] }>> {
  return fetchJson(`/api/returns/group/${groupId}`);
}

export async function createReturnRequestBackend(input: {
  order_id: string;
  items: Array<{ order_item_id: string; reason: string; quantity: number; condition?: string; description?: string }>;
  pickup_address_id?: string;
  notes?: string;
}): Promise<ApiResult<{ returns: ReturnRequest[] }>> {
  return fetchJson("/api/returns", { method: "POST", body: input });
}

export async function cancelReturnBackend(id: string): Promise<ApiResult<{ cancelled: boolean }>> {
  return fetchJson(`/api/returns/${id}/cancel`, { method: "POST" });
}

export type Review = {
  id: string;
  product_id: string;
  user_id?: string;
  rating: number;
  comment?: string;
  created_at: string;
  helpful_count?: number;
  verified_purchase?: boolean;
  user?: { id: string; full_name?: string; avatar_url?: string };
  product?: { id: string; name: string; slug: string; images?: Array<{ url: string; is_primary?: boolean }> };
};

export async function listReviewsBackend(productId: string, limit = 20): Promise<ApiResult<{ reviews: Review[]; avg_rating?: number; total?: number }>> {
  return fetchJson(`/api/products/${productId}/reviews`, { query: { limit } });
}

export async function listMyReviewsBackend(): Promise<ApiResult<{ reviews: Review[] }>> {
  return fetchJson("/api/account/reviews");
}

export async function addReviewBackend(input: {
  product_id: string;
  order_item_id?: string | null;
  rating: number;
  title?: string;
  content: string;
  photos?: string[];
}): Promise<ApiResult<{ review: Review }>> {
  return fetchJson("/api/reviews", {
    method: "POST",
    body: {
      product_id: input.product_id,
      order_item_id: input.order_item_id ?? null,
      rating: input.rating,
      title: input.title,
      content: input.content,
      photos: input.photos ?? [],
    },
  });
}

export async function deleteReviewBackend(id: string): Promise<ApiResult<{ deleted: boolean }>> {
  return fetchJson(`/api/reviews/${id}`, { method: "DELETE" });
}

export async function voteReviewHelpfulBackend(id: string): Promise<ApiResult<{ helpful_count: number }>> {
  return fetchJson(`/api/reviews/${id}/vote`, { method: "POST", body: { helpful: true } });
}

export async function getEligibleReviewOrdersBackend(productId: string): Promise<ApiResult<{ orders: Array<{ id: string; order_number?: string; delivered_at?: string }> }>> {
  return fetchJson(`/api/reviews/eligible`, { query: { productId } });
}

export type Question = { id: string; product_id: string; question: string; answer?: string | null; answered_at?: string | null; created_at: string; user?: { id: string; full_name?: string } };

export async function listQuestionsBackend(productId: string): Promise<ApiResult<{ questions: Question[] }>> {
  return fetchJson(`/api/qa`, { query: { productId } });
}

export async function addQuestionBackend(productId: string, question: string): Promise<ApiResult<{ question: Question }>> {
  return fetchJson(`/api/qa`, { method: "POST", body: { product_id: productId, question } });
}

export async function answerQuestionBackend(questionId: string, answer: string): Promise<ApiResult<{ question: Question }>> {
  return fetchJson(`/api/questions/${questionId}/answer`, { method: "POST", body: { answer } });
}

export type Coupon = {
  id: string;
  code: string;
  discount_type: "percent" | "fixed" | "free_shipping";
  discount_value: number;
  scope: "brand" | "store" | "category" | "global";
  scope_id?: string | null;
  expires_at?: string | null;
  is_active: boolean;
  min_order_amount?: number;
  max_uses?: number | null;
  used_count?: number;
};

export async function listCouponsBackend(): Promise<ApiResult<{ coupons: Coupon[] }>> {
  return fetchJson("/api/coupons");
}

export async function createCouponBackend(input: Omit<Coupon, "id" | "used_count">): Promise<ApiResult<{ coupon: Coupon }>> {
  return fetchJson("/api/coupons", { method: "POST", body: input });
}

export type CouponValidation = { valid: boolean; discount: number; freeShipping?: boolean; couponId?: string; reason?: string };

export async function validateCouponBackend(code: string, subtotal: number, items: Array<{ product_id: string; store_id: string; quantity: number; unit_price: number }>): Promise<ApiResult<CouponValidation>> {
  return fetchJson("/api/coupons/validate", { method: "POST", body: { code, subtotal, items } });
}

// =========================================================================
// SELLER (store_owner)
// =========================================================================

export async function getSellerStoreBackend(): Promise<ApiResult<{ store: Store }>> {
  return fetchJson("/api/seller/store");
}

export async function createSellerStoreBackend(input: {
  name: string;
  slug?: string;
  description?: string;
}): Promise<ApiResult<{ store: Store }>> {
  return fetchJson("/api/seller/store", { method: "POST", body: input });
}

export async function updateSellerStoreBackend(patch: Partial<Store>): Promise<ApiResult<{ store: Store }>> {
  return fetchJson("/api/seller/store", { method: "PATCH", body: patch });
}

export async function setProductActiveBackend(
  id: string,
  isActive: boolean,
): Promise<ApiResult<{ product: CatalogProduct }>> {
  return fetchJson(`/api/seller/products/${id}/active`, {
    method: "PATCH",
    body: { is_active: isActive },
  });
}

export async function addProductImageBackend(
  productId: string,
  input: { url: string; position?: number; is_primary?: boolean; media_type?: string },
): Promise<ApiResult<{ image: Record<string, unknown> }>> {
  return fetchJson(`/api/seller/products/${productId}/images`, {
    method: "POST",
    body: {
      url: input.url,
      position: input.position ?? 0,
      is_primary: input.is_primary ?? false,
      media_type: input.media_type ?? "image",
    },
  });
}

export async function getSellerProductsBackend(opts: { limit?: number; offset?: number; status?: string; search?: string; sort?: string } = {}): Promise<ApiResult<{ products: CatalogProduct[]; total?: number; stats?: Record<string, number> }>> {
  return fetchJson("/api/seller/products", { query: { ...opts } });
}

export async function getSellerProductByIdBackend(id: string): Promise<ApiResult<{ product: CatalogProduct }>> {
  return fetchJson(`/api/seller/products/${id}`);
}

export type ModerationReasonLite = { rule_id: string; message: string; weight: number; blocking: boolean };

export type SellerModerationBlock = {
  auto_approved: boolean;
  score: number;
  threshold: number;
  flagged: boolean;
  reasons: ModerationReasonLite[];
} | null;

export async function createSellerProductBackend(input: Partial<CatalogProduct> & { name: string; price: number }): Promise<ApiResult<{ product: CatalogProduct; moderation: SellerModerationBlock }>> {
  return fetchJson("/api/seller/products", { method: "POST", body: input });
}

export async function updateSellerProductBackend(id: string, patch: Partial<CatalogProduct>): Promise<ApiResult<{ product: CatalogProduct; moderation: SellerModerationBlock }>> {
  return fetchJson(`/api/seller/products/${id}`, { method: "PATCH", body: patch });
}

export async function deleteSellerProductBackend(id: string): Promise<ApiResult<{ deleted: boolean }>> {
  return fetchJson(`/api/seller/products/${id}`, { method: "DELETE" });
}

export async function getSellerOrdersBackend(opts: { limit?: number; offset?: number; status?: string } = {}): Promise<ApiResult<{ orders: Order[]; total?: number }>> {
  return fetchJson("/api/seller/orders", { query: { ...opts } });
}

export async function transitionOrderBackend(orderId: string, toStatus: string, note?: string): Promise<ApiResult<{ order: Order }>> {
  return fetchJson(`/api/orders/${orderId}/transition`, { method: "POST", body: { status: toStatus, note } });
}

export async function getSellerInventoryBackend(): Promise<ApiResult<{ inventory: Array<{ variant_id: string; sku: string; size?: string; color?: string; price: number; product: { id: string; name: string; status: string }; inventory: { quantity: number; reserved: number } }> }>> {
  return fetchJson("/api/seller/inventory");
}

export async function updateVariantStockBackend(variantId: string, quantity: number): Promise<ApiResult<{ inventory: { variant_id: string; quantity: number } }>> {
  return fetchJson(`/api/seller/products/_/inventory`, { method: "PATCH", body: { variant_id: variantId, quantity } });
}

export async function getSellerReturnsBackend(): Promise<ApiResult<{ returns: Array<ReturnRequest & { order?: Order; items?: unknown[] }> }>> {
  return fetchJson("/api/seller/returns");
}

export async function decideSellerReturnBackend(returnId: string, action: "approve" | "reject" | "receive" | "refund", note?: string): Promise<ApiResult<{ return: ReturnRequest }>> {
  return fetchJson(`/api/seller/returns/${returnId}/decide`, { method: "POST", body: { action, note } });
}

export type SellerKPIs = { revenue: number; orders: number; aov: number; pending: number; returns: number; topProducts?: Array<{ id: string; name: string; revenue: number }> };

export async function getSellerKPIsBackend(): Promise<ApiResult<SellerKPIs>> {
  return fetchJson("/api/seller/analytics/summary");
}

export async function getSellerAnalyticsBackend(range: "7d" | "30d" | "90d" = "30d"): Promise<ApiResult<{ series: unknown[]; totals: Record<string, number> }>> {
  return fetchJson("/api/seller/analytics", { query: { range } });
}

export async function getSellerPayoutsBackend(): Promise<ApiResult<{ payouts: Array<{ id: string; amount: number; currency: string; status: string; created_at: string; paid_at?: string | null }> }>> {
  return fetchJson("/api/seller/payouts");
}

export async function getSellerPayoutSettingsBackend(): Promise<ApiResult<{ settings: Record<string, unknown> }>> {
  return fetchJson("/api/seller/payouts/settings");
}

export async function upsertSellerPayoutSettingsBackend(settings: Record<string, unknown>): Promise<ApiResult<{ settings: Record<string, unknown> }>> {
  return fetchJson("/api/seller/payouts/settings", { method: "PUT", body: settings });
}

export async function getSellerComplianceDocsBackend(): Promise<ApiResult<{ documents: unknown[] }>> {
  return fetchJson("/api/seller/compliance");
}

export async function upsertSellerComplianceDocBackend(doc: Record<string, unknown>): Promise<ApiResult<{ document: unknown }>> {
  return fetchJson("/api/seller/compliance", { method: "PUT", body: doc });
}

export async function getStoreCouponsBackend(): Promise<ApiResult<{ coupons: Coupon[] }>> {
  return fetchJson("/api/seller/coupons");
}

export async function createStoreCouponBackend(coupon: Omit<Coupon, "id" | "used_count">): Promise<ApiResult<{ coupon: Coupon }>> {
  return fetchJson("/api/seller/coupons", { method: "POST", body: coupon });
}

export async function getStoreReviewsBackend(storeId: string, opts: { limit?: number; offset?: number; status?: string } = {}): Promise<ApiResult<{ reviews: Review[]; avg_rating?: number; total?: number }>> {
  return fetchJson(`/api/seller/reviews`, { query: { store_id: storeId, ...opts } });
}

// =========================================================================
// BRAND OWNER
// =========================================================================

export async function getBrandByOwnerBackend(): Promise<ApiResult<{ brand: Brand }>> {
  return fetchJson("/api/brand/profile");
}

export async function updateBrandBackend(patch: Partial<Brand>): Promise<ApiResult<{ brand: Brand }>> {
  return fetchJson("/api/brand/profile", { method: "PATCH", body: patch });
}

export async function getBrandProductsBackend(opts: { limit?: number; offset?: number; status?: string; search?: string } = {}): Promise<ApiResult<{ products: CatalogProduct[] }>> {
  return fetchJson("/api/brand/products", { query: { ...opts } });
}

export async function getBrandOrdersBackend(opts: { limit?: number; offset?: number; status?: string } = {}): Promise<ApiResult<{ orders: Order[] }>> {
  return fetchJson("/api/brand/orders", { query: { ...opts } });
}

export type BrandKPIs = { revenue: number; orders: number; aov?: number; topProducts?: Array<{ id: string; name: string; revenue: number }> };

export async function getBrandKPIsBackend(): Promise<ApiResult<BrandKPIs>> {
  return fetchJson("/api/brand/analytics/summary");
}

// =========================================================================
// ADMIN
// =========================================================================

export async function getAdminStatsBackend(): Promise<ApiResult<{ users: number; stores: number; brands: number; products: number; orders: number }>> {
  return fetchJson("/api/admin/stats");
}

export async function getAdminUsersBackend(opts: { limit?: number; offset?: number; search?: string; role?: string } = {}): Promise<ApiResult<{ users: UserProfile[]; total: number }>> {
  return fetchJson("/api/admin/users", { query: { ...opts } });
}

export async function updateUserRoleBackend(userId: string, role: string): Promise<ApiResult<{ user: UserProfile }>> {
  return fetchJson(`/api/admin/users/${userId}/role`, { method: "PATCH", body: { role } });
}

export async function getAdminStoresBackend(opts: { limit?: number; offset?: number; status?: string } = {}): Promise<ApiResult<{ stores: Store[]; total: number }>> {
  return fetchJson("/api/admin/stores", { query: { ...opts } });
}

export async function approveStoreBackend(id: string, status: "approved" | "rejected" | "suspended"): Promise<ApiResult<{ store: Store }>> {
  return fetchJson(`/api/admin/stores/${id}/approve`, { method: "PATCH", body: { status } });
}

export async function getAdminStoreDetailBackend(id: string): Promise<ApiResult<{ store: Store; owner: UserProfile; products: CatalogProduct[] }>> {
  return fetchJson(`/api/admin/stores/${id}`);
}

export async function getAdminOrdersBackend(opts: { limit?: number; offset?: number; status?: string } = {}): Promise<ApiResult<{ orders: Order[]; total: number }>> {
  return fetchJson("/api/admin/orders", { query: { ...opts } });
}

export async function getAdminProductsBackend(opts: { limit?: number; offset?: number; status?: string } = {}): Promise<ApiResult<{ products: CatalogProduct[]; total: number }>> {
  return fetchJson("/api/admin/products", { query: { ...opts } });
}

export async function getAdminBrandsBackend(opts: { limit?: number; offset?: number; status?: string } = {}): Promise<ApiResult<{ brands: Brand[]; total: number }>> {
  return fetchJson("/api/admin/brands", { query: { ...opts } });
}

export async function getAdminBrandByIdBackend(id: string): Promise<ApiResult<{ brand: Brand & { products?: Array<{ id: string; name: string; status: string; total_sales: number }> } }>> {
  return fetchJson(`/api/admin/brands/${id}`);
}

export async function approveBrandBackend(id: string, status: "approved" | "rejected"): Promise<ApiResult<{ brand: Brand }>> {
  return fetchJson(`/api/admin/brands/${id}/approve`, { method: "PATCH", body: { status } });
}

export async function reviewComplianceDocumentBackend(
  id: string,
  status: "approved" | "rejected" | "needs_more_info",
  opts: { reviewNotes?: string; rejectionReason?: string } = {},
): Promise<ApiResult<{ document: { id: string; status: string; reviewed_at: string; review_notes?: string; rejection_reason?: string } }>> {
  return fetchJson(`/api/admin/compliance-document/${id}`, {
    method: "PATCH",
    body: {
      status,
      ...(opts.reviewNotes ? { review_notes: opts.reviewNotes } : {}),
      ...(opts.rejectionReason ? { rejection_reason: opts.rejectionReason } : {}),
    },
  });
}

export async function getAdminDeliveryCompaniesBackend(opts: { status?: string; search?: string } = {}): Promise<ApiResult<{ companies: Array<Record<string, unknown>> }>> {
  return fetchJson("/api/admin/delivery-companies", { query: { ...opts } });
}

export async function approveProductBackend(id: string, status: "active" | "rejected" | "archived"): Promise<ApiResult<{ product: CatalogProduct }>> {
  return fetchJson(`/api/admin/products/${id}/approve`, { method: "PATCH", body: { status } });
}

export async function setProductFeaturedBackend(id: string, isFeatured: boolean): Promise<ApiResult<{ product: CatalogProduct }>> {
  return fetchJson(`/api/admin/products/${id}/feature`, { method: "PATCH", body: { is_featured: isFeatured } });
}

export async function getAdminBannersBackend(): Promise<ApiResult<{ banners: Banner[] }>> {
  return fetchJson("/api/admin/banners");
}

export async function createBannerBackend(b: Partial<Banner>): Promise<ApiResult<{ banner: Banner }>> {
  return fetchJson("/api/admin/banners", { method: "POST", body: b });
}

export async function updateBannerBackend(id: string, patch: Partial<Banner>): Promise<ApiResult<{ banner: Banner }>> {
  return fetchJson(`/api/admin/banners/${id}`, { method: "PATCH", body: patch });
}

export async function deleteBannerBackend(id: string): Promise<ApiResult<{ deleted: boolean }>> {
  return fetchJson(`/api/admin/banners/${id}`, { method: "DELETE" });
}

export async function getAdminCouponsBackend(): Promise<ApiResult<{ coupons: Coupon[] }>> {
  return fetchJson("/api/admin/coupons");
}

export async function createCouponAdminBackend(c: Omit<Coupon, "id" | "used_count">): Promise<ApiResult<{ coupon: Coupon }>> {
  return fetchJson("/api/admin/coupons", { method: "POST", body: c });
}

export async function toggleCouponBackend(id: string, isActive: boolean): Promise<ApiResult<{ coupon: Coupon }>> {
  return fetchJson(`/api/admin/coupons/${id}/toggle`, { method: "PATCH", body: { is_active: isActive } });
}

export async function getAdminCampaignsBackend(): Promise<ApiResult<{ campaigns: unknown[] }>> {
  return fetchJson("/api/admin/campaigns");
}

export async function toggleCampaignBackend(id: string, isActive: boolean): Promise<ApiResult<{ campaign: unknown }>> {
  return fetchJson(`/api/admin/campaigns/${id}/toggle`, { method: "PATCH", body: { is_active: isActive } });
}

export async function getAdminBroadcastsBackend(): Promise<ApiResult<{ broadcasts: unknown[] }>> {
  return fetchJson("/api/admin/notifications/broadcasts");
}

export async function sendBroadcastBackend(b: Record<string, unknown>): Promise<ApiResult<{ broadcast: unknown }>> {
  return fetchJson("/api/admin/notifications/broadcasts", { method: "POST", body: b });
}

export async function getAdminAuditLogBackend(limit = 50): Promise<ApiResult<{ entries: unknown[] }>> {
  return fetchJson("/api/admin/audit", { query: { limit } });
}

export async function getAdminBlogPostsBackend(): Promise<ApiResult<{ posts: Array<BlogPost & { status: string }> }>> {
  return fetchJson("/api/admin/blog");
}

export async function createBlogPostBackend(p: Partial<BlogPost>): Promise<ApiResult<{ post: BlogPost }>> {
  return fetchJson("/api/admin/blog", { method: "POST", body: p });
}

export async function toggleBlogPostBackend(id: string, status: "draft" | "published"): Promise<ApiResult<{ post: BlogPost }>> {
  return fetchJson(`/api/admin/blog/${id}/status`, { method: "PATCH", body: { status } });
}

export async function getAdminReviewsBackend(status = "pending"): Promise<ApiResult<{ reviews: Review[] }>> {
  return fetchJson("/api/admin/reviews", { query: { status } });
}

export async function moderateReviewBackend(id: string, status: "approved" | "rejected"): Promise<ApiResult<{ review: Review }>> {
  return fetchJson(`/api/admin/reviews/${id}/moderate`, { method: "PATCH", body: { status } });
}

export async function getAdminQABackend(status = "pending"): Promise<ApiResult<{ questions: Question[] }>> {
  return fetchJson("/api/admin/qa", { query: { status } });
}

export async function getAdminCommissionsBackend(): Promise<ApiResult<{ tiers: unknown[] }>> {
  return fetchJson("/api/admin/commissions");
}

export async function updateCommissionTierBackend(id: string, patch: Record<string, unknown>): Promise<ApiResult<{ tier: unknown }>> {
  return fetchJson(`/api/admin/commissions/${id}`, { method: "PATCH", body: patch });
}

export async function getAdminGiftCardsBackend(qs?: { search?: string; active?: "true" | "false"; limit?: number; offset?: number }): Promise<ApiResult<{ cards: unknown[]; total: number; limit: number; offset: number }>> {
  return fetchJson("/api/admin/gift-cards", { query: qs as Record<string, string | number> | undefined });
}

export async function createGiftCardBackend(g: Record<string, unknown>): Promise<ApiResult<{ card: unknown }>> {
  return fetchJson("/api/admin/gift-cards", { method: "POST", body: g });
}

export async function adjustAdminGiftCardBackend(id: string, patch: { delta: number; note?: string }): Promise<ApiResult<{ card: unknown }>> {
  return fetchJson(`/api/admin/gift-cards/${id}`, { method: "PATCH", body: patch });
}

export async function voidAdminGiftCardBackend(id: string, body: { reason?: string }): Promise<ApiResult<{ card: unknown }>> {
  return fetchJson(`/api/admin/gift-cards/${id}/void`, { method: "POST", body });
}

export async function getAdminGiftCardTransactionsBackend(id: string): Promise<ApiResult<{ transactions: unknown[] }>> {
  return fetchJson(`/api/admin/gift-cards/${id}/transactions`);
}

export async function getAdminAbandonedCartsBackend(qs?: { since?: string; limit?: number }): Promise<ApiResult<{ waves: unknown[] }>> {
  return fetchJson("/api/admin/abandoned-carts", { query: qs as Record<string, string | number> | undefined });
}

export async function getAdminAbandonedCartsStatsBackend(qs?: { since?: string }): Promise<ApiResult<{ since: string; carts_notified: number; total_notified: number; by_wave: Record<number, number>; carts_with_activity: number; total_carts: number }>> {
  return fetchJson("/api/admin/abandoned-carts/stats", { query: qs as Record<string, string> | undefined });
}

export async function getAdminPriceAlertsBackend(qs?: { since?: string; limit?: number }): Promise<ApiResult<{ alerts: unknown[] }>> {
  return fetchJson("/api/admin/price-alerts", { query: qs as Record<string, string | number> | undefined });
}

export async function getAdminPriceAlertsStatsBackend(qs?: { since?: string }): Promise<ApiResult<{ since: string; active_alerts: number; cancelled_alerts: number; notifications_in_window: number; avg_notification_price: number }>> {
  return fetchJson("/api/admin/price-alerts/stats", { query: qs as Record<string, string> | undefined });
}

export async function getAdminHomepageSectionsBackend(): Promise<ApiResult<{ sections: Array<unknown> }>> {
  return fetchJson("/api/admin/homepage/sections");
}

export async function toggleHomepageSectionBackend(id: string, enabled: boolean): Promise<ApiResult<{ section: unknown }>> {
  return fetchJson(`/api/admin/homepage/sections/${id}/toggle`, { method: "PATCH", body: { enabled } });
}

export async function submitContactSubmissionBackend(input: Record<string, unknown>): Promise<ApiResult<{ submission: unknown }>> {
  return fetchJson("/api/contact", { method: "POST", body: input });
}

export async function getAdminContactSubmissionsBackend(): Promise<ApiResult<{ submissions: unknown[] }>> {
  return fetchJson("/api/admin/contact");
}

export async function getAdminLowStockBackend(limit = 10): Promise<ApiResult<{ items: Array<{ variant_id: string; sku: string; product_name: string; quantity: number; threshold: number }> }>> {
  return fetchJson("/api/admin/low-stock", { query: { limit } });
}

export async function getAdminPlatformSettingsBackend(): Promise<ApiResult<{ settings: Record<string, unknown> }>> {
  return fetchJson("/api/admin/settings");
}

export async function setAdminPlatformSettingBackend(key: string, value: unknown): Promise<ApiResult<{ key: string; value: unknown }>> {
  return fetchJson(`/api/admin/settings/${key}`, { method: "PUT", body: { value } });
}

export async function getAdminOverviewStatsBackend(): Promise<ApiResult<Record<string, unknown>>> {
  return fetchJson("/api/admin/overview");
}

export async function getAdminRecentSignupsBackend(limit = 8): Promise<ApiResult<{ users: UserProfile[] }>> {
  return fetchJson("/api/admin/recent-signups", { query: { limit } });
}

export async function getAdminRecentOrdersBackend(limit = 6): Promise<ApiResult<{ orders: Order[] }>> {
  return fetchJson("/api/admin/recent-orders", { query: { limit } });
}

export async function getAdminPendingApprovalsBackend(): Promise<ApiResult<{ stores: Store[]; brands: Brand[]; products: CatalogProduct[] }>> {
  return fetchJson("/api/admin/approvals/pending");
}

export async function getAdminCategoriesBackend(): Promise<ApiResult<{ categories: Category[] }>> {
  return fetchJson("/api/admin/categories");
}

export async function createAdminCategoryBackend(c: Partial<Category>): Promise<ApiResult<{ category: Category }>> {
  return fetchJson("/api/admin/categories", { method: "POST", body: c });
}

export async function updateAdminCategoryBackend(id: string, patch: Partial<Category>): Promise<ApiResult<{ category: Category }>> {
  return fetchJson(`/api/admin/categories/${id}`, { method: "PATCH", body: patch });
}

export async function deleteAdminCategoryBackend(id: string): Promise<ApiResult<{ deleted: boolean }>> {
  return fetchJson(`/api/admin/categories/${id}`, { method: "DELETE" });
}

// =========================================================================
// RECOMMENDER
// =========================================================================

export async function getCoPurchasesBackend(productId: string, limit = 10): Promise<ApiResult<{ results: Array<{ product_id: string; score: number; product?: CatalogProduct }> }>> {
  return fetchJson("/api/recommender/co-purchases", { query: { product_id: productId, limit } });
}

export async function getCoViewsBackend(productId: string, limit = 10): Promise<ApiResult<{ results: Array<{ co_product_id: string; view_count: number; last_viewed_at: string }> }>> {
  return fetchJson("/api/recommender/co-views", { query: { product_id: productId, limit } });
}

export async function getSimilarProductsBackend(productId: string, limit = 12): Promise<ApiResult<{ results: Array<{ product_id: string; score: number }> }>> {
  return fetchJson("/api/recommender/similar", { query: { product_id: productId, limit } });
}

export async function getColdStartBackend(limit = 12): Promise<ApiResult<{ products: CatalogProduct[] }>> {
  return fetchJson("/api/recommender/cold-start", { query: { limit } });
}

export async function getCandidatesBackend(opts: { limit?: number; category_id?: string; brand_id?: string; gender?: string; exclude_ids?: string[]; cursor?: string } = {}): Promise<ApiResult<{ categories: Array<{ category_id: string; score: number }>; products: Array<{ id: string; name: string; slug: string; price: number; mrp?: number; currency?: string; images?: Array<{ url: string; is_primary?: boolean }>; category_id: string }>; nextCursor?: string | null }>> {
  const { limit = 24, category_id, brand_id, gender, exclude_ids, cursor } = opts;
  return fetchJson("/api/recommender/candidates", {
    query: {
      limit,
      ...(category_id ? { category_id } : {}),
      ...(brand_id ? { brand_id } : {}),
      ...(gender ? { gender } : {}),
      ...(exclude_ids?.length ? { exclude_ids: exclude_ids.join(",") } : {}),
      ...(cursor ? { cursor } : {}),
    },
  });
}

export async function appendEventsBackend(events: Array<{ type: string; product_id?: string; category_id?: string; metadata?: Record<string, unknown>; occurred_at?: string }>): Promise<ApiResult<{ appended: number }>> {
  return fetchJson("/api/recommender/events", { method: "POST", body: { events } });
}

export async function fetchRecentEventsBackend(limit = 50): Promise<ApiResult<{ events: unknown[] }>> {
  return fetchJson("/api/recommender/events", { query: { limit } });
}

export async function clearEventsBackend(): Promise<ApiResult<{ cleared: boolean }>> {
  return fetchJson("/api/recommender/events", { method: "DELETE" });
}

export async function getUserTopCategoriesBackend(limit = 5): Promise<ApiResult<{ categories: Array<{ category_id: string; score: number; category?: Category }> }>> {
  return fetchJson("/api/recommender/top-categories", { query: { limit } });
}

// =========================================================================
// PAYMENTS
// =========================================================================

export type PaymentStatus = {
  status: string;
  payment_status: string | null;
  payment_method: string | null;
  currency: string;
  total: number;
  gateway: string | null;
  last_event_at: string | null;
};

export async function getPaymentStatusBackend(orderId: string): Promise<ApiResult<PaymentStatus>> {
  return fetchJson(`/api/payments/orders/${orderId}/status`);
}

// =========================================================================
// GIFT CARDS
// =========================================================================

export async function redeemGiftCardBackend(code: string): Promise<ApiResult<{ balance: number; card: { code: string; balance: number } }>> {
  return fetchJson("/api/gift-cards/redeem", { method: "POST", body: { code } });
}

export async function getGiftCardBalanceBackend(code: string): Promise<ApiResult<{ balance: number }>> {
  return fetchJson("/api/gift-cards/balance", { query: { code } });
}

export async function getMyGiftCardsBackend(): Promise<ApiResult<{ cards: unknown[] }>> {
  return fetchJson("/api/gift-cards/mine");
}

export async function getMyGiftCardBalanceBackend(): Promise<ApiResult<{ cards: unknown[]; totalBalanceByCurrency: Record<string, number> }>> {
  return fetchJson("/api/gift-cards/balance");
}

export async function checkGiftCardByCodeBackend(code: string): Promise<ApiResult<{ valid: boolean; card: { code: string; current_balance: number; currency: string; recipient_name: string | null; message: string | null; expires_at: string | null } | null; reason: string | null }>> {
  return fetchJson("/api/gift-cards/balance-by-code", { query: { code } });
}

export async function validateGiftCardRedemptionBackend(input: { code: string; order_currency?: string }): Promise<ApiResult<{ valid: boolean; reason?: string; card_currency?: string; current_balance?: number }>> {
  return fetchJson("/api/gift-cards/redeem/validate", { method: "POST", body: input });
}

export async function purchaseGiftCardBackend(input: { amount: number; currency?: string; recipient_email?: string; recipient_name?: string; message?: string; scheduled_for?: string; expires_in_days?: number }): Promise<ApiResult<{ card: unknown }>> {
  return fetchJson("/api/gift-cards/purchase", { method: "POST", body: input });
}

// Price-drop alerts — buyer-side
export async function listPriceAlertsBackend(): Promise<ApiResult<{ alerts: unknown[] }>> {
  return fetchJson("/api/users/price-alerts");
}

export async function getPriceAlertStatusBackend(productId: string, variantId?: string): Promise<ApiResult<{ subscribed: boolean; alert: unknown }>> {
  void variantId;
  return fetchJson(`/api/users/price-alerts/${productId}/status`);
}

export async function subscribePriceAlertBackend(input: { product_id: string; variant_id?: string | null; threshold_price?: number | null }): Promise<ApiResult<{ alert: unknown }>> {
  return fetchJson("/api/users/price-alerts", { method: "POST", body: input });
}

export async function updatePriceAlertBackend(id: string, patch: { threshold_price?: number | null; is_active?: boolean }): Promise<ApiResult<{ alert: unknown }>> {
  return fetchJson(`/api/users/price-alerts/${id}`, { method: "PATCH", body: patch });
}

export async function unsubscribePriceAlertBackend(id: string): Promise<ApiResult<{ cancelled: boolean }>> {
  return fetchJson(`/api/users/price-alerts/${id}`, { method: "DELETE" });
}

// =========================================================================
// PERSONALISED HOME FEED (0169)
// =========================================================================

export type HomeFeedSectionKey = "recents" | "top_categories" | "followed_brands" | "trending_for_you";

export type HomeFeedProduct = {
  id: string;
  name: string;
  slug: string;
  price: number | null;
  mrp?: number | null;
  currency?: string | null;
  rating?: number | null;
  total_sales?: number | null;
  image_url?: string | null;
  category_id?: string | null;
  brand_id?: string | null;
  brand_name?: string | null;
};

export type HomeFeedResponse = {
  sections: Record<HomeFeedSectionKey, HomeFeedProduct[]>;
  segment: {
    categories: string[];
    gender: string | null;
    top_categories_weights: Array<{ category_id: string; weight: number }>;
  };
  generated_at: string;
  cross_section_unique?: number;
  cached?: boolean;
};

export async function getHomeFeedBackend(opts: { exclude?: string[] } = {}): Promise<ApiResult<HomeFeedResponse>> {
  const exclude = opts.exclude?.length ? `?exclude=${encodeURIComponent(opts.exclude.join(","))}` : "";
  return fetchJson(`/api/users/home-feed${exclude}`);
}

// =========================================================================
// SEARCH SUGGESTIONS
// =========================================================================

export type SearchSuggestion = { type: "product" | "brand" | "category" | "store"; id: string; label: string; slug?: string; image_url?: string | null };

export async function getSearchSuggestionsBackend(term: string): Promise<ApiResult<{ suggestions: SearchSuggestion[] }>> {
  return fetchJson("/api/catalog/search-suggestions", { query: { q: term } });
}

// =========================================================================
// AUTH — identity probes
// =========================================================================

export async function checkUniqueBackend(
  body: { email?: string; phone?: string },
  opts?: { requireAuth?: boolean },
): Promise<ApiResult<{ emailExists: boolean; phoneExists: boolean }>> {
  return fetchJson("/api/auth/check-unique", {
    method: "POST",
    requireAuth: opts?.requireAuth ?? false,
    body,
  });
}
