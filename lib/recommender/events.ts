/**
 * Recommendation event log.
 *
 * Stores per-user behavioral events (view, search, wishlist, cart, purchase)
 * in AsyncStorage. Each event carries a minimal product snapshot so the
 * ranker can score candidates even when the product is no longer available
 * or when the user is offline.
 *
 * Phase 1 (0260) extends the taxonomy from 8 → 19 types so the backend
 * ranker has the same signal on both web and mobile. New types:
 * product_impression, product_click, search_result_click, category_view,
 * collection_view, store_view, remove_from_cart, checkout_started,
 * product_share, filter_used, sort_used.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Product } from "@/lib/types";
import { enqueueRemoteEvent, clearRemoteEvents } from "./remote-events";

const guestId = "guest";

export type EventType =
  | "view"
  | "search"
  | "wishlist_add"
  | "wishlist_remove"
  | "cart_add"
  | "remove_from_cart"
  | "purchase"
  | "checkout_started"
  | "dismiss"
  | "not_interested"
  | "product_impression"
  | "product_click"
  | "search_result_click"
  | "category_view"
  | "collection_view"
  | "store_view"
  | "product_share"
  | "filter_used"
  | "sort_used";

export interface TrackedProduct {
  id: string;
  category_id?: string | null;
  brand_id?: string | null;
  store_id?: string | null;
  tags?: string[];
  material?: string | null;
  gender?: string | null;
  /** Price in major units. */
  price?: number;
  /** Variant colors (deduped). */
  colors?: string[];
  /** Garment type token (shirt, sneaker, …) — best-effort, from tags/name. */
  garment?: string | null;
}

export interface BaseEvent {
  /** Epoch ms. */
  t: number;
  type: EventType;
}

export interface ViewEvent extends BaseEvent {
  type: "view";
  product: TrackedProduct;
  /** Dwell time in ms. Capped at 120s. */
  dwellMs?: number;
  /** Optional surface tag (e.g. "scan:camera", "scan:library"). */
  surface?: string;
}

export interface SearchEvent extends BaseEvent {
  type: "search";
  query: string;
  /** Tokenized query words (≥2 chars). */
  tokens: string[];
  /** Result count. */
  resultCount: number;
  /** Optional surface tag (e.g. "suggestion" for typeahead picks). */
  surface?: string;
}

export interface WishlistEvent extends BaseEvent {
  type: "wishlist_add" | "wishlist_remove";
  product: TrackedProduct;
}

export interface CartEvent extends BaseEvent {
  type: "cart_add";
  product: TrackedProduct;
}

export interface RemoveFromCartEvent extends BaseEvent {
  type: "remove_from_cart";
  product: TrackedProduct;
}

export interface PurchaseEvent extends BaseEvent {
  type: "purchase";
  product: TrackedProduct;
  quantity: number;
}

export interface CheckoutStartedEvent extends BaseEvent {
  type: "checkout_started";
  cart_total?: number;
  item_count?: number;
}

export interface DismissEvent extends BaseEvent {
  type: "dismiss";
  product: TrackedProduct;
  /** Where the dismiss happened (for analytics). */
  surface?: string;
}

export interface NotInterestedEvent extends BaseEvent {
  type: "not_interested";
  product: TrackedProduct;
  surface?: string;
}

export interface ImpressionEvent extends BaseEvent {
  type: "product_impression";
  product: TrackedProduct;
  surface?: string;
  position?: number;
}

export interface ClickEvent extends BaseEvent {
  type: "product_click";
  product: TrackedProduct;
  surface?: string;
  position?: number;
}

export interface SearchResultClickEvent extends BaseEvent {
  type: "search_result_click";
  query: string;
  tokens?: string[];
  product: TrackedProduct;
  position?: number;
}

export interface CategoryViewEvent extends BaseEvent {
  type: "category_view";
  category_id: string;
}

export interface CollectionViewEvent extends BaseEvent {
  type: "collection_view";
  collection_id: string;
}

export interface StoreViewEvent extends BaseEvent {
  type: "store_view";
  store_id: string;
}

export interface ShareEvent extends BaseEvent {
  type: "product_share";
  product: TrackedProduct;
  channel?: string;
}

export interface FilterUsedEvent extends BaseEvent {
  type: "filter_used";
  filter_id: string;
  filter_value: string;
  surface?: string;
}

export interface SortUsedEvent extends BaseEvent {
  type: "sort_used";
  sort_key: string;
  surface?: string;
}

export type RecommendationEvent =
  | ViewEvent
  | SearchEvent
  | WishlistEvent
  | CartEvent
  | RemoveFromCartEvent
  | PurchaseEvent
  | CheckoutStartedEvent
  | DismissEvent
  | NotInterestedEvent
  | ImpressionEvent
  | ClickEvent
  | SearchResultClickEvent
  | CategoryViewEvent
  | CollectionViewEvent
  | StoreViewEvent
  | ShareEvent
  | FilterUsedEvent
  | SortUsedEvent;

const EVENTS_SUFFIX = "rec_events";
const MAX_EVENTS = 500; // hard cap to keep storage bounded
/** Drop events older than this on read — the ranker is a near-real-time
 *  signal, and stale entries just dilute the profile. */
const MAX_EVENT_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function storageKey(userId: string | null | undefined) {
  return `luxe:${userId ?? guestId}:${EVENTS_SUFFIX}`;
}

function isStale(event: RecommendationEvent): boolean {
  const ageMs = Date.now() - (event.t ?? 0);
  return ageMs > MAX_EVENT_AGE_MS;
}

/** Read the event log for a user, dropping events older than 7 days. */
export async function readEvents(userId: string | null | undefined): Promise<RecommendationEvent[]> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as RecommendationEvent[]).filter((e) => !isStale(e));
  } catch {
    return [];
  }
}

/** Read just the product ids the user has marked as "not interested". */
export async function readNotInterestedIds(userId: string | null | undefined): Promise<Set<string>> {
  const events = await readEvents(userId);
  const out = new Set<string>();
  for (const ev of events) {
    if (ev.type === "not_interested" || ev.type === "dismiss") {
      const pid = "product" in ev ? (ev as { product: TrackedProduct }).product?.id : null;
      if (pid) out.add(pid);
    }
  }
  return out;
}

/** Append a single event to the user's log (dedupes trivial repeats). */
export async function appendEvent(
  userId: string | null | undefined,
  event: RecommendationEvent,
): Promise<void> {
  try {
    const events = await readEvents(userId);
    // Light dedupe: skip if same view/wishlist event for the same product within 2s.
    const last = events[0];
    if (last && shouldDedupe(last, event)) return;

    const next = [event, ...events].slice(0, MAX_EVENTS);
    await AsyncStorage.setItem(storageKey(userId), JSON.stringify(next));

    // Mirror to server. Best-effort: queue persists offline; the ranker
    // does not block on this path. Guest events stay local-only.
    if (userId) enqueueRemoteEvent(userId, event);
  } catch {
    // Best-effort. Swallow.
  }
}

/** Fire-and-forget append — never throws, never blocks. */
export function trackEvent(userId: string | null | undefined, event: RecommendationEvent): void {
  void appendEvent(userId, event);
}

/** Get the product id from an event if it carries one. */
function productId(ev: RecommendationEvent): string | null {
  return "product" in ev && (ev as { product?: TrackedProduct }).product?.id
    ? ((ev as { product: TrackedProduct }).product.id as string)
    : null;
}

function shouldDedupe(prev: RecommendationEvent, next: RecommendationEvent): boolean {
  if (prev.t <= Date.now() - 2000) return false;
  if (prev.type !== next.type) return false;

  switch (next.type) {
    case "view":
      return prev.type === "view" && prev.product.id === (next as ViewEvent).product.id;
    case "wishlist_add":
    case "wishlist_remove":
      return (
        (prev.type === "wishlist_add" || prev.type === "wishlist_remove") &&
        productId(prev) === productId(next)
      );
    case "cart_add":
    case "remove_from_cart":
      return (
        (prev.type === "cart_add" || prev.type === "remove_from_cart") &&
        productId(prev) === productId(next)
      );
    case "search":
      return (
        prev.type === "search" &&
        (prev as SearchEvent).query.trim().toLowerCase() ===
          (next as SearchEvent).query.trim().toLowerCase()
      );
    case "search_result_click":
      return (
        prev.type === "search_result_click" &&
        (prev as SearchResultClickEvent).query.trim().toLowerCase() ===
          (next as SearchResultClickEvent).query.trim().toLowerCase() &&
        productId(prev) === productId(next)
      );
    case "not_interested":
    case "dismiss":
      return (
        (prev.type === "not_interested" || prev.type === "dismiss") &&
        productId(prev) === productId(next)
      );
    case "product_impression":
    case "product_click":
      return (
        (prev.type === "product_impression" || prev.type === "product_click") &&
        productId(prev) === productId(next) &&
        ((prev as ImpressionEvent).surface ?? "") ===
          ((next as ImpressionEvent).surface ?? "")
      );
    case "category_view":
      return (
        prev.type === "category_view" &&
        (prev as CategoryViewEvent).category_id === (next as CategoryViewEvent).category_id
      );
    case "collection_view":
      return (
        prev.type === "collection_view" &&
        (prev as CollectionViewEvent).collection_id === (next as CollectionViewEvent).collection_id
      );
    case "store_view":
      return (
        prev.type === "store_view" &&
        (prev as StoreViewEvent).store_id === (next as StoreViewEvent).store_id
      );
    case "product_share":
      return prev.type === "product_share" && productId(prev) === productId(next);
    case "filter_used":
      return (
        prev.type === "filter_used" &&
        (prev as FilterUsedEvent).filter_id === (next as FilterUsedEvent).filter_id &&
        (prev as FilterUsedEvent).filter_value === (next as FilterUsedEvent).filter_value
      );
    case "sort_used":
      return (
        prev.type === "sort_used" &&
        (prev as SortUsedEvent).sort_key === (next as SortUsedEvent).sort_key
      );
    case "purchase":
    case "checkout_started":
      return false;
  }
}

/** Clear all events for a user. Exposed for settings. */
export async function clearEvents(userId: string | null | undefined): Promise<void> {
  try {
    await AsyncStorage.removeItem(storageKey(userId));
  } catch {
    // ignore
  }
  // Mirror wipe to the server. The RPC is idempotent.
  if (userId) void clearRemoteEvents(userId);
}

/** Clear only "not_interested" / "dismiss" markers, keep the rest. */
export async function clearNotInterested(userId: string | null | undefined): Promise<void> {
  try {
    const events = await readEvents(userId);
    const kept = events.filter(
      (ev) => ev.type !== "not_interested" && ev.type !== "dismiss",
    );
    await AsyncStorage.setItem(storageKey(userId), JSON.stringify(kept));
  } catch {
    // ignore
  }
}

/* ------------------------------------------------------------------ */
/*  Snapshot helpers                                                   */
/* ------------------------------------------------------------------ */

const GARMENT_TOKENS = new Set([
  "shirt", "tshirt", "t-shirt", "tee", "pants", "trousers", "jeans", "shorts",
  "skirt", "dress", "jacket", "coat", "blazer", "hoodie", "sweatshirt",
  "sweater", "shoes", "sneakers", "boots", "loafers", "sandals", "heels",
  "bag", "handbag", "tote", "backpack", "belt", "scarf", "hat", "cap",
  "sunglasses", "watch", "gloves", "socks",
]);

/** Extract a single garment token from a product name + tags. */
export function extractGarmentToken(product: Pick<Product, "name" | "tags">): string | null {
  const haystack = `${product.name ?? ""} ${(product.tags ?? []).join(" ")}`.toLowerCase();
  for (const token of haystack.split(/[^a-z0-9-]+/)) {
    if (GARMENT_TOKENS.has(token)) return token;
  }
  return null;
}

/** Build a compact snapshot of a product for event tracking. */
export function snapshotProduct(product: Product): TrackedProduct {
  const colors = Array.from(
    new Set(
      (product.variants ?? [])
        .map((v) => (v.color ?? "").trim().toLowerCase())
        .filter(Boolean),
    ),
  );
  return {
    id: product.id,
    category_id: product.category_id ?? null,
    brand_id: product.brand_id ?? null,
    store_id: product.store_id ?? null,
    tags: (product.tags ?? []).map((t) => t.toLowerCase()).slice(0, 16),
    material: product.material?.toLowerCase() ?? null,
    gender: product.gender ?? null,
    price: product.price ?? undefined,
    colors,
    garment: extractGarmentToken(product),
  };
}
