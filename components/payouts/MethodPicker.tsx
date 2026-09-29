import React from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Switch } from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { colors, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { POPULAR_BANKS } from "@/lib/payouts/settings";
import { StripeConnectCard } from "@/components/payouts/StripeConnectCard";
import type { PayoutSettings } from "@/lib/api/backend";

const CREAM = colors.paper.cream;
const INK = colors.olive[950];

type Method = NonNullable<PayoutSettings["method"]>;
type Schedule = NonNullable<PayoutSettings["schedule"]>;

const METHODS: { key: Method; label: string; detail: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "bank", label: "Bank transfer", detail: "Straight to a local bank account", icon: "business-outline" },
  { key: "upi", label: "UPI", detail: "Virtual payment address", icon: "flash-outline" },
  { key: "paypal", label: "PayPal", detail: "Your PayPal business email", icon: "logo-paypal" },
  { key: "stripe_connect", label: "Stripe Connect", detail: "Payouts via a connected Stripe account", icon: "link-outline" },
];

const BANK_SHORT: Record<string, string> = {
  "Commercial Bank of Ceylon": "CB",
  "Sampath Bank": "SMP",
  "Hatton National Bank (HNB)": "HNB",
  "Nations Trust Bank": "NTB",
  "Bank of Ceylon": "BOC",
  "Seylan Bank": "SEY",
};

function bankInitials(name: string): string {
  if (BANK_SHORT[name]) return BANK_SHORT[name];
  const paren = name.match(/\(([^)]+)\)/);
  if (paren) return paren[1].slice(0, 3).toUpperCase();
  return name
    .split(/\s+/)
    .filter((w) => w.length > 2 || /^[A-Z]/.test(w))
    .filter((w) => !/^(of|and|the)$/i.test(w))
    .map((w) => w[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
}

const SCHEDULES: { key: Schedule; label: string; detail: string }[] = [
  { key: "daily", label: "Daily", detail: "Every evening" },
  { key: "weekly", label: "Weekly", detail: "Every Monday" },
  { key: "biweekly", label: "Bi-weekly", detail: "1st & 15th" },
  { key: "monthly", label: "Monthly", detail: "1st of month" },
];

/** One-line description of where and when money goes, for the summary card. */
export function describePayout(value: PayoutSettings): { title: string; detail: string; icon: keyof typeof Ionicons.glyphMap } {
  const method = METHODS.find((m) => m.key === value.method);
  const schedule = SCHEDULES.find((s) => s.key === value.schedule);
  let title = "No payout method yet";
  let target: string | null = null;
  if (value.method === "bank") {
    title = value.bank_name || "Bank transfer";
    target = value.account_number_last4 ? `•••• ${value.account_number_last4}` : "Account not set";
  } else if (value.method === "upi") {
    title = "UPI";
    target = value.upi || "Address not set";
  } else if (value.method === "paypal") {
    title = "PayPal";
    target = value.paypal || "Email not set";
  } else if (value.method === "stripe_connect") {
    title = "Stripe Connect";
    target = value.stripe_account_id ? "Account connected" : "Not connected";
  }
  const when = schedule ? `${schedule.label} (${schedule.detail})` : "No schedule";
  return {
    title,
    detail: [target, when].filter(Boolean).join("  ·  "),
    icon: method?.icon ?? "wallet-outline",
  };
}

interface Props {
  value: PayoutSettings;
  onChange: (next: PayoutSettings) => void;
}

export function MethodPicker({ value, onChange }: Props) {
  const bankName = value.bank_name ?? "";
  const knownBank = POPULAR_BANKS.includes(bankName as (typeof POPULAR_BANKS)[number]);
  const methodLabel = METHODS.find((m) => m.key === value.method)?.label ?? "Payout";

  return (
    <View style={{ gap: spacing[4] }}>
      <Section step={1} title="Payout method" hint="Customers still pay with Payments.lk or cash on delivery — this only controls where your settlements go.">
        <View style={styles.list}>
          {METHODS.map((m, i) => {
            const active = value.method === m.key;
            return (
              <Pressable
                key={m.key}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${m.label}, ${m.detail}`}
                onPress={() => onChange({ ...value, method: m.key })}
                style={({ pressed }) => [
                  styles.listRow,
                  i > 0 && styles.listRowBorder,
                  active && styles.listRowActive,
                  pressed && !active && styles.listRowPressed,
                ]}
              >
                <View style={[styles.methodIcon, active && styles.methodIconActive]}>
                  <Ionicons name={m.icon} size={17} color={active ? CREAM : colors.olive[700]} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.rowTitle, active && styles.rowTitleActive]}>{m.label}</Text>
                  <Text style={styles.rowDetail} numberOfLines={1}>{m.detail}</Text>
                </View>
                <Radio active={active} />
              </Pressable>
            );
          })}
        </View>
      </Section>

      {value.method === "bank" ? (
        <Section step={2} title="Bank account">
          <Text style={styles.label}>Bank</Text>
          <View style={styles.bankGrid}>
            {POPULAR_BANKS.map((b) => {
              const active = bankName === b;
              return (
                <Pressable
                  key={b}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={b}
                  onPress={() => onChange({ ...value, bank_name: b })}
                  style={({ pressed }) => [styles.bankTile, active && styles.bankTileActive, pressed && !active && styles.listRowPressed]}
                >
                  <View style={[styles.bankMono, active && styles.bankMonoActive]}>
                    <Text style={[styles.bankMonoText, active && { color: CREAM }]}>{bankInitials(b)}</Text>
                  </View>
                  <Text style={[styles.bankName, active && styles.rowTitleActive]} numberOfLines={2}>{b}</Text>
                </Pressable>
              );
            })}
          </View>
          {!knownBank && bankName ? (
            <Text style={styles.hint}>Saved bank: {bankName}</Text>
          ) : null}
          <Input
            label="Account holder name"
            icon="person-outline"
            value={value.account_name ?? ""}
            onChangeText={(t) => onChange({ ...value, account_name: t })}
            placeholder="e.g. Aura Boutique"
          />
          <View style={styles.inputRow}>
            <View style={{ flex: 1 }}>
              <Input
                label="Account · last 4"
                prefix="••••"
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
                icon="git-branch-outline"
                value={value.ifsc ?? ""}
                onChangeText={(t) => onChange({ ...value, ifsc: t.toUpperCase() })}
                autoCapitalize="characters"
                placeholder="CCBLKLJA"
              />
            </View>
          </View>
          <View style={styles.secureNote}>
            <Ionicons name="lock-closed-outline" size={12} color={colors.olive[700]} />
            <Text style={styles.secureText}>We only store the last 4 digits of your account number.</Text>
          </View>
        </Section>
      ) : value.method === "upi" ? (
        <Section step={2} title="UPI details">
          <Input
            label="UPI virtual payment address"
            icon="at-outline"
            value={value.upi ?? ""}
            onChangeText={(t) => onChange({ ...value, upi: t })}
            autoCapitalize="none"
            placeholder="store@okaxis"
          />
        </Section>
      ) : value.method === "paypal" ? (
        <Section step={2} title="PayPal details">
          <Input
            label="PayPal business email"
            icon="mail-outline"
            value={value.paypal ?? ""}
            onChangeText={(t) => onChange({ ...value, paypal: t })}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="finance@yourstore.lk"
          />
        </Section>
      ) : value.method === "stripe_connect" ? (
        <Section step={2} title="Stripe account">
          <StripeConnectCard
            hasAccount={Boolean(value.stripe_account_id)}
            accountId={value.stripe_account_id ?? null}
          />
        </Section>
      ) : null}

      <Section step={value.method ? 3 : 2} title="Schedule" hint={`How often your ${methodLabel.toLowerCase()} settlement runs.`}>
        <View style={styles.scheduleGrid}>
          {SCHEDULES.map((opt) => {
            const active = value.schedule === opt.key;
            return (
              <Pressable
                key={opt.key}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${opt.label}, ${opt.detail}`}
                onPress={() => onChange({ ...value, schedule: opt.key })}
                style={({ pressed }) => [styles.scheduleTile, active && styles.scheduleTileActive, pressed && !active && styles.listRowPressed]}
              >
                <Text style={[styles.scheduleLabel, active && styles.scheduleLabelActive]}>{opt.label}</Text>
                <Text style={[styles.scheduleDetail, active && styles.scheduleDetailActive]}>{opt.detail}</Text>
              </Pressable>
            );
          })}
        </View>
      </Section>

      <View style={styles.card}>
        <Pressable
          style={styles.taxRow}
          onPress={() => onChange({ ...value, tax_form_submitted: !value.tax_form_submitted })}
          accessibilityRole="switch"
          accessibilityState={{ checked: Boolean(value.tax_form_submitted) }}
          accessibilityLabel="Tax / W-9 compliance submitted"
        >
          <View style={styles.taxIcon}>
            <Ionicons name="document-text-outline" size={16} color={colors.olive[700]} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Tax / W-9 compliance</Text>
            <Text style={styles.rowDetail}>
              {value.tax_form_submitted ? "Marked as submitted" : "Required for merchant tax filing"}
            </Text>
          </View>
          <Switch
            value={Boolean(value.tax_form_submitted)}
            onValueChange={(v) => onChange({ ...value, tax_form_submitted: v })}
            trackColor={{ false: colors.olive[100], true: colors.olive[600] }}
            thumbColor="#FFFFFF"
          />
        </Pressable>
      </View>
    </View>
  );
}

function Radio({ active }: { active: boolean }) {
  return (
    <View style={[styles.radio, active && styles.radioActive]}>
      {active ? <Ionicons name="checkmark" size={12} color={CREAM} /> : null}
    </View>
  );
}

function Section({
  step,
  title,
  hint,
  children,
}: {
  step: number;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.sectionHeader}>
        <View style={styles.stepBadge}>
          <Text style={styles.stepText}>{step}</Text>
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {hint ? <Text style={[styles.hint, { marginTop: -4 }]}>{hint}</Text> : null}
      {children}
    </View>
  );
}

function Input({
  label,
  icon,
  prefix,
  ...props
}: { label: string; icon?: keyof typeof Ionicons.glyphMap; prefix?: string } & React.ComponentProps<typeof TextInput>) {
  const [focused, setFocused] = React.useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputWrap, focused && styles.inputWrapFocused]}>
        {icon ? <Ionicons name={icon} size={15} color={focused ? colors.olive[800] : colors.ink.mute} /> : null}
        {prefix ? <Text style={styles.inputPrefix}>{prefix}</Text> : null}
        <TextInput
          placeholderTextColor="rgba(101,104,77,0.55)"
          accessibilityLabel={label}
          style={styles.input}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...props}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.12)",
    padding: 16,
    gap: spacing[3],
  },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.olive[900],
    alignItems: "center",
    justifyContent: "center",
  },
  stepText: { fontFamily: fontFamilies.mono.semibold, fontSize: 11, color: CREAM },
  sectionTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 18,
    color: INK,
    letterSpacing: -0.2,
  },
  label: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.ink.mute,
  },
  hint: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.ink.mute,
    lineHeight: 17,
  },

  list: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.14)",
    overflow: "hidden",
  },
  listRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 12 },
  listRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(83,94,44,0.14)" },
  listRowActive: { backgroundColor: colors.olive[50] },
  listRowPressed: { backgroundColor: "rgba(83,94,44,0.04)" },
  methodIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: colors.olive[50],
    alignItems: "center",
    justifyContent: "center",
  },
  methodIconActive: { backgroundColor: colors.olive[800] },
  rowTitle: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: colors.ink.soft },
  rowTitleActive: { color: INK },
  rowDetail: { marginTop: 1, fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.ink.mute },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: "rgba(83,94,44,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  radioActive: { borderColor: colors.olive[800], backgroundColor: colors.olive[800] },

  bankGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  bankTile: {
    width: "48%",
    flexGrow: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    minHeight: 56,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.16)",
  },
  bankTileActive: { borderColor: colors.olive[800], borderWidth: 1.5, backgroundColor: colors.olive[50] },
  bankMono: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: colors.paper.DEFAULT,
    alignItems: "center",
    justifyContent: "center",
  },
  bankMonoActive: { backgroundColor: colors.olive[800] },
  bankMonoText: { fontFamily: fontFamilies.mono.semibold, fontSize: 10, letterSpacing: 0.3, color: colors.olive[800] },
  bankName: { flex: 1, fontFamily: fontFamilies.sans.medium, fontSize: 12, lineHeight: 15, color: colors.ink.soft },

  inputRow: { flexDirection: "row", gap: spacing[3] },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.18)",
    backgroundColor: colors.paper.DEFAULT,
  },
  inputWrapFocused: { borderColor: colors.olive[700], backgroundColor: "#FFFFFF" },
  inputPrefix: { fontFamily: fontFamilies.mono.medium, fontSize: 13, color: colors.ink.mute },
  input: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 12,
    color: INK,
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
  },
  secureNote: { flexDirection: "row", alignItems: "center", gap: 6 },
  secureText: { flex: 1, fontFamily: fontFamilies.sans.regular, fontSize: 11, color: colors.olive[700] },

  scheduleGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  scheduleTile: {
    width: "48%",
    flexGrow: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.16)",
  },
  scheduleTileActive: { backgroundColor: colors.olive[900], borderColor: colors.olive[900] },
  scheduleLabel: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: colors.ink.soft },
  scheduleLabelActive: { color: CREAM },
  scheduleDetail: { marginTop: 2, fontFamily: fontFamilies.sans.regular, fontSize: 11, color: colors.ink.mute },
  scheduleDetailActive: { color: "rgba(250,248,241,0.7)" },

  taxRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  taxIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: colors.olive[50],
    alignItems: "center",
    justifyContent: "center",
  },
});
