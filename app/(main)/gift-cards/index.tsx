import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@/components/ui/Icon";
import { PaperBackground } from "@/components/layout";
import { useAuth } from "@/lib/supabase/auth";
import { useToast } from "@/components/ui";
import { getGiftCardPaymentsLkSession } from "@/lib/api/payments";
import { runPaymentsLkCheckout } from "@/lib/paymentslk-checkout";
import { colors, radii, shadows, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";

const AMOUNTS = [2500, 5000, 10000, 20000, 50000, 100000];
const MIN_AMOUNT = AMOUNTS[0];

export default function GiftCardsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { toast } = useToast();

  const params = useLocalSearchParams<{ amount?: string }>();
  const [amount, setAmount] = useState(5000);
  const [customAmountStr, setCustomAmountStr] = useState("5000");

  // Optional preset from links (e.g. the account vouchers screen's amount tiles).
  // An effect rather than initial state, since the screen can be reused across navigations.
  const presetParam = Array.isArray(params.amount) ? params.amount[0] : params.amount;
  useEffect(() => {
    const n = Number(presetParam);
    if (!presetParam || !Number.isFinite(n) || n < MIN_AMOUNT) return;
    setAmount(Math.round(n));
    setCustomAmountStr(String(Math.round(n)));
  }, [presetParam]);
  const [recipient, setRecipient] = useState({ name: "", email: "", message: "" });
  const [scheduled, setScheduled] = useState(false);
  const [scheduledHours, setScheduledHours] = useState("24");
  const [purchasing, setPurchasing] = useState(false);

  const isAmountValid = Number.isFinite(amount) && amount >= MIN_AMOUNT;

  const handleSelectAmount = (val: number) => {
    setAmount(val);
    setCustomAmountStr(String(val));
  };

  const handleCustomAmountChange = (text: string) => {
    setCustomAmountStr(text);
    const num = Number(text.replace(/[^0-9]/g, "")) || 0;
    setAmount(num);
  };

  const onPurchase = async () => {
    if (!user) {
      router.push("/(auth)/login" as any);
      return;
    }
    if (!isAmountValid) {
      Alert.alert(
        "Invalid amount",
        `Enter an amount of at least ${formatPrice(MIN_AMOUNT)}.`
      );
      return;
    }
    if (!recipient.email.includes("@")) {
      Alert.alert("Recipient Email Required", "Please enter a valid recipient email address.");
      return;
    }

    let scheduled_for: string | undefined;
    if (scheduled) {
      const hours = Number(scheduledHours);
      if (!Number.isFinite(hours) || hours <= 0) {
        Alert.alert("Invalid Schedule", "Please enter scheduled hours greater than 0.");
        return;
      }
      scheduled_for = new Date(Date.now() + hours * 3_600_000).toISOString();
    }

    setPurchasing(true);
    try {
      const res = await getGiftCardPaymentsLkSession({
        amount,
        currency: "LKR",
        recipient_email: recipient.email.trim().toLowerCase(),
        recipient_name: recipient.name.trim() || undefined,
        message: recipient.message.trim() || undefined,
        scheduled_for,
      });

      if (!res.ok) {
        Alert.alert("Payment Initiation Failed", res.error);
        return;
      }

      const result = await runPaymentsLkCheckout(res.data.url);
      if (result.status === "succeeded") {
        toast("Payment submitted — gift voucher is being dispatched!", "success");
        router.push("/(main)/account/gift-cards" as any);
      } else if (result.status !== "dismissed") {
        toast("Payment was not completed — the voucher was not charged", "info");
      }
    } finally {
      setPurchasing(false);
    }
  };

  const shownAmount = isAmountValid ? amount : MIN_AMOUNT;
  const scheduleHoursNum = Number(scheduledHours);
  const scheduleValid = Number.isFinite(scheduleHoursNum) && scheduleHoursNum > 0;
  const arrivesAt =
    scheduled && scheduleValid
      ? new Date(Date.now() + scheduleHoursNum * 3_600_000).toLocaleString(undefined, {
          weekday: "short",
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;
  const canPay = !!recipient.email && isAmountValid && !purchasing;
  const recipientLabel = recipient.name.trim() || recipient.email.trim() || "Your recipient";

  return (
    <PaperBackground>
      <SafeAreaView style={styles.container} edges={["top"]}>
        {/* Navigation */}
        <View style={styles.navBar}>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={20} color={colors.light.foreground} />
          </TouchableOpacity>

          <Text style={styles.navTitle}>Send a gift</Text>

          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => router.push("/(main)/gift-cards/redeem" as any)}
            activeOpacity={0.7}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Redeem a voucher"
          >
            <Ionicons name="ticket-outline" size={18} color={colors.light.foreground} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 130 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Heading */}
          <View>
            <View style={styles.eyebrowRow}>
              <View style={styles.eyebrowRule} />
              <Text style={styles.eyebrow}>Digital gifting</Text>
            </View>
            <Text style={styles.pageTitle}>
              Send a <Text style={styles.pageTitleAccent}>gift.</Text>
            </Text>
            <Text style={styles.pageSub}>
              Store credit for someone special — valid across every boutique on LUXE.
            </Text>
          </View>

          {/* Live preview — the gift card itself */}
          <View style={styles.previewShadow}>
            <LinearGradient
              colors={["#2c3119", "#181b0f", "#0e1009"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.previewCard}
            >
              <LinearGradient
                colors={["rgba(232,207,143,0)", "rgba(232,207,143,0.22)", "rgba(232,207,143,0)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.ribbonV}
                pointerEvents="none"
              />
              <LinearGradient
                colors={["rgba(232,207,143,0)", "rgba(232,207,143,0.16)", "rgba(232,207,143,0)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.ribbonH}
                pointerEvents="none"
              />
              <LinearGradient
                colors={["rgba(255,255,255,0.09)", "rgba(255,255,255,0)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0.6, y: 0.6 }}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />

              <View style={styles.previewTop}>
                <View>
                  <Text style={styles.previewWordmark}>LUXE</Text>
                  <Text style={styles.previewTag}>Gift card · Live preview</Text>
                </View>
                <LinearGradient
                  colors={[GOLD_SOFT, GOLD, GOLD_DEEP]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.previewBow}
                >
                  <Ionicons name="gift" size={18} color={colors.olive[950]} />
                </LinearGradient>
              </View>

              <Text style={styles.previewValue} numberOfLines={1} adjustsFontSizeToFit>
                {formatPrice(shownAmount)}
              </Text>
              <Text style={styles.previewValueLabel}>Store credit</Text>

              {recipient.message.trim() ? (
                <View style={styles.previewMessage}>
                  <Text style={styles.previewQuote}>“</Text>
                  <Text style={styles.previewMessageText} numberOfLines={2}>
                    {recipient.message.trim()}
                  </Text>
                </View>
              ) : null}

              <View style={styles.previewFooter}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.previewFootLabel}>FOR</Text>
                  <Text style={styles.previewFootValue} numberOfLines={1}>{recipientLabel}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.previewFootLabel}>DELIVERY</Text>
                  <Text style={styles.previewFootValue} numberOfLines={1}>
                    {arrivesAt ?? "Instantly"}
                  </Text>
                </View>
              </View>
            </LinearGradient>
          </View>

          {/* Trust strip */}
          <View style={styles.trustRow}>
            {TRUST.map((t) => (
              <View key={t.label} style={styles.trustItem}>
                <Ionicons name={t.icon} size={13} color={GOLD_DEEP} />
                <Text style={styles.trustText}>{t.label}</Text>
              </View>
            ))}
          </View>

          {/* Step 1 — value */}
          <View style={styles.card}>
            <StepHeader n={1} eyebrow="Denomination" title="Choose a" accent="value" />

            <View style={styles.amtGrid}>
              {AMOUNTS.map((a) => {
                const isSelected = amount === a;
                return (
                  <Pressable
                    key={a}
                    onPress={() => handleSelectAmount(a)}
                    style={({ pressed }) => [styles.amtCell, pressed && { transform: [{ scale: 0.97 }] }]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={formatPrice(a)}
                  >
                    {isSelected ? (
                      <LinearGradient
                        colors={[colors.olive[800], colors.olive[950]]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[styles.amtBtn, styles.amtBtnActive]}
                      >
                        <View style={styles.amtCheck}>
                          <Ionicons name="checkmark" size={10} color={colors.olive[950]} />
                        </View>
                        <Text style={[styles.amtCurrency, { color: GOLD_SOFT }]}>LKR</Text>
                        <Text style={[styles.amtValue, { color: colors.paper.cream }]} numberOfLines={1} adjustsFontSizeToFit>
                          {a.toLocaleString()}
                        </Text>
                      </LinearGradient>
                    ) : (
                      <View style={styles.amtBtn}>
                        <Text style={styles.amtCurrency}>LKR</Text>
                        <Text style={styles.amtValue} numberOfLines={1} adjustsFontSizeToFit>
                          {a.toLocaleString()}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>Or enter your own</Text>
            <View style={[styles.customRow, !isAmountValid && styles.customRowError]}>
              <View style={styles.customPrefix}>
                <Text style={styles.customPrefixText}>LKR</Text>
              </View>
              <TextInput
                style={styles.customInput}
                value={customAmountStr}
                onChangeText={handleCustomAmountChange}
                keyboardType="numeric"
                placeholder="15000"
                placeholderTextColor="rgba(22,23,15,0.3)"
                accessibilityLabel="Custom amount in LKR"
              />
              <Ionicons name="create-outline" size={16} color={colors.ink.mute} />
            </View>
            {!isAmountValid ? (
              <View style={styles.errorRow}>
                <Ionicons name="alert-circle" size={13} color={colors.light.destructive} />
                <Text style={styles.errorText}>Minimum voucher value is {formatPrice(MIN_AMOUNT)}.</Text>
              </View>
            ) : null}
          </View>

          {/* Step 2 — recipient */}
          <View style={styles.card}>
            <StepHeader n={2} eyebrow="Destination" title="Who's it" accent="for?" />

            <View style={styles.inputsStack}>
              <Field icon="person-outline" label="Recipient name" optional>
                <TextInput
                  style={styles.fieldInput}
                  value={recipient.name}
                  onChangeText={(v) => setRecipient({ ...recipient, name: v })}
                  placeholder="Their full name"
                  placeholderTextColor="rgba(22,23,15,0.3)"
                />
              </Field>
              <Field icon="mail-outline" label="Recipient email" required>
                <TextInput
                  style={styles.fieldInput}
                  value={recipient.email}
                  onChangeText={(v) => setRecipient({ ...recipient, email: v })}
                  placeholder="recipient@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholderTextColor="rgba(22,23,15,0.3)"
                />
              </Field>
              <Field icon="chatbubble-ellipses-outline" label="Personal message" optional multiline>
                <TextInput
                  style={[styles.fieldInput, styles.fieldTextArea]}
                  value={recipient.message}
                  onChangeText={(v) => setRecipient({ ...recipient, message: v })}
                  placeholder="Add a heartfelt note or celebration wish…"
                  placeholderTextColor="rgba(22,23,15,0.3)"
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </Field>
            </View>
          </View>

          {/* Step 3 — delivery */}
          <View style={styles.card}>
            <StepHeader n={3} eyebrow="Timing" title="When should it" accent="arrive?" />

            <View style={styles.segment}>
              {[
                { on: false, label: "Send now", icon: "flash-outline" as const },
                { on: true, label: "Schedule", icon: "calendar-outline" as const },
              ].map((opt) => {
                const active = scheduled === opt.on;
                return (
                  <Pressable
                    key={opt.label}
                    onPress={() => setScheduled(opt.on)}
                    style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Ionicons name={opt.icon} size={15} color={active ? GOLD_SOFT : colors.ink.mute} />
                    <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{opt.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            {scheduled ? (
              <View style={styles.scheduleBox}>
                <Text style={styles.fieldLabel}>Deliver in</Text>
                <View style={styles.quickRow}>
                  {SCHEDULE_PRESETS.map((p) => {
                    const active = scheduledHours === String(p.hours);
                    return (
                      <Pressable
                        key={p.hours}
                        onPress={() => setScheduledHours(String(p.hours))}
                        style={[styles.quickChip, active && styles.quickChipActive]}
                      >
                        <Text style={[styles.quickChipText, active && styles.quickChipTextActive]}>{p.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <View style={styles.hoursRow}>
                  <TextInput
                    style={styles.hoursInput}
                    value={scheduledHours}
                    onChangeText={setScheduledHours}
                    placeholder="24"
                    keyboardType="numeric"
                    placeholderTextColor="rgba(22,23,15,0.3)"
                    accessibilityLabel="Hours from now"
                  />
                  <Text style={styles.hoursUnit}>hours from now</Text>
                </View>
                {arrivesAt ? (
                  <View style={styles.arrivesRow}>
                    <Ionicons name="time-outline" size={14} color={GOLD_DEEP} />
                    <Text style={styles.arrivesText}>
                      Arrives <Text style={styles.arrivesStrong}>{arrivesAt}</Text>
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : (
              <View style={styles.arrivesRow}>
                <Ionicons name="mail-unread-outline" size={14} color={GOLD_DEEP} />
                <Text style={styles.arrivesText}>Emailed the moment payment is confirmed.</Text>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Pay bar */}
        <View style={[styles.payBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.payLabel}>TOTAL</Text>
            <Text style={styles.payAmount} numberOfLines={1} adjustsFontSizeToFit>
              {formatPrice(shownAmount)}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.payTouch, !canPay && { shadowOpacity: 0 }]}
            onPress={onPurchase}
            disabled={!canPay}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityLabel={`Pay ${formatPrice(shownAmount)}`}
          >
            <LinearGradient
              colors={canPay || purchasing ? [GOLD_SOFT, GOLD] : ["#e6e4da", "#d8d5c8"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.payBtn}
            >
              {purchasing ? (
                <ActivityIndicator color={colors.olive[950]} size="small" />
              ) : (
                canPay ? (
                  <>
                    <Ionicons name="lock-closed" size={14} color={colors.olive[950]} />
                    <Text style={styles.payBtnText}>Pay securely</Text>
                    <Ionicons name="arrow-forward" size={15} color={colors.olive[950]} />
                  </>
                ) : (
                  <>
                    <Ionicons name={isAmountValid ? "mail-outline" : "alert-circle-outline"} size={15} color={colors.ink.mute} />
                    <Text style={[styles.payBtnText, { color: colors.ink.mute }]}>
                      {isAmountValid ? "Add recipient email" : "Check amount"}
                    </Text>
                  </>
                )
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </PaperBackground>
  );
}

const GOLD = colors.accent2.ochre;
const GOLD_DEEP = "#85651b";
const GOLD_SOFT = "#E8CF8F";
const GOLD_HAIRLINE = "rgba(200,164,74,0.24)";

const TRUST: { icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { icon: "lock-closed-outline", label: "Secure payment" },
  { icon: "mail-outline", label: "Email delivery" },
  { icon: "shield-checkmark-outline", label: "Sent after payment" },
];

const SCHEDULE_PRESETS = [
  { hours: 24, label: "1 day" },
  { hours: 72, label: "3 days" },
  { hours: 168, label: "1 week" },
];

function StepHeader({ n, eyebrow, title, accent }: { n: number; eyebrow: string; title: string; accent: string }) {
  return (
    <View style={styles.stepHeader}>
      <LinearGradient colors={[GOLD_SOFT, GOLD]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.stepNum}>
        <Text style={styles.stepNumText}>{String(n).padStart(2, "0")}</Text>
      </LinearGradient>
      <View style={{ flex: 1 }}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.cardTitle}>
          {title} <Text style={styles.pageTitleAccent}>{accent}</Text>
        </Text>
      </View>
    </View>
  );
}

function Field({
  icon,
  label,
  required,
  optional,
  multiline,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  required?: boolean;
  optional?: boolean;
  multiline?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View>
      <View style={styles.fieldLabelRow}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {required ? <Text style={styles.fieldRequired}>Required</Text> : null}
        {optional ? <Text style={styles.fieldOptional}>Optional</Text> : null}
      </View>
      <View style={[styles.fieldWrap, multiline && { alignItems: "flex-start", paddingTop: 12 }]}>
        <Ionicons name={icon} size={16} color={colors.ink.mute} />
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  /* Nav */
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[2.5],
  },
  navBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.paper.cream,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(22,23,15,0.08)",
    ...shadows.soft,
  },
  navTitle: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 18,
    color: colors.light.foreground,
  },

  scrollContent: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
    gap: spacing[5],
  },

  /* Heading */
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  eyebrowRule: { width: 18, height: 1, backgroundColor: GOLD },
  eyebrow: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: GOLD_DEEP,
  },
  pageTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 34,
    letterSpacing: -0.8,
    lineHeight: 40,
    color: colors.light.foreground,
  },
  pageTitleAccent: { fontFamily: fontFamilies.display.italic, color: GOLD_DEEP },
  pageSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 14,
    lineHeight: 21,
    color: colors.light.mutedForeground,
    marginTop: 6,
    maxWidth: 330,
  },

  /* Preview */
  previewShadow: {
    borderRadius: 28,
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.26,
    shadowRadius: 28,
    elevation: 12,
  },
  previewCard: {
    borderRadius: 28,
    padding: spacing[5],
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(232,207,143,0.14)",
  },
  ribbonV: { position: "absolute", top: 0, bottom: 0, right: 64, width: 30 },
  ribbonH: { position: "absolute", left: 0, right: 0, top: 29, height: 26 },
  previewTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  previewWordmark: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 18,
    letterSpacing: 6,
    color: colors.paper.cream,
  },
  previewTag: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 9.5,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "rgba(232,207,143,0.85)",
    marginTop: 4,
  },
  previewBow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 37,
    borderWidth: 2,
    borderColor: "#181b0f",
  },
  previewValue: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 46,
    lineHeight: 54,
    letterSpacing: -1.4,
    color: colors.paper.cream,
    marginTop: spacing[6],
  },
  previewValueLabel: {
    fontFamily: fontFamilies.display.italic,
    fontSize: 15,
    color: GOLD_SOFT,
  },
  previewMessage: {
    flexDirection: "row",
    gap: 6,
    marginTop: spacing[4],
    padding: spacing[3],
    borderRadius: 14,
    backgroundColor: "rgba(250,248,241,0.06)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(232,207,143,0.2)",
  },
  previewQuote: {
    fontFamily: fontFamilies.display.italic,
    fontSize: 28,
    lineHeight: 28,
    color: GOLD,
  },
  previewMessageText: {
    flex: 1,
    fontFamily: fontFamilies.display.italic,
    fontSize: 14,
    lineHeight: 20,
    color: "rgba(250,248,241,0.85)",
    paddingTop: 2,
  },
  previewFooter: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing[3],
    marginTop: spacing[5],
    paddingTop: spacing[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(232,207,143,0.25)",
  },
  previewFootLabel: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 8.5,
    letterSpacing: 1.6,
    color: "rgba(250,248,241,0.5)",
  },
  previewFootValue: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14,
    color: colors.paper.cream,
    marginTop: 3,
  },

  /* Trust */
  trustRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: -spacing[1],
  },
  trustItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  trustText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 11,
    color: colors.ink.mute,
  },

  /* Cards */
  card: {
    backgroundColor: colors.paper.cream,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: GOLD_HAIRLINE,
    padding: spacing[5],
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.07,
    shadowRadius: 20,
    elevation: 4,
  },
  stepHeader: { flexDirection: "row", alignItems: "center", gap: spacing[3], marginBottom: spacing[4] },
  stepNum: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 12,
    color: colors.olive[950],
  },
  cardTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 21,
    letterSpacing: -0.3,
    color: colors.light.foreground,
    marginTop: 2,
  },

  /* Amounts */
  amtGrid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -5 },
  amtCell: { width: "33.333%", padding: 5 },
  amtBtn: {
    height: 74,
    borderRadius: 18,
    justifyContent: "center",
    paddingHorizontal: 12,
    backgroundColor: colors.light.background,
    borderWidth: 1,
    borderColor: "rgba(22,23,15,0.08)",
  },
  amtBtnActive: {
    borderColor: "rgba(232,207,143,0.4)",
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  amtCheck: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: GOLD_SOFT,
  },
  amtCurrency: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 9,
    letterSpacing: 1.4,
    color: colors.ink.mute,
  },
  amtValue: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.3,
    color: colors.light.foreground,
  },

  fieldLabelRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  fieldLabel: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: colors.ink.mute,
  },
  fieldRequired: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 10,
    color: GOLD_DEEP,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radii.full,
    backgroundColor: "rgba(200,164,74,0.14)",
    overflow: "hidden",
  },
  fieldOptional: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 10,
    color: colors.light.mutedForeground,
  },

  customRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
    height: 58,
    paddingLeft: 6,
    paddingRight: 16,
    borderRadius: 18,
    backgroundColor: colors.light.background,
    borderWidth: 1,
    borderColor: "rgba(22,23,15,0.1)",
  },
  customRowError: { borderColor: "rgba(192,57,43,0.45)" },
  customPrefix: {
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.paper.warm,
  },
  customPrefixText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 12,
    letterSpacing: 1.2,
    color: colors.ink.mute,
  },
  customInput: {
    flex: 1,
    fontFamily: fontFamilies.display.regular,
    fontSize: 22,
    color: colors.light.foreground,
    paddingVertical: Platform.OS === "android" ? 0 : 8,
  },
  errorRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  errorText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12,
    color: colors.light.destructive,
  },

  /* Recipient */
  inputsStack: { gap: spacing[4] },
  fieldWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: colors.light.background,
    borderWidth: 1,
    borderColor: "rgba(22,23,15,0.1)",
  },
  fieldInput: {
    flex: 1,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 14.5,
    color: colors.light.foreground,
    paddingVertical: Platform.OS === "android" ? 8 : 14,
  },
  fieldTextArea: { minHeight: 88, paddingTop: 0 },

  /* Delivery */
  segment: {
    flexDirection: "row",
    padding: 4,
    borderRadius: radii.full,
    backgroundColor: colors.light.background,
    borderWidth: 1,
    borderColor: "rgba(22,23,15,0.08)",
  },
  segmentBtn: {
    flex: 1,
    height: 44,
    borderRadius: radii.full,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  segmentBtnActive: {
    backgroundColor: colors.ink.DEFAULT,
    shadowColor: "#16170f",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  segmentText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 14,
    color: colors.ink.mute,
  },
  segmentTextActive: { fontFamily: fontFamilies.sans.semibold, color: colors.paper.cream },
  scheduleBox: { marginTop: spacing[4] },
  quickRow: { flexDirection: "row", gap: spacing[2] },
  quickChip: {
    flex: 1,
    height: 40,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(22,23,15,0.1)",
    backgroundColor: colors.light.background,
  },
  quickChipActive: { borderColor: GOLD, backgroundColor: "rgba(200,164,74,0.14)" },
  quickChipText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: colors.ink.soft,
  },
  quickChipTextActive: { color: GOLD_DEEP },
  hoursRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: spacing[3],
  },
  hoursInput: {
    width: 86,
    height: 48,
    borderRadius: 14,
    textAlign: "center",
    fontFamily: fontFamilies.display.regular,
    fontSize: 20,
    color: colors.light.foreground,
    backgroundColor: colors.light.background,
    borderWidth: 1,
    borderColor: "rgba(22,23,15,0.1)",
  },
  hoursUnit: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 14,
    color: colors.ink.mute,
  },
  arrivesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: spacing[4],
    padding: spacing[3],
    borderRadius: 14,
    backgroundColor: "rgba(200,164,74,0.08)",
  },
  arrivesText: {
    flex: 1,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    color: colors.ink.soft,
  },
  arrivesStrong: { fontFamily: fontFamilies.sans.semibold, color: colors.light.foreground },

  /* Pay bar */
  payBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[4],
    paddingTop: spacing[3],
    paddingHorizontal: spacing[5],
    backgroundColor: colors.paper.cream,
    borderTopWidth: 1,
    borderTopColor: GOLD_HAIRLINE,
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 12,
  },
  payLabel: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 9.5,
    letterSpacing: 1.6,
    color: colors.light.mutedForeground,
  },
  payAmount: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 24,
    letterSpacing: -0.5,
    color: colors.light.foreground,
  },
  payTouch: {
    borderRadius: radii.full,
    shadowColor: "#c8a44a",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  payBtn: {
    height: 54,
    minWidth: 180,
    paddingHorizontal: 22,
    borderRadius: radii.full,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  payBtnText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 15,
    color: colors.olive[950],
  },
});
