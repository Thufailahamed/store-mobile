/**
 * Mobile brand withdraw sheet (slice 0310).
 *
 * Used in brand payouts screen. Posts to /api/brand/payouts/withdraw via the
 * `withdrawBrandBackend` wrapper. Requires Idempotency-Key (auto-generated).
 */

import React, { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import {
  withdrawBrandBackend,
  type BrandPayoutSettings,
} from "@/lib/api/backend";

interface Props {
  available: number;
  settings: BrandPayoutSettings | null;
  kycApproved: boolean;
  onSuccess?: () => void;
}

export function WithdrawSheet({ available, settings, kycApproved, onSuccess }: Props) {
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const num = Number(amount);
  const valid = Number.isFinite(num) && num >= 100 && num <= available;
  const blockedReason = !kycApproved
    ? "KYC approval required"
    : !settings?.method
    ? "Configure payout settings first"
    : null;

  async function submit() {
    if (!valid || blockedReason) return;
    setSubmitting(true);
    try {
      const idempotencyKey = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const res = await withdrawBrandBackend(num, idempotencyKey);
      if (!res.ok) {
        Alert.alert("Withdrawal failed", typeof res.error === "string" ? res.error : "Try again");
        return;
      }
      Alert.alert(
        res.data.replay ? "Already submitted" : "Withdrawal requested",
        `Amount ${num} LKR · status ${res.data.payout.status}`,
      );
      setAmount("");
      onSuccess?.();
    } finally {
      setSubmitting(false);
    }
  }

  if (blockedReason) {
    return (
      <View style={styles.blocked}>
        <Text style={styles.blockedText}>{blockedReason}</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Available: LKR {available.toLocaleString()}</Text>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        placeholder="Enter amount (min 100)"
        value={amount}
        onChangeText={setAmount}
      />
      <Pressable
        onPress={submit}
        disabled={!valid || submitting}
        style={[styles.button, (!valid || submitting) && styles.buttonDisabled]}
      >
        <Text style={styles.buttonText}>{submitting ? "Submitting…" : "Request withdrawal"}</Text>
      </Pressable>
      {settings && (
        <Text style={styles.muted}>
          Will pay out via {settings.method === "bank" ? `bank (${settings.bank_name ?? "—"})` : "PayPal"}.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 12, backgroundColor: "#fff", borderRadius: 12 },
  label: { fontSize: 12, color: "#666" },
  input: { borderWidth: 1, borderColor: "#e5e5e5", borderRadius: 8, padding: 12, fontSize: 16 },
  button: { backgroundColor: "#0a0a0a", padding: 14, borderRadius: 8, alignItems: "center" },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: "#fff", fontWeight: "600" },
  muted: { fontSize: 11, color: "#888" },
  blocked: { padding: 12, backgroundColor: "#fef3c7", borderRadius: 8 },
  blockedText: { color: "#92400e", fontSize: 12 },
});
