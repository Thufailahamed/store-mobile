import React, { useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
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

function highlightMatch(label: string, query: string, styleMatch?: any, styleRegular?: any) {
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
  onImageSearch,
  onCameraSearch,
  onPriceDropPress,
}: SearchSuggestionsProps) {
  const merged = useMemo(() => {
    const seen = new Set<string>();
    const items: V2Suggestion[] = [];
    for (const item of [...suggestions, ...localSuggestions]) {
      const key = `${item.kind}::${item.label.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(item);
    }
    return items;
  }, [localSuggestions, suggestions]);

  const keywords = useMemo(() => merged.filter((i) => i.kind === "keyword"), [merged]);
  const stores = useMemo(() => merged.filter((i) => i.kind === "store" || i.kind === "brand"), [merged]);

  const term = draft.trim();
  if (term.length < 1) return null;

  return (
    <View style={styles.panel}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={styles.list}
        nestedScrollEnabled
      >
        {loading && merged.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.light.primary} />
          </View>
        ) : null}

        {/* ── Keyword rows ── */}
        {keywords.map((item) => {
          const trendUp = (item.trend_pct ?? 0) > 0;
          return (
            <TouchableOpacity
              key={`k-${item.label}`}
              style={styles.item}
              activeOpacity={0.8}
              onPress={() => onSelect(item)}
            >
              <View style={styles.searchIconWrap}>
                <Ionicons name="search-outline" size={16} color={colors.light.mutedForeground} />
              </View>
              <View style={styles.itemCopy}>
                {highlightMatch(item.label, term)}
              </View>
              {item.count !== undefined && item.count > 0 ? (
                <Text style={styles.countText}>{item.count.toLocaleString()}</Text>
              ) : null}
              <Ionicons
                name={trendUp ? "trending-up" : "trending-up-outline"}
                size={16}
                color={trendUp ? colors.olive[600] : colors.light.mutedForeground}
                style={styles.arrowIcon}
              />
            </TouchableOpacity>
          );
        })}

        {/* ── Wishlist price drops ── */}
        {priceDrops.length > 0 ? (
          <View style={styles.dropsWrap}>
            <Text style={styles.dropsHeader}>Price dropped on items you wishlisted</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.dropsRow}
            >
              {priceDrops.map((d) => (
                <TouchableOpacity
                  key={d.product_id}
                  style={styles.dropCard}
                  activeOpacity={0.85}
                  onPress={() => onPriceDropPress?.(d)}
                >
                  {d.image_url ? (
                    <Image source={{ uri: d.image_url }} style={styles.dropImage} contentFit="cover" transition={200} />
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
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* ── Store / brand rows ── */}
        {stores.map((item) => (
          <TouchableOpacity
            key={`s-${item.label}`}
            style={styles.item}
            activeOpacity={0.8}
            onPress={() => onSelect(item)}
          >
            {item.logo_url ? (
              <Image source={{ uri: item.logo_url }} style={styles.avatar} contentFit="cover" transition={200} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarFallbackText}>
                  {item.label.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}

            <View style={styles.itemCopy}>
              <View style={styles.titleRow}>
                {highlightMatch(item.label, term, styles.storeMatch, styles.storeRegular)}
                {item.is_verified && (
                  <Ionicons
                    name="checkmark-circle"
                    size={14}
                    color={colors.accent2.rust}
                    style={styles.verifiedIcon}
                  />
                )}
              </View>
              <Text style={styles.followersText}>
                {(item.followers ?? 0).toLocaleString()} followers
              </Text>
            </View>
          </TouchableOpacity>
        ))}

        {!loading && merged.length === 0 && term.length >= 2 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No matches found</Text>
          </View>
        ) : null}
      </ScrollView>

      {/* ── Bottom action buttons ── */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionBtn}
          activeOpacity={0.8}
          onPress={onImageSearch}
        >
          <Ionicons name="image-outline" size={20} color={INK} />
          <Text style={styles.actionText}>Image Search</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionBtn}
          activeOpacity={0.8}
          onPress={onCameraSearch}
        >
          <Ionicons name="camera-outline" size={20} color={INK} />
          <Text style={styles.actionText}>Camera Search</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  list: {
    flex: 1,
  },
  loadingContainer: {
    paddingVertical: spacing[4],
    alignItems: "center",
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3.5],
    borderBottomWidth: 0.5,
    borderBottomColor: "#f1f1f1",
  },
  searchIconWrap: {
    marginRight: spacing[3],
    opacity: 0.7,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: radii.md,
    marginRight: spacing[3],
    backgroundColor: "#f5f5f5",
  },
  avatarFallback: {
    width: 38,
    height: 38,
    borderRadius: radii.md,
    backgroundColor: colors.olive[100],
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing[3],
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
    fontSize: 14.5,
    color: "#4a4a4a",
  },
  itemLabelMatch: {
    fontFamily: fontFamilies.sans.bold,
    fontWeight: "700",
    color: INK,
  },
  storeRegular: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 14.5,
    color: colors.light.mutedForeground,
    textTransform: "uppercase",
  },
  storeMatch: {
    fontFamily: fontFamilies.sans.bold,
    fontWeight: "700",
    color: INK,
    textTransform: "uppercase",
  },
  countText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12.5,
    color: colors.light.mutedForeground,
    marginRight: spacing[3],
  },
  arrowIcon: {
    opacity: 0.85,
  },
  empty: {
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[8],
    alignItems: "center",
  },
  emptyText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    color: MUTED,
  },

  /* Wishlist price drops */
  dropsWrap: {
    backgroundColor: "rgba(27,28,28,0.04)",
    paddingTop: spacing[3],
    paddingBottom: spacing[4],
    borderBottomWidth: 0.5,
    borderBottomColor: "#ececec",
  },
  dropsHeader: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 14,
    color: INK,
    paddingHorizontal: spacing[5],
    marginBottom: spacing[3],
  },
  dropsRow: {
    paddingHorizontal: spacing[5],
    gap: spacing[3],
  },
  dropCard: {
    width: 132,
    backgroundColor: "#fff",
    borderRadius: radii.lg,
    padding: spacing[2],
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  dropImage: {
    width: "100%",
    height: 96,
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
    fontSize: 12.5,
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
    fontSize: 10.5,
    color: colors.olive[600],
    marginTop: 2,
  },

  /* Action buttons */
  actions: {
    flexDirection: "row",
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    paddingBottom: spacing[4],
    borderTopWidth: 0.5,
    borderTopColor: "#ececec",
    backgroundColor: "#fff",
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[2],
    height: 52,
    borderRadius: radii.full,
    backgroundColor: "#f6f6f6",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  actionText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14,
    color: INK,
  },
});
