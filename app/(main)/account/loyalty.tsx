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
import { SafeAreaView } from "react-native-safe-area-context";
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

const TIER_DETAILS: Record<
  LoyaltyTier,
  {
    copy: string;
    perks: { icon: keyof typeof Ionicons.glyphMap; title: string; desc: string }[];
    tag: string;
  }
> = {
  Bronze: {
    copy: "Welcome to the Atelier Patron Program. Earn points with every purchase to unlock complimentary delivery and private sales.",
    tag: "BRONZE PATRON",
    perks: [
      {
        icon: "sparkles",
        title: "1 Point per LKR 100",
        desc: "Accrue redeemable points automatically on all confirmed orders.",
      },
      {
        icon: "gift-outline",
        title: "Annual Birthday Surprise",
        desc: "A bespoke celebratory reward credited to your account during your birth month.",
      },
      {
        icon: "notifications-outline",
        title: "Seasonal Lookbook Previews",
        desc: "Early digital access to upcoming designer runway releases.",
      },
    ],
  },
  Silver: {
    copy: "Silver tier unlocked. Enjoy accelerated point multipliers and complimentary returns on all eligible pieces.",
    tag: "SILVER PATRON",
    perks: [
      {
        icon: "sparkles",
        title: "1.25 Points per LKR 100",
        desc: "Accelerated earning rate across all designer collections.",
      },
      {
        icon: "refresh-outline",
        title: "Complimentary Return Shipping",
        desc: "Zero collection fees on returns within the 14-day window.",
      },
      {
        icon: "gift-outline",
        title: "Annual Birthday Surprise",
        desc: "Curated gift voucher credited during your birth month.",
      },
    ],
  },
  Gold: {
    copy: "Gold patron status. Complimentary express delivery on every order, no minimum spend required.",
    tag: "GOLD CONNOISSEUR",
    perks: [
      {
        icon: "sparkles",
        title: "1.5 Points per LKR 100",
        desc: "High-yield earning rate on all luxury pieces and accessories.",
      },
      {
        icon: "airplane-outline",
        title: "Free Express Shipping Always",
        desc: "Complimentary priority courier delivery with zero minimum order requirement.",
      },
      {
        icon: "refresh-outline",
        title: "Complimentary Returns",
        desc: "White-glove doorstep return collection on all purchases.",
      },
      {
        icon: "headset-outline",
        title: "Priority Concierge Support",
        desc: "Dedicated support channel with sub-1-hour inquiry resolution.",
      },
    ],
  },
  Platinum: {
    copy: "The highest pinnacle of Atelier privilege. 1:1 private concierge, runway pre-allocations, and annual couture gifts.",
    tag: "PLATINUM ATELIER ELITE",
    perks: [
      {
        icon: "sparkles",
        title: "2 Points per LKR 100",
        desc: "Double points earning on every acquisition across the atelier.",
      },
      {
        icon: "flash-outline",
        title: "Guaranteed Drop Pre-Access",
        desc: "Private 24-hour window to acquire limited-run and runway pieces before public release.",
      },
      {
        icon: "person-outline",
        title: "1:1 Personal Atelier Concierge",
        desc: "Direct WhatsApp / in-app line with your dedicated fashion consultant.",
      },
      {
        icon: "trophy-outline",
        title: "Bespoke Annual Couture Gift",
        desc: "Handcrafted anniversary collector piece delivered to your residence.",
      },
    ],
  },
};

export default function LoyaltyScreen() {
  const router = useRouter();
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
        {/* Atelier Top Navigation */}
        <View style={styles.navBar}>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={20} color={colors.light.foreground} />
          </TouchableOpacity>

          <View style={styles.navTitleWrap}>
            <Text style={styles.navTitle}>PRIVILEGE & REWARDS</Text>
            <Text style={styles.navSubtitle}>ATELIER PATRON PROGRAM</Text>
          </View>

          <TouchableOpacity
            style={styles.navBtn}
            onPress={onRefresh}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name="refresh-outline"
              size={18}
              color={refreshing ? "#C8A44A" : colors.light.foreground}
            />
          </TouchableOpacity>
        </View>

        {loyalty.loading && !refreshing ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color="#C8A44A" size="small" />
            <Text style={styles.loadingText}>Retrieving patron ledger…</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#C8A44A"
              />
            }
          >
            {/* 1. Haute Couture Obsidian & Champagne Gold Patron Card */}
            <LinearGradient
              colors={["#1c2016", "#14170e", "#0e110a"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroCard}
            >
              <View style={styles.heroTopRow}>
                <View style={styles.heroTagBadge}>
                  <Ionicons name="sparkles" size={11} color="#C8A44A" />
                  <Text style={styles.heroTagText}>{details.tag}</Text>
                </View>

                {/* Seal Medallion */}
                <View style={styles.trophyMedallion}>
                  <View style={styles.trophyInner}>
                    <Ionicons name="trophy" size={20} color="#E8CF8F" />
                  </View>
                </View>
              </View>

              {/* Points Number Display */}
              <View style={styles.pointsDisplayBlock}>
                <Text style={styles.pointsNumber}>
                  {loyalty.state.points.toLocaleString()}
                </Text>
                <Text style={styles.pointsLabel}>POINTS AVAILABLE TO REDEEM</Text>
              </View>

              {/* Tier Progress Gauge */}
              <View style={styles.progressSection}>
                <View style={styles.progressTrack}>
                  <LinearGradient
                    colors={["#E8CF8F", "#C8A44A", "#937324"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.progressFill, { width: `${tier.pct}%` }]}
                  />
                </View>

                <View style={styles.progressMetaRow}>
                  <Text style={styles.progressMetaLeft}>
                    {loyalty.state.lifetime_points.toLocaleString()} lifetime pts
                  </Text>
                  <Text style={styles.progressMetaRight}>
                    {nextTierName
                      ? `${pointsToNext.toLocaleString()} pts to ${nextTierName}`
                      : "Top Atelier Tier Unlocked"}
                  </Text>
                </View>
              </View>
            </LinearGradient>

            {/* 2. Redesigned 3-Metric Stat Ribbon */}
            <View style={styles.statsRow}>
              {/* Spendable */}
              <View style={styles.statCard}>
                <View style={styles.statIconWrap}>
                  <Ionicons name="wallet-outline" size={15} color="#85651b" />
                </View>
                <Text style={styles.statNumber}>
                  {loyalty.state.points.toLocaleString()}
                </Text>
                <Text style={styles.statLabel}>AVAILABLE</Text>
                <Text style={styles.statSub}>Ready at checkout</Text>
              </View>

              {/* Lifetime */}
              <View style={styles.statCard}>
                <View style={styles.statIconWrap}>
                  <Ionicons name="infinite-outline" size={15} color="#85651b" />
                </View>
                <Text style={styles.statNumber}>
                  {loyalty.state.lifetime_points.toLocaleString()}
                </Text>
                <Text style={styles.statLabel}>LIFETIME</Text>
                <Text style={styles.statSub}>Total points earned</Text>
              </View>

              {/* Rank */}
              <View style={styles.statCard}>
                <View style={styles.statIconWrap}>
                  <Ionicons name="ribbon-outline" size={15} color="#85651b" />
                </View>
                <Text style={styles.statNumber}>{tier.name}</Text>
                <Text style={styles.statLabel}>TIER RANK</Text>
                <Text style={styles.statSub}>Current standing</Text>
              </View>
            </View>

            {/* 3. Active Tier Privileges Card */}
            <View style={styles.contentCard}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.cardEyebrow}>CURRENT BENEFITS</Text>
                  <Text style={styles.cardTitle}>{tier.name} Privileges</Text>
                </View>
                <View style={styles.activeTierPill}>
                  <Ionicons name="checkmark-circle" size={11} color="#85651b" />
                  <Text style={styles.activeTierPillText}>ACTIVE</Text>
                </View>
              </View>

              <Text style={styles.tierCopyText}>{details.copy}</Text>

              <View style={styles.perksList}>
                {details.perks.map((p, i) => (
                  <View key={i} style={styles.perkRow}>
                    <View style={styles.perkIconWrap}>
                      <Ionicons name={p.icon} size={15} color="#85651b" />
                    </View>
                    <View style={styles.perkContent}>
                      <Text style={styles.perkTitle}>{p.title}</Text>
                      <Text style={styles.perkDesc}>{p.desc}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* 4. Patron Progression Ladder */}
            <View style={styles.contentCard}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.cardEyebrow}>ROADMAP</Text>
                  <Text style={styles.cardTitle}>Patron Progression</Text>
                </View>
              </View>
              <Text style={styles.tierCopyText}>
                Lifetime points determine your status. Tiers never downgrade once unlocked.
              </Text>

              <TierLadder
                currentTier={tier.name as LoyaltyTier}
                currentLifetime={loyalty.state.lifetime_points}
              />
            </View>

            {/* 5. Points History Ledger */}
            <View style={styles.contentCard}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.cardEyebrow}>ACTIVITY LEDGER</Text>
                  <Text style={styles.cardTitle}>Points History</Text>
                </View>
                <Text style={styles.historyCountBadge}>
                  {transactions.length} entries
                </Text>
              </View>

              {transactions.length === 0 ? (
                <View style={styles.emptyHistoryBox}>
                  <View style={styles.emptyHistoryMedallion}>
                    <Ionicons
                      name="receipt-outline"
                      size={26}
                      color="#85651b"
                    />
                  </View>
                  <Text style={styles.emptyHistoryTitle}>No Activity Logged</Text>
                  <Text style={styles.emptyHistorySub}>
                    Confirmed orders and atelier reviews automatically credit points to your patron account.
                  </Text>
                </View>
              ) : (
                <View style={styles.historyList}>
                  {transactions.map((t, i) => {
                    const isEarn = t.points > 0;
                    return (
                      <View key={t.id ?? i} style={styles.historyRow}>
                        <View
                          style={[
                            styles.historyIconCircle,
                            isEarn
                              ? styles.historyIconEarn
                              : styles.historyIconSpend,
                          ]}
                        >
                          <Ionicons
                            name={isEarn ? "add" : "remove"}
                            size={12}
                            color={isEarn ? "#15803d" : "#dc2626"}
                          />
                        </View>
                        <View style={styles.historyMetaCol}>
                          <Text style={styles.historyReason} numberOfLines={1}>
                            {t.reason || (isEarn ? "Points Credited" : "Points Redeemed")}
                          </Text>
                          <Text style={styles.historyDate}>
                            {new Date(t.created_at).toLocaleDateString()}
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.historyPointsText,
                            isEarn
                              ? styles.historyPointsEarn
                              : styles.historyPointsSpend,
                          ]}
                        >
                          {isEarn ? "+" : ""}
                          {t.points.toLocaleString()} pts
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            {/* 6. Shop Atelier Primary CTA */}
            <TouchableOpacity
              style={styles.shopCtaBtn}
              onPress={() => router.push("/(main)/products" as any)}
              activeOpacity={0.88}
            >
              <Ionicons name="bag-handle-outline" size={15} color="#ffffff" />
              <Text style={styles.shopCtaBtnText}>EXPLORE ATELIER TO EARN</Text>
              <Ionicons name="arrow-forward" size={14} color="#ffffff" />
            </TouchableOpacity>
          </ScrollView>
        )}
      </SafeAreaView>
    </PaperBackground>
  );
}

/* =========================================================================
   Tier Ladder Component
   ========================================================================= */
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
    <View style={styles.ladderWrap}>
      {tiers.map((t, i) => {
        const isUnlocked = i <= currentIndex;
        const isCurrent = i === currentIndex;

        return (
          <View key={t.name} style={styles.ladderItemRow}>
            {/* Step Node */}
            <View
              style={[
                styles.ladderNode,
                isUnlocked && styles.ladderNodeUnlocked,
                isCurrent && styles.ladderNodeCurrent,
              ]}
            >
              <Ionicons
                name={isUnlocked ? "checkmark" : "lock-closed"}
                size={11}
                color={isUnlocked ? "#ffffff" : "#6b6b6b"}
              />
            </View>

            {/* Info */}
            <View style={styles.ladderInfoCol}>
              <View style={styles.ladderNameRow}>
                <Text
                  style={[
                    styles.ladderTierName,
                    isUnlocked && styles.ladderTierNameUnlocked,
                  ]}
                >
                  {t.name}
                </Text>
                {isCurrent && (
                  <View style={styles.youBadge}>
                    <Text style={styles.youBadgeText}>YOU</Text>
                  </View>
                )}
              </View>
              <Text style={styles.ladderRangeText}>
                {t.min.toLocaleString()} lifetime pts
                {t.cap ? ` — ${t.cap.toLocaleString()}` : "+"}
              </Text>
            </View>

            {/* Status label */}
            <View style={styles.ladderStatusCol}>
              {isUnlocked ? (
                <View style={styles.unlockedTag}>
                  <Ionicons name="checkmark-circle" size={10} color="#15803d" />
                  <Text style={styles.unlockedTagText}>UNLOCKED</Text>
                </View>
              ) : (
                <Text style={styles.pointsToGoText}>
                  {(t.min - currentLifetime).toLocaleString()} TO GO
                </Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

/* =========================================================================
   Styles
   ========================================================================= */
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
    fontFamily: fontFamilies.display.regular,
    fontSize: 14,
    color: colors.light.mutedForeground,
    fontStyle: "italic",
  },

  /* Navigation Bar */
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: "rgba(22, 23, 15, 0.06)",
  },
  navBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.08)",
    ...shadows.soft,
  },
  navTitleWrap: {
    alignItems: "center",
  },
  navTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 15,
    letterSpacing: 2,
    color: colors.light.foreground,
    textTransform: "uppercase",
  },
  navSubtitle: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9.5,
    color: "#85651b",
    marginTop: 1,
    letterSpacing: 1,
  },

  scrollContent: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: 40,
  },

  /* 1. Hero Card */
  heroCard: {
    borderRadius: 20,
    padding: spacing[5],
    marginBottom: spacing[4],
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.35)",
    ...shadows.editorial,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroTagBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(200, 164, 74, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.3)",
  },
  heroTagText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    color: "#E8CF8F",
    letterSpacing: 1,
  },
  trophyMedallion: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(200, 164, 74, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  trophyInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0, 0, 0, 0.25)",
    alignItems: "center",
    justifyContent: "center",
  },

  /* Points Display */
  pointsDisplayBlock: {
    marginVertical: 14,
  },
  pointsNumber: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 40,
    color: "#E8CF8F",
    lineHeight: 46,
    letterSpacing: -0.5,
  },
  pointsLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    color: "rgba(255, 255, 255, 0.7)",
    letterSpacing: 0.8,
    marginTop: 2,
  },

  /* Progress Section */
  progressSection: {
    gap: 6,
    marginTop: 4,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  progressMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  progressMetaLeft: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 10,
    color: "rgba(255, 255, 255, 0.6)",
  },
  progressMetaRight: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    color: "#E8CF8F",
  },

  /* 2. Stat Ribbon */
  statsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: spacing[4],
  },
  statCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.08)",
    gap: 3,
    ...shadows.soft,
  },
  statIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(200, 164, 74, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  statNumber: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 16.5,
    color: colors.light.foreground,
    lineHeight: 20,
  },
  statLabel: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 8.5,
    color: "#85651b",
    letterSpacing: 0.8,
  },
  statSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 9.5,
    color: colors.light.mutedForeground,
  },

  /* Content Cards */
  contentCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: spacing[5],
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.08)",
    marginBottom: spacing[4],
    ...shadows.soft,
    gap: 12,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  cardEyebrow: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9.5,
    color: "#85651b",
    letterSpacing: 1.2,
  },
  cardTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 18,
    color: colors.light.foreground,
    marginTop: 2,
  },
  activeTierPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(200, 164, 74, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.3)",
  },
  activeTierPillText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 8.5,
    color: "#85651b",
    letterSpacing: 0.5,
  },
  tierCopyText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12.5,
    color: colors.light.mutedForeground,
    lineHeight: 18,
  },

  /* Perks List */
  perksList: {
    gap: 12,
    marginTop: 4,
  },
  perkRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  perkIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(200, 164, 74, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.25)",
  },
  perkContent: {
    flex: 1,
    gap: 2,
  },
  perkTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: colors.light.foreground,
  },
  perkDesc: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11.5,
    color: colors.light.mutedForeground,
    lineHeight: 16,
  },

  /* Ladder */
  ladderWrap: {
    gap: 2,
  },
  ladderItemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(22, 23, 15, 0.05)",
    gap: 12,
  },
  ladderNode: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(22, 23, 15, 0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  ladderNodeUnlocked: {
    backgroundColor: "#181b12",
  },
  ladderNodeCurrent: {
    backgroundColor: "#85651b",
  },
  ladderInfoCol: {
    flex: 1,
    gap: 2,
  },
  ladderNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  ladderTierName: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 14.5,
    color: colors.light.mutedForeground,
  },
  ladderTierNameUnlocked: {
    color: colors.light.foreground,
  },
  youBadge: {
    backgroundColor: "rgba(200, 164, 74, 0.15)",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.3)",
  },
  youBadgeText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 8,
    color: "#85651b",
    letterSpacing: 0.5,
  },
  ladderRangeText: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 10,
    color: colors.light.mutedForeground,
  },
  ladderStatusCol: {
    alignItems: "flex-end",
  },
  unlockedTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  unlockedTagText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    color: "#15803d",
    letterSpacing: 0.5,
  },
  pointsToGoText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9.5,
    color: colors.light.mutedForeground,
    letterSpacing: 0.5,
  },

  /* History */
  historyCountBadge: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    color: colors.light.mutedForeground,
  },
  emptyHistoryBox: {
    alignItems: "center",
    paddingVertical: spacing[5],
    gap: 6,
  },
  emptyHistoryMedallion: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(200, 164, 74, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyHistoryTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 15,
    color: colors.light.foreground,
  },
  emptyHistorySub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.light.mutedForeground,
    textAlign: "center",
    lineHeight: 17,
    maxWidth: 260,
  },
  historyList: {
    gap: 4,
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(22, 23, 15, 0.05)",
  },
  historyIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  historyIconEarn: {
    backgroundColor: "rgba(22, 101, 52, 0.12)",
  },
  historyIconSpend: {
    backgroundColor: "rgba(220, 38, 38, 0.1)",
  },
  historyMetaCol: {
    flex: 1,
    gap: 1,
  },
  historyReason: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12.5,
    color: colors.light.foreground,
  },
  historyDate: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 10,
    color: colors.light.mutedForeground,
  },
  historyPointsText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 12,
  },
  historyPointsEarn: {
    color: "#15803d",
  },
  historyPointsSpend: {
    color: "#dc2626",
  },

  /* Shop CTA */
  shopCtaBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#181b12",
    borderRadius: radii.full,
    paddingVertical: 13,
    ...shadows.soft,
    marginBottom: 20,
  },
  shopCtaBtnText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 11,
    color: "#ffffff",
    letterSpacing: 1.2,
  },
});
