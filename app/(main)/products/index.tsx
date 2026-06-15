import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { AppHeader, PaperBackground } from "@/components/layout";
import { FilterSheet } from "@/components/search/FilterSheet";
import { QuickRefine } from "@/components/search/QuickRefine";
import { ProductCard } from "@/components/product/ProductCard";
import { HeroCard } from "@/components/product/HeroCard";
import { ProductsEmptyState } from "@/components/product/ProductsEmptyState";
import { TodaysEdit } from "@/components/products/TodaysEdit";
import { Label, Body, Display } from "@/components/ui/Typography";
import { colors, radii, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import {
  SORTS,
  VIEW_MODES,
  EMPTY_FILTERS,
  activeFilterCount,
  type ProductFilters,
  type ViewMode,
  type SortOption,
} from "@/lib/api/facets";
import * as api from "@/lib/api";
import type { Product } from "@/lib/types";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const GRID_GAP = 12;
const GRID_PADDING = 16;
const GRID_COL_GAP = 12;
const CARD_WIDTH = (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_COL_GAP) / 2;

const SORTS_FOR_BAR: SortOption[] = SORTS;

export default function ProductsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    category?: string;
    brand?: string;
    sort?: string;
    search?: string;
  }>();
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<string>(params.sort || "newest");
  const [offset, setOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState<ProductFilters>({});
  const [view, setView] = useState<ViewMode>("grid");
  const LIMIT = 20;

  // Filtered list — server applies the primary filter (category, brand,
  // gender, search, sort). Refinement facets (price/color/size/rating/
  // discount/brand-multi/category-multi) run on the loaded page so the
  // server stays simple and the response is fast.
  const refined = useMemo(() => {
    let list = products;
    if (filters.brands?.length) {
      list = list.filter((p) => p.brand_id && filters.brands!.includes(p.brand_id));
    }
    if (filters.categories?.length) {
      list = list.filter(
        (p) => p.category_id && filters.categories!.includes(p.category_id)
      );
    }
    if (filters.colors?.length) {
      list = list.filter((p) => {
        const have = new Set((p.variants ?? []).map((v) => v.color).filter(Boolean) as string[]);
        return filters.colors!.some((c) => have.has(c));
      });
    }
    if (filters.sizes?.length) {
      list = list.filter((p) => {
        const have = new Set((p.variants ?? []).map((v) => v.size).filter(Boolean) as string[]);
        return filters.sizes!.some((s) => have.has(s));
      });
    }
    if (filters.minRating && filters.minRating > 0) {
      list = list.filter((p) => p.rating >= filters.minRating!);
    }
    if (filters.minDiscount && filters.minDiscount > 0) {
      list = list.filter(
        (p) =>
          p.mrp > p.price &&
          Math.round(((p.mrp - p.price) / p.mrp) * 100) >= filters.minDiscount!
      );
    }
    if (filters.price && (filters.price[0] > 0 || filters.price[1] < 500000)) {
      list = list.filter(
        (p) => p.price >= filters.price![0] && p.price <= filters.price![1]
      );
    }
    return list;
  }, [products, filters]);

  const showHero = view === "editorial" && !params.category && !params.brand && !params.search;
  const hasActiveContext = !!params.category || !!params.brand || !!params.search;

  const pageTitle = params.search
    ? `Search · "${params.search}"`
    : params.brand
      ? params.brand.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
      : params.category
        ? params.category.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
        : "The Atelier";

  const fetchProducts = useCallback(
    async (reset = false) => {
      const off = reset ? 0 : offset;
      const res = await api.getProducts({
        limit: LIMIT,
        offset: off,
        sort: sort as any,
        categorySlug: params.category,
        brandSlug: params.brand,
        gender: filters.gender,
        search: params.search,
      });
      if (res.ok) {
        setProducts((prev) => (reset ? res.data.products : [...prev, ...res.data.products]));
        setTotal(res.data.total);
      } else {
        if (reset) {
          setProducts([]);
          setTotal(0);
        }
      }
      setLoading(false);
      setLoadingMore(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sort, params.category, params.brand, params.search, filters.gender, offset]
  );

  useEffect(() => {
    setLoading(true);
    setOffset(0);
    setProducts([]);
    fetchProducts(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, params.category, params.brand, params.search, filters.gender]);

  const loadMore = () => {
    if (loadingMore || products.length >= total) return;
    setLoadingMore(true);
    setOffset((o) => o + LIMIT);
    fetchProducts(false);
  };

  const handleClearAll = () => {
    router.replace("/(main)/products");
  };

  const handleClearFilters = () => {
    setFilters({ ...EMPTY_FILTERS });
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
    <View style={styles.gridItem}>
      <ProductCard product={item} />
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
      <FlatList
        key={view}
        data={view === "list" ? restProducts : restProducts}
        keyExtractor={(item) => item.id}
        renderItem={view === "list" ? renderListItem : renderGridItem}
        numColumns={view === "list" ? 1 : 2}
        columnWrapperStyle={view === "list" ? undefined : styles.gridRow}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <ProductsListHeader
            loading={loading}
            pageTitle={pageTitle}
            total={total}
            refinedCount={refined.length}
            sort={sort}
            setSort={setSort}
            view={view}
            setView={setView}
            filterCount={filterCount}
            openFilter={() => setFilterOpen(true)}
            filters={filters}
            setFilters={setFilters}
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
        onApply={setFilters}
        sort={sort}
        onSortChange={setSort}
        resultCount={refined.length}
      />
    </PaperBackground>
  );
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
  const router = useRouter();
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
        <Label style={styles.heroKicker}>{hasActiveContext ? "Filtered" : "Shop"}</Label>
        <Display size="3xl" style={styles.heroTitle} numberOfLines={2}>
          {pageTitle}
        </Display>
        <Body muted size="sm" style={styles.heroSub}>
          {loading
            ? "Curating the room…"
            : `${refinedCount} of ${total} piece${total === 1 ? "" : "s"}`}
        </Body>
        <View style={styles.heroRule} />
      </View>

      <View style={styles.toolbar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sortBar}
        >
          {SORTS_FOR_BAR.map((opt) => {
            const active = sort === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                onPress={() => setSort(opt.value)}
                activeOpacity={0.8}
                style={[styles.sortChip, active && styles.sortChipActive]}
              >
                <Label style={[styles.sortText, active && styles.sortTextActive]}>
                  {opt.label}
                </Label>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.secondaryBar}>
        <TouchableOpacity style={styles.refineBtn} onPress={openFilter} activeOpacity={0.8}>
          <Ionicons name="options-outline" size={14} color={colors.light.primary} />
          <Label style={styles.refineText}>Refine</Label>
          {filterCount > 0 ? (
            <View style={styles.refineCount}>
              <Label style={styles.refineCountText}>{filterCount}</Label>
            </View>
          ) : null}
        </TouchableOpacity>

        <View style={styles.viewToggle}>
          {VIEW_MODES.map((m) => {
            const active = view === m.value;
            return (
              <TouchableOpacity
                key={m.value}
                onPress={() => setView(m.value)}
                activeOpacity={0.8}
                style={[styles.viewBtn, active && styles.viewBtnActive]}
                accessibilityLabel={m.label}
                accessibilityState={{ selected: active }}
              >
                <Ionicons
                  name={m.icon as any}
                  size={16}
                  color={active ? colors.light.primaryForeground : colors.light.foreground}
                />
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <QuickRefine
        filters={filters}
        onChange={setFilters}
        onOpenSheet={openFilter}
        activeCount={filterCount}
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
    paddingBottom: spacing[4],
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
    marginBottom: spacing[1],
  },
  heroTitle: {
    marginBottom: spacing[2],
  },
  heroSub: {
    marginBottom: spacing[3],
  },
  heroRule: {
    height: 1,
    backgroundColor: colors.light.border,
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing[2],
  },
  sortBar: {
    paddingHorizontal: spacing[5],
    gap: 8,
  },
  sortChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.light.card,
  },
  sortChipActive: {
    backgroundColor: colors.light.foreground,
    borderColor: colors.light.foreground,
  },
  sortText: {
    color: colors.light.foreground,
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: typography.letterSpacing.wide,
  },
  sortTextActive: {
    color: colors.light.primaryForeground,
  },
  secondaryBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[2],
    paddingTop: spacing[1],
  },
  refineBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.light.card,
  },
  refineText: {
    color: colors.light.primary,
    fontFamily: fontFamilies.mono.medium,
    fontSize: 11,
    letterSpacing: typography.letterSpacing.wide,
  },
  refineCount: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.accent2.rust,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  refineCountText: {
    color: "#fff",
    fontSize: 9,
  },
  viewToggle: {
    flexDirection: "row",
    backgroundColor: colors.light.card,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: 3,
    gap: 2,
  },
  viewBtn: {
    width: 30,
    height: 28,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
  },
  viewBtnActive: {
    backgroundColor: colors.light.foreground,
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
    width: CARD_WIDTH,
    marginBottom: GRID_GAP,
  },
  listItemWrap: {
    paddingHorizontal: GRID_PADDING,
  },
  editRailWrap: {
    paddingHorizontal: 0,
  },
});
