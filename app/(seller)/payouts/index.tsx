import React from "react";
import { ScrollView, View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { BalanceCard } from "@/components/payouts/BalanceCard";
import { PayoutRow } from "@/components/payouts/PayoutRow";
import { getPayoutBalanceBackend, getPayoutsBackend } from "@/lib/api/backend";
import { colors, radii, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

export default function PayoutsIndex() {
  const router = useRouter();
  const balance = useQuery({ queryKey: ["payout-balance"], queryFn: getPayoutBalanceBackend });
  const list = useQuery({ queryKey: ["payouts"], queryFn: getPayoutsBackend });

  if (balance.isLoading) {
    return <View style={styles.center}><ActivityIndicator accessibilityLabel="Loading payouts" /></View>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: spacing[8] }}>
      {balance.data?.ok ? (
        <BalanceCard
          balance={balance.data.data}
          onWithdraw={() => {
            if (!balance.data || !balance.data.ok || balance.data.data.available < 100) {
              Alert.alert("Withdraw unavailable", "Minimum payout is LKR 100.00.");
              return;
            }
            router.push("/(seller)/payouts/withdraw");
          }}
        />
      ) : null}

      <View style={styles.actions}>
        <ActionButton label="Settings" onPress={() => router.push("/(seller)/payouts/settings")} />
        <ActionButton label="Stripe Connect" onPress={() => router.push("/(seller)/payouts/connect-return")} />
      </View>

      <Text style={styles.sectionHeading}>History</Text>
      <FlatList
        data={list.data?.ok ? list.data.data.payouts : []}
        keyExtractor={(p) => p.id}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <PayoutRow payout={item} onPress={() => router.push(`/(seller)/payouts/${item.id}` as any)} />
        )}
        ListEmptyComponent={<Text style={styles.empty}>No payouts yet.</Text>}
      />
    </ScrollView>
  );
}

function ActionButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityLabel={label} accessibilityRole="button" onPress={onPress} style={styles.action}>
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  actions: { flexDirection: "row", gap: spacing[3], paddingHorizontal: spacing[4], marginBottom: spacing[3] },
  action: { flex: 1, paddingVertical: spacing[3], borderRadius: radii.lg, borderWidth: 1, borderColor: colors.light.border, backgroundColor: colors.light.card, alignItems: "center" },
  actionText: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.sm, color: colors.light.foreground },
  sectionHeading: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.md, color: colors.light.foreground, paddingHorizontal: spacing[4], paddingTop: spacing[2], paddingBottom: spacing[2] },
  empty: { fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground, textAlign: "center", padding: spacing[5] },
});
