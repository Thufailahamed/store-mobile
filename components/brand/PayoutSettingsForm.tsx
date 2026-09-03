/**
 * Mobile brand payout-settings form (slice 0310).
 *
 * Bank or PayPal method. Brand owners cannot use Stripe Connect or UPI.
 */

import React, { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import {
  getBrandPayoutSettingsBackend,
  updateBrandPayoutSettingsBackend,
  type BrandPayoutSettings,
} from "@/lib/api/backend";

interface Props {
  initial: BrandPayoutSettings | null;
  onSaved?: (s: BrandPayoutSettings) => void;
}

export function PayoutSettingsForm({ initial, onSaved }: Props) {
  const [method, setMethod] = useState<"bank" | "paypal">(initial?.method ?? "bank");
  const [bankName, setBankName] = useState(initial?.bank_name ?? "");
  const [accountName, setAccountName] = useState(initial?.account_name ?? "");
  const [accountLast4, setAccountLast4] = useState(initial?.account_number_last4 ?? "");
  const [paypal, setPaypal] = useState(initial?.paypal ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const body: Partial<BrandPayoutSettings> = method === "bank"
        ? { method, bank_name: bankName, account_name: accountName, account_number_last4: accountLast4 }
        : { method, paypal };
      const res = await updateBrandPayoutSettingsBackend(body);
      if (!res.ok) {
        Alert.alert("Save failed", typeof res.error === "string" ? res.error : "Try again");
        return;
      }
      Alert.alert("Saved");
      onSaved?.(res.data.payout);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>Method</Text>
      <View style={styles.row}>
        <Chip label="Bank" active={method === "bank"} onPress={() => setMethod("bank")} />
        <Chip label="PayPal" active={method === "paypal"} onPress={() => setMethod("paypal")} />
      </View>

      {method === "bank" ? (
        <>
          <Field label="Bank name" value={bankName} onChange={setBankName} />
          <Field label="Account name" value={accountName} onChange={setAccountName} />
          <Field label="Account # last 4" value={accountLast4} onChange={(v) => setAccountLast4(v.slice(0, 8))} keyboard="numeric" />
        </>
      ) : (
        <Field label="PayPal email" value={paypal} onChange={setPaypal} keyboard="email-address" />
      )}

      <Pressable onPress={save} disabled={saving} style={[styles.button, saving && styles.buttonDisabled]}>
        <Text style={styles.buttonText}>{saving ? "Saving…" : "Save"}</Text>
      </Pressable>
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function Field({ label, value, onChange, keyboard }: { label: string; value: string; onChange: (v: string) => void; keyboard?: "default" | "numeric" | "email-address" }) {
  return (
    <View style={styles.field}>
      <Text style={styles.heading}>{label}</Text>
      <TextInput style={styles.input} value={value} onChangeText={onChange} keyboardType={keyboard ?? "default"} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 12, backgroundColor: "#fff", borderRadius: 12 },
  row: { flexDirection: "row", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: "#f1f5f9" },
  chipActive: { backgroundColor: "#0a0a0a" },
  chipText: { color: "#475569", fontWeight: "500" },
  chipTextActive: { color: "#fff" },
  field: { gap: 6 },
  heading: { fontSize: 12, color: "#64748b", fontWeight: "600" },
  input: { borderWidth: 1, borderColor: "#e5e5e5", borderRadius: 8, padding: 10, fontSize: 14 },
  button: { backgroundColor: "#0a0a0a", padding: 12, borderRadius: 8, alignItems: "center", marginTop: 8 },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: "#fff", fontWeight: "600" },
});
