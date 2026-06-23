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

import { supabase } from "@/lib/supabase/client";

const STORE_API_URL = (process.env.EXPO_PUBLIC_STORE_API_URL ?? "").replace(/\/$/, "");

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function getAccessToken(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

export async function hasStoreApi(): Promise<boolean> {
  return STORE_API_URL.length > 0;
}

export function getStoreApiUrl(): string {
  return STORE_API_URL;
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

export async function fetchJson<T = unknown>(
  path: string,
  opts: FetchOpts = {},
): Promise<ApiResult<T>> {
  if (!STORE_API_URL) {
    return { ok: false, error: "EXPO_PUBLIC_STORE_API_URL is not configured" };
  }
  const requireAuth = opts.requireAuth ?? true;
  const token = await getAccessToken();
  if (requireAuth && !token) {
    return { ok: false, error: "Not signed in" };
  }
  const url = `${STORE_API_URL}${path.startsWith("/") ? "" : "/"}${path}${buildQuery(opts.query)}`;
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
    clearTimeout(timer);
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown> | unknown[];
    if (!res.ok) {
      const err = (json as { error?: unknown }).error;
      const message =
        typeof err === "string"
          ? err
          : err && typeof err === "object" && "message" in err
            ? String((err as { message?: unknown }).message)
            : `Request failed (${res.status})`;
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
  } catch (e: unknown) {
    clearTimeout(timer);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Network error",
    };
  }
}
