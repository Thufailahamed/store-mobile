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
import type { V2Suggestion, WishlistPriceDrop } from "@/lib/api";
import { formatPrice, discountPct } from "@/lib/utils";
import { expandQueryTerms } from "@/lib/utils/search-utils";
import {
  getDepartmentIntentChips,
  attrChipForPartial,
  POPULAR_SEARCH_TAGS,
  POPULAR_DEPARTMENTS,
  type DepartmentChip,
} from "@/lib/search/suggestion-engine";

import { C } from "@/components/orders/parcel-track";

const INK = C.text;
const MUTED = C.muted;
const SOFT = "#f5f3ec";

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

type GroupKind = "category" | "keyword" | "product" | "store";

type Row =
  | { type: "search"; label: string }
  | { type: "chips"; chips: DepartmentChip[] }
  | { type: "intent"; label: string; canonical: string }
  | { type: "group"; kind: GroupKind; title: string; items: V2Suggestion[] }
  | { type: "loading" }
  | { type: "emptyFallback"; term: string };

const GROUP_ICON: Record<GroupKind, keyof typeof Ionicons.glyphMap> = {
  category: "grid-outline",
  keyword: "search-outline",
  product: "pricetag-outline",
  store: "storefront-outline",
};

/** Bold the typed term only where it starts a word ("ts" → **T**-Shirts is
 *  fine, but not Boo**ts**), so fuzzy/typo matches don't light up random
 *  letters mid-word. */
function highlightMatch(label: string, query: string, styleMatch?: object, styleRegular?: object) {
  const term = query.trim().toLowerCase();
  const plain = (
    <Text style={[styles.itemLabel, styleRegular]} numberOfLines={1}>
      {label}
    </Text>
  );
  if (!term) return plain;

  const lower = label.toLowerCase();
  let idx = -1;
  for (let i = lower.indexOf(term); i >= 0; i = lower.indexOf(term, i + 1)) {
    if (i === 0 || !/[a-z0-9]/.test(lower[i - 1])) {
      idx = i;
      break;
    }
  }
  if (idx < 0) return plain;

  return (
    <Text style={[styles.itemLabel, styleRegular]} numberOfLines={1}>
      {label.slice(0, idx)}
      <Text style={[styles.itemLabelMatch, styleMatch]}>
        {label.slice(idx, idx + term.length)}
      </Text>
      {label.slice(idx + term.length)}
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
  // Smart-search attr chip (e.g. "red dr" → `red · dress`)
  const attrChip = useMemo(() => attrChipForPartial(term), [term]);

  // Build organized rows
  const rows = useMemo<Row[]>(() => {
    const list: Row[] = [];
    if (!term) return list;

    // 1. Primary "Search for ..." action row
    list.push({ type: "search", label: term });

    // 2. Department quick filter chips (All, Men's, Women's, Sale)
    if (departmentChips.length > 0) {
      list.push({ type: "chips", chips: departmentChips });
    }

    // 3. Smart intents — attr chip (e.g. `red · dress`) and gender+garment.
    //    Deduped by canonical query so both can't render the same row.
    const intents = new Map<string, string>();
    if (attrChip) intents.set(attrChip.query.toLowerCase(), attrChip.label);
    if (expanded.gender && expanded.garment) {
      const canonical = `${expanded.gender} ${expanded.garment}`;
      if (!intents.has(canonical.toLowerCase())) {
        intents.set(canonical.toLowerCase(), `${expanded.gender} ${expanded.garment}`);
      }
    }
    for (const [canonical, label] of intents) {
      list.push({ type: "intent", label, canonical });
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

    // 6. Partition suggestions into one card per section
    const groups: { kind: GroupKind; title: string; items: V2Suggestion[] }[] = [
      { kind: "category", title: "Categories", items: merged.filter((i) => i.kind === "category") },
      { kind: "keyword", title: "Suggested searches", items: merged.filter((i) => i.kind === "keyword") },
      { kind: "product", title: "Products", items: merged.filter((i) => i.kind === "product") },
      {
        kind: "store",
        title: "Designers & stores",
        items: merged.filter((i) => i.kind === "store" || i.kind === "brand"),
      },
    ];
    for (const g of groups) {
      if (g.items.length > 0) list.push({ type: "group", ...g });
    }

    return list;
  }, [term, departmentChips, attrChip, expanded, loading, merged]);

  if (!term) return null;

  const renderGroupItem = (kind: GroupKind, item: V2Suggestion, isLast: boolean) => {
    const rowStyle = [styles.groupRow, isLast && styles.groupRowLast];

    if (kind === "category") {
      return (
        <TouchableOpacity style={rowStyle} activeOpacity={0.7} onPress={() => onSelect(item)}>
          <View style={styles.iconCircle}>
            <Ionicons name="grid-outline" size={17} color={C.accent} />
          </View>
          <View style={styles.itemCopy}>{highlightMatch(item.label, term)}</View>
          <Ionicons name="chevron-forward" size={16} color={MUTED} />
        </TouchableOpacity>
      );
    }

    if (kind === "keyword") {
      return (
        <TouchableOpacity style={rowStyle} activeOpacity={0.7} onPress={() => onSelect(item)}>
          <View style={styles.iconCircleSoft}>
            <Ionicons name="search-outline" size={16} color={MUTED} />
          </View>
          <View style={styles.itemCopy}>{highlightMatch(item.label, term)}</View>
          <TouchableOpacity
            style={styles.fillBtn}
            hitSlop={8}
            accessibilityLabel={`Search ${item.label}`}
            onPress={() => onSearchDraftWith?.(item.label)}
          >
            <Ionicons
              name="arrow-up-outline"
              size={15}
              color={INK}
              style={{ transform: [{ rotate: "45deg" }] }}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      );
    }

    if (kind === "product") {
      const discount =
        item.price && item.mrp && item.mrp > item.price ? discountPct(item.mrp, item.price) : 0;
      return (
        <TouchableOpacity style={rowStyle} activeOpacity={0.7} onPress={() => onSelect(item)}>
          {item.logo_url ? (
            <Image
              source={{ uri: item.logo_url }}
              style={styles.productImage}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <View style={[styles.productImage, styles.productImageFallback]}>
              <Ionicons name="shirt-outline" size={20} color={MUTED} />
            </View>
          )}

          <View style={styles.itemCopy}>
            {item.brand ? (
              <Text style={styles.productBrand} numberOfLines={1}>
                {item.brand}
              </Text>
            ) : null}
            {highlightMatch(item.label, term, undefined, styles.productName)}
            {item.price ? (
              <View style={styles.productPriceRow}>
                <Text style={styles.productPrice}>{formatPrice(item.price)}</Text>
                {item.mrp && item.mrp > item.price ? (
                  <Text style={styles.productOldPrice}>{formatPrice(item.mrp)}</Text>
                ) : null}
                {discount > 0 ? (
                  <View style={styles.discountBadge}>
                    <Text style={styles.discountText}>−{discount}%</Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
          <Ionicons name="chevron-forward" size={16} color={MUTED} />
        </TouchableOpacity>
      );
    }

    // store / brand
    return (
      <TouchableOpacity style={rowStyle} activeOpacity={0.7} onPress={() => onSelect(item)}>
        {item.logo_url ? (
          <Image source={{ uri: item.logo_url }} style={styles.avatar} contentFit="cover" />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarFallbackText}>{item.label.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.itemCopy}>
          <View style={styles.titleRow}>
            <View style={{ flexShrink: 1 }}>{highlightMatch(item.label, term)}</View>
            {item.is_verified ? (
              <Ionicons name="checkmark-circle" size={14} color={C.accent} />
            ) : null}
          </View>
          <Text style={styles.subText} numberOfLines={1}>
            {(item.followers ?? 0) > 0
              ? `${(item.followers ?? 0).toLocaleString()} followers`
              : item.kind === "brand"
                ? "Designer"
                : "Store"}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={MUTED} />
      </TouchableOpacity>
    );
  };

  const renderItem: ListRenderItem<Row> = ({ item: row }) => {
    // ── Primary Search Row ──
    if (row.type === "search") {
      return (
        <View style={styles.block}>
          <TouchableOpacity
            style={styles.primaryBtn}
            activeOpacity={0.85}
            onPress={onSearchDraft}
            accessibilityLabel={`Search for ${row.label}`}
          >
            <View style={styles.primaryIcon}>
              <Ionicons name="search" size={18} color={C.ink} />
            </View>
            <Text style={styles.primaryText} numberOfLines={1}>
              Search for <Text style={styles.primaryTerm}>“{row.label}”</Text>
            </Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      );
    }

    // ── Horizontal Department Quick Chips ──
    if (row.type === "chips") {
      return (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
          contentContainerStyle={styles.chipsRow}
          style={styles.chipsScroll}
        >
          {row.chips.map((chip) => (
            <TouchableOpacity
              key={chip.key}
              style={styles.chip}
              activeOpacity={0.75}
              onPress={() => onSearchDraftWith?.(chip.query)}
            >
              <Text style={styles.chipText}>{chip.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      );
    }

    // ── Smart Intent Row ──
    if (row.type === "intent") {
      return (
        <View style={styles.block}>
          <View style={styles.cardShadow}>
            <TouchableOpacity
              style={[styles.card, styles.intentCard]}
              activeOpacity={0.75}
              onPress={() => onSearchDraftWith?.(row.canonical)}
            >
              <View style={styles.intentIcon}>
                <Ionicons name="sparkles" size={17} color={C.lime} />
              </View>
              <View style={styles.itemCopy}>
                <Text style={styles.intentKicker}>Smart match</Text>
                <Text style={styles.intentText} numberOfLines={1}>
                  Shop {row.label}
                </Text>
              </View>
              <View style={styles.fillBtn}>
                <Ionicons name="arrow-forward" size={15} color={INK} />
              </View>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // ── Grouped section card ──
    if (row.type === "group") {
      return (
        <View style={styles.block}>
          <View style={styles.groupHead}>
            <Ionicons name={GROUP_ICON[row.kind]} size={14} color={MUTED} />
            <Text style={styles.groupTitle}>{row.title}</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{row.items.length}</Text>
            </View>
          </View>
          <View style={styles.cardShadow}>
            <View style={styles.card}>
              {row.items.map((item, i) => (
                <React.Fragment key={`${item.kind}-${item.label}-${i}`}>
                  {renderGroupItem(row.kind, item, i === row.items.length - 1)}
                </React.Fragment>
              ))}
            </View>
          </View>
        </View>
      );
    }

    // ── Loading Indicator ──
    if (row.type === "loading") {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={INK} />
          <Text style={styles.loadingText}>Searching…</Text>
        </View>
      );
    }

    // ── Rich Empty Fallback State (Never a dead-end blank space) ──
    if (row.type === "emptyFallback") {
      return (
        <View style={styles.block}>
          <View style={styles.cardShadow}>
            <TouchableOpacity
              style={[styles.card, styles.intentCard]}
              activeOpacity={0.8}
              onPress={onSearchDraft}
            >
              <View style={styles.iconCircle}>
                <Ionicons name="search" size={17} color={C.accent} />
              </View>
              <View style={styles.itemCopy}>
                <Text style={styles.intentText}>Search the full catalogue</Text>
                <Text style={styles.subText} numberOfLines={2}>
                  No quick matches for “{row.term}” — see every product and collection.
                </Text>
              </View>
              <View style={styles.fillBtn}>
                <Ionicons name="arrow-forward" size={15} color={INK} />
              </View>
            </TouchableOpacity>
          </View>

          <Text style={styles.fallbackTitle}>Popular searches</Text>
          <View style={styles.wrapRow}>
            {POPULAR_SEARCH_TAGS.map((tag) => (
              <TouchableOpacity
                key={tag}
                style={styles.chip}
                activeOpacity={0.7}
                onPress={() => onSearchDraftWith?.(tag)}
              >
                <Ionicons name="trending-up" size={14} color={C.accent} />
                <Text style={styles.chipText}>{tag}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fallbackTitle}>Browse departments</Text>
          <View style={styles.wrapRow}>
            {POPULAR_DEPARTMENTS.map((dept) => (
              <TouchableOpacity
                key={dept.label}
                style={styles.chip}
                activeOpacity={0.7}
                onPress={() => onSearchDraftWith?.(dept.label)}
              >
                <Text style={styles.chipText}>{dept.label}</Text>
              </TouchableOpacity>
            ))}
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
          <View style={styles.groupHead}>
            <Ionicons name="trending-down" size={14} color={MUTED} />
            <Text style={styles.groupTitle}>Price drops on your wishlist</Text>
          </View>
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
                  <View style={[styles.dropImage, styles.productImageFallback]}>
                    <Ionicons name="image-outline" size={20} color={MUTED} />
                  </View>
                )}
                <View style={styles.dropPct}>
                  <Text style={styles.dropPctText}>−{d.drop_pct}%</Text>
                </View>
                <Text style={styles.dropName} numberOfLines={1}>
                  {d.name}
                </Text>
                <View style={styles.dropPriceRow}>
                  <Text style={styles.dropNewPrice}>{formatPrice(d.new_price)}</Text>
                  <Text style={styles.dropOldPrice}>{formatPrice(d.old_price)}</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      ) : null}

      <FlatList
        data={rows}
        keyExtractor={(row) => {
          if (row.type === "intent") return `row-intent-${row.canonical}`;
          if (row.type === "group") return `row-group-${row.kind}`;
          return `row-${row.type}`;
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

const PAD = 20;

const styles = StyleSheet.create({
  panel: { flex: 1, backgroundColor: "transparent" },
  listContent: { paddingTop: 6, paddingBottom: 48 },
  block: { paddingHorizontal: PAD, marginBottom: 12 },

  // ── Primary search pill ──
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    height: 60,
    paddingLeft: 8,
    paddingRight: 20,
    borderRadius: 30,
    backgroundColor: C.ink,
    borderCurve: "continuous",
  },
  primaryIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.lime,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: {
    flex: 1,
    fontFamily: fontFamilies.sans.medium,
    fontSize: 15,
    color: "rgba(255,255,255,0.65)",
  },
  primaryTerm: { fontFamily: fontFamilies.sans.bold, color: "#FFFFFF" },

  // ── Chips ──
  chipsScroll: { flexGrow: 0, marginBottom: 12 },
  chipsRow: { paddingHorizontal: PAD, gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 42,
    paddingHorizontal: 16,
    borderRadius: 21,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
  },
  chipText: { fontFamily: fontFamilies.sans.semibold, fontSize: 13.5, color: INK },
  wrapRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },

  // ── Cards ──
  cardShadow: {
    borderRadius: 26,
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 3,
  },
  card: {
    backgroundColor: C.card,
    borderRadius: 26,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: C.line,
    paddingHorizontal: 14,
    overflow: "hidden",
  },

  // ── Intent ──
  intentCard: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 },
  intentIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  intentKicker: { fontFamily: fontFamilies.sans.medium, fontSize: 12, color: MUTED },
  intentText: { fontFamily: fontFamilies.sans.semibold, fontSize: 15, color: INK, marginTop: 1 },

  // ── Group header ──
  groupHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 4,
    marginTop: 6,
    marginBottom: 10,
  },
  groupTitle: { flex: 1, fontFamily: fontFamilies.sans.semibold, fontSize: 13, color: MUTED },
  countBadge: {
    minWidth: 24,
    height: 22,
    paddingHorizontal: 7,
    borderRadius: 11,
    backgroundColor: C.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  countText: { fontFamily: fontFamilies.sans.bold, fontSize: 11.5, color: C.accent },

  // ── Group rows ──
  groupRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 64,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  groupRowLast: { borderBottomWidth: 0 },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  iconCircleSoft: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: SOFT,
    alignItems: "center",
    justifyContent: "center",
  },
  fillBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: SOFT,
    alignItems: "center",
    justifyContent: "center",
  },
  itemCopy: { flex: 1, minWidth: 0, justifyContent: "center" },
  itemLabel: { fontFamily: fontFamilies.sans.medium, fontSize: 15, color: "#4a4b44" },
  itemLabelMatch: { fontFamily: fontFamilies.sans.bold, color: INK },
  subText: { fontFamily: fontFamilies.sans.regular, fontSize: 12.5, color: MUTED, marginTop: 2 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 4 },

  // ── Product ──
  productImage: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: SOFT,
  },
  productImageFallback: { alignItems: "center", justifyContent: "center" },
  productBrand: { fontFamily: fontFamilies.sans.medium, fontSize: 12, color: MUTED, marginBottom: 1 },
  productName: { fontFamily: fontFamilies.sans.medium, fontSize: 14.5, color: INK },
  productPriceRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
  productPrice: { fontFamily: fontFamilies.sans.bold, fontSize: 13.5, color: INK },
  productOldPrice: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11.5,
    color: MUTED,
    textDecorationLine: "line-through",
  },
  discountBadge: {
    height: 20,
    paddingHorizontal: 7,
    borderRadius: 10,
    backgroundColor: C.lime,
    justifyContent: "center",
  },
  discountText: { fontFamily: fontFamilies.sans.bold, fontSize: 11, color: C.ink },

  // ── Store ──
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: SOFT },
  avatarFallback: { backgroundColor: C.ink, alignItems: "center", justifyContent: "center" },
  avatarFallbackText: { fontFamily: fontFamilies.sans.bold, fontSize: 15, color: C.lime },

  // ── Loading ──
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 32,
  },
  loadingText: { fontFamily: fontFamilies.sans.medium, fontSize: 13.5, color: MUTED },

  // ── Empty fallback ──
  fallbackTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: MUTED,
    marginTop: 22,
    marginBottom: 10,
    paddingHorizontal: 4,
  },

  // ── Wishlist price drops ──
  dropsWrap: { paddingTop: 6, paddingBottom: 6 },
  dropsRow: { paddingHorizontal: PAD, gap: 10, paddingBottom: 12 },
  dropCard: {
    width: 136,
    backgroundColor: C.card,
    borderRadius: 20,
    borderCurve: "continuous",
    padding: 8,
    borderWidth: 1,
    borderColor: C.line,
  },
  dropImage: { width: "100%", height: 96, borderRadius: 14, backgroundColor: SOFT, marginBottom: 8 },
  dropPct: {
    position: "absolute",
    top: 14,
    left: 14,
    height: 22,
    paddingHorizontal: 8,
    borderRadius: 11,
    backgroundColor: C.lime,
    justifyContent: "center",
  },
  dropPctText: { fontFamily: fontFamilies.sans.bold, fontSize: 11, color: C.ink },
  dropName: { fontFamily: fontFamilies.sans.semibold, fontSize: 12.5, color: INK, marginBottom: 2 },
  dropPriceRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  dropNewPrice: { fontFamily: fontFamilies.sans.bold, fontSize: 12.5, color: INK },
  dropOldPrice: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: MUTED,
    textDecorationLine: "line-through",
  },
});
