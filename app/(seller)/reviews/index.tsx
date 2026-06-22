import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { useAuth } from "@/lib/supabase/auth";
import { getSellerStore, getStoreReviews } from "@/lib/api";
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

  const fetchData = useCallback(async () => {
    if (!user) return;
    const storeRes = await getSellerStore(user.id);
    if (storeRes.ok && storeRes.data) {
      const res = await getStoreReviews(storeRes.data.id, {
        rating: filterRating || undefined,
      });
      if (res.ok) setData(res.data);
    }
    setLoading(false);
    setRefreshing(false);
  }, [user, filterRating]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <View style={s.loadingWrap}>
        <Ionicons name="star-outline" size={32} color={colors.light.mutedForeground} />
        <Text style={s.loadingText}>Loading reviews...</Text>
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
          <Text style={s.kicker}>REVIEWS</Text>
          <Text style={s.heroTitle}>Customer Reviews</Text>
          <Text style={s.heroSub}>{data?.total ?? 0} reviews across your store</Text>
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
        {(data?.reviews ?? []).length === 0 ? (
          <View style={s.emptyCard}>
            <Ionicons name="chatbubble-ellipses-outline" size={32} color={colors.light.mutedForeground} />
            <Text style={s.emptyTitle}>No reviews found</Text>
            <Text style={s.emptySub}>Reviews from customers will appear here</Text>
          </View>
        ) : (
          (data?.reviews ?? []).map((review) => (
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
            </View>
          ))
        )}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  content: { paddingBottom: 20 },
  loadingWrap: { flex: 1, justifyContent: "center" as const, alignItems: "center" as const, gap: 12, backgroundColor: colors.light.background },
  loadingText: { fontSize: typography.fontSizes.base, color: colors.light.mutedForeground },

  header: { position: "relative" as const, marginBottom: 20 },
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
});
