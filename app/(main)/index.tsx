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
} from "@/components/home/premium";
import * as api from "@/lib/api";
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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  return (
    <PaperBackground>
      <AppHeader showSearch />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 24 },
        ]}
      >
        <CategoryScroller categories={categories} />
        <PromoCarousel banners={banners} />
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
