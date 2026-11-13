// TEMPORARY dev-only preview of seller onboarding screens. Delete after use.
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { colors, typography, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { VerifyOtpSheet } from "@/components/auth/VerifyOtpSheet";

export default function DevSellerPreview() {
  const { screen } = useLocalSearchParams<{ screen?: string }>();
  const router = useRouter();
  const store = { name: "Nadia Atelier" };
  const goSettings = () => {};
  const onRefresh = () => {};
  if (screen === "otp") {
    return (
      <View style={{ flex: 1, backgroundColor: "#f8f7f2" }}>
        <VerifyOtpSheet visible phone="+94771234567" onClose={() => router.back()} />
      </View>
    );
  }
  if (screen === "nostore") {
    const styles = settingsStyles;
    return (
      <View style={[styles.container, styles.centered]}>
        <Ionicons name="cloud-offline-outline" size={40} color={colors.olive[700]} />
        <Text style={styles.emptyTitle}>No store found</Text>
        <Text style={styles.emptySub}>Create a store from the dashboard to continue.</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={onRefresh}>
          <Text style={styles.retryText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }
  return (
      <View style={styles.blockedContainer}>
        <View style={styles.reviewBadge}>
          <Text style={styles.reviewBadgeText}>Under review</Text>
        </View>
        <Text style={styles.blockedTitle}>Store in review</Text>
        <Text style={styles.blockedBody}>
          Thank you for submitting your application. Our admin team is reviewing{" "}
          {store?.name ? `"${store.name}"` : "your store"}. You&apos;ll get full seller access once
          it&apos;s approved.
        </Text>
        <View style={styles.reviewCard}>
          <Text style={styles.reviewCardLabel}>Application status</Text>
          <View style={styles.reviewCardRow}>
            <Text style={styles.reviewStoreName}>{store?.name ?? "Your store"}</Text>
            <View style={styles.pendingPill}>
              <View style={styles.pendingDot} />
              <Text style={styles.pendingPillText}>Pending review</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity style={styles.blockedCta} onPress={goSettings} accessibilityRole="button">
          <Text style={styles.blockedCtaText}>View store settings</Text>
        </TouchableOpacity>
      </View>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.light.background,
  },
  blockedContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: colors.light.background,
    gap: 10,
  },
  blockedTitle: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 24,
    color: colors.light.foreground,
  },
  blockedBody: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.light.mutedForeground,
    textAlign: "center",
  },
  blockedCta: {
    marginTop: 16,
    backgroundColor: colors.olive[800],
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: radii.full,
    minHeight: 44,
    justifyContent: "center",
  },
  blockedCtaText: {
    color: colors.paper.cream,
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.sm,
  },
  reviewBadge: {
    alignSelf: "center",
    backgroundColor: "#FEF3C7",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 4,
  },
  reviewBadgeText: {
    color: "#92400E",
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.xs,
    letterSpacing: typography.letterSpacing.wide,
    textTransform: "uppercase",
  },
  reviewCard: {
    marginTop: 20,
    width: "100%",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.light.card,
    padding: 16,
    gap: 10,
  },
  reviewCardLabel: {
    color: colors.light.mutedForeground,
    fontFamily: fontFamilies.sans.medium,
    fontSize: typography.fontSizes.xs,
    letterSpacing: typography.letterSpacing.wide,
    textTransform: "uppercase",
  },
  reviewCardRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  reviewStoreName: {
    flex: 1,
    color: colors.light.foreground,
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.sm,
  },
  pendingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEF3C7",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pendingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#F59E0B",
  },
  pendingPillText: {
    color: "#92400E",
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 10,
  },
  tabIconWrap: {
    width: 44,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  tabIconWrapActive: {
    backgroundColor: "rgba(83,94,44,0.1)",
  },
});

const CREAM = colors.paper.cream;
const INK = colors.olive[950];
const settingsStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f7f2" },
  centered: { alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 8 },
  emptyTitle: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 22,
    color: INK,
    textAlign: "center",
  },
  emptySub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
    textAlign: "center",
  },
  retryBtn: {
    marginTop: 12,
    minHeight: 44,
    paddingHorizontal: 20,
    borderRadius: radii.full,
    backgroundColor: colors.olive[900],
    alignItems: "center",
    justifyContent: "center",
  },
  retryText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.sm,
    color: CREAM,
  },
});
