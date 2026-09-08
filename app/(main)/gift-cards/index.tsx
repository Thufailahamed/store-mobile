import React, { useState } from "react";
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
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@/components/ui/Icon";
import { PaperBackground } from "@/components/layout";
import { useAuth } from "@/lib/supabase/auth";
import { useToast } from "@/components/ui";
import { getGiftCardPayHereSession } from "@/lib/api/payments";
import { PayHereCheckout } from "@/components/payments/PayHereCheckout";
import { colors, radii, shadows, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";

const AMOUNTS = [2500, 5000, 10000, 20000, 50000, 100000];
const MIN_AMOUNT = AMOUNTS[0];

export default function GiftCardsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();

  const [amount, setAmount] = useState(5000);
  const [customAmountStr, setCustomAmountStr] = useState("5000");
  const [recipient, setRecipient] = useState({ name: "", email: "", message: "" });
  const [scheduled, setScheduled] = useState(false);
  const [scheduledHours, setScheduledHours] = useState("24");
  const [purchasing, setPurchasing] = useState(false);
  const [payhere, setPayhere] = useState<{
    action: string;
    fields: Record<string, string>;
    cardId: string;
  } | null>(null);

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
    const res = await getGiftCardPayHereSession({
      amount,
      currency: "LKR",
      recipient_email: recipient.email.trim().toLowerCase(),
      recipient_name: recipient.name.trim() || undefined,
      message: recipient.message.trim() || undefined,
      scheduled_for,
    });
    setPurchasing(false);

    if (!res.ok) {
      Alert.alert("Payment Initiation Failed", res.error);
      return;
    }

    setPayhere({
      action: res.data.action,
      fields: res.data.fields,
      cardId: res.data.pending_card_id ?? "gift-card",
    });
  };

  return (
    <PaperBackground>
      <SafeAreaView style={styles.container} edges={["top"]}>
        {/* Atelier Top Navigation Bar */}
        <View style={styles.navBar}>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={20} color={colors.light.foreground} />
          </TouchableOpacity>

          <View style={styles.navTitleWrap}>
            <Text style={styles.navTitle}>SEND A GIFT VOUCHER</Text>
            <Text style={styles.navSubtitle}>BESPOKE DIGITAL GIFTING</Text>
          </View>

          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => router.push("/(main)/gift-cards/redeem" as any)}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="ticket-outline" size={18} color={colors.light.foreground} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* 1. Haute Couture Gifting Hero Card */}
          <LinearGradient
            colors={["#1c2016", "#14170e", "#0e110a"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={styles.heroEyebrowRow}>
              <View style={styles.heroTagBadge}>
                <Ionicons name="sparkles" size={11} color="#C8A44A" />
                <Text style={styles.heroTagText}>BESPOKE PRESENT</Text>
              </View>
              <View style={styles.heroLiveBadge}>
                <View style={styles.heroLiveDot} />
                <Text style={styles.heroLiveText}>INSTANT EMAIL DELIVERY</Text>
              </View>
            </View>

            <Text style={styles.heroTitle}>Curate a Digital Voucher</Text>
            <Text style={styles.heroSubtitle}>
              Gift bespoke store credit directly to someone special. Valid across all designer boutiques, private drops, and luxury collections.
            </Text>

            {/* Micro Reassurance Banner */}
            <View style={styles.noticePill}>
              <Ionicons name="shield-checkmark" size={13} color="#E8CF8F" />
              <Text style={styles.noticePillText}>
                Vouchers are minted and sent upon verified payment completion.
              </Text>
            </View>
          </LinearGradient>

          {/* 2. Amount Selection Card */}
          <View style={styles.formCard}>
            <View style={styles.cardHeaderRow}>
              <View>
                <Text style={styles.cardEyebrow}>DENOMINATION</Text>
                <Text style={styles.cardTitle}>Select Voucher Value</Text>
              </View>
              <View style={styles.currencyBadge}>
                <Text style={styles.currencyBadgeText}>LKR</Text>
              </View>
            </View>

            {/* Presets Grid */}
            <View style={styles.amtGrid}>
              {AMOUNTS.map((a) => {
                const isSelected = amount === a;
                return (
                  <TouchableOpacity
                    key={a}
                    onPress={() => handleSelectAmount(a)}
                    style={[styles.amtBtn, isSelected && styles.amtBtnActive]}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.amtBtnText,
                        isSelected && styles.amtBtnTextActive,
                      ]}
                    >
                      {formatPrice(a)}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={12} color="#E8CF8F" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Custom Amount Input Field */}
            <View style={styles.customAmountWrap}>
              <Text style={styles.inputFieldLabel}>CUSTOM AMOUNT (LKR)</Text>
              <View style={styles.customInputRow}>
                <Text style={styles.currencyPrefix}>LKR</Text>
                <TextInput
                  style={styles.customInputText}
                  value={customAmountStr}
                  onChangeText={handleCustomAmountChange}
                  keyboardType="numeric"
                  placeholder="e.g. 15000"
                  placeholderTextColor={colors.light.mutedForeground}
                />
              </View>
              {!isAmountValid && (
                <View style={styles.errorRow}>
                  <Ionicons name="alert-circle" size={12} color={colors.light.destructive} />
                  <Text style={styles.errorText}>
                    Minimum voucher value is {formatPrice(MIN_AMOUNT)}.
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* 3. Live Card Preview */}
          <View style={styles.previewSection}>
            <Text style={styles.previewEyebrow}>LIVE RECIPIENT PREVIEW</Text>
            <LinearGradient
              colors={["#272c20", "#191d14", "#11140e"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.previewCard}
            >
              <View style={styles.previewTop}>
                <View style={styles.previewLogoBadge}>
                  <Ionicons name="gift" size={13} color="#C8A44A" />
                  <Text style={styles.previewLogoText}>ATELIER GIFT CARD</Text>
                </View>
                <Text style={styles.previewCodeMask}>•••• •••• •••• 9428</Text>
              </View>

              <View style={styles.previewCenter}>
                <Text style={styles.previewValue}>
                  {formatPrice(isAmountValid ? amount : MIN_AMOUNT)}
                </Text>
                <Text style={styles.previewBalanceLabel}>UNIVERSAL STORE CREDIT</Text>
              </View>

              <View style={styles.previewFooter}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.previewToLabel}>FOR</Text>
                  <Text style={styles.previewToName} numberOfLines={1}>
                    {recipient.name.trim() || recipient.email.trim() || "Recipient Name"}
                  </Text>
                </View>
                {recipient.message.trim() ? (
                  <Ionicons name="chatbubble-ellipses" size={14} color="#C8A44A" />
                ) : null}
              </View>
            </LinearGradient>
          </View>

          {/* 4. Recipient Details Card */}
          <View style={styles.formCard}>
            <View style={styles.cardHeaderRow}>
              <View>
                <Text style={styles.cardEyebrow}>DESTINATION</Text>
                <Text style={styles.cardTitle}>Recipient Information</Text>
              </View>
              <Ionicons name="paper-plane-outline" size={18} color="#85651b" />
            </View>

            <View style={styles.inputsStack}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputFieldLabel}>RECIPIENT NAME</Text>
                <TextInput
                  style={styles.textInputField}
                  value={recipient.name}
                  onChangeText={(v) => setRecipient({ ...recipient, name: v })}
                  placeholder="Recipient's full name (optional)"
                  placeholderTextColor={colors.light.mutedForeground}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputFieldLabel}>RECIPIENT EMAIL *</Text>
                <TextInput
                  style={styles.textInputField}
                  value={recipient.email}
                  onChangeText={(v) => setRecipient({ ...recipient, email: v })}
                  placeholder="recipient@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholderTextColor={colors.light.mutedForeground}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputFieldLabel}>PERSONAL MESSAGE (OPTIONAL)</Text>
                <TextInput
                  style={[styles.textInputField, styles.textAreaField]}
                  value={recipient.message}
                  onChangeText={(v) => setRecipient({ ...recipient, message: v })}
                  placeholder="Add a heartfelt note or celebration wish…"
                  placeholderTextColor={colors.light.mutedForeground}
                  multiline
                  numberOfLines={3}
                />
              </View>
            </View>
          </View>

          {/* 5. Schedule Dispatch Option */}
          <View style={styles.formCard}>
            <View style={styles.scheduleHeaderRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.scheduleTitleRow}>
                  <Ionicons name="time-outline" size={16} color="#85651b" />
                  <Text style={styles.scheduleTitle}>Schedule Delivery</Text>
                </View>
                <Text style={styles.scheduleDesc}>
                  Dispatch automatically on an upcoming birthday, anniversary, or celebration.
                </Text>
              </View>

              <Pressable
                onPress={() => setScheduled((s) => !s)}
                style={[styles.toggleTrack, scheduled && styles.toggleTrackOn]}
              >
                <View
                  style={[styles.toggleThumb, scheduled && styles.toggleThumbOn]}
                />
              </Pressable>
            </View>

            {scheduled && (
              <View style={styles.scheduledHoursBox}>
                <Text style={styles.inputFieldLabel}>DELIVERY TIMELINE</Text>
                <View style={styles.hoursInputRow}>
                  <TextInput
                    style={styles.hoursInputField}
                    value={scheduledHours}
                    onChangeText={setScheduledHours}
                    placeholder="24"
                    keyboardType="numeric"
                    placeholderTextColor={colors.light.mutedForeground}
                  />
                  <Text style={styles.hoursInputUnit}>hours from now</Text>
                </View>
              </View>
            )}
          </View>

          {/* 6. Purchase Action Button */}
          <TouchableOpacity
            style={[
              styles.checkoutBtn,
              (!recipient.email || !isAmountValid || purchasing) &&
                styles.checkoutBtnDisabled,
            ]}
            onPress={onPurchase}
            disabled={purchasing || !recipient.email || !isAmountValid}
            activeOpacity={0.88}
          >
            {purchasing ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <>
                <Ionicons name="lock-closed" size={14} color="#ffffff" />
                <Text style={styles.checkoutBtnText}>
                  PAY {formatPrice(isAmountValid ? amount : MIN_AMOUNT)} WITH CARD
                </Text>
                <Ionicons name="arrow-forward" size={14} color="#ffffff" />
              </>
            )}
          </TouchableOpacity>

          <View style={{ height: 30 }} />
        </ScrollView>

        {payhere && (
          <PayHereCheckout
            visible
            action={payhere.action}
            fields={payhere.fields}
            orderId={payhere.cardId}
            onClose={() => setPayhere(null)}
            onReturnFromGateway={() => {
              setPayhere(null);
              toast("Payment submitted — gift voucher is being dispatched!", "success");
              router.push("/(main)/account/gift-cards" as any);
            }}
          />
        )}
      </SafeAreaView>
    </PaperBackground>
  );
}

/* =========================================================================
   Styles
   ========================================================================= */
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  /* Navigation Bar */
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: "rgba(22, 23, 15, 0.06)",
  },
  navBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.08)",
    ...shadows.soft,
  },
  navTitleWrap: {
    alignItems: "center",
  },
  navTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 15,
    letterSpacing: 2,
    color: colors.light.foreground,
    textTransform: "uppercase",
  },
  navSubtitle: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9.5,
    color: "#85651b",
    marginTop: 1,
    letterSpacing: 1,
  },

  scrollContent: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    gap: 14,
  },

  /* 1. Hero Card */
  heroCard: {
    borderRadius: 20,
    padding: spacing[5],
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.35)",
    ...shadows.editorial,
  },
  heroEyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  heroTagBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(200, 164, 74, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.3)",
  },
  heroTagText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    color: "#E8CF8F",
    letterSpacing: 1,
  },
  heroLiveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  heroLiveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#4ade80",
  },
  heroLiveText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 8.5,
    color: "rgba(255, 255, 255, 0.7)",
    letterSpacing: 0.6,
  },
  heroTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 22,
    color: "#ffffff",
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12.5,
    color: "rgba(255, 255, 255, 0.72)",
    lineHeight: 18,
    marginTop: 6,
    marginBottom: 14,
  },
  noticePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.07)",
    borderRadius: radii.lg,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  noticePillText: {
    flex: 1,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: "rgba(255, 255, 255, 0.8)",
    lineHeight: 15,
  },

  /* Form Cards */
  formCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: spacing[5],
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.08)",
    gap: 12,
    ...shadows.soft,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  cardEyebrow: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9.5,
    color: "#85651b",
    letterSpacing: 1.2,
  },
  cardTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 17,
    color: colors.light.foreground,
    marginTop: 2,
  },
  currencyBadge: {
    backgroundColor: "rgba(200, 164, 74, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.3)",
  },
  currencyBadgeText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
    color: "#85651b",
  },

  /* Amount Grid */
  amtGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 2,
  },
  amtBtn: {
    flexBasis: "31%",
    flexGrow: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.1)",
    backgroundColor: "#ffffff",
  },
  amtBtnActive: {
    borderColor: "#181b12",
    backgroundColor: "#181b12",
  },
  amtBtnText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 11.5,
    color: colors.light.foreground,
  },
  amtBtnTextActive: {
    color: "#ffffff",
  },

  /* Custom Amount */
  customAmountWrap: {
    marginTop: 4,
    gap: 4,
  },
  inputFieldLabel: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9.5,
    color: "#85651b",
    letterSpacing: 0.8,
  },
  customInputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(22, 23, 15, 0.03)",
    borderRadius: radii.xl,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 11 : 7,
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.1)",
    gap: 8,
  },
  currencyPrefix: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 12,
    color: colors.light.mutedForeground,
  },
  customInputText: {
    flex: 1,
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 14,
    color: colors.light.foreground,
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  errorText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: colors.light.destructive,
  },

  /* Live Preview Card */
  previewSection: {
    gap: 6,
  },
  previewEyebrow: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9.5,
    color: "#85651b",
    letterSpacing: 1.2,
    marginLeft: 4,
  },
  previewCard: {
    borderRadius: 20,
    padding: spacing[5],
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.3)",
    ...shadows.soft,
    gap: 14,
  },
  previewTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  previewLogoBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  previewLogoText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    color: "#E8CF8F",
    letterSpacing: 1,
  },
  previewCodeMask: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 11,
    color: "rgba(255, 255, 255, 0.5)",
    letterSpacing: 1,
  },
  previewCenter: {
    marginVertical: 4,
  },
  previewValue: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 28,
    color: "#E8CF8F",
  },
  previewBalanceLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 8.5,
    color: "rgba(255, 255, 255, 0.6)",
    letterSpacing: 0.8,
    marginTop: 2,
  },
  previewFooter: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
  },
  previewToLabel: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 8,
    color: "rgba(255, 255, 255, 0.5)",
    letterSpacing: 0.8,
  },
  previewToName: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: "#ffffff",
    marginTop: 1,
  },

  /* Inputs Stack */
  inputsStack: {
    gap: 12,
  },
  inputGroup: {
    gap: 4,
  },
  textInputField: {
    backgroundColor: "rgba(22, 23, 15, 0.03)",
    borderRadius: radii.xl,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 11 : 8,
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.1)",
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    color: colors.light.foreground,
  },
  textAreaField: {
    minHeight: 70,
    paddingTop: 10,
    textAlignVertical: "top",
  },

  /* Schedule Header */
  scheduleHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  scheduleTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  scheduleTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 15.5,
    color: colors.light.foreground,
  },
  scheduleDesc: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11.5,
    color: colors.light.mutedForeground,
    lineHeight: 16,
    marginTop: 2,
  },
  toggleTrack: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(22, 23, 15, 0.1)",
    padding: 2,
    justifyContent: "center",
  },
  toggleTrackOn: {
    backgroundColor: "#181b12",
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    ...shadows.soft,
  },
  toggleThumbOn: {
    transform: [{ translateX: 20 }],
    backgroundColor: "#E8CF8F",
  },
  scheduledHoursBox: {
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(22, 23, 15, 0.06)",
    gap: 6,
  },
  hoursInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  hoursInputField: {
    width: 70,
    backgroundColor: "rgba(22, 23, 15, 0.03)",
    borderRadius: radii.lg,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.1)",
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 14,
    color: colors.light.foreground,
    textAlign: "center",
  },
  hoursInputUnit: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12.5,
    color: colors.light.mutedForeground,
  },

  /* Primary Checkout Button */
  checkoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#181b12",
    borderRadius: radii.full,
    paddingVertical: 14,
    marginTop: 6,
    ...shadows.soft,
  },
  checkoutBtnDisabled: {
    opacity: 0.5,
  },
  checkoutBtnText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 11,
    color: "#ffffff",
    letterSpacing: 1.2,
  },
});
