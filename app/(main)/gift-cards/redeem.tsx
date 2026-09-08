import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
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
import { useToast } from "@/components/ui";
import { checkGiftCardByCode } from "@/lib/api";
import { colors, radii, shadows, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";

const REASONS: Record<string, string> = {
  not_found: "Voucher code not found. Please verify the characters and try again.",
  voided: "This gift voucher has been voided by the issuer.",
  expired: "This gift voucher has passed its validity window.",
  inactive: "This gift voucher is currently inactive or awaiting payment confirmation.",
  empty: "This gift voucher has no remaining store credit.",
  scheduled: "This gift voucher is scheduled for future delivery and is not yet active.",
  currency_mismatch: "Voucher currency does not match your shopping region.",
};

export default function RedeemGiftCardScreen() {
  const router = useRouter();
  const { toast } = useToast();

  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{
    valid: boolean;
    card: {
      code: string;
      current_balance: number;
      currency: string;
      recipient_name: string | null;
      message: string | null;
      expires_at: string | null;
    } | null;
    reason: string | null;
  } | null>(null);

  const onCheck = async () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) {
      toast("Please enter a valid voucher code", "error");
      return;
    }
    setChecking(true);
    const res = await checkGiftCardByCode(trimmed);
    setChecking(false);
    if (!res.ok) {
      toast(res.error || "Lookup failed", "error");
      return;
    }
    setResult(res.data as typeof result);
  };

  return (
    <PaperBackground>
      <SafeAreaView style={styles.container} edges={["top"]}>
        {/* Navigation Bar */}
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
            <Text style={styles.navTitle}>REDEEM VOUCHER</Text>
            <Text style={styles.navSubtitle}>STORE CREDIT INTAKE</Text>
          </View>

          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => router.push("/(main)/account/gift-cards" as any)}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="wallet-outline" size={18} color={colors.light.foreground} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Card */}
          <LinearGradient
            colors={["#1c2016", "#14170e", "#0e110a"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={styles.heroEyebrowRow}>
              <View style={styles.heroTagBadge}>
                <Ionicons name="ticket" size={11} color="#C8A44A" />
                <Text style={styles.heroTagText}>VOUCHER INTAKE</Text>
              </View>
            </View>

            <Text style={styles.heroTitle}>Redeem Your Gift Card</Text>
            <Text style={styles.heroSubtitle}>
              Check the remaining balance on any physical or digital voucher, or apply it toward your upcoming purchases.
            </Text>
          </LinearGradient>

          {/* Code Input Card */}
          <View style={styles.inputCard}>
            <Text style={styles.cardEyebrow}>ENTER CODE</Text>
            <Text style={styles.cardTitle}>Voucher Number</Text>
            <Text style={styles.cardSub}>
              Enter the 16-character code found on your digital gift email or physical card.
            </Text>

            <View style={styles.inputWrap}>
              <Ionicons name="barcode-outline" size={18} color="#85651b" />
              <TextInput
                style={styles.textInput}
                value={code}
                onChangeText={(v) => setCode(v.toUpperCase())}
                placeholder="XXXX-XXXX-XXXX-XXXX"
                placeholderTextColor={colors.light.mutedForeground}
                autoCapitalize="characters"
                maxLength={40}
                returnKeyType="done"
              />
              {code.length > 0 && (
                <TouchableOpacity onPress={() => setCode("")} hitSlop={8}>
                  <Ionicons name="close-circle" size={16} color={colors.light.mutedForeground} />
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={[
                styles.checkBtn,
                (checking || code.length < 4) && styles.checkBtnDisabled,
              ]}
              onPress={onCheck}
              disabled={checking || code.length < 4}
              activeOpacity={0.88}
            >
              {checking ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="search" size={14} color="#ffffff" />
                  <Text style={styles.checkBtnText}>VERIFY VOUCHER</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Verification Result */}
          {result && (
            <View style={styles.resultSection}>
              {result.valid && result.card ? (
                /* Valid Card Preview */
                <LinearGradient
                  colors={["#272c20", "#181d14", "#11140e"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.validCard}
                >
                  <View style={styles.validTopRow}>
                    <View style={styles.validBadge}>
                      <Ionicons name="checkmark-circle" size={13} color="#4ade80" />
                      <Text style={styles.validBadgeText}>ACTIVE & VALID</Text>
                    </View>
                    <Text style={styles.validCodeText}>{result.card.code}</Text>
                  </View>

                  <View style={styles.validAmountBlock}>
                    <Text style={styles.validAmount}>
                      {formatPrice(result.card.current_balance, result.card.currency)}
                    </Text>
                    <Text style={styles.validAmountLabel}>AVAILABLE STORE BALANCE</Text>
                  </View>

                  {result.card.message ? (
                    <View style={styles.messageBubble}>
                      <Text style={styles.messageText}>
                        &quot;{result.card.message}&quot;
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.validFooterRow}>
                    <Text style={styles.validExpiryText}>
                      {result.card.expires_at
                        ? `Expires: ${new Date(result.card.expires_at).toLocaleDateString()}`
                        : "Lifetime Store Validity"}
                    </Text>
                    <TouchableOpacity
                      style={styles.useInStoreBtn}
                      onPress={() => router.push("/(main)/products" as any)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.useInStoreBtnText}>Shop Now</Text>
                      <Ionicons name="arrow-forward" size={12} color="#181b12" />
                    </TouchableOpacity>
                  </View>
                </LinearGradient>
              ) : (
                /* Invalid / Expired Card */
                <View style={styles.invalidCard}>
                  <View style={styles.invalidIconBox}>
                    <Ionicons name="close-circle" size={24} color="#dc2626" />
                  </View>
                  <Text style={styles.invalidTitle}>Cannot Redeem Voucher</Text>
                  <Text style={styles.invalidDesc}>
                    {result.reason ? (REASONS[result.reason] ?? result.reason) : "This code could not be verified."}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Concierge Assistance Footnote */}
          <View style={styles.assistanceCard}>
            <Ionicons name="help-circle-outline" size={18} color="#85651b" />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.assistanceTitle}>Need Assistance?</Text>
              <Text style={styles.assistanceDesc}>
                If you received a gift voucher that isn&apos;t activating, our concierge team is available to verify it manually.
              </Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
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
    paddingBottom: 40,
    gap: 14,
  },
  heroCard: {
    borderRadius: 20,
    padding: spacing[5],
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.35)",
    ...shadows.editorial,
  },
  heroEyebrowRow: {
    marginBottom: 10,
  },
  heroTagBadge: {
    alignSelf: "flex-start",
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
  },

  /* Input Card */
  inputCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: spacing[5],
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.08)",
    gap: 6,
    ...shadows.soft,
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
  },
  cardSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.light.mutedForeground,
    lineHeight: 17,
    marginBottom: 6,
  },
  inputWrap: {
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
  textInput: {
    flex: 1,
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 13,
    color: colors.light.foreground,
    letterSpacing: 1.5,
  },
  checkBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#181b12",
    borderRadius: radii.full,
    paddingVertical: 12,
    marginTop: 8,
    ...shadows.soft,
  },
  checkBtnDisabled: {
    opacity: 0.5,
  },
  checkBtnText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10.5,
    color: "#ffffff",
    letterSpacing: 1.2,
  },

  /* Results */
  resultSection: {
    marginTop: 4,
  },
  validCard: {
    borderRadius: 20,
    padding: spacing[5],
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.35)",
    gap: 12,
    ...shadows.soft,
  },
  validTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  validBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(74, 222, 128, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "rgba(74, 222, 128, 0.25)",
  },
  validBadgeText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 8.5,
    color: "#4ade80",
    letterSpacing: 0.6,
  },
  validCodeText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.6)",
    letterSpacing: 1,
  },
  validAmountBlock: {
    gap: 1,
  },
  validAmount: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 28,
    color: "#E8CF8F",
  },
  validAmountLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 8.5,
    color: "rgba(255, 255, 255, 0.6)",
    letterSpacing: 0.8,
  },
  messageBubble: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: radii.md,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  messageText: {
    fontFamily: fontFamilies.display.italic,
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.85)",
    lineHeight: 16,
  },
  validFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
  },
  validExpiryText: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 10,
    color: "rgba(255, 255, 255, 0.6)",
  },
  useInStoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#E8CF8F",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
  },
  useInStoreBtnText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
    color: "#181b12",
    letterSpacing: 0.5,
  },

  /* Invalid Card */
  invalidCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: spacing[5],
    borderWidth: 1,
    borderColor: "rgba(220, 38, 38, 0.2)",
    alignItems: "center",
    gap: 6,
    ...shadows.soft,
  },
  invalidIconBox: {
    marginBottom: 2,
  },
  invalidTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 16,
    color: colors.light.foreground,
  },
  invalidDesc: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.light.mutedForeground,
    textAlign: "center",
    lineHeight: 17,
  },

  /* Assistance */
  assistanceCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.08)",
    ...shadows.soft,
  },
  assistanceTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12.5,
    color: colors.light.foreground,
  },
  assistanceDesc: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11.5,
    color: colors.light.mutedForeground,
    lineHeight: 16,
  },
});
