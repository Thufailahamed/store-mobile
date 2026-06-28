import React from "react";
import { ScrollView, View, Text, StyleSheet } from "react-native";
import { BrandScreenHeader } from "@/components/brand/BrandScreenHeader";
import { Ionicons } from "@/components/ui/Icon";
import { Card } from "@/components/ui/Card";
import { colors, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

export default function BrandShippingInfo() {
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <BrandScreenHeader
        eyebrow="Brand HQ"
        title="Shipping"
        subtitle="How brands ship with LUXE"
        back={{ onPress: () => require("expo-router").router.back(), label: "More" }}
      />
      <Text style={styles.intro}>
        Brands don't ship directly. Each retailer that lists your products owns shipping —
        carriers, zones, and delivery timelines are configured per-store.
      </Text>

      <View style={styles.grid}>
        <InfoCard
          icon="car-outline"
          title="Per-store carriers"
          body="Retailers pick their own couriers (DHL, FedEx, local partners). Brand-level carrier settings don't exist by design."
        />
        <InfoCard
          icon="globe-outline"
          title="Zone coverage"
          body="Each store defines which regions it serves. Your brand sees a single combined catalogue at checkout."
        />
        <InfoCard
          icon="time-outline"
          title="Cut-off times"
          body="Stores set same-day order cut-offs. You don't configure these — but you can view delivery promise per product."
        />
      </View>

      <Card style={styles.footCard}>
        <Text style={styles.footTitle}>Need a custom shipping policy?</Text>
        <Text style={styles.footBody}>
          Reach out to your retailer partners directly. Brand-level shipping policies are not yet supported on mobile.
        </Text>
      </Card>
    </ScrollView>
  );
}

function InfoCard({ icon, title, body }: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }) {
  return (
    <Card style={styles.infoCard}>
      <Ionicons name={icon} size={24} color={colors.light.primary} />
      <Text style={styles.infoTitle}>{title}</Text>
      <Text style={styles.infoBody}>{body}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.light.background },
  content: { paddingBottom: 32 },
  intro: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    lineHeight: 20,
  },
  grid: { paddingHorizontal: 20, gap: 12 },
  infoCard: { padding: 16, gap: 8 },
  infoTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.base,
    color: colors.light.foreground,
  },
  infoBody: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
    lineHeight: 18,
  },
  footCard: { margin: 20, padding: 16, gap: 4 },
  footTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.sm,
    color: colors.light.foreground,
  },
  footBody: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    lineHeight: 16,
  },
});
