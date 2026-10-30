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
  useWindowDimensions,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
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
import { UserPageFrame, withUserTheme } from "@/components/user/user-page";

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
  const { width } = useWindowDimensions();
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

  const cardWidth = width - spacing[5] * 2;
  const cardHeight = Math.round(cardWidth / 1.58);

  return (
    <UserPageFrame
      title="Rewards"
      right={
        <>
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
              <Ionicons
                name="refresh-outline"
                size={18}
                color={colors.light.foreground}
              />
            )}
          </TouchableOpacity>
        </>
      }
    >
      <SafeAreaView style={styles.container} edges={[]}>
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
              <View style={styles.eyebrowRow}>
                <View style={styles.eyebrowRule} />
                <Text style={styles.eyebrow}>Patron program</Text>
              </View>
              <Text style={styles.pageTitle}>
                Privilege &amp;{" "}
                <Text style={styles.pageTitleAccent}>rewards.</Text>
              </Text>
            </View>

            {/* Membership card */}
            <View style={styles.cardShadow}>
              <LinearGradient
                colors={finish.card}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.memberCard, { height: cardHeight }]}
              >
                {/* Guilloché-style rings + sheen */}
                <View
                  style={[
                    styles.ring,
                    {
                      borderColor: `${finish.accent}22`,
                      width: cardWidth,
                      height: cardWidth,
                      borderRadius: cardWidth / 2,
                      right: -cardWidth * 0.45,
                      top: -cardWidth * 0.35,
                    },
                  ]}
                />
                <View
                  style={[
                    styles.ring,
                    {
                      borderColor: `${finish.accent}18`,
                      width: cardWidth * 0.75,
                      height: cardWidth * 0.75,
                      borderRadius: cardWidth,
                      right: -cardWidth * 0.3,
                      top: -cardWidth * 0.22,
                    },
                  ]}
                />
                <View
                  style={[
                    styles.ring,
                    {
                      borderColor: `${finish.accent}12`,
                      width: cardWidth * 0.5,
                      height: cardWidth * 0.5,
                      borderRadius: cardWidth,
                      right: -cardWidth * 0.15,
                      top: -cardWidth * 0.1,
                    },
                  ]}
                />
                <LinearGradient
                  colors={["rgba(255,255,255,0.14)", "rgba(255,255,255,0)"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0.6, y: 0.6 }}
                  style={StyleSheet.absoluteFill}
                  pointerEvents="none"
                />

                <View style={styles.memberTop}>
                  <View>
                    <Text style={[styles.wordmark, { color: finish.ink }]}>
                      LUXE
                    </Text>
                    <Text style={[styles.memberTag, { color: finish.accent }]}>
                      {shownTierLabel(currentTier)}
                    </Text>
                  </View>
                  <LinearGradient
                    colors={[finish.swatch[0], finish.swatch[1]]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.emblem}
                  >
                    <Ionicons
                      name="diamond-outline"
                      size={16}
                      color={finish.card[2]}
                    />
                  </LinearGradient>
                </View>

                <View style={{ flex: 1 }} />

                <Text
                  style={[styles.memberPointsLabel, { color: finish.inkSoft }]}
                >
                  AVAILABLE POINTS
                </Text>
                <View style={styles.memberPointsRow}>
                  <Text style={[styles.memberPoints, { color: finish.ink }]}>
                    {loyalty.state.points.toLocaleString()}
                  </Text>
                  <Text style={[styles.memberPts, { color: finish.accent }]}>
                    pts
                  </Text>
                </View>

                <View
                  style={[
                    styles.memberFoot,
                    { borderTopColor: `${finish.accent}30` },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.memberFootLabel,
                        { color: finish.inkSoft },
                      ]}
                    >
                      MEMBER
                    </Text>
                    <Text
                      style={[styles.memberFootValue, { color: finish.ink }]}
                      numberOfLines={1}
                    >
                      {memberName}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text
                      style={[
                        styles.memberFootLabel,
                        { color: finish.inkSoft },
                      ]}
                    >
                      {memberSince ? `SINCE ${memberSince}` : "NO."}
                    </Text>
                    <Text
                      style={[styles.memberFootMono, { color: finish.ink }]}
                    >
                      {memberNo}
                    </Text>
                  </View>
                </View>
              </LinearGradient>
            </View>

            {/* Progress to next tier */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.eyebrow}>Your journey</Text>
                <Text style={styles.cardCount}>
                  {lifetime.toLocaleString()} lifetime pts
                </Text>
              </View>

              {nextTierName ? (
                <>
                  <Text style={styles.progressHeadline}>
                    <Text style={styles.progressHeadlineNum}>
                      {pointsToNext.toLocaleString()}
                    </Text>{" "}
                    points to{" "}
                    <Text style={styles.progressHeadlineTier}>
                      {nextTierName}
                    </Text>
                  </Text>
                  <Text style={styles.cardCopy}>
                    About LKR {spendToNext.toLocaleString()} in purchases at
                    your current earning rate.
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.progressHeadline}>
                    You've reached{" "}
                    <Text style={styles.progressHeadlineTier}>Platinum</Text>
                  </Text>
                  <Text style={styles.cardCopy}>
                    The highest tier of patronage — thank you.
                  </Text>
                </>
              )}

              <View style={styles.progressBlock}>
                <View style={styles.progressTrack}>
                  <Animated.View
                    style={[
                      styles.progressFillWrap,
                      {
                        width: progressAnim.interpolate({
                          inputRange: [0, 100],
                          outputRange: ["0%", "100%"],
                        }),
                      },
                    ]}
                  >
                    <LinearGradient
                      colors={[GOLD_SOFT, GOLD, GOLD_DEEP]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={StyleSheet.absoluteFill}
                    />
                  </Animated.View>
                </View>
                <View style={styles.progressEnds}>
                  <View style={styles.progressEnd}>
                    <TierDot tier={currentTier} size={10} />
                    <Text style={styles.progressEndText}>
                      {currentTier} ·{" "}
                      {TIER_RANGES[currentTier].min.toLocaleString()}
                    </Text>
                  </View>
                  {nextTierName ? (
                    <View style={styles.progressEnd}>
                      <Text style={styles.progressEndText}>
                        {nextTierName} ·{" "}
                        {TIER_RANGES[nextTierName].min.toLocaleString()}
                      </Text>
                      <TierDot tier={nextTierName} size={10} />
                    </View>
                  ) : null}
                </View>
              </View>
            </View>

            {/* Tier selector */}
            <View>
              <View style={styles.sectionHead}>
                <Text style={styles.eyebrow}>Tiers</Text>
                <Text style={styles.sectionTitle}>Patron progression</Text>
                <Text style={styles.sectionSub}>
                  Lifetime points set your status. Tap a tier to preview its
                  privileges.
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
                      onPress={() =>
                        setPreviewTier(t === currentTier ? null : t)
                      }
                      style={({ pressed }) => [
                        styles.tierTile,
                        selected && styles.tierTileSelected,
                        pressed && { transform: [{ scale: 0.98 }] },
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`${t} tier${unlocked ? ", unlocked" : ", locked"}`}
                    >
                      <LinearGradient
                        colors={f.card}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.tierSwatch}
                      >
                        <View
                          style={[
                            styles.tierSwatchRing,
                            { borderColor: `${f.accent}30` },
                          ]}
                        />
                        <Ionicons
                          name={unlocked ? "diamond" : "lock-closed"}
                          size={15}
                          color={f.accent}
                        />
                      </LinearGradient>
                      <View style={styles.tierTileNameRow}>
                        <Text style={styles.tierTileName}>{t}</Text>
                        {isCurrent ? (
                          <View style={styles.youBadge}>
                            <Text style={styles.youBadgeText}>You</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.tierTileRange}>
                        {range.min.toLocaleString()}
                        {range.cap ? `–${range.cap.toLocaleString()}` : "+"} pts
                      </Text>
                      <Text
                        style={[
                          styles.tierTileStatus,
                          unlocked && { color: colors.olive[700] },
                        ]}
                      >
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
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.eyebrow}>
                  {shownUnlocked ? "Your benefits" : "Preview"}
                </Text>
                {shownUnlocked ? (
                  <View style={styles.activePill}>
                    <View style={styles.activeDot} />
                    <Text style={styles.activePillText}>Active</Text>
                  </View>
                ) : (
                  <View style={[styles.activePill, styles.lockedPill]}>
                    <Ionicons
                      name="lock-closed"
                      size={10}
                      color={colors.ink.mute}
                    />
                    <Text
                      style={[
                        styles.activePillText,
                        { color: colors.ink.mute },
                      ]}
                    >
                      Locked
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.cardTitle}>
                {shownTier}{" "}
                <Text style={styles.cardTitleItalic}>privileges</Text>
              </Text>
              <Text style={styles.cardCopy}>{shownDetails.copy}</Text>

              <View style={styles.perkGrid}>
                {shownDetails.perks.map((p, i) => (
                  <View
                    key={`${shownTier}-${i}`}
                    style={[
                      styles.perkTile,
                      !shownUnlocked && { opacity: 0.72 },
                    ]}
                  >
                    <LinearGradient
                      colors={
                        shownUnlocked
                          ? [GOLD_SOFT, GOLD]
                          : ["#e6e4da", "#cfccbf"]
                      }
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.perkIcon}
                    >
                      <Ionicons
                        name={p.icon}
                        size={16}
                        color={
                          shownUnlocked ? colors.olive[950] : colors.ink.mute
                        }
                      />
                    </LinearGradient>
                    <View style={styles.perkBody}>
                      <Text style={styles.perkTitle}>{p.title}</Text>
                      <Text style={styles.perkDesc}>{p.desc}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* History */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.eyebrow}>Ledger</Text>
                <Text style={styles.cardCount}>
                  {transactions.length}{" "}
                  {transactions.length === 1 ? "entry" : "entries"}
                </Text>
              </View>
              <Text style={styles.cardTitle}>
                Points <Text style={styles.cardTitleItalic}>history</Text>
              </Text>

              {transactions.length === 0 ? (
                <View style={styles.emptyHistory}>
                  <View style={styles.emptyHalo}>
                    <LinearGradient
                      colors={[colors.olive[800], colors.olive[950]]}
                      style={styles.emptyHistoryIcon}
                    >
                      <Ionicons name="receipt-outline" size={20} color={GOLD} />
                    </LinearGradient>
                  </View>
                  <Text style={styles.emptyHistoryTitle}>No activity yet</Text>
                  <Text style={styles.emptyHistorySub}>
                    Confirmed orders and reviews credit points automatically.
                  </Text>
                </View>
              ) : (
                <View style={styles.ledger}>
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
                            {d
                              .toLocaleDateString(undefined, { month: "short" })
                              .toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.histBody}>
                          <Text style={styles.histReason} numberOfLines={1}>
                            {t.reason ||
                              (isEarn ? "Points credited" : "Points redeemed")}
                          </Text>
                          <Text style={styles.histMeta}>
                            {isEarn ? "Earned" : "Redeemed"} · {d.getFullYear()}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.histPtsPill,
                            isEarn
                              ? styles.histPtsPillEarn
                              : styles.histPtsPillSpend,
                          ]}
                        >
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
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            {/* CTA */}
            <TouchableOpacity
              style={styles.ctaShadow}
              onPress={() => router.push("/(main)/products" as any)}
              activeOpacity={0.9}
              accessibilityRole="button"
            >
              <LinearGradient
                colors={[colors.olive[800], colors.olive[950]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.primaryBtn}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.primaryBtnText}>Shop to earn points</Text>
                  <Text style={styles.primaryBtnSub}>
                    {EARN_RATE[currentTier]} pt per LKR 100 at {currentTier}
                  </Text>
                </View>
                <LinearGradient
                  colors={[GOLD_SOFT, GOLD]}
                  style={styles.primaryBtnArrow}
                >
                  <Ionicons
                    name="arrow-forward"
                    size={16}
                    color={colors.olive[950]}
                  />
                </LinearGradient>
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        )}
      </SafeAreaView>
    </UserPageFrame>
  );
}

function shownTierLabel(t: LoyaltyTier) {
  return TIER_DETAILS[t].tag.toUpperCase();
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

const styles = withUserTheme(
  StyleSheet.create({
    container: { flex: 1 },
    loadingWrap: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
    },
    loadingText: {
      fontFamily: fontFamilies.sans.medium,
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
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: colors.paper.cream,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: HAIRLINE,
      ...shadows.soft,
    },
    navTitle: {
      fontFamily: fontFamilies.sans.medium,
      fontSize: 18,
      color: colors.light.foreground,
    },

    scrollContent: {
      paddingHorizontal: spacing[5],
      paddingTop: spacing[2],
      gap: spacing[5],
    },

    /* Heading */
    pageHead: {},
    eyebrowRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 4,
    },
    eyebrowRule: { width: 18, height: 1, backgroundColor: GOLD },
    eyebrow: {
      fontFamily: fontFamilies.sans.bold,
      fontSize: 10,
      letterSpacing: 2,
      textTransform: "uppercase",
      color: GOLD_DEEP,
    },
    pageTitle: {
      fontFamily: fontFamilies.sans.bold,
      fontSize: 34,
      letterSpacing: -0.8,
      lineHeight: 40,
      color: colors.light.foreground,
    },
    pageTitleAccent: {
      fontFamily: fontFamilies.sans.medium,
      color: GOLD_DEEP,
    },

    /* Membership card */
    cardShadow: {
      borderRadius: 26,
      shadowColor: "#16170f",
      shadowOffset: { width: 0, height: 20 },
      shadowOpacity: 0.28,
      shadowRadius: 30,
      elevation: 14,
    },
    memberCard: {
      borderRadius: 26,
      padding: spacing[5],
      overflow: "hidden",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.08)",
    },
    ring: { position: "absolute", borderWidth: 1 },
    memberTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },
    wordmark: {
      fontFamily: fontFamilies.sans.bold,
      fontSize: 20,
      letterSpacing: 6,
    },
    memberTag: {
      fontFamily: fontFamilies.sans.bold,
      fontSize: 9.5,
      letterSpacing: 2,
      marginTop: 4,
    },
    emblem: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    memberPointsLabel: {
      fontFamily: fontFamilies.sans.bold,
      fontSize: 9,
      letterSpacing: 1.8,
    },
    memberPointsRow: { flexDirection: "row", alignItems: "baseline", gap: 6 },
    memberPoints: {
      fontFamily: fontFamilies.sans.medium,
      fontSize: 46,
      lineHeight: 54,
      letterSpacing: -1.4,
    },
    memberPts: { fontFamily: fontFamilies.sans.medium, fontSize: 18 },
    memberFoot: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: spacing[3],
      marginTop: spacing[3],
      paddingTop: spacing[3],
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    memberFootLabel: {
      fontFamily: fontFamilies.sans.bold,
      fontSize: 8.5,
      letterSpacing: 1.6,
    },
    memberFootValue: {
      fontFamily: fontFamilies.sans.semibold,
      fontSize: 14,
      marginTop: 3,
    },
    memberFootMono: {
      fontFamily: fontFamilies.mono.medium,
      fontSize: 12,
      letterSpacing: 2,
      marginTop: 3,
    },

    /* Cards */
    card: {
      backgroundColor: "#FFFFFF",
      borderRadius: 26,
      borderWidth: 1,
      borderColor: "rgba(200,164,74,0.22)",
      padding: spacing[5],
      shadowColor: "#16170f",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.07,
      shadowRadius: 20,
      elevation: 4,
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 4,
    },
    cardTitle: {
      fontFamily: fontFamilies.sans.bold,
      fontSize: 22,
      letterSpacing: -0.4,
      color: colors.light.foreground,
      marginTop: 2,
    },
    cardTitleItalic: {
      fontFamily: fontFamilies.sans.medium,
      color: GOLD_DEEP,
    },
    cardCopy: {
      fontFamily: fontFamilies.sans.regular,
      fontSize: 13,
      lineHeight: 19,
      color: colors.light.mutedForeground,
      marginTop: 6,
    },
    cardCount: {
      fontFamily: fontFamilies.sans.semibold,
      fontSize: 10,
      letterSpacing: 1,
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
      backgroundColor: "rgba(200, 164, 74, 0.14)",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(200,164,74,0.4)",
    },
    lockedPill: {
      backgroundColor: "rgba(22,23,15,0.05)",
      borderColor: "rgba(22,23,15,0.12)",
    },
    activeDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: GOLD_DEEP,
    },
    activePillText: {
      fontFamily: fontFamilies.sans.semibold,
      fontSize: 11,
      color: GOLD_DEEP,
    },

    /* Progress */
    progressHeadline: {
      fontFamily: fontFamilies.sans.medium,
      fontSize: 22,
      lineHeight: 28,
      letterSpacing: -0.3,
      color: colors.light.foreground,
      marginTop: 4,
    },
    progressHeadlineNum: { fontFamily: fontFamilies.sans.bold },
    progressHeadlineTier: {
      fontFamily: fontFamilies.sans.medium,
      color: GOLD_DEEP,
    },
    progressBlock: { marginTop: spacing[4], gap: 10 },
    progressTrack: {
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.paper.warm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(22,23,15,0.1)",
      overflow: "hidden",
    },
    progressFillWrap: { height: "100%", borderRadius: 5, overflow: "hidden" },
    progressEnds: { flexDirection: "row", justifyContent: "space-between" },
    progressEnd: { flexDirection: "row", alignItems: "center", gap: 6 },
    progressEndText: {
      fontFamily: fontFamilies.sans.semibold,
      fontSize: 11,
      color: colors.light.mutedForeground,
    },

    /* Tier selector */
    sectionHead: { marginBottom: spacing[3] },
    sectionTitle: {
      fontFamily: fontFamilies.sans.bold,
      fontSize: 24,
      letterSpacing: -0.4,
      color: colors.light.foreground,
      marginTop: 4,
    },
    sectionSub: {
      fontFamily: fontFamilies.sans.regular,
      fontSize: 13,
      lineHeight: 19,
      color: colors.light.mutedForeground,
      marginTop: 4,
    },
    tierScroller: { marginHorizontal: -spacing[5] },
    tierRow: {
      paddingHorizontal: spacing[5],
      gap: spacing[3],
      paddingVertical: 6,
    },
    tierTile: {
      width: 138,
      padding: spacing[3],
      borderRadius: 22,
      backgroundColor: "#FFFFFF",
      borderWidth: 1,
      borderColor: HAIRLINE,
      ...shadows.soft,
    },
    tierTileSelected: {
      borderColor: GOLD,
      borderWidth: 1.5,
      shadowOpacity: 0.14,
      shadowRadius: 14,
    },
    tierSwatch: {
      height: 64,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    tierSwatchRing: {
      position: "absolute",
      width: 110,
      height: 110,
      borderRadius: 55,
      borderWidth: 1,
      right: -50,
      top: -50,
    },
    tierTileNameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: spacing[3],
    },
    tierTileName: {
      fontFamily: fontFamilies.sans.bold,
      fontSize: 17,
      color: colors.light.foreground,
    },
    tierTileRange: {
      fontFamily: fontFamilies.sans.regular,
      fontSize: 11.5,
      color: colors.light.mutedForeground,
      marginTop: 2,
    },
    tierTileStatus: {
      fontFamily: fontFamilies.sans.bold,
      fontSize: 10,
      letterSpacing: 0.6,
      textTransform: "uppercase",
      color: colors.ink.mute,
      marginTop: 8,
    },
    youBadge: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: radii.full,
      backgroundColor: colors.ink.DEFAULT,
    },
    youBadgeText: {
      fontFamily: fontFamilies.sans.bold,
      fontSize: 9.5,
      color: GOLD_SOFT,
    },

    /* Perks */
    perkGrid: { marginTop: spacing[4], gap: spacing[2.5] },
    perkTile: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing[3],
      padding: spacing[3.5],
      borderRadius: 18,
      backgroundColor: "#FFFFFF",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(22,23,15,0.08)",
    },
    perkIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    perkBody: { flex: 1, gap: 3 },
    perkTitle: {
      fontFamily: fontFamilies.sans.semibold,
      fontSize: 14,
      color: colors.light.foreground,
    },
    perkDesc: {
      fontFamily: fontFamilies.sans.regular,
      fontSize: 12.5,
      lineHeight: 18,
      color: colors.light.mutedForeground,
    },

    /* History */
    emptyHistory: {
      alignItems: "center",
      paddingTop: spacing[5],
      paddingBottom: spacing[2],
      gap: 4,
    },
    emptyHalo: {
      width: 76,
      height: 76,
      borderRadius: 38,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(200,164,74,0.08)",
      borderWidth: 1,
      borderColor: "rgba(200,164,74,0.28)",
      marginBottom: 10,
    },
    emptyHistoryIcon: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: "center",
      justifyContent: "center",
    },
    emptyHistoryTitle: {
      fontFamily: fontFamilies.sans.bold,
      fontSize: 18,
      color: colors.light.foreground,
    },
    emptyHistorySub: {
      fontFamily: fontFamilies.sans.regular,
      fontSize: 12.5,
      lineHeight: 18,
      color: colors.light.mutedForeground,
      textAlign: "center",
      maxWidth: 250,
    },
    ledger: { marginTop: spacing[3] },
    rowDivider: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.light.border,
    },
    histRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing[3],
      paddingVertical: spacing[3],
    },
    histDate: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.paper.warm,
    },
    histDay: {
      fontFamily: fontFamilies.sans.bold,
      fontSize: 16,
      lineHeight: 18,
      color: colors.light.foreground,
    },
    histMonth: {
      fontFamily: fontFamilies.sans.bold,
      fontSize: 8.5,
      letterSpacing: 1,
      color: colors.ink.mute,
    },
    histBody: { flex: 1, gap: 2 },
    histReason: {
      fontFamily: fontFamilies.sans.semibold,
      fontSize: 13.5,
      color: colors.light.foreground,
    },
    histMeta: {
      fontFamily: fontFamilies.sans.regular,
      fontSize: 11.5,
      color: colors.light.mutedForeground,
    },
    histPtsPill: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: radii.full,
    },
    histPtsPillEarn: { backgroundColor: "rgba(200, 164, 74, 0.14)" },
    histPtsPillSpend: { backgroundColor: "rgba(184, 92, 58, 0.1)" },
    histPts: { fontFamily: fontFamilies.sans.bold, fontSize: 14 },
    histPtsEarn: { color: GOLD_DEEP },
    histPtsSpend: { color: colors.accent2.rust },

    /* CTA */
    ctaShadow: {
      borderRadius: 24,
      shadowColor: "#16170f",
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.22,
      shadowRadius: 20,
      elevation: 8,
    },
    primaryBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing[3],
      borderRadius: 24,
      paddingVertical: spacing[3.5],
      paddingLeft: spacing[5],
      paddingRight: spacing[3],
    },
    primaryBtnText: {
      fontFamily: fontFamilies.sans.bold,
      fontSize: 15,
      color: colors.paper.cream,
    },
    primaryBtnSub: {
      fontFamily: fontFamilies.sans.regular,
      fontSize: 11.5,
      color: "rgba(250,248,241,0.6)",
      marginTop: 2,
    },
    primaryBtnArrow: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
    },
  }),
);
