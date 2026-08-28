import React from "react";
import { ScrollView, View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { getAiPricingBackend } from "@/lib/api/backend";
import { formatPrice } from "@/lib/utils";
import { colors, radii, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

export default function PricingScreen() {
  const { data, isLoading } = useQuery({ queryKey: ["ai-pricing"], queryFn: getAiPricingBackend });

  if (isLoading) return <View style={styles.center}><ActivityIndicator accessibilityLabel="Loading pricing" /></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Pricing</Text>
      {data?.ok ? (
        <>
          <Text style={styles.usage}>This period: {data.data.usageThisPeriod} credits used</Text>
          {data.data.plans.map((p) => (
            <View key={p.id} style={[styles.card, data.data.currentPlanId === p.id && styles.cardActive]}>
              <Text style={styles.planName}>{p.name}</Text>
              <Text style={styles.planPrice}>{formatPrice(p.priceCents / 100, p.currency)} / mo</Text>
              <Text style={styles.planCredits}>{p.credits} credits</Text>
              {data.data.currentPlanId === p.id ? <Text style={styles.current}>Current plan</Text> : null}
            </View>
          ))}
        </>
      ) : (
        <Text style={styles.error}>Failed to load pricing.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: spacing[5], gap: spacing[3] },
  heading: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.lg, color: colors.light.foreground },
  usage: { fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground },
  card: { padding: spacing[4], backgroundColor: colors.light.card, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.light.border, gap: spacing[1] },
  cardActive: { borderColor: colors.light.primary, backgroundColor: colors.light.primary + "08" },
  planName: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.md, color: colors.light.foreground },
  planPrice: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.lg, color: colors.light.primary },
  planCredits: { fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground },
  current: { fontFamily: fontFamilies.sans.medium, fontSize: typography.fontSizes.xs, color: colors.light.primary, marginTop: spacing[2] },
  error: { fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.sm, color: colors.light.destructive },
});
