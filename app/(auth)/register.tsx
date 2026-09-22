import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Text,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@/components/ui/Icon";
import { supabase } from "@/lib/supabase/client";
import { isValidEmail, isValidPhone, normalizePhoneE164, PASSWORD_MIN_LENGTH } from "@/lib/contact-validation";
import { checkUniqueBackend, applyReferralCodeBackend, isValidReferralCode } from "@/lib/api/backend";
import { Input, useToast } from "@/components/ui";
import { colors, typography, spacing, radii, shadows } from "@/lib/theme/tokens";
import { Display, Label, Body } from "@/components/ui/Typography";
import { fontFamilies } from "@/lib/theme/fonts";
import { acceptDriverInvite, hasStoreApi } from "@/lib/api/delivery-company-api";

type UserRole = "customer" | "store_owner" | "brand_owner" | "delivery";

// Deep-link role params may use either the canonical UserRole value or a
// friendlier alias (e.g. an invite link written as "seller" or "brand").
const ROLE_PARAM_ALIASES: Record<string, UserRole> = {
  customer: "customer",
  store_owner: "store_owner",
  seller: "store_owner",
  brand_owner: "brand_owner",
  brand: "brand_owner",
  delivery: "delivery",
  rider: "delivery",
};

function resolveRoleParam(value: string | undefined): UserRole {
  if (!value) return "customer";
  return ROLE_PARAM_ALIASES[value.toLowerCase()] ?? "customer";
}

const ROLE_DETAILS: Record<
  UserRole,
  { kicker: string; description: string; icon: keyof typeof Ionicons.glyphMap; cta: string }
> = {
  customer: {
    kicker: "SHOPPER ATELIER",
    description: "Curated private drops, members-only pricing & bespoke wardrobe.",
    icon: "bag-handle-outline",
    cta: "Join as Shopper",
  },
  store_owner: {
    kicker: "BOUTIQUE SELLER",
    description: "Curated storefront, live inventory sync & automated settlements.",
    icon: "storefront-outline",
    cta: "Register Your Store",
  },
  brand_owner: {
    kicker: "ATELIER LABEL",
    description: "Official showroom registry, wholesale reach & brand analytics.",
    icon: "pricetag-outline",
    cta: "Register Your Brand",
  },
  delivery: {
    kicker: "COURIER FLEET",
    description: "Fleet driver portal, assigned route tracking & fast fulfillment.",
    icon: "bicycle-outline",
    cta: "Accept Fleet Invite",
  },
};

export default function RegisterScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ role?: string; code?: string; ref?: string; referral?: string }>();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [role, setRole] = useState<UserRole>(resolveRoleParam(params.role));
  const [inviteCode, setInviteCode] = useState(params.code ?? "");
  const initialReferral = (params.ref ?? params.referral ?? (resolveRoleParam(params.role) === "delivery" ? "" : (params.code ?? ""))).toUpperCase();
  const [referralCode, setReferralCode] = useState(initialReferral);
  const [showOptional, setShowOptional] = useState(Boolean(initialReferral));
  const [terms, setTerms] = useState(false);
  const [loading, setLoading] = useState(false);

  // Rider accounts are provisioned through delivery-company invite links
  // (?role=delivery&code=…) — never through self-serve signup.
  const rolesList: { key: UserRole; label: string; sub: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: "customer", label: "Shop", sub: "Discover & buy", icon: "bag-handle-outline" },
    { key: "store_owner", label: "Sell", sub: "Run your store", icon: "storefront-outline" },
    { key: "brand_owner", label: "Brand", sub: "Scale your label", icon: "pricetag-outline" },
  ];

  const handleRegister = async () => {
    if (!fullName.trim() || !email.trim() || !password.trim()) {
      toast("Please fill in all fields", "error");
      return;
    }

    if (!terms) {
      toast("Please agree to the terms and privacy policy", "error");
      return;
    }

    if (!isValidEmail(email)) {
      toast("Enter a valid email address", "error");
      return;
    }

    // Phone is optional in this form, but when present it must look real —
    // otherwise we hand garbage to Supabase auth and risk delivery failures
    // on every order the user later places.
    if (phone.trim() && !isValidPhone(phone)) {
      toast("Phone number looks invalid", "error");
      return;
    }

    if (password.length < PASSWORD_MIN_LENGTH) {
      toast(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`, "error");
      return;
    }

    if (password !== confirmPassword) {
      toast("Passwords do not match", "error");
      return;
    }

    if (role === "delivery" && !inviteCode.trim()) {
      toast("Enter the invite code your company sent you", "error");
      return;
    }

    setLoading(true);

    const formattedPhone = phone.trim() ? normalizePhoneE164(phone.trim()) : undefined;

    if (await hasStoreApi()) {
      const unique = await checkUniqueBackend({
        email: email.trim(),
        phone: formattedPhone,
      });
      if (!unique.ok) {
        setLoading(false);
        toast("Unable to verify registration details. Try again.", "error");
        return;
      }
      if (unique.data.emailExists) {
        setLoading(false);
        toast("Email address is already in use", "error");
        return;
      }
      if (formattedPhone && unique.data.phoneExists) {
        setLoading(false);
        toast("Phone number is already in use", "error");
        return;
      }
    }

    const trimmedReferral = referralCode.trim().toUpperCase();
    if (role !== "delivery" && trimmedReferral && !isValidReferralCode(trimmedReferral)) {
      setLoading(false);
      toast("Referral code looks invalid (4–12 letters/numbers)", "error");
      return;
    }

    const { data: signUpData, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          role: role,
          phone: formattedPhone,
        },
      },
    });

    if (error) {
      setLoading(false);
      toast(error.message, "error");
      return;
    }

    // Best-effort: attribute a friend's referral code right after signup.
    // When email confirmation is required there is no session yet — the user
    // can still apply the code later from Account → Referrals.
    if (role !== "delivery" && trimmedReferral && signUpData.session && hasStoreApi()) {
      try {
        const applied = await applyReferralCodeBackend(trimmedReferral);
        if (!applied.ok) {
          toast(`Account created, but referral code was not applied: ${applied.error}`, "error");
        }
      } catch {
        /* non-blocking — referrals screen offers a retry */
      }
    }

    // If this is a delivery signup, immediately accept the invite so the
    // driver is linked to a company. If this fails, the user can still log
    // in and accept the invite later via the invite link.
    if (role === "delivery" && inviteCode.trim() && hasStoreApi()) {
      const accept = await acceptDriverInvite(inviteCode.trim());
      if (!accept.ok) {
        setLoading(false);
        toast(
          `Account created but invite could not be redeemed: ${accept.error}. You can accept it from your invite link later.`,
          "error",
        );
        router.replace("/(auth)/login");
        return;
      }
      try {
        await supabase.auth.refreshSession();
      } catch {
        /* ignore */
      }
    }

    setLoading(false);
    toast(
      role === "delivery"
        ? "Welcome to the team! You can now sign in."
        : "Account created! Check your email for verification.",
      "success",
    );
    router.replace("/(auth)/login");
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top > 0 ? insets.top + spacing[4] : spacing[8],
            paddingBottom: insets.bottom > 0 ? insets.bottom + spacing[4] : spacing[8],
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar with back affordance & step badge */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={18} color={colors.light.foreground} />
          </TouchableOpacity>
          <View style={styles.stepPill}>
            <View style={styles.stepDot} />
            <Text style={styles.stepText}>STEP 02 / 02</Text>
          </View>
        </View>

        {/* Header section with luxury editorial brand details */}
        <View style={styles.header}>
          <View style={styles.kickerRow}>
            <View style={styles.kickerLine} />
            <Text style={styles.kicker}>THE LUXE MAISON</Text>
            <View style={styles.kickerLine} />
          </View>
          <View style={styles.titleRow}>
            <Display size="4xl" style={styles.titleText}>Join the </Display>
            <Display italic size="4xl" style={styles.titleTextItalic}>maison</Display>
            <Display size="4xl" style={styles.titleText}>.</Display>
          </View>
          <Body muted style={styles.subtitle}>
            Choose your path — shopper, seller, or label — and we'll tailor the experience.
          </Body>
        </View>

        {/* Rider invite banner — only reachable via a company invite link */}
        {role === "delivery" && (
          <View style={styles.inviteBanner}>
            <View style={styles.inviteIcon}>
              <Ionicons name="bicycle-outline" size={18} color={colors.paper.cream} />
            </View>
            <View style={{ flex: 1 }}>
              <Label style={styles.inviteKicker}>RIDER INVITE</Label>
              <Body size="xs" style={styles.inviteText}>
                You're joining as a delivery partner. Enter the invite code your company sent you.
              </Body>
            </View>
          </View>
        )}

        {/* Role cards selection */}
        <View style={styles.rolesContainer}>
          <View style={styles.rolesTitleRow}>
            <View style={styles.rolesTitleLine} />
            <Label style={styles.rolesTitle}>I WANT TO</Label>
            <View style={styles.rolesTitleLine} />
          </View>
          <View style={styles.rolesGrid}>
            {rolesList.map((item) => {
              const active = role === item.key;
              return (
                <TouchableOpacity
                  key={item.key}
                  activeOpacity={0.8}
                  onPress={() => setRole(item.key)}
                  style={[styles.roleCard, active && styles.roleCardActive]}
                >
                  <View style={[styles.roleIconContainer, active && styles.roleIconActive]}>
                    <Ionicons
                      name={item.icon}
                      size={18}
                      color={active ? "#E8CF8F" : colors.olive[800]}
                    />
                  </View>
                  <Text style={[styles.roleLabel, active && styles.roleLabelActive]}>{item.label}</Text>
                  <Text style={[styles.roleSub, active && styles.roleSubActive]}>{item.sub}</Text>
                  {active && (
                    <View style={styles.checkBadge}>
                      <Ionicons name="checkmark" size={10} color="#FAF8F5" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Dynamic Role Benefit Banner */}
          <View style={styles.roleBenefitBanner}>
            <View style={styles.roleBenefitIconBadge}>
              <Ionicons name={ROLE_DETAILS[role].icon} size={13} color={colors.olive[800]} />
            </View>
            <Text style={styles.roleBenefitText}>
              <Text style={styles.roleBenefitKicker}>{ROLE_DETAILS[role].kicker}: </Text>
              {ROLE_DETAILS[role].description}
            </Text>
          </View>
        </View>

        {/* Form area — elevated card for premium credentials */}
        <View style={styles.formCard}>
          <View style={styles.formCardHeader}>
            <Ionicons name="shield-checkmark-outline" size={13} color={colors.olive[700]} />
            <Text style={styles.formCardTitle}>MEMBER CREDENTIALS</Text>
          </View>

          <View style={styles.form}>
            <Input
              label="Full name"
              placeholder="Your full name"
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
              autoComplete="name"
              leftIcon={<Ionicons name="person-outline" size={18} color={colors.light.mutedForeground} />}
            />

            <Input
              label="Email address"
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              leftIcon={<Ionicons name="mail-outline" size={18} color={colors.light.mutedForeground} />}
            />

            <Input
              label="Password"
              placeholder={`Min. ${PASSWORD_MIN_LENGTH} characters`}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPwd}
              autoComplete="new-password"
              leftIcon={<Ionicons name="lock-closed-outline" size={18} color={colors.light.mutedForeground} />}
              rightIcon={
                <TouchableOpacity onPress={() => setShowPwd(!showPwd)} activeOpacity={0.7} hitSlop={8}>
                  <Ionicons
                    name={showPwd ? "eye-off-outline" : "eye-outline"}
                    size={18}
                    color={colors.light.mutedForeground}
                  />
                </TouchableOpacity>
              }
            />

            <Input
              label="Confirm password"
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showPwd}
              autoComplete="new-password"
              leftIcon={<Ionicons name="shield-checkmark-outline" size={18} color={colors.light.mutedForeground} />}
              rightIcon={
                confirmPassword.length > 0 ? (
                  confirmPassword === password ? (
                    <Ionicons name="checkmark-circle" size={18} color={colors.olive[600]} />
                  ) : (
                    <Ionicons name="close-circle" size={18} color={colors.light.destructive} />
                  )
                ) : null
              }
            />
          </View>
        </View>

        {/* Optional Perks & Privileges Card */}
        {role !== "delivery" ? (
          <View style={styles.perksCard}>
            <TouchableOpacity
              style={styles.perksHeader}
              onPress={() => setShowOptional(!showOptional)}
              activeOpacity={0.7}
            >
              <View style={styles.perksIconWrap}>
                <Ionicons name="gift-outline" size={15} color={colors.olive[800]} />
              </View>
              <View style={styles.perksTitles}>
                <Text style={styles.perksHeading}>
                  {referralCode || phone ? "Invitations & Mobile Alerts" : "Have an invite code or phone?"}
                </Text>
                <Text style={styles.perksSub}>
                  {referralCode || phone
                    ? "Optional code and mobile contact configured"
                    : "Add invite code for bonus credits & SMS delivery updates"}
                </Text>
              </View>
              <Ionicons
                name={showOptional ? "chevron-up" : "chevron-down"}
                size={16}
                color={colors.olive[700]}
              />
            </TouchableOpacity>

            {showOptional && (
              <View style={styles.perksBody}>
                <Input
                  label="Referral code (optional)"
                  placeholder="Friend's invite code"
                  value={referralCode}
                  onChangeText={(v) => setReferralCode(v.toUpperCase())}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  leftIcon={<Ionicons name="gift-outline" size={18} color={colors.light.mutedForeground} />}
                />
                <Input
                  label="Phone number (optional)"
                  placeholder="077 123 4567"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  leftIcon={<Ionicons name="call-outline" size={18} color={colors.light.mutedForeground} />}
                />
              </View>
            )}
          </View>
        ) : (
          <View style={styles.deliveryCard}>
            <Input
              label="Invite code"
              placeholder="Code from your company"
              value={inviteCode}
              onChangeText={setInviteCode}
              autoCapitalize="characters"
              autoCorrect={false}
              leftIcon={<Ionicons name="key-outline" size={18} color={colors.light.mutedForeground} />}
            />
          </View>
        )}

        {/* Terms checkbox */}
        <TouchableOpacity
          style={styles.termsRow}
          activeOpacity={0.8}
          onPress={() => setTerms(!terms)}
        >
          <View style={[styles.checkbox, terms && styles.checkboxChecked]}>
            {terms && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}
          </View>
          <Text style={styles.termsText}>
            I agree to the <Text style={styles.termsLink}>Terms of Service</Text> and{" "}
            <Text style={styles.termsLink}>Privacy Policy</Text>.
          </Text>
        </TouchableOpacity>

        {/* Primary Luxury CTA Button */}
        <TouchableOpacity
          style={styles.submitBtn}
          onPress={handleRegister}
          disabled={loading}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={["#242621", "#151613"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.submitGradient}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FAF8F5" />
            ) : (
              <>
                <Ionicons name={ROLE_DETAILS[role].icon} size={17} color="#E8CF8F" />
                <Text style={styles.submitBtnText}>
                  {ROLE_DETAILS[role].cta}
                </Text>
                <Ionicons name="arrow-forward" size={15} color="#E8CF8F" />
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Footer */}
        <View style={styles.footer}>
          <Body size="sm" muted>Already have an account? </Body>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Body size="sm" style={styles.footerLink}>Sign In</Body>
          </TouchableOpacity>
        </View>

        <View style={styles.encryptionRow}>
          <Ionicons name="lock-closed" size={11} color={colors.olive[600]} />
          <Text style={styles.finePrint}>
            256-bit atelier encryption • Verified credentials
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper.cream,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing[4],
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(27, 28, 28, 0.08)",
    backgroundColor: colors.light.card,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.soft,
  },
  stepPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: "rgba(27, 28, 28, 0.08)",
    ...shadows.soft,
  },
  stepDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.olive[600],
  },
  stepText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    color: colors.olive[800],
    letterSpacing: 1.2,
  },
  header: {
    marginBottom: 20,
  },
  kickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  kickerLine: {
    width: 14,
    height: 1,
    backgroundColor: colors.olive[600],
  },
  kicker: {
    fontSize: 10,
    fontFamily: fontFamilies.mono.medium,
    color: colors.olive[700],
    letterSpacing: 1.5,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 6,
  },
  titleText: {
    color: colors.light.foreground,
    lineHeight: 46,
  },
  titleTextItalic: {
    color: colors.olive[700],
    lineHeight: 46,
  },
  subtitle: {
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
    lineHeight: 20,
  },
  rolesContainer: {
    marginBottom: 20,
  },
  rolesTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  rolesTitleLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(27, 28, 28, 0.08)",
  },
  rolesTitle: {
    color: colors.light.mutedForeground,
    fontSize: 10,
    letterSpacing: 1.6,
    fontFamily: fontFamilies.mono.medium,
  },
  rolesGrid: {
    flexDirection: "row",
    gap: 10,
  },
  roleCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: "rgba(27, 28, 28, 0.08)",
    borderRadius: radii["2xl"],
    backgroundColor: colors.light.card,
    paddingVertical: 16,
    paddingHorizontal: 6,
    alignItems: "center",
    position: "relative",
    ...shadows.soft,
  },
  roleCardActive: {
    borderColor: colors.olive[800],
    borderWidth: 1.5,
    backgroundColor: `${colors.olive[500]}0d`,
  },
  roleIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: `${colors.olive[500]}12`,
    borderWidth: 1,
    borderColor: `${colors.olive[500]}20`,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  roleIconActive: {
    backgroundColor: "#181714",
    borderColor: `${colors.olive[400]}50`,
  },
  roleLabel: {
    fontSize: 12,
    fontFamily: fontFamilies.sans.semibold,
    color: colors.light.foreground,
    marginBottom: 2,
  },
  roleLabelActive: {
    color: colors.olive[900],
  },
  roleSub: {
    fontSize: 9.5,
    fontFamily: fontFamilies.sans.regular,
    color: colors.light.mutedForeground,
    textAlign: "center",
    lineHeight: 13,
  },
  roleSubActive: {
    color: colors.olive[700],
  },
  checkBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#181714",
    borderWidth: 1,
    borderColor: `${colors.olive[400]}50`,
    alignItems: "center",
    justifyContent: "center",
  },
  roleBenefitBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    backgroundColor: `${colors.olive[500]}0c`,
    borderWidth: 1,
    borderColor: `${colors.olive[500]}20`,
    borderRadius: radii.xl,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    marginTop: 12,
  },
  roleBenefitIconBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: `${colors.olive[500]}15`,
    alignItems: "center",
    justifyContent: "center",
  },
  roleBenefitText: {
    flex: 1,
    fontSize: 11.5,
    fontFamily: fontFamilies.sans.regular,
    color: colors.olive[800],
    lineHeight: 16,
  },
  roleBenefitKicker: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    color: colors.olive[900],
    letterSpacing: 0.5,
  },
  inviteBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    borderRadius: radii.xl,
    backgroundColor: colors.olive[800],
    padding: spacing[4],
    marginBottom: spacing[5],
  },
  inviteIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(250,248,241,0.12)",
  },
  inviteKicker: {
    fontSize: 9,
    letterSpacing: 1.6,
    color: colors.accent2.ochre,
    fontFamily: fontFamilies.sans.bold,
    marginBottom: 3,
  },
  inviteText: {
    color: colors.paper.warm,
    lineHeight: 17,
  },
  formCard: {
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: "rgba(27, 28, 28, 0.08)",
    backgroundColor: colors.light.card,
    padding: spacing[5],
    marginBottom: spacing[4],
    ...shadows.soft,
  },
  formCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: spacing[4],
    paddingBottom: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: "rgba(27, 28, 28, 0.06)",
  },
  formCardTitle: {
    fontSize: 10.5,
    fontFamily: fontFamilies.mono.medium,
    color: colors.olive[800],
    letterSpacing: 1.5,
  },
  form: {
    gap: 14,
  },
  perksCard: {
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: "rgba(27, 28, 28, 0.08)",
    backgroundColor: colors.light.card,
    padding: spacing[4],
    marginBottom: spacing[4],
    ...shadows.soft,
  },
  perksHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
  },
  perksIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: `${colors.olive[500]}14`,
    alignItems: "center",
    justifyContent: "center",
  },
  perksTitles: {
    flex: 1,
    gap: 2,
  },
  perksHeading: {
    fontSize: 13,
    fontFamily: fontFamilies.sans.semibold,
    color: colors.light.foreground,
  },
  perksSub: {
    fontSize: 10.5,
    fontFamily: fontFamilies.sans.regular,
    color: colors.light.mutedForeground,
    lineHeight: 14,
  },
  perksBody: {
    marginTop: spacing[4],
    paddingTop: spacing[4],
    borderTopWidth: 1,
    borderTopColor: "rgba(27, 28, 28, 0.06)",
    gap: 14,
  },
  deliveryCard: {
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: "rgba(27, 28, 28, 0.08)",
    backgroundColor: colors.light.card,
    padding: spacing[4],
    marginBottom: spacing[4],
    ...shadows.soft,
  },
  termsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
    marginBottom: spacing[5],
    paddingHorizontal: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: 6,
    backgroundColor: colors.light.background,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: "#181714",
    borderColor: colors.olive[800],
  },
  termsText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.light.mutedForeground,
    flex: 1,
    lineHeight: 18,
  },
  termsLink: {
    fontFamily: fontFamilies.sans.medium,
    color: colors.olive[800],
    textDecorationLine: "underline",
  },
  submitBtn: {
    width: "100%",
    borderRadius: radii.full,
    overflow: "hidden",
    ...shadows.soft,
  },
  submitGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[2],
    paddingVertical: 16,
    paddingHorizontal: spacing[4],
  },
  submitBtnText: {
    color: "#FAF8F5",
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14,
    letterSpacing: 0.5,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 24,
  },
  footerLink: {
    color: colors.olive[800],
    fontFamily: fontFamilies.sans.semibold,
    textDecorationLine: "underline",
  },
  encryptionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 18,
    marginBottom: 12,
  },
  finePrint: {
    color: colors.light.mutedForeground,
    fontFamily: fontFamilies.mono.regular,
    fontSize: 10,
    letterSpacing: 0.5,
  },
});
