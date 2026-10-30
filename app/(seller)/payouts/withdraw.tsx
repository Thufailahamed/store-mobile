import React, { useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  ScrollView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@/components/ui/Icon";
import { SellerGlow } from "@/components/seller/chrome";
import { getPayoutBalanceBackend, getPayoutsBackend, withdrawPayoutBackend } from "@/lib/api/backend";
import { generateIdempotencyKey } from "@/lib/payouts/idempotency";
import { coercePayoutSettings, isPayoutKycError, payoutKycUserMessage } from "@/lib/payouts/settings";
import { payoutUserMessage } from "@/lib/payouts/ledger";
import { formatPrice } from "@/lib/utils";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  HERO,
  LuxeHero,
  LuxeSectionHeader,
  PayoutAccountCard,
  PressScale,
  describeAccount,
} from "@/components/payouts/PayoutSurfaces";

const CREAM = colors.paper.cream;
const INK = colors.olive[950];
const GOLD = colors.accent2.ochre;
const RUST = colors.accent2.rust;
const MIN_WITHDRAWAL = 100;

const QUICK = [
  { key: "25", label: "25%", f: 0.25 },
  { key: "50", label: "50%", f: 0.5 },
  { key: "75", label: "75%", f: 0.75 },
  { key: "max", label: "Max", f: 1 },
] as const;

function money(n: number | null | undefined, currency = "LKR"): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return formatPrice(n, currency);
}

function withCommas(raw: string) {
  if (!raw) return "";
  return Number(raw).toLocaleString("en-US");
}

export default function WithdrawScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const inputRef = useRef<TextInput>(null);
  const balance = useQuery({ queryKey: ["payout-balance"], queryFn: getPayoutBalanceBackend });
  const list = useQuery({ queryKey: ["payouts"], queryFn: getPayoutsBackend });
  const [amount, setAmount] = useState("");
  const [focused, setFocused] = useState(false);

  const parsed = amount ? Number(amount) : NaN;
  const bal = balance.data?.ok ? balance.data.data : null;
  const available = bal?.available;
  const currency = bal?.currency ?? "LKR";
  const settings = list.data?.ok && list.data.data.payout ? coercePayoutSettings(list.data.data.payout) : null;
  const account = describeAccount(settings);
  const hasBalance = available != null && Number.isFinite(available);

  const error: string | null = !amount
    ? null
    : !Number.isFinite(parsed)
      ? "Enter a valid amount"
      : parsed < MIN_WITHDRAWAL
        ? `Minimum withdrawal is ${money(MIN_WITHDRAWAL, currency)}`
        : hasBalance && parsed > available!
          ? `That’s more than your available ${money(available, currency)}`
          : null;

  const valid = !!amount && !error && hasBalance;
  const remaining = hasBalance && Number.isFinite(parsed) ? Math.max(available! - parsed, 0) : available;
  const pct = hasBalance && available! > 0 && Number.isFinite(parsed) ? Math.min(parsed / available!, 1) : 0;

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
        Alert.alert("Verify your identity first", payoutKycUserMessage(res.error ?? ""), [
          { text: "Not now", style: "cancel" },
          { text: "Verify now", onPress: () => router.push("/(seller)/payouts/verify" as never) },
        ]);
      } else Alert.alert("Withdraw failed", payoutUserMessage(res.error, "Try again."));
    },
    onError: (e: unknown) =>
      Alert.alert("Withdraw failed", e instanceof Error ? e.message : "Try again."),
  });

  const balanceError =
    balance.data && !balance.data.ok
      ? payoutUserMessage(balance.data.error, "Couldn’t load payout balance. Pull back and retry.")
      : null;

  const pickQuick = (f: number) => {
    if (!hasBalance) return;
    setAmount(String(Math.floor(available! * f)));
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SellerGlow />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, 12) + 8 }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <PressScale style={styles.backBtn} onPress={() => router.back()} accessibilityLabel="Back">
              <Ionicons name="chevron-back" size={20} color={INK} />
            </PressScale>
            <View style={{ flex: 1 }}>
              <Text style={styles.title} accessibilityRole="header">Withdraw</Text>
            </View>
            <View style={styles.secureBadge}>
              <Ionicons name="lock-closed" size={11} color={colors.olive[700]} />
              <Text style={styles.secureBadgeText}>Secure</Text>
            </View>
          </View>

          {/* Amount composer */}
          <LuxeHero>
            <View style={styles.heroTop}>
              <Text style={styles.heroKicker}>AMOUNT TO WITHDRAW</Text>
              <Text style={styles.heroAvail} numberOfLines={1}>
                {balance.isLoading ? "Loading…" : `of ${money(available, currency)}`}
              </Text>
            </View>

            <Pressable
              onPress={() => inputRef.current?.focus()}
              style={[styles.amountField, focused && styles.amountFieldFocused, !!error && styles.amountFieldError]}
            >
              <Text style={styles.currency}>{currency}</Text>
              <View style={styles.amountInputWrap}>
                {!amount ? <Text style={styles.amountPlaceholder}>0</Text> : null}
                <Text style={styles.amountMirror} numberOfLines={1} adjustsFontSizeToFit>
                  {withCommas(amount)}
                </Text>
                <TextInput
                  ref={inputRef}
                  accessibilityLabel="Withdraw amount"
                  keyboardType="number-pad"
                  value={amount}
                  onChangeText={(t) => setAmount(t.replace(/[^0-9]/g, "").replace(/^0+/, ""))}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  maxLength={9}
                  caretHidden
                  style={styles.hiddenInput}
                />
              </View>
              {focused ? <View style={styles.caret} /> : null}
            </Pressable>

            <View style={styles.meter}>
              <View style={[styles.meterFill, { width: `${pct * 100}%` }, !!error && { backgroundColor: RUST }]} />
            </View>

            <View style={styles.quickRow}>
              {QUICK.map((q) => {
                const active = hasBalance && amount !== "" && Number(amount) === Math.floor(available! * q.f);
                return (
                  <PressScale
                    key={q.key}
                    onPress={() => pickQuick(q.f)}
                    disabled={!hasBalance}
                    style={[styles.quickChip, active && styles.quickChipActive]}
                    accessibilityLabel={`Withdraw ${q.label}`}
                  >
                    <Text style={[styles.quickText, active && styles.quickTextActive]}>{q.label}</Text>
                  </PressScale>
                );
              })}
            </View>

            <View style={styles.helperRow}>
              <Ionicons
                name={error ? "alert-circle" : "information-circle-outline"}
                size={13}
                color={error ? RUST : HERO.mute}
              />
              <Text style={[styles.helper, !!error && styles.helperError]}>
                {balanceError ?? error ?? `Minimum ${money(MIN_WITHDRAWAL, currency)} · whole amounts only`}
              </Text>
            </View>
          </LuxeHero>

          {/* Destination */}
          <LuxeSectionHeader eyebrow="DESTINATION" title="Sending to" />
          {list.isLoading ? (
            <Skeleton height={132} borderRadius={24} />
          ) : (
            <PayoutAccountCard
              settings={settings}
              compact
              kicker="FUNDS ARRIVE IN"
              actionLabel={settings ? "Change" : "Set up"}
              onPress={() => router.push("/(seller)/payouts/settings")}
            />
          )}

          {/* Summary */}
          <LuxeSectionHeader eyebrow="REVIEW" title="Summary" />
          <View style={styles.summaryCard}>
            <SummaryRow label="Withdrawal amount" value={valid ? money(parsed, currency) : "—"} />
            <SummaryRow label="Method" value={account.methodLabel} />
            <SummaryRow label="Balance after" value={money(valid ? remaining : available, currency)} muted />
            <View style={styles.summaryDivider} />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>You’ll receive</Text>
              <Text style={styles.totalValue} numberOfLines={1} adjustsFontSizeToFit>
                {valid ? money(parsed, currency) : "—"}
              </Text>
            </View>
          </View>

          <View style={styles.noteRow}>
            <Ionicons name="shield-checkmark-outline" size={14} color={colors.olive[600]} />
            <Text style={styles.noteText}>
              Each request is sent once — retries won’t create duplicate payouts. Status updates appear in your payout history.
            </Text>
          </View>
        </ScrollView>

        {/* Sticky CTA */}
        <View style={[styles.footer, { paddingBottom: 12 }]}>
          <PressScale
            style={[styles.submitBtn, (!valid || mutation.isPending) && styles.submitBtnDisabled]}
            onPress={() => mutation.mutate()}
            disabled={!valid || mutation.isPending}
            accessibilityLabel="Submit withdrawal"
          >
            <Ionicons
              name={mutation.isPending ? "hourglass-outline" : "arrow-up-circle-outline"}
              size={18}
              color={valid ? INK : colors.olive[600]}
            />
            <Text style={[styles.submitText, valid && { color: INK }]}>
              {mutation.isPending
                ? "Submitting…"
                : valid
                  ? `Withdraw ${money(parsed, currency)}`
                  : "Enter an amount"}
            </Text>
          </PressScale>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function SummaryRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, muted && { color: colors.ink.mute }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f7f2" },
  content: { paddingHorizontal: spacing[5], paddingBottom: 24 },

  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 },
  backBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
  },
  kicker: { fontFamily: fontFamilies.mono.semibold, fontSize: 9, letterSpacing: 1.4, color: colors.olive[600], marginBottom: 2 },
  title: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 31,
    color: INK,
    letterSpacing: -0.8,
  },
  secureBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.olive[50],
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.14)",
  },
  secureBadgeText: { fontFamily: fontFamilies.sans.semibold, fontSize: 11, color: colors.olive[700] },

  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  heroKicker: { fontFamily: fontFamilies.mono.medium, fontSize: 9.5, letterSpacing: 1.5, color: HERO.kicker },
  heroAvail: { flexShrink: 1, fontFamily: fontFamilies.display.italic, fontSize: 13, color: HERO.mute },

  amountField: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    minHeight: 64,
    borderRadius: 18,
    backgroundColor: "#fffdf8",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: HERO.chipBorder,
  },
  amountFieldFocused: { borderColor: GOLD, borderWidth: 1 },
  amountFieldError: { borderColor: RUST, borderWidth: 1 },
  currency: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 11,
    letterSpacing: 1,
    color: HERO.text,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: HERO.tile,
    overflow: "hidden",
  },
  amountInputWrap: { flex: 1, justifyContent: "center", minWidth: 0 },
  amountPlaceholder: { position: "absolute", fontFamily: fontFamilies.display.regular, fontSize: 34, color: "rgba(83,94,44,0.25)" },
  amountMirror: { fontFamily: fontFamilies.display.regular, fontSize: 34, color: HERO.ink, letterSpacing: -0.9, fontVariant: ["tabular-nums"] },
  hiddenInput: { ...StyleSheet.absoluteFillObject, opacity: 0.02, color: "transparent" },
  caret: { width: 2, height: 28, borderRadius: 1, backgroundColor: GOLD },

  meter: { marginTop: 10, height: 4, borderRadius: 2, backgroundColor: "rgba(83,94,44,0.08)", overflow: "hidden" },
  meterFill: { height: 4, borderRadius: 2, backgroundColor: GOLD },

  quickRow: { flexDirection: "row", gap: 6, marginTop: 10 },
  quickChip: {
    flex: 1,
    minHeight: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: HERO.tile,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: HERO.tileBorder,
  },
  quickChipActive: { backgroundColor: HERO.ink, borderColor: HERO.ink },
  quickText: { fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: HERO.text },
  quickTextActive: { color: CREAM },

  helperRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
  helper: { flex: 1, fontFamily: fontFamilies.sans.regular, fontSize: 11.5, color: HERO.mute },
  helperError: { color: RUST, fontFamily: fontFamilies.sans.medium },

  summaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.12)",
    padding: 18,
    gap: 12,
    shadowColor: colors.olive[950],
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  summaryRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  summaryLabel: { fontFamily: fontFamilies.sans.regular, fontSize: 13.5, color: colors.ink.mute },
  summaryValue: { flexShrink: 1, fontFamily: fontFamilies.sans.semibold, fontSize: 13.5, color: INK, fontVariant: ["tabular-nums"] },
  summaryDivider: { height: 1, borderRadius: 1, backgroundColor: "rgba(83,94,44,0.1)", marginVertical: 2 },
  totalRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  totalLabel: { fontFamily: fontFamilies.sans.semibold, fontSize: 14.5, color: INK },
  totalValue: { flexShrink: 1, fontFamily: fontFamilies.display.semibold, fontSize: 22, color: INK, letterSpacing: -0.4, fontVariant: ["tabular-nums"] },

  noteRow: { flexDirection: "row", gap: 8, marginTop: 16, paddingHorizontal: 4 },
  noteText: { flex: 1, fontFamily: fontFamilies.sans.regular, fontSize: 11.5, lineHeight: 17, color: colors.ink.mute },

  footer: {
    paddingHorizontal: spacing[5],
    paddingTop: 12,
    backgroundColor: colors.paper.DEFAULT,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(83,94,44,0.16)",
  },
  submitBtn: {
    minHeight: 56,
    flexDirection: "row",
    gap: 8,
    borderRadius: radii.full,
    backgroundColor: GOLD,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: GOLD,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  submitBtnDisabled: { backgroundColor: colors.olive[100], shadowOpacity: 0 },
  submitText: { fontFamily: fontFamilies.sans.bold, fontSize: 15, color: colors.olive[600] },
});
