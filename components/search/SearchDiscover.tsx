import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { fontFamilies } from "@/lib/theme/fonts";
import { colors, radii, spacing } from "@/lib/theme/tokens";

const INK = "#1b1c1c";
const MUTED = "#5e5e5d";

const TRENDING = ["Linen blazer", "Leather loafers", "Silk scarf", "Resort '26", "Vintage denim", "Hoodie"];

const QUICK_CATEGORIES = [
  { label: "Women", slug: "women" },
  { label: "Men", slug: "men" },
  { label: "Footwear", slug: "footwear" },
  { label: "Accessories", slug: "accessories" },
];

interface SearchDiscoverProps {
  recentSearches: string[];
  onSearch: (term: string) => void;
  onClearRecent: () => void;
}

export function SearchDiscover({ recentSearches, onSearch, onClearRecent }: SearchDiscoverProps) {
  const router = useRouter();

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.content}
    >
      {recentSearches.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent</Text>
            <TouchableOpacity onPress={onClearRecent} hitSlop={8}>
              <Text style={styles.clearText}>Clear</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.chipRow}>
            {recentSearches.slice(0, 8).map((term) => (
              <TouchableOpacity
                key={term}
                style={styles.chip}
                onPress={() => onSearch(term)}
                activeOpacity={0.7}
              >
                <Ionicons name="time-outline" size={14} color={MUTED} />
                <Text style={styles.chipText}>{term}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Trending</Text>
        {TRENDING.map((term, index) => (
          <TouchableOpacity
            key={term}
            style={[styles.trendRow, index === TRENDING.length - 1 && styles.trendRowLast]}
            onPress={() => onSearch(term)}
            activeOpacity={0.7}
          >
            <Text style={styles.trendRank}>{index + 1}</Text>
            <Text style={styles.trendLabel}>{term}</Text>
            <Ionicons name="trending-up" size={14} color={colors.olive[600]} />
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Browse</Text>
        <View style={styles.chipRow}>
          {QUICK_CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.slug}
              style={styles.categoryChip}
              onPress={() => router.push(`/(main)/products?category=${cat.slug}`)}
              activeOpacity={0.7}
            >
              <Text style={styles.categoryChipText}>{cat.label}</Text>
              <Ionicons name="chevron-forward" size={14} color={MUTED} />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[2],
    paddingBottom: spacing[12],
    gap: spacing[6],
  },
  section: {
    gap: spacing[3],
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 15,
    color: INK,
  },
  clearText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 13,
    color: colors.light.primary,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[2],
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.full,
    backgroundColor: colors.light.muted,
    maxWidth: "100%",
  },
  chipText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 14,
    color: INK,
  },
  trendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ececec",
  },
  trendRowLast: {
    borderBottomWidth: 0,
  },
  trendRank: {
    width: 22,
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14,
    color: MUTED,
  },
  trendLabel: {
    flex: 1,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 15,
    color: INK,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.lg,
    backgroundColor: colors.light.muted,
  },
  categoryChipText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 14,
    color: INK,
  },
});
