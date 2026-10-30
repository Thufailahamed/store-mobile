import React, { useEffect, useMemo } from "react";
import { RefreshControl, StyleSheet, TouchableOpacity, View, Text } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useSharedValue } from "react-native-reanimated";
import { Ionicons } from "@/components/ui/Icon";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppHeader, PaperBackground } from "@/components/layout";
import { expandableTabBarInset } from "@/components/layout/ExpandableTabBar";
import { AnimatedScrollView, useHideTabBarOnScroll } from "@/lib/hooks/useTabBarScroll";
import {
  CategoryScroller,
  PromoCarousel,
  ProductRail,
  MasonryProductRail,
  FeaturedStoresRow,
  FeaturedBrandsRow,
  HomeJournalRail,
  EditorialInterlude,
  PersonalisedSection,
  ContinueBrowsingRow,
  ShopTheLookSection,
  TrustStrip,
  FlashSaleSection,
  OffersRail,
  ShopByPrice,
  ShopByOccasion,
} from "@/components/home/premium";
import { createSeenSet } from "@/components/home/premium/dedupe";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { useAuth } from "@/lib/supabase/auth";
import { useWishlist } from "@/lib/stores";
import { useHomeScreenData, useHomeShortcuts, useHomeOffers } from "@/lib/hooks/useHomeScreen";
import type { Product } from "@/lib/types";

/** Rails with fewer items than this are hidden rather than shown half-empty. */
const MIN_RAIL_ITEMS = 3;

/* ---------------------------------------------------------------------------
 * SHOP GRID SECTION — disabled for now (kept for easy re-enabling later).
 * Adds an infinite-scroll "Shop the full edit" grid (sort/refine/view-toggle)
 * appended below the rails, backed by useProductGrid(). To restore: swap
 * AnimatedScrollView back to AnimatedFlatList, uncomment the imports/state
 * below, move the rails JSX into a ListHeaderComponent, and re-add the
 * ProductGridControls + grid section + FilterSheet as they were.
 *
 * import { HomeSectionHeader } from "@/components/home/premium";
 * import { ProductGridControls } from "@/components/products/ProductGridControls";
 * import { ProductCard } from "@/components/product/ProductCard";
 * import { ProductsEmptyState } from "@/components/product/ProductsEmptyState";
 * import { FilterSheet } from "@/components/search/FilterSheet";
 * import { colors, spacing } from "@/lib/theme/tokens";
 * import { SORTS, EMPTY_FILTERS, activeFilterCount } from "@/lib/api/facets";
 * import type { Product } from "@/lib/types";
 * import { useProductGrid } from "@/lib/hooks/useProductGrid";
 * ------------------------------------------------------------------------- */

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const tabBarScrollHandler = useHideTabBarOnScroll(scrollY);
  const { user } = useAuth();
  const wishlistIdsKey = useWishlist((s) => Object.keys(s.items).sort().join(","));


  const {
    catalog,
    catalogExtended,
    forYou,
    recentlyViewed,
    wishlistRail,
    isRefreshing,
    refreshAll,
    refreshForYou,
  } = useHomeScreenData(user?.id, wishlistIdsKey);

  const catalogData = catalog.data;
  const offers = useHomeOffers();
  const shortcuts = useHomeShortcuts();
  const wishlistRailData = wishlistRail.data ?? { wishlist: [], companions: [] };

  // Prefetch above-the-fold images into expo-image's memory + disk cache
  // so the first paint of the hero banner + first product rail has no
  // network wait. Runs once per catalog change.
  useEffect(() => {
    if (!catalogData) return;
    const hero = catalogData.banners?.[0]?.image_url;
    const heroSources: string[] = [];
    if (hero) heroSources.push(hero);
    for (const p of catalogData.saleProducts.slice(0, 6)) {
      const url = p.images?.find((i) => i.is_primary)?.url ?? p.images?.[0]?.url;
      if (url) heroSources.push(url);
    }
    for (const p of catalogData.newArrivals.slice(0, 4)) {
      const url = p.images?.find((i) => i.is_primary)?.url ?? p.images?.[0]?.url;
      if (url) heroSources.push(url);
    }
    if (heroSources.length === 0) return;
    Image.prefetch(heroSources, { cachePolicy: "memory-disk" }).catch(() => {});
  }, [catalogData]);

  const showForYouRail = useMemo(
    () => (forYou.data?.products?.length ?? 0) > 0 || forYou.isLoading,
    [forYou.data?.products?.length, forYou.isLoading],
  );

  // De-duplicate the generic catalog rails top-to-bottom so the same piece
  // doesn't appear in four rails on a small catalog. Purpose-specific rails
  // (flash sale, personalised feed) keep their full list
  // but still count as "seen" so later generic rails skip those pieces.
  // Sponsored is paid placement and is never filtered.
  const rails = useMemo(() => {
    const seen = createSeenSet();
    const take = (list: Product[] | undefined) => seen.take(list, MIN_RAIL_ITEMS);

    seen.mark(forYou.data?.products ?? []);
    const flash = catalogData?.saleProducts ?? [];
    seen.mark(flash);
    const newArrivals = take(catalogData?.newArrivals);
    const trending = take(catalogData?.trending);
    const editorsPicks = take(catalogData?.editorsPicks);
    const todaysEdit = take(catalogData?.todaysEdit);
    const mostLoved = take(catalogData?.mostLoved);
    return {
      flash,
      newArrivals,
      trending,
      editorsPicks,
      todaysEdit,
      mostLoved,
    };
  }, [catalogData, forYou.data?.products]);

  /* const [filterOpen, setFilterOpen] = useState(false);
  const {
    products,
    refined,
    loading: gridLoading,
    loadingMore,
    sort,
    setSort,
    filters,
    setFilters,
    view,
    setView,
    loadMore,
  } = useProductGrid();

  const filterCount = activeFilterCount(filters);
  const resetGridFilters = () => setFilters({ ...EMPTY_FILTERS });

  const renderGridItem = ({ item }: { item: Product }) => (
    <View style={[styles.gridItem, { width: cardWidth }]}>
      <ProductCard product={item} />
    </View>
  );

  const renderListItem = ({ item }: { item: Product }) => (
    <View style={styles.listItemWrap}>
      <ProductCard product={item} listMode />
    </View>
  ); */

  return (
    <PaperBackground>
      <AppHeader showSearch scrollY={scrollY} />
      <AnimatedScrollView
        showsVerticalScrollIndicator={false}
        onScroll={tabBarScrollHandler}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl refreshing={isRefreshing && !catalog.isLoading} onRefresh={refreshAll} />
        }
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: expandableTabBarInset(insets.bottom) + 24 },
        ]}
      >
        {/* Zone 1 — discovery: browse entry points + the personalised feed */}
        <CategoryScroller categories={catalogData?.categories ?? []} />

        <PromoCarousel banners={catalogData?.banners ?? []} />

        <OffersRail offers={offers.data ?? []} />

        {showForYouRail ? (
          <PersonalisedSection
            title={forYou.data?.hasSignal ? "Recommended for you" : "Trending in the Edit"}
            products={forYou.data?.products ?? []}
            hasSignal={forYou.data?.hasSignal ?? false}
            loading={forYou.isLoading}
            onRefresh={() => {
              void refreshForYou(user?.id);
            }}
            onSeeAll={() => router.push("/(main)/products?sort=newest")}
          />
        ) : null}

        <ContinueBrowsingRow />

        {/* Zone 2 — the core catalog: deals, new stock, saved items */}
        <View style={styles.zone}>
          {wishlistRailData.wishlist.length > 0 ? (
            <>
              <ProductRail
                kicker="From your wishlist"
                title="Saved for you"
                products={wishlistRailData.wishlist}
                showSaleBadge
                onSeeAll={() => router.push("/(main)/products?sort=newest")}
              />
              {wishlistRailData.companions.length > 0 ? (
                <ProductRail
                  kicker="Pairs with your saves"
                  title="You might also like these"
                  products={wishlistRailData.companions}
                  showSaleBadge
                  onSeeAll={() => router.push("/(main)/products?sort=newest")}
                />
              ) : null}
            </>
          ) : null}

          <FlashSaleSection
            products={rails.flash}
            endsAt={catalogData?.flashEndsAt}
            onExpired={() => {
              void refreshAll();
            }}
          />
          <ProductRail
            title="New arrivals"
            products={rails.newArrivals}
            onSeeAll={() => router.push("/(main)/products?sort=newest")}
          />
          <ShopByPrice bands={shortcuts.data?.priceBands ?? []} />
          {(recentlyViewed.data?.length ?? 0) > 0 ? (
            <ProductRail
              kicker="Pick up where you left off"
              title="Recently viewed"
              products={recentlyViewed.data ?? []}
              onSeeAll={() => router.push("/(main)/products?sort=newest")}
            />
          ) : null}
        </View>

        <ShopByOccasion occasions={shortcuts.data?.occasions ?? []} />

        {/* Lookbook Feature */}
        <ShopTheLookSection products={[...(catalogData?.newArrivals ?? []), ...(catalogData?.saleProducts ?? [])]} />

        {catalogExtended.isSuccess || catalogExtended.isFetching ? (
          <>
            {/* Zone 3 — browse by store/brand + live ranking */}
            <FeaturedStoresRow stores={catalogData?.stores ?? []} />
            <MasonryProductRail
              kicker="Live right now"
              title="Trending now"
              products={rails.trending}
              onSeeAll={() => router.push("/(main)/products?sort=rating")}
            />
            <FeaturedBrandsRow brands={catalogData?.brands ?? []} />

            <EditorialInterlude
              quote="Sculpted silhouettes and liquid silk mark the season's turn toward evening drama."
              attribution="The Edit Desk"
            />

            {/* Zone 4 — the editorial desk: curated picks, the journal */}
            <View style={styles.zone}>
              <ProductRail
                kicker="Curated by our stylists"
                title="Editor's picks"
                products={rails.editorsPicks}
                variant="feature"
                onSeeAll={() => router.push("/(main)/products?sort=price_desc")}
              />
              <ProductRail
                kicker="Updated daily"
                title="Today's edit"
                products={rails.todaysEdit}
                variant="feature"
                onSeeAll={() => router.push("/(main)/products?sort=newest")}
              />
              <ProductRail
                kicker="Trending today"
                title="Most loved right now"
                products={rails.mostLoved}
                onSeeAll={() => router.push("/(main)/products?sort=rating")}
              />

              {/* Paid placement: labelled at section level and on every card. */}
              <ProductRail
                kicker="Sponsored"
                title="Featured from our partners"
                products={catalogData?.sponsored ?? []}
                badgeLabel="Sponsored"
              />

              <HomeJournalRail
                kicker="Stories & guides"
                title="From the journal"
                posts={catalogData?.journalPosts ?? []}
                tabs={[
                  { label: "Latest", posts: catalogData?.journalPosts ?? [] },
                  { label: "Trending this week", posts: catalogData?.topStories ?? [] },
                ]}
              />
            </View>
          </>
        ) : null}

        {/* Close the page deliberately instead of trailing off into empty space. */}
        <TrustStrip />
        <View style={styles.endCap}>
          <Text style={styles.endKicker}>You've seen the edit</Text>
          <Text style={styles.endTitle}>Still looking for something?</Text>
          <TouchableOpacity
            style={styles.endBtn}
            onPress={() => router.push("/(main)/products")}
            activeOpacity={0.85}
          >
            <Text style={styles.endBtnText}>Browse all pieces</Text>
            <Ionicons name="arrow-forward" size={15} color={colors.light.primaryForeground} />
          </TouchableOpacity>
        </View>

        {/* --- Shop grid section (disabled for now) ---
        <View style={styles.gridSectionHeader}>
          <HomeSectionHeader kicker="Browse everything" title="Shop the full edit" />
        </View>
        <ProductGridControls
          sort={sort}
          setSort={setSort}
          sorts={SORTS}
          view={view}
          setView={setView}
          filterCount={filterCount}
          openFilter={() => setFilterOpen(true)}
          filters={filters}
          setFilters={setFilters}
        />
        --- */}
      </AnimatedScrollView>

      {/* <FilterSheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        filters={filters}
        onApply={setFilters}
        sort={sort}
        onSortChange={setSort}
        resultCount={refined.length}
      /> */}
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingTop: 4,
  },
  zone: {
    paddingTop: spacing[2],
  },
  endCap: {
    alignItems: "center",
    gap: spacing[1.5],
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[6],
  },
  endKicker: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: colors.light.primary,
  },
  endTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 21,
    color: colors.light.foreground,
    textAlign: "center",
  },
  endBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: spacing[3],
    paddingHorizontal: spacing[6],
    height: 48,
    borderRadius: radii.full,
    backgroundColor: colors.light.primary,
  },
  endBtnText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14,
    color: colors.light.primaryForeground,
  },
  /* gridSectionHeader: {
    marginTop: spacing[6],
    marginBottom: spacing[1],
  },
  gridRow: {
    justifyContent: "space-between",
    paddingHorizontal: GRID_PADDING,
  },
  gridItem: {
    marginBottom: GRID_GAP,
  },
  listItemWrap: {
    paddingHorizontal: GRID_PADDING,
  }, */
});
