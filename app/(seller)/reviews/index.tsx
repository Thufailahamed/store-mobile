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
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { Ionicons } from "@/components/ui/Icon";
import { useAuth } from "@/lib/supabase/auth";
import { getSellerStore, getStoreReviews } from "@/lib/api";
import { ReplyModal } from "@/components/seller/ReplyModal";
import { SellerBackButton } from "@/components/seller/SellerBackButton";
import { SellerFilterTab, SellerStateView } from "@/components/seller/chrome";
import { Skeleton } from "@/components/ui/Skeleton";
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
          ? `${total} ${total === 1 ? "review" : "reviews"} · ${pluralize(unansweredCount, "reply")} needed`
          : `${total} ${total === 1 ? "review" : "reviews"} · all answered`;

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
          <View style={s.avgCard}>
            <View style={s.avgLeft}>
              <Text style={s.avgNumber}>{(data?.avgRating ?? 0).toFixed(1)}</Text>
              <Stars rating={data?.avgRating ?? 0} />
              <Text style={s.avgCount}>{pluralize(total, "review")}</Text>
            </View>
            <View style={s.avgDivider} />
            <View style={s.avgRight}>
              {[5, 4, 3, 2, 1].map((star) => {
                const count = data?.ratingBreakdown[star] ?? 0;
                const pct = maxBreakdown > 0 ? (count / maxBreakdown) * 100 : 0;
                return (
                  <TouchableOpacity
                    key={star}
                    style={s.breakdownRow}
                    onPress={() => setFilterRating(filterRating === star ? 0 : star)}
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
        ) : null}

        {unansweredCount > 0 ? (
          <TouchableOpacity
            style={s.unansweredStrip}
            onPress={() => setUnansweredOnly(true)}
            accessibilityRole="button"
            accessibilityLabel="Show reviews awaiting a reply"
          >
            <Ionicons name="chatbubble-ellipses-outline" size={15} color="#8a6a2a" />
            <Text style={s.unansweredText}>
              {pluralize(unansweredCount, "review")} waiting for your reply
            </Text>
            <Ionicons name="arrow-forward" size={13} color="#8a6a2a" />
          </TouchableOpacity>
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
              <View key={review.id} style={s.reviewCard}>
                <View style={s.reviewHeader}>
                  <View style={s.avatarPlaceholder}>
                    <Text style={s.avatarText}>{name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={s.nameRow}>
                      <Text style={s.reviewerName} numberOfLines={1}>{name}</Text>
                      {review.is_verified_purchase ? (
                        <View style={s.verifiedBadge}>
                          <Ionicons name="checkmark-circle" size={11} color={colors.olive[600]} />
                          <Text style={s.verifiedText}>Verified</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={s.reviewDate}>
                      {new Date(review.created_at).toLocaleDateString("en-LK", {
                        month: "short", day: "numeric", year: "numeric",
                      })}
                    </Text>
                  </View>
                  <Stars rating={review.rating} size={11} />
                </View>

                {review.product?.name ? (
                  <View style={s.productRow}>
                    {productThumb ? (
                      <Image source={{ uri: productThumb }} style={s.productThumb} contentFit="cover" />
                    ) : (
                      <View style={[s.productThumb, s.productThumbFallback]}>
                        <Ionicons name="cube-outline" size={12} color={colors.ink.mute} />
                      </View>
                    )}
                    <Text style={s.productName} numberOfLines={1}>{review.product.name}</Text>
                  </View>
                ) : null}

                {review.title ? <Text style={s.reviewTitle}>{review.title}</Text> : null}
                {review.content ? <Text style={s.reviewBody}>{review.content}</Text> : null}

                {reply.length > 0 ? (
                  <View style={s.replyCard}>
                    <View style={s.replyCardHeader}>
                      <Ionicons name="storefront-outline" size={12} color={colors.olive[700]} />
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
                    <View />
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
        <LinearGradient
          colors={["#F9F7F1", "#EEEADD"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[s.header, { paddingTop: Math.max(insets.top, 12) + 8 }]}
        >
          <SellerBackButton label="More" fallbackHref="/(seller)/more" style={{ marginBottom: 6 }} />
          <View style={s.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.kicker}>Atelier</Text>
              <Text style={s.title}>Reviews</Text>
              <Text style={s.subtitle}>{headerSubtitle}</Text>
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
                    ? `${unansweredCount} need reply`
                    : `${(data?.avgRating ?? 0).toFixed(1)} avg`}
                </Text>
              </View>
            ) : null}
          </View>
        </LinearGradient>
        <View style={s.goldRule} />

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
  container: { flex: 1, backgroundColor: colors.paper.DEFAULT },
  content: { paddingBottom: 20 },
  body: { paddingHorizontal: spacing[5] },
  header: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[3],
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
    fontFamily: fontFamilies.display.semibold,
    fontSize: 28,
    color: INK,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    color: colors.ink.mute,
    marginTop: 3,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 12,
  },
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
  goldRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(200,164,74,0.55)",
    marginHorizontal: spacing[5],
    marginBottom: spacing[4],
  },

  avgCard: {
    flexDirection: "row",
    backgroundColor: CREAM,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.12)",
    padding: 18,
    marginBottom: 12,
    gap: 16,
    shadowColor: colors.olive[950],
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  avgLeft: { alignItems: "center", justifyContent: "center", minWidth: 96 },
  avgNumber: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 44,
    color: INK,
    lineHeight: 48,
    letterSpacing: -1,
  },
  avgCount: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.xs,
    color: colors.ink.mute,
    marginTop: 4,
  },
  avgDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(83,94,44,0.14)",
  },
  avgRight: { flex: 1, justifyContent: "center", gap: 7 },
  breakdownRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  breakdownStar: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 11,
    color: colors.ink.mute,
    width: 10,
    textAlign: "right",
  },
  breakdownBarBg: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.olive[100],
    overflow: "hidden",
  },
  breakdownBarFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: GOLD,
  },
  breakdownCount: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 11,
    color: colors.ink.mute,
    width: 20,
    textAlign: "right",
  },

  unansweredStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(200,164,74,0.14)",
    borderWidth: 1,
    borderColor: "rgba(200,164,74,0.4)",
    borderRadius: radii.xl,
    paddingHorizontal: 13,
    paddingVertical: 11,
    marginBottom: 12,
  },
  unansweredText: {
    flex: 1,
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    color: "#8a6a2a",
  },

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
    backgroundColor: CREAM,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.12)",
    padding: 16,
    marginBottom: 12,
    shadowColor: colors.olive[950],
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 10,
  },
  avatarPlaceholder: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.olive[100],
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.14)",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 16,
    color: colors.olive[700],
  },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  reviewerName: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.sm,
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
    gap: 8,
    backgroundColor: colors.olive[50],
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.1)",
    borderRadius: radii.lg,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 10,
    alignSelf: "flex-start",
    maxWidth: "100%",
  },
  productThumb: { width: 22, height: 22, borderRadius: 6 },
  productThumbFallback: {
    backgroundColor: colors.paper.DEFAULT,
    alignItems: "center",
    justifyContent: "center",
  },
  productName: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 11,
    color: colors.ink.soft,
    flexShrink: 1,
  },

  reviewTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 15,
    color: INK,
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  reviewBody: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    color: colors.ink.soft,
    lineHeight: 20,
  },

  replyCard: {
    marginTop: 12,
    padding: 12,
    borderRadius: radii.lg,
    backgroundColor: colors.olive[50],
    borderLeftWidth: 3,
    borderLeftColor: colors.olive[600],
    gap: 4,
  },
  replyCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
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
  },
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
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.25)",
    backgroundColor: colors.paper.DEFAULT,
  },
  replyBtnPrimary: {
    backgroundColor: colors.olive[800],
    borderColor: colors.olive[800],
  },
  replyBtnLabel: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.xs,
    color: colors.olive[800],
  },
  replyBtnLabelPrimary: { color: CREAM },

  emptyCard: {
    backgroundColor: CREAM,
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
    fontFamily: fontFamilies.display.semibold,
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
    backgroundColor: CREAM,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.08)",
    padding: 18,
    gap: 16,
  },
  skelCard: {
    backgroundColor: CREAM,
    borderRadius: radii["2xl"],
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.08)",
    gap: 10,
  },
});
