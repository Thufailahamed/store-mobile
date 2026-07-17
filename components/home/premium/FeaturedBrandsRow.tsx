import React, { useMemo } from "react";
import { View, ScrollView, TouchableOpacity, StyleSheet, Text } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { HomeSectionHeader } from "./HomeSectionHeader";
import { colors, radii, shadows, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import type { Brand } from "@/lib/types";

const CARD_WIDTH = 240;
const LOGO_SIZE = 56;

const ACCENT_GRADIENTS: [string, string][] = [
  [colors.olive[700], colors.olive[900]],
  ["#3f4a2e", "#1f2414"],
  ["#4a3f2e", "#241f14"],
  ["#2e3f4a", "#141f24"],
];

function brandGradient(name: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return ACCENT_GRADIENTS[Math.abs(hash) % ACCENT_GRADIENTS.length];
}

function formatCount(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return value.toLocaleString();
}

interface FeaturedBrandsRowProps {
  brands: Brand[];
}

export function FeaturedBrandsRow({ brands }: FeaturedBrandsRowProps) {
  const router = useRouter();
  const list = useMemo(() => brands.slice(0, 10), [brands]);
  if (!list.length) return null;

  return (
    <View style={styles.wrap}>
      <HomeSectionHeader
        title="Shop by brand"
        onPress={() => router.push("/(main)/search")}
      />
      <Text style={styles.subtitle}>Discover labels curated for the LUXE edit</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {list.map((brand) => (
          <BrandCard
            key={brand.id}
            brand={brand}
            onPress={() => router.push(`/(main)/products?brand=${brand.slug}`)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function BrandCard({ brand, onPress }: { brand: Brand; onPress: () => void }) {
  const gradient = brandGradient(brand.name);
  const metaParts = [
    brand.total_products > 0 ? `${formatCount(brand.total_products)} pieces` : null,
    brand.total_followers > 0 ? `${formatCount(brand.total_followers)} followers` : null,
  ].filter(Boolean);

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={onPress}>
      <View style={styles.logoWrap}>
        {brand.logo_url ? (
          <Image source={{ uri: brand.logo_url }} style={styles.logo} contentFit="cover" />
        ) : (
          <LinearGradient colors={gradient} style={StyleSheet.absoluteFill}>
            <View style={styles.logoInitialWrap}>
              <Text style={styles.logoInitial}>{brand.name.charAt(0)}</Text>
            </View>
          </LinearGradient>
        )}
      </View>

      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {brand.name}
          </Text>
          {brand.rating > 0 ? (
            <View style={styles.ratingPill}>
              <Ionicons name="star" size={9} color="#c9a227" />
              <Text style={styles.ratingText}>{brand.rating.toFixed(1)}</Text>
            </View>
          ) : null}
        </View>
        {brand.tagline ? (
          <Text style={styles.tagline} numberOfLines={1}>
            {brand.tagline}
          </Text>
        ) : null}
        <Text style={styles.meta} numberOfLines={1}>
          {metaParts.length > 0 ? metaParts.join(" · ") : "Explore the collection"}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing[6],
  },
  subtitle: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    color: colors.light.mutedForeground,
    paddingHorizontal: spacing[5],
    marginTop: -spacing[1],
    marginBottom: spacing[4],
    lineHeight: 18,
  },
  scroll: {
    paddingHorizontal: spacing[5],
    gap: spacing[3],
  },
  card: {
    width: CARD_WIDTH,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    backgroundColor: "#ffffff",
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: spacing[3],
    ...shadows.soft,
  },
  logoWrap: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: LOGO_SIZE / 2,
    backgroundColor: colors.olive[100],
    borderWidth: 1,
    borderColor: colors.light.border,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  logo: {
    width: "100%",
    height: "100%",
  },
  logoInitialWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  logoInitial: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 20,
    color: "#ffffff",
  },
  info: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
  },
  name: {
    flex: 1,
    fontFamily: fontFamilies.sans.bold,
    fontSize: 15,
    color: colors.light.foreground,
    letterSpacing: -0.2,
  },
  ratingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: colors.olive[50],
    borderRadius: radii.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  ratingText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 10,
    color: colors.olive[700],
  },
  tagline: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12,
    color: colors.light.foreground,
    lineHeight: 16,
  },
  meta: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: colors.light.mutedForeground,
  },
});
