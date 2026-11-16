import React, { useState, useMemo } from "react";
import { View, ActivityIndicator, useWindowDimensions } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { expandableTabBarInset } from "@/components/layout/ExpandableTabBar";
import { AnimatedFlatList, useHideTabBarOnScroll } from "@/lib/hooks/useTabBarScroll";
import { FilterSheet } from "@/components/search/FilterSheet";
import { SearchOrbitChrome } from "@/components/search/SearchOrbitChrome";
import { SearchResultTile } from "@/components/search/SearchResultTile";
import { SearchQuickBar } from "@/components/search/SearchQuickBar";
import { DeliveryAddressStrip } from "@/components/search/DeliveryAddressStrip";
import { ProductsEmptyState } from "@/components/product/ProductsEmptyState";
import { TodaysEdit } from "@/components/products/TodaysEdit";
import { colors, spacing } from "@/lib/theme/tokens";
import { EMPTY_FILTERS, activeFilterCount, type ProductFilters } from "@/lib/api/facets";
import type { Product } from "@/lib/types";
import { useProductGrid } from "@/lib/hooks/useProductGrid";
import {
  useTrackEvent,
  useTrackViewableItems,
  CategoryViewTracker,
} from "@/lib/recommender";

/* Same grid metrics as the search results page. */
const GRID_PADDING = 12;
const TILE_GAP = 10;

export default function ProductsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const tileWidth = (screenWidth - GRID_PADDING * 2 - TILE_GAP) / 2;
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
    /** Home banner id — its tagged products lead, related products follow. */
    banner?: string;
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
    loadMore,
  } = useProductGrid({
    category: params.category,
    brand: params.brand,
    search: params.search,
    initialSort: params.sort || "newest",
    minPrice: minPriceParam,
    maxPrice: maxPriceParam,
    occasion: params.occasion,
    banner: params.banner,
  });

  // Category page → fire category_view once. Search params pass a slug;
  // hook expects a category id (uuid). If we only have a slug we still
  // pass it through — the ranker treats it as a generic category surface.
  const categoryId = params.category ?? null;
  const tracker = useTrackEvent();
  const viewable = useTrackViewableItems(refined, "category_grid");

  const hasActiveContext =
    !!params.category || !!params.brand || !!params.search || !!params.occasion || !!params.banner ||
    minPriceParam != null || maxPriceParam != null || params.sort === "sale";

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
    ? params.search
    : params.brand
      ? params.brand.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
      : params.category
        ? params.category.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
        : "All pieces";

  const handleClearFilters = () => {
    setFilters({ ...EMPTY_FILTERS });
  };

  const handleClearAll = () => {
    router.replace("/(main)/products");
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

  const handleResultPress = (p: Product) => {
    router.push(`/(main)/products/${p.slug}?from=search` as never);
  };

  const renderItem = ({ item }: { item: Product }) => (
    <View style={{ width: tileWidth, marginBottom: 22 }}>
      <SearchResultTile product={item} width={tileWidth} onPress={handleResultPress} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper.cream }}>
      <SearchOrbitChrome
        topInset={insets.top}
        draft={pageTitle}
        onDraftChange={() => {}}
        onSubmit={() => router.push("/(main)/search" as never)}
        onClear={() => {}}
        searched
        query={pageTitle}
        totalCount={total}
      />
      <CategoryViewTracker id={categoryId} />
      <AnimatedFlatList
        data={refined}
        keyExtractor={(item: Product) => item.id}
        renderItem={renderItem}
        numColumns={2}
        columnWrapperStyle={{ gap: TILE_GAP }}
        contentContainerStyle={{
          paddingHorizontal: GRID_PADDING,
          paddingBottom: expandableTabBarInset(insets.bottom) + 104,
        }}
        showsVerticalScrollIndicator={false}
        onScroll={tabBarScrollHandler}
        scrollEventThrottle={16}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        {...viewable}
        ListHeaderComponent={
          <View>
            <View style={{ marginBottom: spacing[3] }}>
              <DeliveryAddressStrip />
            </View>
          </View>
        }
        ListFooterComponent={
          <View>
            {loadingMore ? (
              <ActivityIndicator color={colors.light.primary} style={{ padding: spacing[5] }} />
            ) : null}
            {!hasActiveContext && filterCount === 0 && todaysPicks.length > 0 ? (
              <View style={{ marginTop: spacing[4] }}>
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

      {refined.length > 0 ? (
        <SearchQuickBar
          sort={sort}
          filters={filters}
          products={refined}
          filterCount={filterCount}
          onSortChange={handleSortChange}
          onFiltersChange={handleFilterChange}
          onOpenFilters={() => setFilterOpen(true)}
        />
      ) : null}

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
