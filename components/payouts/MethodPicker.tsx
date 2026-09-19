import React from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Switch } from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { colors, radii, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { POPULAR_BANKS } from "@/lib/payouts/settings";
import { StripeConnectCard } from "@/components/payouts/StripeConnectCard";
import type { PayoutSettings } from "@/lib/api/backend";

const CREAM = colors.paper.cream;
const INK = colors.olive[950];

type Method = NonNullable<PayoutSettings["method"]>;
type Schedule = NonNullable<PayoutSettings["schedule"]>;

const METHODS: { key: Method; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "bank", label: "Bank Wire", icon: "card-outline" },
  { key: "upi", label: "UPI", icon: "flash-outline" },
  { key: "paypal", label: "PayPal", icon: "logo-paypal" },
  { key: "stripe_connect", label: "Stripe", icon: "link-outline" },
];

const SCHEDULES: { key: Schedule; label: string; detail: string }[] = [
  { key: "daily", label: "Daily", detail: "Every evening" },
  { key: "weekly", label: "Weekly", detail: "Every Monday" },
  { key: "biweekly", label: "Bi-weekly", detail: "1st & 15th" },
  { key: "monthly", label: "Monthly", detail: "1st of month" },
];

interface Props {
  value: PayoutSettings;
  onChange: (next: PayoutSettings) => void;
}

export function MethodPicker({ value, onChange }: Props) {
  const bankName = value.bank_name ?? "";
  const knownBank = POPULAR_BANKS.includes(bankName as (typeof POPULAR_BANKS)[number]);

  return (
    <View style={{ gap: spacing[5] }}>
      <Section icon="wallet-outline" title="Payout destination">
        <Text style={styles.hint}>
          Where settlement is sent on the schedule you pick. Customers still pay with Payments.lk or cash on delivery at checkout.
        </Text>
        <View style={styles.methodGrid}>
          {METHODS.map((m) => {
            const active = value.method === m.key;
            return (
              <Pressable
                key={m.key}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={m.label}
                onPress={() => onChange({ ...value, method: m.key })}
                style={[styles.methodCard, active && styles.methodCardActive]}
              >
                <View style={[styles.methodIcon, active && styles.methodIconActive]}>
                  <Ionicons name={m.icon} size={17} color={active ? CREAM : colors.olive[700]} />
                </View>
                <Text style={[styles.methodLabel, active && styles.methodLabelActive]}>
                  {m.label}
                </Text>
                {active ? (
                  <View style={styles.methodCheck}>
                    <Ionicons name="checkmark" size={10} color={CREAM} />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </Section>

      {value.method === "bank" ? (
        <Section icon="business-outline" title="Bank details">
          <Text style={styles.label}>Institution</Text>
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
          <Input
            label="Account holder name"
            value={value.account_name ?? ""}
            onChangeText={(t) => onChange({ ...value, account_name: t })}
            placeholder="e.g. Aura Boutique"
          />
          <View style={styles.inputRow}>
            <View style={{ flex: 1 }}>
              <Input
                label="Account · last 4"
                value={value.account_number_last4 ?? ""}
                onChangeText={(t) => onChange({ ...value, account_number_last4: t.replace(/\D/g, "").slice(0, 4) })}
                keyboardType="number-pad"
                maxLength={4}
                placeholder="1234"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                label="Branch / SWIFT"
                value={value.ifsc ?? ""}
                onChangeText={(t) => onChange({ ...value, ifsc: t.toUpperCase() })}
                autoCapitalize="characters"
                placeholder="CCBLKLJA"
              />
            </View>
          </View>
        </Section>
      ) : value.method === "upi" ? (
        <Section icon="flash-outline" title="UPI details">
          <Input
            label="UPI virtual payment address"
            value={value.upi ?? ""}
            onChangeText={(t) => onChange({ ...value, upi: t })}
            autoCapitalize="none"
            placeholder="store@okaxis"
          />
        </Section>
      ) : value.method === "paypal" ? (
        <Section icon="logo-paypal" title="PayPal details">
          <Input
            label="PayPal business email"
            value={value.paypal ?? ""}
            onChangeText={(t) => onChange({ ...value, paypal: t })}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="finance@yourstore.lk"
          />
        </Section>
      ) : value.method === "stripe_connect" ? (
        <StripeConnectCard
          hasAccount={Boolean(value.stripe_account_id)}
          accountId={value.stripe_account_id ?? null}
        />
      ) : null}

      <Section icon="calendar-outline" title="Settlement schedule">
        <View style={styles.scheduleList}>
          {SCHEDULES.map((opt, i) => {
            const active = value.schedule === opt.key;
            return (
              <Pressable
                key={opt.key}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${opt.label}, ${opt.detail}`}
                onPress={() => onChange({ ...value, schedule: opt.key })}
                style={[styles.scheduleRow, i > 0 && styles.scheduleRowBorder]}
              >
                <View style={[styles.radio, active && styles.radioActive]}>
                  {active ? <View style={styles.radioDot} /> : null}
                </View>
                <Text style={[styles.scheduleLabel, active && styles.scheduleLabelActive]}>
                  {opt.label}
                </Text>
                <Text style={styles.scheduleDetail}>{opt.detail}</Text>
              </Pressable>
            );
          })}
        </View>
      </Section>

      <View style={styles.taxRow}>
        <View style={[styles.taxIcon]}>
          <Ionicons name="document-text-outline" size={15} color={colors.olive[700]} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.taxTitle}>Tax / W-9 compliance</Text>
          <Text style={styles.hint}>Required for merchant tax filing</Text>
        </View>
        <Switch
          value={Boolean(value.tax_form_submitted)}
          onValueChange={(v) => onChange({ ...value, tax_form_submitted: v })}
          trackColor={{ false: colors.olive[100], true: colors.olive[400] }}
          thumbColor={value.tax_form_submitted ? colors.olive[800] : CREAM}
        />
      </View>
    </View>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: spacing[3] }}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIcon}>
          <Ionicons name={icon} size={13} color={colors.olive[700]} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function Input({ label, ...props }: { label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={{ gap: spacing[2] }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.ink.mute}
        accessibilityLabel={label}
        style={styles.input}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.olive[50],
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 15,
    color: INK,
    letterSpacing: -0.2,
  },
  label: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.ink.mute,
  },
  hint: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.xs,
    color: colors.ink.mute,
    lineHeight: 17,
  },

  methodGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2] },
  methodCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    width: "48%",
    flexGrow: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: radii.xl,
    borderWidth: 1.5,
    borderColor: "rgba(83,94,44,0.16)",
    backgroundColor: CREAM,
  },
  methodCardActive: {
    borderColor: colors.olive[700],
    backgroundColor: colors.olive[50],
  },
  methodIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.olive[50],
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  methodIconActive: {
    backgroundColor: colors.olive[700],
    borderColor: colors.olive[700],
  },
  methodLabel: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.xs,
    color: INK,
    flexShrink: 1,
  },
  methodLabelActive: { color: colors.olive[800] },
  methodCheck: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.olive[700],
    alignItems: "center",
    justifyContent: "center",
  },

  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2] },
  chip: {
    minHeight: 38,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.18)",
    backgroundColor: CREAM,
    justifyContent: "center",
  },
  chipActive: { borderColor: colors.olive[800], backgroundColor: colors.olive[800] },
  chipText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: typography.fontSizes.xs,
    color: colors.ink.soft,
  },
  chipTextActive: { color: CREAM, fontFamily: fontFamilies.sans.semibold },

  inputRow: { flexDirection: "row", gap: spacing[3] },
  input: {
    minHeight: 46,
    paddingHorizontal: 13,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.18)",
    backgroundColor: colors.paper.DEFAULT,
    color: INK,
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
  },

  scheduleList: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.14)",
    backgroundColor: CREAM,
    overflow: "hidden",
  },
  scheduleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  scheduleRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(83,94,44,0.12)",
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: "rgba(83,94,44,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  radioActive: { borderColor: colors.olive[700] },
  radioDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.olive[700],
  },
  scheduleLabel: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: typography.fontSizes.sm,
    color: colors.ink.soft,
  },
  scheduleLabelActive: {
    fontFamily: fontFamilies.sans.semibold,
    color: INK,
  },
  scheduleDetail: {
    marginLeft: "auto",
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.xs,
    color: colors.ink.mute,
  },

  taxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(83,94,44,0.14)",
  },
  taxIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.olive[50],
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  taxTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.sm,
    color: INK,
  },
});
