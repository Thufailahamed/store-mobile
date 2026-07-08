/**
 * Shared fetch helper for backend wrappers.
 *
 * Mirrors the pattern of `lib/api/delivery-api.ts` but with auth-optional
 * support. Public reads (homepage, catalogue, search, image-search)
 * accept anonymous callers; everything else requires a session and
 * returns `{ ok: false, error: "Not signed in" }` if no JWT is present.
 *
 * Envelope handling: backend returns `{ ok, data, version }` on success
 * and `{ ok, error: { message } }` on failure. The `data` is unwrapped
 * here. Legacy handlers may return a bare resource — pass through.
 */

import { supabase, refreshSessionOnce } from "@/lib/supabase/client";

import Constants from "expo-constants";

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

let cachedToken: string | null = null;
let tokenInitialized = false;
let initPromise: Promise<string | null> | null = null;

async function initTokenCache(): Promise<string | null> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      const { data } = await supabase.auth.getSession();
      cachedToken = data.session?.access_token ?? null;
      // Keep in-memory cache updated with any auth transitions
      supabase.auth.onAuthStateChange((_event, session) => {
        cachedToken = session?.access_token ?? null;
      });
      tokenInitialized = true;
      return cachedToken;
    } catch {
      return null;
    } finally {
      initPromise = null;
    }
  })();
  return initPromise;
}

export async function getAccessToken(): Promise<string | null> {
  if (tokenInitialized) {
    return cachedToken;
  }
  return initTokenCache();
}

export function getStoreApiUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_STORE_API_URL;
  const extraUrl = Constants.expoConfig?.extra?.storeApiUrl as string | undefined;
  return (envUrl || extraUrl || "").replace(/\/$/, "");
}

export async function hasStoreApi(): Promise<boolean> {
  return getStoreApiUrl().length > 0;
}

export interface FetchOpts {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Default true — set false for public reads. */
  requireAuth?: boolean;
  /** Custom timeout in ms. */
  timeoutMs?: number;
  /** Extra request headers (e.g. Idempotency-Key). */
  headers?: Record<string, string>;
}

function buildQuery(q?: FetchOpts["query"]): string {
  if (!q) return "";
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined || v === null) continue;
    params.set(k, String(v));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

type Attempt<T> =
  | { kind: "response"; status: number; json: Record<string, unknown> | unknown[] }
  | { kind: "network-error"; error: string };

async function attemptRequest(
  url: string,
  token: string | null,
  opts: FetchOpts,
): Promise<Attempt<unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 30_000);
  try {
    const res = await fetch(url, {
      method: opts.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(opts.headers ?? {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown> | unknown[];
    return { kind: "response", status: res.status, json };
  } catch (e: unknown) {
    return { kind: "network-error", error: e instanceof Error ? e.message : "Network error" };
  } finally {
    clearTimeout(timer);
  }
}

function toResult<T>(status: number, json: Record<string, unknown> | unknown[]): ApiResult<T> {
  if (status < 200 || status >= 300) {
    const err = (json as { error?: unknown }).error;
    const message =
      typeof err === "string"
        ? err
        : err && typeof err === "object" && "message" in err
          ? String((err as { message?: unknown }).message)
          : `Request failed (${status})`;
    return { ok: false, error: message };
  }
  // Envelope v2: { ok:true, data, version:2 }
  if (json && typeof json === "object" && "ok" in (json as Record<string, unknown>)) {
    const env = json as { ok: boolean; data?: unknown };
    if (env.ok) return { ok: true, data: (env.data ?? json) as T };
    // shouldn't happen on 2xx but be defensive
    const e = (json as { error?: { message?: string } }).error;
    return { ok: false, error: e?.message ?? "Unknown error" };
  }
  return { ok: true, data: json as T };
}

export async function fetchJson<T = unknown>(
  path: string,
  opts: FetchOpts = {},
): Promise<ApiResult<T>> {
  const storeApiUrl = getStoreApiUrl();
  if (!storeApiUrl) {
    return { ok: false, error: "EXPO_PUBLIC_STORE_API_URL is not configured" };
  }
  const requireAuth = opts.requireAuth ?? true;
  const token = requireAuth ? await getAccessToken() : null;
  if (requireAuth && !token) {
    return { ok: false, error: "Not signed in" };
  }
  const url = `${storeApiUrl}${path.startsWith("/") ? "" : "/"}${path}${buildQuery(opts.query)}`;

  const first = await attemptRequest(url, token, opts);
  if (first.kind === "network-error") {
    return { ok: false, error: first.error };
  }

  // A 401 on an authenticated call likely means the cached access token
  // expired (e.g. the app sat backgrounded past its lifetime, so
  // supabase-js's timer-based auto-refresh never fired). Refresh once and
  // retry with the new token instead of surfacing a confusing auth error.
  if (first.status === 401 && requireAuth) {
    const { data, error } = await refreshSessionOnce();
    const newToken = !error ? (data.session?.access_token ?? null) : null;
    if (newToken && newToken !== token) {
      const retry = await attemptRequest(url, newToken, opts);
      if (retry.kind === "network-error") return { ok: false, error: retry.error };
      return toResult<T>(retry.status, retry.json);
    }
  }

  return toResult<T>(first.status, first.json);
}
