import React, { useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { HomeSectionHeader } from "./HomeSectionHeader";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import type { HomeShortcutPriceBand } from "@/lib/api/backend";

const GAP = spacing[3];
const H_PAD = spacing[5];
const FRAME_INSET = 6;
const IMAGE_H = 112;

type Tone = {
  tier: string;
  bg: [string, string];
  ink: string;
  sub: string;
  muted: string;
  border: string;
  accent: string;
  arrowBg: string;
  arrowInk: string;
  fallback: [string, string];
};

/** Ascending scale so the four bands read cheapest → luxe. */
const TONES: Tone[] = [
  {
    tier: "Essentials",
    bg: [colors.paper.cream, colors.paper.cream],
    ink: colors.light.foreground,
    sub: colors.olive[700],
    muted: colors.light.mutedForeground,
    border: `${colors.olive[900]}14`,
    accent: colors.olive[600],
    arrowBg: colors.olive[900],
    arrowInk: colors.paper.cream,
    fallback: [colors.olive[50], colors.olive[100]],
  },
  {
    tier: "Everyday",
    bg: [colors.paper.cream, colors.olive[50]],
    ink: colors.light.foreground,
    sub: colors.olive[700],
    muted: colors.light.mutedForeground,
    border: `${colors.olive[700]}1F`,
    accent: colors.olive[600],
    arrowBg: colors.olive[900],
    arrowInk: colors.paper.cream,
    fallback: [colors.olive[100], colors.olive[200]],
  },
  {
    tier: "Elevated",
    bg: [colors.olive[50], colors.olive[100]],
    ink: colors.olive[950],
    sub: colors.olive[800],
    muted: colors.olive[700],
    border: `${colors.olive[700]}2E`,
    accent: colors.olive[700],
    arrowBg: colors.olive[900],
    arrowInk: colors.paper.cream,
    fallback: [colors.olive[200], colors.olive[400]],
  },
  {
    tier: "Luxe",
    bg: [colors.olive[800], colors.olive[950]],
    ink: colors.paper.cream,
    sub: colors.accent2.ochre,
    muted: "rgba(250,248,241,0.6)",
    border: "rgba(200,164,74,0.35)",
    accent: colors.accent2.ochre,
    arrowBg: colors.accent2.ochre,
    arrowInk: colors.olive[950],
    fallback: [colors.olive[700], colors.olive[950]],
  },
];

function bandHref(b: HomeShortcutPriceBand): string {
  const qs = [`minPrice=${b.min}`];
  if (b.max != null) qs.push(`maxPrice=${b.max}`);
  return `/(main)/products?${qs.join("&")}`;
}

function bandRangeText(b: HomeShortcutPriceBand): string {
  const f = (n: number) => n.toLocaleString("en-LK");
  if (b.max == null) return `LKR ${f(b.min)} & above`;
  if (b.min === 0) return `Below LKR ${f(b.max)}`;
  return `LKR ${f(b.min)} – ${f(b.max)}`;
}

/** "●●○○" — where this band sits on the price scale. */
function TierScale({ level, color, dim }: { level: number; color: string; dim: string }) {
  return (
    <View style={styles.scale}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={[styles.scaleBar, { backgroundColor: i <= level ? color : dim }]} />
      ))}
    </View>
  );
}

function PriceTile({
  band,
  level,
  width,
  onPress,
}: {
  band: HomeShortcutPriceBand;
  level: number;
  width: number;
  onPress: () => void;
}) {
  const tone = TONES[Math.min(level, TONES.length - 1)];
  const dark = level === TONES.length - 1;
  const scale = useRef(new Animated.Value(1)).current;
  const spring = (to: number) =>
    Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 40, bounciness: 6 }).start();

  return (
    <Animated.View style={[styles.tileShadow, { width, transform: [{ scale }] }]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => spring(0.97)}
        onPressOut={() => spring(1)}
        style={[styles.tile, { borderColor: tone.border }]}
        accessibilityRole="button"
        accessibilityLabel={`Shop ${band.label}, ${tone.tier}${band.count > 0 ? `, ${band.count} pieces` : ""}`}
      >
        <LinearGradient colors={tone.bg} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />

        {/* Framed photo */}
        <View style={styles.frame}>
          {band.cover ? (
            <Image source={{ uri: band.cover }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
          ) : (
            <LinearGradient colors={tone.fallback} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill}>
              <View style={styles.fallbackMark}>
                <Text style={[styles.fallbackText, { color: dark ? "rgba(250,248,241,0.18)" : `${colors.olive[900]}1A` }]}>
                  LKR
                </Text>
              </View>
            </LinearGradient>
          )}
          <LinearGradient
            colors={["rgba(13,14,10,0.28)", "rgba(13,14,10,0)", "rgba(13,14,10,0.18)"]}
            locations={[0, 0.4, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.frameTop}>
            <View style={styles.glassPill}>
              <TierScale level={level} color={colors.paper.cream} dim="rgba(250,248,241,0.32)" />
            </View>
            {band.count > 0 ? (
              <View style={styles.glassPill}>
                <Text style={styles.countText}>{band.count.toLocaleString()}</Text>
                <Text style={styles.countUnit}>{band.count === 1 ? "piece" : "pieces"}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Copy */}
        <View style={styles.body}>
          <Text style={[styles.tier, { color: tone.sub }]}>{tone.tier.toUpperCase()}</Text>
          <Text style={[styles.label, { color: tone.ink }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
            {band.label}
          </Text>
          <View style={styles.footer}>
            <Text style={[styles.range, { color: tone.muted }]} numberOfLines={1}>
              {bandRangeText(band)}
            </Text>
            <View style={[styles.arrow, { backgroundColor: tone.arrowBg }]}>
              <Ionicons name="arrow-forward" size={13} color={tone.arrowInk} />
            </View>
          </View>
        </View>

      </Pressable>
    </Animated.View>
  );
}

/**
 * Shop by price — a 2×2 scale of budget bands (Essentials → Luxe). Each
 * tile frames the band's best-seller, shows the live piece count, and
 * deep-links to the grid scoped to exactly that band (server-side, max
 * exclusive). Empty bands are dropped; `count === -1` = counts unavailable.
 */
export function ShopByPrice({ bands }: { bands: HomeShortcutPriceBand[] }) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const visible = bands.filter((b) => b.count !== 0);
  if (!visible.length) return null;
  const tileW = (width - H_PAD * 2 - GAP) / 2;

  return (
    <View style={styles.wrap}>
      <HomeSectionHeader kicker="Every budget, one standard" title="Shop by price" />
      <View style={styles.grid}>
        {visible.map((b) => (
          <PriceTile
            key={b.key}
            band={b}
            level={Math.max(0, bands.indexOf(b))}
            width={tileW}
            onPress={() => router.push(bandHref(b) as never)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing[8],
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GAP,
    paddingHorizontal: H_PAD,
  },
  tileShadow: {
    borderRadius: 26,
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  tile: {
    borderRadius: 26,
    borderWidth: 1,
    overflow: "hidden",
  },
  frame: {
    height: IMAGE_H,
    margin: FRAME_INSET,
    marginBottom: 0,
    borderRadius: 26 - FRAME_INSET,
    overflow: "hidden",
    backgroundColor: colors.olive[100],
  },
  fallbackMark: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  fallbackText: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 46,
    letterSpacing: -1,
  },
  frameTop: {
    position: "absolute",
    top: 8,
    left: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  glassPill: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radii.full,
    backgroundColor: "rgba(13,14,10,0.38)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(250,248,241,0.3)",
  },
  scale: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingVertical: 2,
  },
  scaleBar: {
    width: 7,
    height: 3,
    borderRadius: 1.5,
  },
  countText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10.5,
    color: colors.paper.cream,
  },
  countUnit: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 9,
    color: "rgba(250,248,241,0.8)",
  },
  body: {
    paddingHorizontal: spacing[3.5],
    paddingTop: spacing[3],
    paddingBottom: spacing[3.5],
    gap: 2,
  },
  tier: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 1.8,
  },
  label: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 25,
    lineHeight: 30,
    letterSpacing: -0.5,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[2],
    marginTop: 4,
  },
  range: {
    flex: 1,
    fontFamily: fontFamilies.sans.medium,
    fontSize: 11,
  },
  arrow: {
    width: 28,
    height: 28,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
  },
});
