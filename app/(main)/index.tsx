import React, { useEffect, useState, useCallback } from "react";
import { ScrollView, RefreshControl, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppHeader, PaperBackground } from "@/components/layout";
import {
  CategoryScroller,
  PromoCarousel,
  ProductRail,
  FeaturedStoresRow,
  FeaturedBrandsRow,
  HomeJournalRail,
  ForYouRail,
  ForYouProductCard,
} from "@/components/home/premium";
import * as api from "@/lib/api";
import {
  getForYouRail,
  refreshForYouRail,
  getRecentlyViewedRail,
  getFromWishlistRail,
  humanReason,
  type ForYouResult,
} from "@/lib/recommender";
import { useAuth } from "@/lib/supabase/auth";
import { useWishlist } from "@/lib/stores";
import type { Banner, BlogPost, Brand, Category, Product, Store } from "@/lib/types";

/** Keep each rail unique — skip products already shown in earlier sections. */
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

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const wishlistItems = useWishlist((s) => s.items);
  const [refreshing, setRefreshing] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [saleProducts, setSaleProducts] = useState<Product[]>([]);
  const [newArrivals, setNewArrivals] = useState<Product[]>([]);
  const [trending, setTrending] = useState<Product[]>([]);
  const [editorsPicks, setEditorsPicks] = useState<Product[]>([]);
  const [todaysEdit, setTodaysEdit] = useState<Product[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [journalPosts, setJournalPosts] = useState<BlogPost[]>([]);
  const [forYou, setForYou] = useState<ForYouResult | null>(null);
  const [forYouLoading, setForYouLoading] = useState(false);
  const [forYouReasons, setForYouReasons] = useState<Record<string, string>>({});
  const [recentlyViewed, setRecentlyViewed] = useState<Product[]>([]);
  const [wishlistRail, setWishlistRail] = useState<{ wishlist: Product[]; companions: Product[] }>({
    wishlist: [],
    companions: [],
  });

  const fetchData = useCallback(async () => {
    const [
      cats,
      heroBanners,
      flash,
      arrivalsRes,
      trendRes,
      picksRes,
      editRes,
      featuredStores,
      featuredBrands,
      blog,
      saleList,
    ] = await Promise.all([
      api.getCategories(12),
      api.getBanners("home_hero"),
      api.getFlashSaleProducts(12),
      api.getHomepageProductPicks("new_arrivals_rail"),
      api.getHomepageProductPicks("trending_rail"),
      api.getHomepageProductPicks("editors_picks_rail"),
      api.getHomepageProductPicks("todays_edit"),
      api.getFeaturedStores(8),
      api.getFeaturedBrands(10),
      api.getFeaturedBlogPosts(6),
      api.getProducts({ limit: 12, sort: "sale" }),
    ]);

    setCategories(cats.ok ? cats.data : []);
    setBanners(heroBanners.ok ? heroBanners.data : []);
    const sale =
      flash.ok && flash.data.length
        ? flash.data
        : saleList.ok
          ? saleList.data.products
          : [];
    const arrivals = arrivalsRes.ok ? arrivalsRes.data : [];
    const trend = trendRes.ok ? trendRes.data : [];
    const picks = picksRes.ok ? picksRes.data : [];
    const edit = editRes.ok ? editRes.data : [];

    const [dedupedSale, dedupedArrivals, dedupedTrending, dedupedPicks, dedupedEdit] =
      dedupeProductRails(sale, arrivals, trend, picks, edit);

    setSaleProducts(dedupedSale);
    setNewArrivals(dedupedArrivals);
    setTrending(dedupedTrending);
    setEditorsPicks(dedupedPicks);
    setTodaysEdit(dedupedEdit);
    setStores(featuredStores.ok ? featuredStores.data : []);
    setBrands(featuredBrands.ok ? featuredBrands.data : []);
    setJournalPosts(blog.ok ? blog.data : []);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Load personalized "For you" rail.
  const fetchForYou = useCallback(async () => {
    setForYouLoading(true);
    const res = await getForYouRail(user?.id ?? null, 10);
    if (res.ok) {
      setForYou(res.data);
      // Compute "why" reasons client-side.
      const reasons: Record<string, string> = {};
      res.data.products.forEach((p, i) => {
        // Lightweight reason inference — full profile-based reasons come
        // from the ranker but the engine returned products only.
        const salePct = p.mrp > p.price ? Math.round(((p.mrp - p.price) / p.mrp) * 100) : 0;
        if (salePct >= 30) reasons[p.id] = `${salePct}% off`;
        else if ((p.rating ?? 0) >= 4.5) reasons[p.id] = "Top rated";
        else if (i === 0) reasons[p.id] = "Best match";
        else if ((p.total_sales ?? 0) > 200) reasons[p.id] = "Popular pick";
      });
      setForYouReasons(reasons);
    }
    setForYouLoading(false);
  }, [user?.id]);

  useEffect(() => {
    fetchForYou();
  }, [fetchForYou]);

  // Recently viewed rail.
  const fetchRecently = useCallback(async () => {
    const res = await getRecentlyViewedRail(user?.id ?? null, 8);
    if (res.ok) setRecentlyViewed(res.data);
  }, [user?.id]);

  useEffect(() => {
    fetchRecently();
  }, [fetchRecently]);

  // Wishlist rail.
  const fetchWishlist = useCallback(async () => {
    const ids = Object.keys(wishlistItems);
    if (ids.length === 0) {
      setWishlistRail({ wishlist: [], companions: [] });
      return;
    }
    const res = await getFromWishlistRail(user?.id ?? null, ids, 6);
    if (res.ok) setWishlistRail(res.data);
  }, [user?.id, wishlistItems]);

  useEffect(() => {
    fetchWishlist();
  }, [fetchWishlist]);

  const handleRefreshForYou = useCallback(async () => {
    setForYouLoading(true);
    const res = await refreshForYouRail(user?.id ?? null, 10);
    if (res.ok) setForYou(res.data);
    setForYouLoading(false);
  }, [user?.id]);

  const onRefreshAll = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchData(), fetchForYou(), fetchRecently(), fetchWishlist()]);
    setRefreshing(false);
  }, [fetchData, fetchForYou, fetchRecently, fetchWishlist]);

  return (
    <PaperBackground>
      <AppHeader showSearch />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefreshAll} />}
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 24 },
        ]}
      >
        <CategoryScroller categories={categories} />
        <PromoCarousel banners={banners} />

        {forYou?.products?.length || forYouLoading ? (
          <ForYouRail
            title={forYou?.hasSignal ? "Recommended for you" : "Trending in the Edit"}
            products={forYou?.products ?? []}
            hasSignal={forYou?.hasSignal ?? false}
            loading={forYouLoading}
            onRefresh={handleRefreshForYou}
            onSeeAll={() => router.push("/(main)/products?sort=newest")}
          />
        ) : null}

        {wishlistRail.wishlist.length > 0 ? (
          <>
            <ProductRail
              kicker="From your wishlist"
              title="Saved for you"
              products={wishlistRail.wishlist}
              showSaleBadge
              onSeeAll={() => router.push("/(main)/wishlist")}
            />
            {wishlistRail.companions.length > 0 ? (
              <ProductRail
                kicker="Pairs with your saves"
                title="You might also like these"
                products={wishlistRail.companions}
                showSaleBadge
                onSeeAll={() => router.push("/(main)/products?sort=newest")}
              />
            ) : null}
          </>
        ) : null}

        <ProductRail
          title="On sale"
          products={saleProducts}
          showSaleBadge
          onSeeAll={() => router.push("/(main)/products?sort=sale")}
        />
        <ProductRail
          title="New arrivals"
          products={newArrivals}
          showSaleBadge={false}
          onSeeAll={() => router.push("/(main)/products?sort=newest")}
        />
        {recentlyViewed.length > 0 ? (
          <ProductRail
            kicker="Pick up where you left off"
            title="Recently viewed"
            products={recentlyViewed}
            showSaleBadge={false}
            onSeeAll={() => router.push("/(main)/products?sort=newest")}
          />
        ) : null}
        <FeaturedStoresRow stores={stores} />
        <ProductRail
          title="Trending now"
          products={trending}
          showSaleBadge={false}
          onSeeAll={() => router.push("/(main)/products?sort=rating")}
        />
        <ProductRail
          title="Editor's picks"
          products={editorsPicks}
          showSaleBadge={false}
          onSeeAll={() => router.push("/(main)/products?sort=price_desc")}
        />
        <ProductRail
          title="Today's edit"
          products={todaysEdit}
          showSaleBadge={false}
          onSeeAll={() => router.push("/(main)/products?sort=newest")}
        />
        <FeaturedBrandsRow brands={brands} />
        <HomeJournalRail posts={journalPosts} />
      </ScrollView>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingTop: 4,
  },
});
