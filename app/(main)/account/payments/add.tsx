import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
import { colors, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

const BRAND_STYLES: Record<PaymentBrand, { name: string; gradient: [string, string]; logoText: string }> = {
  visa: { name: "Visa", gradient: ["#1A2A52", "#0B1326"], logoText: "VISA" },
  mastercard: { name: "Mastercard", gradient: ["#3E1B22", "#1C0D10"], logoText: "mastercard" },
  amex: { name: "American Express", gradient: ["#1F382E", "#0E1A15"], logoText: "AMEX" },
};
/** Shown before a brand is recognised — neutral, so we don't imply "Visa" for every card. */
const NEUTRAL_GRADIENT: [string, string] = [colors.olive[700], colors.olive[950]];

type FieldKey = "number" | "holder" | "exp" | "cvv";

/** Standard Luhn checksum — catches most mistyped card numbers before submit. */
function passesLuhn(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return digits.length > 0 && sum % 10 === 0;
}

/** Typed digits followed by masked placeholders in the brand's grouping. */
function previewNumber(formatted: string, brand: PaymentBrand | null): string {
  const template = brand === "amex" ? "•••• •••••• •••••" : "•••• •••• •••• ••••";
  return formatted + template.slice(formatted.length);
}

function validate(fields: { number: string; holder: string; exp: string; cvv: string }, brand: PaymentBrand | null) {
  const errors: Partial<Record<FieldKey, string>> = {};
  const digits = fields.number.replace(/\D/g, "");
  if (!digits) errors.number = "Enter your card number";
  else if (!brand) errors.number = "We accept Visa, Mastercard and American Express";
  else if (digits.length !== cardNumberMaxLength(brand) || !passesLuhn(digits))
    errors.number = "This card number doesn't look right";

  if (!fields.holder.trim()) errors.holder = "Enter the name on the card";

  const expDigits = fields.exp.replace(/\D/g, "");
  if (expDigits.length !== 4) {
    errors.exp = "Use MM/YY";
  } else {
    const m = parseInt(expDigits.slice(0, 2), 10);
    const y = 2000 + parseInt(expDigits.slice(2), 10);
    const now = new Date();
    if (m < 1 || m > 12) errors.exp = "Month must be 01–12";
    else if (y < now.getFullYear() || (y === now.getFullYear() && m < now.getMonth() + 1))
      errors.exp = "This card has expired";
  }

  const cvvLen = brand === "amex" ? 4 : 3;
  if (fields.cvv.length !== cvvLen) errors.cvv = `${cvvLen} digits`;

  return errors;
}

export default function AddPaymentMethodScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();

  const [number, setNumber] = useState("");
  const [holder, setHolder] = useState(user?.user_metadata?.full_name || "");
  const [exp, setExp] = useState("");
  const [cvv, setCvv] = useState("");
  const [isDefault, setIsDefault] = useState(true);
  const [saving, setSaving] = useState(false);
  // Errors only show for fields the user has left (or after a submit attempt),
  // so the form doesn't shout while they're still typing.
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [focused, setFocused] = useState<FieldKey | null>(null);

  const brand = detectPaymentBrand(number);
  const brandMeta = brand ? BRAND_STYLES[brand] : null;
  const errors = useMemo(() => validate({ number, holder, exp, cvv }, brand), [number, holder, exp, cvv, brand]);
  const isValid = Object.keys(errors).length === 0;
  const errorFor = (k: FieldKey) => (touched[k] ? errors[k] : undefined);
  const blur = (k: FieldKey) => {
    setFocused(null);
    setTouched((t) => ({ ...t, [k]: true }));
  };

  const handleExpChange = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 4);
    setExp(digits.length <= 2 ? digits : `${digits.slice(0, 2)}/${digits.slice(2)}`);
  };

  const handleSave = async () => {
    setTouched({ number: true, holder: true, exp: true, cvv: true });
    if (!isValid || !brand || saving) return;

    const digits = number.replace(/\D/g, "");
    const expDigits = exp.replace(/\D/g, "");
    setSaving(true);
    try {
      const res = await createPaymentMethodBackend({
        brand: brand as SavedCardBrand,
        last4: digits.slice(-4),
        exp_month: parseInt(expDigits.slice(0, 2), 10),
        exp_year: 2000 + parseInt(expDigits.slice(2), 10),
        holder: holder.trim(),
        is_default: isDefault,
      });
      if (!res.ok) {
        toast(res.error || "Couldn't save this card. Try again.", "error");
        return;
      }
      toast(`${brandMeta?.name ?? "Card"} ending ${digits.slice(-4)} saved`, "success");
      router.replace("/(main)/account/payments");
    } catch {
      toast("Couldn't save this card. Try again.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
          hitSlop={12}
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={20} color={colors.light.foreground} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Add card</Text>
        <View style={styles.backButtonPlaceholder} />
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Live card preview */}
          <LinearGradient
            colors={brandMeta?.gradient ?? NEUTRAL_GRADIENT}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cardArt}
          >
            <View style={styles.cardArtTop}>
              <View style={styles.cardChip}>
                <View style={styles.cardChipLine} />
              </View>
              {brandMeta ? (
                <Text style={styles.cardBrandLogo}>{brandMeta.logoText}</Text>
              ) : (
                <Ionicons name="card-outline" size={22} color="rgba(255,255,255,0.6)" />
              )}
            </View>

            <Text style={styles.cardNumber} numberOfLines={1} adjustsFontSizeToFit>
              {previewNumber(number, brand)}
            </Text>

            <View style={styles.cardArtBottom}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardLabel}>Cardholder</Text>
                <Text style={styles.cardValue} numberOfLines={1}>
                  {holder.trim() ? holder.toUpperCase() : "YOUR NAME"}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.cardLabel}>Expires</Text>
                <Text style={styles.cardValue}>{exp || "MM/YY"}</Text>
              </View>
            </View>
          </LinearGradient>

          {/* Fields */}
          <View style={styles.form}>
            <Field
              label="Card number"
              error={errorFor("number")}
              focused={focused === "number"}
              trailing={
                brandMeta ? (
                  <View style={styles.brandPill}>
                    <Text style={styles.brandPillText}>{brandMeta.name}</Text>
                  </View>
                ) : null
              }
            >
              <TextInput
                style={styles.textInput}
                value={number}
                onChangeText={(v) => setNumber(formatCardNumberInput(v, detectPaymentBrand(v)))}
                onFocus={() => setFocused("number")}
                onBlur={() => blur("number")}
                placeholder="1234 5678 9012 3456"
                placeholderTextColor={colors.light.mutedForeground + "80"}
                keyboardType="number-pad"
                textContentType="creditCardNumber"
                autoComplete="cc-number"
                maxLength={cardNumberMaxLength(brand) + 3}
              />
            </Field>

            <Field label="Name on card" error={errorFor("holder")} focused={focused === "holder"}>
              <TextInput
                style={styles.textInput}
                value={holder}
                onChangeText={setHolder}
                onFocus={() => setFocused("holder")}
                onBlur={() => blur("holder")}
                placeholder="As printed on the card"
                placeholderTextColor={colors.light.mutedForeground + "80"}
                autoCapitalize="words"
                textContentType="name"
                autoComplete="cc-name"
              />
            </Field>

            <View style={styles.twoCol}>
              <View style={{ flex: 1 }}>
                <Field label="Expiry" error={errorFor("exp")} focused={focused === "exp"}>
                  <TextInput
                    style={styles.textInput}
                    value={exp}
                    onChangeText={handleExpChange}
                    onFocus={() => setFocused("exp")}
                    onBlur={() => blur("exp")}
                    placeholder="MM/YY"
                    placeholderTextColor={colors.light.mutedForeground + "80"}
                    keyboardType="number-pad"
                    autoComplete="cc-exp"
                    maxLength={5}
                  />
                </Field>
              </View>
              <View style={{ flex: 1 }}>
                <Field
                  label="CVV"
                  error={errorFor("cvv")}
                  focused={focused === "cvv"}
                  onLabelHelp={() =>
                    Alert.alert(
                      "Where's the CVV?",
                      brand === "amex"
                        ? "The 4-digit code printed on the front of your card, above the number."
                        : "The 3-digit code on the back of your card, next to the signature strip.",
                    )
                  }
                >
                  <TextInput
                    style={styles.textInput}
                    value={cvv}
                    onChangeText={(v) => setCvv(v.replace(/\D/g, "").slice(0, brand === "amex" ? 4 : 3))}
                    onFocus={() => setFocused("cvv")}
                    onBlur={() => blur("cvv")}
                    placeholder={brand === "amex" ? "4 digits" : "3 digits"}
                    placeholderTextColor={colors.light.mutedForeground + "80"}
                    keyboardType="number-pad"
                    autoComplete="cc-csc"
                    maxLength={4}
                    secureTextEntry
                  />
                </Field>
              </View>
            </View>

            <Pressable style={styles.toggleRow} onPress={() => setIsDefault((v) => !v)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleLabel}>Use as my default card</Text>
                <Text style={styles.toggleSub}>Pre-selected at checkout</Text>
              </View>
              <Switch
                value={isDefault}
                onValueChange={setIsDefault}
                trackColor={{ false: colors.light.border, true: colors.light.primary }}
                thumbColor={colors.paper.cream}
              />
            </Pressable>

            {/* Accurate to what this screen actually sends: brand, last 4,
                expiry and name. The full number and CVV never leave the device. */}
            <View style={styles.securityNote}>
              <Ionicons name="lock-closed-outline" size={15} color={colors.olive[700]} />
              <Text style={styles.securityText}>
                We only keep the card type, last 4 digits, expiry and name. Your full card number and
                CVV are never stored.
              </Text>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.submitButton, (!isValid || saving) && styles.submitButtonDisabled]}
            disabled={saving}
            onPress={handleSave}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color={colors.light.primaryForeground} size="small" />
            ) : (
              <Text style={styles.submitButtonText}>Save card</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label,
  error,
  focused,
  trailing,
  onLabelHelp,
  children,
}: {
  label: string;
  error?: string;
  focused?: boolean;
  trailing?: React.ReactNode;
  onLabelHelp?: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {onLabelHelp ? (
          <TouchableOpacity onPress={onLabelHelp} hitSlop={8} accessibilityLabel={`What is ${label}?`}>
            <Ionicons name="help-circle-outline" size={15} color={colors.light.mutedForeground} />
          </TouchableOpacity>
        ) : null}
      </View>
      <View style={[styles.inputWrapper, focused && styles.inputFocused, error ? styles.inputError : null]}>
        {children}
        {trailing}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.light.background },
  flex: { flex: 1 },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[2],
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.border + "99",
    alignItems: "center",
    justifyContent: "center",
  },
  backButtonPlaceholder: { width: 40, height: 40 },
  topTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 19,
    color: colors.light.foreground,
  },

  scrollContent: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    paddingBottom: spacing[8],
    gap: spacing[6],
  },

  // Card preview — real card proportions (85.6 × 54 mm)
  cardArt: {
    width: "100%",
    aspectRatio: 1.586,
    borderRadius: radii["2xl"],
    padding: spacing[5],
    justifyContent: "space-between",
  },
  cardArtTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardChip: {
    width: 40,
    height: 30,
    borderRadius: 6,
    backgroundColor: "#D9BC72",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  cardChipLine: { height: 1, backgroundColor: "rgba(0,0,0,0.25)" },
  cardBrandLogo: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 18,
    letterSpacing: 1,
    color: "#ffffff",
    fontStyle: "italic",
  },
  cardNumber: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 20,
    letterSpacing: 1.5,
    color: "#ffffff",
  },
  cardArtBottom: { flexDirection: "row", alignItems: "flex-end", gap: spacing[4] },
  cardLabel: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 10,
    color: "rgba(255,255,255,0.6)",
    marginBottom: 2,
  },
  cardValue: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 14,
    letterSpacing: 1,
    color: "#ffffff",
  },

  form: { gap: spacing[4] },
  field: { gap: 6 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  fieldLabel: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 13,
    color: colors.light.foreground,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    height: 50,
    paddingHorizontal: 14,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.paper.cream,
  },
  inputFocused: { borderColor: colors.light.ring, borderWidth: 1.5 },
  inputError: { borderColor: colors.light.destructive },
  textInput: {
    flex: 1,
    height: "100%",
    fontFamily: fontFamilies.sans.regular,
    fontSize: 16,
    color: colors.light.foreground,
  },
  errorText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12,
    color: colors.light.destructive,
  },
  brandPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    backgroundColor: colors.olive[50],
    borderWidth: 1,
    borderColor: colors.olive[100],
  },
  brandPillText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 11,
    color: colors.olive[800],
  },
  twoCol: { flexDirection: "row", gap: spacing[3] },

  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.paper.cream,
    marginTop: spacing[1],
  },
  toggleLabel: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14,
    color: colors.light.foreground,
  },
  toggleSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.light.mutedForeground,
    marginTop: 2,
  },

  securityNote: {
    flexDirection: "row",
    gap: spacing[2],
    alignItems: "flex-start",
    paddingHorizontal: spacing[1],
  },
  securityText: {
    flex: 1,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.light.mutedForeground,
  },

  footer: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    paddingBottom: spacing[2],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.light.border,
    backgroundColor: colors.light.background,
  },
  submitButton: {
    height: 52,
    borderRadius: radii.full,
    backgroundColor: colors.light.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonDisabled: { opacity: 0.5 },
  submitButtonText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 15,
    color: colors.light.primaryForeground,
  },
});
