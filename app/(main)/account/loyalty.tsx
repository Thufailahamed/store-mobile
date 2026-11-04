import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@/components/ui/Icon";
import { useAuth } from "@/lib/supabase/auth";
import { supabase } from "@/lib/supabase/client";
import {
  useLoyalty,
  tierProgress,
  type LoyaltyTier,
} from "@/lib/hooks/useLoyalty";
import { colors } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { UserPageFrame, UP as C } from "@/components/user/user-page";

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

const TIER_DETAILS: Record<
  LoyaltyTier,
  {
    copy: string;
    perks: {
      icon: keyof typeof Ionicons.glyphMap;
      title: string;
      desc: string;
    }[];
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
    copy: "Accelerated point multipliers and complimentary returns on all eligible pieces.",
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

const TIER_ORDER: LoyaltyTier[] = ["Bronze", "Silver", "Gold", "Platinum"];

const TIER_RANGES: Record<LoyaltyTier, { min: number; cap: number | null }> = {
  Bronze: { min: 0, cap: 500 },
  Silver: { min: 500, cap: 2000 },
  Gold: { min: 2000, cap: 5000 },
  Platinum: { min: 5000, cap: null },
};

/** Points earned per LKR 100 — mirrors the first perk of each tier. */
const EARN_RATE: Record<LoyaltyTier, number> = {
  Bronze: 1,
  Silver: 1.25,
  Gold: 1.5,
  Platinum: 2,
};

/** Metallic finish per tier — drives the membership card and tier swatches. */
const TIER_FINISH: Record<
  LoyaltyTier,
  {
    card: [string, string, string];
    ink: string;
    inkSoft: string;
    accent: string;
    swatch: [string, string];
  }
> = {
  Bronze: {
    card: ["#5a3a22", "#2e1d10", "#1a110a"],
    ink: "#f6e3cf",
    inkSoft: "rgba(246,227,207,0.62)",
    accent: "#d9a273",
    swatch: ["#c98b5a", "#7a4a28"],
  },
  Silver: {
    card: ["#5d6066", "#33363b", "#1c1e21"],
    ink: "#f1f2f4",
    inkSoft: "rgba(241,242,244,0.62)",
    accent: "#c9ced6",
    swatch: ["#d9dde3", "#8a9099"],
  },
  Gold: {
    card: ["#6b521c", "#3b2c0d", "#1f1706"],
    ink: "#fbefcf",
    inkSoft: "rgba(251,239,207,0.62)",
    accent: GOLD_SOFT,
    swatch: [GOLD_SOFT, GOLD_DEEP],
  },
  Platinum: {
    card: ["#2c3119", "#16170f", "#0b0c07"],
    ink: "#f4f1e6",
    inkSoft: "rgba(244,241,230,0.6)",
    accent: "#e6e2d3",
    swatch: ["#f1eee4", "#9a9a8a"],
  },
};

export default function LoyaltyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const loyalty = useLoyalty();
  const [transactions, setTransactions] = useState<LoyaltyTxn[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [previewTier, setPreviewTier] = useState<LoyaltyTier | null>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;

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

  const lifetime = loyalty.state.lifetime_points;
  const tier = tierProgress(lifetime);
  const currentTier = tier.name as LoyaltyTier;
  const currentIndex = TIER_ORDER.indexOf(currentTier);
  const nextTierName =
    currentIndex < TIER_ORDER.length - 1 ? TIER_ORDER[currentIndex + 1] : null;
  const pointsToNext = tier.next !== Infinity ? tier.next - lifetime : 0;
  const spendToNext = Math.ceil((pointsToNext / EARN_RATE[currentTier]) * 100);
  const finish = TIER_FINISH[currentTier];
  const shownTier = previewTier ?? currentTier;
  const shownDetails = TIER_DETAILS[shownTier];
  const shownIndex = TIER_ORDER.indexOf(shownTier);
  const shownUnlocked = shownIndex <= currentIndex;

  const memberName =
    (user?.user_metadata?.full_name as string | undefined)?.trim() ||
    user?.email?.split("@")[0] ||
    "LUXE Patron";
  const memberSince = user?.created_at
    ? new Date(user.created_at).getFullYear()
    : null;
  const memberNo = user?.id
    ? user.id.replace(/-/g, "").slice(0, 8).toUpperCase()
    : "--------";

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: Math.max(tier.pct, 2),
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [tier.pct, progressAnim]);


  return (
    <UserPageFrame
      title="Rewards"
      right={
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
            <ActivityIndicator size="small" color={C.accent} />
          ) : (
            <Ionicons name="refresh-outline" size={19} color={C.text} />
          )}
        </TouchableOpacity>
      }
    >
      <SafeAreaView style={styles.container} edges={[]}>
        {loyalty.loading && !refreshing ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={C.accent} size="small" />
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
                tintColor={C.accent}
              />
            }
          >
            {/* Membership summary */}
            <View style={styles.cardShadow}>
              <View style={styles.card}>
                <View style={styles.memberTop}>
                  <LinearGradient
                    colors={finish.swatch}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.emblem}
                  >
                    <Ionicons name="diamond" size={22} color={finish.card[2]} />
                  </LinearGradient>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.memberTier}>{TIER_DETAILS[currentTier].tag}</Text>
                    <Text style={styles.memberSub} numberOfLines={1}>
                      {memberName}
                      {memberSince ? ` · since ${memberSince}` : ""}
                    </Text>
                  </View>
                  <View style={styles.memberNo}>
                    <Text style={styles.memberNoText}>#{memberNo}</Text>
                  </View>
                </View>

                <View style={styles.statsStrip}>
                  <SummaryStat value={loyalty.state.points.toLocaleString()} label="Available pts" />
                  <View style={styles.statDivider} />
                  <SummaryStat value={lifetime.toLocaleString()} label="Lifetime pts" />
                  <View style={styles.statDivider} />
                  <SummaryStat value={`${EARN_RATE[currentTier]}×`} label="Per LKR 100" />
                </View>
              </View>
            </View>

            {/* Progress to next tier */}
            <View style={styles.cardShadow}>
              <View style={styles.card}>
                {nextTierName ? (
                  <View>
                    <Text style={styles.progressHeadline}>
                      {pointsToNext.toLocaleString()} points to {nextTierName}
                    </Text>
                    <Text style={styles.cardCopy}>
                      About LKR {spendToNext.toLocaleString()} in purchases at
                      your current earning rate.
                    </Text>
                  </View>
                ) : (
                  <View>
                    <Text style={styles.progressHeadline}>You&apos;ve reached Platinum</Text>
                    <Text style={styles.cardCopy}>
                      The highest tier of patronage — thank you.
                    </Text>
                  </View>
                )}

                <View style={styles.progressBlock}>
                  <View style={styles.progressTrack}>
                    <Animated.View
                      style={[
                        styles.progressFill,
                        {
                          width: progressAnim.interpolate({
                            inputRange: [0, 100],
                            outputRange: ["0%", "100%"],
                          }),
                        },
                      ]}
                    />
                  </View>
                  <View style={styles.progressEnds}>
                    <View style={styles.progressEnd}>
                      <TierDot tier={currentTier} size={12} />
                      <Text style={styles.progressEndText}>
                        {currentTier} · {TIER_RANGES[currentTier].min.toLocaleString()}
                      </Text>
                    </View>
                    {nextTierName ? (
                      <View style={styles.progressEnd}>
                        <Text style={styles.progressEndText}>
                          {nextTierName} · {TIER_RANGES[nextTierName].min.toLocaleString()}
                        </Text>
                        <TierDot tier={nextTierName} size={12} />
                      </View>
                    ) : null}
                  </View>
                </View>
              </View>
            </View>

            {/* Tier selector */}
            <View>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>Tiers</Text>
                <Text style={styles.sectionSub}>
                  Lifetime points set your status. Tap a tier to preview it.
                </Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tierRow}
                style={styles.tierScroller}
              >
                {TIER_ORDER.map((t, i) => {
                  const unlocked = i <= currentIndex;
                  const isCurrent = i === currentIndex;
                  const selected = t === shownTier;
                  const f = TIER_FINISH[t];
                  const range = TIER_RANGES[t];
                  return (
                    <Pressable
                      key={t}
                      onPress={() => setPreviewTier(t === currentTier ? null : t)}
                      style={({ pressed }) => [
                        styles.tierTile,
                        selected && styles.tierTileSelected,
                        pressed && { transform: [{ scale: 0.98 }] },
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`${t} tier${unlocked ? ", unlocked" : ", locked"}`}
                    >
                      <View style={styles.tierTileTop}>
                        <LinearGradient
                          colors={f.swatch}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.tierSwatch}
                        >
                          <Ionicons
                            name={unlocked ? "diamond" : "lock-closed"}
                            size={15}
                            color={f.card[2]}
                          />
                        </LinearGradient>
                        {isCurrent ? (
                          <View style={styles.youBadge}>
                            <Text style={styles.youBadgeText}>You</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.tierTileName}>{t}</Text>
                      <Text style={styles.tierTileRange}>
                        {range.min.toLocaleString()}
                        {range.cap ? `–${range.cap.toLocaleString()}` : "+"} pts
                      </Text>
                      <Text style={[styles.tierTileStatus, unlocked && styles.tierTileStatusOn]}>
                        {unlocked
                          ? "Unlocked"
                          : `${(range.min - lifetime).toLocaleString()} to go`}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* Tier perks */}
            <View style={styles.cardShadow}>
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.cardTitle, { flex: 1 }]}>
                    {shownTier} privileges
                  </Text>
                  {shownUnlocked ? (
                    <View style={styles.activePill}>
                      <Ionicons name="checkmark-circle" size={13} color={C.accent} />
                      <Text style={styles.activePillText}>Active</Text>
                    </View>
                  ) : (
                    <View style={[styles.activePill, styles.lockedPill]}>
                      <Ionicons name="lock-closed" size={11} color={C.muted} />
                      <Text style={[styles.activePillText, { color: C.muted }]}>Locked</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.cardCopy}>{shownDetails.copy}</Text>

                <View>
                  {shownDetails.perks.map((p, i) => (
                    <View
                      key={`${shownTier}-${i}`}
                      style={[
                        styles.perkRow,
                        i > 0 && styles.rowDivider,
                        !shownUnlocked && { opacity: 0.6 },
                      ]}
                    >
                      <View style={styles.perkIcon}>
                        <Ionicons name={p.icon} size={18} color={C.accent} />
                      </View>
                      <View style={styles.perkBody}>
                        <Text style={styles.perkTitle}>{p.title}</Text>
                        <Text style={styles.perkDesc}>{p.desc}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            {/* History */}
            <View style={styles.cardShadow}>
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.cardTitle, { flex: 1 }]}>Points history</Text>
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>{transactions.length}</Text>
                  </View>
                </View>

                {transactions.length === 0 ? (
                  <View style={styles.emptyHistory}>
                    <View style={styles.emptyHistoryIcon}>
                      <Ionicons name="receipt-outline" size={26} color={C.accent} />
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
                      const d = new Date(t.created_at);
                      return (
                        <View
                          key={t.id ?? i}
                          style={[styles.histRow, i > 0 && styles.rowDivider]}
                        >
                          <View style={styles.histDate}>
                            <Text style={styles.histDay}>{d.getDate()}</Text>
                            <Text style={styles.histMonth}>
                              {d.toLocaleDateString(undefined, { month: "short" })}
                            </Text>
                          </View>
                          <View style={styles.histBody}>
                            <Text style={styles.histReason} numberOfLines={1}>
                              {t.reason || (isEarn ? "Points credited" : "Points redeemed")}
                            </Text>
                            <Text style={styles.histMeta}>
                              {isEarn ? "Earned" : "Redeemed"} · {d.getFullYear()}
                            </Text>
                          </View>
                          <Text style={[styles.histPts, isEarn ? styles.histPtsEarn : styles.histPtsSpend]}>
                            {isEarn ? "+" : "−"}
                            {Math.abs(t.points).toLocaleString()}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            </View>

            {/* CTA */}
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => router.push("/(main)/products" as any)}
              activeOpacity={0.9}
              accessibilityRole="button"
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.primaryBtnText}>Shop to earn points</Text>
                <Text style={styles.primaryBtnSub}>
                  {EARN_RATE[currentTier]} pt per LKR 100 at {currentTier}
                </Text>
              </View>
              <View style={styles.primaryBtnArrow}>
                <Ionicons name="arrow-forward" size={17} color={C.ink} />
              </View>
            </TouchableOpacity>
          </ScrollView>
        )}
      </SafeAreaView>
    </UserPageFrame>
  );
}

function SummaryStat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${value} ${label}`}>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function TierDot({ tier, size }: { tier: LoyaltyTier; size: number }) {
  const f = TIER_FINISH[tier];
  return (
    <LinearGradient
      colors={f.swatch}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size, borderRadius: size / 2 }}
    />
  );
}

const SHADOW = {
  shadowColor: "#16170f",
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.06,
  shadowRadius: 20,
  elevation: 3,
} as const;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "transparent" },
  navBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: C.card,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
  },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontFamily: fontFamilies.sans.medium, fontSize: 14, color: C.muted },
  scrollContent: { paddingHorizontal: 20, paddingTop: 2, gap: 16 },

  cardShadow: { borderRadius: 26, backgroundColor: C.card, ...SHADOW },
  card: {
    backgroundColor: C.card,
    borderRadius: 26,
    borderCurve: "continuous",
    padding: 18,
    borderWidth: 1,
    borderColor: C.line,
    gap: 14,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  cardTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 17, letterSpacing: -0.3, color: C.text },
  cardCopy: { fontFamily: fontFamilies.sans.regular, fontSize: 13.5, lineHeight: 19, color: C.muted, marginTop: 3 },
  rowDivider: { borderTopWidth: 1, borderTopColor: C.line },

  /* Membership */
  memberTop: { flexDirection: "row", alignItems: "center", gap: 14 },
  emblem: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  memberTier: { fontFamily: fontFamilies.sans.bold, fontSize: 19, letterSpacing: -0.4, color: C.text },
  memberSub: { fontFamily: fontFamilies.sans.regular, fontSize: 13, color: C.muted, marginTop: 1 },
  memberNo: {
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 14,
    justifyContent: "center",
    backgroundColor: "#f3f1e8",
  },
  memberNoText: { fontFamily: fontFamilies.mono.semibold, fontSize: 11, letterSpacing: 0.6, color: C.muted },
  statsStrip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 20,
    borderCurve: "continuous",
    backgroundColor: C.ink,
  },
  stat: { flex: 1, alignItems: "center", gap: 2, paddingHorizontal: 4 },
  statValue: { fontFamily: fontFamilies.sans.bold, fontSize: 20, color: C.cream, fontVariant: ["tabular-nums"] },
  statLabel: { fontFamily: fontFamilies.sans.medium, fontSize: 12, color: "rgba(250,248,241,0.6)" },
  statDivider: { width: 1, height: 28, backgroundColor: "rgba(250,248,241,0.12)" },

  /* Progress */
  progressHeadline: { fontFamily: fontFamilies.sans.bold, fontSize: 20, letterSpacing: -0.5, color: C.text },
  progressBlock: { gap: 10 },
  progressTrack: { height: 10, borderRadius: 5, backgroundColor: "#f1efe6", overflow: "hidden" },
  progressFill: { height: 10, borderRadius: 5, backgroundColor: C.ink },
  progressEnds: { flexDirection: "row", justifyContent: "space-between" },
  progressEnd: { flexDirection: "row", alignItems: "center", gap: 6 },
  progressEndText: { fontFamily: fontFamilies.sans.semibold, fontSize: 12.5, color: C.muted },

  /* Tiers */
  sectionHead: { paddingHorizontal: 2, marginTop: 6 },
  sectionTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 19, letterSpacing: -0.4, color: C.text },
  sectionSub: { fontFamily: fontFamilies.sans.regular, fontSize: 13, color: C.muted, marginTop: 2 },
  tierScroller: { marginHorizontal: -20, marginTop: 12 },
  tierRow: { paddingHorizontal: 20, paddingBottom: 14, gap: 10 },
  tierTile: {
    width: 136,
    padding: 14,
    borderRadius: 22,
    borderCurve: "continuous",
    backgroundColor: C.card,
    borderWidth: 1.5,
    borderColor: C.line,
    gap: 2,
    ...SHADOW,
  },
  tierTileSelected: { borderColor: C.ink },
  tierTileTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  tierSwatch: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  youBadge: {
    height: 22,
    paddingHorizontal: 8,
    borderRadius: 11,
    justifyContent: "center",
    backgroundColor: C.ink,
  },
  youBadgeText: { fontFamily: fontFamilies.sans.bold, fontSize: 11, color: C.lime },
  tierTileName: { fontFamily: fontFamilies.sans.bold, fontSize: 16, letterSpacing: -0.3, color: C.text },
  tierTileRange: { fontFamily: fontFamilies.sans.regular, fontSize: 12.5, color: C.muted },
  tierTileStatus: { fontFamily: fontFamilies.sans.semibold, fontSize: 12.5, color: C.muted, marginTop: 6 },
  tierTileStatusOn: { color: C.accent },

  /* Perks */
  activePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: C.accentSoft,
  },
  lockedPill: { backgroundColor: "#f3f1e8" },
  activePillText: { fontFamily: fontFamilies.sans.semibold, fontSize: 12.5, color: C.accent },
  perkRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  perkIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.accentSoft,
  },
  perkBody: { flex: 1, gap: 2 },
  perkTitle: { fontFamily: fontFamilies.sans.semibold, fontSize: 14.5, color: C.text },
  perkDesc: { fontFamily: fontFamilies.sans.regular, fontSize: 12.5, lineHeight: 17, color: C.muted },

  /* History */
  countBadge: {
    minWidth: 26,
    height: 26,
    paddingHorizontal: 8,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.accentSoft,
  },
  countBadgeText: { fontFamily: fontFamilies.sans.semibold, fontSize: 12.5, color: C.muted },
  emptyHistory: { alignItems: "center", paddingVertical: 16, gap: 6 },
  emptyHistoryIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.accentSoft,
    marginBottom: 6,
  },
  emptyHistoryTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 16, color: C.text },
  emptyHistorySub: { fontFamily: fontFamilies.sans.regular, fontSize: 13, lineHeight: 18, color: C.muted, textAlign: "center" },
  histRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  histDate: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f3f1e8",
  },
  histDay: { fontFamily: fontFamilies.sans.bold, fontSize: 16, color: C.text, lineHeight: 18 },
  histMonth: { fontFamily: fontFamilies.sans.medium, fontSize: 11, color: C.muted },
  histBody: { flex: 1, gap: 1 },
  histReason: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: C.text },
  histMeta: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: C.muted },
  histPts: { fontFamily: fontFamilies.sans.bold, fontSize: 15, fontVariant: ["tabular-nums"] },
  histPtsEarn: { color: C.accent },
  histPtsSpend: { color: C.rust },

  /* CTA */
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 64,
    paddingLeft: 22,
    paddingRight: 8,
    paddingVertical: 8,
    borderRadius: 32,
    backgroundColor: C.ink,
  },
  primaryBtnText: { fontFamily: fontFamilies.sans.semibold, fontSize: 15.5, color: C.cream },
  primaryBtnSub: { fontFamily: fontFamilies.sans.regular, fontSize: 12.5, color: "rgba(250,248,241,0.6)", marginTop: 1 },
  primaryBtnArrow: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.lime,
  },
});
