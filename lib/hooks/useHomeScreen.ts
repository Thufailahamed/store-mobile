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
import type { Banner, BlogPost, Brand, Category, Product, Store } from "@/lib/types";

export const HOME_QUERY_ROOT = ["home"] as const;

export interface HomeCatalogPrimary {
  categories: Category[];
  banners: Banner[];
  saleProducts: Product[];
  newArrivals: Product[];
}

export interface HomeCatalogExtended {
  trending: Product[];
  editorsPicks: Product[];
  todaysEdit: Product[];
  stores: Store[];
  brands: Brand[];
  journalPosts: BlogPost[];
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
    api.getFlashSaleProducts(12),
    api.getHomepageProductPicks("new_arrivals_rail"),
  ]);

  const sale = flash.ok && flash.data.length ? flash.data : [];
  const arrivals = arrivalsRes.ok ? arrivalsRes.data : [];
  const [dedupedSale, dedupedArrivals] = dedupeProductRails(sale, arrivals);

  return {
    categories: cats.ok ? cats.data : [],
    banners: heroBanners.ok ? heroBanners.data : [],
    saleProducts: dedupedSale,
    newArrivals: dedupedArrivals,
  };
}

export async function fetchHomeCatalogExtended(): Promise<HomeCatalogExtended> {
  const [trendRes, picksRes, editRes, featuredStores, featuredBrands, blog] =
    await Promise.all([
      api.getHomepageProductPicks("trending_rail"),
      api.getHomepageProductPicks("editors_picks_rail"),
      api.getHomepageProductPicks("todays_edit"),
      api.getFeaturedStores(8),
      api.getFeaturedBrands(10),
      api.getFeaturedBlogPosts(6),
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
      trending: catalogExtended.data?.trending ?? [],
      editorsPicks: catalogExtended.data?.editorsPicks ?? [],
      todaysEdit: catalogExtended.data?.todaysEdit ?? [],
      stores: catalogExtended.data?.stores ?? [],
      brands: catalogExtended.data?.brands ?? [],
      journalPosts: catalogExtended.data?.journalPosts ?? [],
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
