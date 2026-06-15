import React, { useEffect, useState } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Display, Label, Body } from "@/components/ui/Typography";
import { colors, radii, spacing } from "@/lib/theme/tokens";

interface Activity {
  id: string;
  kind: "view" | "sale" | "follow" | "inventory" | "order" | "press" | "reads";
  count?: number;
  unit?: string;
  text: string;
  meta?: string;
  ago?: string;
  tone: "olive" | "paper" | "ink";
  span: "feature" | "wide" | "narrow";
  icon: keyof typeof Ionicons.glyphMap;
}

const SEED: Activity[] = [
  {
    id: "viewers",
    kind: "view",
    count: 8,
    unit: "live",
    text: "people are viewing this drop right now",
    span: "feature",
    tone: "olive",
    icon: "eye-outline",
  },
  {
    id: "sale",
    kind: "sale",
    text: "Olive trench · shipped to Tokyo",
    meta: "LKR 38,400",
    ago: "2m ago",
    span: "wide",
    tone: "paper",
    icon: "bag-handle-outline",
  },
  {
    id: "press",
    kind: "press",
    text: "Featured in Vogue Italia · Issue 26",
    meta: "‘Quiet luxury, loud values.’",
    ago: "1d ago",
    span: "narrow",
    tone: "ink",
    icon: "sparkles-outline",
  },
  {
    id: "followers",
    kind: "follow",
    count: 1,
    unit: "new",
    text: "follower from Mumbai",
    ago: "4m ago",
    span: "wide",
    tone: "paper",
    icon: "heart-outline",
  },
  {
    id: "inventory",
    kind: "inventory",
    text: "Atelier Lisboa · 3 new pieces just dropped",
    ago: "7m ago",
    span: "narrow",
    tone: "paper",
    icon: "cube-outline",
  },
  {
    id: "reads",
    kind: "reads",
    count: 2841,
    unit: "today",
    text: "journal reads",
    ago: "rolling 24h",
    span: "narrow",
    tone: "ink",
    icon: "book-outline",
  },
  {
    id: "order",
    kind: "order",
    text: "order placed · Colombo",
    meta: "LKR 22,100 · 2 pieces",
    ago: "9m ago",
    span: "wide",
    tone: "paper",
    icon: "flash-outline",
  },
  {
    id: "carts",
    kind: "press",
    count: 12,
    unit: "active",
    text: "carts holding pieces",
    ago: "live",
    span: "wide",
    tone: "olive",
    icon: "bag-outline",
  },
];

interface NowLiveProps {
  kicker?: string;
  title?: string;
  subtitle?: string;
}

/**
 * Real-time activity grid. The data is a static seed here — in production
 * it would be wired to a Supabase realtime channel.
 *
 *  - 8 cards, mixed sizes (one feature, one tall, rest regular)
 *  - Each card: icon, count, label, copy, timestamp
 *  - Live dot pulses on "live" cards
 */
export function NowLive({
  kicker = "Live",
  title = "What's happening on the floor.",
  subtitle = "A real-time feed of viewers, sales, press, and drops across our ateliers. The page is alive; this is the proof.",
}: NowLiveProps) {
  const router = useRouter();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(i);
  }, []);

  return (
    <View style={styles.wrap}>
      <View style={styles.bgBlob1} pointerEvents="none" />
      <View style={styles.bgBlob2} pointerEvents="none" />
      <View style={styles.halftone} pointerEvents="none" />

      <View style={styles.inner}>
        <View style={styles.header}>
          <View>
            <View style={styles.kickerRow}>
              <View style={styles.kickerRule} />
              <Label style={styles.kickerText}>{kicker}</Label>
              <View style={styles.liveDotWrap}>
                <View style={styles.liveDotPulse} />
                <Ionicons name="radio-outline" size={10} color={colors.light.primary} />
              </View>
            </View>
            <Display size="3xl" style={styles.title} numberOfLines={2}>
              {splitTitle(title)}
            </Display>
          </View>
          {subtitle ? <Body muted size="sm" style={styles.subtitle}>{subtitle}</Body> : null}
        </View>

        <View style={styles.grid}>
          {SEED.map((a, i) => (
            <Card key={a.id} activity={a} index={i} tick={tick} />
          ))}
        </View>

        <View style={styles.footer}>
          <View style={styles.footerLeft}>
            <View style={styles.footerLive} />
            <Label style={styles.footerText}>Stream refreshes every 30s</Label>
          </View>
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.footerLink}
            onPress={() => router.push("/(main)/products")}
          >
            <View style={styles.footerRule} />
            <Label style={styles.footerLinkText}>See all activity</Label>
            <Ionicons name="arrow-up" size={11} color={colors.light.foreground} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function splitTitle(t: string) {
  const parts = t.split(" ");
  if (parts.length < 2) return t;
  const last = parts.pop()!;
  return (
    <>
      {parts.join(" ")}{" "}
      <Display italic size="3xl" style={styles.titleAccent}>
        {last}
      </Display>
    </>
  );
}

function Card({
  activity,
  index,
  tick,
}: {
  activity: Activity;
  index: number;
  tick: number;
}) {
  const isLive = activity.ago === "live";
  // Nudge the "live" count slightly on each tick so it visibly breathes.
  const liveCount =
    isLive && activity.count
      ? activity.count + ((tick + index) % 4 === 0 ? 1 : 0)
      : activity.count;

  return (
    <View
      style={[
        styles.card,
        cardTone[activity.tone],
        activity.span === "feature" && styles.cardFeature,
        activity.span === "wide" && styles.cardWide,
        activity.span === "narrow" && styles.cardNarrow,
      ]}
    >
      <View style={styles.cardHeader}>
        <View
          style={[
            styles.iconWrap,
            activity.tone === "paper" ? styles.iconWrapPaper : styles.iconWrapDark,
          ]}
        >
          <Ionicons
            name={activity.icon}
            size={14}
            color={activity.tone === "paper" ? colors.light.primary : colors.olive[300]}
          />
        </View>
        {isLive ? (
          <View style={styles.liveTag}>
            <View style={styles.liveDotSmall} />
            <Label style={styles.liveTagText}>Live</Label>
          </View>
        ) : activity.ago ? (
          <Label style={[styles.agoText, activity.tone === "paper" ? styles.agoPaper : styles.agoDark]}>
            {activity.ago}
          </Label>
        ) : null}
      </View>

      {liveCount != null ? (
        <View style={styles.countRow}>
          <Display size="2xl" style={[styles.countText, activity.tone === "paper" ? styles.countPaper : styles.countDark]}>
            {liveCount.toLocaleString()}
          </Display>
          {activity.unit ? (
            <Label style={[styles.countUnit, activity.tone === "paper" ? styles.countUnitPaper : styles.countUnitDark]}>
              {activity.unit}
            </Label>
          ) : null}
        </View>
      ) : null}

      <Body
        size={liveCount != null ? "sm" : "md"}
        style={[
          styles.bodyText,
          activity.tone === "paper" ? styles.bodyPaper : styles.bodyDark,
        ]}
      >
        {activity.text}
      </Body>
      {activity.meta ? (
        <Label style={[styles.metaText, activity.tone === "paper" ? styles.metaPaper : styles.metaDark]}>
          {activity.meta}
        </Label>
      ) : null}

      <View style={[styles.hoverHairline, activity.tone === "paper" ? styles.hairlinePaper : styles.hairlineDark]} />
      <Ionicons
        name="arrow-up"
        size={12}
        color={activity.tone === "paper" ? colors.light.primary : colors.olive[300]}
        style={styles.cardArrow}
      />
    </View>
  );
}

const cardTone = {
  olive: { backgroundColor: colors.olive[700], borderColor: "rgba(168, 176, 107, 0.3)" },
  paper: { backgroundColor: colors.paper.warm, borderColor: colors.light.border },
  ink: { backgroundColor: colors.light.foreground, borderColor: colors.light.foreground },
} as const;

const styles = StyleSheet.create({
  wrap: {
    paddingTop: spacing[10],
    paddingBottom: spacing[10],
    backgroundColor: colors.paper.cream,
    overflow: "hidden",
    position: "relative",
  },
  bgBlob1: {
    position: "absolute",
    top: -60,
    left: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(204, 204, 160, 0.35)",
  },
  bgBlob2: {
    position: "absolute",
    bottom: -40,
    right: -60,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "rgba(168, 176, 107, 0.30)",
  },
  halftone: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(168, 176, 107, 0.05)" },
  inner: { paddingHorizontal: 20, gap: spacing[6] },
  header: { gap: spacing[2] },
  kickerRow: { flexDirection: "row", alignItems: "center", gap: spacing[2], marginBottom: 4 },
  kickerRule: { width: 24, height: 1, backgroundColor: colors.light.primary },
  kickerText: { color: colors.light.primary },
  liveDotWrap: { width: 14, height: 14, alignItems: "center", justifyContent: "center", marginLeft: 2 },
  liveDotPulse: { position: "absolute", width: 14, height: 14, borderRadius: 7, backgroundColor: "rgba(83, 94, 44, 0.30)" },
  title: { color: colors.light.foreground, lineHeight: 34 },
  titleAccent: { color: colors.light.primary },
  subtitle: { marginTop: spacing[2] },
  // Grid
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing[3] },
  card: {
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing[4],
    gap: spacing[2],
    minHeight: 130,
    position: "relative",
  },
  cardFeature: { width: "100%", minHeight: 180 },
  cardWide: { width: "48%", flexGrow: 1, minHeight: 150 },
  cardNarrow: { width: "48%", flexGrow: 1, minHeight: 130 },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  iconWrap: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  iconWrapPaper: { backgroundColor: colors.olive[50] },
  iconWrapDark: { backgroundColor: "rgba(168, 176, 107, 0.18)" },
  liveTag: { flexDirection: "row", alignItems: "center", gap: 4 },
  liveDotSmall: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.olive[300] },
  liveTagText: { color: colors.olive[300], fontSize: 9 },
  agoText: { fontSize: 9 },
  agoPaper: { color: colors.light.mutedForeground },
  agoDark: { color: "rgba(245, 244, 239, 0.55)" },
  countRow: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  countText: { fontSize: 36, lineHeight: 40, fontVariant: ["tabular-nums"] },
  countPaper: { color: colors.light.foreground },
  countDark: { color: colors.paper.cream },
  countUnit: { fontSize: 10 },
  countUnitPaper: { color: colors.light.mutedForeground },
  countUnitDark: { color: colors.olive[300] },
  bodyText: { fontWeight: "500" },
  bodyPaper: { color: colors.light.foreground },
  bodyDark: { color: "rgba(245, 244, 239, 0.9)" },
  metaText: { fontSize: 10 },
  metaPaper: { color: colors.light.mutedForeground },
  metaDark: { color: "rgba(245, 244, 239, 0.6)" },
  hoverHairline: {
    position: "absolute",
    left: spacing[4],
    right: spacing[4],
    bottom: 6,
    height: 1,
  },
  hairlinePaper: { backgroundColor: colors.light.primary },
  hairlineDark: { backgroundColor: colors.olive[300] },
  cardArrow: { position: "absolute", bottom: spacing[3], right: spacing[3], opacity: 0.7 },
  // Footer
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
  },
  footerLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  footerLive: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.light.primary },
  footerText: { color: colors.light.mutedForeground },
  footerLink: { flexDirection: "row", alignItems: "center", gap: 6 },
  footerRule: { width: 24, height: 1, backgroundColor: colors.light.foreground },
  footerLinkText: { color: colors.light.foreground },
});
