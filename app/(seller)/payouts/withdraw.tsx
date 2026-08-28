import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, Alert, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { getPayoutBalanceBackend, withdrawPayoutBackend } from "@/lib/api/backend";
import { generateIdempotencyKey } from "@/lib/payouts/idempotency";
import { formatPrice } from "@/lib/utils";
import { colors, radii, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

export default function WithdrawScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const balance = useQuery({ queryKey: ["payout-balance"], queryFn: getPayoutBalanceBackend });
  const [amount, setAmount] = useState("");
  const parsed = Number(amount);
  const valid = Number.isFinite(parsed) && parsed >= 100 && (balance.data?.ok ? parsed <= balance.data.data.available : false);

  const mutation = useMutation({
    mutationFn: () => {
      const idempotencyKey = generateIdempotencyKey("wd");
      return withdrawPayoutBackend({ amount: parsed, idempotencyKey });
    },
    onSuccess: (res) => {
      if (res.ok) {
        qc.invalidateQueries({ queryKey: ["payouts"] });
        qc.invalidateQueries({ queryKey: ["payout-balance"] });
        Alert.alert("Withdraw requested", `Payout ${res.data.id} is ${res.data.status}.`, [
          { text: "OK", onPress: () => router.replace("/(seller)/payouts") },
        ]);
      } else Alert.alert("Withdraw failed", res.error ?? "Try again.");
    },
    onError: (e: any) => Alert.alert("Withdraw failed", e?.message ?? "Try again."),
  });

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Withdraw</Text>
        {balance.data?.ok ? (
          <Text style={styles.available}>Available: {formatPrice(balance.data.data.available, balance.data.data.currency)}</Text>
        ) : null}
        <TextInput
          accessibilityLabel="Withdraw amount in smallest currency unit"
          placeholder="100"
          placeholderTextColor={colors.light.mutedForeground}
          keyboardType="number-pad"
          value={amount}
          onChangeText={setAmount}
          maxLength={9}
          style={styles.input}
        />
        <Text style={styles.hint}>Enter the smallest unit (e.g. 100 = LKR 100.00). Minimum 100.</Text>
        <Button onPress={() => mutation.mutate()} disabled={!valid || mutation.isPending} accessibilityLabel="Submit withdrawal">
          {mutation.isPending ? "Submitting…" : "Submit withdrawal"}
        </Button>
        <Button variant="ghost" onPress={() => router.back()} accessibilityLabel="Cancel">Cancel</Button>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  content: { padding: spacing[5], gap: spacing[3] },
  heading: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.lg, color: colors.light.foreground },
  available: { fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground },
  input: { padding: spacing[3], borderRadius: radii.md, borderWidth: 1, borderColor: colors.light.border, backgroundColor: colors.light.card, color: colors.light.foreground, fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.lg, textAlign: "center" },
  hint: { fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground, textAlign: "center" },
});
