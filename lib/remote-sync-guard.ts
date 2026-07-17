let suppressUntil = 0;
let pushInFlight = 0;

/** Ignore remote pulls briefly after a local push to avoid echo loops. */
export function suppressRemoteSyncPull(ms = 1800): void {
  suppressUntil = Date.now() + ms;
}

export function isRemoteSyncPullSuppressed(): boolean {
  return Date.now() < suppressUntil;
}

/**
 * Mark a local→server push as in flight (e.g. cart `syncToServer`). While
 * any push is in flight, remote pulls must be skipped — otherwise a pull
 * can land mid-push (the server briefly holding a stale or partially
 * written state) and overwrite the just-made local change. Counter-based
 * so overlapping pushes don't clear each other's flag early.
 */
export function beginPushInFlight(): void {
  pushInFlight += 1;
}

export function endPushInFlight(): void {
  pushInFlight = Math.max(0, pushInFlight - 1);
}

export function isPushInFlight(): boolean {
  return pushInFlight > 0;
}

/** @deprecated Use suppressRemoteSyncPull */
export const suppressCartRemotePull = suppressRemoteSyncPull;

/** @deprecated Use isRemoteSyncPullSuppressed */
export const isCartRemotePullSuppressed = isRemoteSyncPullSuppressed;
