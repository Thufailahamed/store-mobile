import React, { useEffect, useMemo } from "react";
import { RefreshControl, StyleSheet, View, Text } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
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
} from "@/components/home/premium";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { useAuth } from "@/lib/supabase/auth";
import { useWishlist } from "@/lib/stores";
import { useHomeScreenData } from "@/lib/hooks/useHomeScreen";

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
  const tabBarScrollHandler = useHideTabBarOnScroll();
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
      <AppHeader showSearch />
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
        <View style={[styles.zone, styles.zoneWarm]}>
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

          <ProductRail
            kicker="Limited-time deals"
            title="On sale"
            products={catalogData?.saleProducts ?? []}
            showSaleBadge
            accent
            onSeeAll={() => router.push("/(main)/products?sort=sale")}
          />
          <ProductRail
            title="New arrivals"
            products={catalogData?.newArrivals ?? []}
            showSaleBadge={false}
            onSeeAll={() => router.push("/(main)/products?sort=newest")}
          />
          {(recentlyViewed.data?.length ?? 0) > 0 ? (
            <ProductRail
              kicker="Pick up where you left off"
              title="Recently viewed"
              products={recentlyViewed.data ?? []}
              showSaleBadge={false}
              onSeeAll={() => router.push("/(main)/products?sort=newest")}
            />
          ) : null}
        </View>

        {catalogExtended.isSuccess || catalogExtended.isFetching ? (
          <>
            {/* Zone 3 — browse by store/brand + live ranking */}
            <FeaturedStoresRow stores={catalogData?.stores ?? []} />
            <MasonryProductRail
              kicker="Live right now"
              title="Trending now"
              products={catalogData?.trending ?? []}
              onSeeAll={() => router.push("/(main)/products?sort=rating")}
            />
            <FeaturedBrandsRow brands={catalogData?.brands ?? []} />

            <EditorialInterlude
              quote="Sculpted silhouettes and liquid silk mark the season's turn toward evening drama."
              attribution="The Edit Desk"
            />

            {/* Zone 4 — the editorial desk: curated picks, the journal */}
            <View style={[styles.zone, styles.zoneTint]}>
              <ProductRail
                kicker="Curated by our stylists"
                title="Editor's picks"
                products={catalogData?.editorsPicks ?? []}
                showSaleBadge={false}
                variant="feature"
                onSeeAll={() => router.push("/(main)/products?sort=price_desc")}
              />
              <ProductRail
                kicker="Updated daily"
                title="Today's edit"
                products={catalogData?.todaysEdit ?? []}
                showSaleBadge={false}
                variant="feature"
                onSeeAll={() => router.push("/(main)/products?sort=newest")}
              />
              <ProductRail
                kicker="Trending today"
                title="Most loved right now"
                products={catalogData?.mostLoved ?? []}
                showSaleBadge={false}
                onSeeAll={() => router.push("/(main)/products?sort=rating")}
              />

              <View style={styles.sponsoredWrap}>
                <Text style={styles.sponsoredLabel}>Sponsored</Text>
                <ProductRail
                  title="Featured from our partners"
                  products={catalogData?.sponsored ?? []}
                  showSaleBadge={false}
                  badgeLabel="Sponsored"
                />
              </View>

              <HomeJournalRail
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
    paddingTop: spacing[6],
    paddingBottom: spacing[2],
    marginBottom: spacing[6],
  },
  zoneWarm: {
    backgroundColor: colors.paper.warm,
  },
  zoneTint: {
    backgroundColor: colors.olive[50],
  },
  sponsoredWrap: {
    marginHorizontal: spacing[4],
    marginBottom: spacing[8],
    paddingTop: spacing[4],
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.light.border,
  },
  sponsoredLabel: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 10,
    color: colors.light.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 1,
    paddingHorizontal: spacing[5],
    marginBottom: spacing[2],
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
