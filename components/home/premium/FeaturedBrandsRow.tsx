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

const CARD_WIDTH = 188;
const BANNER_HEIGHT = 116;

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
    <TouchableOpacity style={styles.card} activeOpacity={0.88} onPress={onPress}>
      <View style={styles.banner}>
        {brand.banner_url ? (
          <Image source={{ uri: brand.banner_url }} style={styles.bannerImage} contentFit="cover" />
        ) : (
          <LinearGradient colors={gradient} style={StyleSheet.absoluteFill} />
        )}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.55)"]}
          style={styles.bannerOverlay}
        />
        <View style={styles.bannerTop}>
          {brand.rating > 0 ? (
            <View style={styles.ratingPill}>
              <Ionicons name="star" size={10} color="#f5d76e" />
              <Text style={styles.ratingText}>{brand.rating.toFixed(1)}</Text>
            </View>
          ) : (
            <View />
          )}
        </View>
        <View style={styles.bannerBottom}>
          <View style={styles.logoWrap}>
            {brand.logo_url ? (
              <Image source={{ uri: brand.logo_url }} style={styles.logo} contentFit="cover" />
            ) : (
              <Text style={styles.logoInitial}>{brand.name.charAt(0)}</Text>
            )}
          </View>
          <Text style={styles.bannerName} numberOfLines={2}>
            {brand.name}
          </Text>
        </View>
      </View>

      <View style={styles.info}>
        {brand.tagline ? (
          <Text style={styles.tagline} numberOfLines={2}>
            {brand.tagline}
          </Text>
        ) : null}
        {metaParts.length > 0 ? (
          <Text style={styles.meta} numberOfLines={1}>
            {metaParts.join(" · ")}
          </Text>
        ) : (
          <Text style={styles.meta}>Explore the collection</Text>
        )}
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
    backgroundColor: "#ffffff",
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: colors.light.border,
    overflow: "hidden",
    ...shadows.soft,
  },
  banner: {
    height: BANNER_HEIGHT,
    backgroundColor: colors.olive[100],
    overflow: "hidden",
  },
  bannerImage: {
    ...StyleSheet.absoluteFillObject,
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  bannerTop: {
    position: "absolute",
    top: spacing[2],
    left: spacing[2],
    right: spacing[2],
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  ratingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(0, 0, 0, 0.42)",
    borderRadius: radii.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  ratingText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 10,
    color: "#ffffff",
  },
  bannerBottom: {
    position: "absolute",
    left: spacing[3],
    right: spacing[3],
    bottom: spacing[3],
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
  },
  logoWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#ffffff",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.8)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  logo: {
    width: "100%",
    height: "100%",
  },
  logoInitial: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 15,
    color: colors.light.primary,
  },
  bannerName: {
    flex: 1,
    fontFamily: fontFamilies.sans.bold,
    fontSize: 14,
    color: "#ffffff",
    lineHeight: 17,
    letterSpacing: -0.2,
  },
  info: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    gap: 4,
    minHeight: 58,
    justifyContent: "center",
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
