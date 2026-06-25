import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@/components/ui/Icon";
import { Body, Label } from "@/components/ui/Typography";
import type { Brand } from "@/lib/types";
import { colors, radii, shadows, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { resolveImageUrl } from "@/lib/utils/resolve-image-url";

interface BrandCardProps {
  brand: Brand;
  variant?: "default" | "compact";
  onPress?: () => void;
}

export function BrandCard({ brand, variant = "default", onPress }: BrandCardProps) {
  const compact = variant === "compact";
  const logoSize = compact ? 44 : 56;

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={[styles.card, compact && styles.cardCompact]}
    >
      {brand.banner_url && !compact ? (
        <Image
          source={{ uri: resolveImageUrl(brand.banner_url) ?? brand.banner_url }}
          style={styles.banner}
          contentFit="cover"
        />
      ) : null}

      <View style={[styles.row, compact && styles.rowCompact]}>
        <View style={[styles.logoWrap, { width: logoSize, height: logoSize }]}>
          {brand.logo_url ? (
            <Image
              source={{ uri: resolveImageUrl(brand.logo_url) ?? brand.logo_url }}
              style={styles.logo}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.logo, styles.logoFallback]}>
              <Ionicons name="ribbon" size={compact ? 18 : 22} color={colors.light.mutedForeground} />
            </View>
          )}
        </View>

        <View style={styles.body}>
          <Body size={compact ? "sm" : "md"} style={styles.name} numberOfLines={1}>
            {brand.name}
          </Body>
          {!compact && brand.tagline ? (
            <Body muted size="xs" numberOfLines={2} style={styles.tagline}>
              {brand.tagline}
            </Body>
          ) : null}
          <View style={styles.metaRow}>
            {brand.total_products != null && brand.total_products > 0 ? (
              <Label style={styles.metaItem}>
                <Ionicons name="cube-outline" size={10} color={colors.light.mutedForeground} />{" "}
                {brand.total_products}
              </Label>
            ) : null}
            {brand.total_followers != null && brand.total_followers > 0 ? (
              <Label style={styles.metaItem}>
                <Ionicons name="people-outline" size={10} color={colors.light.mutedForeground} />{" "}
                {brand.total_followers.toLocaleString()}
              </Label>
            ) : null}
          </View>
        </View>

        <Ionicons name="chevron-forward" size={16} color={colors.light.mutedForeground} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.light.card,
    borderRadius: radii.xl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.light.border,
    ...shadows.soft,
  },
  cardCompact: { width: 220 },
  banner: { width: "100%", height: 96 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    padding: spacing[3],
  },
  rowCompact: { padding: spacing[2] },
  logoWrap: {
    borderRadius: radii.lg,
    backgroundColor: colors.olive?.[50] ?? "#f4f3ee",
    overflow: "hidden",
  },
  logo: { width: "100%", height: "100%", borderRadius: radii.lg },
  logoFallback: { alignItems: "center", justifyContent: "center" },
  body: { flex: 1, gap: 2 },
  name: { fontFamily: fontFamilies.sans.semibold },
  tagline: { marginTop: 2 },
  metaRow: { flexDirection: "row", gap: spacing[2], marginTop: 4 },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    color: colors.light.mutedForeground,
  },
});