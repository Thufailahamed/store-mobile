import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase/client";
import type { Product, Review, Store } from "@/lib/types";
import { mapStore } from "@/lib/api/product-mapper";
import { getProducts as fetchProducts, getStoreReviews as fetchStoreReviews } from "@/lib/api";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };
const ok = <T>(data: T): Result<T> => ({ ok: true, data });
const fail = (e: string): Result<never> => ({ ok: false, error: e });

const FOLLOWED_KEY = "@luxe/followed-stores/v1";

async function readFollowed(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(FOLLOWED_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

async function writeFollowed(set: Set<string>): Promise<void> {
  try {
    await AsyncStorage.setItem(FOLLOWED_KEY, JSON.stringify(Array.from(set)));
  } catch {
    /* swallow — non-fatal */
  }
}

export async function getLocallyFollowedStoreIds(): Promise<string[]> {
  const set = await readFollowed();
  return Array.from(set);
}

/** @deprecated Use getLocallyFollowedStoreIds */
export async function getFollowedStores(): Promise<string[]> {
  return getLocallyFollowedStoreIds();
}

export async function isFollowingStore(storeId: string): Promise<boolean> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (userId) {
    const { data } = await supabase
      .from("followers")
      .select("id")
      .eq("user_id", userId)
      .eq("store_id", storeId)
      .maybeSingle();
    if (data) return true;
  }
  const set = await readFollowed();
  return set.has(storeId);
}

export async function toggleFollowStore(
  storeId: string,
): Promise<Result<{ following: boolean; followers: number }>> {
  try {
    const set = await readFollowed();
    const wasFollowing = set.has(storeId);
    if (wasFollowing) set.delete(storeId);
    else set.add(storeId);
    await writeFollowed(set);

    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (userId) {
      if (wasFollowing) {
        await supabase
          .from("followers")
          .delete()
          .eq("user_id", userId)
          .eq("store_id", storeId);
      } else {
        await supabase
          .from("followers")
          .insert({ user_id: userId, store_id: storeId });
      }
    }

    const res = await supabase
      .from("stores")
      .select("total_followers")
      .eq("id", storeId)
      .maybeSingle();
    const base = (res.data?.total_followers as number | undefined) ?? 0;
    return ok({ following: !wasFollowing, followers: base });
  } catch (e: any) {
    return fail(e?.message ?? "Failed to update follow state");
  }
}

import { isOperationalStoreStatus } from "@/lib/catalog-visibility";

function isPublicStoreStatus(status: string | null | undefined) {
  return isOperationalStoreStatus(status);
}

export async function getStoreBySlug(slug: string): Promise<Result<Store | null>> {
  try {
    const normalized = decodeURIComponent(slug).trim();
    if (!normalized) return ok(null);

    const { data, error } = await supabase
      .from("stores")
      .select("*")
      .eq("slug", normalized)
      .maybeSingle();

    if (error) return fail(error.message);
    if (data && isPublicStoreStatus(data.status)) {
      return ok(mapStore(data as Store));
    }

    // Case or encoding mismatch — try case-insensitive slug match
    const { data: fuzzy, error: fuzzyError } = await supabase
      .from("stores")
      .select("*")
      .ilike("slug", normalized)
      .limit(1);

    if (fuzzyError) return fail(fuzzyError.message);
    const match = fuzzy?.[0];
    if (match && isPublicStoreStatus(match.status)) {
      return ok(mapStore(match as Store));
    }

    return ok(null);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch store");
  }
}

export async function getStoreById(id: string): Promise<Result<Store | null>> {
  try {
    if (!id) return ok(null);
    const { data, error } = await supabase
      .from("stores")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) return fail(error.message);
    if (!data || !isPublicStoreStatus(data.status)) return ok(null);
    return ok(mapStore(data as Store));
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch store");
  }
}

export async function getStoreProducts(
  storeSlug: string,
  opts: { sort?: "newest" | "rating" | "sale" | "price_asc" | "price_desc"; limit?: number; offset?: number } = {},
): Promise<Result<{ products: Product[]; total: number }>> {
  return fetchProducts({
    storeSlug,
    sort: opts.sort ?? "newest",
    limit: opts.limit ?? 20,
    offset: opts.offset ?? 0,
  });
}

export async function getStoreReviewsList(
  storeId: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<Result<{ reviews: Review[]; total: number; avgRating: number; ratingBreakdown: Record<number, number> }>> {
  return fetchStoreReviews(storeId, { limit: opts.limit ?? 30, offset: opts.offset ?? 0 });
}
