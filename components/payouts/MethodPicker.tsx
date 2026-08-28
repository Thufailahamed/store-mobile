import React from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { colors, radii, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import type { PayoutSettings } from "@/lib/api/backend";

const METHODS: Array<{ key: NonNullable<PayoutSettings["method"]>; label: string }> = [
  { key: "bank", label: "Bank transfer" },
  { key: "upi", label: "UPI" },
  { key: "paypal", label: "PayPal" },
  { key: "stripe_connect", label: "Stripe Connect" },
];

const SCHEDULES: Array<{ key: NonNullable<PayoutSettings["schedule"]>; label: string }> = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "biweekly", label: "Biweekly" },
  { key: "monthly", label: "Monthly" },
];

interface Props {
  value: PayoutSettings;
  onChange: (next: PayoutSettings) => void;
}

export function MethodPicker({ value, onChange }: Props) {
  return (
    <View style={{ gap: spacing[4] }}>
      <Field label="Method">
        <View style={styles.chips}>
          {METHODS.map((m) => (
            <Pressable
              key={m.key}
              accessibilityRole="radio"
              accessibilityState={{ selected: value.method === m.key }}
              accessibilityLabel={m.label}
              onPress={() => onChange({ ...value, method: m.key })}
              style={[styles.chip, value.method === m.key && styles.chipActive]}
            >
              <Text style={[styles.chipText, value.method === m.key && styles.chipTextActive]}>{m.label}</Text>
            </Pressable>
          ))}
        </View>
      </Field>

      <Field label="Schedule">
        <View style={styles.chips}>
          {SCHEDULES.map((s) => (
            <Pressable
              key={s.key}
              accessibilityRole="radio"
              accessibilityState={{ selected: value.schedule === s.key }}
              accessibilityLabel={s.label}
              onPress={() => onChange({ ...value, schedule: s.key })}
              style={[styles.chip, value.schedule === s.key && styles.chipActive]}
            >
              <Text style={[styles.chipText, value.schedule === s.key && styles.chipTextActive]}>{s.label}</Text>
            </Pressable>
          ))}
        </View>
      </Field>

      {value.method === "bank" ? (
        <>
          <Input label="Bank name" value={value.bank_name ?? ""} onChangeText={(t) => onChange({ ...value, bank_name: t })} />
          <Input label="Account name" value={value.account_name ?? ""} onChangeText={(t) => onChange({ ...value, account_name: t })} />
          <Input label="Account number (last 4)" value={value.account_number_last4 ?? ""} onChangeText={(t) => onChange({ ...value, account_number_last4: t })} keyboardType="number-pad" maxLength={4} />
          <Input label="IFSC / Sort code" value={value.ifsc ?? ""} onChangeText={(t) => onChange({ ...value, ifsc: t })} />
        </>
      ) : value.method === "upi" ? (
        <Input label="UPI ID" value={value.upi ?? ""} onChangeText={(t) => onChange({ ...value, upi: t })} />
      ) : value.method === "paypal" ? (
        <Input label="PayPal email" value={value.paypal ?? ""} onChangeText={(t) => onChange({ ...value, paypal: t })} keyboardType="email-address" />
      ) : null}
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: spacing[2] }}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

function Input({ label, ...props }: { label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <Field label={label}>
      <TextInput
        placeholderTextColor={colors.light.mutedForeground}
        accessibilityLabel={label}
        style={styles.input}
        {...props}
      />
    </Field>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: fontFamilies.sans.medium, fontSize: typography.fontSizes.sm, color: colors.light.foreground },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2] },
  chip: { paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radii.full, borderWidth: 1, borderColor: colors.light.border },
  chipActive: { borderColor: colors.light.primary, backgroundColor: colors.light.primary + "15" },
  chipText: { fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.sm, color: colors.light.foreground },
  chipTextActive: { fontFamily: fontFamilies.sans.semibold, color: colors.light.primary },
  input: { padding: spacing[3], borderRadius: radii.md, borderWidth: 1, borderColor: colors.light.border, backgroundColor: colors.light.card, color: colors.light.foreground, fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.sm },
});
