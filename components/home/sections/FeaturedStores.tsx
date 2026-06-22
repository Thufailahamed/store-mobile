import React from "react";
import { View, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { Display, Label, Body } from "@/components/ui/Typography";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import type { Store } from "@/lib/types";

interface FeaturedStoresProps {
  stores: Store[];
  kicker?: string;
  title?: string;
  subtitle?: string;
}

export function FeaturedStores({
  stores,
  kicker = "Lookbook · 05",
  title = "Studios with a point of view.",
  subtitle = "Four ateliers, four temperaments. Tap a portrait to step into their full catalogue.",
}: FeaturedStoresProps) {
  const router = useRouter();
  const [hero, ...rest] = stores;
  if (!hero) return null;
  const tiles = rest.slice(0, 3);

  return (
    <View style={styles.wrap}>
      <View style={styles.inner}>
        <View style={styles.header}>
          <View>
            <View style={styles.kickerRow}>
              <View style={styles.kickerRule} />
              <Label style={styles.kickerText}>{kicker}</Label>
            </View>
            <Display size="3xl" style={styles.title} numberOfLines={2}>
              {title}
            </Display>
          </View>
          {subtitle ? <Body muted size="sm" style={styles.subtitle}>{subtitle}</Body> : null}
        </View>

        {/* Hero tile */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => router.push("/(main)/products")}
          style={styles.heroTile}
        >
          {hero.banner_url ? (
            <Image
              source={{ uri: hero.banner_url }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={400}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.olive[200] }]} />
          )}
          <View style={styles.heroGradient} />
          <View style={styles.heroBadge}>
            <Label style={styles.heroBadgeText}>
              <Label style={{ color: colors.light.primary }}>● </Label>
              Studio Nº 01
            </Label>
          </View>
          <View style={styles.heroRibbon}>
            <Label style={styles.heroRibbonText}>Featured</Label>
          </View>
          <View style={styles.heroBody}>
            <Display size="3xl" style={styles.heroName} numberOfLines={1}>
              {hero.name}
            </Display>
            {hero.description ? (
              <Body size="sm" style={styles.heroDesc} numberOfLines={2}>
                {hero.description}
              </Body>
            ) : null}
            <View style={styles.heroMetaRow}>
              <View style={styles.heroMetaPill}>
                <Ionicons name="star" size={10} color={colors.paper.cream} />
                <Label style={styles.heroMetaText}>{hero.rating.toFixed(1)}</Label>
              </View>
              <Label style={styles.heroMetaText}>{hero.total_followers.toLocaleString()} followers</Label>
              <Label style={styles.heroMetaText}>{hero.total_products} pieces</Label>
              <View style={styles.heroArrow}>
                <Ionicons name="arrow-up" size={14} color={colors.light.foreground} />
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </View>

      {/* Small tiles */}
      {tiles.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tilesScroll}
          style={styles.tilesScrollWrapper}
        >
          {tiles.map((s, i) => (
            <TouchableOpacity
              key={s.id}
              activeOpacity={0.9}
              onPress={() => router.push("/(main)/products")}
              style={styles.tile}
            >
              {s.banner_url ? (
                <Image
                  source={{ uri: s.banner_url }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  transition={400}
                />
              ) : (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.olive[100] }]} />
              )}
              <View style={styles.tileGradient} />
              <Label style={styles.tileBadge}>Studio Nº 0{i + 2}</Label>
              <View style={styles.tileBody}>
                <Display size="xl" style={styles.tileName} numberOfLines={1}>
                  {s.name}
                </Display>
                <Label style={styles.tileMeta}>
                  ★ {s.rating.toFixed(1)} · {s.total_products} pieces
                </Label>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: spacing[10], paddingBottom: spacing[8] },
  inner: { paddingHorizontal: 20, gap: spacing[6] },
  header: { gap: spacing[2] },
  kickerRow: { flexDirection: "row", alignItems: "center", gap: spacing[2], marginBottom: 4 },
  kickerRule: { width: 24, height: 1, backgroundColor: colors.light.primary },
  kickerText: { color: colors.light.primary },
  title: { color: colors.light.foreground, lineHeight: 34 },
  subtitle: { marginTop: spacing[2] },
  // Hero
  heroTile: {
    height: 360,
    borderRadius: radii.xl,
    overflow: "hidden",
    backgroundColor: colors.olive[200],
    position: "relative",
  },
  heroGradient: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(22, 26, 10, 0.45)" },
  heroBadge: {
    position: "absolute",
    top: spacing[3],
    left: spacing[3],
  },
  heroBadgeText: { color: "rgba(245, 244, 239, 0.9)" },
  heroRibbon: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 90,
    height: 32,
    backgroundColor: colors.olive[950],
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "45deg" }, { translateX: 28 }, { translateY: -6 }],
    paddingHorizontal: spacing[4],
  },
  heroRibbonText: { color: colors.paper.cream, fontSize: 9 },
  heroBody: {
    position: "absolute",
    left: spacing[4],
    right: spacing[4],
    bottom: spacing[4],
    gap: spacing[2],
  },
  heroName: { color: colors.paper.cream, fontSize: 32, lineHeight: 34 },
  heroDesc: { color: "rgba(245, 244, 239, 0.85)" },
  heroMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: spacing[2],
    paddingTop: spacing[3],
    borderTopWidth: 1,
    borderTopColor: "rgba(245, 244, 239, 0.18)",
    flexWrap: "wrap",
  },
  heroMetaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(245, 244, 239, 0.18)",
  },
  heroMetaText: { color: "rgba(245, 244, 239, 0.9)" },
  heroArrow: {
    marginLeft: "auto",
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.paper.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  // Tiles
  tilesScroll: { paddingHorizontal: 20, gap: spacing[3] },
  tilesScrollWrapper: { marginTop: spacing[3] },
  tile: {
    width: 160,
    height: 180,
    borderRadius: radii.lg,
    overflow: "hidden",
    backgroundColor: colors.olive[100],
    position: "relative",
  },
  tileGradient: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(22, 26, 10, 0.45)" },
  tileBadge: { position: "absolute", top: spacing[3], left: spacing[3], color: "rgba(245, 244, 239, 0.9)" },
  tileBody: { position: "absolute", left: spacing[3], right: spacing[3], bottom: spacing[3], gap: 4 },
  tileName: { color: colors.paper.cream, fontSize: 18 },
  tileMeta: { color: "rgba(245, 244, 239, 0.85)" },
});
