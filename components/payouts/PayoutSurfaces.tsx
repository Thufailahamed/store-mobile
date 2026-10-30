import React from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { HERO, LuxeHero, LuxeSectionHeader, PressScale } from "@/components/seller/luxe";
import { bankMonogram } from "@/lib/payouts/banks";
import { Ionicons } from "@/components/ui/Icon";
import { colors } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import type { PayoutSettings } from "@/lib/api/backend";

export { HERO, LuxeHero, LuxeSectionHeader, PressScale };

const CREAM = colors.paper.cream;

type IconName = keyof typeof Ionicons.glyphMap;

const METHOD_LABEL: Record<string, { label: string; icon: IconName }> = {
  bank: { label: "Bank transfer", icon: "business-outline" },
};

const SCHEDULE_LABEL: Record<string, string> = {
  daily: "Daily",
  weekly: "Weekly · Mon",
  biweekly: "1st & 15th",
  monthly: "Monthly · 1st",
};

export function describeAccount(settings: PayoutSettings | null) {
  const method = settings?.method ?? null;
  const meta = METHOD_LABEL[method ?? ""] ?? { label: "No method", icon: "wallet-outline" as IconName };
  let title = meta.label;
  let number: string | null = null;
  let holder: string | null = settings?.account_name || null;
  if (method === "bank") {
    title = settings?.bank_name || "Bank transfer";
    number = settings?.account_number_last4 ? `••••  ••••  ${settings.account_number_last4}` : null;
  }
  return {
    method,
    title,
    number,
    holder,
    icon: meta.icon,
    methodLabel: meta.label,
    schedule: settings?.schedule ? SCHEDULE_LABEL[settings.schedule] ?? settings.schedule : null,
    complete: !!method && !!number,
  };
}

/**
 * Light hero summary of the payout destination. Used on the Payouts overview,
 * Withdraw review, and Payout settings.
 */
export function PayoutAccountCard({
  settings,
  kicker = "PAYING OUT TO",
  onPress,
  actionLabel,
  compact,
  style,
}: {
  settings: PayoutSettings | null;
  kicker?: string;
  onPress?: () => void;
  actionLabel?: string;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const a = describeAccount(settings);
  const bankName = a.method === "bank" ? settings?.bank_name ?? null : null;
  const body = (
    <LuxeHero style={style}>
      <View style={styles.cardTop}>
        <Text style={styles.cardKicker}>{kicker}</Text>
        <View style={[styles.statusPill, a.complete ? styles.statusReady : styles.statusMissing]}>
          <View style={[styles.statusDot, { backgroundColor: a.complete ? colors.olive[500] : colors.accent2.rust }]} />
          <Text style={[styles.statusText, { color: a.complete ? colors.olive[800] : colors.accent2.rust }]}>
            {a.complete ? "Ready" : "Incomplete"}
          </Text>
        </View>
      </View>

      <View style={styles.cardMid}>
        <View style={styles.mono}>
          {bankName ? (
            <Text style={styles.monoText}>{bankMonogram(bankName)}</Text>
          ) : (
            <Ionicons name={a.icon} size={16} color={CREAM} />
          )}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.cardTitle} numberOfLines={1}>{a.title}</Text>
          <Text style={[styles.cardNumber, !a.number && styles.cardNumberMissing]} numberOfLines={1}>
            {a.number ?? (a.method ? "Account number not set" : "Add a payout method")}
          </Text>
        </View>
      </View>

      <View style={styles.cardBottom}>
        {!compact ? (
          <View style={styles.metaRow}>
            {a.holder ? <MetaChip icon="person-outline" label={a.holder} /> : null}
            {a.schedule ? <MetaChip icon="calendar-outline" label={a.schedule} /> : null}
            {!a.holder && !a.schedule ? <Text style={styles.cardMeta}>Set a schedule in settings</Text> : null}
          </View>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        {actionLabel ? (
          <View style={styles.cardAction}>
            <Text style={styles.cardActionText}>{actionLabel}</Text>
            <Ionicons name="chevron-forward" size={12} color={CREAM} />
          </View>
        ) : null}
      </View>
    </LuxeHero>
  );

  if (!onPress) return body;
  return (
    <PressScale onPress={onPress} accessibilityLabel={`${kicker}: ${a.title}`}>
      {body}
    </PressScale>
  );
}

function MetaChip({ icon, label }: { icon: IconName; label: string }) {
  return (
    <View style={styles.metaChip}>
      <Ionicons name={icon} size={11} color={HERO.text} />
      <Text style={styles.metaChipText} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  cardKicker: { fontFamily: fontFamilies.mono.medium, fontSize: 9.5, letterSpacing: 1.5, color: HERO.kicker },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  statusReady: { backgroundColor: "rgba(106,118,57,0.10)", borderColor: "rgba(106,118,57,0.3)" },
  statusMissing: { backgroundColor: "rgba(184,92,58,0.08)", borderColor: "rgba(184,92,58,0.28)" },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontFamily: fontFamilies.mono.semibold, fontSize: 8.5, letterSpacing: 0.8, textTransform: "uppercase" },
  cardMid: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12 },
  mono: { minWidth: 44, height: 44, paddingHorizontal: 5, borderRadius: 13, backgroundColor: colors.olive[900], alignItems: "center", justifyContent: "center" },
  monoText: { fontFamily: fontFamilies.mono.semibold, fontSize: 11, letterSpacing: 0.4, color: CREAM },
  cardTitle: { fontFamily: fontFamilies.display.semibold, fontSize: 18, color: HERO.ink, letterSpacing: -0.2 },
  cardNumber: { marginTop: 2, fontFamily: fontFamilies.mono.semibold, fontSize: 13, letterSpacing: 1, color: HERO.text },
  cardNumberMissing: { fontFamily: fontFamilies.sans.medium, fontSize: 12.5, letterSpacing: 0, color: colors.accent2.rust },
  cardBottom: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12 },
  metaRow: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 6 },
  metaChip: { flexDirection: "row", alignItems: "center", gap: 4, maxWidth: "100%", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: HERO.tile, borderWidth: StyleSheet.hairlineWidth, borderColor: HERO.tileBorder },
  metaChipText: { flexShrink: 1, fontFamily: fontFamilies.sans.medium, fontSize: 11, color: HERO.text },
  cardMeta: { fontFamily: fontFamilies.sans.regular, fontSize: 11.5, color: HERO.mute },
  cardAction: { flexDirection: "row", alignItems: "center", gap: 3, paddingLeft: 12, paddingRight: 9, paddingVertical: 7, borderRadius: 999, backgroundColor: HERO.ink },
  cardActionText: { fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: CREAM },
});
