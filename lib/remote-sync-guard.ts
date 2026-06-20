let suppressUntil = 0;

/** Ignore remote pulls briefly after a local push to avoid echo loops. */
export function suppressRemoteSyncPull(ms = 1800): void {
  suppressUntil = Date.now() + ms;
}

export function isRemoteSyncPullSuppressed(): boolean {
  return Date.now() < suppressUntil;
}

/** @deprecated Use suppressRemoteSyncPull */
export const suppressCartRemotePull = suppressRemoteSyncPull;

/** @deprecated Use isRemoteSyncPullSuppressed */
export const isCartRemotePullSuppressed = isRemoteSyncPullSuppressed;
