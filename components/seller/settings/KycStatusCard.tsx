import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { colors, typography, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import type { PayoutProfileView } from "@/lib/seller-access";

const CREAM = colors.paper.cream;
const INK = colors.olive[950];

interface Props {
  profile: PayoutProfileView;
  loadError: string | null;
}

const TONE: Record<PayoutProfileView["kycTone"], { bg: string; text: string }> = {
  ok: { bg: "rgba(83,94,44,0.12)", text: colors.olive[800] },
  warn: { bg: "rgba(200,164,74,0.18)", text: "#8a6a2a" },
  bad: { bg: "rgba(160,64,48,0.12)", text: colors.accent2.rust },
  muted: { bg: colors.light.muted, text: colors.light.mutedForeground },
};

export function KycStatusCard({ profile, loadError }: Props) {
  const router = useRouter();

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push("/(seller)/payouts/settings" as any)}
      accessibilityRole="button"
      accessibilityLabel="Payout settings"
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>Ledger</Text>
          <Text style={styles.title}>Payouts</Text>
        </View>
        {profile.kycLabel ? (
          <View style={[styles.pill, { backgroundColor: TONE[profile.kycTone].bg }]}>
            <Text style={[styles.pillText, { color: TONE[profile.kycTone].text }]}>
              {profile.kycLabel}
            </Text>
          </View>
        ) : null}
      </View>

      {loadError ? (
        <Text style={styles.error}>{loadError}</Text>
      ) : (
        <View style={styles.body}>
          <Fact label="Method" value={formatMethod(profile.method)} />
          <Fact label="Bank" value={profile.bankSummary} />
          <Fact label="Stripe" value={profile.stripeConnected ? "Connected" : null} />
          {profile.missing.length > 0 ? (
            <Text style={styles.missing}>
              Still needed: {profile.missing.join(", ")}
            </Text>
          ) : null}
        </View>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>Payout settings</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.olive[700]} />
      </View>
    </TouchableOpacity>
  );
}

function formatMethod(method: string | null) {
  if (!method) return null;
  return method.replace(/_/g, " ");
}

function Fact({ label, value }: { label: string; value: string | null }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={[styles.factValue, !value && styles.factEmpty]} numberOfLines={1}>
        {value ?? "Not on file"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: CREAM,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.12)",
    padding: spacing[4],
    gap: spacing[3],
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  kicker: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: colors.olive[700],
    marginBottom: 2,
  },
  title: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 22,
    color: INK,
    letterSpacing: -0.3,
  },
  pill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radii.full },
  pillText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  body: { gap: 8 },
  fact: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  factLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.olive[700],
  },
  factValue: {
    flex: 1,
    textAlign: "right",
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    color: INK,
  },
  factEmpty: {
    color: colors.light.mutedForeground,
    fontStyle: "italic",
  },
  missing: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    marginTop: 4,
  },
  error: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    color: colors.accent2.rust,
  },
  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", minHeight: 44 },
  footerText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: typography.fontSizes.sm,
    color: colors.olive[800],
  },
});
