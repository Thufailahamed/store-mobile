import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { useAuth } from "@/lib/supabase/auth";
import { getSellerStore, getStoreReviews } from "@/lib/api";
import { ReplyModal } from "@/components/seller/ReplyModal";
import { colors, typography, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import type { Review } from "@/lib/types";

interface ReviewsData {
  reviews: Review[];
  total: number;
  avgRating: number;
  ratingBreakdown: Record<number, number>;
}

const RATING_FILTERS = [
  { label: "All", value: 0 },
  { label: "5", value: 5 },
  { label: "4", value: 4 },
  { label: "3", value: 3 },
  { label: "2", value: 2 },
  { label: "1", value: 1 },
];

export default function SellerReviews() {
  const { user } = useAuth();
  const [data, setData] = useState<ReviewsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterRating, setFilterRating] = useState(0);
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

  const visibleReviews = useMemo(() => {
    const all = data?.reviews ?? [];
    return filterRating ? all.filter((r) => r.rating === filterRating) : all;
  }, [data?.reviews, filterRating]);

  const replyCount = useMemo(
    () => (data?.reviews ?? []).filter((r) => (r.seller_reply ?? "").trim().length > 0).length,
    [data?.reviews],
  );

  if (loading) {
    return (
      <View style={s.loadingWrap}>
        <Ionicons name="star-outline" size={32} color={colors.light.mutedForeground} />
        <Text style={s.loadingText}>Loading reviews...</Text>
      </View>
    );
  }

  // A failed load must not render a hero full of zeros — that reads as
  // "you have no reviews" when we simply could not reach the server.
  if (loadError && !data) {
    return (
      <View style={s.loadingWrap}>
        <Ionicons name="cloud-offline-outline" size={32} color={colors.light.mutedForeground} />
        <Text style={s.errorTitle}>Couldn’t load reviews</Text>
        <Text style={s.errorSub}>{loadError}</Text>
        <TouchableOpacity style={s.retryBtn} onPress={retry} accessibilityRole="button">
          <Text style={s.retryLabel}>Try again</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button">
          <Text style={s.backLink}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const maxBreakdown = Math.max(...Object.values(data?.ratingBreakdown ?? { 1: 1 }), 1);

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.light.primary} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={s.header}>
        <View style={s.heroBg} />
        <View style={s.heroContent}>
          <TouchableOpacity
            style={s.backBtn}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={s.kicker}>REVIEWS</Text>
          <Text style={s.heroTitle}>Customer Reviews</Text>
          <Text style={s.heroSub}>
            {data?.total ?? 0} reviews · {replyCount} replied
          </Text>
        </View>
      </View>

      {/* Average Rating Card */}
      <View style={s.avgCard}>
        <View style={s.avgLeft}>
          <Text style={s.avgNumber}>{(data?.avgRating ?? 0).toFixed(1)}</Text>
          <View style={s.avgStars}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Ionicons
                key={star}
                name={star <= Math.round(data?.avgRating ?? 0) ? "star" : "star-outline"}
                size={16}
                color="#f59e0b"
              />
            ))}
          </View>
          <Text style={s.avgCount}>{data?.total ?? 0} reviews</Text>
        </View>
        <View style={s.avgRight}>
          {[5, 4, 3, 2, 1].map((star) => {
            const count = data?.ratingBreakdown[star] ?? 0;
            const pct = maxBreakdown > 0 ? (count / maxBreakdown) * 100 : 0;
            return (
              <View key={star} style={s.breakdownRow}>
                <Text style={s.breakdownStar}>{star}</Text>
                <Ionicons name="star" size={10} color="#f59e0b" />
                <View style={s.breakdownBarBg}>
                  <View style={[s.breakdownBarFill, { width: `${pct}%` }]} />
                </View>
                <Text style={s.breakdownCount}>{count}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Filter Chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
        {RATING_FILTERS.map((f) => {
          const active = filterRating === f.value;
          return (
            <TouchableOpacity
              key={f.value}
              style={[s.filterChip, active && s.filterChipActive]}
              onPress={() => setFilterRating(f.value)}
            >
              <Text style={[s.filterChipText, active && s.filterChipTextActive]}>
                {f.value > 0 ? `${f.value} Stars` : f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Reviews List */}
      <View style={s.reviewsList}>
        {visibleReviews.length === 0 ? (
          <View style={s.emptyCard}>
            <Ionicons name="chatbubble-ellipses-outline" size={32} color={colors.light.mutedForeground} />
            <Text style={s.emptyTitle}>
              {filterRating ? `No ${filterRating}-star reviews` : "No reviews yet"}
            </Text>
            <Text style={s.emptySub}>
              {filterRating
                ? "Try a different rating filter."
                : "Reviews from customers will appear here"}
            </Text>
          </View>
        ) : (
          visibleReviews.map((review) => {
            const reply = (review.seller_reply ?? "").trim();
            return (
            <View key={review.id} style={s.reviewCard}>
              <View style={s.reviewHeader}>
                <View style={s.reviewUserRow}>
                  <View style={s.avatarPlaceholder}>
                    <Text style={s.avatarText}>
                      {(review.user?.full_name ?? "U").charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View>
                    <Text style={s.reviewerName}>{review.user?.full_name ?? "Anonymous"}</Text>
                    <Text style={s.reviewDate}>
                      {new Date(review.created_at).toLocaleDateString("en-LK", {
                        month: "short", day: "numeric", year: "numeric",
                      })}
                    </Text>
                  </View>
                </View>
                <View style={s.reviewRating}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Ionicons
                      key={star}
                      name={star <= review.rating ? "star" : "star-outline"}
                      size={12}
                      color="#f59e0b"
                    />
                  ))}
                </View>
              </View>
              {review.title && <Text style={s.reviewTitle}>{review.title}</Text>}
              {review.content && <Text style={s.reviewBody}>{review.content}</Text>}
              {review.is_verified_purchase && (
                <View style={s.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={12} color={colors.olive[600]} />
                  <Text style={s.verifiedText}>Verified Purchase</Text>
                </View>
              )}
              {reply.length > 0 && (
                <View style={s.replyCard}>
                  <View style={s.replyCardHeader}>
                    <Ionicons name="storefront-outline" size={12} color={colors.olive[700]} />
                    <Text style={s.replyCardLabel}>Your reply</Text>
                    {review.seller_replied_at && (
                      <Text style={s.replyCardDate}>
                        {new Date(review.seller_replied_at).toLocaleDateString("en-LK", {
                          month: "short",
                          day: "numeric",
                        })}
                      </Text>
                    )}
                  </View>
                  <Text style={s.replyCardBody}>{reply}</Text>
                </View>
              )}
              <View style={s.replyRow}>
                <TouchableOpacity
                  style={s.replyBtn}
                  onPress={() => setReplyTarget(review)}
                  accessibilityRole="button"
                  accessibilityLabel={reply.length > 0 ? "Edit your reply" : "Reply to review"}
                >
                  <Ionicons name="chatbubble-outline" size={14} color={colors.olive[600]} />
                  <Text style={s.replyBtnLabel}>{reply.length > 0 ? "Edit reply" : "Reply"}</Text>
                </TouchableOpacity>
              </View>
            </View>
            );
          })
        )}
      </View>

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

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  content: { paddingBottom: 20 },
  loadingWrap: { flex: 1, justifyContent: "center" as const, alignItems: "center" as const, gap: 12, backgroundColor: colors.light.background, paddingHorizontal: 32 },
  loadingText: { fontSize: typography.fontSizes.base, color: colors.light.mutedForeground },
  errorTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.semibold as any,
    color: colors.light.foreground,
  },
  errorSub: {
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
    textAlign: "center" as const,
  },
  retryBtn: {
    marginTop: 4,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: radii.full,
    backgroundColor: colors.olive[600],
  },
  retryLabel: {
    color: "#fff",
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold as any,
  },
  backLink: {
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
    textDecorationLine: "underline" as const,
  },

  header: { position: "relative" as const, marginBottom: 20 },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.18)",
    justifyContent: "center" as const,
    alignItems: "center" as const,
    marginBottom: 10,
  },
  heroBg: {
    position: "absolute" as const, top: 0, left: 0, right: 0, height: 140,
    backgroundColor: colors.accent2.rust,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
  },
  heroContent: { paddingTop: 56, paddingHorizontal: 24, paddingBottom: 20 },
  kicker: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10, letterSpacing: 3, textTransform: "uppercase" as const,
    color: "rgba(255,255,255,0.7)", marginBottom: 4,
  },
  heroTitle: {
    fontFamily: fontFamilies.display.regular,
    fontSize: typography.fontSizes["2xl"],
    fontWeight: typography.fontWeights.bold as any,
    color: "#fff",
  },
  heroSub: {
    fontSize: typography.fontSizes.sm,
    color: "rgba(255,255,255,0.7)", marginTop: 4,
  },

  avgCard: {
    flexDirection: "row" as const,
    backgroundColor: colors.light.card, borderRadius: radii.xl,
    borderWidth: 1, borderColor: colors.light.border,
    padding: 20, marginHorizontal: 24, marginBottom: 20,
    gap: 20,
  },
  avgLeft: { alignItems: "center" as const, justifyContent: "center" as const, minWidth: 100 },
  avgNumber: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 42, fontWeight: typography.fontWeights.bold as any,
    color: colors.light.foreground, lineHeight: 46,
  },
  avgStars: { flexDirection: "row" as const, gap: 2, marginTop: 4 },
  avgCount: { fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground, marginTop: 4 },
  avgRight: { flex: 1, justifyContent: "center" as const, gap: 6 },
  breakdownRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 6 },
  breakdownStar: { fontSize: 11, color: colors.light.mutedForeground, width: 10, textAlign: "right" as const },
  breakdownBarBg: {
    flex: 1, height: 6, borderRadius: 3,
    backgroundColor: colors.light.muted, overflow: "hidden" as const,
  },
  breakdownBarFill: {
    height: "100%" as any, borderRadius: 3,
    backgroundColor: "#f59e0b",
  },
  breakdownCount: { fontSize: 11, color: colors.light.mutedForeground, width: 20, textAlign: "right" as const },

  filterRow: { paddingHorizontal: 24, gap: 8, marginBottom: 20 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: radii.full,
    backgroundColor: colors.light.card,
    borderWidth: 1, borderColor: colors.light.border,
  },
  filterChipActive: { backgroundColor: colors.olive[600], borderColor: colors.olive[600] },
  filterChipText: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.medium as any,
    color: colors.light.mutedForeground,
  },
  filterChipTextActive: { color: "#fff" },

  reviewsList: { paddingHorizontal: 24 },
  emptyCard: {
    alignItems: "center" as const, paddingVertical: 48, gap: 8,
    backgroundColor: colors.light.card, borderRadius: radii.xl,
    borderWidth: 1, borderColor: colors.light.border,
  },
  emptyTitle: {
    fontSize: typography.fontSizes.base,
    fontWeight: typography.fontWeights.semibold as any,
    color: colors.light.foreground,
  },
  emptySub: { fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground, textAlign: "center" as const },

  reviewCard: {
    backgroundColor: colors.light.card, borderRadius: radii.xl,
    borderWidth: 1, borderColor: colors.light.border,
    padding: 16, marginBottom: 12,
  },
  reviewHeader: {
    flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "flex-start" as const,
    marginBottom: 10,
  },
  reviewUserRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 10, flex: 1 },
  avatarPlaceholder: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.olive[100],
    justifyContent: "center" as const, alignItems: "center" as const,
  },
  avatarText: {
    fontSize: 13, fontWeight: typography.fontWeights.bold as any,
    color: colors.olive[700],
  },
  reviewerName: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold as any,
    color: colors.light.foreground,
  },
  reviewDate: { fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground },
  reviewRating: { flexDirection: "row" as const, gap: 1 },
  reviewTitle: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold as any,
    color: colors.light.foreground, marginBottom: 4,
  },
  reviewBody: {
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground, lineHeight: 20,
  },
  verifiedBadge: {
    flexDirection: "row" as const, alignItems: "center" as const, gap: 4,
    marginTop: 8,
  },
  verifiedText: {
    fontSize: typography.fontSizes.xs,
    color: colors.olive[600],
    fontWeight: typography.fontWeights.medium as any,
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
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 5,
  },
  replyCardLabel: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.semibold as any,
    color: colors.olive[700],
  },
  replyCardDate: {
    fontSize: 10,
    color: colors.light.mutedForeground,
    marginLeft: "auto" as const,
  },
  replyCardBody: {
    fontSize: typography.fontSizes.sm,
    color: colors.light.foreground,
    lineHeight: 19,
  },
  replyRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 10,
  },
  replyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.olive[600],
  },
  replyBtnLabel: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.medium as any,
    color: colors.olive[600],
  },
});
