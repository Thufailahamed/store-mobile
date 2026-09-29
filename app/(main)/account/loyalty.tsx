import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@/components/ui/Icon";
import { PaperBackground } from "@/components/layout";
import { useAuth } from "@/lib/supabase/auth";
import { supabase } from "@/lib/supabase/client";
import {
  useLoyalty,
  tierProgress,
  type LoyaltyTier,
} from "@/lib/hooks/useLoyalty";
import { colors, radii, shadows, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

interface LoyaltyTxn {
  id: string;
  points: number;
  reason: string;
  created_at: string;
  order_id?: string | null;
}

const GOLD = colors.accent2.ochre;
const GOLD_DEEP = "#85651b";
const GOLD_SOFT = "#E8CF8F";
const HAIRLINE = "rgba(22, 23, 15, 0.08)";

const TIER_DETAILS: Record<
  LoyaltyTier,
  {
    copy: string;
    perks: { icon: keyof typeof Ionicons.glyphMap; title: string; desc: string }[];
    tag: string;
  }
> = {
  Bronze: {
    copy: "Earn points with every purchase to unlock complimentary delivery and private sales.",
    tag: "Bronze Patron",
    perks: [
      {
        icon: "sparkles",
        title: "1 point per LKR 100",
        desc: "Points are credited automatically on all confirmed orders.",
      },
      {
        icon: "gift-outline",
        title: "Birthday surprise",
        desc: "A celebratory reward credited during your birth month.",
      },
      {
        icon: "notifications-outline",
        title: "Lookbook previews",
        desc: "Early access to upcoming seasonal releases.",
      },
    ],
  },
  Silver: {
    copy: "Silver tier unlocked. Enjoy accelerated point multipliers and complimentary returns on all eligible pieces.",
    tag: "Silver Patron",
    perks: [
      {
        icon: "sparkles",
        title: "1.25 points per LKR 100",
        desc: "Accelerated earning rate across all designer collections.",
      },
      {
        icon: "refresh-outline",
        title: "Complimentary return shipping",
        desc: "Zero collection fees on returns within the 14-day window.",
      },
      {
        icon: "gift-outline",
        title: "Birthday surprise",
        desc: "Curated gift voucher credited during your birth month.",
      },
    ],
  },
  Gold: {
    copy: "Gold patron status. Complimentary express delivery on every order, no minimum spend required.",
    tag: "Gold Connoisseur",
    perks: [
      {
        icon: "sparkles",
        title: "1.5 points per LKR 100",
        desc: "High-yield earning rate on all luxury pieces and accessories.",
      },
      {
        icon: "airplane-outline",
        title: "Free express shipping",
        desc: "Priority courier delivery with zero minimum order requirement.",
      },
      {
        icon: "refresh-outline",
        title: "Complimentary returns",
        desc: "Doorstep return collection on all purchases.",
      },
      {
        icon: "headset-outline",
        title: "Priority concierge support",
        desc: "Dedicated support channel with faster response times.",
      },
    ],
  },
  Platinum: {
    copy: "The highest tier of patronage — private concierge, runway pre-allocations, and annual couture gifts.",
    tag: "Platinum Patron",
    perks: [
      {
        icon: "sparkles",
        title: "2 points per LKR 100",
        desc: "Double points earning on every acquisition.",
      },
      {
        icon: "flash-outline",
        title: "Drop pre-access",
        desc: "A private 24-hour window on limited-run and runway pieces.",
      },
      {
        icon: "person-outline",
        title: "Personal concierge",
        desc: "A direct line to your dedicated fashion consultant.",
      },
      {
        icon: "trophy-outline",
        title: "Annual couture gift",
        desc: "A handcrafted anniversary piece delivered to your residence.",
      },
    ],
  },
};

export default function LoyaltyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const loyalty = useLoyalty();
  const [transactions, setTransactions] = useState<LoyaltyTxn[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTransactions = async () => {
    if (!user?.id) return;
    try {
      const { data } = await supabase
        .from("loyalty_transactions")
        .select("id, points, reason, created_at, order_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      setTransactions((data as LoyaltyTxn[]) ?? []);
    } catch {
      // Non-fatal
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [user?.id, loyalty.state.lifetime_points]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loyalty.reload(), fetchTransactions()]);
    setRefreshing(false);
  };

  const tier = tierProgress(loyalty.state.lifetime_points);
  const details = TIER_DETAILS[tier.name as LoyaltyTier];
  const nextTierName =
    tier.next === 5000
      ? "Platinum"
      : tier.next === 2000
        ? "Gold"
        : tier.next === 500
          ? "Silver"
          : null;
  const pointsToNext =
    tier.next !== Infinity ? tier.next - loyalty.state.lifetime_points : 0;

  return (
    <PaperBackground>
      <SafeAreaView style={styles.container} edges={["top"]}>
        {/* Navigation */}
        <View style={styles.navBar}>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={20} color={colors.light.foreground} />
          </TouchableOpacity>

          <Text style={styles.navTitle}>Rewards</Text>

          <TouchableOpacity
            style={styles.navBtn}
            onPress={onRefresh}
            disabled={refreshing}
            activeOpacity={0.7}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Refresh"
          >
            {refreshing ? (
              <ActivityIndicator size="small" color={GOLD} />
            ) : (
              <Ionicons name="refresh-outline" size={18} color={colors.light.foreground} />
            )}
          </TouchableOpacity>
        </View>

        {loyalty.loading && !refreshing ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={GOLD} size="small" />
            <Text style={styles.loadingText}>Loading your rewards…</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: insets.bottom + 40 },
            ]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={GOLD}
              />
            }
          >
            {/* Heading */}
            <View style={styles.pageHead}>
              <Text style={styles.eyebrow}>Patron program</Text>
              <Text style={styles.pageTitle}>
                Privilege &amp; <Text style={styles.pageTitleAccent}>rewards.</Text>
              </Text>
            </View>

            {/* Points hero */}
            <LinearGradient
              colors={["#1f2418", "#14170e"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.hero}
            >
              <View style={styles.heroTop}>
                <Text style={styles.heroTier}>{details.tag}</Text>
                <View style={styles.heroIcon}>
                  <Ionicons name="trophy-outline" size={16} color={GOLD_SOFT} />
                </View>
              </View>

              <Text style={styles.heroPoints}>
                {loyalty.state.points.toLocaleString()}
              </Text>
              <Text style={styles.heroSub}>Points available to redeem</Text>

              <View style={styles.heroProgress}>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${Math.max(tier.pct, 3)}%` },
                    ]}
                  />
                </View>
                <View style={styles.progressMeta}>
                  <Text style={styles.progressMetaText}>
                    {loyalty.state.lifetime_points.toLocaleString()} lifetime
                  </Text>
                  <Text style={styles.progressMetaText}>
                    {nextTierName
                      ? `${pointsToNext.toLocaleString()} pts to ${nextTierName}`
                      : "Highest tier reached"}
                  </Text>
                </View>
              </View>
            </LinearGradient>

            {/* Stat strip */}
            <View style={styles.statsStrip}>
              <View style={styles.statCell}>
                <Text style={[
                  styles.statNum,
                  loyalty.state.points === 0 && styles.statNumMuted,
                ]}>
                  {loyalty.state.points.toLocaleString()}
                </Text>
                <Text style={styles.statLabel}>Available</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statCell}>
                <Text style={[
                  styles.statNum,
                  loyalty.state.lifetime_points === 0 && styles.statNumMuted,
                ]}>
                  {loyalty.state.lifetime_points.toLocaleString()}
                </Text>
                <Text style={styles.statLabel}>Lifetime</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statCell}>
                <Text style={styles.statNum} numberOfLines={1}>
                  {tier.name}
                </Text>
                <Text style={styles.statLabel}>Tier</Text>
              </View>
            </View>

            {/* Tier perks */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.eyebrow}>Your benefits</Text>
                <View style={styles.activePill}>
                  <View style={styles.activeDot} />
                  <Text style={styles.activePillText}>Active</Text>
                </View>
              </View>
              <Text style={styles.cardTitle}>{tier.name} privileges</Text>
              <Text style={styles.cardCopy}>{details.copy}</Text>

              {details.perks.map((p, i) => (
                <View key={i} style={[styles.perkRow, i > 0 && styles.rowDivider]}>
                  <View style={styles.perkIcon}>
                    <Ionicons name={p.icon} size={15} color={GOLD_DEEP} />
                  </View>
                  <View style={styles.perkBody}>
                    <Text style={styles.perkTitle}>{p.title}</Text>
                    <Text style={styles.perkDesc}>{p.desc}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Progression */}
            <View style={styles.card}>
              <Text style={styles.eyebrow}>Tiers</Text>
              <Text style={styles.cardTitle}>Patron progression</Text>
              <Text style={styles.cardCopy}>
                Lifetime points determine your status. Tiers never downgrade once
                unlocked.
              </Text>
              <TierLadder
                currentTier={tier.name as LoyaltyTier}
                currentLifetime={loyalty.state.lifetime_points}
              />
            </View>

            {/* History */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.eyebrow}>Ledger</Text>
                <Text style={styles.cardCount}>
                  {transactions.length} {transactions.length === 1 ? "entry" : "entries"}
                </Text>
              </View>
              <Text style={styles.cardTitle}>Points history</Text>

              {transactions.length === 0 ? (
                <View style={styles.emptyHistory}>
                  <View style={styles.emptyHistoryIcon}>
                    <Ionicons name="receipt-outline" size={22} color={colors.olive[700]} />
                  </View>
                  <Text style={styles.emptyHistoryTitle}>No activity yet</Text>
                  <Text style={styles.emptyHistorySub}>
                    Confirmed orders and reviews credit points automatically.
                  </Text>
                </View>
              ) : (
                <View>
                  {transactions.map((t, i) => {
                    const isEarn = t.points > 0;
                    return (
                      <View
                        key={t.id ?? i}
                        style={[styles.histRow, i > 0 && styles.rowDivider]}
                      >
                        <View
                          style={[
                            styles.histIcon,
                            isEarn ? styles.histIconEarn : styles.histIconSpend,
                          ]}
                        >
                          <Ionicons
                            name={isEarn ? "add" : "remove"}
                            size={13}
                            color={isEarn ? GOLD_DEEP : colors.accent2.rust}
                          />
                        </View>
                        <View style={styles.histBody}>
                          <Text style={styles.histReason} numberOfLines={1}>
                            {t.reason || (isEarn ? "Points credited" : "Points redeemed")}
                          </Text>
                          <Text style={styles.histDate}>
                            {new Date(t.created_at).toLocaleDateString(undefined, {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.histPts,
                            isEarn ? styles.histPtsEarn : styles.histPtsSpend,
                          ]}
                        >
                          {isEarn ? "+" : "−"}
                          {Math.abs(t.points).toLocaleString()}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            {/* CTA */}
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => router.push("/(main)/products" as any)}
              activeOpacity={0.88}
              accessibilityRole="button"
            >
              <Text style={styles.primaryBtnText}>Shop to earn points</Text>
              <View style={styles.primaryBtnArrow}>
                <Ionicons name="arrow-forward" size={14} color={colors.olive[900]} />
              </View>
            </TouchableOpacity>
          </ScrollView>
        )}
      </SafeAreaView>
    </PaperBackground>
  );
}

/* ------------------------------------------------------------------ */
/*  Tier ladder                                                        */
/* ------------------------------------------------------------------ */
function TierLadder({
  currentTier,
  currentLifetime,
}: {
  currentTier: LoyaltyTier;
  currentLifetime: number;
}) {
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
        const isLast = i === tiers.length - 1;

        return (
          <View key={t.name} style={styles.ladderRow}>
            {/* Node + connector */}
            <View style={styles.ladderNodeCol}>
              <View
                style={[
                  styles.ladderNode,
                  isUnlocked && styles.ladderNodeUnlocked,
                  isCurrent && styles.ladderNodeCurrent,
                ]}
              >
                {isUnlocked && (
                  <Ionicons
                    name="checkmark"
                    size={10}
                    color={isCurrent ? colors.olive[900] : colors.paper.cream}
                  />
                )}
              </View>
              {!isLast && (
                <View
                  style={[
                    styles.ladderLine,
                    i < currentIndex && styles.ladderLineDone,
                  ]}
                />
              )}
            </View>

            {/* Info */}
            <View style={[styles.ladderInfo, !isLast && { paddingBottom: spacing[4] }]}>
              <View style={styles.ladderNameRow}>
                <Text
                  style={[
                    styles.ladderName,
                    isUnlocked && styles.ladderNameUnlocked,
                  ]}
                >
                  {t.name}
                </Text>
                {isCurrent && (
                  <View style={styles.youBadge}>
                    <Text style={styles.youBadgeText}>You</Text>
                  </View>
                )}
              </View>
              <Text style={styles.ladderRange}>
                {t.min.toLocaleString()} lifetime pts
                {t.cap ? `–${t.cap.toLocaleString()}` : "+"}
              </Text>
            </View>

            {/* Status */}
            {!isUnlocked && (
              <Text style={styles.ladderToGo}>
                {(t.min - currentLifetime).toLocaleString()} to go
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontFamily: fontFamilies.display.italic,
    fontSize: 14,
    color: colors.light.mutedForeground,
  },

  /* Nav */
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[2.5],
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.paper.cream,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: HAIRLINE,
  },
  navTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 15,
    color: colors.light.foreground,
  },

  scrollContent: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
    gap: 14,
  },

  /* Heading */
  pageHead: {
    marginBottom: spacing[2],
  },
  eyebrow: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: GOLD_DEEP,
    marginBottom: 4,
  },
  pageTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 32,
    letterSpacing: -0.6,
    lineHeight: 38,
    color: colors.light.foreground,
  },
  pageTitleAccent: {
    fontFamily: fontFamilies.display.italic,
    color: GOLD_DEEP,
  },

  /* Hero */
  hero: {
    borderRadius: 24,
    padding: spacing[5],
    ...shadows.editorial,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  heroTier: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: "rgba(232, 207, 143, 0.85)",
  },
  heroIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(200, 164, 74, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroPoints: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 44,
    letterSpacing: -1.2,
    color: colors.paper.cream,
  },
  heroSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12.5,
    color: "rgba(250, 248, 241, 0.6)",
  },
  heroProgress: {
    marginTop: spacing[4],
    gap: 8,
  },
  progressTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(250, 248, 241, 0.14)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: GOLD_SOFT,
  },
  progressMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  progressMetaText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 0.4,
    color: "rgba(250, 248, 241, 0.55)",
  },

  /* Stat strip */
  statsStrip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.paper.cream,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: HAIRLINE,
    paddingVertical: 14,
    ...shadows.soft,
  },
  statCell: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  statNum: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 20,
    letterSpacing: -0.3,
    color: colors.light.foreground,
  },
  statNumMuted: {
    color: "rgba(22, 23, 15, 0.35)",
  },
  statLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9.5,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.light.mutedForeground,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 28,
    backgroundColor: colors.light.border,
  },

  /* Cards */
  card: {
    backgroundColor: colors.paper.cream,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: HAIRLINE,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    paddingBottom: spacing[3],
    ...shadows.soft,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 20,
    letterSpacing: -0.3,
    color: colors.light.foreground,
    marginTop: 2,
  },
  cardCopy: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.light.mutedForeground,
    marginTop: 6,
  },
  cardCount: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.light.mutedForeground,
  },
  activePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: "rgba(200, 164, 74, 0.12)",
  },
  activeDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: GOLD_DEEP,
  },
  activePillText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 11,
    color: GOLD_DEEP,
  },

  /* Perks */
  perkRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing[3],
    paddingVertical: spacing[3.5],
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.light.border,
  },
  perkIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(200, 164, 74, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  perkBody: {
    flex: 1,
    gap: 3,
  },
  perkTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13.5,
    color: colors.light.foreground,
  },
  perkDesc: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.light.mutedForeground,
  },

  /* Ladder */
  ladder: {
    marginTop: spacing[4],
  },
  ladderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  ladderNodeCol: {
    alignItems: "center",
    width: 20,
    marginRight: spacing[3],
  },
  ladderNode: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "rgba(22, 23, 15, 0.15)",
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  ladderNodeUnlocked: {
    backgroundColor: colors.olive[900],
    borderColor: colors.olive[900],
  },
  ladderNodeCurrent: {
    backgroundColor: GOLD_SOFT,
    borderColor: GOLD,
  },
  ladderLine: {
    flex: 1,
    width: 1.5,
    backgroundColor: "rgba(22, 23, 15, 0.1)",
    marginTop: 2,
  },
  ladderLineDone: {
    backgroundColor: colors.olive[900],
  },
  ladderInfo: {
    flex: 1,
    gap: 2,
  },
  ladderNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ladderName: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14,
    color: colors.light.mutedForeground,
  },
  ladderNameUnlocked: {
    color: colors.light.foreground,
  },
  youBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.full,
    backgroundColor: "rgba(200, 164, 74, 0.18)",
  },
  youBadgeText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 10.5,
    color: GOLD_DEEP,
  },
  ladderRange: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11.5,
    color: colors.light.mutedForeground,
  },
  ladderToGo: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 0.4,
    color: colors.light.mutedForeground,
    marginTop: 3,
  },

  /* History */
  emptyHistory: {
    alignItems: "center",
    paddingVertical: spacing[6],
    gap: 4,
  },
  emptyHistoryIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.paper.warm,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  emptyHistoryTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 17,
    color: colors.light.foreground,
  },
  emptyHistorySub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.light.mutedForeground,
    textAlign: "center",
    maxWidth: 240,
  },
  histRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    paddingVertical: spacing[3],
  },
  histIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  histIconEarn: {
    backgroundColor: "rgba(200, 164, 74, 0.14)",
  },
  histIconSpend: {
    backgroundColor: "rgba(184, 92, 58, 0.1)",
  },
  histBody: {
    flex: 1,
    gap: 2,
  },
  histReason: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: colors.light.foreground,
  },
  histDate: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: colors.light.mutedForeground,
  },
  histPts: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 15,
  },
  histPtsEarn: {
    color: GOLD_DEEP,
  },
  histPtsSpend: {
    color: colors.accent2.rust,
  },

  /* CTA */
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 52,
    borderRadius: radii.full,
    backgroundColor: colors.olive[900],
    paddingRight: 7,
    ...shadows.soft,
  },
  primaryBtnText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 14,
    color: colors.paper.cream,
  },
  primaryBtnArrow: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.paper.cream,
    alignItems: "center",
    justifyContent: "center",
  },
});
