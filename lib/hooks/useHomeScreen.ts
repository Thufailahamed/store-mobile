import { useEffect, useMemo, useState } from "react";
import { InteractionManager } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@/lib/api";
import {
  getForYouRail,
  refreshForYouRail,
  getRecentlyViewedRail,
  getFromWishlistRail,
  type ForYouResult,
} from "@/lib/recommender";
import {
  getHomeShortcutsBackend,
  getCouponOffersBackend,
  listCouponsBackend,
  type Coupon,
  type CouponOffer,
  type HomeShortcutOccasion,
  type HomeShortcutPriceBand,
} from "@/lib/api/backend";
import type { Banner, BlogPost, Brand, Category, Product, Store } from "@/lib/types";

export const HOME_QUERY_ROOT = ["home"] as const;

export interface HomeCatalogPrimary {
  categories: Category[];
  banners: Banner[];
  saleProducts: Product[];
  newArrivals: Product[];
  flashEndsAt?: string;
}

export interface HomeCatalogExtended {
  trending: Product[];
  editorsPicks: Product[];
  todaysEdit: Product[];
  stores: Store[];
  brands: Brand[];
  journalPosts: BlogPost[];
  topStories: BlogPost[];
  mostLoved: Product[];
  sponsored: Product[];
}

export interface HomeCatalogData extends HomeCatalogPrimary, HomeCatalogExtended {}

function dedupeProductRails(...rails: Product[][]): Product[][] {
  const seen = new Set<string>();
  return rails.map((rail) => {
    const unique: Product[] = [];
    for (const product of rail) {
      if (seen.has(product.id)) continue;
      seen.add(product.id);
      unique.push(product);
    }
    return unique;
  });
}

export async function fetchHomeCatalogPrimary(): Promise<HomeCatalogPrimary> {
  const [cats, heroBanners, flash, arrivalsRes] = await Promise.all([
    api.getCategories(12),
    api.getBanners("home_hero"),
    api.getFlashSaleRail(12),
    api.getHomepageProductPicks("new_arrivals_rail"),
  ]);

  const sale = flash.ok && flash.data.products.length ? flash.data.products : [];
  const arrivals = arrivalsRes.ok ? arrivalsRes.data : [];
  const [dedupedSale, dedupedArrivals] = dedupeProductRails(sale, arrivals);

  return {
    categories: cats.ok ? cats.data : [],
    banners: heroBanners.ok ? heroBanners.data : [],
    saleProducts: dedupedSale,
    newArrivals: dedupedArrivals,
    flashEndsAt: flash.ok ? flash.data.endsAt ?? undefined : undefined,
  };
}

export async function fetchHomeCatalogExtended(): Promise<HomeCatalogExtended> {
  const [
    trendRes,
    picksRes,
    editRes,
    featuredStores,
    featuredBrands,
    blog,
    topStoriesRes,
    mostLovedRes,
    sponsoredRes,
  ] = await Promise.all([
    api.getHomepageProductPicks("trending_rail"),
    api.getHomepageProductPicks("editors_picks_rail"),
    api.getHomepageProductPicks("todays_edit"),
    api.getFeaturedStores(8),
    api.getFeaturedBrands(10),
    api.getFeaturedBlogPosts(6),
    api.getTopStoriesOfWeek(8),
    api.getMostLovedToday(12),
    api.getFeaturedProducts(10),
  ]);

  const trend = trendRes.ok ? trendRes.data : [];
  const picks = picksRes.ok ? picksRes.data : [];
  const edit = editRes.ok ? editRes.data : [];
  const [dedupedTrending, dedupedPicks, dedupedEdit] = dedupeProductRails(
    trend,
    picks,
    edit,
  );

  return {
    trending: dedupedTrending,
    editorsPicks: dedupedPicks,
    todaysEdit: dedupedEdit,
    stores: featuredStores.ok ? featuredStores.data : [],
    brands: featuredBrands.ok ? featuredBrands.data : [],
    journalPosts: blog.ok ? blog.data : [],
    topStories: topStoriesRes.ok ? topStoriesRes.data : [],
    mostLoved: mostLovedRes.ok ? mostLovedRes.data : [],
    sponsored: sponsoredRes.ok ? sponsoredRes.data : [],
  };
}

/** Full catalog fetch — used by tests and manual refresh fallbacks. */
export async function fetchHomeCatalog(): Promise<HomeCatalogData> {
  const [primary, extended] = await Promise.all([
    fetchHomeCatalogPrimary(),
    fetchHomeCatalogExtended(),
  ]);
  return { ...primary, ...extended };
}

export function useHomeCatalogPrimary() {
  return useQuery({
    queryKey: [...HOME_QUERY_ROOT, "catalog", "primary"],
    queryFn: fetchHomeCatalogPrimary,
    staleTime: 60_000,
  });
}

export function useHomeCatalogExtended(enabled: boolean) {
  return useQuery({
    queryKey: [...HOME_QUERY_ROOT, "catalog", "extended"],
    queryFn: fetchHomeCatalogExtended,
    staleTime: 60_000,
    enabled,
  });
}

export function useDeferHomeExtended() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => setReady(true));
    return () => task.cancel();
  }, []);

  return ready;
}

export function useHomeForYou(userId: string | null | undefined) {
  const guestKey = userId ?? "guest";
  return useQuery({
    queryKey: [...HOME_QUERY_ROOT, "for-you", guestKey],
    queryFn: async (): Promise<ForYouResult> => {
      const res = await getForYouRail(userId ?? null, 10);
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
    staleTime: 60_000,
  });
}

export function useHomeRecentlyViewed(
  userId: string | null | undefined,
  enabled: boolean,
) {
  const guestKey = userId ?? "guest";
  return useQuery({
    queryKey: [...HOME_QUERY_ROOT, "recently-viewed", guestKey],
    queryFn: async (): Promise<Product[]> => {
      const res = await getRecentlyViewedRail(userId ?? null, 8);
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
    staleTime: 60_000,
    enabled,
  });
}

export function useHomeWishlistRail(
  userId: string | null | undefined,
  wishlistIdsKey: string,
  enabled: boolean,
) {
  const guestKey = userId ?? "guest";

  return useQuery({
    queryKey: [...HOME_QUERY_ROOT, "wishlist-rail", guestKey, wishlistIdsKey],
    queryFn: async () => {
      if (!wishlistIdsKey) {
        return { wishlist: [] as Product[], companions: [] as Product[] };
      }
      const wishlistIds = wishlistIdsKey.split(",");
      const res = await getFromWishlistRail(userId ?? null, wishlistIds, 6);
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
    staleTime: 60_000,
    enabled: enabled && wishlistIdsKey.length > 0,
  });
}

export function useHomeRefresh() {
  const queryClient = useQueryClient();

  const refreshAll = async () => {
    await queryClient.invalidateQueries({ queryKey: [...HOME_QUERY_ROOT] });
  };

  const refreshForYou = async (userId: string | null | undefined) => {
    const guestKey = userId ?? "guest";
    const res = await refreshForYouRail(userId ?? null, 10);
    if (res.ok) {
      queryClient.setQueryData([...HOME_QUERY_ROOT, "for-you", guestKey], res.data);
    }
    return res;
  };

  return { refreshAll, refreshForYou };
}

export function useHomeScreenData(
  userId: string | null | undefined,
  wishlistIdsKey: string,
) {
  const deferExtended = useDeferHomeExtended();
  const catalogPrimary = useHomeCatalogPrimary();
  const catalogExtended = useHomeCatalogExtended(
    deferExtended && catalogPrimary.isSuccess,
  );
  const forYou = useHomeForYou(userId);
  const recentlyViewed = useHomeRecentlyViewed(userId, deferExtended);
  const wishlistRail = useHomeWishlistRail(userId, wishlistIdsKey, deferExtended);
  const { refreshAll, refreshForYou } = useHomeRefresh();

  const catalogData = useMemo((): HomeCatalogData | undefined => {
    if (!catalogPrimary.data && !catalogExtended.data) return undefined;
    return {
      categories: catalogPrimary.data?.categories ?? [],
      banners: catalogPrimary.data?.banners ?? [],
      saleProducts: catalogPrimary.data?.saleProducts ?? [],
      newArrivals: catalogPrimary.data?.newArrivals ?? [],
      flashEndsAt: catalogPrimary.data?.flashEndsAt,
      trending: catalogExtended.data?.trending ?? [],
      editorsPicks: catalogExtended.data?.editorsPicks ?? [],
      todaysEdit: catalogExtended.data?.todaysEdit ?? [],
      stores: catalogExtended.data?.stores ?? [],
      brands: catalogExtended.data?.brands ?? [],
      journalPosts: catalogExtended.data?.journalPosts ?? [],
      topStories: catalogExtended.data?.topStories ?? [],
      mostLoved: catalogExtended.data?.mostLoved ?? [],
      sponsored: catalogExtended.data?.sponsored ?? [],
    };
  }, [catalogPrimary.data, catalogExtended.data]);

  const catalog = {
    data: catalogData,
    isLoading: catalogPrimary.isLoading,
    isFetching:
      catalogPrimary.isFetching ||
      (deferExtended && catalogExtended.isFetching),
  };

  const isRefreshing =
    catalog.isFetching ||
    forYou.isFetching ||
    recentlyViewed.isFetching ||
    wishlistRail.isFetching;

  return {
    catalog,
    catalogExtended,
    forYou,
    recentlyViewed,
    wishlistRail,
    isRefreshing,
    refreshAll,
    refreshForYou,
  };
}

/** Back-compat alias — returns the fast primary catalog query. */
export function useHomeCatalog() {
  return useHomeCatalogPrimary();
}

/* ---------------------------------------------------------------------------
 * Shop-by-price / shop-by-occasion shortcuts + live offers rail.
 * Both live under HOME_QUERY_ROOT so pull-to-refresh re-fetches them.
 * ------------------------------------------------------------------------- */

export interface HomeShortcuts {
  occasions: HomeShortcutOccasion[];
  priceBands: HomeShortcutPriceBand[];
  /** False when served from the static fallback (no counts/covers). */
  live: boolean;
}

const FALLBACK_PRICE_BANDS: HomeShortcutPriceBand[] = [
  { key: "under-5k", label: "Under 5K", min: 0, max: 5000, count: -1, cover: null },
  { key: "5k-15k", label: "5K – 15K", min: 5000, max: 15000, count: -1, cover: null },
  { key: "15k-50k", label: "15K – 50K", min: 15000, max: 50000, count: -1, cover: null },
  { key: "50k-plus", label: "50K+", min: 50000, max: null, count: -1, cover: null },
];

export function useHomeShortcuts(enabled = true) {
  return useQuery({
    queryKey: [...HOME_QUERY_ROOT, "shortcuts"],
    queryFn: async (): Promise<HomeShortcuts> => {
      const res = await getHomeShortcutsBackend();
      if (res.ok) return { ...res.data, live: true };
      // Older backend without /shortcuts: price bands still work (the
      // grid refines by price client-side too); occasions can't be
      // resolved without the server, so they're hidden.
      return { occasions: [], priceBands: FALLBACK_PRICE_BANDS, live: false };
    },
    staleTime: 10 * 60_000,
    enabled,
  });
}

/** Normalises a raw /api/coupons row into the offers shape (fallback path). */
function couponToOffer(c: Coupon & Record<string, unknown>): CouponOffer {
  return {
    id: c.id,
    code: c.code,
    type: (c.type ?? c.discount_type ?? "fixed") as string,
    scope: (c.scope as string) ?? "platform",
    value: Number(c.value ?? c.discount_value ?? 0),
    min_order_value: Number(c.min_order_value ?? c.min_order_amount ?? 0),
    max_discount: c.max_discount != null ? Number(c.max_discount) : null,
    expires_at: c.expires_at ?? null,
    owner_name: null,
    owner_slug: null,
    owner_kind: c.store_id ? "store" : c.brand_id ? "brand" : null,
  };
}

export function useHomeOffers(enabled = true) {
  return useQuery({
    queryKey: [...HOME_QUERY_ROOT, "offers"],
    queryFn: async (): Promise<CouponOffer[]> => {
      const res = await getCouponOffersBackend();
      if (res.ok) return res.data.offers;
      // Older backend: filter the raw active list down to redeemable-now.
      const raw = await listCouponsBackend();
      if (!raw.ok) return [];
      const now = Date.now();
      return (raw.data.coupons as Array<Coupon & Record<string, unknown>>)
        .filter((c) => {
          const starts = c.starts_at ? Date.parse(String(c.starts_at)) : 0;
          const ends = c.expires_at ? Date.parse(c.expires_at) : Infinity;
          const limit = c.usage_limit ?? c.max_uses;
          const exhausted = limit != null && (c.used_count ?? 0) >= limit;
          // Only admin-curated coupons belong on the home rail — the flag
          // is absent on rows from older backends, which correctly hides them.
          return c.show_on_home === true && c.is_active && starts <= now && ends > now && !exhausted;
        })
        .map(couponToOffer)
        .slice(0, 12);
    },
    staleTime: 2 * 60_000,
    enabled,
  });
}
