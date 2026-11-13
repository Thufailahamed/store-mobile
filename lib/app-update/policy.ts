/**
 * Pure logic for the "update the app" prompts. No React, no storage — the
 * hook and components wrap this so it stays unit-testable.
 */

export type AppUpdateStatus = "ok" | "update_available" | "update_required";

export type AppVersionPolicy = {
  platform: "ios" | "android";
  status: AppUpdateStatus;
  latest: string;
  min_supported: string;
  store_url: string;
  message: string;
};

export type BannerDismissal = { latest: string; at: number };

/** A dismissed "update available" banner stays hidden this long for the same release. */
export const BANNER_SNOOZE_MS = 3 * 24 * 60 * 60 * 1000;

/** Don't refetch the policy on every foreground more often than this. */
export const POLICY_REFRESH_MS = 15 * 60 * 1000;

const VERSION_RE = /^\d+(\.\d+){0,3}$/;

export function isValidVersion(v: unknown): v is string {
  return typeof v === "string" && VERSION_RE.test(v.trim());
}

/** Numeric dotted compare; missing parts count as 0. */
export function compareVersions(a: string, b: string): number {
  const pa = a.trim().split(".").map(Number);
  const pb = b.trim().split(".").map(Number);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

/**
 * The server already evaluates status, but we re-derive it locally from
 * latest/min_supported so a stale CDN-cached answer for another version
 * can never block or nag the wrong build.
 */
export function resolveStatus(policy: AppVersionPolicy, installed: string): AppUpdateStatus {
  if (!isValidVersion(installed)) return "ok";
  if (isValidVersion(policy.min_supported) && compareVersions(installed, policy.min_supported) < 0) {
    return "update_required";
  }
  if (isValidVersion(policy.latest) && compareVersions(installed, policy.latest) < 0) {
    return "update_available";
  }
  return "ok";
}

export function shouldShowBanner(
  policy: AppVersionPolicy | null,
  installed: string,
  dismissal: BannerDismissal | null,
  now: number = Date.now(),
): boolean {
  if (!policy || resolveStatus(policy, installed) !== "update_available") return false;
  if (!dismissal || dismissal.latest !== policy.latest) return true;
  return now - dismissal.at >= BANNER_SNOOZE_MS;
}

export function shouldBlock(policy: AppVersionPolicy | null, installed: string): boolean {
  return !!policy && resolveStatus(policy, installed) === "update_required";
}

/** Only ever open an https store link that came from our own backend. */
export function safeStoreUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

export function parsePolicy(raw: unknown): AppVersionPolicy | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.platform !== "ios" && o.platform !== "android") return null;
  if (!isValidVersion(o.latest) || !isValidVersion(o.min_supported)) return null;
  return {
    platform: o.platform,
    status: o.status === "update_required" || o.status === "update_available" ? o.status : "ok",
    latest: o.latest,
    min_supported: o.min_supported,
    store_url: typeof o.store_url === "string" ? o.store_url : "",
    message: typeof o.message === "string" ? o.message : "",
  };
}
