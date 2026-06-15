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
  TrustStrip,
} from "@/components/home/premium";
import * as api from "@/lib/api";
import type { Banner, Category, Product, Store } from "@/lib/types";

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [saleProducts, setSaleProducts] = useState<Product[]>([]);
  const [newArrivals, setNewArrivals] = useState<Product[]>([]);
  const [trending, setTrending] = useState<Product[]>([]);
  const [stores, setStores] = useState<Store[]>([]);

  const fetchData = useCallback(async () => {
    const [cats, heroBanners, flash, arrivals, trend, featuredStores, saleList] =
      await Promise.all([
        api.getCategories(12),
        api.getBanners("home_hero"),
        api.getFlashSaleProducts(12),
        api.getHomepageProductPicks("new_arrivals_rail"),
        api.getHomepageProductPicks("trending_rail"),
        api.getFeaturedStores(8),
        api.getProducts({ limit: 12, sort: "sale" }),
      ]);

    setCategories(cats.ok ? cats.data : []);
    setBanners(heroBanners.ok ? heroBanners.data : []);
    setSaleProducts(
      flash.ok && flash.data.length
        ? flash.data
        : saleList.ok
          ? saleList.data.products
          : []
    );
    setNewArrivals(arrivals.ok ? arrivals.data : []);
    setTrending(trend.ok ? trend.data : []);
    setStores(featuredStores.ok ? featuredStores.data : []);
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
        <TrustStrip />
      </ScrollView>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingTop: 4,
  },
});
