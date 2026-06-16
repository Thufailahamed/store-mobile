/**
 * User interest profile.
 *
 * Aggregates a user's recommendation events into weighted affinities across
 * multiple axes (category, brand, material, color, garment, tag, price band,
 * gender). Affinities are time-decayed so recent behavior outweighs old.
 *
 * Used by the ranker to score candidate products for personalization.
 */

import {
  readEvents,
  type RecommendationEvent,
  type ViewEvent,
  type SearchEvent,
  type WishlistEvent,
  type CartEvent,
  type PurchaseEvent,
  type TrackedProduct,
} from "./events";
import {
  fetchRemoteEvents,
  flushQueue,
  noteHydration,
} from "./remote-events";

/** Half-life in days. Behavior older than this loses half its weight. */
const HALF_LIFE_DAYS = 14;
const HALF_LIFE_MS = HALF_LIFE_DAYS * 24 * 60 * 60 * 1000;

/** Base weight per event type. */
const BASE_WEIGHTS = {
  view: 1.0,
  search: 2.0, // multiplied by # of useful tokens
  wishlist_add: 4.0,
  wishlist_remove: -2.0, // mild negative signal
  cart_add: 6.0,
  purchase: 10.0,
  dismiss: -3.0,        // user actively swiped past
  not_interested: -8.0, // strong negative — never show again
} as const;

const MAX_DWELL_MS = 120_000; // cap dwell bonus at 2 minutes
const DWELL_BONUS = 1.0;      // up to +1.0 from dwell

/** Affinity map: token → weight. */
export type AffinityMap = Record<string, number>;

export interface UserProfile {
  /** True if the user has enough signal to personalize. */
  hasSignal: boolean;
  /** Number of events that contributed to this profile. */
  eventCount: number;
  /** Most recent event timestamp (ms). 0 if no events. */
  lastEventAt: number;
  /** Affinity per category id. */
  categories: AffinityMap;
  /** Affinity per brand id. */
  brands: AffinityMap;
  /** Affinity per material token (lowercased). */
  materials: AffinityMap;
  /** Affinity per color token (lowercased). */
  colors: AffinityMap;
  /** Affinity per garment token. */
  garments: AffinityMap;
  /** Affinity per tag token. */
  tags: AffinityMap;
  /** Affinity per gender. */
  genders: AffinityMap;
  /** Sum of price * weight, used for price-band affinity. */
  priceWeightedSum: number;
  /** Sum of weights that contributed to priceWeightedSum. */
  priceWeightTotal: number;
  /** History of product ids the user has touched (capped). */
  recentProductIds: string[];
  /** Product ids the user has explicitly dismissed or marked not interested. */
  excludedProductIds: string[];
}

export const EMPTY_PROFILE: UserProfile = {
  hasSignal: false,
  eventCount: 0,
  lastEventAt: 0,
  categories: {},
  brands: {},
  materials: {},
  colors: {},
  garments: {},
  tags: {},
  genders: {},
  priceWeightedSum: 0,
  priceWeightTotal: 0,
  recentProductIds: [],
  excludedProductIds: [],
};

/** Compute time-decayed weight for an event given its age. */
export function decayedWeight(base: number, eventTs: number, now: number = Date.now()): number {
  const age = Math.max(0, now - eventTs);
  const decay = Math.pow(0.5, age / HALF_LIFE_MS);
  return base * decay;
}

function bump(map: AffinityMap, key: string | null | undefined, weight: number) {
  if (!key) return;
  const k = String(key).toLowerCase();
  if (!k) return;
  map[k] = (map[k] ?? 0) + weight;
}

function bumpArray(map: AffinityMap, values: string[] | null | undefined, weight: number) {
  if (!values || values.length === 0) return;
  for (const v of values) bump(map, v, weight);
}

/** Build a profile from a raw event list. */
export function buildProfile(events: RecommendationEvent[], now: number = Date.now()): UserProfile {
  const profile: UserProfile = {
    ...EMPTY_PROFILE,
    categories: {},
    brands: {},
    materials: {},
    colors: {},
    garments: {},
    tags: {},
    genders: {},
    // Deep-clone mutable arrays so callers (and the ranker) can safely
    // mutate per-build arrays without polluting EMPTY_PROFILE.
    recentProductIds: [],
    excludedProductIds: [],
  };

  for (const ev of events) {
    const base = baseWeightFor(ev);
    if (base === 0) continue;
    const w = decayedWeight(base, ev.t, now);
    if (w === 0) continue;

    applyEventToProfile(profile, ev, w);
    profile.eventCount += 1;
    if (ev.t > profile.lastEventAt) profile.lastEventAt = ev.t;
  }

  // Mark as having signal only if we have at least 3 events.
  profile.hasSignal = profile.eventCount >= 3;

  return profile;
}

function baseWeightFor(ev: RecommendationEvent): number {
  switch (ev.type) {
    case "view": {
      const dwellMs = Math.min(MAX_DWELL_MS, Math.max(0, (ev as ViewEvent).dwellMs ?? 0));
      const dwellBonus = DWELL_BONUS * (dwellMs / MAX_DWELL_MS);
      return BASE_WEIGHTS.view + dwellBonus;
    }
    case "search": {
      const tokens = (ev as SearchEvent).tokens.filter((t) => t.length >= 3);
      return BASE_WEIGHTS.search * Math.max(1, Math.min(4, tokens.length));
    }
    case "wishlist_add":
      return BASE_WEIGHTS.wishlist_add;
    case "wishlist_remove":
      return BASE_WEIGHTS.wishlist_remove;
    case "cart_add":
      return BASE_WEIGHTS.cart_add;
    case "purchase":
      return BASE_WEIGHTS.purchase;
    case "dismiss":
      return BASE_WEIGHTS.dismiss;
    case "not_interested":
      return BASE_WEIGHTS.not_interested;
  }
}

function applyEventToProfile(
  profile: UserProfile,
  ev: RecommendationEvent,
  weight: number,
) {
  // Search events boost the affinity for *query tokens* across the tag/garment/material
  // axes (since search hits those fields most strongly). They do not update category/brand
  // directly — those need product context.
  if (ev.type === "search") {
    const tokens = (ev as SearchEvent).tokens;
    // Spread a small slice of the weight across each token (already weighted by token count).
    const perToken = weight / Math.max(1, tokens.length);
    for (const tok of tokens) {
      if (tok.length < 3) continue;
      bump(profile.tags, tok, perToken * 0.5);
      bump(profile.garments, tok, perToken * 0.3);
      bump(profile.materials, tok, perToken * 0.2);
    }
    return;
  }

  // All other events have a TrackedProduct.
  const product = "product" in ev ? (ev as Exclude<RecommendationEvent, SearchEvent>).product : null;
  if (!product) return;

  bump(profile.categories, product.category_id, weight);
  bump(profile.brands, product.brand_id, weight);
  bump(profile.materials, product.material, weight);
  bump(profile.genders, product.gender, weight);
  bump(profile.garments, product.garment, weight);
  bumpArray(profile.colors, product.colors, weight * 0.7);
  bumpArray(profile.tags, product.tags, weight * 0.5);

  // Price band: only positive signals contribute (don't pull profile toward prices of unwishlisted items).
  if (weight > 0 && typeof product.price === "number" && product.price > 0) {
    profile.priceWeightedSum += product.price * weight;
    profile.priceWeightTotal += weight;
  }

  // Track recent product ids (capped, deduped).
  if (product.id && !profile.recentProductIds.includes(product.id)) {
    profile.recentProductIds.unshift(product.id);
    if (profile.recentProductIds.length > 50) profile.recentProductIds.length = 50;
  }

  // Track excluded (not_interested / dismiss) product ids.
  if (ev.type === "not_interested" || ev.type === "dismiss") {
    if (product.id && !profile.excludedProductIds.includes(product.id)) {
      profile.excludedProductIds.unshift(product.id);
      if (profile.excludedProductIds.length > 200) profile.excludedProductIds.length = 200;
    }
  }
}

/** Load the profile for a user. */
export async function loadProfile(userId: string | null | undefined): Promise<UserProfile> {
  const local = await readEvents(userId);
  let merged: RecommendationEvent[] = local;
  if (userId) {
    // Pull the server mirror and fold it in. Failed fetch → fall back to
    // local log (offline-first). Push pending local events in the same
    // breath so the server catches up.
    const remote = await fetchRemoteEvents(userId);
    merged = mergeEventLogs(local, remote);
    void noteHydration(userId);
    void flushQueue(userId);
  }
  return buildProfile(merged);
}

/**
 * Dedup-merge two event logs by an event signature. The signature is
 * (t, type, productId) for product events and (t, query) for search.
 * Within a signature, the local copy wins (it has the freshest client_id
 * and is the source of truth for any in-flight offline edits).
 */
export function mergeEventLogs(
  local: RecommendationEvent[],
  remote: RecommendationEvent[],
): RecommendationEvent[] {
  if (remote.length === 0) return local;
  if (local.length === 0) return remote;
  const sig = (e: RecommendationEvent): string => {
    if (e.type === "search") {
      return `${e.t}|search|${(e.query ?? "").toLowerCase()}`;
    }
    const pid = (e as { product?: TrackedProduct }).product?.id ?? "";
    return `${e.t}|${e.type}|${pid}`;
  };
  const seen = new Set<string>();
  const out: RecommendationEvent[] = [];
  for (const ev of local) {
    const s = sig(ev);
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(ev);
  }
  for (const ev of remote) {
    const s = sig(ev);
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(ev);
  }
  return out;
}

/** Get the user's preferred price band center (0 if not enough data). */
export function profilePriceCenter(profile: UserProfile): number {
  if (profile.priceWeightTotal <= 0) return 0;
  return profile.priceWeightedSum / profile.priceWeightTotal;
}
