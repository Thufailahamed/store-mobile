import React from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, StatusBar } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@/components/ui/Icon";
import { getPayoutDetailBackend } from "@/lib/api/backend";
import { formatPayoutStatus, isPayoutId } from "@/lib/payouts/ledger";
import { formatPrice } from "@/lib/utils";
import { colors, radii, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

const CREAM = colors.paper.cream;
const INK = colors.olive[950];

export default function PayoutDetail() {
  const { payoutId } = useLocalSearchParams<{ payoutId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["payout", payoutId],
    enabled: Boolean(payoutId) && isPayoutId(payoutId),
    queryFn: async () => {
      const res = await getPayoutDetailBackend(payoutId);
      if (!res.ok) throw new Error(res.error ?? "Failed to load payout");
      return res.data.payout;
    },
  });

  if (isLoading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.body}>Loading…</Text>
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={[styles.center, { paddingTop: insets.top, paddingHorizontal: 32 }]}>
        <Text style={styles.emptyTitle}>Payout not found</Text>
        <Text style={styles.body}>This settlement is not on file.</Text>
        <TouchableOpacity style={styles.backPill} onPress={() => router.back()}>
          <Text style={styles.backPillText}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const p = data;
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: Math.max(insets.top, 12) + 8, paddingBottom: 40 + insets.bottom },
        ]}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={20} color={INK} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>Settlement</Text>
            <Text style={styles.title}>{formatPayoutStatus(p.status)}</Text>
          </View>
        </View>
        <View style={styles.goldRule} />

        <Text style={styles.amount}>{formatPrice(p.amount, p.currency ?? "LKR")}</Text>

        <View style={styles.section}>
          <Row label="Method" value={p.method ?? "Bank"} />
          <Row label="Reference" value={p.reference ?? "—"} />
          <Row
            label="Requested"
            value={p.requested_at ? new Date(p.requested_at).toLocaleString("en-LK") : "—"}
          />
          <Row label="Paid" value={p.paid_at ? new Date(p.paid_at).toLocaleString("en-LK") : "—"} />
          <Row label="Created" value={new Date(p.created_at).toLocaleString("en-LK")} />
        </View>

        {p.notes ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.bodyLeft}>{p.notes}</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper.DEFAULT },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.paper.DEFAULT,
    gap: 8,
  },
  content: { paddingHorizontal: spacing[5], gap: spacing[4] },
  header: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingBottom: spacing[2] },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: CREAM,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.14)",
  },
  kicker: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 10,
    letterSpacing: typography.letterSpacing.editorial,
    textTransform: "uppercase",
    color: colors.olive[700],
    marginBottom: 2,
  },
  title: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 28,
    color: INK,
    letterSpacing: -0.4,
    textTransform: "capitalize",
  },
  goldRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(200,164,74,0.55)",
  },
  amount: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 32,
    color: INK,
    letterSpacing: -0.6,
  },
  section: {
    backgroundColor: CREAM,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.12)",
    padding: spacing[4],
    gap: spacing[2],
  },
  sectionTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.sm,
    color: colors.olive[700],
  },
  detailRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing[3] },
  detailLabel: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    color: colors.olive[700],
  },
  detailValue: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: typography.fontSizes.sm,
    color: INK,
    flex: 1,
    textAlign: "right",
    textTransform: "capitalize",
  },
  body: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    color: colors.olive[700],
    textAlign: "center",
  },
  bodyLeft: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    color: INK,
  },
  emptyTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 22,
    color: INK,
    textAlign: "center",
  },
  backPill: {
    marginTop: 8,
    minHeight: 44,
    paddingHorizontal: 20,
    borderRadius: radii.full,
    backgroundColor: colors.olive[900],
    alignItems: "center",
    justifyContent: "center",
  },
  backPillText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.sm,
    color: CREAM,
  },
});
