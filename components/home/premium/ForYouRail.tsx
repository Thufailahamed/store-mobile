import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { HomeSectionHeader } from "./HomeSectionHeader";
import { HomeProductCard } from "./HomeProductCard";
import { useTrackEvent } from "@/lib/recommender";
import { colors, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import type { Product } from "@/lib/types";

interface ForYouRailProps {
  title: string;
  products: Product[];
  /** True when the rail is personalized (vs cold-start). */
  hasSignal?: boolean;
  loading?: boolean;
  onRefresh?: () => void | Promise<void>;
  onSeeAll?: () => void;
}

export function ForYouRail({
  title,
  products,
  hasSignal = true,
  loading = false,
  onRefresh,
  onSeeAll,
}: ForYouRailProps) {
  const tracker = useTrackEvent();
  const [refreshing, setRefreshing] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const visible = products.filter((p) => !hidden.has(p.id));

  const handleRefresh = useCallback(async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  const handleDismiss = useCallback(
    (product: Product) => {
      setHidden((prev) => new Set(prev).add(product.id));
      tracker.dismiss(product, "for_you_rail");
    },
    [tracker],
  );

  const handleNotInterested = useCallback(
    (product: Product) => {
      setHidden((prev) => new Set(prev).add(product.id));
      tracker.notInterested(product);
      Alert.alert("Got it", "We'll show fewer items like this.");
    },
    [tracker],
  );

  if (visible.length === 0 && !loading) return null;

  const left = (
    <View style={styles.titleBlock}>
      <View style={styles.kickerRow}>
        {hasSignal ? (
          <View style={styles.dotAccent} />
        ) : (
          <Ionicons name="sparkles-outline" size={11} color={colors.olive[600]} />
        )}
        <Text style={styles.kickerText}>{hasSignal ? "FOR YOU" : "TRENDING IN THE EDIT"}</Text>
      </View>
      <View style={styles.titleRow}>
        <Text style={[styles.title, hasSignal && styles.titleAccent]}>{title}</Text>
        {onRefresh ? (
          <TouchableOpacity
            onPress={handleRefresh}
            disabled={refreshing}
            hitSlop={10}
            style={styles.refreshBtn}
            accessibilityLabel="Refresh recommendations"
          >
            <Ionicons
              name="refresh"
              size={14}
              color={colors.light.mutedForeground}
              style={refreshing ? styles.spin : undefined}
            />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        {left}
        {onSeeAll ? (
          <TouchableOpacity onPress={onSeeAll} style={styles.seeAllBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-forward" size={18} color={colors.light.foreground} />
          </TouchableOpacity>
        ) : null}
      </View>
      {loading && visible.length === 0 ? (
        <View style={styles.loading}>
          <ActivityIndicator size="small" color={colors.olive[600]} />
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          {visible.map((p) => (
            <View key={p.id} style={styles.cardWrap}>
              <HomeProductCard product={p} showSaleBadge />
              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => handleDismiss(p)}
                  hitSlop={6}
                  accessibilityLabel="Dismiss"
                >
                  <Ionicons name="close" size={12} color={colors.light.mutedForeground} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => handleNotInterested(p)}
                  hitSlop={6}
                  accessibilityLabel="Not interested"
                >
                  <Ionicons name="thumbs-down-outline" size={12} color={colors.light.mutedForeground} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing[6],
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: spacing[5],
    marginBottom: spacing[3],
  },
  titleBlock: {
    flex: 1,
    gap: 2,
  },
  kickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  dotAccent: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.olive[600],
  },
  kickerText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    color: colors.light.mutedForeground,
    letterSpacing: 1.2,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 20,
    color: colors.light.foreground,
    letterSpacing: -0.4,
  },
  titleAccent: {
    color: colors.light.primary,
  },
  refreshBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.light.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  spin: {
    transform: [{ rotate: "180deg" }],
  },
  seeAllBtn: {
    padding: 4,
  },
  loading: {
    paddingVertical: spacing[8],
    alignItems: "center",
  },
  scroll: {
    paddingHorizontal: spacing[5],
    gap: spacing[3],
  },
  cardWrap: {
    position: "relative",
  },
  actions: {
    position: "absolute",
    top: 8,
    left: 8,
    flexDirection: "column",
    gap: 4,
  },
  actionBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
});
