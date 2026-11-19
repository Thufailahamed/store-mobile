/**
 * Wholesale page sections in the Home visual language: full-bleed promo
 * bands, an occasion rail, a 2×2 "shop by MOQ" grid and a standard card.
 */
import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ImageSourcePropType,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@/components/ui/Icon";
import { HomeSectionHeader } from "@/components/home/premium";
import { C } from "@/components/orders/parcel-track";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

const GOLD = "#c9b27a";
const GOLD_SOFT = "#e3d4a4";
const CREAM = "#fbf7ec";
const INK = "#16170f";
const WA = "#25D366";
const H_PAD = spacing[5];

/* -------------------------------------------------------------------- */
/* Trade band — full-bleed, like the Home rewards strip                  */
/* -------------------------------------------------------------------- */

export function TradeBand({
  stats,
  onChat,
}: {
  stats: { label: string; value: string }[];
  onChat: () => void;
}) {
  return (
    <LinearGradient colors={["#101109", "#23261a", "#3a3220"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.trade}>
      <Text style={styles.tradeWatermark} pointerEvents="none">
        B2B
      </Text>
      <View style={styles.tradeHead}>
        <View style={{ flex: 1 }}>
          <View style={styles.tradeKickerRow}>
            <View style={styles.liveDot} />
            <Text style={styles.tradeKicker}>TRADE DESK · OPEN</Text>
          </View>
          <Text style={styles.tradeTitle}>
            Buy the edit,{"\n"}
            <Text style={styles.italic}>by the pack.</Text>
          </Text>
        </View>
        <Pressable
          onPress={onChat}
          style={({ pressed }) => [styles.waSeal, pressed && { transform: [{ scale: 0.95 }] }]}
          accessibilityLabel="Order on WhatsApp"
        >
          <View style={styles.waInner}>
            <Ionicons name="logo-whatsapp" size={22} color="#fff" />
          </View>
          <Text style={styles.waLabel}>ORDER</Text>
        </Pressable>
      </View>
      <View style={styles.tradeStats}>
        {stats.map((s) => (
          <View key={s.label} style={styles.tradeStat}>
            <Text style={styles.tradeStatLabel}>{s.label}</Text>
            <Text style={styles.tradeStatValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
              {s.value}
            </Text>
          </View>
        ))}
      </View>
    </LinearGradient>
  );
}

/* -------------------------------------------------------------------- */
/* Shop by occasion — trade edits                                        */
/* -------------------------------------------------------------------- */

const OCC_W = 168;
const OCC_H = Math.round((OCC_W * 4) / 3);

type Occasion = { key: string; label: string; tag: string; search: string; art: ImageSourcePropType; tint: string };

/** Art carries retail copy at the bottom and a count chip top-right; both are covered below. */
const OCCASIONS: Occasion[] = [
  { key: "wedding", label: "Wedding", tag: "Bridal racks", search: "wedding", art: require("@/assets/shop-by-occasion/wedding.webp"), tint: "#2a1d10" },
  { key: "festive", label: "Festive", tag: "Season stock", search: "festive", art: require("@/assets/shop-by-occasion/festive.webp"), tint: "#3d0718" },
  { key: "office", label: "Office", tag: "Workwear packs", search: "office", art: require("@/assets/shop-by-occasion/office.webp"), tint: "#0e1424" },
  { key: "casual", label: "Casual", tag: "Everyday sellers", search: "casual", art: require("@/assets/shop-by-occasion/casual.webp"), tint: "#22251a" },
  { key: "party", label: "Party", tag: "Evening edit", search: "party", art: require("@/assets/shop-by-occasion/party.webp"), tint: "#141414" },
  { key: "travel", label: "Resort", tag: "Holiday line", search: "vacation", art: require("@/assets/shop-by-occasion/travel.webp"), tint: "#2b2416" },
];

export function OccasionRail({ onPick }: { onPick: (search: string) => void }) {
  return (
    <View style={styles.section}>
      <HomeSectionHeader kicker="Stock for the season" title="Shop by occasion" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.occScroll}>
        {OCCASIONS.map((o, i) => (
          <Pressable
            key={o.key}
            onPress={() => onPick(o.search)}
            accessibilityRole="button"
            accessibilityLabel={`${o.label} — ${o.tag}`}
            style={({ pressed }) => [styles.occTile, pressed && { transform: [{ scale: 0.97 }] }]}
          >
            <Image source={o.art} style={styles.occImg} contentFit="cover" contentPosition="top" transition={200} />
            <LinearGradient
              colors={["transparent", "transparent", `${o.tint}cc`, o.tint, o.tint]}
              locations={[0, 0.38, 0.5, 0.58, 1]}
              style={styles.occImg}
            />
            <View style={styles.occNum}>
              <Text style={styles.occNumText}>{String(i + 1).padStart(2, "0")}</Text>
            </View>
            <View style={styles.occChip}>
              <Text style={styles.occChipText}>BULK</Text>
            </View>
            <View style={styles.occCopy}>
              <Text style={styles.occLabel}>{o.label}</Text>
              <Text style={styles.occTag}>{o.tag}</Text>
              <View style={styles.occCta}>
                <Text style={styles.occCtaText}>Explore the line</Text>
                <Ionicons name="arrow-forward" size={11} color={GOLD_SOFT} />
              </View>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

/* -------------------------------------------------------------------- */
/* Shop by MOQ — 2×2 grid like Home's "Shop by price"                    */
/* -------------------------------------------------------------------- */

export type MoqTier = { key: string; min: number; max: number | null };

const TIERS: (MoqTier & {
  big: string;
  name: string;
  sub: string;
  bg: readonly [string, string];
  ink: string;
  accent: string;
})[] = [
  { key: "starter", min: 1, max: 5, big: "1–5", name: "Starter", sub: "Test a style", bg: ["#d4e3b9", "#b9d090"], ink: "#24310f", accent: "#7a1340" },
  { key: "boutique", min: 6, max: 11, big: "6–11", name: "Boutique", sub: "Fill a rail", bg: ["#f6d4df", "#eeb3c7"], ink: "#4a0a26", accent: "#a3124f" },
  { key: "retail", min: 12, max: 23, big: "12+", name: "Retail run", sub: "Stock a store", bg: ["#f7e4ae", "#f0cf77"], ink: "#3d2600", accent: "#8a4b00" },
  { key: "bulk", min: 24, max: null, big: "24+", name: "Bulk", sub: "Best piece price", bg: ["#cbd9ee", "#a9c0e2"], ink: "#0b2350", accent: "#0b3d91" },
];

export function MoqTiers({ active, onPick }: { active: string | null; onPick: (tier: MoqTier | null) => void }) {
  const { width } = useWindowDimensions();
  const gap = spacing[3];
  const tileW = (width - H_PAD * 2 - gap) / 2;
  return (
    <View style={styles.section}>
      <HomeSectionHeader kicker="Order the way you sell" title="Shop by MOQ" />
      <View style={[styles.tierGrid, { gap }]}>
        {TIERS.map((t) => {
          const on = active === t.key;
          return (
            <Pressable
              key={t.key}
              onPress={() => onPick(on ? null : { key: t.key, min: t.min, max: t.max })}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${t.name}, minimum order ${t.big} pieces`}
              style={({ pressed }) => [{ width: tileW, height: tileW * 0.92 }, pressed && { transform: [{ scale: 0.97 }] }]}
            >
              <LinearGradient
                colors={t.bg}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.tier, on && { borderColor: t.ink, borderWidth: 2 }]}
              >
                <View style={[styles.tierCircle, { backgroundColor: `${t.accent}14` }]} />
                <Text style={[styles.tierKicker, { color: t.accent }]}>MOQ</Text>
                <Text style={[styles.tierBig, { color: t.ink }]}>{t.big}</Text>
                <Text style={[styles.tierUnit, { color: t.ink }]}>pieces</Text>
                <View style={styles.tierFoot}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.tierName, { color: t.ink }]}>{t.name}</Text>
                    <Text style={[styles.tierSub, { color: `${t.ink}aa` }]}>{t.sub}</Text>
                  </View>
                  <View style={[styles.tierBtn, { backgroundColor: t.ink }]}>
                    <Ionicons name={on ? "checkmark" : "arrow-forward"} size={13} color={t.bg[0]} />
                  </View>
                </View>
              </LinearGradient>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/* -------------------------------------------------------------------- */
/* Dispatch band — full-bleed, like Home's delivery banner               */
/* -------------------------------------------------------------------- */

export function DispatchBand({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Islandwide dispatch. Talk to the desk">
      <LinearGradient colors={["#f3ead2", "#e8d9b3"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.dispatch}>
        <View style={styles.dispatchRoute} pointerEvents="none">
          {Array.from({ length: 9 }).map((_, k) => (
            <View key={k} style={styles.dispatchDash} />
          ))}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.dispatchKicker}>ISLANDWIDE · TRACKED</Text>
          <Text style={styles.dispatchTitle}>
            Packed, sealed,{"\n"}
            <Text style={styles.dispatchItalic}>at your door.</Text>
          </Text>
          <View style={styles.dispatchCta}>
            <Text style={styles.dispatchCtaText}>Ask about lead times</Text>
            <Ionicons name="arrow-forward" size={13} color={C.lime} />
          </View>
        </View>
        <View style={styles.dispatchBadge}>
          <Ionicons name="cube" size={30} color={INK} />
          <View style={styles.dispatchTruck}>
            <Ionicons name="car" size={15} color={GOLD_SOFT} />
          </View>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

/* -------------------------------------------------------------------- */
/* Standard card — like Home's TrustStrip                                */
/* -------------------------------------------------------------------- */

const STANDARD = [
  { icon: "layers-outline" as const, label: "Low minimums", sub: "Start from a few pieces per style" },
  { icon: "pricetags-outline" as const, label: "Piece pricing", sub: "Clear per-piece and per-pack prices" },
  { icon: "logo-whatsapp" as const, label: "One WhatsApp thread", sub: "From selection to dispatch" },
  { icon: "shield-checkmark-outline" as const, label: "Vetted by Vestara", sub: "Every style checked before listing" },
];

export function WholesaleStandard() {
  return (
    <View style={styles.standard}>
      <View style={styles.standardHead}>
        <View style={styles.standardLine} />
        <Text style={styles.standardKicker}>THE WHOLESALE STANDARD</Text>
        <View style={styles.standardLine} />
      </View>
      <View style={styles.standardCard}>
        {STANDARD.map((s, i) => (
          <View key={s.label} style={[styles.standardItem, i > 0 && styles.standardDivider]}>
            <View style={styles.standardIcon}>
              <Ionicons name={s.icon} size={17} color={colors.olive[700]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.standardLabel}>{s.label}</Text>
              <Text style={styles.standardSub}>{s.sub}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

/* -------------------------------------------------------------------- */

const styles = StyleSheet.create({
  section: { marginBottom: spacing[8] },
  italic: { fontFamily: fontFamilies.display.italic, color: GOLD_SOFT },

  /* Trade band */
  trade: {
    marginTop: 6,
    marginBottom: spacing[7],
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 18,
    overflow: "hidden",
  },
  tradeWatermark: {
    position: "absolute",
    right: -6,
    bottom: -34,
    fontFamily: fontFamilies.display.semibold,
    fontSize: 130,
    lineHeight: 140,
    color: "rgba(201,178,122,0.08)",
  },
  tradeHead: { flexDirection: "row", alignItems: "center", gap: 14 },
  tradeKickerRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: WA },
  tradeKicker: { fontFamily: fontFamilies.mono.semibold, fontSize: 8.5, letterSpacing: 1.6, color: GOLD },
  tradeTitle: {
    marginTop: 6,
    fontFamily: fontFamilies.display.semibold,
    fontSize: 28,
    lineHeight: 31,
    letterSpacing: -0.4,
    color: CREAM,
  },
  waSeal: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: GOLD,
    alignItems: "center",
    justifyContent: "center",
  },
  waInner: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: WA,
    alignItems: "center",
    justifyContent: "center",
  },
  waLabel: {
    position: "absolute",
    bottom: -9,
    backgroundColor: INK,
    paddingHorizontal: 6,
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 7.5,
    letterSpacing: 1.4,
    color: GOLD,
  },
  tradeStats: { marginTop: 18, flexDirection: "row", gap: 8 },
  tradeStat: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(201,178,122,0.3)",
    backgroundColor: "rgba(201,178,122,0.07)",
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  tradeStatLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 7.5,
    letterSpacing: 0.9,
    textTransform: "uppercase",
    color: GOLD,
  },
  tradeStatValue: { marginTop: 3, fontFamily: fontFamilies.sans.bold, fontSize: 14, color: CREAM },

  /* Occasion */
  occScroll: { paddingHorizontal: H_PAD, gap: spacing[3] },
  occTile: { width: OCC_W, height: OCC_H },
  occImg: { ...StyleSheet.absoluteFillObject, borderRadius: 20 },
  occNum: {
    position: "absolute",
    top: 8,
    left: 8,
    minWidth: 34,
    height: 26,
    borderRadius: 13,
    backgroundColor: INK,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  occNumText: { fontFamily: fontFamilies.mono.semibold, fontSize: 10, letterSpacing: 1, color: GOLD_SOFT },
  occChip: {
    position: "absolute",
    top: 6,
    right: 6,
    height: 30,
    justifyContent: "center",
    borderRadius: radii.full,
    backgroundColor: INK,
    paddingHorizontal: 12,
  },
  occChipText: { fontFamily: fontFamilies.mono.semibold, fontSize: 8.5, letterSpacing: 1.2, color: C.lime },
  occCopy: { position: "absolute", left: 14, right: 14, bottom: 14 },
  occLabel: { fontFamily: fontFamilies.display.semibold, fontSize: 26, lineHeight: 28, color: CREAM },
  occTag: { marginTop: 1, fontFamily: fontFamilies.display.italic, fontSize: 13.5, color: GOLD_SOFT },
  occCta: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.3)",
    paddingTop: 8,
  },
  occCtaText: { fontFamily: fontFamilies.sans.semibold, fontSize: 11, color: CREAM },

  /* MOQ tiers */
  tierGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: H_PAD },
  tier: {
    flex: 1,
    borderRadius: 22,
    padding: 14,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
  },
  tierCircle: { position: "absolute", width: 140, height: 140, borderRadius: 70, right: -50, top: -50 },
  tierKicker: { fontFamily: fontFamilies.mono.semibold, fontSize: 9, letterSpacing: 1.6 },
  tierBig: {
    marginTop: 2,
    fontFamily: fontFamilies.display.semibold,
    fontSize: 40,
    lineHeight: 42,
    letterSpacing: -1,
  },
  tierUnit: { marginTop: -2, fontFamily: fontFamilies.display.italic, fontSize: 14 },
  tierFoot: { marginTop: "auto", flexDirection: "row", alignItems: "flex-end", gap: 8 },
  tierName: { fontFamily: fontFamilies.sans.bold, fontSize: 13.5 },
  tierSub: { fontFamily: fontFamilies.sans.regular, fontSize: 11 },
  tierBtn: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },

  /* Dispatch */
  dispatch: {
    marginBottom: spacing[8],
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 22,
    overflow: "hidden",
  },
  dispatchRoute: {
    position: "absolute",
    right: 20,
    top: 12,
    flexDirection: "row",
    gap: 5,
    transform: [{ rotate: "-8deg" }],
  },
  dispatchDash: { width: 8, height: 2, borderRadius: 1, backgroundColor: "rgba(22,23,15,0.18)" },
  dispatchKicker: { fontFamily: fontFamilies.mono.semibold, fontSize: 8.5, letterSpacing: 1.6, color: colors.olive[700] },
  dispatchTitle: {
    marginTop: 6,
    fontFamily: fontFamilies.display.semibold,
    fontSize: 26,
    lineHeight: 29,
    letterSpacing: -0.4,
    color: INK,
  },
  dispatchItalic: { fontFamily: fontFamilies.display.italic, color: "#8a6a24" },
  dispatchCta: {
    marginTop: 12,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 34,
    borderRadius: radii.full,
    backgroundColor: INK,
    paddingHorizontal: 14,
  },
  dispatchCtaText: { fontFamily: fontFamilies.sans.bold, fontSize: 12, color: CREAM },
  dispatchBadge: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: "rgba(255,255,255,0.55)",
    borderWidth: 1,
    borderColor: "rgba(22,23,15,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  dispatchTruck: {
    position: "absolute",
    right: -2,
    bottom: 4,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: INK,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#f3ead2",
  },

  /* Standard */
  standard: { marginHorizontal: H_PAD, marginTop: spacing[8], gap: spacing[2.5] },
  standardHead: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing[3] },
  standardLine: { flex: 1, height: 1, backgroundColor: `${colors.olive[600]}18` },
  standardKicker: { fontFamily: fontFamilies.mono.semibold, fontSize: 9.5, letterSpacing: 2, color: colors.olive[600] },
  standardCard: {
    paddingHorizontal: spacing[4],
    borderRadius: radii["2xl"],
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
  },
  standardItem: { flexDirection: "row", alignItems: "center", gap: spacing[3], paddingVertical: spacing[3] },
  standardDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.light.border },
  standardIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: C.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  standardLabel: { fontFamily: fontFamilies.sans.bold, fontSize: 13, color: C.text },
  standardSub: { marginTop: 1, fontFamily: fontFamilies.sans.regular, fontSize: 11.5, color: C.muted },
});
