/**
 * Mobile product routes — typed wrappers over the Hono backend's
 * `/api/catalog/products` (public reads) and `/api/brand/products`
 * (brand-owner writes).
 *
 * Auth-optional: anonymous users can browse the catalogue. Brand writes
 * require a brand_owner (or admin) session.
 *
 * Use this alongside the existing Supabase-direct helpers in
 * `lib/api/index.ts` (`getProducts`, `getProductBySlug`) when you want
 * the same shape the web app receives — useful for parity testing and
 * for components that need the backend's envelope-handled responses.
 */

import { supabase } from "@/lib/supabase/client";
import type { Product } from "@/lib/types";
import { getStoreApiUrl } from "./_fetch";

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function getAccessToken(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

async function fetchJson<T>(
  path: string,
  init: RequestInit & { requireAuth?: boolean } = {},
): Promise<ApiResult<T>> {
  const storeApiUrl = getStoreApiUrl();
  if (!storeApiUrl) {
    return { ok: false, error: "EXPO_PUBLIC_STORE_API_URL is not configured" };
  }
  const { requireAuth, headers, ...rest } = init;
  const token = await getAccessToken();
  if (requireAuth && !token) {
    return { ok: false, error: "Not signed in" };
  }
  try {
    const res = await fetch(`${storeApiUrl}${path}`, {
      ...rest,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(headers ?? {}),
      },
    });
    const json = await res.json().catch(() => ({}));
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
    const env = json as { ok?: boolean; data?: unknown };
    if (env && typeof env === "object" && "ok" in env && env.ok) {
      return { ok: true, data: (env.data ?? json) as T };
    }
    return { ok: true, data: json as T };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }
}

// ---------------------------------------------------------------------------
// Public catalog reads (no auth required)
// ---------------------------------------------------------------------------

export type CatalogProduct = Product;

export type CatalogListResponse = {
  count: number;
  limit: number;
  offset: number;
  products: CatalogProduct[];
};

export async function getProductsApi(opts: {
  brand?: string;
  store?: string;
  category?: string;
  search?: string;
  sort?: "newest" | "price_asc" | "price_desc" | "rating" | "popularity";
  limit?: number;
  offset?: number;
} = {}): Promise<ApiResult<CatalogListResponse>> {
  const params = new URLSearchParams();
  if (opts.brand) params.set("brand", opts.brand);
  if (opts.store) params.set("store", opts.store);
  if (opts.category) params.set("category", opts.category);
  if (opts.search) params.set("search", opts.search);
  if (opts.sort) params.set("sort", opts.sort);
  if (opts.limit !== undefined) params.set("limit", String(opts.limit));
  if (opts.offset !== undefined) params.set("offset", String(opts.offset));
  const qs = params.toString();
  return fetchJson<CatalogListResponse>(
    `/api/catalog/products${qs ? `?${qs}` : ""}`,
  );
}

export async function getProductApi(id: string): Promise<ApiResult<{ product: CatalogProduct }>> {
  return fetchJson<{ product: CatalogProduct }>(`/api/catalog/products/${id}`);
}

export async function getProductBySlugApi(
  slug: string,
): Promise<ApiResult<{ product: CatalogProduct }>> {
  return fetchJson<{ product: CatalogProduct }>(`/api/catalog/products/slug/${slug}`);
}

// ---------------------------------------------------------------------------
// Brand portal writes (brand_owner/admin only)
// ---------------------------------------------------------------------------

export type BrandProductInput = {
  name: string;
  description?: string;
  category_id?: string;
  store_id?: string;
  sku?: string;
  price: number;
  mrp?: number;
  currency?: string;
  status?: "draft" | "active" | "archived";
  images?: Array<{ url: string; is_primary?: boolean }>;
  variants?: Array<{
    sku: string;
    size?: string;
    color?: string;
    price: number;
    mrp?: number;
    inventory?: number;
  }>;
};

export type BrandProductPatch = Partial<BrandProductInput>;

export async function listBrandProductsApi(): Promise<
  ApiResult<{ products: Array<{ id: string; name: string; sku?: string; price: number; status: string }> }>
> {
  return fetchJson(`/api/brand/products`, { requireAuth: true });
}

export async function createBrandProductApi(
  input: BrandProductInput,
): Promise<ApiResult<{ product: CatalogProduct }>> {
  return fetchJson<{ product: CatalogProduct }>(`/api/brand/products`, {
    method: "POST",
    body: JSON.stringify(input),
    requireAuth: true,
  });
}

export async function patchBrandProductApi(
  id: string,
  patch: BrandProductPatch,
): Promise<ApiResult<{ product: CatalogProduct }>> {
  return fetchJson<{ product: CatalogProduct }>(`/api/brand/products/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
    requireAuth: true,
  });
}
