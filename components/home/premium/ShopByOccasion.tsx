import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { HomeSectionHeader } from "./HomeSectionHeader";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import type { HomeShortcutOccasion } from "@/lib/api/backend";

const TILE_W = 196;
const TILE_H = 268;

/** Fallback art when a bucket has no product photo yet. */
const OCCASION_STYLE: Record<string, { icon: string; grad: [string, string] }> = {
  wedding: { icon: "sparkles-outline", grad: ["#b98d5c", "#5b3d22"] },
  office: { icon: "briefcase-outline", grad: [colors.olive[700], colors.olive[950]] },
  vacation: { icon: "sunny-outline", grad: ["#c8a44a", "#7a5a1c"] },
  party: { icon: "wine-outline", grad: ["#8f3f22", "#2a120a"] },
  gym: { icon: "barbell-outline", grad: ["#4b5a3a", "#161a0a"] },
};

/**
 * Shop by occasion — tall editorial tiles (cover = bucket best-seller)
 * that deep-link to the grid scoped server-side to that occasion. Tiles
 * with zero matching pieces are hidden so a tap never lands on an empty
 * page.
 */
export function ShopByOccasion({ occasions }: { occasions: HomeShortcutOccasion[] }) {
  const router = useRouter();
  const visible = occasions.filter((o) => o.count > 0);
  if (!visible.length) return null;

  return (
    <View style={styles.wrap}>
      <HomeSectionHeader kicker="Dress for the moment" title="Shop by occasion" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
        decelerationRate="fast"
        snapToInterval={TILE_W + spacing[3]}
        snapToAlignment="start"
      >
        {visible.map((o, i) => {
          const look = OCCASION_STYLE[o.key] ?? { icon: "pricetags-outline", grad: [colors.olive[700], colors.olive[950]] };
          return (
            <TouchableOpacity
              key={o.key}
              activeOpacity={0.9}
              style={styles.tile}
              onPress={() =>
                router.push(
                  `/(main)/products?occasion=${encodeURIComponent(o.key)}&title=${encodeURIComponent(`${o.label} edit`)}` as never,
                )
              }
              accessibilityRole="button"
              accessibilityLabel={`Shop ${o.label}, ${o.count} pieces`}
            >
              {o.cover ? (
                <Image source={{ uri: o.cover }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
              ) : (
                <LinearGradient colors={look.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill}>
                  <View style={styles.fallbackIcon}>
                    <Ionicons name={look.icon as never} size={44} color="rgba(250,248,241,0.35)" />
                  </View>
                </LinearGradient>
              )}
              <LinearGradient
                colors={["rgba(13,14,10,0.0)", "rgba(13,14,10,0.15)", "rgba(13,14,10,0.82)"]}
                locations={[0, 0.45, 1]}
                style={StyleSheet.absoluteFill}
              />

              <View style={styles.top}>
                <Text style={styles.index}>{String(i + 1).padStart(2, "0")}</Text>
                <View style={styles.countPill}>
                  <Text style={styles.countText}>{o.count.toLocaleString()} pieces</Text>
                </View>
              </View>

              <View style={styles.bottom}>
                <Text style={styles.label}>{o.label}</Text>
                <Text style={styles.tagline} numberOfLines={1}>
                  {o.tagline}
                </Text>
                <View style={styles.ctaRow}>
                  <Text style={styles.cta}>Explore the edit</Text>
                  <Ionicons name="arrow-forward" size={13} color={colors.paper.cream} />
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing[8],
  },
  rail: {
    paddingHorizontal: spacing[5],
    gap: spacing[3],
    paddingBottom: spacing[2],
  },
  tile: {
    width: TILE_W,
    height: TILE_H,
    borderRadius: 26,
    overflow: "hidden",
    backgroundColor: colors.olive[900],
    justifyContent: "space-between",
    padding: spacing[4],
  },
  fallbackIcon: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 60,
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  index: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.paper.cream,
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  countPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: "rgba(13,14,10,0.42)",
    borderWidth: 1,
    borderColor: "rgba(250,248,241,0.22)",
  },
  countText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9.5,
    letterSpacing: 0.6,
    color: colors.paper.cream,
  },
  bottom: {
    gap: 3,
  },
  label: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.5,
    color: colors.paper.cream,
  },
  tagline: {
    fontFamily: fontFamilies.display.italic,
    fontSize: 14,
    color: "rgba(250,248,241,0.82)",
  },
  ctaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: spacing[2],
    paddingTop: spacing[2],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(250,248,241,0.3)",
  },
  cta: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    letterSpacing: 0.3,
    color: colors.paper.cream,
  },
});
