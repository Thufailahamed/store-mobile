import React from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Switch } from "react-native";
import { colors, radii, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { POPULAR_BANKS } from "@/lib/payouts/settings";
import { StripeConnectCard } from "@/components/payouts/StripeConnectCard";
import type { PayoutSettings } from "@/lib/api/backend";

const CREAM = colors.paper.cream;
const INK = colors.olive[950];

const METHODS: Array<{ key: NonNullable<PayoutSettings["method"]>; label: string }> = [
  { key: "bank", label: "Bank Wire" },
  { key: "upi", label: "UPI" },
  { key: "paypal", label: "PayPal" },
  { key: "stripe_connect", label: "Stripe Connect" },
];

const SCHEDULES: Array<{ key: NonNullable<PayoutSettings["schedule"]>; label: string }> = [
  { key: "daily", label: "Daily (every evening)" },
  { key: "weekly", label: "Weekly (every Monday)" },
  { key: "biweekly", label: "Bi-weekly (1st & 15th)" },
  { key: "monthly", label: "Monthly (1st of month)" },
];

interface Props {
  value: PayoutSettings;
  onChange: (next: PayoutSettings) => void;
}

export function MethodPicker({ value, onChange }: Props) {
  const bankName = value.bank_name ?? "";
  const knownBank = POPULAR_BANKS.includes(bankName as (typeof POPULAR_BANKS)[number]);

  return (
    <View style={{ gap: spacing[4] }}>
      <Field label="Payout destination">
        <Text style={styles.hint}>Where settlement is sent on the schedule you pick. Customers still pay with PayHere or cash on delivery at checkout.</Text>
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

      {value.method === "bank" ? (
        <>
          <Field label="Bank institution">
            <View style={styles.chips}>
              {POPULAR_BANKS.map((b) => (
                <Pressable
                  key={b}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: bankName === b }}
                  accessibilityLabel={b}
                  onPress={() => onChange({ ...value, bank_name: b })}
                  style={[styles.chip, bankName === b && styles.chipActive]}
                >
                  <Text style={[styles.chipText, bankName === b && styles.chipTextActive]}>{b}</Text>
                </Pressable>
              ))}
            </View>
            {!knownBank && bankName ? (
              <Text style={styles.hint}>Saved bank: {bankName}</Text>
            ) : null}
          </Field>
          <Input
            label="Account holder name"
            value={value.account_name ?? ""}
            onChangeText={(t) => onChange({ ...value, account_name: t })}
            placeholder="e.g. Aura Boutique"
          />
          <Input
            label="Account number — last 4 digits"
            value={value.account_number_last4 ?? ""}
            onChangeText={(t) => onChange({ ...value, account_number_last4: t.replace(/\D/g, "").slice(0, 4) })}
            keyboardType="number-pad"
            maxLength={4}
            placeholder="1234"
          />
          <Input
            label="Branch code / SWIFT (optional)"
            value={value.ifsc ?? ""}
            onChangeText={(t) => onChange({ ...value, ifsc: t.toUpperCase() })}
            autoCapitalize="characters"
            placeholder="e.g. CCBLKLJA"
          />
        </>
      ) : value.method === "upi" ? (
        <Input
          label="UPI virtual payment address"
          value={value.upi ?? ""}
          onChangeText={(t) => onChange({ ...value, upi: t })}
          autoCapitalize="none"
          placeholder="store@okaxis"
        />
      ) : value.method === "paypal" ? (
        <Input
          label="PayPal business email"
          value={value.paypal ?? ""}
          onChangeText={(t) => onChange({ ...value, paypal: t })}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="finance@yourstore.lk"
        />
      ) : value.method === "stripe_connect" ? (
        <StripeConnectCard
          hasAccount={Boolean(value.stripe_account_id)}
          accountId={value.stripe_account_id ?? null}
        />
      ) : null}

      <Field label="Settlement schedule">
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

      <View style={styles.taxRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Tax / W-9 compliance</Text>
          <Text style={styles.hint}>Required for merchant tax filing</Text>
        </View>
        <Switch
          value={Boolean(value.tax_form_submitted)}
          onValueChange={(v) => onChange({ ...value, tax_form_submitted: v })}
          trackColor={{ false: colors.light.muted, true: colors.olive[400] }}
          thumbColor={value.tax_form_submitted ? colors.olive[800] : CREAM}
        />
      </View>
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
  label: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.olive[700],
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2] },
  chip: {
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.18)",
    backgroundColor: CREAM,
    justifyContent: "center",
  },
  chipActive: { borderColor: colors.olive[800], backgroundColor: colors.olive[900] },
  chipText: { fontFamily: fontFamilies.sans.medium, fontSize: typography.fontSizes.sm, color: INK },
  chipTextActive: { color: CREAM, fontFamily: fontFamilies.sans.semibold },
  input: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.18)",
    backgroundColor: CREAM,
    color: INK,
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
  },
  hint: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
  },
  taxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 52,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(83,94,44,0.14)",
  },
});
