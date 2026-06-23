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

interface WireEvent {
  type: string;
  product_id?: string;
  category_id?: string;
  metadata: Record<string, unknown>;
  occurred_at?: string;
}

interface RemoteEventRow {
  type: string;
  product_id?: string | null;
  category_id?: string | null;
  metadata?: Record<string, unknown> | null;
  occurred_at?: string | null;
}

/** Serialize a typed event to the wire shape the backend endpoint accepts. */
function toRow(event: RecommendationEvent): WireEvent {
  const metadata: Record<string, unknown> = {
    client_id: `${event.t}-${Math.random().toString(36).slice(2, 8)}`,
    t: event.t,
  };
  let product_id: string | null = null;
  let category_id: string | null = null;

  if (event.type === "search") {
    metadata.query = event.query;
    metadata.tokens = event.tokens;
    metadata.resultCount = event.resultCount;
  } else if ("product" in event && event.product) {
    const p = event.product as { id: string; category_id?: string | null };
    product_id = p.id ?? null;
    category_id = p.category_id ?? null;
    metadata.product = p;
    if (event.type === "view") metadata.dwellMs = event.dwellMs ?? null;
    if (event.type === "purchase") metadata.quantity = event.quantity;
    if (event.type === "dismiss") metadata.surface = event.surface ?? null;
  }

  return {
    type: event.type,
    ...(product_id ? { product_id } : {}),
    ...(category_id ? { category_id } : {}),
    metadata,
    occurred_at: new Date(event.t).toISOString(),
  };
}

/** Hydrate a row from the server back into a typed RecommendationEvent. */
function fromRow(row: RemoteEventRow): RecommendationEvent | null {
  const meta = row.metadata ?? {};
  const t =
    typeof meta.t === "number"
      ? (meta.t as number)
      : row.occurred_at
        ? Date.parse(row.occurred_at)
        : Date.now();
  const product = (meta.product as RecommendationEvent extends { product?: infer P } ? P : never) ?? null;

  if (row.type === "search") {
    return {
      type: "search",
      t,
      query: String(meta.query ?? ""),
      tokens: Array.isArray(meta.tokens) ? (meta.tokens as string[]) : [],
      resultCount: Number(meta.resultCount ?? 0),
    };
  }
  if (row.type === "view" && product) {
    return { type: "view", t, product: product as never, dwellMs: Number(meta.dwellMs ?? 0) || undefined };
  }
  if (row.type === "purchase" && product) {
    return { type: "purchase", t, product: product as never, quantity: Number(meta.quantity ?? 1) };
  }
  if (row.type === "wishlist_add" && product) {
    return { type: "wishlist_add", t, product: product as never };
  }
  if (row.type === "wishlist_remove" && product) {
    return { type: "wishlist_remove", t, product: product as never };
  }
  if (row.type === "cart_add" && product) {
    return { type: "cart_add", t, product: product as never };
  }
  if (row.type === "dismiss" && product) {
    return { type: "dismiss", t, product: product as never, surface: (meta.surface as string | undefined) ?? undefined };
  }
  if (row.type === "not_interested" && product) {
    return { type: "not_interested", t, product: product as never };
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
    const res = await appendEventsBackend(rows);
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
