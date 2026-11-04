import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Share,
  Pressable,
  TouchableOpacity,
  Animated,
  Linking,
  type LayoutChangeEvent,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { PaperBackground } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import { Ionicons } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAuth } from "@/lib/supabase/auth";
import { StorePageHeader, StoreReviewsSection } from "@/components/store";
import { StoreShop, type StoreShopHandle } from "@/components/store/StoreShop";
import { StoreMasthead, StoreMastheadSkeleton, COVER_H } from "@/components/store/StoreMasthead";
import { StatusBar } from "expo-status-bar";
import {
  getStoreProducts,
  getStoreReviewsList,
  toggleFollowStore,
  isFollowingStore,
} from "@/lib/api/stores";
import { navigateHome } from "@/lib/navigation";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import type { Product, Review } from "@/lib/types";
import StoreStorefrontScreen from "@/src/screens/StoreStorefront";
import { useStorefrontContext } from "@/src/screens/StoreStorefront/hooks/useStorefrontContext";
import { usePublishedConfig } from "@/src/screens/StoreStorefront/hooks/usePublishedConfig";
import { StoreViewTracker, useTrackViewableItems } from "@/lib/recommender";

type Tab = "products" | "reviews";

type IconName = keyof typeof Ionicons.glyphMap;

const compact = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
  : n >= 1_000 ? `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`
  : String(n);

/**
 * Customer-facing store page (mobile app channel).
 *
 * Layout, top to bottom:
 *   1. Parallax banner + floating nav bar that solidifies on scroll.
 *   2. Identity block — logo, name, stats, follow/share.
 *   3. Seller-customised sections, when the store has published an app
 *      layout (real-time on publish via `usePublishedConfig`). Stores
 *      without one simply skip this block.
 *   4. Shop / Reviews tabs — sortable product grid and buyer reviews.
 */
export default function StoreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // Matches ProductCard's own grid math (16px gutters, 12px column gap).
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
  const [followBusy, setFollowBusy] = useState(false);
  const [followerDelta, setFollowerDelta] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>("products");
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productTotal, setProductTotal] = useState(0);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [avgRating, setAvgRating] = useState(0);
  const [reviewTotal, setReviewTotal] = useState(0);
  const [ratingBreakdown, setRatingBreakdown] = useState<Record<number, number>>({
    5: 0, 4: 0, 3: 0, 2: 0, 1: 0,
  });
  const scrollY = React.useRef(new Animated.Value(0)).current;
  const scrollRef = React.useRef<ScrollView>(null);
  const shopRef = React.useRef<StoreShopHandle>(null);
  const shopY = React.useRef(0);
  // Status + nav bar height; the masthead cover runs up underneath it.
  const navInset = insets.top + 64;
  // Light status bar while the dark cover is behind it.
  const [overCover, setOverCover] = useState(true);

  const store = ctx.store;

  // Track store_view + product impressions on the products tab.
  useTrackViewableItems(products, "store_products");

  // The shop filters client-side, so load the whole catalogue: first page
  // straight away, the rest in parallel (capped — boutiques are small).
  const fetchProducts = useCallback(async () => {
    if (!slug) return;
    setProductsLoading(true);
    const first = await getStoreProducts(slug, { sort: "newest", limit: CATALOGUE_PAGE, offset: 0 });
    if (first.ok) {
      setProducts(first.data.products);
      setProductTotal(first.data.total);
      const pages = Math.min(Math.ceil(first.data.total / CATALOGUE_PAGE), CATALOGUE_MAX_PAGES);
      if (pages > 1) {
        const rest = await Promise.all(
          Array.from({ length: pages - 1 }, (_, i) =>
            getStoreProducts(slug, { sort: "newest", limit: CATALOGUE_PAGE, offset: (i + 1) * CATALOGUE_PAGE }),
          ),
        );
        const seen = new Set(first.data.products.map((p) => p.id));
        const all = [...first.data.products];
        for (const page of rest) {
          if (!page.ok) continue;
          for (const p of page.data.products) {
            if (!seen.has(p.id)) {
              seen.add(p.id);
              all.push(p);
            }
          }
        }
        setProducts(all);
      }
    }
    setProductsLoading(false);
  }, [slug]);

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
    await Promise.all([ctx.refetch(), published.refetch(), fetchProducts(), fetchReviews()]);
    setFollowerDelta(0);
    setRefreshing(false);
  }, [ctx, published, fetchProducts, fetchReviews]);

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
    if (!store || followBusy) return;
    if (!user) {
      toast("Sign in to follow boutiques", "info");
      router.push("/(auth)/login");
      return;
    }
    setFollowBusy(true);
    const res = await toggleFollowStore(store.id);
    setFollowBusy(false);
    if (res.ok) {
      if (res.data.following !== following) {
        setFollowerDelta((d) => d + (res.data.following ? 1 : -1));
      }
      setFollowing(res.data.following);
      toast(res.data.following ? `Following ${store.name}` : "Unfollowed", "success");
    } else {
      toast(res.error, "error");
    }
  }, [store, user, toast, router, following, followBusy]);

  const openSearch = useCallback(() => {
    setTab("products");
    scrollRef.current?.scrollTo({ y: Math.max(0, shopY.current - insets.top - 64), animated: true });
    setTimeout(() => shopRef.current?.focusSearch(), 350);
  }, [insets.top]);

  // Nav bar: transparent over the banner, solid paper once the banner scrolls away.
  const navSolid = scrollY.interpolate({
    inputRange: [COVER_H - 20, COVER_H + 20],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  // Store name joins the nav once the masthead title has scrolled under it.
  const navTitle = scrollY.interpolate({
    inputRange: [COVER_H + 150, COVER_H + 200],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  if (!slug || (!ctx.isLoading && !store)) {
    return (
      <PaperBackground>
        <Stack.Screen options={{ headerShown: false }} />
        <StorePageHeader onBack={handleBack} onShare={() => {}} />
        <View style={styles.notFound}>
          <EmptyState
            icon="storefront-outline"
            title="Boutique not found"
            description="This boutique may have moved or is no longer on LUXE."
            framed={false}
          />
          <Button variant="brand" onPress={() => navigateHome(router)}>Browse home</Button>
        </View>
      </PaperBackground>
    );
  }

  const hasCustomLayout = !!published.data?.config;
  const description =
    store?.description && store.description.trim().toLowerCase() !== store.name.trim().toLowerCase()
      ? store.description.trim()
      : null;
  const followers = Math.max(0, (store?.total_followers ?? 0) + followerDelta);
  const sinceYear = store?.created_at ? new Date(store.created_at).getFullYear() : null;
  const contactUrl = store?.contact_email
    ? `mailto:${store.contact_email}`
    : store?.contact_phone
      ? `tel:${store.contact_phone.replace(/\s+/g, "")}`
      : null;

  return (
    <PaperBackground>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style={overCover ? "light" : "dark"} animated />
      <StoreViewTracker id={store?.id ?? null} />

      <Animated.ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: false,
          listener: (e: { nativeEvent: { contentOffset: { y: number } } }) => {
            const over = e.nativeEvent.contentOffset.y < COVER_H + 10;
            setOverCover((prev) => (prev === over ? prev : over));
          },
        })}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.paper.cream}
            progressViewOffset={insets.top + 40}
          />
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing[10] }}
      >
        {/* 1 — Profile masthead; its cover runs under the floating nav */}
        <View>
        {store ? (
          <StoreMasthead
            topInset={navInset}
            store={store}
            description={description}
            followers={followers}
            pieces={productTotal}
            reviewTotal={reviewTotal}
            avgRating={avgRating}
            sinceYear={sinceYear}
            following={following}
            followBusy={followBusy}
            onFollow={handleToggleFollow}
            onContact={contactUrl ? () => void Linking.openURL(contactUrl) : null}
            onShare={handleShare}
          />
        ) : (
          <StoreMastheadSkeleton topInset={navInset} />
        )}
        </View>

        {/* 2 — Seller-customised sections. Optional: stores without a published app
            layout (or a failed fetch — pull-to-refresh retries) simply skip it. */}
        <View>
          {published.isLoading ? null : hasCustomLayout ? (
            <View style={styles.customWrap}>
              <StoreStorefrontScreen slug={slug} />
            </View>
          ) : null}
        </View>

        {/* 3 — Tabs */}
        <View style={styles.tabsWrap} onLayout={(e) => (shopY.current = e.nativeEvent.layout.y)}>
          <SegmentedTabs
            tab={tab}
            onChange={setTab}
            productCount={productTotal}
            reviewCount={reviewTotal}
          />
        </View>

        {/* 4 — Tab content */}
        {tab === "products" ? (
          <StoreShop
            ref={shopRef}
            storeName={store?.name ?? ""}
            products={products}
            loading={productsLoading}
            emptyStore={
              <CollectionEmpty following={following} busy={followBusy} onFollow={handleToggleFollow} />
            }
          />
        ) : (
          <View style={{ paddingTop: spacing[2] }}>
            <StoreReviewsSection
              reviews={reviews}
              avg={avgRating}
              total={reviewTotal}
              breakdown={ratingBreakdown}
            />
          </View>
        )}
      </Animated.ScrollView>

      {/* Floating nav bar */}
      <View style={[styles.nav, { paddingTop: insets.top + 6 }]} pointerEvents="box-none">
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, styles.navBg, { opacity: navSolid }]}
        />
        <TouchableOpacity style={styles.navBtn} onPress={handleBack} activeOpacity={0.8} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={20} color={colors.ink.DEFAULT} />
        </TouchableOpacity>
        <Animated.Text style={[styles.navTitle, { opacity: navTitle }]} numberOfLines={1}>
          {store?.name ?? ""}
        </Animated.Text>
        <TouchableOpacity style={styles.navBtn} onPress={openSearch} activeOpacity={0.8} accessibilityLabel="Search this boutique">
          <Ionicons name="search" size={18} color={colors.ink.DEFAULT} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.navBtn} onPress={handleShare} activeOpacity={0.8} accessibilityLabel="Share">
          <Ionicons name="share-outline" size={18} color={colors.ink.DEFAULT} />
        </TouchableOpacity>
      </View>
    </PaperBackground>
  );
}

/** Editorial text tabs: serif labels, mono counts, a sliding ink underline. */
function SegmentedTabs({
  tab,
  onChange,
  productCount,
  reviewCount,
}: {
  tab: Tab;
  onChange: (t: Tab) => void;
  productCount: number;
  reviewCount: number;
}) {
  const [frames, setFrames] = useState<Partial<Record<Tab, { x: number; width: number }>>>({});
  const x = React.useRef(new Animated.Value(0)).current;
  const w = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const f = frames[tab];
    if (!f) return;
    Animated.parallel([
      Animated.spring(x, { toValue: f.x, useNativeDriver: false, speed: 18, bounciness: 4 }),
      Animated.spring(w, { toValue: f.width, useNativeDriver: false, speed: 18, bounciness: 4 }),
    ]).start();
  }, [tab, frames, x, w]);

  const items: { id: Tab; label: string; count: number }[] = [
    { id: "products", label: "Shop", count: productCount },
    { id: "reviews", label: "Reviews", count: reviewCount },
  ];

  return (
    <View style={styles.tabs} accessibilityRole="tablist">
      {items.map((it) => {
        const active = tab === it.id;
        return (
          <Pressable
            key={it.id}
            onPress={() => onChange(it.id)}
            onLayout={(e: LayoutChangeEvent) => {
              const { x: fx, width } = e.nativeEvent.layout;
              setFrames((prev) => ({ ...prev, [it.id]: { x: fx, width } }));
            }}
            style={styles.tabBtn}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.tabText, active && styles.tabTextActive]}>{it.label}</Text>
            <Text style={[styles.tabCount, active && styles.tabCountActive]}>{compact(it.count)}</Text>
          </Pressable>
        );
      })}
      <Animated.View pointerEvents="none" style={[styles.tabUnderline, { left: x, width: w }]} />
    </View>
  );
}

/** Editorial empty state for the collection — doubles as a follow prompt. */
function CollectionEmpty({
  following,
  busy,
  onFollow,
}: {
  following: boolean;
  busy: boolean;
  onFollow: () => void;
}) {
  return (
    <LinearGradient
      colors={[colors.paper.cream, colors.paper.warm]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.emptyCard}
    >
      <View style={styles.emptyHalo}>
        <View style={styles.emptyHaloMid}>
          <LinearGradient
            colors={[colors.olive[800], colors.olive[950]]}
            style={styles.emptyIcon}
          >
            <Ionicons
              name="shirt-outline"
              size={24}
              color={colors.accent2.ochre}
            />
          </LinearGradient>
        </View>
      </View>
      <Text style={styles.emptyEyebrow}>COMING SOON</Text>
      <Text style={styles.emptyTitle}>
        The next drop is being curated
      </Text>
      <Text style={styles.emptyDesc}>
        {"This boutique is preparing its collection. Follow to be notified the moment new pieces arrive."}
      </Text>
      {following ? (
        <View style={styles.emptyFollowing}>
          <Ionicons name="notifications" size={14} color={colors.olive[700]} />
          <Text style={styles.emptyFollowingText}>You'll be notified of new pieces</Text>
        </View>
      ) : (
        <TouchableOpacity
          onPress={onFollow}
          disabled={busy}
          activeOpacity={0.85}
          style={styles.emptyCta}
          accessibilityRole="button"
        >
          <Ionicons name="notifications-outline" size={15} color={colors.paper.cream} />
          <Text style={styles.emptyCtaText}>Notify me of new drops</Text>
        </TouchableOpacity>
      )}
    </LinearGradient>
  );
}

const CATALOGUE_PAGE = 60;
const CATALOGUE_MAX_PAGES = 10;
const GOLD_HAIRLINE = "rgba(200,164,74,0.28)";

const styles = StyleSheet.create({
  notFound: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[8],
    gap: spacing[4],
  },

  // Nav
  nav: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingBottom: 10,
  },
  navBg: {
    backgroundColor: colors.light.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.light.border,
  },
  navBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(250,248,241,0.92)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(22,23,15,0.12)",
    shadowColor: "#16170f",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  navTitle: {
    flex: 1,
    textAlign: "center",
    fontFamily: fontFamilies.display.regular,
    fontSize: 18,
    color: colors.ink.DEFAULT,
  },

  customWrap: { marginTop: spacing[6] },

  // Tabs
  tabsWrap: {
    paddingHorizontal: spacing[4],
    marginTop: spacing[8],
  },
  tabs: {
    flexDirection: "row",
    gap: spacing[6],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(22,23,15,0.25)",
  },
  tabBtn: { flexDirection: "row", alignItems: "flex-start", gap: 4, paddingTop: 4, paddingBottom: 12 },
  tabText: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.5,
    color: "rgba(22,23,15,0.35)",
  },
  tabTextActive: { color: colors.ink.DEFAULT },
  tabCount: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    marginTop: 3,
    color: "rgba(22,23,15,0.35)",
  },
  tabCountActive: { color: colors.accent2.ochre },
  tabUnderline: { position: "absolute", bottom: -1, height: 2, backgroundColor: colors.ink.DEFAULT },

  // Empty collection
  emptyCard: {
    alignItems: "center",
    marginTop: spacing[4],
    paddingVertical: spacing[8],
    paddingHorizontal: spacing[6],
    borderRadius: 28,
    borderWidth: 1,
    borderColor: GOLD_HAIRLINE,
  },
  emptyHalo: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(200,164,74,0.18)",
  },
  emptyHaloMid: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(200,164,74,0.08)",
    borderWidth: 1,
    borderColor: "rgba(200,164,74,0.28)",
  },
  emptyIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyEyebrow: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 10,
    letterSpacing: 2,
    color: colors.accent2.ochre,
    marginTop: spacing[5],
  },
  emptyTitle: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 23,
    lineHeight: 29,
    letterSpacing: -0.3,
    color: colors.ink.DEFAULT,
    textAlign: "center",
    marginTop: spacing[2],
  },
  emptyDesc: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 14,
    lineHeight: 21,
    color: colors.ink.mute,
    textAlign: "center",
    marginTop: spacing[2],
    maxWidth: 290,
  },
  emptyCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    height: 46,
    paddingHorizontal: 20,
    borderRadius: radii.full,
    backgroundColor: colors.ink.DEFAULT,
    marginTop: spacing[5],
  },
  emptyCtaText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14,
    color: colors.paper.cream,
  },
  emptyFollowing: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: spacing[5],
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.full,
    backgroundColor: colors.olive[50],
  },
  emptyFollowingText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: colors.olive[700],
  },
});
