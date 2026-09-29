import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  Text,
  RefreshControl,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@/components/ui/Icon";
import { PaperBackground } from "@/components/layout";
import { useAuth } from "@/lib/supabase/auth";
import { useToast } from "@/components/ui";
import { getMyReviews, deleteReview as deleteReviewApi } from "@/lib/api";
import {
  getStoredReviews,
  setStoredReviews,
  mapReview,
  type MobileReview,
} from "@/lib/account-local";
import { colors, radii, shadows, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

type Tab = "all" | "published" | "pending";

const GOLD = colors.accent2.ochre;
const GOLD_DEEP = "#85651b";
const GOLD_SOFT = "#E8CF8F";
const HAIRLINE = "rgba(22, 23, 15, 0.08)";
const GREEN = "#15803d";

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "published", label: "Published" },
  { key: "pending", label: "Pending" },
];

const REVIEW_TIPS = [
  {
    n: "01",
    title: "Mention fit and fabric",
    desc: "Note the sizing, drape and feel — it helps other shoppers most.",
  },
  {
    n: "02",
    title: "Share how it wears",
    desc: "How the piece ages and washes is what photos can't show.",
  },
  {
    n: "03",
    title: "Earn patron points",
    desc: "Published reviews credit loyalty points to your account.",
  },
];

function Stars({ rating, size = 13 }: { rating: number; size?: number }) {
  return (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Ionicons
          key={star}
          name={star <= rating ? "star" : "star-outline"}
          size={size}
          color={GOLD}
        />
      ))}
    </View>
  );
}

export default function ReviewsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("all");
  const [reviews, setReviews] = useState<MobileReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadReviews = async (isManualRefresh = false) => {
    const userId = user?.id;
    if (!userId) {
      setLoading(false);
      return;
    }
    const activeUserId = userId as string;
    if (isManualRefresh) setRefreshing(true);

    try {
      const res = await getMyReviews(activeUserId);
      if (res.ok) {
        const mapped = res.data.map(mapReview);
        setReviews(mapped);
        await setStoredReviews(activeUserId, mapped);
      } else {
        const local = await getStoredReviews(activeUserId);
        setReviews(local);
        if (isManualRefresh) toast(res.error || "Failed to load reviews", "error");
      }
    } catch {
      const local = await getStoredReviews(activeUserId);
      setReviews(local);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadReviews();
  }, [user?.id]);

  const filtered = useMemo(() => {
    if (tab === "all") return reviews;
    return reviews.filter((r) => r.status === tab);
  }, [reviews, tab]);

  const avg = useMemo(() => {
    if (reviews.length === 0) return "0.0";
    return (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1);
  }, [reviews]);

  const totalPhotos = useMemo(() => reviews.reduce((sum, r) => sum + r.photos, 0), [reviews]);
  const totalHelpful = useMemo(() => reviews.reduce((sum, r) => sum + r.helpful, 0), [reviews]);
  const publishedCount = useMemo(() => reviews.filter((r) => r.status === "published").length, [reviews]);
  const pendingCount = useMemo(() => reviews.filter((r) => r.status === "pending").length, [reviews]);

  const rank = useMemo(() => {
    if (reviews.length >= 10) return "Gold";
    if (reviews.length >= 5) return "Silver";
    return "Bronze";
  }, [reviews.length]);

  const removeReview = async (id: string, productName?: string) => {
    if (!user?.id) return;
    Alert.alert(
      "Delete review",
      `Delete your review of "${productName ?? "this piece"}"?`,
      [
        { text: "Keep", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const next = reviews.filter((r) => r.id !== id);
            setReviews(next);
            await setStoredReviews(user.id, next);
            const res = await deleteReviewApi(id, user.id);
            if (res.ok) {
              toast("Review deleted", "success");
            } else {
              toast(res.error || "Could not delete review", "error");
            }
          },
        },
      ],
    );
  };

  const tabCount = (key: Tab) =>
    key === "all" ? reviews.length : key === "published" ? publishedCount : pendingCount;

  return (
    <PaperBackground>
      <SafeAreaView style={styles.container} edges={["top"]}>
        {/* Navigation */}
        <View style={styles.navBar}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.navBtn}
            activeOpacity={0.7}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={20} color={colors.light.foreground} />
          </TouchableOpacity>

          <Text style={styles.navTitle}>My reviews</Text>

          <TouchableOpacity
            onPress={() => loadReviews(true)}
            disabled={refreshing}
            style={styles.navBtn}
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

        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 40 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadReviews(true)}
              tintColor={GOLD}
              colors={[GOLD]}
            />
          }
        >
          {/* Heading */}
          <View style={styles.pageHead}>
            <Text style={styles.eyebrow}>Community</Text>
            <Text style={styles.pageTitle}>
              My <Text style={styles.pageTitleAccent}>reviews.</Text>
            </Text>
          </View>

          {/* Score hero */}
          <LinearGradient
            colors={["#1f2418", "#14170e"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View style={styles.heroTop}>
              <Text style={styles.heroEyebrow}>Average score</Text>
              <View style={styles.heroIcon}>
                <Ionicons name="create-outline" size={15} color={GOLD_SOFT} />
              </View>
            </View>
            <View style={styles.heroScoreRow}>
              <Text style={styles.heroScore}>{avg}</Text>
              <View style={styles.heroScoreRight}>
                <Stars rating={Math.round(Number(avg))} size={14} />
                <Text style={styles.heroScoreSub}>
                  {reviews.length === 0
                    ? "No reviews yet"
                    : `Across ${reviews.length} ${reviews.length === 1 ? "review" : "reviews"}`}
                </Text>
              </View>
            </View>
          </LinearGradient>

          {/* Stat strip */}
          <View style={styles.statsStrip}>
            <View style={styles.statCell}>
              <Text style={[styles.statNum, reviews.length === 0 && styles.statNumMuted]}>
                {reviews.length}
              </Text>
              <Text style={styles.statLabel}>Reviews</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCell}>
              <Text style={[styles.statNum, totalHelpful === 0 && styles.statNumMuted]}>
                {totalHelpful}
              </Text>
              <Text style={styles.statLabel}>Helpful</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCell}>
              <Text style={[styles.statNum, totalPhotos === 0 && styles.statNumMuted]}>
                {totalPhotos}
              </Text>
              <Text style={styles.statLabel}>Photos</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCell}>
              <Text style={styles.statNum} numberOfLines={1}>{rank}</Text>
              <Text style={styles.statLabel}>Rank</Text>
            </View>
          </View>

          {/* Filter tabs */}
          {reviews.length > 0 && (
            <View style={styles.segmented}>
              {TABS.map((t) => {
                const count = tabCount(t.key);
                const isActive = tab === t.key;
                return (
                  <TouchableOpacity
                    key={t.key}
                    style={[styles.segment, isActive && styles.segmentActive]}
                    onPress={() => setTab(t.key)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.segmentText, isActive && styles.segmentTextActive]}>
                      {t.label}
                      {count > 0 ? ` ${count}` : ""}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* List / empty */}
          {loading && reviews.length === 0 ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={GOLD} size="small" />
              <Text style={styles.loadingText}>Loading your reviews…</Text>
            </View>
          ) : filtered.length === 0 ? (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyCard}>
                <View style={styles.emptyIcon}>
                  <Ionicons
                    name="chatbubble-ellipses-outline"
                    size={26}
                    color={colors.olive[700]}
                  />
                </View>
                <Text style={styles.emptyTitle}>
                  {reviews.length > 0 ? "No reviews here" : "No reviews yet"}
                </Text>
                <Text style={styles.emptySub}>
                  {reviews.length > 0
                    ? "No reviews match this filter."
                    : "After an order arrives, share your notes on fit and fabric to help other shoppers."}
                </Text>
                <TouchableOpacity
                  style={styles.primaryBtn}
                  activeOpacity={0.88}
                  onPress={() => router.push("/(main)/account/orders")}
                  accessibilityRole="button"
                >
                  <Text style={styles.primaryBtnText}>Review your orders</Text>
                  <View style={styles.primaryBtnArrow}>
                    <Ionicons name="arrow-forward" size={14} color={colors.olive[900]} />
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.textLink}
                  activeOpacity={0.7}
                  onPress={() => router.push("/(main)/account/wardrobe")}
                  hitSlop={8}
                >
                  <Text style={styles.textLinkText}>View wardrobe</Text>
                </TouchableOpacity>
              </View>

              {/* Tips */}
              <View style={styles.tipsCard}>
                <Text style={styles.eyebrow}>Writing a good review</Text>
                {REVIEW_TIPS.map((s, i) => (
                  <View key={s.n} style={[styles.tipRow, i > 0 && styles.rowDivider]}>
                    <Text style={styles.tipNum}>{s.n}</Text>
                    <View style={styles.tipBody}>
                      <Text style={styles.tipTitle}>{s.title}</Text>
                      <Text style={styles.tipDesc}>{s.desc}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.reviewsList}>
              {filtered.map((review) => {
                const initials = review.product
                  .split(" ")
                  .filter(Boolean)
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase();

                return (
                  <View key={review.id} style={styles.reviewCard}>
                    {/* Status row */}
                    <View style={styles.cardTop}>
                      <View style={styles.badgeRow}>
                        {review.status === "published" ? (
                          <View style={[styles.pill, styles.pillPublished]}>
                            <Ionicons name="checkmark" size={10} color={GREEN} />
                            <Text style={[styles.pillText, { color: GREEN }]}>Published</Text>
                          </View>
                        ) : (
                          <View style={[styles.pill, styles.pillPending]}>
                            <Ionicons name="time-outline" size={10} color={GOLD_DEEP} />
                            <Text style={[styles.pillText, { color: GOLD_DEEP }]}>
                              In review
                            </Text>
                          </View>
                        )}
                        {review.isVerifiedPurchase && (
                          <View style={[styles.pill, styles.pillVerified]}>
                            <Ionicons name="shield-checkmark" size={9} color={colors.olive[700]} />
                            <Text style={[styles.pillText, { color: colors.olive[700] }]}>
                              Verified
                            </Text>
                          </View>
                        )}
                      </View>

                      <TouchableOpacity
                        onPress={() => removeReview(review.id, review.product)}
                        hitSlop={10}
                        accessibilityRole="button"
                        accessibilityLabel="Delete review"
                      >
                        <Ionicons
                          name="trash-outline"
                          size={15}
                          color={colors.light.mutedForeground}
                        />
                      </TouchableOpacity>
                    </View>

                    {/* Product */}
                    <View style={styles.productRow}>
                      <View style={styles.productEmblem}>
                        <Text style={styles.productEmblemText}>{initials || "—"}</Text>
                      </View>
                      <View style={styles.productInfo}>
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() =>
                            review.productSlug &&
                            router.push(`/(main)/products/${review.productSlug}`)
                          }
                        >
                          <Text style={styles.productName} numberOfLines={1}>
                            {review.product}
                          </Text>
                        </TouchableOpacity>
                        <Text style={styles.productMeta}>
                          {review.variant} ·{" "}
                          {new Date(review.date).toLocaleDateString(undefined, {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </Text>
                      </View>
                    </View>

                    {/* Review body */}
                    <View style={styles.reviewBody}>
                      <Stars rating={review.rating} />
                      {review.title ? (
                        <Text style={styles.reviewHeadline}>{review.title}</Text>
                      ) : null}
                      {review.body ? (
                        <Text style={styles.reviewBodyText}>{review.body}</Text>
                      ) : null}
                    </View>

                    {/* Footer */}
                    <View style={styles.cardFooter}>
                      <View style={styles.helpfulMeta}>
                        <Ionicons name="thumbs-up-outline" size={12} color={GOLD_DEEP} />
                        <Text style={styles.helpfulText}>
                          {review.helpful === 0
                            ? "No votes yet"
                            : `${review.helpful} found helpful`}
                        </Text>
                      </View>
                      {review.productSlug && (
                        <TouchableOpacity
                          style={styles.viewLink}
                          onPress={() => router.push(`/(main)/products/${review.productSlug}`)}
                          hitSlop={6}
                        >
                          <Text style={styles.viewLinkText}>View piece</Text>
                          <Ionicons name="arrow-forward" size={11} color={colors.light.foreground} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    marginBottom: 8,
  },
  heroEyebrow: {
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
  heroScoreRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 14,
  },
  heroScore: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 44,
    letterSpacing: -1.2,
    lineHeight: 50,
    color: colors.paper.cream,
  },
  heroScoreRight: {
    gap: 4,
    paddingBottom: 8,
  },
  heroScoreSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12.5,
    color: "rgba(250, 248, 241, 0.6)",
  },
  starsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
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

  /* Segmented tabs */
  segmented: {
    flexDirection: "row",
    gap: 4,
    backgroundColor: colors.paper.warm,
    borderRadius: radii.full,
    padding: 4,
    borderWidth: 1,
    borderColor: HAIRLINE,
  },
  segment: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
    borderRadius: radii.full,
  },
  segmentActive: {
    backgroundColor: colors.paper.cream,
    ...shadows.soft,
  },
  segmentText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: colors.light.mutedForeground,
  },
  segmentTextActive: {
    color: colors.light.foreground,
  },

  /* Loading */
  loadingWrap: {
    paddingVertical: 50,
    alignItems: "center",
    gap: 10,
  },
  loadingText: {
    fontFamily: fontFamilies.display.italic,
    fontSize: 13.5,
    color: colors.light.mutedForeground,
  },

  /* Empty */
  emptyWrap: {
    gap: 14,
  },
  emptyCard: {
    alignItems: "center",
    backgroundColor: colors.paper.cream,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: HAIRLINE,
    paddingVertical: spacing[8],
    paddingHorizontal: spacing[6],
  },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.paper.warm,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing[4],
  },
  emptyTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 22,
    letterSpacing: -0.3,
    color: colors.light.foreground,
    textAlign: "center",
  },
  emptySub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.light.mutedForeground,
    textAlign: "center",
    marginTop: 6,
    maxWidth: 280,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    height: 50,
    paddingLeft: 22,
    paddingRight: 6,
    borderRadius: radii.full,
    backgroundColor: colors.olive[900],
    marginTop: spacing[5],
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
  textLink: {
    marginTop: spacing[3],
    paddingVertical: 4,
  },
  textLinkText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: colors.light.foreground,
    textDecorationLine: "underline",
  },

  /* Tips */
  tipsCard: {
    backgroundColor: colors.paper.cream,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: HAIRLINE,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    paddingBottom: spacing[2],
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing[4],
    paddingVertical: spacing[3.5],
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.light.border,
  },
  tipNum: {
    fontFamily: fontFamilies.display.italic,
    fontSize: 16,
    color: GOLD_DEEP,
    width: 24,
  },
  tipBody: {
    flex: 1,
    gap: 3,
  },
  tipTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13.5,
    color: colors.light.foreground,
  },
  tipDesc: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.light.mutedForeground,
  },

  /* Review cards */
  reviewsList: {
    gap: 12,
  },
  reviewCard: {
    backgroundColor: colors.paper.cream,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: HAIRLINE,
    padding: spacing[4],
    gap: spacing[3],
    ...shadows.soft,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  pillText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 11,
  },
  pillPublished: {
    backgroundColor: "rgba(21, 128, 61, 0.1)",
  },
  pillPending: {
    backgroundColor: "rgba(200, 164, 74, 0.12)",
  },
  pillVerified: {
    backgroundColor: "rgba(65, 74, 35, 0.1)",
  },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
  },
  productEmblem: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.paper.warm,
    alignItems: "center",
    justifyContent: "center",
  },
  productEmblemText: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 15,
    color: colors.olive[700],
  },
  productInfo: {
    flex: 1,
    gap: 2,
  },
  productName: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 16,
    letterSpacing: -0.2,
    color: colors.light.foreground,
  },
  productMeta: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11.5,
    color: colors.light.mutedForeground,
  },
  reviewBody: {
    gap: 6,
  },
  reviewHeadline: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14,
    color: colors.light.foreground,
  },
  reviewBodyText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.light.mutedForeground,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: spacing[2.5],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.light.border,
  },
  helpfulMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  helpfulText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.light.mutedForeground,
  },
  viewLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  viewLinkText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12.5,
    color: colors.light.foreground,
  },
});
