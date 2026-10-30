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
import { LinearGradient } from "expo-linear-gradient";
import { AppHeader } from "@/components/layout";
import { C } from "@/components/orders/parcel-track";
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
    /** Deep-link scopes from the home "Shop by price/occasion" shortcuts. */
    minPrice?: string;
    maxPrice?: string;
    occasion?: string;
    /** Optional display title supplied by the deep link. */
    title?: string;
  }>();
  const parsePrice = (v?: string) => {
    const n = v != null && v !== "" ? Number(v) : NaN;
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  };
  const minPriceParam = parsePrice(params.minPrice);
  const maxPriceParam = parsePrice(params.maxPrice);
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
    minPrice: minPriceParam,
    maxPrice: maxPriceParam,
    occasion: params.occasion,
  });

  // Category page → fire category_view once. Search params pass a slug;
  // hook expects a category id (uuid). If we only have a slug we still
  // pass it through — the ranker treats it as a generic category surface.
  const categoryId = params.category ?? null;
  const tracker = useTrackEvent();
  const viewable = useTrackViewableItems(refined, "category_grid");

  const hasActiveContext =
    !!params.category || !!params.brand || !!params.search || !!params.occasion ||
    minPriceParam != null || maxPriceParam != null || params.sort === "sale";
  const showHero = view === "editorial" && !hasActiveContext;

  const titleCase = (v: string) => v.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const pageTitle = params.title
    ? params.title
    : params.occasion
    ? `${titleCase(params.occasion)} edit`
    : minPriceParam != null || maxPriceParam != null
    ? maxPriceParam == null
      ? `${Math.round((minPriceParam ?? 0) / 1000)}K & above`
      : (minPriceParam ?? 0) === 0
        ? `Under ${Math.round(maxPriceParam / 1000)}K`
        : `${Math.round((minPriceParam ?? 0) / 1000)}K – ${Math.round(maxPriceParam / 1000)}K`
    : params.sort === "sale" && !params.search && !params.brand && !params.category
    ? "The Sale"
    : params.search
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
      <ProductCard product={item} tone="atelier" />
    </View>
  );

  const renderListItem = ({ item }: { item: Product }) => (
    <View style={styles.listItemWrap}>
      <ProductCard product={item} listMode tone="atelier" />
    </View>
  );

  return (
    <View style={styles.root}>
      <LinearGradient
        pointerEvents="none"
        colors={[C.glow, C.glowSoft, C.paper]}
        locations={[0, 0.5, 1]}
        style={styles.glow}
      />
      <AppHeader compact showTicker={false} showBackToHome tone="atelier" />
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
    </View>
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
        ) : (
          <Label style={styles.eyebrow}>Shop · All pieces</Label>
        )}
        <Display size="4xl" style={styles.heroTitle} numberOfLines={2}>
          {pageTitle}
        </Display>
        {!hasActiveContext ? (
          <Body muted size="sm" style={styles.heroSub}>
            The full collection, from every atelier on LUXE.
          </Body>
        ) : null}
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
        summary={
          loading
            ? "Loading…"
            : filterCount > 0
              ? `${refinedCount} of ${total} piece${total === 1 ? "" : "s"}`
              : `${total} piece${total === 1 ? "" : "s"}`
        }
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
  root: {
    flex: 1,
    backgroundColor: C.paper,
  },
  glow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 460,
  },
  listContent: {
    paddingBottom: spacing[24],
  },
  heroBlock: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[5],
    paddingBottom: spacing[4],
  },
  eyebrow: {
    color: C.accent,
    fontSize: 10,
    letterSpacing: 1.8,
    marginBottom: spacing[1.5],
  },
  heroSub: {
    marginTop: spacing[1.5],
  },
  breadcrumb: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: spacing[2],
  },
  breadcrumbText: {
    color: colors.light.mutedForeground,
    fontSize: 10,
  },
  breadcrumbSep: {
    color: colors.light.mutedForeground,
    fontSize: 10,
  },
  heroTitle: {
    letterSpacing: -0.8,
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
    marginBottom: 0,
  },
  listItemWrap: {
    paddingHorizontal: GRID_PADDING,
  },
  editRailWrap: {
    paddingHorizontal: 0,
  },
});
