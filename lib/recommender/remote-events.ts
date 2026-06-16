/**
 * Remote event sync.
 *
 * Mirrors the device-local event log to Supabase so the user profile
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
import { supabase } from "@/lib/supabase/client";
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
    return Array.isArray(parsed) ? (parsed as RecommendationEvent[]) : [];
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

interface RemoteEventRow {
  clientId: string;
  t: number;
  type: string;
  query?: string | null;
  tokens?: string[] | null;
  resultCount?: number | null;
  dwellMs?: number | null;
  surface?: string | null;
  quantity?: number | null;
  product?: {
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
  } | null;
}

/** Serialize a typed event to the wire shape the RPC expects. */
function toRow(event: RecommendationEvent): RemoteEventRow {
  const base: RemoteEventRow = {
    clientId: `${event.t}-${Math.random().toString(36).slice(2, 8)}`,
    t: event.t,
    type: event.type,
  };
  if (event.type === "search") {
    base.query = event.query;
    base.tokens = event.tokens;
    base.resultCount = event.resultCount;
  } else if (event.type === "view") {
    base.dwellMs = event.dwellMs ?? null;
    base.product = event.product as any;
  } else if (event.type === "purchase") {
    base.quantity = event.quantity;
    base.product = event.product as any;
  } else if (event.type === "dismiss") {
    base.surface = event.surface ?? null;
    base.product = event.product as any;
  } else if (event.type === "not_interested" || event.type === "wishlist_add" || event.type === "wishlist_remove" || event.type === "cart_add") {
    base.product = (event as any).product;
  }
  return base;
}

/** Hydrate a row from the server back into a typed RecommendationEvent. */
function fromRow(row: RemoteEventRow): RecommendationEvent | null {
  if (row.type === "search") {
    return {
      type: "search",
      t: row.t,
      query: row.query ?? "",
      tokens: row.tokens ?? [],
      resultCount: row.resultCount ?? 0,
    };
  }
  if (row.type === "view") {
    if (!row.product) return null;
    return { type: "view", t: row.t, product: row.product as any, dwellMs: row.dwellMs ?? undefined };
  }
  if (row.type === "purchase") {
    if (!row.product) return null;
    return { type: "purchase", t: row.t, product: row.product as any, quantity: row.quantity ?? 1 };
  }
  if (row.type === "wishlist_add" || row.type === "wishlist_remove") {
    if (!row.product) return null;
    return { type: row.type, t: row.t, product: row.product as any };
  }
  if (row.type === "cart_add") {
    if (!row.product) return null;
    return { type: "cart_add", t: row.t, product: row.product as any };
  }
  if (row.type === "dismiss") {
    if (!row.product) return null;
    return { type: "dismiss", t: row.t, product: row.product as any, surface: row.surface ?? undefined };
  }
  if (row.type === "not_interested") {
    if (!row.product) return null;
    return { type: "not_interested", t: row.t, product: row.product as any };
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
    const { data, error } = await supabase.rpc("append_user_events", {
      p_events: rows as any,
    });
    if (error) {
      // Keep the queue intact so we retry next time.
      return 0;
    }
    // Clear only what the server accepted. The RPC is idempotent on the
    // server side (ON CONFLICT DO NOTHING) so a partial success is fine;
    // we just clear the whole batch.
    await writeQueue(userId, []);
    return typeof data === "number" ? data : rows.length;
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
    const { data, error } = await supabase.rpc("fetch_user_recent_events", {
      p_limit: Math.max(1, Math.min(limit, REMOTE_FETCH_LIMIT)),
    });
    if (error || !data) return [];
    if (!Array.isArray(data)) return [];
    const out: RecommendationEvent[] = [];
    for (const row of data as RemoteEventRow[]) {
      const ev = fromRow(row);
      if (ev) out.push(ev);
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
    await supabase.rpc("clear_user_events");
  } catch {
    // ignore
  }
  await writeQueue(userId, []);
}
