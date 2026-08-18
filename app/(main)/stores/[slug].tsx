import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Share,
  Pressable,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PaperBackground } from "@/components/layout";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { Display, Body } from "@/components/ui/Typography";
import { Ionicons } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/supabase/auth";
import { StorePageHeader } from "@/components/store";
import {
  getStoreBySlug,
  getStoreProducts,
  getStoreReviewsList,
  toggleFollowStore,
  isFollowingStore,
} from "@/lib/api/stores";
import { navigateHome } from "@/lib/navigation";
import { colors, spacing } from "@/lib/theme/tokens";
import type { Product, Review, Store } from "@/lib/types";
import StoreStorefrontScreen from "@/src/screens/StoreStorefront";
import { useStorefrontContext } from "@/src/screens/StoreStorefront/hooks/useStorefrontContext";
import { usePublishedConfig } from "@/src/screens/StoreStorefront/hooks/usePublishedConfig";

/**
 * Customer-facing store page (mobile app channel).
 *
 * Top: the seller's published app-channel config, rendered through the
 * shared `@luxe/store-storefront` RN renderer. This is what changes when
 * the seller hits Publish on the web dashboard — realtime pushes through
 * `usePublishedConfig` invalidate the cached config and the renderer
 * re-mounts with the new sections/theme within ~200ms.
 *
 * Bottom: the functional page bits every customer expects — store name,
 * follow button, share, sortable product list, reviews. These are not in
 * the seller's config (they're app-level concerns), so they live outside
 * the renderer.
 */
export default function StoreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ slug?: string | string[] }>();
  const slug = useMemo(() => {
    const raw = params.slug;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [params.slug]);
  const { user } = useAuth();
  const { toast } = useToast();

  const ctx = useStorefrontContext(slug ?? "");
  const published = usePublishedConfig(slug ?? "");

  const [following, setFollowing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<"products" | "reviews">("products");
  const [sort, setSort] = useState<"newest" | "price_asc" | "price_desc" | "sale">("newest");
  const [products, setProducts] = useState<Product[]>([]);
  const [productTotal, setProductTotal] = useState(0);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [avgRating, setAvgRating] = useState(0);
  const [reviewTotal, setReviewTotal] = useState(0);
  const [ratingBreakdown, setRatingBreakdown] = useState<Record<number, number>>({
    5: 0, 4: 0, 3: 0, 2: 0, 1: 0,
  });

  const store = ctx.store;

  const fetchProducts = useCallback(async () => {
    if (!slug) return;
    const r = await getStoreProducts(slug, { sort, limit: 30, offset: 0 });
    if (r.ok) {
      setProducts(r.data.products);
      setProductTotal(r.data.total);
    }
  }, [slug, sort]);

  const fetchReviews = useCallback(async () => {
    if (!store?.id) return;
    const r = await getStoreReviewsList(store.id, { limit: 30 });
    if (r.ok) {
      setReviews(r.data.reviews);
      setAvgRating(r.data.avgRating);
      setReviewTotal(r.data.total);
      setRatingBreakdown(r.data.ratingBreakdown);
    }
  }, [store?.id]);

  useEffect(() => {
    void fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    void fetchReviews();
  }, [fetchReviews]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([ctx.refetch(), fetchProducts(), fetchReviews()]);
    setRefreshing(false);
  }, [ctx, fetchProducts, fetchReviews]);

  useEffect(() => {
    if (!store?.id) return;
    void isFollowingStore(store.id).then(setFollowing);
  }, [store?.id]);

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
      toast(res.data.following ? `Following ${store.name}` : "Unfollowed", "success");
    } else {
      toast(res.error, "error");
    }
  }, [store, user, toast, router]);

  if (!slug) {
    return (
      <PaperBackground>
        <Stack.Screen options={{ headerShown: false }} />
        <StorePageHeader onBack={handleBack} onShare={() => {}} />
        <View style={styles.empty}>
          <Display size="2xl">Boutique not found</Display>
          <Button variant="brand" onPress={() => navigateHome(router)}>Browse home</Button>
        </View>
      </PaperBackground>
    );
  }

  const isLoadingConfig = published.isLoading || ctx.isLoading;

  return (
    <PaperBackground>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing || published.isFetching}
            onRefresh={onRefresh}
            tintColor={colors.olive[600]}
          />
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        {/* Seller-customised sections (real-time on publish) */}
        {isLoadingConfig ? (
          <View style={styles.skeletonWrap}>
            <Skeleton height={300} borderRadius={0} />
            <View style={styles.skeletonBody}>
              <Skeleton width={140} height={24} borderRadius={12} />
              <Skeleton width="80%" height={36} borderRadius={8} />
              <Skeleton width="60%" height={18} borderRadius={6} />
              <Skeleton height={200} borderRadius={18} style={{ marginTop: spacing[3] }} />
            </View>
          </View>
        ) : published.error || !published.data?.config ? (
          <View style={styles.configError}>
            <Ionicons name="cloud-offline-outline" size={32} color={colors.olive[600]} />
            <Body size="sm" muted>Customised sections couldn't load.</Body>
            <Button variant="outline" onPress={() => { published.refetch(); ctx.refetch(); }}>
              Retry
            </Button>
          </View>
        ) : (
          <StoreStorefrontScreen slug={slug} />
        )}

        {/* Functional bits that live below the renderer */}
        {store ? (
          <View style={styles.identityCard}>
            <View style={styles.identityHeader}>
              <View style={{ flex: 1 }}>
                <Body size="xs" muted style={{ marginBottom: 2 }}>BOUTIQUE</Body>
                <Display size="xl">{store.name}</Display>
                {store.description ? (
                  <Body size="sm" muted style={{ marginTop: spacing[1] }}>
                    {store.description}
                  </Body>
                ) : null}
              </View>
              <Pressable onPress={handleToggleFollow} style={styles.followBtn} hitSlop={8}>
                <Ionicons
                  name={following ? "heart" : "heart-outline"}
                  size={20}
                  color={following ? colors.olive[700] : colors.light.foreground}
                />
                <Body size="sm" style={following ? styles.followingText : undefined}>
                  {following ? "Following" : "Follow"}
                </Body>
              </Pressable>
            </View>

            <View style={styles.tabBar}>
              <TabButton
                active={tab === "products"}
                label={`Products (${productTotal})`}
                onPress={() => setTab("products")}
              />
              <TabButton
                active={tab === "reviews"}
                label={`Reviews (${reviewTotal})`}
                onPress={() => setTab("reviews")}
              />
            </View>

            {tab === "products" ? (
              <View style={styles.section}>
                <View style={styles.sortRow}>
                  {(["newest", "price_asc", "price_desc", "sale"] as const).map((s) => (
                    <Pressable
                      key={s}
                      onPress={() => setSort(s)}
                      style={[styles.sortChip, sort === s && styles.sortChipActive]}
                    >
                      <Body size="xs" style={sort === s ? styles.sortChipActiveText : undefined}>
                        {SORT_LABELS[s]}
                      </Body>
                    </Pressable>
                  ))}
                </View>
                {products.length === 0 ? (
                  <Body size="sm" muted>No products yet.</Body>
                ) : (
                  products.map((p) => <ProductRow key={p.id} product={p} />)
                )}
              </View>
            ) : null}

            {tab === "reviews" ? (
              <View style={styles.section}>
                <View style={styles.reviewSummary}>
                  <Display size="2xl">{avgRating.toFixed(1)}</Display>
                  <View style={styles.stars}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Ionicons
                        key={n}
                        name={n <= Math.round(avgRating) ? "star" : "star-outline"}
                        size={14}
                        color={colors.olive[700]}
                      />
                    ))}
                  </View>
                  <Body size="xs" muted>{reviewTotal} reviews</Body>
                </View>
                {reviews.length === 0 ? (
                  <Body size="sm" muted>No reviews yet.</Body>
                ) : (
                  reviews.map((r) => (
                    <View key={r.id} style={styles.reviewRow}>
                      <Body size="sm">{r.title}</Body>
                      <Body size="sm" muted style={{ marginTop: spacing[1] }}>{r.content}</Body>
                      <Body size="xs" muted style={{ marginTop: spacing[2] }}>
                        {r.user?.full_name ?? "Customer"} · {new Date(r.created_at).toLocaleDateString()}
                      </Body>
                    </View>
                  ))
                )}
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </PaperBackground>
  );
}

function TabButton({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.tab, active && styles.tabActive]}>
      <Body size="sm" style={active ? styles.tabActiveText : undefined}>
        {label}
      </Body>
    </Pressable>
  );
}

function ProductRow({ product }: { product: Product }) {
  const router = useRouter();
  return (
    <Pressable
      style={styles.productRow}
      onPress={() => router.push(`/(main)/products/${product.id}` as never)}
    >
      <View style={{ flex: 1 }}>
        <Body size="sm">{product.name}</Body>
        <Body size="xs" muted>{String(product.product_type ?? "")}</Body>
      </View>
      <Body size="sm">
        {product.price?.toLocaleString() ?? "—"} LKR
      </Body>
    </Pressable>
  );
}

const SORT_LABELS: Record<"newest" | "price_asc" | "price_desc" | "sale", string> = {
  newest: "Newest",
  price_asc: "Price ↑",
  price_desc: "Price ↓",
  sale: "On sale",
};

const styles = StyleSheet.create({
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[20],
    gap: spacing[3],
  },
  skeletonWrap: { marginBottom: spacing[3] },
  skeletonBody: { paddingHorizontal: spacing[5], gap: spacing[2], marginTop: spacing[3] },
  configError: {
    padding: spacing[6],
    alignItems: "center",
    gap: spacing[2],
  },
  identityCard: {
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
    marginTop: spacing[2],
  },
  identityHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing[3],
    marginBottom: spacing[4],
  },
  followBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[1],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: 20,
  },
  followingText: { color: colors.olive[700] },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
    marginBottom: spacing[3],
  },
  tab: {
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: { borderBottomColor: colors.olive[700] },
  tabActiveText: { color: colors.olive[700] },
  section: { paddingVertical: spacing[3] },
  sortRow: { flexDirection: "row", gap: spacing[2], marginBottom: spacing[3], flexWrap: "wrap" },
  sortChip: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: 14,
  },
  sortChipActive: { backgroundColor: colors.olive[700], borderColor: colors.olive[700] },
  sortChipActiveText: { color: "#FFF" },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
    gap: spacing[3],
  },
  reviewSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    marginBottom: spacing[3],
  },
  stars: { flexDirection: "row", gap: 2 },
  reviewRow: {
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
});