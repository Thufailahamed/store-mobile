import React, { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import { ProductCard } from "@/components/product/ProductCard";
import {
  EMPTY_STORE_FILTERS,
  STORE_SORTS,
  activeStoreFilterChips,
  applyStoreCatalogue,
  buildStoreFacets,
  countActiveStoreFilters,
  type StoreFilters,
  type StoreSort,
} from "@/lib/store-catalogue";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import type { Product } from "@/lib/types";
import { StoreFilterSheet } from "./StoreFilterSheet";

const PAGE = 12;
const GOLD_HAIRLINE = "rgba(200,164,74,0.28)";

type IconName = keyof typeof Ionicons.glyphMap;

export interface StoreShopHandle {
  focusSearch: () => void;
}

/**
 * The store's own shop: search, category pills, filter & sort sheet, active
 * chips, grid/list toggle and paged results. Everything runs client-side over
 * the store's full catalogue through `lib/store-catalogue` (same engine as web).
 */
export const StoreShop = forwardRef<StoreShopHandle, {
  storeName: string;
  products: Product[];
  loading: boolean;
  /** Rendered when the store has no products at all (not merely no matches). */
  emptyStore: React.ReactNode;
}>(function StoreShop({ storeName, products: raw, loading, emptyStore }, ref) {
  const { width } = useWindowDimensions();
  const cellWidth = (width - 32 - 12) / 2;
  const inputRef = useRef<TextInput>(null);

  const [filters, setFilters] = useState<StoreFilters>(EMPTY_STORE_FILTERS);
  const [sort, setSort] = useState<StoreSort>("curated");
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [visible, setVisible] = useState(PAGE);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [focused, setFocused] = useState(false);

  useImperativeHandle(ref, () => ({ focusSearch: () => inputRef.current?.focus() }), []);

  // Some catalogue rows bake " - <Store>" into the name; redundant on the store's own page.
  const products = useMemo(() => {
    const suffix = storeName ? ` - ${storeName}` : null;
    if (!suffix) return raw;
    return raw.map((p) => (p.name.endsWith(suffix) ? { ...p, name: p.name.slice(0, -suffix.length).trim() } : p));
  }, [raw, storeName]);

  const currency = products[0]?.currency ?? "LKR";
  const facets = useMemo(() => buildStoreFacets(products), [products]);
  const results = useMemo(() => applyStoreCatalogue(products, filters, sort), [products, filters, sort]);
  const activeCount = countActiveStoreFilters(filters);
  const chips = activeStoreFilterChips(filters, facets, update, currency);
  const sortLabel = STORE_SORTS.find((s) => s.value === sort)?.label ?? "Curated";
  const shown = results.slice(0, visible);

  function update(next: StoreFilters) {
    setFilters(next);
    setVisible(PAGE);
  }

  const pickCategory = (value: string | null) =>
    update({ ...filters, categories: value ? [value] : [] });

  const clearAll = () => update({ ...EMPTY_STORE_FILTERS });

  return (
    <View>
      {/* Heading */}
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <View style={styles.eyebrowRow}>
            <View style={styles.eyebrowRule} />
            <Text style={styles.eyebrow}>THE COLLECTION</Text>
          </View>
          <Text style={styles.title}>
            The <Text style={styles.titleItalic}>edit</Text>
          </Text>
        </View>
      </View>

      {/* Search + filter */}
      <View style={styles.searchRow}>
        <View style={[styles.search, focused && styles.searchFocused]}>
          <Ionicons name="search" size={17} color={focused ? colors.ink.DEFAULT : colors.ink.mute} />
          <TextInput
            ref={inputRef}
            value={filters.query}
            onChangeText={(query) => update({ ...filters, query })}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={`Search ${storeName || "this boutique"}`}
            placeholderTextColor="rgba(101,104,77,0.7)"
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            style={styles.searchInput}
            accessibilityLabel={`Search ${storeName}`}
          />
          {filters.query ? (
            <Pressable
              hitSlop={10}
              onPress={() => update({ ...filters, query: "" })}
              style={styles.searchClear}
              accessibilityLabel="Clear search"
            >
              <Ionicons name="close" size={13} color={colors.paper.cream} />
            </Pressable>
          ) : null}
        </View>
        <Pressable
          onPress={() => setSheetOpen(true)}
          style={({ pressed }) => [styles.filterBtn, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
          accessibilityLabel={activeCount ? `Filters, ${activeCount} active` : "Filter and sort"}
        >
          <LinearGradient colors={[colors.ink.soft, colors.ink.DEFAULT]} style={StyleSheet.absoluteFill} />
          <Ionicons name="options-outline" size={20} color={colors.paper.cream} />
          {activeCount ? (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeCount}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {/* Category pills */}
      {facets.categories.length > 1 || facets.onSaleCount > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pills}
          keyboardShouldPersistTaps="handled"
        >
          <Pill
            label="All"
            count={products.length}
            active={filters.categories.length === 0 && !filters.onSale}
            onPress={() => update({ ...filters, categories: [], onSale: false })}
          />
          {facets.onSaleCount > 0 ? (
            <Pill
              label="Sale"
              icon="pricetag"
              count={facets.onSaleCount}
              active={filters.onSale}
              sale
              onPress={() => update({ ...filters, onSale: !filters.onSale })}
            />
          ) : null}
          {facets.categories.length > 1
            ? facets.categories.map((c) => (
                <Pill
                  key={c.value}
                  label={c.label}
                  count={c.count}
                  active={filters.categories.length === 1 && filters.categories[0] === c.value}
                  onPress={() =>
                    pickCategory(filters.categories[0] === c.value && filters.categories.length === 1 ? null : c.value)
                  }
                />
              ))
            : null}
        </ScrollView>
      ) : null}

      {/* Toolbar */}
      <View style={styles.toolbar}>
        <Text style={styles.toolbarCount}>
          <Text style={styles.toolbarCountStrong}>{results.length}</Text>
          {results.length === 1 ? " piece" : " pieces"}
          {filters.query ? ` for “${filters.query.trim()}”` : ""}
        </Text>
        <Pressable
          onPress={() => setSheetOpen(true)}
          style={styles.sortBtn}
          accessibilityRole="button"
          accessibilityLabel={`Sort: ${sortLabel}`}
        >
          <Ionicons name="swap-vertical" size={14} color={colors.ink.DEFAULT} />
          <Text style={styles.sortBtnText} numberOfLines={1}>{sortLabel}</Text>
        </Pressable>
        <View style={styles.layoutToggle}>
          {(["grid", "list"] as const).map((mode) => (
            <Pressable
              key={mode}
              onPress={() => setLayout(mode)}
              style={[styles.layoutBtn, layout === mode && styles.layoutBtnActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: layout === mode }}
              accessibilityLabel={mode === "grid" ? "Grid view" : "List view"}
            >
              <Ionicons
                name={mode === "grid" ? "grid-outline" : "list-outline"}
                size={15}
                color={layout === mode ? colors.paper.cream : colors.ink.mute}
              />
            </Pressable>
          ))}
        </View>
      </View>

      {/* Active filter chips */}
      {chips.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {chips.map((chip) => (
            <Pressable key={chip.key} onPress={chip.clear} style={styles.chip} accessibilityLabel={`Remove ${chip.label}`}>
              <Text style={styles.chipText}>{chip.label}</Text>
              <Ionicons name="close" size={12} color={colors.ink.mute} />
            </Pressable>
          ))}
          <Pressable onPress={clearAll} style={styles.clearAll}>
            <Text style={styles.clearAllText}>Clear all</Text>
          </Pressable>
        </ScrollView>
      ) : null}

      {/* Results */}
      {loading && products.length === 0 ? (
        <View style={styles.grid}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={{ width: cellWidth }}>
              <Skeleton height={cellWidth * (4 / 3)} borderRadius={radii["2xl"]} />
              <Skeleton width="80%" height={14} borderRadius={6} style={{ marginTop: 10 }} />
              <Skeleton width="40%" height={14} borderRadius={6} style={{ marginTop: 6 }} />
            </View>
          ))}
        </View>
      ) : products.length === 0 ? (
        <View style={{ paddingHorizontal: spacing[4] }}>{emptyStore}</View>
      ) : results.length === 0 ? (
        <View style={styles.noMatch}>
          <View style={styles.noMatchIcon}>
            <Ionicons name="search-outline" size={22} color={colors.accent2.ochre} />
          </View>
          <Text style={styles.noMatchTitle}>No pieces match</Text>
          <Text style={styles.noMatchDesc}>
            {filters.query
              ? `Nothing in ${storeName} matches “${filters.query.trim()}”. Try another word or loosen the filters.`
              : "Try removing a filter or two to see more of the collection."}
          </Text>
          <Pressable onPress={clearAll} style={styles.noMatchBtn} accessibilityRole="button">
            <Text style={styles.noMatchBtnText}>Clear search & filters</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={layout === "grid" ? styles.grid : styles.list}>
            {shown.map((p) => (
              <View key={p.id} style={layout === "grid" ? { width: cellWidth } : undefined}>
                <ProductCard product={p} listMode={layout === "list"} />
              </View>
            ))}
          </View>
          {results.length > PAGE ? (
            <View style={styles.more}>
              <Text style={styles.moreText}>
                Showing {shown.length} of {results.length}
              </Text>
              <View style={styles.moreTrack}>
                <View style={[styles.moreFill, { width: `${(shown.length / results.length) * 100}%` }]} />
              </View>
              {shown.length < results.length ? (
                <Pressable
                  onPress={() => setVisible((v) => v + PAGE)}
                  style={({ pressed }) => [styles.moreBtn, pressed && { opacity: 0.8 }]}
                  accessibilityRole="button"
                >
                  <Text style={styles.moreBtnText}>Load more</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </>
      )}

      <StoreFilterSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        products={products}
        facets={facets}
        currency={currency}
        filters={filters}
        sort={sort}
        onApply={(next, nextSort) => {
          update(next);
          setSort(nextSort);
          setSheetOpen(false);
        }}
      />
    </View>
  );
});

function Pill({
  label,
  count,
  active,
  icon,
  sale,
  onPress,
}: {
  label: string;
  count: number;
  active: boolean;
  icon?: IconName;
  sale?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.pill, active && styles.pillActive, pressed && !active && { opacity: 0.7 }]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      {active ? (
        <LinearGradient colors={[colors.ink.soft, colors.ink.DEFAULT]} style={[StyleSheet.absoluteFill, { borderRadius: radii.full }]} />
      ) : null}
      {icon ? (
        <Ionicons name={icon} size={12} color={active ? colors.accent2.ochre : sale ? colors.accent2.rust : colors.ink.mute} />
      ) : null}
      <Text style={[styles.pillText, active && styles.pillTextActive, sale && !active && { color: colors.accent2.rust }]}>
        {label}
      </Text>
      <Text style={[styles.pillCount, active && styles.pillCountActive]}>{count}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    marginTop: spacing[6],
    marginBottom: spacing[4],
  },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  eyebrowRule: { width: 18, height: 1, backgroundColor: colors.accent2.ochre },
  eyebrow: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 10,
    letterSpacing: 2.2,
    color: colors.ink.mute,
  },
  title: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.6,
    color: colors.ink.DEFAULT,
    marginTop: 6,
  },
  titleItalic: { fontFamily: fontFamilies.display.italic, color: colors.olive[600] },

  searchRow: { flexDirection: "row", alignItems: "center", gap: spacing[2], paddingHorizontal: spacing[4] },
  search: {
    flex: 1,
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingLeft: 16,
    paddingRight: 12,
    borderRadius: radii.full,
    backgroundColor: colors.paper.cream,
    borderWidth: 1,
    borderColor: "rgba(22,23,15,0.08)",
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
  },
  searchFocused: { borderColor: colors.accent2.ochre, backgroundColor: "#fff" },
  searchInput: {
    flex: 1,
    height: "100%",
    fontFamily: fontFamilies.sans.medium,
    fontSize: 15,
    color: colors.ink.DEFAULT,
  },
  searchClear: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.ink.mute,
  },
  filterBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  filterBadge: {
    position: "absolute",
    top: 7,
    right: 7,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent2.ochre,
  },
  filterBadgeText: { fontFamily: fontFamilies.sans.bold, fontSize: 9.5, color: colors.ink.DEFAULT },

  pills: { gap: 8, paddingHorizontal: spacing[4], paddingTop: spacing[4] },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 38,
    paddingHorizontal: 15,
    borderRadius: radii.full,
    overflow: "hidden",
    backgroundColor: colors.paper.cream,
    borderWidth: 1,
    borderColor: "rgba(22,23,15,0.08)",
  },
  pillActive: { borderColor: "transparent" },
  pillText: { fontFamily: fontFamilies.sans.medium, fontSize: 13.5, color: colors.ink.DEFAULT },
  pillTextActive: { fontFamily: fontFamilies.sans.semibold, color: colors.paper.cream },
  pillCount: { fontFamily: fontFamilies.sans.semibold, fontSize: 11, color: colors.ink.mute },
  pillCountActive: { color: colors.accent2.ochre },

  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    marginHorizontal: spacing[4],
    marginTop: spacing[4],
    paddingTop: spacing[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(22,23,15,0.14)",
  },
  toolbarCount: { flex: 1, fontFamily: fontFamilies.sans.regular, fontSize: 13, color: colors.ink.mute },
  toolbarCountStrong: { fontFamily: fontFamilies.sans.bold, color: colors.ink.DEFAULT },
  sortBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 34,
    maxWidth: 170,
    paddingHorizontal: 12,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "rgba(22,23,15,0.12)",
  },
  sortBtnText: { fontFamily: fontFamilies.sans.semibold, fontSize: 12.5, color: colors.ink.DEFAULT },
  layoutToggle: {
    flexDirection: "row",
    padding: 3,
    borderRadius: radii.full,
    backgroundColor: colors.paper.warm,
  },
  layoutBtn: { width: 30, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  layoutBtnActive: { backgroundColor: colors.ink.DEFAULT },

  chips: { gap: 6, paddingHorizontal: spacing[4], paddingTop: spacing[3] },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 30,
    paddingHorizontal: 11,
    borderRadius: radii.full,
    backgroundColor: colors.olive[50],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(83,94,44,0.25)",
  },
  chipText: { fontFamily: fontFamilies.sans.medium, fontSize: 12, color: colors.olive[800] },
  clearAll: { height: 30, justifyContent: "center", paddingHorizontal: 6 },
  clearAllText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    color: colors.ink.DEFAULT,
    textDecorationLine: "underline",
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    rowGap: spacing[5],
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
  },
  list: { gap: spacing[3], paddingHorizontal: spacing[4], paddingTop: spacing[4] },

  noMatch: {
    alignItems: "center",
    marginHorizontal: spacing[4],
    marginTop: spacing[4],
    paddingVertical: spacing[8],
    paddingHorizontal: spacing[6],
    borderRadius: 26,
    backgroundColor: colors.paper.cream,
    borderWidth: 1,
    borderColor: GOLD_HAIRLINE,
  },
  noMatchIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.olive[900],
  },
  noMatchTitle: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 22,
    color: colors.ink.DEFAULT,
    marginTop: spacing[3],
  },
  noMatchDesc: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.ink.mute,
    textAlign: "center",
    marginTop: 6,
  },
  noMatchBtn: {
    marginTop: spacing[4],
    height: 44,
    paddingHorizontal: 20,
    borderRadius: radii.full,
    justifyContent: "center",
    backgroundColor: colors.ink.DEFAULT,
  },
  noMatchBtnText: { fontFamily: fontFamilies.sans.semibold, fontSize: 13.5, color: colors.paper.cream },

  more: { alignItems: "center", marginTop: spacing[8], paddingHorizontal: spacing[4] },
  moreText: { fontFamily: fontFamilies.sans.medium, fontSize: 12.5, color: colors.ink.mute },
  moreTrack: {
    width: 160,
    height: 2,
    marginTop: 10,
    borderRadius: 1,
    overflow: "hidden",
    backgroundColor: "rgba(22,23,15,0.1)",
  },
  moreFill: { height: "100%", backgroundColor: colors.ink.DEFAULT },
  moreBtn: {
    marginTop: spacing[4],
    height: 48,
    paddingHorizontal: 34,
    borderRadius: radii.full,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.ink.DEFAULT,
  },
  moreBtnText: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: colors.ink.DEFAULT },
});
