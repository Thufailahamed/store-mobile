import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@/components/ui/Icon";
import { getPayoutBalanceBackend, withdrawPayoutBackend } from "@/lib/api/backend";
import { generateIdempotencyKey } from "@/lib/payouts/idempotency";
import { isPayoutKycError, payoutKycUserMessage } from "@/lib/payouts/settings";
import { payoutUserMessage } from "@/lib/payouts/ledger";
import { formatPrice } from "@/lib/utils";
import { colors, radii, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

const CREAM = colors.paper.cream;
const INK = colors.olive[950];

function money(n: number | null | undefined, currency = "LKR"): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return formatPrice(n, currency);
}

export default function WithdrawScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const balance = useQuery({ queryKey: ["payout-balance"], queryFn: getPayoutBalanceBackend });
  const [amount, setAmount] = useState("");
  const parsed = Number(amount);
  const bal = balance.data?.ok ? balance.data.data : null;
  const available = bal?.available;
  const currency = bal?.currency ?? "LKR";
  const valid =
    Number.isFinite(parsed) &&
    parsed >= 100 &&
    available != null &&
    Number.isFinite(available) &&
    parsed <= available;

  const mutation = useMutation({
    mutationFn: () => {
      const idempotencyKey = generateIdempotencyKey("wd");
      return withdrawPayoutBackend({ amount: parsed, idempotencyKey });
    },
    onSuccess: (res) => {
      if (res.ok) {
        qc.invalidateQueries({ queryKey: ["payouts"] });
        qc.invalidateQueries({ queryKey: ["payout-balance"] });
        Alert.alert("Withdraw requested", `Payout is ${res.data.status}.`, [
          { text: "OK", onPress: () => router.replace("/(seller)/payouts") },
        ]);
      } else if (isPayoutKycError(res.error)) {
        Alert.alert("Verify your identity first", payoutKycUserMessage(res.error ?? ""));
      } else Alert.alert("Withdraw failed", payoutUserMessage(res.error, "Try again."));
    },
    onError: (e: unknown) =>
      Alert.alert("Withdraw failed", e instanceof Error ? e.message : "Try again."),
  });

  const balanceError =
    balance.data && !balance.data.ok
      ? payoutUserMessage(balance.data.error, "Couldn’t load payout balance. Pull back and retry.")
      : null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: Math.max(insets.top, 12) + 8, paddingBottom: 40 + insets.bottom },
        ]}
        keyboardShouldPersistTaps="handled"
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
            <Text style={styles.kicker}>Ledger</Text>
            <Text style={styles.title}>Withdraw</Text>
          </View>
        </View>
        <View style={styles.goldRule} />

        <View style={styles.balanceCard}>
          <Text style={styles.balanceKicker}>Available</Text>
          <Text style={styles.balanceValue}>{bal ? money(available, currency) : "—"}</Text>
          {balanceError ? <Text style={styles.balanceError}>{balanceError}</Text> : null}
        </View>

        <TextInput
          accessibilityLabel="Withdraw amount"
          placeholder="100"
          placeholderTextColor={colors.olive[700]}
          keyboardType="number-pad"
          value={amount}
          onChangeText={setAmount}
          maxLength={9}
          style={styles.input}
        />
        <Text style={styles.hint}>
          Amount in {currency}. Minimum {money(100, currency)}.
        </Text>
        <TouchableOpacity
          style={[styles.submitBtn, (!valid || mutation.isPending) && styles.submitBtnDisabled]}
          onPress={() => mutation.mutate()}
          disabled={!valid || mutation.isPending}
          accessibilityRole="button"
          accessibilityLabel="Submit withdrawal"
        >
          <Text style={styles.submitText}>
            {mutation.isPending ? "Submitting…" : "Submit withdrawal"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper.DEFAULT },
  content: { paddingHorizontal: spacing[5], gap: spacing[3] },
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
  },
  goldRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(200,164,74,0.55)",
    marginBottom: 8,
  },
  balanceCard: {
    backgroundColor: colors.olive[900],
    borderRadius: radii["2xl"],
    padding: 18,
    gap: 6,
  },
  balanceKicker: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: "rgba(250,248,241,0.7)",
  },
  balanceValue: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 32,
    color: CREAM,
    letterSpacing: -0.6,
  },
  balanceError: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: "rgba(250,248,241,0.8)",
    marginTop: 4,
  },
  input: {
    minHeight: 52,
    padding: spacing[3],
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.16)",
    backgroundColor: CREAM,
    color: INK,
    fontFamily: fontFamilies.display.semibold,
    fontSize: 24,
    textAlign: "center",
  },
  hint: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.xs,
    color: colors.olive[700],
    textAlign: "center",
  },
  submitBtn: {
    minHeight: 52,
    borderRadius: radii.full,
    backgroundColor: colors.olive[900],
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  submitBtnDisabled: { opacity: 0.45 },
  submitText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.sm,
    color: CREAM,
  },
});
