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
import Ionicons from "@expo/vector-icons/Ionicons";
import { fontFamilies } from "@/lib/theme/fonts";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import type { SearchSuggestion } from "@/lib/api";

const INK = "#1b1c1c";
const MUTED = "#5e5e5d";

interface SearchSuggestionsProps {
  draft: string;
  suggestions: SearchSuggestion[];
  localSuggestions: SearchSuggestion[];
  loading: boolean;
  onSelect: (suggestion: SearchSuggestion) => void;
  onSearchDraft: () => void;
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
  onSelect,
  onSearchDraft,
}: SearchSuggestionsProps) {
  const merged = useMemo(() => {
    const seen = new Set<string>();
    const items: SearchSuggestion[] = [];

    // Prioritize API suggestions which have database details like counts, store followers
    for (const item of [...suggestions, ...localSuggestions]) {
      const key = item.label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(item);
    }

    return items.slice(0, 10);
  }, [localSuggestions, suggestions]);

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

        {merged.map((item) => {
          const isStoreOrBrand = item.type === "store" || item.type === "brand";

          if (isStoreOrBrand) {
            return (
              <TouchableOpacity
                key={item.id}
                style={styles.item}
                activeOpacity={0.8}
                onPress={() => onSelect(item)}
              >
                {/* Store/Brand avatar */}
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
                    {highlightMatch(
                      item.label,
                      term,
                      styles.storeMatch,
                      styles.storeRegular
                    )}
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
            );
          }

          // Query suggestions
          return (
            <TouchableOpacity
              key={item.id}
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
                <Text style={styles.countText}>{item.count}</Text>
              ) : null}
              <Ionicons
                name="arrow-up"
                size={16}
                color={colors.light.mutedForeground}
                style={styles.arrowIcon}
              />
            </TouchableOpacity>
          );
        })}

        {!loading && merged.length === 0 && term.length >= 2 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No matches found</Text>
          </View>
        ) : null}
      </ScrollView>
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
    transform: [{ rotate: "45deg" }],
    opacity: 0.6,
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
});
