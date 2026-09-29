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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
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
  not_found: "Voucher code not found. Please check the characters and try again.",
  voided: "This gift voucher has been voided by the issuer.",
  expired: "This gift voucher has passed its validity window.",
  inactive: "This gift voucher is currently inactive or awaiting payment confirmation.",
  empty: "This gift voucher has no remaining store credit.",
  scheduled: "This gift voucher is scheduled for future delivery and is not yet active.",
  currency_mismatch: "Voucher currency does not match your shopping region.",
};

const GOLD = colors.accent2.ochre;
const GOLD_DEEP = "#85651b";
const GOLD_SOFT = "#E8CF8F";
const HAIRLINE = "rgba(22, 23, 15, 0.08)";

export default function RedeemGiftCardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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

  const canSubmit = code.trim().length >= 4 && !checking;

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

          <Text style={styles.navTitle}>Redeem voucher</Text>

          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => router.push("/(main)/account/gift-cards" as any)}
            activeOpacity={0.7}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="My vouchers"
          >
            <Ionicons name="wallet-outline" size={18} color={colors.light.foreground} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 40 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Heading */}
          <View style={styles.pageHead}>
            <Text style={styles.eyebrow}>Store credit</Text>
            <Text style={styles.pageTitle}>
              Redeem a <Text style={styles.pageTitleAccent}>voucher.</Text>
            </Text>
            <Text style={styles.pageSub}>
              Check the balance on a physical or digital voucher before you shop.
            </Text>
          </View>

          {/* Code input */}
          <View style={styles.inputCard}>
            <View style={styles.inputField}>
              <Ionicons name="barcode-outline" size={18} color={GOLD_DEEP} />
              <TextInput
                style={styles.textInput}
                value={code}
                onChangeText={(v) => setCode(v.toUpperCase())}
                placeholder="XXXX-XXXX-XXXX-XXXX"
                placeholderTextColor={colors.light.mutedForeground}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={40}
                returnKeyType="done"
                onSubmitEditing={canSubmit ? onCheck : undefined}
              />
              {code.length > 0 && (
                <TouchableOpacity
                  onPress={() => setCode("")}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Clear code"
                >
                  <Ionicons
                    name="close-circle"
                    size={17}
                    color={colors.light.mutedForeground}
                  />
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.inputHint}>
              The 16-character code in your gift email or on the back of the card.
            </Text>

            <TouchableOpacity
              style={[styles.primaryBtn, !canSubmit && styles.primaryBtnDisabled]}
              onPress={onCheck}
              disabled={!canSubmit}
              activeOpacity={0.88}
              accessibilityRole="button"
            >
              {checking ? (
                <ActivityIndicator size="small" color={colors.paper.cream} />
              ) : (
                <>
                  <Text style={styles.primaryBtnText}>Verify voucher</Text>
                  <View style={styles.primaryBtnArrow}>
                    <Ionicons name="checkmark" size={15} color={colors.olive[900]} />
                  </View>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Result */}
          {result && (
            result.valid && result.card ? (
              <LinearGradient
                colors={["#1f2418", "#14170e"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.validCard}
              >
                <View style={styles.validTop}>
                  <View style={styles.validBadge}>
                    <Ionicons name="checkmark" size={11} color="#1f2418" />
                    <Text style={styles.validBadgeText}>Active</Text>
                  </View>
                  <Text style={styles.validCode} numberOfLines={1}>
                    {result.card.code}
                  </Text>
                </View>

                <Text style={styles.validEyebrow}>Available balance</Text>
                <Text style={styles.validAmount}>
                  {formatPrice(result.card.current_balance, result.card.currency)}
                </Text>

                {result.card.message ? (
                  <Text style={styles.validMessage} numberOfLines={3}>
                    &quot;{result.card.message}&quot;
                  </Text>
                ) : null}

                <View style={styles.validFooter}>
                  <View style={styles.validExpiryRow}>
                    <Ionicons
                      name="calendar-outline"
                      size={12}
                      color="rgba(250, 248, 241, 0.55)"
                    />
                    <Text style={styles.validExpiry}>
                      {result.card.expires_at
                        ? `Expires ${new Date(result.card.expires_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`
                        : "No expiry"}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.shopBtn}
                    onPress={() => router.push("/(main)/products" as any)}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                  >
                    <Text style={styles.shopBtnText}>Shop now</Text>
                    <Ionicons name="arrow-forward" size={12} color={colors.olive[900]} />
                  </TouchableOpacity>
                </View>
              </LinearGradient>
            ) : (
              <View style={styles.invalidCard}>
                <View style={styles.invalidIcon}>
                  <Ionicons name="close" size={18} color={colors.accent2.rust} />
                </View>
                <Text style={styles.invalidTitle}>Cannot redeem this voucher</Text>
                <Text style={styles.invalidDesc}>
                  {result.reason
                    ? (REASONS[result.reason] ?? result.reason)
                    : "This code could not be verified."}
                </Text>
              </View>
            )
          )}

          {/* Help footnote */}
          <View style={styles.assistCard}>
            <View style={styles.assistIcon}>
              <Ionicons name="help" size={14} color={GOLD_DEEP} />
            </View>
            <View style={styles.assistBody}>
              <Text style={styles.assistTitle}>Need help?</Text>
              <Text style={styles.assistDesc}>
                If a voucher won&apos;t activate, our concierge team can verify it
                for you manually.
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

  /* Nav */
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[2.5],
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.paper.cream,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: HAIRLINE,
  },
  navTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 15,
    color: colors.light.foreground,
  },

  scrollContent: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
    gap: 14,
  },

  /* Heading */
  pageHead: {
    marginBottom: spacing[2],
  },
  eyebrow: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: GOLD_DEEP,
    marginBottom: 4,
  },
  pageTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 32,
    letterSpacing: -0.6,
    lineHeight: 38,
    color: colors.light.foreground,
  },
  pageTitleAccent: {
    fontFamily: fontFamilies.display.italic,
    color: GOLD_DEEP,
  },
  pageSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.light.mutedForeground,
    marginTop: 6,
    maxWidth: 300,
  },

  /* Input card */
  inputCard: {
    backgroundColor: colors.paper.cream,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: HAIRLINE,
    padding: spacing[4],
    gap: 10,
    ...shadows.soft,
  },
  inputField: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.paper.warm,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: HAIRLINE,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "ios" ? 12 : 8,
  },
  textInput: {
    flex: 1,
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 14,
    letterSpacing: 1.4,
    color: colors.light.foreground,
    padding: 0,
  },
  inputHint: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.light.mutedForeground,
    paddingHorizontal: 4,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 50,
    borderRadius: radii.full,
    backgroundColor: colors.olive[900],
    paddingRight: 6,
  },
  primaryBtnDisabled: {
    opacity: 0.45,
  },
  primaryBtnText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 14,
    color: colors.paper.cream,
  },
  primaryBtnArrow: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.paper.cream,
    alignItems: "center",
    justifyContent: "center",
  },

  /* Valid result */
  validCard: {
    borderRadius: 24,
    padding: spacing[5],
    gap: 4,
    ...shadows.editorial,
  },
  validTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
  },
  validBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: GOLD_SOFT,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  validBadgeText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 11,
    color: "#1f2418",
  },
  validCode: {
    flexShrink: 1,
    fontFamily: fontFamilies.mono.medium,
    fontSize: 11.5,
    letterSpacing: 1,
    color: "rgba(250, 248, 241, 0.55)",
  },
  validEyebrow: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: "rgba(232, 207, 143, 0.85)",
  },
  validAmount: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 38,
    letterSpacing: -0.8,
    color: colors.paper.cream,
  },
  validMessage: {
    fontFamily: fontFamilies.display.italic,
    fontSize: 14,
    lineHeight: 20,
    color: "rgba(250, 248, 241, 0.8)",
    marginTop: 6,
  },
  validFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing[4],
    paddingTop: spacing[3],
    borderTopWidth: 1,
    borderTopColor: "rgba(250, 248, 241, 0.12)",
  },
  validExpiryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  validExpiry: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: "rgba(250, 248, 241, 0.6)",
  },
  shopBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: GOLD_SOFT,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.full,
  },
  shopBtnText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 12.5,
    color: colors.olive[900],
  },

  /* Invalid result */
  invalidCard: {
    backgroundColor: colors.paper.cream,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(184, 92, 58, 0.25)",
    paddingVertical: spacing[6],
    paddingHorizontal: spacing[5],
    alignItems: "center",
    gap: 6,
  },
  invalidIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(184, 92, 58, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  invalidTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 18,
    letterSpacing: -0.2,
    color: colors.light.foreground,
  },
  invalidDesc: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.light.mutedForeground,
    textAlign: "center",
    maxWidth: 280,
  },

  /* Assist */
  assistCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: colors.paper.cream,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: HAIRLINE,
    padding: 14,
  },
  assistIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(200, 164, 74, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  assistBody: {
    flex: 1,
    gap: 3,
  },
  assistTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: colors.light.foreground,
  },
  assistDesc: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.light.mutedForeground,
  },
});
