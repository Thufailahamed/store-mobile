import React, { useEffect, useRef } from "react";
import { View, TouchableOpacity, Animated, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Display, Label, Body } from "@/components/ui/Typography";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import type { Brand } from "@/lib/types";

interface PinnedAteliersProps {
  brands: Brand[];
  kicker?: string;
  subtitle?: string;
  onSeeAll?: () => void;
}

export function PinnedAteliers({
  brands,
  kicker = "Index · 04",
  subtitle = "A short list. We don't add a label unless we'd wear it ourselves and could call its founder by name.",
  onSeeAll,
}: PinnedAteliersProps) {
  const router = useRouter();
  const list = brands.slice(0, 8);
  if (!list.length) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.halftone} pointerEvents="none" />

      <View style={styles.inner}>
        <View style={styles.header}>
          <View style={styles.kickerRow}>
            <View style={styles.kickerRule} />
            <Label style={styles.kickerText}>{kicker}</Label>
          </View>
          <Display size="3xl" style={styles.title}>
            The{" "}
            <Display italic size="3xl" style={styles.titleAccent}>
              ateliers
            </Display>{" "}
            we keep.
          </Display>
          <Body muted size="sm" style={styles.subtitle}>
            {subtitle}
          </Body>
          {onSeeAll ? (
            <TouchableOpacity activeOpacity={0.7} style={styles.seeAll} onPress={onSeeAll}>
              <View style={styles.seeAllRule} />
              <Label style={styles.seeAllText}>See all ateliers</Label>
              <Ionicons name="arrow-up" size={12} color={colors.light.foreground} />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.list}>
          {list.map((b, i) => (
            <BrandRow
              key={b.id}
              brand={b}
              index={i}
              total={list.length}
              onPress={() => router.push("/(main)/products")}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

function BrandRow({
  brand,
  index,
  total,
  onPress,
}: {
  brand: Brand;
  index: number;
  total: number;
  onPress: () => void;
}) {
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 500,
      delay: index * 80,
      useNativeDriver: true,
    }).start();
  }, [fade, index]);

  return (
    <Animated.View style={{ opacity: fade }}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPress}
        style={styles.row}
      >
        <Display size="2xl" style={styles.rowIndex}>
          {String(index + 1).padStart(2, "0")}
        </Display>
        <View style={styles.rowMain}>
          <Display size="2xl" style={styles.rowName} numberOfLines={1}>
            {brand.name}
          </Display>
          {brand.tagline ? (
            <Label style={styles.rowTagline} numberOfLines={1}>
              {brand.tagline}
            </Label>
          ) : null}
        </View>
        {brand.banner_url ? (
          <View style={styles.rowImage}>
            <Image
              source={{ uri: brand.banner_url }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={400}
            />
          </View>
        ) : null}
        <View style={styles.rowStats}>
          <Label style={styles.rowStat}>{brand.total_followers.toLocaleString()}</Label>
          <Label style={styles.rowStatLabel}>followers</Label>
        </View>
        <View style={styles.rowArrow}>
          <Ionicons name="arrow-up" size={12} color={colors.light.foreground} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.paper.warm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.light.border,
    overflow: "hidden",
  },
  halftone: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(168, 176, 107, 0.08)",
  },
  inner: { paddingHorizontal: 20, paddingTop: spacing[10], paddingBottom: spacing[6] },
  header: { marginBottom: spacing[6] },
  kickerRow: { flexDirection: "row", alignItems: "center", gap: spacing[2], marginBottom: 6 },
  kickerRule: { width: 24, height: 1, backgroundColor: colors.light.primary },
  kickerText: { color: colors.light.primary },
  title: { color: colors.light.foreground, lineHeight: 34 },
  titleAccent: { color: colors.light.primary },
  subtitle: { marginTop: spacing[2] },
  seeAll: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing[4] },
  seeAllRule: { width: 24, height: 1, backgroundColor: colors.light.foreground },
  seeAllText: { color: colors.light.foreground },
  // List
  list: { gap: 0 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    paddingVertical: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  rowIndex: { color: colors.light.mutedForeground, fontSize: 20, lineHeight: 22, width: 30 },
  rowMain: { flex: 1, gap: 2 },
  rowName: { color: colors.light.foreground, fontSize: 22 },
  rowTagline: { color: colors.light.mutedForeground, fontSize: 10 },
  rowImage: {
    width: 48,
    height: 48,
    borderRadius: radii.sm,
    backgroundColor: colors.olive[100],
    overflow: "hidden",
  },
  rowStats: { alignItems: "flex-end", gap: 0, width: 64 },
  rowStat: { color: colors.light.foreground, fontSize: 11 },
  rowStatLabel: { color: colors.light.mutedForeground, fontSize: 9 },
  rowArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.light.border,
    alignItems: "center",
    justifyContent: "center",
  },
});
