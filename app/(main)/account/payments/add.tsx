import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@/components/ui/Icon";
import { useToast } from "@/components/ui";
import { useAuth } from "@/lib/supabase/auth";
import { createPaymentMethodBackend, type SavedCardBrand } from "@/lib/api/backend";
import {
  detectPaymentBrand,
  formatCardNumberInput,
  cardNumberMaxLength,
  type PaymentBrand,
} from "@/lib/account-local";
import { colors, radii, shadows, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

const BRAND_STYLES: Record<
  PaymentBrand,
  { name: string; gradient: [string, string, string]; logoText: string; accent: string }
> = {
  visa: {
    name: "Visa",
    gradient: ["#101C36", "#192B52", "#0B1326"],
    logoText: "VISA",
    accent: "#E8CF8F",
  },
  mastercard: {
    name: "Mastercard",
    gradient: ["#2B1318", "#3E1B22", "#1C0D10"],
    logoText: "MASTERCARD",
    accent: "#EB001B",
  },
  amex: {
    name: "American Express",
    gradient: ["#14241E", "#1F382E", "#0E1A15"],
    logoText: "AMEX",
    accent: "#C8A44A",
  },
};

export default function AddPaymentMethodScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();

  const [rawNumber, setRawNumber] = useState("");
  const [holder, setHolder] = useState(user?.user_metadata?.full_name || "");
  const [exp, setExp] = useState("");
  const [cvv, setCvv] = useState("");
  const [isDefault, setIsDefault] = useState(true);
  const [saving, setSaving] = useState(false);

  // Auto-detect brand from raw numbers
  const detectedBrand: PaymentBrand = detectPaymentBrand(rawNumber) ?? "visa";
  const brandMeta = BRAND_STYLES[detectedBrand];

  const handleCardNumberChange = (val: string) => {
    const formatted = formatCardNumberInput(val, detectPaymentBrand(val));
    setRawNumber(formatted);
  };

  const handleExpChange = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 4);
    if (digits.length <= 2) {
      setExp(digits);
    } else {
      setExp(`${digits.slice(0, 2)}/${digits.slice(2)}`);
    }
  };

  const handleSaveCard = async () => {
    const cleanNumber = rawNumber.replace(/\D/g, "");
    if (cleanNumber.length < 15) {
      toast("Please enter a valid 15 or 16-digit card number", "error");
      return;
    }
    if (!holder.trim()) {
      toast("Please enter the cardholder's full name", "error");
      return;
    }

    const cleanExp = exp.replace(/\D/g, "");
    if (cleanExp.length !== 4) {
      toast("Please enter expiration as MM/YY", "error");
      return;
    }

    const expMonth = parseInt(cleanExp.slice(0, 2), 10);
    const expYear = 2000 + parseInt(cleanExp.slice(2, 4), 10);

    if (expMonth < 1 || expMonth > 12) {
      toast("Expiration month must be between 01 and 12", "error");
      return;
    }

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    if (expYear < currentYear || (expYear === currentYear && expMonth < currentMonth)) {
      toast("Card expiration date is in the past", "error");
      return;
    }

    if (cvv.length < 3) {
      toast("Please enter a valid 3 or 4-digit CVV security code", "error");
      return;
    }

    const last4 = cleanNumber.slice(-4);

    setSaving(true);
    try {
      const res = await createPaymentMethodBackend({
        brand: detectedBrand as SavedCardBrand,
        last4,
        exp_month: expMonth,
        exp_year: expYear,
        holder: holder.trim(),
        is_default: isDefault,
      });

      setSaving(false);

      if (!res.ok) {
        toast(res.error || "Failed to register payment instrument", "error");
        return;
      }

      toast("Payment card registered to vault", "success");
      // Replace back to payments list
      router.replace("/(main)/account/payments");
    } catch {
      setSaving(false);
      toast("Failed to register payment instrument", "error");
    }
  };

  // Preview display number
  const displayNumber = rawNumber
    ? rawNumber
    : "•••• •••• •••• ••••";

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      {/* 1. Atelier Top Navigation Header */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={20} color="#141311" />
        </TouchableOpacity>

        <View style={styles.headerTitleCenter}>
          <Text style={styles.headerEyebrow}>FINANCIAL VAULT</Text>
          <Text style={styles.headerTitle}>Add Payment Card</Text>
        </View>

        <View style={styles.shieldMedallionSmall}>
          <Ionicons name="shield-checkmark" size={18} color="#C8A44A" />
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* 2. Live Luxury Embossed Card Preview */}
          <View style={styles.cardPreviewWrapper}>
            <LinearGradient
              colors={brandMeta.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.cardArt}
            >
              {/* Card Top Row */}
              <View style={styles.cardArtTop}>
                {/* Gold Micro-chip */}
                <View style={styles.cardChip}>
                  <View style={styles.cardChipLine} />
                </View>

                {/* Brand Logo Badge */}
                <View style={styles.cardBrandBadge}>
                  <Text style={styles.cardBrandLogo}>{brandMeta.logoText}</Text>
                </View>
              </View>

              {/* Masked / Live Number */}
              <Text style={styles.cardNumber}>{displayNumber}</Text>

              {/* Card Bottom Row */}
              <View style={styles.cardArtBottom}>
                <View style={styles.cardHolderCol}>
                  <Text style={styles.cardHolderLabel}>CARDHOLDER</Text>
                  <Text style={styles.cardHolderName} numberOfLines={1}>
                    {(holder || "PATRON NAME").toUpperCase()}
                  </Text>
                </View>

                <View style={styles.cardExpCol}>
                  <Text style={styles.cardExpiresLabel}>EXPIRES</Text>
                  <Text style={styles.cardExpiresDate}>{exp || "MM/YY"}</Text>
                </View>
              </View>
            </LinearGradient>
          </View>

          {/* 3. Card Input Form Fields */}
          <View style={styles.formCard}>
            <View style={styles.formHeaderRow}>
              <View>
                <Text style={styles.sectionEyebrow}>TOKENIZED ENROLLMENT</Text>
                <Text style={styles.sectionTitle}>Card Information</Text>
              </View>
              <View style={styles.pciPill}>
                <Ionicons name="lock-closed" size={10} color="#2B6E3F" />
                <Text style={styles.pciPillText}>256-BIT ENCRYPTED</Text>
              </View>
            </View>

            {/* Card Number Input */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>CARD NUMBER</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="card-outline" size={16} color="#85651B" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  value={rawNumber}
                  onChangeText={handleCardNumberChange}
                  placeholder="4000 1234 5678 9010"
                  placeholderTextColor="#9C988F"
                  keyboardType="number-pad"
                  maxLength={cardNumberMaxLength(detectedBrand) + 4}
                />
                <View style={styles.detectedBrandPill}>
                  <Text style={styles.detectedBrandText}>{brandMeta.name}</Text>
                </View>
              </View>
            </View>

            {/* Cardholder Name */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>CARDHOLDER FULL NAME</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="person-outline" size={16} color="#85651B" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  value={holder}
                  onChangeText={setHolder}
                  placeholder="Name as printed on card"
                  placeholderTextColor="#9C988F"
                  autoCapitalize="characters"
                />
              </View>
            </View>

            {/* Expiry & CVV Row */}
            <View style={styles.twoColRow}>
              {/* Expiry Date */}
              <View style={[styles.field, styles.halfCol]}>
                <Text style={styles.fieldLabel}>EXPIRATION (MM/YY)</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="calendar-outline" size={16} color="#85651B" style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    value={exp}
                    onChangeText={handleExpChange}
                    placeholder="12/28"
                    placeholderTextColor="#9C988F"
                    keyboardType="number-pad"
                    maxLength={5}
                  />
                </View>
              </View>

              {/* CVV */}
              <View style={[styles.field, styles.halfCol]}>
                <View style={styles.cvvHeader}>
                  <Text style={styles.fieldLabel}>SECURITY CVV</Text>
                  <Ionicons name="help-circle-outline" size={13} color="#8F8B82" />
                </View>
                <View style={styles.inputWrapper}>
                  <Ionicons name="key-outline" size={16} color="#85651B" style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    value={cvv}
                    onChangeText={(v) => setCvv(v.replace(/\D/g, "").slice(0, 4))}
                    placeholder="3 or 4 digits"
                    placeholderTextColor="#9C988F"
                    keyboardType="number-pad"
                    maxLength={4}
                    secureTextEntry
                  />
                </View>
              </View>
            </View>

            {/* Default Card Toggle */}
            <View style={styles.toggleRow}>
              <View style={styles.toggleInfo}>
                <Text style={styles.toggleLabel}>Set as Default Payment Instrument</Text>
                <Text style={styles.toggleSub}>
                  Pre-selected during one-touch boutique checkout
                </Text>
              </View>
              <Switch
                value={isDefault}
                onValueChange={setIsDefault}
                trackColor={{ false: "#E0DCcf", true: "#141311" }}
                thumbColor={isDefault ? "#C8A44A" : "#FAF8F5"}
              />
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitButton, saving && { opacity: 0.7 }]}
              disabled={saving}
              onPress={handleSaveCard}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={["#1E1C18", "#141311"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.submitGradient}
              >
                {saving ? (
                  <ActivityIndicator color="#E8CF8F" size="small" />
                ) : (
                  <>
                    <Ionicons name="shield-checkmark-outline" size={16} color="#E8CF8F" />
                    <Text style={styles.submitButtonText}>Save Card to Financial Vault</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* 4. PayHere Hosted Gateway Security Guarantee Banner */}
          <View style={styles.guaranteeCard}>
            <View style={styles.guaranteeHeader}>
              <Ionicons name="lock-closed" size={16} color="#C8A44A" />
              <Text style={styles.guaranteeTitle}>PayHere & PCI-DSS Tier 1 Architecture</Text>
            </View>
            <Text style={styles.guaranteeText}>
              LUXE never stores your full card number, CVV, or PAN in local storage or on unencrypted
              servers. All transactions execute through PayHere's tokenized, 3D-Secure 2.0 banking
              infrastructure with direct OTP verification from your card issuer.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F5F4EF",
  },
  flex: {
    flex: 1,
  },
  topHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
    backgroundColor: "#F5F4EF",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E6E3DA",
    alignItems: "center",
    justifyContent: "center",
    ...shadows.soft,
  },
  headerTitleCenter: {
    alignItems: "center",
  },
  headerEyebrow: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    letterSpacing: 1.8,
    color: "#85651B",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  headerTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 20,
    color: "#141311",
    letterSpacing: -0.3,
  },
  shieldMedallionSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E6E3DA",
    alignItems: "center",
    justifyContent: "center",
    ...shadows.soft,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  /* Live Luxury Card Preview */
  cardPreviewWrapper: {
    marginBottom: 18,
    borderRadius: 20,
    ...shadows.glow,
  },
  cardArt: {
    borderRadius: 18,
    padding: 22,
    minHeight: 180,
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.3)",
  },
  cardArtTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardChip: {
    width: 40,
    height: 30,
    borderRadius: 6,
    backgroundColor: "#D8BC7E",
    borderWidth: 1,
    borderColor: "#BCA05E",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  cardChipLine: {
    height: 1,
    backgroundColor: "#A2843E",
  },
  cardBrandBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  cardBrandLogo: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 13,
    color: "#FAF8F5",
    letterSpacing: 2,
  },
  cardNumber: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 19,
    color: "#FAF8F5",
    letterSpacing: 3,
    marginVertical: 12,
  },
  cardArtBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  cardHolderCol: {
    flex: 1,
  },
  cardHolderLabel: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 8,
    letterSpacing: 1.2,
    color: "rgba(250, 248, 245, 0.6)",
    marginBottom: 2,
  },
  cardHolderName: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 12,
    color: "#FAF8F5",
    letterSpacing: 1,
    maxWidth: 200,
  },
  cardExpCol: {
    alignItems: "flex-end",
  },
  cardExpiresLabel: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 8,
    letterSpacing: 1.2,
    color: "rgba(250, 248, 245, 0.6)",
    marginBottom: 2,
  },
  cardExpiresDate: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 12,
    color: "#FAF8F5",
    letterSpacing: 1,
  },

  /* Form Card */
  formCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#EAE7DF",
    padding: 20,
    marginBottom: 16,
    ...shadows.soft,
  },
  formHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  sectionEyebrow: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 1.6,
    color: "#85651B",
    marginBottom: 2,
  },
  sectionTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 18,
    color: "#141311",
  },
  pciPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#EBF7EE",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#C5E6CC",
  },
  pciPillText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 8,
    letterSpacing: 0.8,
    color: "#2B6E3F",
  },
  field: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
    letterSpacing: 1.2,
    color: "#85651B",
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FAF9F5",
    borderWidth: 1,
    borderColor: "#E5E1D4",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 46,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 14,
    color: "#141311",
  },
  detectedBrandPill: {
    backgroundColor: "#F2EFE6",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  detectedBrandText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
    color: "#85651B",
  },
  twoColRow: {
    flexDirection: "row",
    gap: 12,
  },
  halfCol: {
    flex: 1,
  },
  cvvHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FAF9F5",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EBE7DD",
    padding: 14,
    marginTop: 4,
    marginBottom: 16,
  },
  toggleInfo: {
    flex: 1,
    marginRight: 10,
  },
  toggleLabel: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: "#141311",
    marginBottom: 2,
  },
  toggleSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: "#787469",
  },
  submitButton: {
    borderRadius: 12,
    overflow: "hidden",
  },
  submitGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
  },
  submitButtonText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14,
    color: "#FAF8F5",
  },

  /* Guarantee Card */
  guaranteeCard: {
    backgroundColor: "#FAF9F5",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#EAE6DB",
    padding: 16,
  },
  guaranteeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  guaranteeTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    color: "#141311",
  },
  guaranteeText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    lineHeight: 16,
    color: "#787469",
  },
});
