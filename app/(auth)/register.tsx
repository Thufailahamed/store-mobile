import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { StatusBar } from "expo-status-bar";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@/components/ui/Icon";
import { supabase } from "@/lib/supabase/client";
import { isValidEmail, isValidPhone, normalizePhoneE164 } from "@/lib/contact-validation";
import { checkUniqueBackend, isValidReferralCode } from "@/lib/api/backend";
import { useToast } from "@/components/ui";
import { fontFamilies } from "@/lib/theme/fonts";
import { hasStoreApi } from "@/lib/api/delivery-company-api";
import { C } from "@/components/orders/parcel-track";
import {
  AltTile,
  AuthBackButton,
  AuthField,
  AuthFooterLink,
  OrDivider,
  PrimaryButton,
  authStyles,
} from "@/components/auth/auth-ui";

type UserRole = "customer" | "store_owner" | "delivery";

// Deep-link role params may use either the canonical UserRole value or a
// friendlier alias (e.g. an invite link written as "seller" or "brand").
const ROLE_PARAM_ALIASES: Record<string, UserRole> = {
  customer: "customer",
  store_owner: "store_owner",
  seller: "store_owner",
  delivery: "delivery",
  rider: "delivery",
};

function resolveRoleParam(value: string | undefined): UserRole {
  if (!value) return "customer";
  return ROLE_PARAM_ALIASES[value.toLowerCase()] ?? "customer";
}

const ROLE_DETAILS: Record<
  UserRole,
  {
    kicker: string;
    title: string;
    description: string;
    icon: keyof typeof Ionicons.glyphMap;
    cta: string;
    perks: string[];
  }
> = {
  customer: {
    kicker: "AS A SHOPPER YOU GET",
    title: "The Collector",
    perks: ["Early access to private drops", "Members-only pricing", "A wardrobe that learns your taste"],
    description: "Curated private drops, members-only pricing & bespoke wardrobe.",
    icon: "bag-handle-outline",
    cta: "Create account",
  },
  store_owner: {
    kicker: "AS A SELLER YOU GET",
    title: "The Boutique",
    perks: ["A storefront you design yourself", "Live inventory across web & app", "Automated weekly settlements"],
    description: "Curated storefront, live inventory sync & automated settlements.",
    icon: "storefront-outline",
    cta: "Open my store",
  },
  delivery: {
    kicker: "COURIER FLEET",
    title: "The Courier",
    perks: ["Assigned routes", "Live tracking", "Fast payouts"],
    description: "Fleet driver portal, assigned route tracking & fast fulfillment.",
    icon: "bicycle-outline",
    cta: "Accept invite",
  },
};

export default function RegisterScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ role?: string; code?: string; ref?: string; referral?: string }>();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<UserRole>(resolveRoleParam(params.role));
  // Sellers also give a contact email; the phone stays the login.
  const [email, setEmail] = useState("");
  const isSeller = role === "store_owner";
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
  ];

  const handleRegister = async () => {
    if (!fullName.trim() || !phone.trim()) {
      toast("Please fill in all fields", "error");
      return;
    }

    if (!terms) {
      toast("Please agree to the terms and privacy policy", "error");
      return;
    }

    if (!isValidPhone(phone)) {
      toast("Phone number looks invalid", "error");
      return;
    }

    const contactEmail = email.trim().toLowerCase();
    if (isSeller && !isValidEmail(contactEmail)) {
      toast("Enter a valid email address for your store", "error");
      return;
    }

    if (role === "delivery" && !inviteCode.trim()) {
      toast("Enter the invite code your company sent you", "error");
      return;
    }

    const trimmedReferral = referralCode.trim().toUpperCase();
    if (role !== "delivery" && trimmedReferral && !isValidReferralCode(trimmedReferral)) {
      toast("Referral code looks invalid (4–12 letters/numbers)", "error");
      return;
    }

    setLoading(true);
    const formattedPhone = normalizePhoneE164(phone.trim());

    if (await hasStoreApi()) {
      const unique = await checkUniqueBackend(
        isSeller ? { phone: formattedPhone, email: contactEmail } : { phone: formattedPhone },
      );
      if (!unique.ok) {
        setLoading(false);
        toast("Unable to verify registration details. Try again.", "error");
        return;
      }
      if (unique.data.phoneExists) {
        setLoading(false);
        toast("This number already has an account. Please sign in.", "error");
        return;
      }
      if (isSeller && unique.data.emailExists) {
        setLoading(false);
        toast("This email belongs to another account. Use a different one.", "error");
        return;
      }
    }

    const { error } = await supabase.auth.signInWithOtp({
      phone: formattedPhone,
      options: {
        data: {
          full_name: fullName.trim(),
          role: role,
          phone: formattedPhone,
          // Contact email only (saved to the profile by handle_new_user) —
          // not an auth identity, so sellers still sign in by phone.
          ...(isSeller ? { email: contactEmail } : {}),
        },
      },
    });
    setLoading(false);

    if (error) {
      toast(error.message, "error");
      return;
    }

    toast("Verification code sent!", "success");
    // Referral / rider invite are applied by verify-otp once a session exists.
    router.push({
      pathname: "/(auth)/verify-otp",
      params: {
        phone: formattedPhone,
        ...(role === "delivery" && inviteCode.trim() ? { invite: inviteCode.trim() } : {}),
        ...(role !== "delivery" && trimmedReferral ? { referral: trimmedReferral } : {}),
      },
    });
  };

  const phoneOk = isValidPhone(phone);
  const emailOk = isValidEmail(email);
  const checklist = isSeller
    ? [fullName.trim().length > 1, phoneOk, emailOk, terms]
    : [fullName.trim().length > 1, phoneOk, terms];
  const completed = checklist.filter(Boolean).length;
  const ready = completed === checklist.length && (role !== "delivery" || inviteCode.trim().length > 0);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/(auth)/welcome"));

  return (
    <KeyboardAvoidingView style={authStyles.root} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={[
          authStyles.scroll,
          { paddingTop: insets.top + 10, paddingBottom: Math.max(insets.bottom, 16) + 8 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <AuthBackButton onPress={goBack} />

        <Animated.View entering={FadeInDown.duration(450)}>
          <Text style={authStyles.title} accessibilityRole="header">
            Hello! Register to get started
          </Text>
          <Text style={authStyles.subtitle}>{ROLE_DETAILS[role].description}</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(450).delay(80)} style={authStyles.form}>
          {role === "delivery" ? (
            <View style={styles.invite}>
              <View style={styles.inviteIcon}>
                <Ionicons name="bicycle-outline" size={18} color={C.lime} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inviteTitle}>Rider invite</Text>
                <Text style={styles.inviteText}>
                  You’re joining as a delivery partner. Enter the invite code your company sent you.
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.segment} accessibilityRole="radiogroup">
              {rolesList.map((item) => {
                const active = role === item.key;
                return (
                  <Pressable
                    key={item.key}
                    onPress={() => setRole(item.key)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`${item.label} — ${item.sub}`}
                    style={[styles.segmentTab, active && styles.segmentTabOn]}
                  >
                    <Ionicons name={item.icon} size={16} color={active ? C.lime : C.muted} />
                    <Text style={[styles.segmentText, active && styles.segmentTextOn]}>
                      {item.key === "customer" ? "I want to shop" : "I want to sell"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          <AuthField
            placeholder="Full name"
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
            accessibilityLabel="Full name"
            valid={fullName.trim().length > 1}
          />
          <AuthField
            placeholder="Mobile number (077 123 4567)"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            accessibilityLabel="Mobile number"
            valid={phoneOk}
          />
          {isSeller ? (
            <>
              <AuthField
                placeholder="Email for store updates"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                accessibilityLabel="Email"
                valid={emailOk}
              />
              <Text style={authStyles.hint}>You’ll sign in with your phone. Email is for store updates only.</Text>
            </>
          ) : (
            <Text style={authStyles.hint}>We’ll text you a code to verify your number.</Text>
          )}

          {role === "delivery" ? (
            <AuthField
              placeholder="Invite code"
              value={inviteCode}
              onChangeText={setInviteCode}
              autoCapitalize="characters"
              autoCorrect={false}
              accessibilityLabel="Invite code"
              valid={inviteCode.trim().length > 0}
              style={styles.mono}
            />
          ) : showOptional ? (
            <Animated.View entering={FadeInDown.duration(240)}>
              <AuthField
                placeholder="Referral code (optional)"
                value={referralCode}
                onChangeText={(v) => setReferralCode(v.toUpperCase())}
                autoCapitalize="characters"
                autoCorrect={false}
                accessibilityLabel="Referral code"
                valid={isValidReferralCode(referralCode)}
                style={styles.mono}
              />
            </Animated.View>
          ) : (
            <Pressable
              onPress={() => setShowOptional(true)}
              style={styles.addCode}
              hitSlop={6}
              accessibilityRole="button"
            >
              <Ionicons name="gift-outline" size={16} color={C.accent} />
              <Text style={styles.addCodeText}>Have a referral code?</Text>
            </Pressable>
          )}

          <Pressable
            style={styles.terms}
            onPress={() => setTerms(!terms)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: terms }}
          >
            <View style={[styles.checkbox, terms && styles.checkboxOn]}>
              {terms ? <Ionicons name="checkmark" size={14} color={C.lime} /> : null}
            </View>
            <Text style={styles.termsText}>
              I agree to LUXE’s <Text style={styles.termsLink}>Terms of Service</Text> and{" "}
              <Text style={styles.termsLink}>Privacy Policy</Text>.
            </Text>
          </Pressable>

          <PrimaryButton
            label={role === "customer" ? "Register" : ROLE_DETAILS[role].cta}
            onPress={handleRegister}
            disabled={!ready}
            loading={loading}
            style={{ marginTop: 4 }}
          />
        </Animated.View>

        <View style={styles.alt}>
          <OrDivider label="Or" />
          <AltTile icon="bag-handle-outline" label="Browse as a guest" onPress={() => router.replace("/(main)")} />
        </View>

        <View style={{ flex: 1, minHeight: 24 }} />
        <AuthFooterLink
          prompt="Already have an account?"
          action="Login Now"
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(auth)/login"))}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  segment: {
    flexDirection: "row",
    padding: 4,
    gap: 4,
    borderRadius: 16,
    backgroundColor: "#efede4",
  },
  segmentTab: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  segmentTabOn: { backgroundColor: C.ink },
  segmentText: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: C.muted },
  segmentTextOn: { color: C.cream },
  invite: {
    flexDirection: "row",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: C.ink,
  },
  inviteIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(200,224,138,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  inviteTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 14.5, color: C.cream },
  inviteText: { fontFamily: fontFamilies.sans.regular, fontSize: 12.5, lineHeight: 17, color: "rgba(250,248,241,0.65)", marginTop: 2 },
  mono: { fontFamily: fontFamilies.mono.medium, letterSpacing: 1.5 },
  addCode: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", paddingVertical: 2 },
  addCodeText: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: C.accent },
  terms: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 2 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: C.faint,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  checkboxOn: { backgroundColor: C.ink, borderColor: C.ink },
  termsText: { flex: 1, fontFamily: fontFamilies.sans.regular, fontSize: 13, lineHeight: 18, color: C.muted },
  termsLink: { fontFamily: fontFamilies.sans.semibold, color: C.text, textDecorationLine: "underline" },
  alt: { marginTop: 28, gap: 16 },
});
