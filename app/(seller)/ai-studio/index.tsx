import React from "react";
import { ScrollView, View, Text, Pressable, StyleSheet, ActivityIndicator, Linking } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { WalletCard } from "@/components/ai-studio/WalletCard";
import { JobProgress } from "@/components/ai-studio/JobProgress";
import {
  getAiWalletBackend,
  getAiJobsBackend,
  createAiWalletTopupBackend,
} from "@/lib/api/backend";
import { colors, radii, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

const TILES = [
  { key: "generate", label: "Generate", route: "/(seller)/ai-studio/generate" },
  { key: "history", label: "History", route: "/(seller)/ai-studio/history" },
  { key: "library", label: "Library", route: "/(seller)/ai-studio/library" },
  { key: "pricing", label: "Pricing", route: "/(seller)/ai-studio/pricing" },
];

export default function AiStudioHub() {
  const router = useRouter();
  const wallet = useQuery({ queryKey: ["ai-wallet"], queryFn: getAiWalletBackend });
  const recent = useQuery({ queryKey: ["ai-jobs", { limit: 3 }], queryFn: () => getAiJobsBackend({ limit: 3 }) });

  if (wallet.isLoading) {
    return <View style={styles.center}><ActivityIndicator accessibilityLabel="Loading AI Studio" /></View>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: spacing[8] }}>
      {wallet.data?.ok ? (
        <WalletCard
          wallet={wallet.data.data.wallet}
          onTopUp={async () => {
            const res = await createAiWalletTopupBackend({ amount: 20 });
            if (res.ok && res.data.checkoutUrl) Linking.openURL(res.data.checkoutUrl);
          }}
        />
      ) : null}
      <View style={styles.tiles}>
        {TILES.map((t) => (
          <Pressable
            key={t.key}
            accessibilityLabel={t.label}
            accessibilityRole="button"
            onPress={() => router.push(t.route as any)}
            style={styles.tile}
          >
            <Text style={styles.tileLabel}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.sectionHeading}>Recent jobs</Text>
      {(recent.data?.ok ? recent.data.data.jobs : []).map((j) => (
        <JobProgress key={j.id} job={j} onPress={() => router.push(`/(seller)/ai-studio/${j.id}` as any)} />
      ))}
      {recent.data?.ok && recent.data.data.jobs.length === 0 ? (
        <Text style={styles.empty}>No jobs yet — generate your first image.</Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: spacing[3], paddingHorizontal: spacing[4] },
  tile: { flexBasis: "47%", padding: spacing[4], backgroundColor: colors.light.card, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.light.border },
  tileLabel: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.md, color: colors.light.foreground },
  sectionHeading: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.md, color: colors.light.foreground, paddingHorizontal: spacing[4], paddingTop: spacing[4], paddingBottom: spacing[2] },
  empty: { fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground, padding: spacing[4], textAlign: "center" },
});
