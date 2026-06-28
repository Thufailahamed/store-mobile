import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { BrandScreenHeader } from "@/components/brand/BrandScreenHeader";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { getBrandReviews } from "@/lib/api";
import type { BrandReview } from "@/lib/api/backend";
import { colors, typography, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

export default function BrandReviews() {
  const q = useQuery({
    queryKey: ["brand-reviews"],
    queryFn: async () => {
      const r = await getBrandReviews();
      return r.ok ? r.data : [];
    },
  });

  const avg = q.data && q.data.length > 0
    ? q.data.reduce((acc, r) => acc + r.rating, 0) / q.data.length
    : 0;
  const distribution = q.data
    ? bucketRatings(q.data)
    : [0, 0, 0, 0, 0];

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <BrandScreenHeader
        eyebrow="Brand HQ"
        title="Reviews"
        subtitle={`${q.data?.length ?? 0} total`}
        back={{ onPress: () => router.back() }}
      />
      {q.isLoading ? (
        <Skeleton style={styles.skel} />
      ) : !q.data || q.data.length === 0 ? (
        <EmptyState icon="star-outline" title="No reviews yet" description="Customer reviews will appear here once they arrive." />
      ) : (
        <>
          <Card style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View>
                <Text style={styles.avgValue}>{avg.toFixed(1)}</Text>
                <Text style={styles.avgLabel}>Average rating</Text>
              </View>
              <View style={styles.dist}>
                {distribution.map((count, i) => (
                  <View key={i} style={styles.distRow}>
                    <Text style={styles.distLabel}>{5 - i}★</Text>
                    <View style={styles.distBar}>
                      <View style={[styles.distFill, { width: `${q.data ? (count / q.data.length) * 100 : 0}%` }]} />
                    </View>
                    <Text style={styles.distCount}>{count}</Text>
                  </View>
                ))}
              </View>
            </View>
          </Card>

          <Text style={styles.sectionTitle}>Recent reviews</Text>
          {q.data.map((r) => <ReviewCard key={r.id} review={r} />)}
        </>
      )}
    </ScrollView>
  );
}

function bucketRatings(reviews: BrandReview[]): [number, number, number, number, number] {
  const out: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  reviews.forEach((r) => {
    const idx = 5 - Math.round(r.rating);
    if (idx >= 0 && idx <= 4) out[idx] += 1;
  });
  return out;
}

function ReviewCard({ review }: { review: BrandReview }) {
  return (
    <Card style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <Text style={styles.stars}>{"★".repeat(Math.round(review.rating))}{"☆".repeat(5 - Math.round(review.rating))}</Text>
        <Text style={styles.reviewProduct}>{review.product?.name ?? "—"}</Text>
      </View>
      {review.comment ? <Text style={styles.reviewBody}>{review.comment}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.light.background },
  content: { paddingBottom: 32 },
  skel: { height: 120, margin: 20, borderRadius: radii.xl },
  summaryCard: { marginHorizontal: 20, padding: 16 },
  summaryRow: { flexDirection: "row", gap: 20, alignItems: "center" },
  avgValue: { fontFamily: fontFamilies.display.semibold, fontSize: typography.fontSizes["4xl"], color: colors.light.foreground },
  avgLabel: { fontFamily: fontFamilies.mono.medium, fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground, textTransform: "uppercase", letterSpacing: typography.letterSpacing.editorial },
  dist: { flex: 1, gap: 4 },
  distRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  distLabel: { fontFamily: fontFamilies.mono.regular, fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground, width: 24 },
  distBar: { flex: 1, height: 4, backgroundColor: colors.light.muted, borderRadius: 2, overflow: "hidden" as const },
  distFill: { height: 4, backgroundColor: colors.light.primary },
  distCount: { fontFamily: fontFamilies.mono.regular, fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground, width: 20, textAlign: "right" },
  sectionTitle: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    letterSpacing: typography.letterSpacing.editorial,
    textTransform: "uppercase",
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 8,
  },
  reviewCard: { marginHorizontal: 20, marginBottom: 8, padding: 14, gap: 6 },
  reviewHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  stars: { fontFamily: fontFamilies.mono.medium, fontSize: typography.fontSizes.sm, color: colors.light.primary, letterSpacing: 2 },
  reviewProduct: { fontFamily: fontFamilies.sans.medium, fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground, flex: 1, textAlign: "right" },
  reviewBody: { fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.sm, color: colors.light.foreground, lineHeight: 18 },
});
