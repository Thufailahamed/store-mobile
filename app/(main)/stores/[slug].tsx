import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Share,
  RefreshControl,
} from "react-native";
import { useRouter, useLocalSearchParams, Stack } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PaperBackground } from "@/components/layout";
import { Display, Body } from "@/components/ui/Typography";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import {
  StorePageHeader,
  StoreIdentityCard,
  StoreTabBar,
  StoreProductsSection,
  StoreReviewsSection,
  type StoreTab,
  type StoreProductSort,
} from "@/components/store";
import { colors, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { useAuth } from "@/lib/supabase/auth";
import {
  getStoreBySlug,
  getStoreById,
  getStoreProducts,
  getStoreReviewsList,
  toggleFollowStore,
  isFollowingStore,
} from "@/lib/api/stores";
import { navigateHome } from "@/lib/navigation";
import type { Product, Review, Store } from "@/lib/types";

export default function StoreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ slug?: string | string[]; id?: string | string[] }>();
  const slug = useMemo(() => {
    const raw = params.slug;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [params.slug]);
  const storeId = useMemo(() => {
    const raw = params.id;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [params.id]);
  const { user } = useAuth();
  const { toast } = useToast();

  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<StoreTab>("featured");
  const [sort, setSort] = useState<StoreProductSort>("newest");
  const [products, setProducts] = useState<Product[]>([]);
  const [productTotal, setProductTotal] = useState(0);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [avgRating, setAvgRating] = useState(0);
  const [reviewTotal, setReviewTotal] = useState(0);
  const [ratingBreakdown, setRatingBreakdown] = useState<Record<number, number>>({
    5: 0, 4: 0, 3: 0, 2: 0, 1: 0,
  });
  const [following, setFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);

  const fetchAll = useCallback(async () => {
    if (!slug && !storeId) {
      setLoading(false);
      return;
    }

    let storeRes = slug ? await getStoreBySlug(slug) : { ok: false as const, error: "Missing slug" };
    if ((!storeRes.ok || !storeRes.data) && storeId) {
      storeRes = await getStoreById(storeId);
    }

    if (storeRes.ok && storeRes.data) {
      setStore(storeRes.data);
      setFollowerCount(storeRes.data.total_followers ?? 0);
      const [r, follow] = await Promise.all([
        getStoreReviewsList(storeRes.data.id, { limit: 30 }),
        isFollowingStore(storeRes.data.id),
      ]);
      if (r.ok) {
        setReviews(r.data.reviews);
        setAvgRating(r.data.avgRating);
        setReviewTotal(r.data.total);
        setRatingBreakdown(r.data.ratingBreakdown);
      }
      setFollowing(follow);
    } else {
      setStore(null);
    }
    setLoading(false);
  }, [slug, storeId]);

  const fetchProducts = useCallback(async () => {
    const storeSlug = slug ?? store?.slug;
    if (!storeSlug) return;
    setLoadingProducts(true);
    const res = await getStoreProducts(storeSlug, { sort, limit: 30, offset: 0 });
    if (res.ok) {
      setProducts(res.data.products);
      setProductTotal(res.data.total);
    }
    setLoadingProducts(false);
  }, [slug, store?.slug, sort]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (store?.slug || slug) fetchProducts();
  }, [fetchProducts, store?.slug, slug]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchAll(), fetchProducts()]);
    setRefreshing(false);
  }, [fetchAll, fetchProducts]);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else navigateHome(router);
  }, [router]);

  const handleShare = useCallback(async () => {
    if (!store) return;
    try {
      await Share.share({
        message: `Discover ${store.name} on LUXE — handpicked pieces from this boutique.`,
        url: `luxe://store/${store.slug}`,
      });
    } catch {
      /* user cancelled */
    }
  }, [store]);

  const handleToggleFollow = useCallback(async () => {
    if (!store) return;
    if (!user) {
      toast("Sign in to follow boutiques", "info");
      router.push("/(auth)/login");
      return;
    }
    const res = await toggleFollowStore(store.id);
    if (res.ok) {
      setFollowing(res.data.following);
      setFollowerCount((c) => c + (res.data.following ? 1 : -1));
      toast(res.data.following ? `Following ${store.name}` : "Unfollowed", "success");
    } else {
      toast(res.error, "error");
    }
  }, [store, user, toast, router]);

  const showProducts = tab === "featured" || tab === "products";

  if (loading) {
    return (
      <PaperBackground>
        <Stack.Screen options={{ headerShown: false }} />
        <StorePageHeader onBack={handleBack} onShare={() => {}} />
        <View style={styles.loadingBody}>
          <Skeleton width={140} height={24} borderRadius={12} style={{ alignSelf: "center" }} />
          <Skeleton width="60%" height={36} borderRadius={8} style={{ alignSelf: "center" }} />
          <Skeleton width="45%" height={18} borderRadius={6} style={{ alignSelf: "center" }} />
          <Skeleton height={88} borderRadius={20} style={{ marginTop: spacing[2] }} />
          <Skeleton height={50} borderRadius={25} />
          <View style={{ flexDirection: "row", gap: spacing[2], marginTop: spacing[2] }}>
            <Skeleton height={40} borderRadius={20} style={{ flex: 1 }} />
            <Skeleton height={40} borderRadius={20} style={{ flex: 1 }} />
            <Skeleton height={40} borderRadius={20} style={{ flex: 1 }} />
          </View>
          <View style={{ flexDirection: "row", gap: spacing[2], marginTop: spacing[4] }}>
            <Skeleton height={200} borderRadius={18} style={{ flex: 1 }} />
            <Skeleton height={200} borderRadius={18} style={{ flex: 1 }} />
          </View>
        </View>
      </PaperBackground>
    );
  }

  if (!store) {
    return (
      <PaperBackground>
        <Stack.Screen options={{ headerShown: false }} />
        <StorePageHeader onBack={handleBack} onShare={() => {}} />
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Ionicons name="storefront-outline" size={36} color={colors.olive[600]} />
          </View>
          <Display size="2xl" style={styles.emptyTitle}>Boutique not found</Display>
          <Body size="sm" muted style={styles.emptyBody}>
            The boutique you are looking for may have closed or moved.
          </Body>
          <Button variant="brand" onPress={() => navigateHome(router)}>
            Browse home
          </Button>
        </View>
      </PaperBackground>
    );
  }

  return (
    <PaperBackground>
      <Stack.Screen options={{ headerShown: false }} />
      <StorePageHeader onBack={handleBack} onShare={handleShare} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.olive[600]} />
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        <StoreIdentityCard
          store={store}
          following={following}
          followerCount={followerCount}
          avgRating={avgRating}
          onToggleFollow={handleToggleFollow}
        />

        <StoreTabBar
          active={tab}
          onChange={setTab}
          productCount={productTotal}
          reviewCount={reviewTotal}
        />

        {showProducts ? (
          <StoreProductsSection
            products={products}
            total={productTotal}
            sort={sort}
            onSortChange={setSort}
            loading={loadingProducts}
            storeName={store.name}
          />
        ) : null}

        {tab === "reviews" ? (
          <StoreReviewsSection
            reviews={reviews}
            avg={avgRating}
            total={reviewTotal}
            breakdown={ratingBreakdown}
          />
        ) : null}
      </ScrollView>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  loadingBody: {
    padding: spacing[5],
    gap: spacing[3],
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[20],
    gap: spacing[3],
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.olive[50],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing[3],
  },
  emptyTitle: {
    fontFamily: fontFamilies.display.regular,
    color: colors.light.foreground,
  },
  emptyBody: {
    textAlign: "center",
    marginBottom: spacing[4],
  },
});
