import React, { useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { HomeSectionHeader } from "./HomeSectionHeader";
import { colors, radii, shadows, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import type { Brand } from "@/lib/types";

const CARD_HEIGHT = 210;

const GRADIENTS: [string, string][] = [
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
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

function formatCount(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return value.toLocaleString();
}

interface FeaturedBrandsRowProps {
  brands: Brand[];
}

/**
 * "Brand billboards" — one big landscape card snaps into focus at a time,
 * each stamped with an oversized, half-faded initial as a typographic
 * watermark behind the brand name. Landscape + single-focus paging is the
 * opposite shape/interaction from the portrait, continuous-scroll
 * FeaturedStoresRow above it, so the two "browse by X" rows read as
 * distinct ideas rather than the same card reskinned.
 */
export function FeaturedBrandsRow({ brands }: FeaturedBrandsRowProps) {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const CARD_WIDTH = screenWidth - spacing[5] * 2 - spacing[8];
  const list = useMemo(() => brands.slice(0, 10), [brands]);
  const [active, setActive] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  if (!list.length) return null;

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / (CARD_WIDTH + spacing[3]));
    setActive(Math.min(Math.max(i, 0), list.length - 1));
  };

  return (
    <View style={styles.wrap}>
      <HomeSectionHeader
        title="Shop by brand"
        kicker="Brand billboards"
        onPress={() => router.push("/(main)/search")}
      />
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_WIDTH + spacing[3]}
        decelerationRate="fast"
        contentContainerStyle={styles.scroll}
        onMomentumScrollEnd={onScrollEnd}
      >
        {list.map((brand) => {
          const gradient = brandGradient(brand.name);
          const metaParts = [
            brand.total_products > 0 ? `${formatCount(brand.total_products)} pieces` : null,
            brand.total_followers > 0 ? `${formatCount(brand.total_followers)} followers` : null,
          ].filter(Boolean);

          return (
            <TouchableOpacity
              key={brand.id}
              style={[styles.card, { width: CARD_WIDTH }]}
              activeOpacity={0.92}
              onPress={() => router.push(`/(main)/products?brand=${brand.slug}`)}
            >
              {brand.banner_url ? (
                <Image source={{ uri: brand.banner_url }} style={StyleSheet.absoluteFill} contentFit="cover" />
              ) : (
                <LinearGradient colors={gradient} style={StyleSheet.absoluteFill} />
              )}
              <LinearGradient colors={["rgba(0,0,0,0.15)", "rgba(0,0,0,0.75)"]} style={StyleSheet.absoluteFill} />

              <Text style={styles.watermark} numberOfLines={1}>
                {brand.name.charAt(0)}
              </Text>

              <View style={styles.content}>
                <View style={styles.contentTop}>
                  {brand.logo_url ? (
                    <Image source={{ uri: brand.logo_url }} style={styles.logo} contentFit="cover" />
                  ) : null}
                  {brand.rating > 0 ? (
                    <View style={styles.ratingPill}>
                      <Ionicons name="star" size={10} color="#f5d76e" />
                      <Text style={styles.ratingText}>{brand.rating.toFixed(1)}</Text>
                    </View>
                  ) : null}
                </View>

                <View>
                  <Text style={styles.name} numberOfLines={1}>
                    {brand.name}
                  </Text>
                  {brand.tagline ? (
                    <Text style={styles.tagline} numberOfLines={1}>
                      {brand.tagline}
                    </Text>
                  ) : null}
                  <View style={styles.footerRow}>
                    <Text style={styles.meta} numberOfLines={1}>
                      {metaParts.length > 0 ? metaParts.join(" · ") : "Explore the collection"}
                    </Text>
                    <View style={styles.shopBtn}>
                      <Ionicons name="arrow-forward" size={13} color={colors.light.foreground} />
                    </View>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {list.length > 1 ? (
        <View style={styles.dots}>
          {list.map((b, i) => (
            <View key={b.id} style={[styles.dot, i === active && styles.dotActive]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing[6],
  },
  scroll: {
    paddingHorizontal: spacing[5],
    gap: spacing[3],
  },
  card: {
    height: CARD_HEIGHT,
    borderRadius: radii["2xl"],
    overflow: "hidden",
    backgroundColor: colors.olive[100],
    ...shadows.editorial,
  },
  watermark: {
    position: "absolute",
    right: -10,
    bottom: -46,
    fontFamily: fontFamilies.display.semibold,
    fontSize: 200,
    lineHeight: 200,
    color: "rgba(255,255,255,0.08)",
  },
  content: {
    flex: 1,
    padding: spacing[4],
    justifyContent: "space-between",
  },
  contentTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ffffff",
  },
  ratingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: radii.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  ratingText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 11,
    color: "#ffffff",
  },
  name: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 26,
    color: "#ffffff",
    letterSpacing: -0.4,
  },
  tagline: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    marginTop: 2,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing[3],
  },
  meta: {
    flex: 1,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: "rgba(255,255,255,0.75)",
    marginRight: spacing[2],
  },
  shopBtn: {
    flexShrink: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: spacing[3],
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.light.border,
  },
  dotActive: {
    width: 18,
    backgroundColor: colors.light.primary,
  },
});
