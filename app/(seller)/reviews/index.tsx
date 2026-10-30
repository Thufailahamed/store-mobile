import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  StatusBar,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@/components/ui/Icon";
import { useAuth } from "@/lib/supabase/auth";
import { getSellerStore, getStoreReviews } from "@/lib/api";
import { ReplyModal } from "@/components/seller/ReplyModal";
import { SellerBackButton } from "@/components/seller/SellerBackButton";
import { SellerFilterTab, SellerStateView, SellerGlow } from "@/components/seller/chrome";
import { Skeleton } from "@/components/ui/Skeleton";
import { HERO, LuxeHero } from "@/components/seller/luxe";
import { colors, typography, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { pluralize } from "@/lib/utils";
import type { Review } from "@/lib/types";

interface ReviewsData {
  reviews: Review[];
  total: number;
  avgRating: number;
  ratingBreakdown: Record<number, number>;
}

const CREAM = colors.paper.cream;
const GOLD = colors.accent2.ochre;
const INK = colors.olive[950];
const RUST = colors.accent2.rust;

const RATING_FILTERS = [
  { label: "All", value: 0 },
  { label: "5★", value: 5 },
  { label: "4★", value: 4 },
  { label: "3★", value: 3 },
  { label: "2★", value: 2 },
  { label: "1★", value: 1 },
];

const REVIEW_STEPS: { icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { icon: "star-outline", label: "Buyer rates" },
  { icon: "chatbubble-outline", label: "You reply" },
  { icon: "trending-up-outline", label: "Trust grows" },
];

const AVATAR_TONES = [
  { bg: "#e9ecd9", fg: colors.olive[800] },
  { bg: "#f3e6cf", fg: "#8a6a2a" },
  { bg: "#f2dcd3", fg: "#9a4a2e" },
  { bg: "#dfe6e4", fg: "#2f5e5a" },
  { bg: "#e7e0ee", fg: "#5a4680" },
];

function avatarTone(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length];
}

function Stars({ rating, size = 13 }: { rating: number; size?: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Ionicons
          key={star}
          name={star <= Math.round(rating) ? "star" : "star-outline"}
          size={size}
          color={GOLD}
        />
      ))}
    </View>
  );
}

function EmptyReviewsState() {
  return (
    <View style={s.emptyCard}>
      <View style={s.emptyIconHalo}>
        <View style={s.emptyIconCore}>
          <Ionicons name="star-outline" size={22} color={colors.olive[800]} />
        </View>
      </View>
      <Text style={s.emptyTitle}>No reviews yet</Text>
      <Text style={s.emptyDesc}>
        Reviews from buyers will land here — replying builds trust and lifts conversion.
      </Text>

      <View style={s.emptyEyebrowRow}>
        <View style={s.emptyRule} />
        <Text style={s.emptyEyebrow}>How it works</Text>
        <View style={s.emptyRule} />
      </View>

      <View style={s.stepsRow}>
        <View style={s.stepsTrack} />
        {REVIEW_STEPS.map((step) => (
          <View key={step.label} style={s.step}>
            <View style={s.stepIconWrap}>
              <Ionicons name={step.icon} size={15} color={colors.olive[700]} />
            </View>
            <Text style={s.stepLabel} numberOfLines={2}>
              {step.label}
            </Text>
          </View>
        ))}
      </View>

      <View style={s.emptyNote}>
        <Ionicons name="shield-checkmark-outline" size={13} color={colors.olive[700]} />
        <Text style={s.emptyNoteText}>
          Buyers can review items once their order is delivered
        </Text>
      </View>
    </View>
  );
}

function ReviewsSkeleton() {
  return (
    <View style={{ paddingHorizontal: spacing[5], gap: 12 }}>
      <View style={s.skelSummary}>
        <Skeleton width={90} height={44} />
        <View style={{ flex: 1, gap: 8 }}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={8} borderRadius={4} />
          ))}
        </View>
      </View>
      {[0, 1, 2].map((i) => (
        <View key={i} style={s.skelCard}>
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            <Skeleton width={42} height={42} borderRadius={21} />
            <View style={{ flex: 1, gap: 6 }}>
              <Skeleton width="45%" height={13} />
              <Skeleton width="30%" height={10} />
            </View>
          </View>
          <Skeleton width="85%" height={12} />
          <Skeleton width="60%" height={12} />
        </View>
      ))}
    </View>
  );
}

export default function SellerReviews() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [data, setData] = useState<ReviewsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterRating, setFilterRating] = useState(0);
  const [unansweredOnly, setUnansweredOnly] = useState(false);
  const [replyTarget, setReplyTarget] = useState<Review | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Reviews are fetched once and filtered locally — the rating chips should
  // feel instant and the store-wide average/breakdown must stay stable
  // regardless of which chip is active.
  const fetchData = useCallback(async () => {
    if (!user) return;
    const storeRes = await getSellerStore(user.id);
    if (!storeRes.ok || !storeRes.data) {
      setLoadError(storeRes.ok ? "No store found" : storeRes.error);
      setData(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    const res = await getStoreReviews(storeRes.data.id);
    if (res.ok) {
      setData(res.data);
      setLoadError(null);
    } else {
      setLoadError(res.error);
      setData(null);
    }
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const retry = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    fetchData();
  }, [fetchData]);

  const isUnanswered = (r: Review) => !(r.seller_reply ?? "").trim();

  const visibleReviews = useMemo(() => {
    const all = data?.reviews ?? [];
    return all.filter(
      (r) =>
        (filterRating === 0 || r.rating === filterRating) &&
        (!unansweredOnly || isUnanswered(r)),
    );
  }, [data?.reviews, filterRating, unansweredOnly]);

  const replyCount = useMemo(
    () => (data?.reviews ?? []).filter((r) => !isUnanswered(r)).length,
    [data?.reviews],
  );
  const unansweredCount = (data?.total ?? 0) - replyCount;
  const total = data?.total ?? 0;

  const headerSubtitle = loading
    ? "Loading customer feedback…"
    : loadError && !data
      ? "Feedback unavailable"
      : total === 0
        ? "No reviews yet"
        : unansweredCount > 0
          ? `${total} ${total === 1 ? "review" : "reviews"} · ${unansweredCount} ${pluralize(unansweredCount, "reply", "replies")} needed`
          : `${total} ${total === 1 ? "review" : "reviews"} · all answered`;

  const reviewsList = data?.reviews ?? [];
  const replyRate = total > 0 ? Math.round((replyCount / total) * 100) : 0;
  const positivePct = total > 0
    ? Math.round((((data?.ratingBreakdown[5] ?? 0) + (data?.ratingBreakdown[4] ?? 0)) / total) * 100)
    : 0;
  const verifiedCount = reviewsList.filter((r) => r.is_verified_purchase).length;
  const maxBreakdown = Math.max(...Object.values(data?.ratingBreakdown ?? { 1: 1 }), 1);
  const isFiltered = filterRating !== 0 || unansweredOnly;

  const renderBody = () => {
    // A failed load must not render a hero full of zeros — that reads as
    // "you have no reviews" when we simply could not reach the server.
    if (loadError && !data) {
      return (
        <SellerStateView
          variant="error"
          icon="cloud-offline-outline"
          title="Couldn’t load reviews"
          description="We couldn’t reach the server. Check your connection and try again."
          actionLabel="Try again"
          onAction={retry}
          style={{ marginTop: 40 }}
        />
      );
    }

    return (
      <>
        {total > 0 ? (
          <LuxeHero style={{ marginBottom: 14 }}>
            <View style={s.avgCard}>
              <View style={s.avgLeft}>
                <Text style={s.avgKicker}>AVERAGE</Text>
                <Text style={s.avgNumber}>{(data?.avgRating ?? 0).toFixed(1)}</Text>
                <Stars rating={data?.avgRating ?? 0} size={13} />
                <Text style={s.avgCount}>{total} {pluralize(total, "review")}</Text>
              </View>
              <View style={s.avgDivider} />
              <View style={s.avgRight}>
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = data?.ratingBreakdown[star] ?? 0;
                  const pct = maxBreakdown > 0 ? (count / maxBreakdown) * 100 : 0;
                  const active = filterRating === star && !unansweredOnly;
                  return (
                    <TouchableOpacity
                      key={star}
                      style={[s.breakdownRow, active && s.breakdownRowActive]}
                      onPress={() => {
                        setFilterRating(filterRating === star ? 0 : star);
                        setUnansweredOnly(false);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Filter ${star} star reviews`}
                    >
                      <Text style={s.breakdownStar}>{star}</Text>
                      <Ionicons name="star" size={10} color={GOLD} />
                      <View style={s.breakdownBarBg}>
                        <View style={[s.breakdownBarFill, { width: `${pct}%` }]} />
                      </View>
                      <Text style={s.breakdownCount}>{count}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
            <View style={s.heroStats}>
              <View style={s.heroStat}>
                <Text style={s.heroStatValue}>{replyRate}%</Text>
                <Text style={s.heroStatLabel}>Reply rate</Text>
              </View>
              <View style={s.heroStatDivider} />
              <View style={s.heroStat}>
                <Text style={s.heroStatValue}>{positivePct}%</Text>
                <Text style={s.heroStatLabel}>4★ & above</Text>
              </View>
              <View style={s.heroStatDivider} />
              <View style={s.heroStat}>
                <Text style={s.heroStatValue}>{verifiedCount}</Text>
                <Text style={s.heroStatLabel}>Verified</Text>
              </View>
            </View>
          </LuxeHero>
        ) : null}

        {unansweredCount > 0 ? (
          <View style={s.unansweredCard}>
            <View style={s.unansweredIcon}>
              <Ionicons name="chatbubble-ellipses" size={16} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.unansweredKicker}>NEEDS REPLY</Text>
              <Text style={s.unansweredText}>
                {unansweredCount} {pluralize(unansweredCount, "review")} waiting for you
              </Text>
            </View>
            <TouchableOpacity
              style={s.unansweredBtn}
              onPress={() => {
                setUnansweredOnly(true);
                setFilterRating(0);
              }}
              accessibilityRole="button"
              accessibilityLabel="Show reviews awaiting a reply"
              activeOpacity={0.85}
            >
              <Text style={s.unansweredBtnText}>Reply now</Text>
              <Ionicons name="arrow-forward" size={13} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        ) : null}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.filterRow}
          style={s.filterScroll}
        >
          {RATING_FILTERS.map((f) => (
            <SellerFilterTab
              key={f.value}
              label={f.label}
              count={f.value === 0 ? total : (data?.ratingBreakdown[f.value] ?? 0)}
              active={filterRating === f.value && !unansweredOnly}
              onPress={() => {
                setFilterRating(f.value);
                setUnansweredOnly(false);
              }}
            />
          ))}
          <SellerFilterTab
            label="Needs reply"
            count={unansweredCount}
            active={unansweredOnly}
            onPress={() => {
              setUnansweredOnly(true);
              setFilterRating(0);
            }}
          />
        </ScrollView>

        {isFiltered ? (
          <View style={s.resultsBar}>
            <Text style={s.resultsText}>
              {visibleReviews.length} result{visibleReviews.length === 1 ? "" : "s"}
              {unansweredOnly ? " · Needs reply" : filterRating ? ` · ${filterRating} stars` : ""}
            </Text>
            <TouchableOpacity
              onPress={() => {
                setFilterRating(0);
                setUnansweredOnly(false);
              }}
              accessibilityRole="button"
              accessibilityLabel="Clear filters"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={s.resultsClear}>Clear</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {visibleReviews.length === 0 ? (
          isFiltered ? (
            <SellerStateView
              variant="empty"
              icon="chatbubble-ellipses-outline"
              title={
                unansweredOnly ? "All caught up" : `No ${filterRating}-star reviews`
              }
              description="Try a different rating filter."
              actionLabel="Clear filters"
              onAction={() => {
                setFilterRating(0);
                setUnansweredOnly(false);
              }}
              style={{ marginTop: 12 }}
            />
          ) : (
            <EmptyReviewsState />
          )
        ) : (
          visibleReviews.map((review) => {
            const reply = (review.seller_reply ?? "").trim();
            const name = review.user?.full_name ?? "Anonymous";
            const productThumb = review.product?.images?.find((i) => i.is_primary)?.url
              ?? review.product?.images?.[0]?.url;
            return (
              <View key={review.id} style={[s.reviewCard, !reply && s.reviewCardPending]}>
                {!reply ? <View style={s.pendingRail} /> : null}
                <View style={s.reviewHeader}>
                  <View style={[s.avatarPlaceholder, { backgroundColor: avatarTone(name).bg }]}>
                    <Text style={[s.avatarText, { color: avatarTone(name).fg }]}>{name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={s.nameRow}>
                      <Text style={s.reviewerName} numberOfLines={1}>{name}</Text>
                      {review.is_verified_purchase ? (
                        <Ionicons name="checkmark-circle" size={14} color={colors.olive[600]} accessibilityLabel="Verified purchase" />
                      ) : null}
                    </View>
                    <Text style={s.reviewDate}>
                      {new Date(review.created_at).toLocaleDateString("en-LK", {
                        month: "short", day: "numeric", year: "numeric",
                      })}
                      {review.is_verified_purchase ? " · Verified buyer" : ""}
                    </Text>
                  </View>
                  <View style={[s.ratingPill, review.rating <= 2 && s.ratingPillLow]}>
                    <Ionicons name="star" size={11} color={review.rating <= 2 ? RUST : GOLD} />
                    <Text style={[s.ratingPillText, review.rating <= 2 && { color: RUST }]}>{review.rating.toFixed(1)}</Text>
                  </View>
                </View>

                {review.title ? <Text style={s.reviewTitle}>{review.title}</Text> : null}
                {review.content ? <Text style={s.reviewBody}>{review.content}</Text> : null}

                {review.product?.name ? (
                  <View style={s.productRow}>
                    {productThumb ? (
                      <Image source={{ uri: productThumb }} style={s.productThumb} contentFit="cover" />
                    ) : (
                      <View style={[s.productThumb, s.productThumbFallback]}>
                        <Ionicons name="cube-outline" size={14} color={colors.ink.mute} />
                      </View>
                    )}
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.productEyebrow}>REVIEWED ITEM</Text>
                      <Text style={s.productName} numberOfLines={1}>{review.product.name}</Text>
                    </View>
                  </View>
                ) : null}

                {reply.length > 0 ? (
                  <View style={s.replyCard}>
                    <View style={s.replyCardHeader}>
                      <View style={s.replyIcon}>
                        <Ionicons name="storefront" size={10} color={CREAM} />
                      </View>
                      <Text style={s.replyCardLabel}>Your reply</Text>
                      {review.seller_replied_at ? (
                        <Text style={s.replyCardDate}>
                          {new Date(review.seller_replied_at).toLocaleDateString("en-LK", {
                            month: "short",
                            day: "numeric",
                          })}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={s.replyCardBody}>{reply}</Text>
                  </View>
                ) : null}

                <View style={s.reviewFooter}>
                  {!reply ? (
                    <View style={s.awaitingChip}>
                      <View style={s.awaitingDot} />
                      <Text style={s.awaitingText}>Awaiting reply</Text>
                    </View>
                  ) : (
                    <View style={[s.awaitingChip, s.repliedChip]}>
                      <Ionicons name="checkmark-done" size={12} color={colors.olive[700]} />
                      <Text style={[s.awaitingText, { color: colors.olive[700] }]}>Replied</Text>
                    </View>
                  )}
                  <TouchableOpacity
                    style={[s.replyBtn, !reply && s.replyBtnPrimary]}
                    onPress={() => setReplyTarget(review)}
                    accessibilityRole="button"
                    accessibilityLabel={reply.length > 0 ? "Edit your reply" : "Reply to review"}
                  >
                    <Ionicons
                      name="chatbubble-outline"
                      size={13}
                      color={reply ? colors.olive[700] : CREAM}
                    />
                    <Text style={[s.replyBtnLabel, !reply && s.replyBtnLabelPrimary]}>
                      {reply.length > 0 ? "Edit reply" : "Reply"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </>
    );
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.olive[800]} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={[s.header, { paddingTop: Math.max(insets.top, 12) + 8 }]}>
          <SellerGlow />
          <View style={s.headerRow}>
            <SellerBackButton label="More" fallbackHref="/(seller)/more" />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.title} accessibilityRole="header">Reviews</Text>
            </View>
            {!loading && !loadError && total > 0 ? (
              <View style={[s.queuePill, unansweredCount > 0 && s.queuePillWarn]}>
                {unansweredCount > 0 ? (
                  <View style={[s.queueDot, s.queueDotWarn]} />
                ) : (
                  <Ionicons name="star" size={11} color={GOLD} />
                )}
                <Text style={[s.queuePillText, unansweredCount > 0 && s.queuePillTextWarn]}>
                  {unansweredCount > 0
                    ? `${unansweredCount} ${unansweredCount === 1 ? "needs" : "need"} reply`
                    : `${(data?.avgRating ?? 0).toFixed(1)} avg`}
                </Text>
              </View>
            ) : null}
          </View>
          <Text style={s.subtitle}>{headerSubtitle}</Text>
        </View>

        {loading ? (
          <ReviewsSkeleton />
        ) : (
          <View style={s.body}>{renderBody()}</View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      <ReplyModal
        review={replyTarget}
        visible={!!replyTarget}
        onClose={() => setReplyTarget(null)}
        onReplied={(reply) => {
          const targetId = replyTarget?.id;
          setData((d) =>
            d
              ? {
                  ...d,
                  reviews: d.reviews.map((r) =>
                    r.id === targetId
                      ? { ...r, seller_reply: reply.body, seller_replied_at: reply.created_at }
                      : r,
                  ),
                }
              : d,
          );
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f7f2" },
  content: { paddingBottom: 20 },
  body: { paddingHorizontal: spacing[5] },
  header: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[5],
  },
  kicker: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: typography.letterSpacing.editorial,
    textTransform: "uppercase",
    color: colors.olive[700],
    marginBottom: 2,
  },
  title: {
    flex: 1,
    fontFamily: fontFamilies.display.semibold,
    fontSize: 31,
    color: INK,
    letterSpacing: -0.8,
  },
  subtitle: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 13,
    color: colors.light.mutedForeground,
    marginTop: 8,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  queuePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: radii.full,
    backgroundColor: "rgba(83,94,44,0.08)",
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.14)",
    marginBottom: 2,
  },
  queuePillWarn: {
    backgroundColor: "rgba(200,164,74,0.16)",
    borderColor: "rgba(200,164,74,0.45)",
  },
  queueDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.olive[600],
  },
  queueDotWarn: { backgroundColor: GOLD },
  queuePillText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: colors.olive[800],
  },
  queuePillTextWarn: { color: "#8a6a2a" },

  avgCard: { flexDirection: "row", gap: 14 },
  avgLeft: { alignItems: "center", justifyContent: "center", minWidth: 84, gap: 3 },
  avgKicker: { fontFamily: fontFamilies.mono.medium, fontSize: 9, letterSpacing: 1.5, color: HERO.kicker },
  avgNumber: { fontFamily: fontFamilies.display.regular, fontSize: 38, color: HERO.ink, lineHeight: 44, letterSpacing: -1 },
  avgCount: { fontFamily: fontFamilies.sans.regular, fontSize: 11, color: HERO.mute, marginTop: 1 },
  avgDivider: { width: StyleSheet.hairlineWidth, backgroundColor: HERO.divider },
  avgRight: { flex: 1, justifyContent: "center", gap: 1 },
  breakdownRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 8 },
  breakdownRowActive: { backgroundColor: HERO.tile },
  breakdownStar: { fontFamily: fontFamilies.mono.semibold, fontSize: 10.5, color: HERO.text, width: 10, textAlign: "right" },
  breakdownBarBg: { flex: 1, height: 5, borderRadius: 3, backgroundColor: "rgba(83,94,44,0.08)", overflow: "hidden" },
  breakdownBarFill: { height: "100%", borderRadius: 3, backgroundColor: GOLD },
  breakdownCount: { fontFamily: fontFamilies.mono.semibold, fontSize: 10.5, color: HERO.text, width: 22, textAlign: "right" },
  heroStats: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: HERO.tile,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: HERO.tileBorder,
  },
  heroStat: { flex: 1, alignItems: "center", gap: 1 },
  heroStatValue: { fontFamily: fontFamilies.display.semibold, fontSize: 16, color: HERO.ink },
  heroStatLabel: { fontFamily: fontFamilies.mono.semibold, fontSize: 8, letterSpacing: 0.8, color: HERO.mute, textTransform: "uppercase" },
  heroStatDivider: { width: StyleSheet.hairlineWidth, height: 20, backgroundColor: HERO.divider },

  unansweredCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(200,164,74,0.4)",
    borderRadius: 20,
    padding: 12,
    marginBottom: 14,
    shadowColor: GOLD,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  unansweredIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: GOLD, alignItems: "center", justifyContent: "center" },
  unansweredKicker: { fontFamily: fontFamilies.mono.semibold, fontSize: 8, letterSpacing: 1.3, color: "#8a6a2a" },
  unansweredText: { marginTop: 1, fontFamily: fontFamilies.sans.semibold, fontSize: 13.5, color: INK },
  unansweredBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 13, paddingVertical: 8, borderRadius: 999, backgroundColor: INK },
  unansweredBtnText: { fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: "#FFFFFF" },

  filterScroll: { flexGrow: 0, marginHorizontal: -spacing[5] },
  filterRow: { paddingHorizontal: spacing[5], gap: 8, marginBottom: 8, paddingTop: 2 },
  resultsBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    gap: 12,
  },
  resultsText: {
    flex: 1,
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.xs,
    color: colors.ink.mute,
  },
  resultsClear: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.xs,
    color: colors.olive[700],
  },

  reviewCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.12)",
    padding: 18,
    marginBottom: 14,
    overflow: "hidden",
    shadowColor: colors.olive[950],
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  reviewCardPending: { borderColor: "rgba(200,164,74,0.35)" },
  pendingRail: { position: "absolute", left: 0, top: 18, width: 3, height: 40, borderTopRightRadius: 3, borderBottomRightRadius: 3, backgroundColor: GOLD },
  reviewHeader: { flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 12 },
  ratingPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, backgroundColor: "rgba(200,164,74,0.14)" },
  ratingPillLow: { backgroundColor: "rgba(184,92,58,0.1)" },
  ratingPillText: { fontFamily: fontFamilies.sans.bold, fontSize: 12, color: "#8a6a2a" },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    shadowColor: INK,
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 18,
    color: colors.olive[700],
  },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  reviewerName: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 15,
    color: INK,
    flexShrink: 1,
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(83,94,44,0.1)",
    borderRadius: radii.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  verifiedText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 10,
    color: colors.olive[700],
  },
  reviewDate: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: colors.ink.mute,
    marginTop: 2,
  },

  productRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.paper.DEFAULT,
    borderRadius: 14,
    padding: 8,
    marginTop: 12,
  },
  productThumb: { width: 38, height: 38, borderRadius: 10 },
  productEyebrow: { fontFamily: fontFamilies.mono.semibold, fontSize: 8, letterSpacing: 1.2, color: colors.ink.mute, marginBottom: 1 },
  productThumbFallback: {
    backgroundColor: colors.paper.DEFAULT,
    alignItems: "center",
    justifyContent: "center",
  },
  productName: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: colors.ink.soft,
  },

  reviewTitle: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 17,
    color: INK,
    marginBottom: 5,
    letterSpacing: -0.2,
  },
  reviewBody: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    color: colors.ink.soft,
    lineHeight: 21,
  },

  replyCard: {
    marginTop: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: colors.olive[50],
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.12)",
    gap: 6,
  },
  replyCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  replyIcon: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.olive[800], alignItems: "center", justifyContent: "center" },
  replyCardLabel: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.xs,
    color: colors.olive[700],
  },
  replyCardDate: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 10,
    color: colors.ink.mute,
    marginLeft: "auto",
  },
  replyCardBody: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    color: colors.ink.soft,
    lineHeight: 19,
  },

  reviewFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(83,94,44,0.12)",
  },
  awaitingChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(200,164,74,0.14)",
  },
  repliedChip: { backgroundColor: colors.olive[50] },
  awaitingDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: GOLD,
  },
  awaitingText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 11,
    color: "#8a6a2a",
  },
  replyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.25)",
    backgroundColor: colors.paper.DEFAULT,
  },
  replyBtnPrimary: {
    backgroundColor: INK,
    borderColor: INK,
  },
  replyBtnLabel: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.xs,
    color: colors.olive[800],
  },
  replyBtnLabelPrimary: { color: CREAM },

  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.12)",
    marginTop: 12,
    paddingHorizontal: 22,
    paddingVertical: 30,
    alignItems: "center",
    shadowColor: colors.olive[950],
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  emptyIconHalo: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "rgba(200,164,74,0.14)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyIconCore: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.olive[50],
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 21,
    letterSpacing: -0.3,
    color: INK,
    textAlign: "center",
  },
  emptyDesc: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    lineHeight: 21,
    color: colors.ink.mute,
    textAlign: "center",
    maxWidth: 280,
    marginTop: 6,
  },
  emptyEyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    alignSelf: "stretch",
    marginTop: 22,
    marginBottom: 16,
  },
  emptyRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(83,94,44,0.16)",
  },
  emptyEyebrow: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    letterSpacing: typography.letterSpacing.editorial,
    textTransform: "uppercase",
    color: colors.ink.mute,
  },
  stepsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    alignSelf: "stretch",
    paddingHorizontal: 18,
  },
  stepsTrack: {
    position: "absolute",
    top: 16,
    left: 52,
    right: 52,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(83,94,44,0.2)",
  },
  step: { width: 76, alignItems: "center", gap: 7 },
  stepIconWrap: {
    width: 33,
    height: 33,
    borderRadius: 17,
    backgroundColor: colors.paper.DEFAULT,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  stepLabel: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 10,
    lineHeight: 13,
    color: colors.ink.soft,
    textAlign: "center",
  },
  emptyNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.full,
    backgroundColor: "rgba(83,94,44,0.06)",
  },
  emptyNoteText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: colors.ink.mute,
  },

  skelSummary: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.08)",
    padding: 18,
    gap: 16,
  },
  skelCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: radii["2xl"],
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.08)",
    gap: 10,
  },
});
