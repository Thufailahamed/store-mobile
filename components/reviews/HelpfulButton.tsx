import React, { useState } from "react";
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { voteReviewHelpfulBackend } from "@/lib/api";
import { colors, radii, spacing, typography } from "@/lib/theme/tokens";

export interface HelpfulButtonProps {
  reviewId: string;
  initialVoted: boolean;
  initialCount: number;
}

/**
 * Toggle a helpful vote on a review. Optimistic update + rollback on
 * backend error. Mounted on store + product review rows.
 */
export function HelpfulButton({ reviewId, initialVoted, initialCount }: HelpfulButtonProps) {
  const [voted, setVoted] = useState(initialVoted);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);

  const onPress = async () => {
    if (busy) return;
    setBusy(true);
    // Optimistic toggle
    const wasVoted = voted;
    const prevCount = count;
    setVoted(!wasVoted);
    setCount(wasVoted ? Math.max(0, prevCount - 1) : prevCount + 1);
    try {
      const res = await voteReviewHelpfulBackend(reviewId);
      if (!res.ok) {
        // Rollback
        setVoted(wasVoted);
        setCount(prevCount);
      } else if (res.data?.helpful_count !== undefined) {
        setCount(res.data.helpful_count);
      }
    } catch {
      setVoted(wasVoted);
      setCount(prevCount);
    } finally {
      setBusy(false);
    }
  };

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={voted ? "Mark not helpful" : "Mark helpful"}
      onPress={onPress}
      style={[styles.pill, voted && styles.pillActive]}
      disabled={busy}
      activeOpacity={0.7}
    >
      {busy ? (
        <ActivityIndicator size="small" color={voted ? "#fff" : colors.light.mutedForeground} />
      ) : (
        <Ionicons
          name={voted ? "thumbs-up" : "thumbs-up-outline"}
          size={14}
          color={voted ? "#fff" : colors.light.mutedForeground}
        />
      )}
      <Text style={[styles.label, voted && styles.labelActive]}>
        {voted ? "Helpful" : "Helpful"} · {count}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing[3],
    paddingVertical: 6,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.light.card,
    alignSelf: "flex-start",
  },
  pillActive: {
    backgroundColor: colors.olive[600],
    borderColor: colors.olive[600],
  },
  label: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.medium as any,
    color: colors.light.mutedForeground,
  },
  labelActive: { color: "#fff" },
});
