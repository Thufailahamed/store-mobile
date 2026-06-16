/**
 * In-memory TTL cache for recommendation results.
 *
 * Recommendations are expensive (broad candidate pull + per-product scoring).
 * Within a session, the same user asking for the same rail within a short
 * window will get the same result. This cache holds the most recent N
 * entries and expires them after a configurable TTL.
 *
 * The cache is intentionally process-local. On app cold start it is empty.
 * It is also invalidated explicitly when the user dismisses a product or
 * clears their rec data.
 */

interface CacheEntry<T> {
  value: T;
  /** Epoch ms when the entry expires. */
  expiresAt: number;
}

const MAX_ENTRIES = 32;
const DEFAULT_TTL_MS = 60_000;

const store = new Map<string, CacheEntry<unknown>>();

/** Build a stable cache key from arbitrary parts. */
export function cacheKey(...parts: Array<string | number | undefined | null>): string {
  return parts
    .filter((p) => p !== undefined && p !== null && p !== "")
    .map((p) => String(p))
    .join("::");
}

export function cacheGet<T>(key: string): T | null {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    store.delete(key);
    return null;
  }
  // Touch — keep most recently used at the end of the map.
  store.delete(key);
  store.set(key, entry as CacheEntry<unknown>);
  return entry.value;
}

export function cacheSet<T>(key: string, value: T, ttlMs: number = DEFAULT_TTL_MS): void {
  if (store.size >= MAX_ENTRIES) {
    // Drop oldest (first) entry.
    const firstKey = store.keys().next().value;
    if (firstKey !== undefined) store.delete(firstKey);
  }
  store.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}

export function cacheDelete(key: string): void {
  store.delete(key);
}

export function cacheClear(): void {
  store.clear();
}

/** Bust all entries that start with the given prefix. */
export function cacheBustPrefix(prefix: string): void {
  for (const k of Array.from(store.keys())) {
    if (k.startsWith(prefix)) store.delete(k);
  }
}
