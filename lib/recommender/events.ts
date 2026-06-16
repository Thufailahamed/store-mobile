/**
 * Recommendation event log.
 *
 * Stores per-user behavioral events (view, search, wishlist, cart, purchase)
 * in AsyncStorage. Each event carries a minimal product snapshot so the
 * ranker can score candidates even when the product is no longer available
 * or when the user is offline.
 *
 * We never block the UI on these writes — they are best-effort fire-and-forget.
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
  | "purchase"
  | "dismiss"
  | "not_interested";

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

export interface PurchaseEvent extends BaseEvent {
  type: "purchase";
  product: TrackedProduct;
  quantity: number;
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
}

export type RecommendationEvent =
  | ViewEvent
  | SearchEvent
  | WishlistEvent
  | CartEvent
  | PurchaseEvent
  | DismissEvent
  | NotInterestedEvent;

const EVENTS_SUFFIX = "rec_events";
const MAX_EVENTS = 500; // hard cap to keep storage bounded

function storageKey(userId: string | null | undefined) {
  return `luxe:${userId ?? guestId}:${EVENTS_SUFFIX}`;
}

/** Read the event log for a user. */
export async function readEvents(userId: string | null | undefined): Promise<RecommendationEvent[]> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as RecommendationEvent[]) : [];
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

function shouldDedupe(prev: RecommendationEvent, next: RecommendationEvent): boolean {
  if (prev.t > Date.now() - 2000) {
    if (prev.type === "view" && next.type === "view") {
      return prev.product.id === (next as ViewEvent).product.id;
    }
    if (
      (prev.type === "wishlist_add" || prev.type === "wishlist_remove") &&
      (next.type === "wishlist_add" || next.type === "wishlist_remove")
    ) {
      return prev.product.id === (next as WishlistEvent).product.id;
    }
    if (prev.type === "search" && next.type === "search") {
      return (prev as SearchEvent).query.trim().toLowerCase() ===
        (next as SearchEvent).query.trim().toLowerCase();
    }
    if (
      (prev.type === "not_interested" || prev.type === "dismiss") &&
      (next.type === "not_interested" || next.type === "dismiss")
    ) {
      const a = "product" in prev ? (prev as { product: TrackedProduct }).product.id : null;
      const b = "product" in next ? (next as { product: TrackedProduct }).product.id : null;
      return a !== null && a === b;
    }
  }
  return false;
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
