import React, { useState, useMemo } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@/components/ui/Icon";
import { PaperBackground, AppHeader } from "@/components/layout";
import { expandableTabBarInset } from "@/components/layout/ExpandableTabBar";
import { AnimatedFlatList, useHideTabBarOnScroll } from "@/lib/hooks/useTabBarScroll";
import { FilterSheet } from "@/components/search/FilterSheet";
import { ProductGridControls } from "@/components/products/ProductGridControls";
import { ProductCard } from "@/components/product/ProductCard";
import { HeroCard } from "@/components/product/HeroCard";
import { ProductsEmptyState } from "@/components/product/ProductsEmptyState";
import { TodaysEdit } from "@/components/products/TodaysEdit";
import { Label, Body, Display } from "@/components/ui/Typography";
import { colors, radii, shadows, spacing } from "@/lib/theme/tokens";
import { SORTS, EMPTY_FILTERS, activeFilterCount, type ProductFilters, type ViewMode } from "@/lib/api/facets";
import type { Product } from "@/lib/types";
import { useProductGrid } from "@/lib/hooks/useProductGrid";
import {
  useTrackEvent,
  useTrackViewableItems,
  CategoryViewTracker,
} from "@/lib/recommender";

const GRID_GAP = 12;
const GRID_PADDING = 16;
const GRID_COL_GAP = 12;

export default function ProductsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = (screenWidth - GRID_PADDING * 2 - GRID_COL_GAP) / 2;
  const tabBarScrollHandler = useHideTabBarOnScroll();
  const params = useLocalSearchParams<{
    category?: string;
    brand?: string;
    sort?: string;
    search?: string;
  }>();
  const [filterOpen, setFilterOpen] = useState(false);

  const {
    products,
    refined,
    total,
    loading,
    loadingMore,
    sort,
    setSort,
    filters,
    setFilters,
    view,
    setView,
    loadMore,
  } = useProductGrid({
    category: params.category,
    brand: params.brand,
    search: params.search,
    initialSort: params.sort || "newest",
  });

  // Category page → fire category_view once. Search params pass a slug;
  // hook expects a category id (uuid). If we only have a slug we still
  // pass it through — the ranker treats it as a generic category surface.
  const categoryId = params.category ?? null;
  const tracker = useTrackEvent();
  const viewable = useTrackViewableItems(refined, "category_grid");

  const showHero = view === "editorial" && !params.category && !params.brand && !params.search;
  const hasActiveContext = !!params.category || !!params.brand || !!params.search;

  const pageTitle = params.search
    ? `Search · "${params.search}"`
    : params.brand
      ? params.brand.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
      : params.category
        ? params.category.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
        : "The Atelier";

  const handleClearAll = () => {
    router.replace("/(main)/products");
  };

  const handleClearFilters = () => {
    setFilters({ ...EMPTY_FILTERS });
  };

  const handleSortChange = (next: string) => {
    if (next !== sort) tracker.sortUsed(next, "products");
    setSort(next);
  };

  const handleFilterChange = (next: ProductFilters) => {
    const before = activeFilterCount(filters);
    const after = activeFilterCount(next);
    if (after > before) {
      const added = pickAddedFacet(filters, next);
      if (added) tracker.filterUsed(added, "products");
    }
    setFilters(next);
  };

  const filterCount = activeFilterCount(filters);

  // "Today's Edit" picks — bestseller subset of the loaded products.
  const todaysPicks = useMemo(
    () => [...refined].sort((a, b) => b.total_sales - a.total_sales).slice(0, 6),
    [refined]
  );

  const heroProduct = showHero ? refined[0] : null;
  const restProducts = showHero ? refined.slice(1) : refined;

  const renderGridItem = ({ item }: { item: Product }) => (
    <View style={[styles.gridItem, { width: cardWidth }]}>
      <ProductCard product={item} surface />
    </View>
  );

  const renderListItem = ({ item }: { item: Product }) => (
    <View style={styles.listItemWrap}>
      <ProductCard product={item} listMode />
    </View>
  );

  return (
    <PaperBackground>
      <AppHeader compact showTicker={false} showBackToHome />
      <CategoryViewTracker id={categoryId} />
      <AnimatedFlatList
        key={view}
        data={view === "list" ? restProducts : restProducts}
        keyExtractor={(item: Product) => item.id}
        renderItem={view === "list" ? renderListItem : renderGridItem}
        numColumns={view === "list" ? 1 : 2}
        columnWrapperStyle={view === "list" ? undefined : styles.gridRow}
        contentContainerStyle={[styles.listContent, { paddingBottom: expandableTabBarInset(insets.bottom) + spacing[4] }]}
        showsVerticalScrollIndicator={false}
        onScroll={tabBarScrollHandler}
        scrollEventThrottle={16}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        {...viewable}
        ListHeaderComponent={
          <ProductsListHeader
            loading={loading}
            pageTitle={pageTitle}
            total={total}
            refinedCount={refined.length}
            sort={sort}
            setSort={handleSortChange}
            view={view}
            setView={setView}
            filterCount={filterCount}
            openFilter={() => setFilterOpen(true)}
            filters={filters}
            setFilters={handleFilterChange}
            heroProduct={heroProduct}
            hasActiveContext={hasActiveContext}
            clearAll={handleClearAll}
          />
        }
        ListFooterComponent={
          <View>
            {loadingMore ? (
              <ActivityIndicator color={colors.light.primary} style={{ padding: spacing[5] }} />
            ) : null}
            {!hasActiveContext && filterCount === 0 && todaysPicks.length > 0 ? (
              <View style={styles.editRailWrap}>
                <TodaysEdit products={todaysPicks} />
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          loading ? null : (
            <ProductsEmptyState
              query={params.search ?? null}
              hasActiveFilters={filterCount > 0 || hasActiveContext}
              picks={products.slice(0, 4)}
              onClear={handleClearAll}
              onClearFilters={handleClearFilters}
            />
          )
        }
      />

      <FilterSheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        filters={filters}
        onApply={handleFilterChange}
        sort={sort}
        onSortChange={handleSortChange}
        resultCount={refined.length}
      />
    </PaperBackground>
  );
}

/** Identify the first newly-added facet to attach to filter_used. */
function pickAddedFacet(
  prev: ProductFilters,
  next: ProductFilters,
): string | null {
  const checks: [string, unknown[], unknown[]][] = [
    ["price", prev.price ?? [], next.price ?? []],
    ["colors", prev.colors ?? [], next.colors ?? []],
    ["sizes", prev.sizes ?? [], next.sizes ?? []],
    ["brands", prev.brands ?? [], next.brands ?? []],
    ["categories", prev.categories ?? [], next.categories ?? []],
  ];
  for (const [name, before, after] of checks) {
    const a = new Set<string>((before as string[]).map((x) => String(x)));
    for (const v of (after as string[])) {
      if (!a.has(String(v))) return `${name}:${String(v)}`;
    }
  }
  if ((next.minRating ?? 0) > (prev.minRating ?? 0)) {
    return `minRating:${next.minRating}`;
  }
  if ((next.minDiscount ?? 0) > (prev.minDiscount ?? 0)) {
    return `minDiscount:${next.minDiscount}`;
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/*  ListHeader — hero, breadcrumb, toolbar, quick refine, hero card           */
/* -------------------------------------------------------------------------- */

interface HeaderProps {
  loading: boolean;
  pageTitle: string;
  total: number;
  refinedCount: number;
  sort: string;
  setSort: (s: string) => void;
  view: ViewMode;
  setView: (v: ViewMode) => void;
  filterCount: number;
  openFilter: () => void;
  filters: ProductFilters;
  setFilters: (f: ProductFilters) => void;
  heroProduct: Product | null;
  hasActiveContext: boolean;
  clearAll: () => void;
}

function ProductsListHeader({
  loading,
  pageTitle,
  total,
  refinedCount,
  sort,
  setSort,
  view,
  setView,
  filterCount,
  openFilter,
  filters,
  setFilters,
  heroProduct,
  hasActiveContext,
  clearAll,
}: HeaderProps) {
  return (
    <View>
      <View style={styles.heroBlock}>
        {hasActiveContext ? (
          <TouchableOpacity onPress={clearAll} style={styles.breadcrumb} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={12} color={colors.light.mutedForeground} />
            <Label style={styles.breadcrumbText}>Shop</Label>
            <Label style={styles.breadcrumbSep}>·</Label>
            <Label style={styles.breadcrumbText} numberOfLines={1}>
              {pageTitle}
            </Label>
          </TouchableOpacity>
        ) : null}
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroIcon}>
              <Ionicons name="bag-handle-outline" size={16} color={colors.olive[800]} />
            </View>
            <Label style={styles.heroKicker}>{hasActiveContext ? "Filtered edit" : "Shop"}</Label>
            <View style={styles.livePill}>
              <View style={styles.liveDot} />
              <Label style={styles.liveText}>Live catalogue</Label>
            </View>
          </View>
          <Display size="3xl" style={styles.heroTitle} numberOfLines={2}>
            {pageTitle}
          </Display>
          <View style={styles.heroMetaRow}>
            <Body muted size="sm" style={styles.heroSub}>
              {loading
                ? "Curating the room…"
                : filterCount > 0
                  ? `${refinedCount} matching ${total} piece${total === 1 ? "" : "s"}`
                  : `${total} piece${total === 1 ? "" : "s"} available`}
            </Body>
            {filterCount > 0 ? (
              <View style={styles.filterPill}>
                <Label style={styles.filterPillText}>{filterCount} active</Label>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      <ProductGridControls
        sort={sort}
        setSort={setSort}
        sorts={SORTS}
        view={view}
        setView={setView}
        filterCount={filterCount}
        openFilter={openFilter}
        filters={filters}
        setFilters={setFilters}
      />

      {heroProduct ? (
        <View style={styles.heroCardWrap}>
          <HeroCard product={heroProduct} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: spacing[24],
  },
  heroBlock: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    paddingBottom: spacing[3],
  },
  heroCard: {
    padding: spacing[4],
    borderRadius: radii.xl,
    backgroundColor: colors.paper.cream,
    borderWidth: 1,
    borderColor: colors.light.border,
    ...shadows.soft,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    marginBottom: spacing[2],
  },
  heroIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: colors.olive[100],
    alignItems: "center",
    justifyContent: "center",
  },
  breadcrumb: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: spacing[3],
  },
  breadcrumbText: {
    color: colors.light.mutedForeground,
    fontSize: 10,
  },
  breadcrumbSep: {
    color: colors.light.mutedForeground,
    fontSize: 10,
  },
  heroKicker: {
    color: colors.light.primary,
    flex: 1,
  },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: "rgba(83,94,44,0.10)",
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.olive[700],
  },
  liveText: {
    color: colors.olive[700],
    fontSize: 8.5,
  },
  heroTitle: {
    marginBottom: spacing[2],
  },
  heroMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[2],
  },
  heroSub: {
    flex: 1,
  },
  filterPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: "rgba(200,164,74,0.18)",
  },
  filterPillText: {
    color: colors.olive[800],
    fontSize: 9,
  },
  heroCardWrap: {
    paddingHorizontal: GRID_PADDING,
    paddingTop: spacing[2],
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
  },
  editRailWrap: {
    paddingHorizontal: 0,
  },
});
