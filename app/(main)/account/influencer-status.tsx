import React from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ScreenHeader } from "@/components/layout";
import { getInfluencerApplicationBackend } from "@/lib/api/backend";
import { colors, radii, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function InfluencerStatusScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const q = useQuery({
    queryKey: ["influencer-application"],
    queryFn: async () => {
      const r = await getInfluencerApplicationBackend();
      if (!r.ok) throw new Error(r.error);
      return r.data.application;
    },
  });

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 24 }]}>
      <ScreenHeader title="Influencer program" onBack={() => router.back()} />
      {q.isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} />
      ) : q.isError ? (
        <Text style={styles.body}>Couldn't load your application. Try again later.</Text>
      ) : !q.data ? (
        <Text style={styles.body}>You haven't applied yet. Apply from the web influencer page, then check back here.</Text>
      ) : (
        <View style={styles.card}>
          <Text style={styles.label}>Status</Text>
          <Text style={styles.status}>{q.data.status}</Text>
          <Text style={styles.body}>
            Applied {new Date(q.data.created_at).toLocaleDateString()}
            {q.data.audience_size ? ` · ${q.data.audience_size.toLocaleString()} audience` : ""}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  card: {
    margin: spacing[5],
    padding: spacing[5],
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.light.card,
    gap: 8,
  },
  label: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  status: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 22,
    color: colors.light.foreground,
    textTransform: "capitalize",
  },
  body: {
    margin: spacing[5],
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
    lineHeight: 20,
  },
});
