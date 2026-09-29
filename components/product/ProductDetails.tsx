import React, { useState } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui";
import { Display, Label, Body } from "@/components/ui/Typography";
import { Button } from "@/components/ui";
import { colors, spacing, radii, shadows, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import type { Product, Review } from "@/lib/types";
import { HelpfulButton } from "@/components/reviews/HelpfulButton";

type Tab = "description" | "specs" | "reviews";

interface ProductDetailsProps {
  product: Product;
  reviews: Review[];
  onWriteReview?: () => void;
}

export function ProductDetails({ product, reviews, onWriteReview }: ProductDetailsProps) {
  const [tab, setTab] = useState<Tab>("description");

  const reviewCount = reviews.length || product.total_reviews;
  const avgRating = reviews.length > 0
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : product.rating;

  const breakdown: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  reviews.forEach((r) => {
    const k = Math.max(1, Math.min(5, Math.round(r.rating)));
    breakdown[k]++;
  });

  const specs = [
    { k: "Material", v: product.material },
    { k: "Fit", v: product.fit },
    { k: "Pattern", v: product.pattern },
    { k: "Sleeve", v: product.sleeve },
    { k: "Occasion", v: product.occasion },
    { k: "Season", v: product.season },
    { k: "Care", v: product.care_instructions },
    { k: "SKU", v: product.sku },
  ].filter((x): x is { k: string; v: string } => !!x.v);

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "description", label: "Description" },
    { key: "specs", label: "Specs" },
    { key: "reviews", label: "Reviews", count: reviewCount },
  ];
  // Q&A has its own section further down the page, so no tab for it here.
  const visibleTabs = specs.length > 0 ? tabs : tabs.filter((t) => t.key !== "specs");

  return (
    <View style={styles.container}>
      {/* Section header */}
      <View style={styles.sectionHeader}>
        <Label style={styles.kicker}>THE DETAILS</Label>
        <Display size="xl">About this piece</Display>
      </View>

      {/* Tab bar — segmented control */}
      <View style={styles.tabBar}>
        {visibleTabs.map((t) => {
          const active = tab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setTab(t.key)}
              activeOpacity={0.8}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Body size="sm" style={[styles.tabText, active && styles.tabTextActive]}>
                {t.label}
                {typeof t.count === "number" && t.count > 0 ? ` (${t.count})` : ""}
              </Body>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Tab content */}
      <View style={styles.tabContent}>
        {tab === "description" && (
          <DescriptionTab product={product} />
        )}
        {tab === "specs" && (
          <SpecsTab specs={specs} />
        )}
        {tab === "reviews" && (
          <ReviewsTab
            reviews={reviews}
            avgRating={avgRating}
            reviewCount={reviewCount}
            breakdown={breakdown}
            onWriteReview={onWriteReview}
          />
        )}
      </View>
    </View>
  );
}

/* ─── Description Tab ─── */
function DescriptionTab({ product }: { product: Product }) {
  return (
    <View style={styles.descContainer}>
      {product.description ? (
        <Body style={styles.descText}>{product.description}</Body>
      ) : (
        <Body muted size="sm">The seller hasn't added a description yet.</Body>
      )}

      {/* Specs list */}
      <View style={styles.specsList}>
        {[
          { k: "Material", v: product.material },
          { k: "Fit", v: product.fit },
          { k: "Pattern", v: product.pattern },
          { k: "Care", v: product.care_instructions },
        ].filter((x) => x.v).map((x) => (
          <View key={x.k} style={styles.specRow}>
            <Label style={styles.specKey}>{x.k}</Label>
            <Body size="sm">{x.v}</Body>
          </View>
        ))}
      </View>

    </View>
  );
}

/* ─── Specs Tab ─── */
function SpecsTab({ specs }: { specs: { k: string; v: string }[] }) {
  return (
    <View style={styles.specsContainer}>
      {specs.map((s, i) => (
        <View
          key={s.k}
          style={[
            styles.specsRow,
            i % 2 === 0 && styles.specsRowEven,
            i === specs.length - 1 && styles.specsRowLast
          ]}
        >
          <Label style={styles.specsKey}>{s.k}</Label>
          <Body size="sm" style={styles.specsValue}>{s.v}</Body>
        </View>
      ))}
    </View>
  );
}

/* ─── Reviews Tab ─── */
function ReviewsTab({
  reviews,
  avgRating,
  reviewCount,
  breakdown,
  onWriteReview,
}: {
  reviews: Review[];
  avgRating: number;
  reviewCount: number;
  breakdown: Record<number, number>;
  onWriteReview?: () => void;
}) {
  if (reviewCount === 0) {
    return (
      <View style={styles.emptyReviews}>
        <Ionicons name="chatbubble-ellipses-outline" size={40} color={colors.light.mutedForeground} />
        <Display size="lg">No reviews yet</Display>
        <Body muted size="sm">Be the first to share your thoughts on this piece.</Body>
        <Button variant="brand" size="sm" onPress={onWriteReview}>
          Write a review
        </Button>
      </View>
    );
  }

  return (
    <View style={styles.reviewsContainer}>
      {/* Rating summary */}
      <View style={styles.ratingSummary}>
        <View style={styles.ratingLeft}>
          <Display size="4xl">{avgRating.toFixed(1)}</Display>
          <View style={styles.summaryStars}>
            {[1, 2, 3, 4, 5].map((s) => (
              <Ionicons
                key={s}
                name={s <= Math.round(avgRating) ? "star" : "star-outline"}
                size={14}
                color={s <= Math.round(avgRating) ? colors.olive[600] : colors.light.border}
              />
            ))}
          </View>
          <Body size="sm" muted>{reviewCount} reviews</Body>
        </View>
        <View style={styles.ratingRight}>
          {[5, 4, 3, 2, 1].map((star) => {
            const count = breakdown[star] || 0;
            const pct = reviewCount > 0 ? (count / reviewCount) * 100 : 0;
            return (
              <View key={star} style={styles.barRow}>
                <Body size="xs" style={styles.barLabel}>{star}</Body>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${pct}%` }]} />
                </View>
                <Body size="xs" muted style={styles.barCount}>{count}</Body>
              </View>
            );
          })}
        </View>
      </View>

      {/* Write review */}
      <Button variant="outline" size="sm" onPress={onWriteReview} style={styles.writeBtn}>
        <Ionicons name="pencil" size={14} color={colors.light.primary} />
        <Label style={styles.writeBtnText}>Write a review</Label>
      </Button>

      {/* Review cards */}
      <View style={styles.reviewList}>
        {reviews.slice(0, 8).map((r) => (
          <View key={r.id} style={styles.reviewCard}>
            <View style={styles.reviewHeader}>
              <Avatar
                name={r.user?.full_name || "U"}
                uri={r.user?.avatar_url}
                size={32}
              />
              <View style={styles.reviewMeta}>
                <Body size="sm" style={styles.reviewAuthor}>{r.user?.full_name || "Member"}</Body>
                <View style={styles.reviewStars}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Ionicons
                      key={i}
                      name={i < r.rating ? "star" : "star-outline"}
                      size={10}
                      color={i < r.rating ? colors.olive[600] : colors.light.border}
                    />
                  ))}
                </View>
              </View>
              {r.is_verified_purchase && (
                <View style={styles.verifiedTag}>
                  <Ionicons name="checkmark-circle" size={10} color={colors.olive[600]} />
                  <Label style={styles.verifiedTagText}>Verified</Label>
                </View>
              )}
            </View>
            {r.title ? (
              <Body size="sm" style={styles.reviewTitle}>{r.title}</Body>
            ) : null}
            {r.content ? (
              <Body muted size="sm" style={styles.reviewContent}>{r.content}</Body>
            ) : null}
            <View style={styles.helpfulRow}>
              <HelpfulButton
                reviewId={r.id}
                initialVoted={Boolean((r as any).user_voted_helpful)}
                initialCount={r.helpful_count ?? 0}
              />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[4],
  },
  sectionHeader: {
    paddingHorizontal: spacing[5],
    gap: spacing[1],
  },
  kicker: {
    color: colors.olive[600],
  },
  tabBar: {
    flexDirection: "row",
    marginHorizontal: spacing[5],
    padding: 4,
    gap: 4,
    borderRadius: radii.full,
    backgroundColor: `${colors.olive[900]}0D`,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 9,
    borderRadius: radii.full,
  },
  tabActive: {
    backgroundColor: colors.light.card,
    ...shadows.soft,
  },
  tabText: {
    color: colors.light.mutedForeground,
    fontFamily: fontFamilies.sans.medium,
    fontSize: 13,
  },
  tabTextActive: {
    color: colors.light.foreground,
    fontFamily: fontFamilies.sans.semibold,
  },
  tabContent: {
    paddingHorizontal: spacing[5],
  },

  /* Description */
  descContainer: {
    gap: spacing[5],
  },
  descText: {
    lineHeight: 23,
    color: colors.light.foreground,
    opacity: 0.85,
  },
  specsList: {
    gap: 0,
  },
  specRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: `${colors.light.primary}15`,
    gap: spacing[3],
  },
  specKey: {
    color: colors.light.mutedForeground,
    minWidth: 80,
  },

  /* Specs */
  specsContainer: {
    gap: 0,
  },
  specsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: `${colors.light.primary}10`,
    gap: spacing[3],
    alignItems: "center",
  },
  specsRowEven: {
    backgroundColor: `${colors.light.primary}05`,
  },
  specsRowLast: {
    borderBottomWidth: 0,
  },
  specsKey: {
    color: colors.light.mutedForeground,
    minWidth: 90,
  },
  specsValue: {
    flex: 1,
    textAlign: "right",
  },

  /* Reviews */
  reviewsContainer: {
    gap: spacing[5],
  },
  ratingSummary: {
    flexDirection: "row",
    gap: spacing[5],
  },
  ratingLeft: {
    alignItems: "center",
    gap: 4,
    minWidth: 80,
  },
  summaryStars: {
    flexDirection: "row",
    gap: 1,
  },
  ratingRight: {
    flex: 1,
    gap: 4,
    justifyContent: "center",
  },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  barLabel: {
    width: 12,
    textAlign: "right",
    color: colors.light.mutedForeground,
  },
  barTrack: {
    flex: 1,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: `${colors.olive[600]}15`,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    backgroundColor: colors.accent2.ochre,
    borderRadius: 2.5,
  },
  barCount: {
    width: 20,
    textAlign: "right",
  },
  writeBtn: {
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: 6,
  },
  writeBtnText: {
    color: colors.light.primary,
  },
  reviewList: {
    gap: spacing[3],
  },
  reviewCard: {
    backgroundColor: colors.light.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: `${colors.olive[600]}15`,
    padding: spacing[4],
    gap: spacing[2.5],
    ...shadows.soft,
  },
  reviewHeader: {
    flexDirection: "row",
    gap: spacing[2],
    alignItems: "center",
  },
  reviewMeta: {
    flex: 1,
    gap: 2,
  },
  reviewAuthor: {
    fontFamily: fontFamilies.sans.semibold,
    color: colors.light.foreground,
  },
  reviewStars: {
    flexDirection: "row",
    gap: 1,
  },
  verifiedTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: `${colors.olive[600]}10`,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  verifiedTagText: {
    color: colors.olive[600],
    fontSize: 9,
  },
  reviewTitle: {
    fontWeight: "600",
    marginTop: 2,
  },
  reviewContent: {
    lineHeight: 20,
  },
  helpfulRow: {
    marginTop: spacing[2],
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  emptyReviews: {
    alignItems: "center",
    gap: spacing[3],
    paddingVertical: spacing[8],
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: `${colors.light.primary}20`,
    borderRadius: radii.xl,
  },
});
