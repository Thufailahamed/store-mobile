import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { colors, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { HelpfulButton } from "@/components/reviews/HelpfulButton";
import type { Review } from "@/lib/types";

interface StoreReviewsSectionProps {
  reviews: Review[];
  avg: number;
  total: number;
  breakdown: Record<number, number>;
}

function timeAgo(iso?: string): string {
  if (!iso) return "RECENTLY";
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days < 1) return "TODAY";
  if (days < 7) return `${days}D AGO`;
  if (days < 30) return `${Math.floor(days / 7)}W AGO`;
  return `${Math.floor(days / 30)}MO AGO`;
}

function Stars({ rating, size }: { rating: number; size: number }) {
  return (
    <View style={styles.stars}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Ionicons key={s} name={s <= rating ? "star" : "star-outline"} size={size} color={colors.accent2.ochre} />
      ))}
    </View>
  );
}

/** Buyer reviews in the masthead's editorial language: ruled summary, column-style entries. */
export function StoreReviewsSection({ reviews, avg, total, breakdown }: StoreReviewsSectionProps) {
  const max = Math.max(1, ...Object.values(breakdown).map((v) => v || 0));

  return (
    <View style={styles.wrap}>
      <View style={styles.kickerRow}>
        <View style={styles.kickerRule} />
        <Text style={styles.kicker}>VOICES</Text>
      </View>
      <Text style={styles.title}>
        What buyers <Text style={styles.titleItalic}>are saying</Text>
      </Text>

      {total > 0 ? (
        <>
          <View style={styles.ruleThick} />
          <View style={styles.ruleThin} />
          <View style={styles.summary}>
            <View style={styles.summaryLeft}>
              <Text style={styles.avg}>{avg.toFixed(1)}</Text>
              <Stars rating={Math.round(avg)} size={13} />
              <Text style={styles.mono}>
                {total} REVIEW{total === 1 ? "" : "S"}
              </Text>
            </View>
            <View style={styles.bars}>
              {[5, 4, 3, 2, 1].map((stars) => {
                const count = breakdown[stars] ?? 0;
                return (
                  <View key={stars} style={styles.barRow}>
                    <Text style={styles.barLabel}>{stars}</Text>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { width: `${(count / max) * 100}%` }]} />
                    </View>
                    <Text style={styles.barCount}>{count}</Text>
                  </View>
                );
              })}
            </View>
          </View>
          <View style={styles.ruleThin} />
        </>
      ) : null}

      {reviews.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyMark}>“</Text>
          <Text style={styles.emptyTitle}>
            No reviews <Text style={styles.titleItalic}>yet</Text>
          </Text>
          <Text style={styles.emptyBody}>
            This boutique's first buyers will write the opening lines. Order a piece and share how it wears.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {reviews.map((r, i) => (
            <ReviewEntry key={r.id ?? i} review={r} first={i === 0 && total > 0} />
          ))}
        </View>
      )}
    </View>
  );
}

function ReviewEntry({ review, first }: { review: Review; first: boolean }) {
  const extra = review as Review & {
    product?: { name?: string };
    user?: { full_name?: string };
    user_voted_helpful?: boolean;
  };
  const userName = extra.user?.full_name ?? "Verified buyer";
  const productName = extra.product?.name;

  return (
    <View style={[styles.entry, first && { borderTopWidth: 0 }]}>
      <View style={styles.entryMeta}>
        <Stars rating={review.rating ?? 0} size={11} />
        <Text style={styles.mono}>{timeAgo(review.created_at as string | undefined)}</Text>
      </View>
      {review.title ? <Text style={styles.entryTitle}>{review.title}</Text> : null}
      {review.content ? <Text style={styles.entryBody}>{review.content}</Text> : null}
      <View style={styles.byline}>
        <Text style={styles.bylineName} numberOfLines={1}>
          — {userName}
          {review.is_verified_purchase ? <Text style={styles.verified}>  ·  VERIFIED BUYER</Text> : null}
        </Text>
        <HelpfulButton
          reviewId={review.id}
          initialVoted={Boolean(extra.user_voted_helpful)}
          initialCount={review.helpful_count ?? 0}
        />
      </View>
      {productName ? (
        <Text style={styles.product} numberOfLines={1}>
          ON {productName.toUpperCase()}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing[4], paddingTop: spacing[6], paddingBottom: spacing[6] },

  kickerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  kickerRule: { width: 22, height: 1, backgroundColor: colors.accent2.ochre },
  kicker: { fontFamily: fontFamilies.sans.bold, fontSize: 10, letterSpacing: 2.6, color: colors.accent2.ochre },
  title: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.8,
    color: colors.ink.DEFAULT,
    marginTop: 6,
  },
  titleItalic: { fontFamily: fontFamilies.display.italic, color: colors.olive[600] },

  ruleThick: { height: 1.5, backgroundColor: colors.ink.DEFAULT, marginTop: spacing[5] },
  ruleThin: { height: StyleSheet.hairlineWidth, backgroundColor: colors.ink.DEFAULT, opacity: 0.5, marginTop: 3 },
  summary: { flexDirection: "row", gap: spacing[5], paddingVertical: spacing[4] },
  summaryLeft: { gap: 6, justifyContent: "center" },
  avg: { fontFamily: fontFamilies.display.regular, fontSize: 56, lineHeight: 60, letterSpacing: -2, color: colors.ink.DEFAULT },
  stars: { flexDirection: "row", gap: 2 },
  mono: { fontFamily: fontFamilies.mono.medium, fontSize: 9.5, letterSpacing: 1.2, color: colors.ink.mute },
  bars: { flex: 1, justifyContent: "center", gap: 7 },
  barRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  barLabel: { width: 10, fontFamily: fontFamilies.mono.medium, fontSize: 10, color: colors.ink.mute },
  barTrack: { flex: 1, height: 2, backgroundColor: "rgba(22,23,15,0.1)" },
  barFill: { height: 2, backgroundColor: colors.ink.DEFAULT },
  barCount: { width: 22, textAlign: "right", fontFamily: fontFamilies.mono.medium, fontSize: 10, color: colors.ink.mute },

  empty: {
    marginTop: spacing[6],
    paddingVertical: spacing[8],
    alignItems: "center",
    borderTopWidth: 1.5,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.ink.DEFAULT,
  },
  emptyMark: {
    fontFamily: fontFamilies.display.italic,
    fontSize: 72,
    lineHeight: 80,
    marginBottom: -26,
    color: colors.accent2.ochre,
  },
  emptyTitle: { fontFamily: fontFamilies.display.regular, fontSize: 26, letterSpacing: -0.5, color: colors.ink.DEFAULT },
  emptyBody: {
    marginTop: spacing[2],
    maxWidth: 290,
    textAlign: "center",
    fontFamily: fontFamilies.display.italic,
    fontSize: 15.5,
    lineHeight: 23,
    color: colors.ink.mute,
  },

  list: { marginTop: spacing[2] },
  entry: {
    paddingVertical: spacing[5],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(22,23,15,0.16)",
    gap: spacing[2],
  },
  entryMeta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  entryTitle: { fontFamily: fontFamilies.display.regular, fontSize: 20, lineHeight: 26, color: colors.ink.DEFAULT },
  entryBody: { fontFamily: fontFamilies.sans.regular, fontSize: 14.5, lineHeight: 22, color: colors.ink.soft },
  byline: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing[3], marginTop: 2 },
  bylineName: { flex: 1, fontFamily: fontFamilies.display.italic, fontSize: 14.5, color: colors.ink.DEFAULT },
  verified: { fontFamily: fontFamilies.mono.medium, fontSize: 9, letterSpacing: 1, color: colors.olive[600] },
  product: { fontFamily: fontFamilies.mono.medium, fontSize: 9.5, letterSpacing: 1.1, color: colors.olive[600] },
});
