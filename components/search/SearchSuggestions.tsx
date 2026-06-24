import React, { useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  type ListRenderItem,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@/components/ui/Icon";
import { fontFamilies } from "@/lib/theme/fonts";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import type { V2Suggestion, WishlistPriceDrop } from "@/lib/api";
import { formatPrice } from "@/lib/utils";

const INK = "#1b1c1c";
const MUTED = "#5e5e5d";

interface SearchSuggestionsProps {
  draft: string;
  suggestions: V2Suggestion[];
  localSuggestions: V2Suggestion[];
  loading: boolean;
  priceDrops: WishlistPriceDrop[];
  onSelect: (suggestion: V2Suggestion) => void;
  onSearchDraft: () => void;
  onImageSearch: () => void;
  onCameraSearch: () => void;
  onPriceDropPress?: (drop: WishlistPriceDrop) => void;
}

type Row =
  | { type: "search"; label: string }
  | { type: "suggestion"; item: V2Suggestion }
  | { type: "loading" }
  | { type: "empty" };

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
  onPriceDropPress,
}: SearchSuggestionsProps) {
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

  const term = draft.trim();
  if (term.length < 1) return null;

  const rows: Row[] = [{ type: "search", label: term }];
  if (loading && merged.length === 0) {
    rows.push({ type: "loading" });
  } else if (!loading && merged.length === 0) {
    rows.push({ type: "empty" });
  } else {
    for (const item of merged) {
      rows.push({ type: "suggestion", item });
    }
  }

  const renderItem: ListRenderItem<Row> = ({ item: row }) => {
    if (row.type === "search") {
      return (
        <TouchableOpacity style={styles.item} activeOpacity={0.7} onPress={onSearchDraft}>
          <View style={styles.searchIconWrap}>
            <Ionicons name="search" size={18} color={colors.light.primary} />
          </View>
          <Text style={styles.searchDraftText}>
            Search for <Text style={styles.searchDraftTerm}>“{row.label}”</Text>
          </Text>
          <Ionicons name="arrow-forward" size={16} color={MUTED} />
        </TouchableOpacity>
      );
    }

    if (row.type === "loading") {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.light.primary} />
          <Text style={styles.loadingText}>Finding matches…</Text>
        </View>
      );
    }

    if (row.type === "empty") {
      return (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No suggestions — press search to see all results</Text>
        </View>
      );
    }

    const item = row.item;
    const isStore = item.kind === "store" || item.kind === "brand";

    return (
      <TouchableOpacity
        style={styles.item}
        activeOpacity={0.7}
        onPress={() => onSelect(item)}
      >
        {isStore ? (
          item.logo_url ? (
            <Image source={{ uri: item.logo_url }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarFallbackText}>{item.label.charAt(0).toUpperCase()}</Text>
            </View>
          )
        ) : (
          <View style={styles.searchIconWrap}>
            <Ionicons name="search-outline" size={16} color={colors.light.mutedForeground} />
          </View>
        )}

        <View style={styles.itemCopy}>
          {isStore ? (
            <>
              <View style={styles.titleRow}>
                {highlightMatch(item.label, term, styles.storeMatch, styles.storeRegular)}
                {item.is_verified ? (
                  <Ionicons name="checkmark-circle" size={14} color={colors.accent2.rust} style={styles.verifiedIcon} />
                ) : null}
              </View>
              <Text style={styles.followersText}>
                {(item.followers ?? 0).toLocaleString()} followers
              </Text>
            </>
          ) : (
            highlightMatch(item.label, term)
          )}
        </View>

        {item.count !== undefined && item.count > 0 ? (
          <Text style={styles.countText}>{item.count.toLocaleString()}</Text>
        ) : null}
        <Ionicons name="chevron-forward" size={16} color={MUTED} />
      </TouchableOpacity>
    );
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
          if (row.type === "search") return "search";
          if (row.type === "loading") return "loading";
          if (row.type === "empty") return "empty";
          return `s-${row.item.kind}-${row.item.label}-${index}`;
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
    paddingBottom: spacing[8],
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[2],
    paddingVertical: spacing[6],
  },
  loadingText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    color: MUTED,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3.5],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ececec",
    gap: spacing[2],
  },
  searchIconWrap: {
    width: 32,
    alignItems: "center",
  },
  searchDraftText: {
    flex: 1,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 15,
    color: INK,
  },
  searchDraftTerm: {
    fontFamily: fontFamilies.sans.semibold,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: "#f5f5f5",
  },
  avatarFallback: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: colors.olive[100],
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFallbackText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 14,
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
    color: colors.light.mutedForeground,
  },
  itemLabel: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 15,
    color: "#4a4a4a",
  },
  itemLabelMatch: {
    fontFamily: fontFamilies.sans.bold,
    color: INK,
  },
  storeRegular: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 14,
    color: colors.light.mutedForeground,
    textTransform: "uppercase",
  },
  storeMatch: {
    fontFamily: fontFamilies.sans.bold,
    color: INK,
    textTransform: "uppercase",
  },
  countText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.light.mutedForeground,
  },
  empty: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[6],
    alignItems: "center",
  },
  emptyText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    color: MUTED,
    textAlign: "center",
  },
  dropsWrap: {
    backgroundColor: "rgba(27,28,28,0.04)",
    paddingTop: spacing[3],
    paddingBottom: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ececec",
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
