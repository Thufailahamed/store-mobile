import React from "react";
import { View, Text, StyleSheet, Share, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ScreenHeader } from "@/components/layout";
import { Button } from "@/components/ui";
import { getReferralInfo } from "@/lib/api";
import { colors, radii, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ReferralsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const q = useQuery({
    queryKey: ["referral-info"],
    queryFn: async () => {
      const r = await getReferralInfo();
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
  });

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 24 }]}>
      <ScreenHeader title="Referrals" onBack={() => router.back()} />
      {q.isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} />
      ) : q.isError || !q.data ? (
        <Text style={styles.body}>Couldn't load your referral code. Try again later.</Text>
      ) : (
        <View style={styles.card}>
          <Text style={styles.label}>Your code</Text>
          <Text style={styles.code}>{q.data.code}</Text>
          <Text style={styles.body}>
            Share this with friends. {q.data.uses ? `${q.data.uses} uses so far.` : "They get a welcome perk when they shop."}
          </Text>
          <Button
            onPress={() =>
              Share.share({
                message: `Shop LUXE with my code ${q.data.code}${q.data.shareUrl ? ` — ${q.data.shareUrl}` : ""}`,
                url: q.data.shareUrl,
              })
            }
          >
            Share code
          </Button>
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
    backgroundColor: colors.light.card,
    borderRadius: radii.lg,
    gap: spacing[3],
  },
  label: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  code: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 28,
    color: colors.light.foreground,
    letterSpacing: 2,
  },
  body: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
    marginHorizontal: spacing[5],
    marginTop: spacing[4],
  },
});
