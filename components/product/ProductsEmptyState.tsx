import React from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { Display, Label, Body } from "@/components/ui/Typography";
import { Button } from "@/components/ui";
import { ProductCard } from "@/components/product/ProductCard";
import { colors, spacing } from "@/lib/theme/tokens";
import type { Product } from "@/lib/types";

interface ProductsEmptyStateProps {
  query: string | null;
  hasActiveFilters: boolean;
  picks: Product[];
  onClear: () => void;
  onClearFilters: () => void;
}

/**
 * Empty state for the products page. Mirrors the website's
 * `EmptyState`: shows a search ring, a one-line message, two clear
 * actions, and a "you might like" rail of bestseller picks.
 */
export function ProductsEmptyState({
  query,
  hasActiveFilters,
  picks,
  onClear,
  onClearFilters,
}: ProductsEmptyStateProps) {
  const router = useRouter();
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.ring}>
        <Ionicons name="search" size={28} color={colors.light.primary} style={{ opacity: 0.7 }} />
        <View style={styles.ringDot} />
      </View>

      <Label style={styles.kicker}>No matches</Label>
      <Display size="xl" style={styles.title}>
        Nothing <Display size="xl" italic>here</Display> yet.
      </Display>
      <Body muted size="sm" style={styles.subtitle}>
        {query
          ? `We couldn't find anything for "${query}". Try a different word, or clear your filters to see everything.`
          : "These filters are tighter than they need to be. Loosen them and try again."}
      </Body>

      <View style={styles.actions}>
        {hasActiveFilters ? (
          <Button variant="brand" size="sm" onPress={onClearFilters}>
            <Ionicons name="close" size={14} color="#fff" /> Clear filters
          </Button>
        ) : null}
        <Button variant="outline" size="sm" onPress={onClear}>
          Browse everything
        </Button>
      </View>

      {picks.length > 0 ? (
        <View style={styles.picksSection}>
          <View style={styles.picksHeader}>
            <View>
              <Label style={styles.picksKicker}>You might like</Label>
              <Display size="lg">Pieces our customers love</Display>
            </View>
            <TouchableOpacity onPress={() => router.push("/(main)")}>
              <Label style={styles.picksLink}>See all</Label>
            </TouchableOpacity>
          </View>
          <View style={styles.picksGrid}>
            {picks.slice(0, 4).map((p) => (
              <View key={p.id} style={styles.pickItem}>
                <ProductCard product={p} />
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    paddingTop: spacing[8],
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[10],
    alignItems: "center",
  },
  ring: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.light.muted,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing[5],
    overflow: "hidden",
  },
  ringDot: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent2.rust,
  },
  kicker: {
    color: colors.light.primary,
    marginBottom: spacing[2],
  },
  title: {
    textAlign: "center",
  },
  subtitle: {
    textAlign: "center",
    maxWidth: 320,
    marginTop: spacing[2],
    lineHeight: 20,
  },
  actions: {
    flexDirection: "row",
    gap: spacing[2],
    marginTop: spacing[5],
    flexWrap: "wrap",
    justifyContent: "center",
  },
  picksSection: {
    width: "100%",
    marginTop: spacing[10],
  },
  picksHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: spacing[4],
    gap: spacing[2],
  },
  picksKicker: {
    color: colors.light.primary,
    marginBottom: spacing[1],
  },
  picksLink: {
    color: colors.light.primary,
  },
  picksGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  pickItem: {
    width: "48%",
    marginBottom: spacing[4],
  },
});
