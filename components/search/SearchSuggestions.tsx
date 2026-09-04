import React, { useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  ScrollView,
  type ListRenderItem,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@/components/ui/Icon";
import { fontFamilies } from "@/lib/theme/fonts";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import type { V2Suggestion, WishlistPriceDrop } from "@/lib/api";
import { formatPrice, discountPct } from "@/lib/utils";
import { expandQueryTerms } from "@/lib/utils/search-utils";
import {
  getDepartmentIntentChips,
  POPULAR_SEARCH_TAGS,
  POPULAR_DEPARTMENTS,
  type DepartmentChip,
} from "@/lib/search/suggestion-engine";

const INK = "#1b1c1c";
const MUTED = "#686866";
const LIGHT_BG = "#fbfaf7";

interface SearchSuggestionsProps {
  draft: string;
  suggestions: V2Suggestion[];
  localSuggestions: V2Suggestion[];
  loading: boolean;
  priceDrops: WishlistPriceDrop[];
  onSelect: (suggestion: V2Suggestion) => void;
  onSearchDraft: () => void;
  onSearchDraftWith?: (term: string) => void;
  onImageSearch: () => void;
  onCameraSearch: () => void;
  onPriceDropPress?: (drop: WishlistPriceDrop) => void;
}

type Row =
  | { type: "search"; label: string }
  | { type: "chips"; chips: DepartmentChip[] }
  | { type: "intent"; label: string; canonical: string }
  | { type: "sectionHeader"; title: string; count?: number }
  | { type: "category"; item: V2Suggestion }
  | { type: "keyword"; item: V2Suggestion }
  | { type: "product"; item: V2Suggestion }
  | { type: "store"; item: V2Suggestion }
  | { type: "loading" }
  | { type: "emptyFallback"; term: string };

function highlightMatch(label: string, query: string, styleMatch?: object, styleRegular?: object) {
  const term = query.trim();
  if (!term) return <Text style={[styles.itemLabel, styleRegular]}>{label}</Text>;

  const lower = label.toLowerCase();
  const idx = lower.indexOf(term.toLowerCase());
  if (idx < 0) return <Text style={[styles.itemLabel, styleRegular]}>{label}</Text>;

  const before = label.slice(0, idx);
  const match = label.slice(idx, idx + term.length);
  const after = label.slice(idx + term.length);

  return (
    <Text style={[styles.itemLabel, styleRegular]} numberOfLines={1}>
      {before}
      <Text style={[styles.itemLabelMatch, styleMatch]}>{match}</Text>
      {after}
    </Text>
  );
}

export function SearchSuggestions({
  draft,
  suggestions,
  localSuggestions,
  loading,
  priceDrops,
  onSelect,
  onSearchDraft,
  onSearchDraftWith,
  onPriceDropPress,
}: SearchSuggestionsProps) {
  const term = draft.trim();

  // Deduplicate and prioritize suggestions
  const merged = useMemo(() => {
    const seen = new Set<string>();
    const items: V2Suggestion[] = [];
    for (const item of [...localSuggestions, ...suggestions]) {
      const key = `${item.kind}::${item.label.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(item);
    }
    return items;
  }, [localSuggestions, suggestions]);

  // Demographic & garment intent mapping
  const expanded = useMemo(() => expandQueryTerms(term), [term]);
  const departmentChips = useMemo(() => getDepartmentIntentChips(term), [term]);

  if (term.length < 1) return null;

  // Build organized rows
  const rows = useMemo<Row[]>(() => {
    const list: Row[] = [];

    // 1. Primary "Search for ..." action row
    list.push({ type: "search", label: term });

    // 2. Department quick filter chips (All, Men's, Women's, Sale)
    if (departmentChips.length > 0) {
      list.push({ type: "chips", chips: departmentChips });
    }

    // 3. Smart intent if detected from query expansion
    if (expanded.gender && expanded.garment) {
      list.push({
        type: "intent",
        label: `Shop ${expanded.gender} ${expanded.garment}`,
        canonical: `${expanded.gender} ${expanded.garment}`,
      });
    }

    // 4. If loading with 0 results
    if (loading && merged.length === 0) {
      list.push({ type: "loading" });
      return list;
    }

    // 5. If zero results after loading, show rich fallback instead of blank void
    if (!loading && merged.length === 0) {
      list.push({ type: "emptyFallback", term });
      return list;
    }

    // 6. Partition suggestions into organized sections
    const categories = merged.filter((item) => item.kind === "category");
    const keywords = merged.filter((item) => item.kind === "keyword");
    const products = merged.filter((item) => item.kind === "product");
    const stores = merged.filter((item) => item.kind === "store" || item.kind === "brand");

    // Categories first for quick navigation
    if (categories.length > 0) {
      list.push({ type: "sectionHeader", title: "CATEGORIES", count: categories.length });
      categories.forEach((item) => list.push({ type: "category", item }));
    }

    // Keywords / auto-completions
    if (keywords.length > 0) {
      list.push({ type: "sectionHeader", title: "SUGGESTED SEARCHES" });
      keywords.forEach((item) => list.push({ type: "keyword", item }));
    }

    // Products (instant product preview)
    if (products.length > 0) {
      list.push({ type: "sectionHeader", title: "PRODUCTS IN THE ATELIER", count: products.length });
      products.forEach((item) => list.push({ type: "product", item }));
    }

    // Brands / stores
    if (stores.length > 0) {
      list.push({ type: "sectionHeader", title: "DESIGNERS & ATELIERS" });
      stores.forEach((item) => list.push({ type: "store", item }));
    }

    return list;
  }, [term, departmentChips, expanded, loading, merged]);

  const renderItem: ListRenderItem<Row> = ({ item: row }) => {
    // ── Primary Search Row ──
    if (row.type === "search") {
      return (
        <TouchableOpacity
          style={styles.primarySearchRow}
          activeOpacity={0.7}
          onPress={onSearchDraft}
        >
          <View style={styles.primarySearchIconWrap}>
            <Ionicons name="search" size={17} color="#fff" />
          </View>
          <View style={styles.primarySearchCopy}>
            <Text style={styles.primarySearchAction}>Search for</Text>
            <Text style={styles.primarySearchTerm} numberOfLines={1}>“{row.label}”</Text>
          </View>
          <View style={styles.arrowWrap}>
            <Ionicons name="arrow-forward" size={16} color={INK} />
          </View>
        </TouchableOpacity>
      );
    }

    // ── Horizontal Department Quick Chips ──
    if (row.type === "chips") {
      return (
        <View style={styles.chipsRowContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="always"
            contentContainerStyle={styles.chipsScrollContent}
          >
            {row.chips.map((chip) => (
              <TouchableOpacity
                key={chip.key}
                style={styles.chipButton}
                activeOpacity={0.75}
                onPress={() => onSearchDraftWith?.(chip.query)}
              >
                <Text style={styles.chipText}>{chip.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      );
    }

    // ── Smart Intent Row ──
    if (row.type === "intent") {
      return (
        <TouchableOpacity
          style={styles.intentItem}
          activeOpacity={0.7}
          onPress={() => onSearchDraftWith?.(row.canonical)}
        >
          <View style={styles.intentIconWrap}>
            <Ionicons name="sparkles" size={15} color={colors.accent2.rust} />
          </View>
          <Text style={styles.intentText}>{row.label}</Text>
          <Ionicons name="arrow-forward" size={15} color={colors.accent2.rust} />
        </TouchableOpacity>
      );
    }

    // ── Section Header ──
    if (row.type === "sectionHeader") {
      return (
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeaderText}>{row.title}</Text>
          {row.count !== undefined && row.count > 0 ? (
            <Text style={styles.sectionHeaderCount}>{row.count}</Text>
          ) : null}
        </View>
      );
    }

    // ── Category Row ──
    if (row.type === "category") {
      return (
        <TouchableOpacity
          style={styles.categoryItem}
          activeOpacity={0.7}
          onPress={() => onSelect(row.item)}
        >
          <View style={styles.categoryIconWrap}>
            <Ionicons name="grid-outline" size={16} color={INK} />
          </View>
          <View style={styles.itemCopy}>
            {highlightMatch(row.item.label, term)}
          </View>
          <View style={styles.badgeWrap}>
            <Text style={styles.badgeText}>Category</Text>
          </View>
          <Ionicons name="chevron-forward" size={15} color={MUTED} />
        </TouchableOpacity>
      );
    }

    // ── Keyword / Auto-completion Row ──
    if (row.type === "keyword") {
      return (
        <TouchableOpacity
          style={styles.keywordItem}
          activeOpacity={0.7}
          onPress={() => onSelect(row.item)}
        >
          <View style={styles.keywordIconWrap}>
            <Ionicons name="search-outline" size={15} color={MUTED} />
          </View>
          <View style={styles.itemCopy}>
            {highlightMatch(row.item.label, term)}
          </View>
          <TouchableOpacity
            style={styles.completeArrowWrap}
            hitSlop={8}
            onPress={() => onSearchDraftWith?.(row.item.label)}
          >
            <Ionicons name="arrow-up-outline" size={15} color={MUTED} style={{ transform: [{ rotate: "45deg" }] }} />
          </TouchableOpacity>
        </TouchableOpacity>
      );
    }

    // ── Instant Product Preview Row ──
    if (row.type === "product") {
      const discount =
        row.item.price && row.item.mrp && row.item.mrp > row.item.price
          ? discountPct(row.item.mrp, row.item.price)
          : 0;

      return (
        <TouchableOpacity
          style={styles.productItem}
          activeOpacity={0.7}
          onPress={() => onSelect(row.item)}
        >
          {row.item.logo_url ? (
            <Image
              source={{ uri: row.item.logo_url }}
              style={styles.productImage}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <View style={styles.productImageFallback}>
              <Ionicons name="cube-outline" size={20} color={MUTED} />
            </View>
          )}

          <View style={styles.productCopy}>
            {row.item.brand ? (
              <Text style={styles.productBrand} numberOfLines={1}>
                {row.item.brand.toUpperCase()}
              </Text>
            ) : null}
            {highlightMatch(row.item.label, term, styles.productNameMatch, styles.productName)}

            {row.item.price ? (
              <View style={styles.productPriceRow}>
                <Text style={styles.productPrice}>{formatPrice(row.item.price)}</Text>
                {row.item.mrp && row.item.mrp > row.item.price ? (
                  <Text style={styles.productOldPrice}>{formatPrice(row.item.mrp)}</Text>
                ) : null}
                {discount > 0 ? (
                  <View style={styles.productDiscountBadge}>
                    <Text style={styles.productDiscountText}>{discount}% OFF</Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>

          <Ionicons name="chevron-forward" size={16} color={MUTED} />
        </TouchableOpacity>
      );
    }

    // ── Store / Designer Row ──
    if (row.type === "store") {
      return (
        <TouchableOpacity
          style={styles.storeItem}
          activeOpacity={0.7}
          onPress={() => onSelect(row.item)}
        >
          {row.item.logo_url ? (
            <Image source={{ uri: row.item.logo_url }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarFallbackText}>
                {row.item.label.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}

          <View style={styles.itemCopy}>
            <View style={styles.titleRow}>
              {highlightMatch(row.item.label, term, styles.storeMatch, styles.storeRegular)}
              {row.item.is_verified ? (
                <Ionicons
                  name="checkmark-circle"
                  size={14}
                  color={colors.accent2.rust}
                  style={styles.verifiedIcon}
                />
              ) : null}
            </View>
            <Text style={styles.followersText}>
              {(row.item.followers ?? 0) > 0
                ? `${(row.item.followers ?? 0).toLocaleString()} followers`
                : row.item.kind === "brand"
                ? "Atelier Designer"
                : "Verified Store"}
            </Text>
          </View>

          <View style={styles.badgeWrap}>
            <Text style={styles.badgeText}>
              {row.item.kind === "brand" ? "Atelier" : "Store"}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={15} color={MUTED} />
        </TouchableOpacity>
      );
    }

    // ── Loading Indicator ──
    if (row.type === "loading") {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={INK} />
          <Text style={styles.loadingText}>Searching the atelier…</Text>
        </View>
      );
    }

    // ── Rich Empty Fallback State (Never a dead-end blank space) ──
    if (row.type === "emptyFallback") {
      return (
        <View style={styles.fallbackContainer}>
          <TouchableOpacity
            style={styles.fallbackSearchBtn}
            activeOpacity={0.8}
            onPress={onSearchDraft}
          >
            <View style={styles.fallbackSearchIconWrap}>
              <Ionicons name="sparkles" size={16} color={colors.accent2.rust} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fallbackSearchTitle}>Search full catalogue</Text>
              <Text style={styles.fallbackSearchSubtitle}>
                Browse all products and collections for “{row.term}”
              </Text>
            </View>
            <Ionicons name="arrow-forward" size={16} color={INK} />
          </TouchableOpacity>

          <View style={styles.fallbackSection}>
            <Text style={styles.fallbackSectionTitle}>POPULAR SEARCHES</Text>
            <View style={styles.fallbackTagCloud}>
              {POPULAR_SEARCH_TAGS.map((tag) => (
                <TouchableOpacity
                  key={tag}
                  style={styles.fallbackTag}
                  activeOpacity={0.7}
                  onPress={() => onSearchDraftWith?.(tag)}
                >
                  <Ionicons name="trending-up" size={12} color={colors.accent2.rust} />
                  <Text style={styles.fallbackTagText}>{tag}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.fallbackSection}>
            <Text style={styles.fallbackSectionTitle}>BROWSE DEPARTMENTS</Text>
            <View style={styles.fallbackDeptsRow}>
              {POPULAR_DEPARTMENTS.map((dept) => (
                <TouchableOpacity
                  key={dept.label}
                  style={styles.fallbackDeptChip}
                  activeOpacity={0.7}
                  onPress={() => onSearchDraftWith?.(dept.label)}
                >
                  <Text style={styles.fallbackDeptText}>{dept.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      );
    }

    return null;
  };

  return (
    <View style={styles.panel}>
      {priceDrops.length > 0 ? (
        <View style={styles.dropsWrap}>
          <Text style={styles.dropsHeader}>Price drops on your wishlist</Text>
          <FlatList
            horizontal
            data={priceDrops}
            keyExtractor={(d) => d.product_id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dropsRow}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item: d }) => (
              <TouchableOpacity
                style={styles.dropCard}
                activeOpacity={0.85}
                onPress={() => onPriceDropPress?.(d)}
              >
                {d.image_url ? (
                  <Image source={{ uri: d.image_url }} style={styles.dropImage} contentFit="cover" />
                ) : (
                  <View style={[styles.dropImage, styles.dropImageFallback]}>
                    <Ionicons name="image-outline" size={20} color={MUTED} />
                  </View>
                )}
                <Text style={styles.dropName} numberOfLines={1}>{d.name}</Text>
                <View style={styles.dropPriceRow}>
                  <Text style={styles.dropNewPrice}>{formatPrice(d.new_price)}</Text>
                  <Text style={styles.dropOldPrice}>{formatPrice(d.old_price)}</Text>
                </View>
                <Text style={styles.dropPct}>{d.drop_pct}% OFF</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      ) : null}

      <FlatList
        data={rows}
        keyExtractor={(row, index) => {
          if (row.type === "search") return "row-search";
          if (row.type === "chips") return "row-chips";
          if (row.type === "intent") return `row-intent-${row.canonical}`;
          if (row.type === "sectionHeader") return `row-header-${row.title}`;
          if (row.type === "loading") return "row-loading";
          if (row.type === "emptyFallback") return "row-empty-fallback";
          return `row-${row.type}-${row.item.kind}-${row.item.label}-${index}`;
        }}
        renderItem={renderItem}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  listContent: {
    paddingBottom: spacing[10],
  },
  // ── Primary Search Row ──
  primarySearchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3.5],
    backgroundColor: LIGHT_BG,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ebe9e4",
    gap: spacing[3],
  },
  primarySearchIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: INK,
    alignItems: "center",
    justifyContent: "center",
  },
  primarySearchCopy: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  primarySearchAction: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 15,
    color: MUTED,
  },
  primarySearchTerm: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 15,
    color: INK,
  },
  arrowWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#ebe9e4",
    alignItems: "center",
    justifyContent: "center",
  },
  // ── Department Quick Chips ──
  chipsRowContainer: {
    paddingVertical: spacing[2.5],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f0eeea",
    backgroundColor: "#ffffff",
  },
  chipsScrollContent: {
    paddingHorizontal: spacing[4],
    gap: spacing[2],
  },
  chipButton: {
    paddingHorizontal: spacing[3],
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: LIGHT_BG,
    borderWidth: 1,
    borderColor: "#e6e4df",
  },
  chipText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12,
    color: INK,
  },
  // ── Intent Item ──
  intentItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    backgroundColor: "rgba(196,112,79,0.06)",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(196,112,79,0.15)",
    gap: spacing[3],
  },
  intentIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(196,112,79,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  intentText: {
    flex: 1,
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14,
    color: colors.accent2.rust,
  },
  // ── Section Header ──
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
    paddingBottom: spacing[1.5],
    backgroundColor: "#ffffff",
  },
  sectionHeaderText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 11,
    letterSpacing: 1.1,
    color: "#8a8987",
    textTransform: "uppercase",
  },
  sectionHeaderCount: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 11,
    color: MUTED,
  },
  // ── Category Item ──
  categoryItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f3f2ef",
    gap: spacing[3],
  },
  categoryIconWrap: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    backgroundColor: LIGHT_BG,
    alignItems: "center",
    justifyContent: "center",
  },
  // ── Keyword Item ──
  keywordItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f3f2ef",
    gap: spacing[3],
  },
  keywordIconWrap: {
    width: 32,
    alignItems: "center",
  },
  completeArrowWrap: {
    padding: 6,
  },
  // ── Product Item ──
  productItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2.5],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f3f2ef",
    gap: spacing[3],
  },
  productImage: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: "#f5f5f5",
  },
  productImageFallback: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: LIGHT_BG,
    alignItems: "center",
    justifyContent: "center",
  },
  productCopy: {
    flex: 1,
    justifyContent: "center",
  },
  productBrand: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 10,
    letterSpacing: 0.8,
    color: MUTED,
    marginBottom: 2,
  },
  productName: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 14,
    color: INK,
  },
  productNameMatch: {
    fontFamily: fontFamilies.sans.bold,
    color: INK,
  },
  productPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 3,
  },
  productPrice: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 13,
    color: INK,
  },
  productOldPrice: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: MUTED,
    textDecorationLine: "line-through",
  },
  productDiscountBadge: {
    backgroundColor: "rgba(196,112,79,0.1)",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radii.sm,
  },
  productDiscountText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 10,
    color: colors.accent2.rust,
  },
  // ── Store Item ──
  storeItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f3f2ef",
    gap: spacing[3],
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: radii.md,
    backgroundColor: "#f5f5f5",
  },
  avatarFallback: {
    width: 38,
    height: 38,
    borderRadius: radii.md,
    backgroundColor: colors.olive[100],
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFallbackText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 15,
    color: colors.light.primary,
  },
  itemCopy: {
    flex: 1,
    justifyContent: "center",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  verifiedIcon: {
    marginLeft: 4,
  },
  followersText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: MUTED,
  },
  badgeWrap: {
    backgroundColor: LIGHT_BG,
    borderWidth: 1,
    borderColor: "#e8e6e1",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.sm,
    marginRight: 4,
  },
  badgeText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 10,
    color: MUTED,
  },
  itemLabel: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 14,
    color: "#383838",
  },
  itemLabelMatch: {
    fontFamily: fontFamilies.sans.bold,
    color: INK,
  },
  storeRegular: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 14,
    color: MUTED,
    textTransform: "uppercase",
  },
  storeMatch: {
    fontFamily: fontFamilies.sans.bold,
    color: INK,
    textTransform: "uppercase",
  },
  // ── Loading ──
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[2],
    paddingVertical: spacing[8],
  },
  loadingText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    color: MUTED,
  },
  // ── Empty Fallback ──
  fallbackContainer: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
    gap: spacing[5],
  },
  fallbackSearchBtn: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing[3.5],
    backgroundColor: LIGHT_BG,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "#e8e6e1",
    gap: spacing[3],
  },
  fallbackSearchIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(196,112,79,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  fallbackSearchTitle: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 14,
    color: INK,
  },
  fallbackSearchSubtitle: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: MUTED,
    marginTop: 2,
  },
  fallbackSection: {
    gap: spacing[2],
  },
  fallbackSectionTitle: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 11,
    letterSpacing: 1.1,
    color: "#8a8987",
  },
  fallbackTagCloud: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[2],
  },
  fallbackTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing[3],
    paddingVertical: 7,
    borderRadius: radii.full,
    backgroundColor: LIGHT_BG,
    borderWidth: 1,
    borderColor: "#e8e6e1",
  },
  fallbackTagText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12,
    color: INK,
  },
  fallbackDeptsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[2],
  },
  fallbackDeptChip: {
    paddingHorizontal: spacing[3.5],
    paddingVertical: 8,
    borderRadius: radii.md,
    backgroundColor: LIGHT_BG,
    borderWidth: 1,
    borderColor: "#e8e6e1",
  },
  fallbackDeptText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    color: INK,
  },
  // ── Wishlist Price Drops ──
  dropsWrap: {
    backgroundColor: LIGHT_BG,
    paddingTop: spacing[3],
    paddingBottom: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ebe9e4",
  },
  dropsHeader: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: INK,
    paddingHorizontal: spacing[4],
    marginBottom: spacing[2],
  },
  dropsRow: {
    paddingHorizontal: spacing[4],
    gap: spacing[3],
  },
  dropCard: {
    width: 128,
    backgroundColor: "#fff",
    borderRadius: radii.lg,
    padding: spacing[2],
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  dropImage: {
    width: "100%",
    height: 88,
    borderRadius: radii.md,
    backgroundColor: "#f5f5f5",
    marginBottom: spacing[2],
  },
  dropImageFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  dropName: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12,
    color: INK,
    marginBottom: 2,
  },
  dropPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dropNewPrice: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 12,
    color: INK,
  },
  dropOldPrice: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: MUTED,
    textDecorationLine: "line-through",
  },
  dropPct: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 10,
    color: colors.olive[600],
    marginTop: 2,
  },
});
