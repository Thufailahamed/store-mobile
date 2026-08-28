import React, { useState } from "react";
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { JobProgress } from "@/components/ai-studio/JobProgress";
import { getAiJobsBackend, type AiJobStatus } from "@/lib/api/backend";
import { colors, radii, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

const FILTERS: Array<{ key: AiJobStatus | "all"; label: string }> = [
  { key: "all", label: "All" },
  { key: "processing", label: "Processing" },
  { key: "succeeded", label: "Done" },
  { key: "failed", label: "Failed" },
];

export default function HistoryScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<AiJobStatus | "all">("all");
  const { data, isLoading } = useQuery({
    queryKey: ["ai-jobs", { limit: 50, status: filter === "all" ? undefined : filter }],
    queryFn: () => getAiJobsBackend({ limit: 50, status: filter === "all" ? undefined : filter }),
  });

  return (
    <View style={styles.container}>
      <View style={styles.chips}>
        {FILTERS.map((f) => (
          <Text
            key={f.key}
            onPress={() => setFilter(f.key)}
            accessibilityRole="button"
            accessibilityLabel={`Filter ${f.label}`}
            style={[styles.chip, filter === f.key && styles.chipActive]}
          >
            {f.label}
          </Text>
        ))}
      </View>
      {isLoading ? <ActivityIndicator style={{ marginTop: spacing[4] }} /> : null}
      <FlatList
        data={data?.ok ? data.data.jobs : []}
        keyExtractor={(j) => j.id}
        renderItem={({ item }) => (
          <JobProgress job={item} onPress={() => router.push(`/(seller)/ai-studio/${item.id}` as any)} />
        )}
        ListEmptyComponent={!isLoading ? <Text style={styles.empty}>No jobs.</Text> : null}
        contentContainerStyle={{ paddingBottom: spacing[8] }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background, paddingTop: spacing[3] },
  chips: { flexDirection: "row", gap: spacing[2], paddingHorizontal: spacing[4], marginBottom: spacing[3] },
  chip: { paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radii.full, borderWidth: 1, borderColor: colors.light.border, fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.sm, color: colors.light.foreground, overflow: "hidden" },
  chipActive: { backgroundColor: colors.light.primary + "15", borderColor: colors.light.primary, color: colors.light.primary, fontFamily: fontFamilies.sans.semibold },
  empty: { fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground, textAlign: "center", padding: spacing[8] },
});
