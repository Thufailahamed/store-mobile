import React from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Switch } from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { colors, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { BankPicker } from "@/components/payouts/BankPicker";
import type { PayoutSettings } from "@/lib/api/backend";

const CREAM = colors.paper.cream;
const INK = colors.olive[950];

type Schedule = NonNullable<PayoutSettings["schedule"]>;

const SCHEDULES: { key: Schedule; label: string; detail: string }[] = [
  { key: "daily", label: "Daily", detail: "Every evening" },
  { key: "weekly", label: "Weekly", detail: "Every Monday" },
  { key: "biweekly", label: "Bi-weekly", detail: "1st & 15th" },
  { key: "monthly", label: "Monthly", detail: "1st of month" },
];

/** One-line description of where and when money goes, for the summary card. */
export function describePayout(value: PayoutSettings): { title: string; detail: string; icon: keyof typeof Ionicons.glyphMap } {
  const schedule = SCHEDULES.find((s) => s.key === value.schedule);
  const title = value.bank_name || "Bank transfer";
  const target = value.account_number_last4 ? `•••• ${value.account_number_last4}` : "Account not set";
  const when = schedule ? `${schedule.label} (${schedule.detail})` : "No schedule";
  return {
    title,
    detail: [target, when].filter(Boolean).join("  ·  "),
    icon: "business-outline",
  };
}

interface Props {
  value: PayoutSettings;
  onChange: (next: PayoutSettings) => void;
}

export function MethodPicker({ value, onChange }: Props) {
  const bankName = value.bank_name ?? "";
  const hasSavedAccount = Boolean(value.account_number_last4);

  return (
    <View style={{ gap: spacing[4] }}>
      <Section step={1} title="Bank account" hint="Payouts are sent by bank transfer. Your full account number is used only to send them.">
        <View style={{ gap: 6 }}>
          <Text style={styles.label}>Bank</Text>
          <BankPicker value={bankName} onChange={(name) => onChange({ ...value, bank_name: name })} />
        </View>
        <Input
          label="Account holder name"
          icon="person-outline"
          value={value.account_name ?? ""}
          onChangeText={(t) => onChange({ ...value, account_name: t })}
          placeholder="e.g. Aura Boutique"
        />
        <Input
          label={hasSavedAccount ? "Account number · leave blank to keep current" : "Account number"}
          icon="card-outline"
          value={value.account_number ?? ""}
          onChangeText={(t) => onChange({ ...value, account_number: t.replace(/\D/g, "").slice(0, 20) })}
          keyboardType="number-pad"
          maxLength={20}
          placeholder={hasSavedAccount ? `•••• ${value.account_number_last4}` : "Full account number"}
        />
        <Input
          label="Branch / SWIFT (optional)"
          icon="git-branch-outline"
          value={value.ifsc ?? ""}
          onChangeText={(t) => onChange({ ...value, ifsc: t.toUpperCase() })}
          autoCapitalize="characters"
          placeholder="CCBLKLJA"
        />
        <View style={styles.secureNote}>
          <Ionicons name="lock-closed-outline" size={12} color={colors.olive[700]} />
          <Text style={styles.secureText}>Used only to send your payouts. After saving, only the last 4 digits are shown.</Text>
        </View>
      </Section>

      <Section step={2} title="Schedule" hint="How often your bank transfer settlement runs.">
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
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.12)",
    padding: 18,
    gap: spacing[3],
    shadowColor: INK,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
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

  listRowPressed: { backgroundColor: "rgba(83,94,44,0.04)" },
  rowTitle: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: colors.ink.soft },
  rowTitleActive: { color: INK },
  rowDetail: { marginTop: 1, fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.ink.mute },

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
