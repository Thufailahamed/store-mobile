import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import type { AiJob, AiJobStatus } from "@/lib/api/backend";
import { colors, radii, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

const STATUS_COLORS: Record<AiJobStatus, string> = {
  pending: colors.light.mutedForeground,
  processing: colors.light.primary,
  succeeded: "#16A34A",
  failed: colors.light.destructive,
  cancelled: colors.light.mutedForeground,
};

const STATUS_LABEL: Record<AiJobStatus, string> = {
  pending: "Queued",
  processing: "Generating",
  succeeded: "Done",
  failed: "Failed",
  cancelled: "Cancelled",
};

const STATUS_PROGRESS: Record<AiJobStatus, number> = {
  pending: 10,
  processing: 60,
  succeeded: 100,
  failed: 100,
  cancelled: 0,
};

interface Props {
  job: AiJob;
  onPress?: () => void;
}

export function JobProgress({ job, onPress }: Props) {
  const tone = STATUS_COLORS[job.status];
  const pct = STATUS_PROGRESS[job.status];
  return (
    <Pressable onPress={onPress} accessibilityLabel={`Job ${STATUS_LABEL[job.status]}`} accessibilityRole="button" style={styles.row}>
      <View style={styles.header}>
        <Text style={styles.prompt} numberOfLines={1}>{job.prompt}</Text>
        <Text style={[styles.status, { color: tone }]}>{STATUS_LABEL[job.status]}</Text>
      </View>
      <View style={styles.barBg}>
        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: tone }]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: spacing[4], paddingVertical: spacing[3], marginHorizontal: spacing[4], marginVertical: spacing[1], backgroundColor: colors.light.card, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.light.border },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing[2], marginBottom: spacing[2] },
  prompt: { flex: 1, fontFamily: fontFamilies.sans.medium, fontSize: typography.fontSizes.sm, color: colors.light.foreground },
  status: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.xs },
  barBg: { height: 4, borderRadius: 2, backgroundColor: colors.light.muted, overflow: "hidden" },
  barFill: { height: 4, borderRadius: 2 },
});
