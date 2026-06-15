import React from "react";
import { View, StyleSheet, ScrollView, ActivityIndicator, Pressable, Text } from "react-native";
import { ProductCard } from "@/components/product/ProductCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import type { Product } from "@/lib/types";

export type StoreProductSort = "newest" | "rating" | "sale" | "price_asc" | "price_desc";

const SORTS: { id: StoreProductSort; label: string }[] = [
  { id: "newest", label: "LATEST" },
  { id: "rating", label: "TOP RATED" },
  { id: "sale", label: "ON SALE" },
  { id: "price_asc", label: "PRICE" },
];

interface StoreProductsSectionProps {
  products: Product[];
  total: number;
  sort: StoreProductSort;
  onSortChange: (s: StoreProductSort) => void;
  loading: boolean;
  storeName: string;
}

export function StoreProductsSection({
  products,
  total,
  sort,
  onSortChange,
  loading,
  storeName,
}: StoreProductsSectionProps) {
  const handleSortPress = (id: StoreProductSort) => {
    if (id === "price_asc" && (sort === "price_asc" || sort === "price_desc")) {
      onSortChange(sort === "price_asc" ? "price_desc" : "price_asc");
      return;
    }
    onSortChange(id);
  };

  const isSortSelected = (id: StoreProductSort) => {
    if (id === "price_asc") return sort === "price_asc" || sort === "price_desc";
    return sort === id;
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>THE COLLECTION</Text>
        <Text style={styles.title}>Curated pieces</Text>
        <Text style={styles.subtitle}>
          {total} {total === 1 ? "piece" : "pieces"} · curated by {storeName}
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.sortScroll}
      >
        {SORTS.map((s) => {
          const selected = isSortSelected(s.id);
          return (
            <Pressable
              key={s.id}
              onPress={() => handleSortPress(s.id)}
              style={[styles.sortPill, selected ? styles.sortPillActive : styles.sortPillIdle]}
            >
              <Text style={[styles.sortText, selected ? styles.sortTextActive : styles.sortTextIdle]}>
                {s.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.olive[600]} />
        </View>
      ) : products.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            icon="cube-outline"
            title="No pieces yet"
            description="This boutique is curating its next drop — check back soon."
          />
        </View>
      ) : (
        <View style={styles.grid}>
          {products.map((p) => (
            <View key={p.id} style={styles.cell}>
              <ProductCard product={p} />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingBottom: spacing[8],
  },
  header: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
    paddingBottom: spacing[3],
    gap: 2,
  },
  eyebrow: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.light.mutedForeground,
    textTransform: "uppercase",
  },
  title: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 26,
    lineHeight: 32,
    color: colors.light.foreground,
    letterSpacing: -0.3,
    marginTop: 2,
  },
  subtitle: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    color: colors.light.mutedForeground,
    marginTop: 2,
  },
  sortScroll: {
    paddingHorizontal: spacing[5],
    gap: spacing[2],
    paddingBottom: spacing[4],
  },
  sortPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.full,
  },
  sortPillActive: {
    backgroundColor: colors.olive[700],
  },
  sortPillIdle: {
    backgroundColor: colors.light.secondary,
  },
  sortText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 0.6,
  },
  sortTextActive: {
    color: "#fff",
  },
  sortTextIdle: {
    color: colors.light.foreground,
  },
  loading: {
    paddingVertical: spacing[10],
    alignItems: "center",
  },
  emptyWrap: {
    marginTop: spacing[4],
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: spacing[4],
    gap: spacing[3],
    rowGap: spacing[4],
  },
  cell: {
    flexBasis: "47.5%",
    flexGrow: 1,
  },
});
