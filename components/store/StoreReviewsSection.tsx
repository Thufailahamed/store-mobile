import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Body, MonoLabel } from "@/components/ui/Typography";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { colors, radii, spacing, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { StoreRatingSummary } from "./StoreRatingSummary";
import type { Review } from "@/lib/types";

interface StoreReviewsSectionProps {
  reviews: Review[];
  avg: number;
  total: number;
  breakdown: Record<number, number>;
}

function timeAgo(iso?: string): string {
  if (!iso) return "Recently";
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days < 1) return "Today";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export function StoreReviewsSection({ reviews, avg, total, breakdown }: StoreReviewsSectionProps) {
  return (
    <View style={styles.wrap}>
      <SectionHeader
        label="VOICES"
        title="What buyers are saying"
        description={`${total} verified reviews · ${avg ? avg.toFixed(1) : "—"} avg`}
      />
      <StoreRatingSummary avg={avg} total={total} breakdown={breakdown} />

      {reviews.length === 0 ? (
        <View style={{ marginTop: spacing[6] }}>
          <EmptyState
            icon="chatbubbles-outline"
            title="No reviews yet"
            description="Be the first to share your experience with this boutique."
          />
        </View>
      ) : (
        <View style={styles.list}>
          {reviews.map((r, i) => (
            <ReviewRow key={r.id ?? i} review={r} />
          ))}
        </View>
      )}
    </View>
  );
}

function ReviewRow({ review }: { review: Review }) {
  const productName =
    (review as any).product?.name ?? "Product";
  const productSlug = (review as any).product?.slug;
  const userName = (review as any).user?.full_name ?? "Verified buyer";
  const avatar = (review as any).user?.avatar_url;
  const rating = review.rating ?? 0;
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.avatar}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
          ) : (
            <Ionicons name="person" size={16} color={colors.olive[600]} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Body size="sm" style={styles.user}>{userName}</Body>
          <View style={styles.metaRow}>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((s) => (
                <Ionicons
                  key={s}
                  name={s <= rating ? "star" : "star-outline"}
                  size={11}
                  color={colors.accent2.ochre}
                />
              ))}
            </View>
            <View style={styles.dot} />
            <MonoLabel style={styles.time}>{timeAgo(review.created_at as any)}</MonoLabel>
          </View>
        </View>
        {review.is_verified_purchase && (
          <Ionicons name="checkmark-circle" size={14} color={colors.olive[600]} />
        )}
      </View>
      {review.title ? (
        <Body size="sm" style={styles.title}>{review.title}</Body>
      ) : null}
      {review.content ? (
        <Body size="sm" muted style={styles.body}>
          {review.content}
        </Body>
      ) : null}
      <View style={styles.productRow}>
        <Ionicons name="cube-outline" size={11} color={colors.olive[600]} />
        <Body size="xs" style={styles.productName} numberOfLines={1}>
          {productName}
        </Body>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingBottom: spacing[6],
  },
  list: {
    paddingHorizontal: spacing[5],
    marginTop: spacing[5],
    gap: spacing[3],
  },
  card: {
    backgroundColor: colors.light.card,
    borderRadius: radii["2xl"],
    padding: spacing[4],
    borderWidth: 1,
    borderColor: `${colors.olive[600]}10`,
    gap: spacing[2],
    ...shadows.soft,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.olive[100],
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  user: {
    fontFamily: fontFamilies.sans.semibold,
    color: colors.light.foreground,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  starsRow: {
    flexDirection: "row",
    gap: 1,
  },
  dot: {
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.light.mutedForeground,
  },
  time: {
    fontSize: 9,
    letterSpacing: 0.6,
    color: colors.light.mutedForeground,
  },
  title: {
    fontFamily: fontFamilies.sans.semibold,
    color: colors.light.foreground,
    marginTop: 2,
  },
  body: {
    lineHeight: 19,
  },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
    paddingTop: spacing[2],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: `${colors.olive[600]}15`,
  },
  productName: {
    color: colors.olive[700],
    fontFamily: fontFamilies.sans.medium,
    fontSize: 11,
  },
});
