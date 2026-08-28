import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { getPayoutsBackend } from "@/lib/api/backend";
import { formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { colors, radii, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

export default function PayoutDetail() {
  const { payoutId } = useLocalSearchParams<{ payoutId: string }>();
  const router = useRouter();
  const { data, isLoading } = useQuery({
    queryKey: ["payouts"],
    queryFn: getPayoutsBackend,
    select: (res) => (res.ok ? res.data.payouts.find((p) => p.id === payoutId) : undefined),
  });

  if (isLoading) return <View style={styles.center}><Text style={styles.body}>Loading…</Text></View>;
  if (!data) return <View style={styles.center}><Text style={styles.body}>Payout not found.</Text></View>;

  const p = data;
  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.amount}>{formatPrice(p.amount, p.currency)}</Text>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Status</Text>
          <Text style={styles.statusValue}>{p.status}</Text>
        </View>

        <Section title="Details">
          <Row label="Method" value={p.method ?? "bank"} />
          <Row label="Reference" value={p.reference ?? "—"} />
          <Row label="Requested" value={p.requested_at ? new Date(p.requested_at).toLocaleString() : "—"} />
          <Row label="Paid" value={p.paid_at ? new Date(p.paid_at).toLocaleString() : "—"} />
          <Row label="Created" value={new Date(p.created_at).toLocaleString()} />
        </Section>

        {p.notes ? (
          <Section title="Notes">
            <Text style={styles.body}>{p.notes}</Text>
          </Section>
        ) : null}

        <Button variant="ghost" onPress={() => router.back()} accessibilityLabel="Back">Back</Button>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing[5] },
  content: { padding: spacing[5], gap: spacing[4] },
  amount: { fontFamily: fontFamilies.sans.semibold, fontSize: 32, color: colors.light.foreground },
  statusRow: { flexDirection: "row", gap: spacing[2], alignItems: "center" },
  statusLabel: { fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground },
  statusValue: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.sm, color: colors.light.primary, textTransform: "capitalize" },
  section: { backgroundColor: colors.light.card, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.light.border, padding: spacing[4], gap: spacing[2] },
  sectionTitle: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground },
  sectionBody: { gap: spacing[2] },
  detailRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing[3] },
  detailLabel: { fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground },
  detailValue: { fontFamily: fontFamilies.sans.medium, fontSize: typography.fontSizes.sm, color: colors.light.foreground, flex: 1, textAlign: "right" },
  body: { fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.sm, color: colors.light.foreground },
});
