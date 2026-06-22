import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { SafeAreaView } from "react-native-safe-area-context";
import { Display } from "@/components/ui/Typography";
import { useAuth } from "@/lib/supabase/auth";
import { useToast } from "@/components/ui";
import {
  detectPaymentBrand,
  formatCardNumberDisplay,
  formatCardNumberInput,
  getStoredPayments,
  isValidCardNumber,
  PAYMENT_BRAND_META,
  setStoredPayments,
  cvvMaxLength,
  type PaymentCard,
} from "@/lib/account-local";
import { colors, radii, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

export default function AddPaymentMethodScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [setDefault, setSetDefault] = useState(true);
  const [form, setForm] = useState({ number: "", holder: "", exp: "", cvv: "" });

  const detectedBrand = useMemo(
    () => detectPaymentBrand(form.number),
    [form.number]
  );
  const brandMeta = detectedBrand ? PAYMENT_BRAND_META[detectedBrand] : null;
  const cardNumberDisplay = useMemo(
    () => formatCardNumberDisplay(form.number, detectedBrand),
    [form.number, detectedBrand]
  );
  const holderDisplay = form.holder.trim().toUpperCase() || "JOHN DOE";
  const expDisplay = form.exp || "MM/YY";
  const cvvLimit = cvvMaxLength(detectedBrand);

  const saveCard = async () => {
    const clean = form.number.replace(/\s+/g, "");
    const brand = detectPaymentBrand(clean);
    if (!brand || !isValidCardNumber(clean, brand)) {
      toast("Enter a valid card number", "error");
      return;
    }
    if (!form.holder.trim()) {
      toast("Cardholder name required", "error");
      return;
    }
    if (!/^\d{2}\/\d{2}$/.test(form.exp)) {
      toast("Use MM/YY expiry", "error");
      return;
    }
    if (form.cvv.length < cvvLimit) {
      toast(`Enter a valid ${cvvLimit}-digit CVV`, "error");
      return;
    }

    const existing = await getStoredPayments(user?.id);
    const next: PaymentCard = {
      id: `card-${Date.now()}`,
      brand,
      last4: clean.slice(-4),
      exp: form.exp,
      holder: form.holder.trim(),
      is_default: setDefault || existing.length === 0,
      added: new Date().toLocaleString("en-US", { month: "short", year: "numeric" }),
      charges: 0,
    };

    const updated = setDefault
      ? [...existing.map((c) => ({ ...c, is_default: false })), next]
      : [...existing, next];

    setSaving(true);
    setTimeout(async () => {
      await setStoredPayments(user?.id, updated);
      setSaving(false);
      toast("Card saved successfully", "success");
      router.back();
    }, 450);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.topIconBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={colors.light.foreground} />
        </TouchableOpacity>
        <Text style={styles.brandMark}>LUXE</Text>
        <TouchableOpacity
          style={styles.topIconBtn}
          onPress={() => router.push("/(main)/cart")}
          activeOpacity={0.7}
        >
          <Ionicons name="bag-outline" size={22} color={colors.light.foreground} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Display size="xl" style={styles.pageTitle}>
            Add Payment Method
          </Display>

          <View
            style={[
              styles.cardPreview,
              brandMeta ? { backgroundColor: `${brandMeta.color}18` } : null,
            ]}
          >
            <View style={styles.cardPreviewTop}>
              <View style={styles.chip}>
                <View style={styles.chipLine} />
                <View style={[styles.chipLine, styles.chipLineShort]} />
              </View>
              {brandMeta ? (
                <Text style={[styles.brandLabel, { color: brandMeta.color }]}>
                  {brandMeta.label}
                </Text>
              ) : (
                <Text style={styles.creditCardLabel}>CREDIT CARD</Text>
              )}
            </View>
            <Text style={styles.cardNumberPreview}>{cardNumberDisplay}</Text>
            <View style={styles.cardPreviewBottom}>
              <View>
                <Text style={styles.cardFieldLabel}>CARDHOLDER</Text>
                <Text style={styles.cardFieldValue} numberOfLines={1}>
                  {holderDisplay}
                </Text>
              </View>
              <View style={styles.expiresBlock}>
                <Text style={styles.cardFieldLabel}>EXPIRES</Text>
                <Text style={styles.cardFieldValue}>{expDisplay}</Text>
              </View>
            </View>
          </View>

          <View style={styles.formPanel}>
            <FormField
              label="CARD NUMBER"
              value={form.number}
              onChangeText={(v) =>
                setForm((f) => ({
                  ...f,
                  number: formatCardNumberInput(v, detectPaymentBrand(v)),
                }))
              }
              placeholder={detectedBrand === "amex" ? "0000 000000 00000" : "0000 0000 0000 0000"}
              keyboardType="number-pad"
              rightSlot={
                brandMeta ? (
                  <Text style={[styles.brandBadge, { color: brandMeta.color }]}>
                    {brandMeta.label}
                  </Text>
                ) : (
                  <Ionicons name="card-outline" size={18} color={colors.light.mutedForeground} />
                )
              }
            />
            <FormField
              label="NAME ON CARD"
              value={form.holder}
              onChangeText={(v) => setForm((f) => ({ ...f, holder: v }))}
              placeholder="JOHN DOE"
              autoCapitalize="characters"
            />
            <View style={styles.rowFields}>
              <View style={styles.halfField}>
                <FormField
                  label="EXPIRY DATE"
                  value={form.exp}
                  onChangeText={(v) => {
                    const digits = v.replace(/[^\d]/g, "").slice(0, 4);
                    setForm((f) => ({
                      ...f,
                      exp: digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits,
                    }));
                  }}
                  placeholder="MM/YY"
                  keyboardType="number-pad"
                />
              </View>
              <View style={styles.halfField}>
                <FormField
                  label="CVV"
                  value={form.cvv}
                  onChangeText={(v) =>
                    setForm((f) => ({
                      ...f,
                      cvv: v.replace(/[^\d]/g, "").slice(0, cvvMaxLength(detectPaymentBrand(f.number))),
                    }))
                  }
                  placeholder={cvvLimit === 4 ? "1234" : "123"}
                  keyboardType="number-pad"
                  secureTextEntry
                  rightSlot={
                    <Ionicons
                      name="information-circle-outline"
                      size={18}
                      color={colors.light.mutedForeground}
                    />
                  }
                />
              </View>
            </View>

            <TouchableOpacity
              style={styles.defaultRow}
              onPress={() => setSetDefault((v) => !v)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, setDefault && styles.checkboxChecked]}>
                {setDefault ? (
                  <Ionicons name="checkmark" size={12} color="#ffffff" />
                ) : null}
              </View>
              <Text style={styles.defaultLabel}>Set as default payment method</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.saveBtn}
              onPress={saveCard}
              activeOpacity={0.88}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="lock-closed" size={14} color="#ffffff" />
                  <Text style={styles.saveBtnText}>SAVE CARD</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.divider} />

            <View style={styles.securityRow}>
              <Ionicons name="shield-checkmark-outline" size={14} color={colors.light.mutedForeground} />
              <Text style={styles.securityText}>SECURE 256-BIT ENCRYPTION</Text>
            </View>

            <Text style={styles.providerMark}>Adyen</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
  secureTextEntry,
  rightSlot,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "number-pad";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  secureTextEntry?: boolean;
  rightSlot?: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputWrap}>
        <TextInput
          style={[styles.input, rightSlot ? styles.inputWithIcon : null]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#b0b0b0"
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize ?? "none"}
          secureTextEntry={secureTextEntry}
        />
        {rightSlot ? <View style={styles.inputIcon}>{rightSlot}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  flex: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e8e8e8",
  },
  topIconBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  brandMark: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: typography.fontSizes.lg,
    color: colors.light.foreground,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  scroll: {
    paddingBottom: spacing[8],
  },
  pageTitle: {
    textAlign: "center",
    marginTop: spacing[6],
    marginBottom: spacing[6],
    color: colors.light.foreground,
    fontFamily: fontFamilies.display.regular,
    letterSpacing: -0.3,
  },
  cardPreview: {
    marginHorizontal: spacing[5],
    backgroundColor: "#ececea",
    borderRadius: radii.xl,
    padding: spacing[5],
    minHeight: 168,
    justifyContent: "space-between",
    marginBottom: spacing[5],
  },
  cardPreviewTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  chip: {
    width: 34,
    height: 26,
    borderRadius: 4,
    backgroundColor: "#d8d8d4",
    borderWidth: 1,
    borderColor: "#c8c8c4",
    padding: 4,
    justifyContent: "center",
    gap: 3,
  },
  chipLine: {
    height: 2,
    borderRadius: 1,
    backgroundColor: "#b0b0ac",
  },
  chipLineShort: {
    width: "70%",
  },
  creditCardLabel: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 10,
    color: "#8a8a86",
    letterSpacing: 1.2,
  },
  brandLabel: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 11,
    letterSpacing: 1.4,
  },
  cardNumberPreview: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: typography.fontSizes.lg,
    color: "#6a6a66",
    letterSpacing: 2,
    marginVertical: spacing[4],
  },
  cardPreviewBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  expiresBlock: {
    alignItems: "flex-end",
  },
  cardFieldLabel: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 9,
    color: "#9a9a96",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  cardFieldValue: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    color: "#5a5a56",
    letterSpacing: 0.5,
    maxWidth: 180,
  },
  formPanel: {
    backgroundColor: "#f3f3f1",
    paddingHorizontal: spacing[5],
    paddingTop: spacing[6],
    paddingBottom: spacing[8],
    flex: 1,
  },
  field: {
    marginBottom: spacing[5],
  },
  fieldLabel: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 10,
    color: "#8a8a86",
    letterSpacing: 1,
    marginBottom: spacing[2],
  },
  inputWrap: {
    position: "relative",
    justifyContent: "center",
  },
  input: {
    backgroundColor: "#ffffff",
    borderRadius: radii.md,
    paddingHorizontal: spacing[4],
    paddingVertical: 14,
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.base,
    color: colors.light.foreground,
  },
  inputWithIcon: {
    paddingRight: 72,
  },
  inputIcon: {
    position: "absolute",
    right: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  brandBadge: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 11,
    letterSpacing: 0.8,
  },
  rowFields: {
    flexDirection: "row",
    gap: spacing[3],
  },
  halfField: {
    flex: 1,
  },
  defaultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    marginTop: spacing[1],
    marginBottom: spacing[6],
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: "#c0c0bc",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: colors.light.foreground,
    borderColor: colors.light.foreground,
  },
  defaultLabel: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    color: colors.light.foreground,
    flex: 1,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[2],
    backgroundColor: colors.light.foreground,
    paddingVertical: 16,
    borderRadius: radii.md,
  },
  saveBtnText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.sm,
    color: "#ffffff",
    letterSpacing: 1.2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#d8d8d4",
    marginVertical: spacing[6],
  },
  securityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[2],
  },
  securityText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 10,
    color: colors.light.mutedForeground,
    letterSpacing: 1,
  },
  providerMark: {
    textAlign: "center",
    marginTop: spacing[4],
    fontFamily: fontFamilies.sans.bold,
    fontSize: typography.fontSizes.lg,
    color: "#1a3fad",
    letterSpacing: -0.5,
  },
});
