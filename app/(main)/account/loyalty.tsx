import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { ScreenHeader } from "@/components/layout";
import { Badge } from "@/components/ui";
import { Body, Display, Label } from "@/components/ui/Typography";
import { useAuth } from "@/lib/supabase/auth";
import { supabase } from "@/lib/supabase/client";
import { useLoyalty, tierProgress, type LoyaltyTier } from "@/lib/hooks/useLoyalty";
import { colors, radii, shadows, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

interface LoyaltyTxn {
  id: string;
  points: number;
  reason: string;
  created_at: string;
  order_id?: string | null;
}

const TIER_DETAILS: Record<LoyaltyTier, {
  copy: string;
  perks: { icon: keyof typeof Ionicons.glyphMap; label: string }[];
  bg: string;
  fg: string;
  ring: string;
}> = {
  Bronze: {
    copy: "You're off the runway. Earn points to unlock free shipping.",
    bg: colors.accent2.ochre + "20",
    fg: colors.accent2.ochre,
    ring: colors.accent2.ochre,
    perks: [
      { icon: "leaf-outline", label: "1 point per LKR 100 spent" },
      { icon: "sparkles-outline", label: "Birthday surprise" },
    ],
  },
  Silver: {
    copy: "Silver is unlocked. Welcome to free returns.",
    bg: "#a3a3a3" + "30",
    fg: "#525252",
    ring: "#737373",
    perks: [
      { icon: "leaf-outline", label: "1.25 points per LKR 100 spent" },
      { icon: "refresh-outline", label: "Free returns" },
      { icon: "sparkles-outline", label: "Birthday surprise" },
    ],
  },
  Gold: {
    copy: "Gold tier. Free shipping on every order, no minimum.",
    bg: colors.accent2.ochre + "30",
    fg: "#a17322",
    ring: colors.accent2.ochre,
    perks: [
      { icon: "leaf-outline", label: "1.5 points per LKR 100 spent" },
      { icon: "car-outline", label: "Free shipping always" },
      { icon: "refresh-outline", label: "Free returns" },
      { icon: "headset-outline", label: "Priority support" },
    ],
  },
  Platinum: {
    copy: "Platinum. Atelier concierge and early access to drops.",
    bg: colors.light.primary,
    fg: colors.light.primaryForeground,
    ring: colors.olive[700],
    perks: [
      { icon: "leaf-outline", label: "2 points per LKR 100 spent" },
      { icon: "rocket-outline", label: "Early access drops" },
      { icon: "headset-outline", label: "1:1 atelier concierge" },
      { icon: "gift-outline", label: "Annual gift" },
    ],
  },
};

export default function LoyaltyScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const loyalty = useLoyalty();
  const [transactions, setTransactions] = useState<LoyaltyTxn[]>([]);

  useEffect(() => {
    if (!user?.id) return;
    const userId = user.id;
    let cancelled = false;
    supabase
      .from("loyalty_transactions")
      .select("id, points, reason, created_at, order_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (!cancelled) setTransactions((data as LoyaltyTxn[]) ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, loyalty.state.lifetime_points]);

  const tier = tierProgress(loyalty.state.lifetime_points);
  const details = TIER_DETAILS[tier.name as LoyaltyTier];
  const nextTierName = tier.next === 5000 ? "Platinum" : tier.next === 2000 ? "Gold" : tier.next === 500 ? "Silver" : null;
  const pointsToNext = tier.next !== Infinity ? tier.next - loyalty.state.lifetime_points : 0;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title="Rewards" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View
          style={[
            styles.heroShadowWrap,
            {
              backgroundColor: details.bg,
              shadowColor: details.ring,
              borderColor: details.ring + "40",
            },
          ]}
        >
          <View style={[styles.heroCard, { backgroundColor: details.bg }]}>
            <View style={styles.heroBlob1} />
            <View style={styles.heroBlob2} />
            <View style={styles.heroContent}>
              <View style={styles.heroTopRow}>
                <View>
                  <Label style={[styles.heroKicker, { color: details.fg, opacity: 0.8 }]}>
                    Tier · {tier.name}
                  </Label>
                  <Display size="3xl" style={[styles.heroTitle, { color: details.fg }]}>
                    {loyalty.state.points.toLocaleString()}
                  </Display>
                  <Body style={{ color: details.fg, opacity: 0.8 }}>points available to spend</Body>
                </View>
                <View style={[styles.trophyCircle, { borderColor: details.ring }]}>
                  <Ionicons name="trophy" size={28} color={details.fg} />
                </View>
              </View>

              <View style={styles.progressWrap}>
                <View style={[styles.progressTrack, { backgroundColor: details.fg + "20" }]}>
                  <View style={[styles.progressFill, { width: `${tier.pct}%`, backgroundColor: details.fg }]} />
                </View>
                <View style={styles.progressMeta}>
                  <Body size="xs" style={{ color: details.fg, opacity: 0.85 }}>
                    {loyalty.state.lifetime_points.toLocaleString()} lifetime
                  </Body>
                  {nextTierName ? (
                    <Body size="xs" style={{ color: details.fg, opacity: 0.85 }}>
                      {pointsToNext.toLocaleString()} to {nextTierName}
                    </Body>
                  ) : (
                    <Body size="xs" style={{ color: details.fg, opacity: 0.85 }}>Top tier unlocked</Body>
                  )}
                </View>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.statsRow}>
          <Stat label="Available" value={loyalty.state.points} icon="wallet-outline" />
          <Stat label="Lifetime" value={loyalty.state.lifetime_points} icon="infinite-outline" />
          <Stat label="Tier rank" value={tier.name} icon="ribbon-outline" />
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Display size="lg">{tier.name} perks</Display>
            <Badge style={{ backgroundColor: details.bg }}>
              <Label style={{ color: details.fg, fontSize: 9 }}>ACTIVE</Label>
            </Badge>
          </View>
          <Body muted size="sm" style={styles.perkCopy}>{details.copy}</Body>
          <View style={styles.perks}>
            {details.perks.map((p, i) => (
              <View key={i} style={styles.perkRow}>
                <View style={[styles.perkIcon, { backgroundColor: details.bg }]}>
                  <Ionicons name={p.icon} size={14} color={details.fg} />
                </View>
                <Body size="sm">{p.label}</Body>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Display size="lg">Tier ladder</Display>
          </View>
          <TierLadder currentTier={tier.name as LoyaltyTier} currentLifetime={loyalty.state.lifetime_points} />
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Display size="lg">Points history</Display>
            <Label style={styles.kicker}>{transactions.length} entries</Label>
          </View>
          {transactions.length === 0 ? (
            <View style={styles.emptyMini}>
              <Ionicons name="leaf-outline" size={26} color={colors.light.mutedForeground} />
              <Body muted size="xs">No points yet. Start shopping to earn.</Body>
            </View>
          ) : (
            <View style={styles.history}>
              {transactions.map((t, i) => {
                const isEarn = t.points > 0;
                return (
                  <View key={t.id ?? i} style={styles.historyRow}>
                    <View style={[styles.historyDot, isEarn ? styles.historyDotEarn : styles.historyDotSpend]}>
                      <Ionicons
                        name={isEarn ? "add" : "remove"}
                        size={12}
                        color={isEarn ? colors.olive[700] : colors.light.destructive}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Body size="sm" numberOfLines={1}>{t.reason ?? (isEarn ? "Points earned" : "Points spent")}</Body>
                      <Body muted size="xs">{new Date(t.created_at).toLocaleDateString()}</Body>
                    </View>
                    <Label style={[styles.historyValue, isEarn ? styles.historyValueEarn : styles.historyValueSpend]}>
                      {isEarn ? "+" : ""}{t.points.toLocaleString()}
                    </Label>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <TouchableOpacity style={styles.shopBtn} onPress={() => router.push("/(main)/products" as never)} activeOpacity={0.85}>
          <Ionicons name="bag-handle-outline" size={16} color={colors.light.primaryForeground} />
          <Label style={styles.shopBtnText}>Earn more by shopping</Label>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value, icon }: { label: string; value: string | number; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statIcon}>
        <Ionicons name={icon} size={16} color={colors.light.primary} />
      </View>
      <Display size="md" numberOfLines={1}>{typeof value === "number" ? value.toLocaleString() : value}</Display>
      <Label style={styles.statLabel}>{label}</Label>
    </View>
  );
}

function TierLadder({ currentTier, currentLifetime }: { currentTier: LoyaltyTier; currentLifetime: number }) {
  const tiers: { name: LoyaltyTier; min: number; cap: number | null }[] = [
    { name: "Bronze", min: 0, cap: 500 },
    { name: "Silver", min: 500, cap: 2000 },
    { name: "Gold", min: 2000, cap: 5000 },
    { name: "Platinum", min: 5000, cap: null },
  ];
  const order: LoyaltyTier[] = ["Bronze", "Silver", "Gold", "Platinum"];
  const currentIndex = order.indexOf(currentTier);

  return (
    <View style={styles.ladder}>
      {tiers.map((t, i) => {
        const isUnlocked = i <= currentIndex;
        const isCurrent = i === currentIndex;
        const detail = TIER_DETAILS[t.name];
        return (
          <View key={t.name} style={styles.ladderRow}>
            <View style={[styles.ladderMarker, isUnlocked && styles.ladderMarkerOn, isCurrent && { backgroundColor: detail.ring, borderColor: detail.ring }]}>
              <Ionicons
                name={isUnlocked ? "checkmark" : "lock-closed"}
                size={12}
                color={isUnlocked ? colors.light.primaryForeground : colors.light.mutedForeground}
              />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.ladderNameRow}>
                <Body size="sm" style={[styles.ladderName, isUnlocked && { color: colors.light.foreground, fontWeight: typography.fontWeights.semibold }]}>
                  {t.name}
                </Body>
                {isCurrent && <Badge style={{ backgroundColor: detail.bg }}><Label style={{ color: detail.fg, fontSize: 9 }}>YOU</Label></Badge>}
              </View>
              <Body muted size="xs">
                {t.min.toLocaleString()} lifetime pts{t.cap ? ` — ${t.cap.toLocaleString()}` : "+"}
              </Body>
            </View>
            <Label style={styles.ladderProgress}>
              {isUnlocked ? `${t.min.toLocaleString()}+` : `${(t.min - currentLifetime).toLocaleString()} to go`}
            </Label>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  content: { padding: spacing[5], paddingBottom: spacing[8] },
  // Shadows and `overflow: hidden` can't live on the same node — the clip
  // would cut off the drop shadow along with the content. The shadow (the
  // card's "glow") lives on this outer wrapper; the inner `heroCard` clips
  // the glow blobs to its rounded corners instead. `shadowColor` and
  // `borderColor` are set per-tier inline (see JSX) so the glow actually
  // matches the card's own accent color instead of a generic dark shadow —
  // Android can't tint its elevation shadow, so the tier-colored border
  // carries the "glow matches the card" effect there.
  heroShadowWrap: {
    borderRadius: radii["3xl"],
    marginBottom: spacing[5],
    borderWidth: 1,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 22,
    elevation: 12,
  },
  heroCard: {
    borderRadius: radii["3xl"],
    overflow: "hidden",
  },
  heroBlob1: {
    position: "absolute",
    top: -50,
    right: -50,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  heroBlob2: {
    position: "absolute",
    bottom: -40,
    left: -30,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  heroContent: { padding: spacing[5], gap: spacing[3] },
  heroTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  heroKicker: { fontFamily: fontFamilies.mono.semibold, fontSize: typography.fontSizes.xs, letterSpacing: 0.6 },
  heroTitle: { marginVertical: 2 },
  trophyCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.4)",
    borderWidth: 2,
  },
  progressWrap: { gap: 6 },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 4 },
  progressMeta: { flexDirection: "row", justifyContent: "space-between" },
  statsRow: { flexDirection: "row", gap: 8, marginBottom: spacing[5] },
  statCard: {
    flex: 1,
    backgroundColor: colors.light.card,
    borderRadius: radii.xl,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.light.border,
    gap: 4,
  },
  statIcon: {
    width: 28,
    height: 28,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.olive[50],
    marginBottom: 2,
  },
  statLabel: { color: colors.light.mutedForeground, fontSize: 10 },
  card: {
    backgroundColor: colors.light.card,
    borderRadius: radii["2xl"],
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colors.light.border,
    marginBottom: spacing[4],
    ...shadows.soft,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing[3] },
  perkCopy: { marginBottom: spacing[3] },
  perks: { gap: 10 },
  perkRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  perkIcon: {
    width: 32,
    height: 32,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  ladder: { gap: 4 },
  ladderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  ladderMarker: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.light.border,
  },
  ladderMarkerOn: { backgroundColor: colors.light.primary },
  ladderNameRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  ladderName: { color: colors.light.mutedForeground },
  ladderProgress: {
    color: colors.light.mutedForeground,
    fontFamily: fontFamilies.mono.medium,
    fontSize: typography.fontSizes.xs,
  },
  history: { gap: 4 },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },
  historyDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  historyDotEarn: { backgroundColor: colors.olive[100] },
  historyDotSpend: { backgroundColor: colors.light.destructive + "20" },
  historyValue: { fontFamily: fontFamilies.mono.semibold, fontSize: typography.fontSizes.sm },
  historyValueEarn: { color: colors.olive[700] },
  historyValueSpend: { color: colors.light.destructive },
  emptyMini: {
    alignItems: "center",
    padding: spacing[5],
    gap: 8,
  },
  shopBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.light.primary,
    borderRadius: radii.xl,
    paddingVertical: spacing[3],
  },
  shopBtnText: {
    color: colors.light.primaryForeground,
    fontFamily: fontFamilies.mono.medium,
    fontSize: typography.fontSizes.sm,
  },
  kicker: { color: colors.light.mutedForeground, fontSize: 10 },
});
