/**
 * Remote event sync.
 *
 * Mirrors the device-local event log to the backend so the user profile
 * (and therefore the personalized feed) survives reinstall, works across
 * devices, and is available the moment the user signs in on a new phone.
 *
 * Design rules:
 *   - Append-only. The server is a mirror, not a source of truth.
 *   - Fire-and-forget. Network failures never block the UI.
 *   - Offline queue. Failed flushes stay in AsyncStorage and are retried
 *     on the next opportunity (cold start, foreground, periodic).
 *   - Dedupe by (user_id, client_id) on the server. Safe to replay the
 *     same batch after a partial network failure.
 *   - No reads here. Reads go through `fetchRemoteEvents` (cold start
 *     only) and the rest of the ranker uses the in-memory profile.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  appendEventsBackend,
  fetchRecentEventsBackend,
  clearEventsBackend,
} from "@/lib/api/backend";
import type { RecommendationEvent } from "./events";

const QUEUE_KEY = (userId: string | null | undefined) =>
  `luxe:${userId ?? "guest"}:event_sync_queue`;

const LAST_HYDRATE_KEY = (userId: string | null | undefined) =>
  `luxe:${userId ?? "guest"}:event_last_hydrate`;

/** Throttle: don't flush more than once per FLUSH_INTERVAL_MS per user. */
const FLUSH_INTERVAL_MS = 15_000;
/** Cap queued events to avoid unbounded growth. */
const QUEUE_HARD_CAP = 200;
/** Server fetch cap on cold start. Matches client log cap. */
const REMOTE_FETCH_LIMIT = 500;
/** Drop events older than this on flush — the ranker is a near-real-time
 *  signal, and stale entries just dilute the profile. */
const MAX_EVENT_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function isStale(event: RecommendationEvent): boolean {
  const ageMs = Date.now() - (event.t ?? 0);
  return ageMs > MAX_EVENT_AGE_MS;
}

/** Per-user last-flush timestamp cache (module-local, in-memory). */
const lastFlushAt = new Map<string, number>();

/** Test-only: clear the in-memory throttle cache. */
export function __resetThrottleForTest(): void {
  lastFlushAt.clear();
}

/* ------------------------------------------------------------------ */
/*  Offline queue                                                       */
/* ------------------------------------------------------------------ */

async function readQueue(userId: string | null | undefined): Promise<RecommendationEvent[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as RecommendationEvent[]).filter((e) => !isStale(e));
  } catch {
    return [];
  }
}

async function writeQueue(
  userId: string | null | undefined,
  events: RecommendationEvent[],
): Promise<void> {
  try {
    if (events.length === 0) {
      await AsyncStorage.removeItem(QUEUE_KEY(userId));
    } else {
      const trimmed = events.slice(0, QUEUE_HARD_CAP);
      await AsyncStorage.setItem(QUEUE_KEY(userId), JSON.stringify(trimmed));
    }
  } catch {
    // Best-effort. Swallow.
  }
}

/* ------------------------------------------------------------------ */
/*  Wire format                                                         */
/* ------------------------------------------------------------------ */

/**
 * Phase 1 (0260): wire shape mirrors the backend `/api/recommender/track`
 * endpoint (flat fields + product snapshot). The legacy metadata envelope
 * is preserved in `metadata` for backward-compat reads on older rows.
 */
interface WireEvent {
  clientId: string;
  t: number;
  type: string;
  query?: string | null;
  tokens?: string[] | null;
  resultCount?: number | null;
  dwellMs?: number | null;
  surface?: string | null;
  position?: number | null;
  quantity?: number | null;
  category_id?: string | null;
  collection_id?: string | null;
  store_id?: string | null;
  channel?: string | null;
  filter_id?: string | null;
  filter_value?: string | null;
  sort_key?: string | null;
  cart_total?: number | null;
  item_count?: number | null;
  product?: WireProduct | null;
  /** Legacy metadata envelope, kept so older rows still deserialize. */
  metadata?: Record<string, unknown>;
}

interface WireProduct {
  id: string;
  category_id?: string | null;
  brand_id?: string | null;
  store_id?: string | null;
  material?: string | null;
  gender?: string | null;
  garment?: string | null;
  price?: number | null;
  colors?: string[] | null;
  tags?: string[] | null;
}

/** WireProduct has nullable fields; TrackedProduct has optional fields.
 *  Structurally identical — just an `as` to bridge. */
function asTracked(p: WireProduct): import("./events").TrackedProduct {
  return p as unknown as import("./events").TrackedProduct;
}

interface RemoteEventRow {
  type: string;
  product_id?: string | null;
  category_id?: string | null;
  metadata?: Record<string, unknown> | null;
  occurred_at?: string | null;
  // 0260 flat fields (server may emit either legacy or new shape).
  t?: number | null;
  clientId?: string | null;
  query?: string | null;
  tokens?: string[] | null;
  resultCount?: number | null;
  dwellMs?: number | null;
  surface?: string | null;
  position?: number | null;
  quantity?: number | null;
  collection_id?: string | null;
  store_id?: string | null;
  channel?: string | null;
  filter_id?: string | null;
  filter_value?: string | null;
  sort_key?: string | null;
  cart_total?: number | null;
  item_count?: number | null;
  product?: WireProduct | null;
}

/** Serialize a typed event to the wire shape the backend endpoint accepts. */
function toRow(event: RecommendationEvent): WireEvent {
  const base: WireEvent = {
    clientId: `${event.t}-${Math.random().toString(36).slice(2, 8)}`,
    t: event.t,
    type: event.type,
  };
  switch (event.type) {
    case "search":
      base.query = event.query;
      base.tokens = event.tokens;
      base.resultCount = event.resultCount;
      if (event.surface) base.surface = event.surface;
      break;
    case "view":
      base.dwellMs = event.dwellMs ?? null;
      if (event.surface) base.surface = event.surface;
      base.product = event.product as WireProduct;
      break;
    case "purchase":
      base.quantity = event.quantity;
      base.product = event.product as WireProduct;
      break;
    case "wishlist_add":
    case "wishlist_remove":
    case "cart_add":
    case "remove_from_cart":
      base.product = event.product as WireProduct;
      break;
    case "dismiss":
    case "not_interested":
      base.surface = event.surface ?? null;
      base.product = event.product as WireProduct;
      break;
    case "product_impression":
    case "product_click":
      base.surface = event.surface ?? null;
      base.position = event.position ?? null;
      base.product = event.product as WireProduct;
      break;
    case "search_result_click":
      base.query = event.query;
      base.tokens = event.tokens ?? null;
      base.position = event.position ?? null;
      base.product = event.product as WireProduct;
      break;
    case "category_view":
      base.category_id = event.category_id;
      break;
    case "collection_view":
      base.collection_id = event.collection_id;
      break;
    case "store_view":
      base.store_id = event.store_id;
      break;
    case "product_share":
      base.channel = event.channel ?? null;
      base.product = event.product as WireProduct;
      break;
    case "filter_used":
      base.filter_id = event.filter_id;
      base.filter_value = event.filter_value;
      if (event.surface) base.surface = event.surface;
      break;
    case "sort_used":
      base.sort_key = event.sort_key;
      if (event.surface) base.surface = event.surface;
      break;
    case "checkout_started":
      base.cart_total = event.cart_total ?? null;
      base.item_count = event.item_count ?? null;
      break;
  }
  // Carry legacy envelope so older rows still parse back.
  base.metadata = base as unknown as Record<string, unknown>;
  return base;
}

/** Hydrate a row from the server back into a typed RecommendationEvent. */
function fromRow(row: RemoteEventRow): RecommendationEvent | null {
  // Prefer flat 0260 fields; fall back to legacy metadata envelope.
  const meta = row.metadata ?? {};
  const t =
    typeof row.t === "number"
      ? row.t
      : typeof meta.t === "number"
        ? (meta.t as number)
        : row.occurred_at
          ? Date.parse(row.occurred_at)
          : Date.now();
  const product =
    (row.product as WireProduct | null | undefined) ??
    ((meta.product as WireProduct | undefined) ?? null);
  const surface = (row.surface ?? (meta.surface as string | undefined) ?? undefined) ?? undefined;

  if (row.type === "search") {
    return {
      type: "search",
      t,
      query: String(row.query ?? meta.query ?? ""),
      tokens: Array.isArray(row.tokens ?? meta.tokens)
        ? ((row.tokens ?? (meta.tokens as string[])) as string[])
        : [],
      resultCount: Number(row.resultCount ?? meta.resultCount ?? 0),
      surface,
    };
  }
  if (row.type === "view" && product) {
    return { type: "view", t, product: asTracked(product), dwellMs: Number(row.dwellMs ?? meta.dwellMs ?? 0) || undefined, surface };
  }
  if (row.type === "purchase" && product) {
    return { type: "purchase", t, product: asTracked(product), quantity: Number(row.quantity ?? meta.quantity ?? 1) };
  }
  if (row.type === "wishlist_add" && product) {
    return { type: "wishlist_add", t, product: asTracked(product) };
  }
  if (row.type === "wishlist_remove" && product) {
    return { type: "wishlist_remove", t, product: asTracked(product) };
  }
  if (row.type === "cart_add" && product) {
    return { type: "cart_add", t, product: asTracked(product) };
  }
  if (row.type === "remove_from_cart" && product) {
    return { type: "remove_from_cart", t, product: asTracked(product) };
  }
  if (row.type === "dismiss" && product) {
    return { type: "dismiss", t, product: asTracked(product), surface };
  }
  if (row.type === "not_interested" && product) {
    return { type: "not_interested", t, product: asTracked(product), surface };
  }
  if (row.type === "product_impression" && product) {
    return { type: "product_impression", t, product: asTracked(product), surface, position: row.position ?? undefined };
  }
  if (row.type === "product_click" && product) {
    return { type: "product_click", t, product: asTracked(product), surface, position: row.position ?? undefined };
  }
  if (row.type === "search_result_click" && product) {
    return {
      type: "search_result_click",
      t,
      query: String(row.query ?? ""),
      tokens: row.tokens ?? undefined,
      product: asTracked(product),
      position: row.position ?? undefined,
    };
  }
  if (row.type === "category_view" && (row.category_id ?? meta.category_id)) {
    return { type: "category_view", t, category_id: String(row.category_id ?? meta.category_id) };
  }
  if (row.type === "collection_view" && (row.collection_id ?? meta.collection_id)) {
    return { type: "collection_view", t, collection_id: String(row.collection_id ?? meta.collection_id) };
  }
  if (row.type === "store_view" && (row.store_id ?? meta.store_id)) {
    return { type: "store_view", t, store_id: String(row.store_id ?? meta.store_id) };
  }
  if (row.type === "product_share" && product) {
    return { type: "product_share", t, product: asTracked(product), channel: row.channel ?? undefined };
  }
  if (row.type === "filter_used" && row.filter_id) {
    return {
      type: "filter_used",
      t,
      filter_id: row.filter_id,
      filter_value: row.filter_value ?? "",
      surface,
    };
  }
  if (row.type === "sort_used" && row.sort_key) {
    return { type: "sort_used", t, sort_key: row.sort_key, surface };
  }
  if (row.type === "checkout_started") {
    return {
      type: "checkout_started",
      t,
      cart_total: row.cart_total ?? undefined,
      item_count: row.item_count ?? undefined,
    };
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Public API                                                          */
/* ------------------------------------------------------------------ */

/**
 * Enqueue an event for server sync. Always succeeds locally; the actual
 * network call is throttled and fires asynchronously.
 */
export function enqueueRemoteEvent(
  userId: string | null | undefined,
  event: RecommendationEvent,
): void {
  if (!userId) return; // guest events stay local-only.
  void (async () => {
    const queue = await readQueue(userId);
    queue.push(event);
    await writeQueue(userId, queue);
    void flushQueue(userId);
  })();
}

/**
 * Flush the offline queue to the server. Throttled to once per
 * FLUSH_INTERVAL_MS per user. Safe to call from anywhere; idempotent.
 * Returns the number of events sent (or 0 if throttled / not authenticated).
 */
export async function flushQueue(
  userId: string | null | undefined,
): Promise<number> {
  if (!userId) return 0;
  const now = Date.now();
  const last = lastFlushAt.get(userId) ?? 0;
  if (now - last < FLUSH_INTERVAL_MS) return 0;
  lastFlushAt.set(userId, now);

  const queue = await readQueue(userId);
  if (queue.length === 0) return 0;

  try {
    const rows = queue.map(toRow);
    const res = await appendEventsBackend(rows as unknown as Array<Record<string, unknown>>);
    if (!res.ok) {
      // Keep the queue intact so we retry next time.
      return 0;
    }
    // Clear only what the server accepted. The RPC is idempotent on the
    // server side (ON CONFLICT DO NOTHING) so a partial success is fine;
    // we just clear the whole batch.
    await writeQueue(userId, []);
    return Number(res.data.appended ?? rows.length);
  } catch {
    return 0;
  }
}

/**
 * Fetch the user's recent events from the server. Used on cold start to
 * hydrate the local profile so a fresh install gets the user's taste
 * immediately. The result is intended to be merged with the local log
 * before building the profile.
 *
 * Returns [] on any failure (offline, not authenticated, schema mismatch).
 * Never throws.
 */
export async function fetchRemoteEvents(
  userId: string | null | undefined,
  limit: number = REMOTE_FETCH_LIMIT,
): Promise<RecommendationEvent[]> {
  if (!userId) return [];
  try {
    const res = await fetchRecentEventsBackend(Math.max(1, Math.min(limit, REMOTE_FETCH_LIMIT)));
    if (!res.ok || !Array.isArray(res.data.events)) return [];
    const out: RecommendationEvent[] = [];
    for (const row of res.data.events as RemoteEventRow[]) {
      const ev = fromRow(row);
      if (ev && !isStale(ev)) out.push(ev);
    }
    return out;
  } catch {
    return [];
  }
}

/** Mark the last time we hydrated from the server. */
export async function noteHydration(userId: string | null | undefined): Promise<void> {
  if (!userId) return;
  try {
    await AsyncStorage.setItem(
      LAST_HYDRATE_KEY(userId),
      String(Date.now()),
    );
  } catch {
    // ignore
  }
}

/** Read the last hydration timestamp, or 0 if never. */
export async function lastHydrationAt(
  userId: string | null | undefined,
): Promise<number> {
  if (!userId) return 0;
  try {
    const raw = await AsyncStorage.getItem(LAST_HYDRATE_KEY(userId));
    return raw ? Number.parseInt(raw, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

/**
 * Clear the server-side log for the user. Used by the settings "Clear
 * recommendation data" flow so both sides are wiped.
 */
export async function clearRemoteEvents(
  userId: string | null | undefined,
): Promise<void> {
  if (!userId) return;
  try {
    await clearEventsBackend();
  } catch {
    // ignore
  }
  await writeQueue(userId, []);
}
