import React, { useState, useRef } from "react";
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Pressable,
  Text,
  TextInput,
  ScrollView,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

WebBrowser.maybeCompleteAuthSession();
import { supabase } from "@/lib/supabase/client";
import { completeAuthCallback } from "@/lib/supabase/oauth";
import { FIXED_LOGIN_CODE_ENABLED } from "@/lib/supabase/fixed-login-code";
import { mergeAnonSessionOnLogin } from "@/lib/recommender";
import { EMAIL_REGEX, normalizePhoneE164 } from "@/lib/contact-validation";
import { useToast } from "@/components/ui";
import { VerifyOtpSheet } from "@/components/auth/VerifyOtpSheet";
import { fontFamilies } from "@/lib/theme/fonts";
import { C } from "@/components/orders/parcel-track";
import {
  AltTile,
  AuthBackButton,
  AuthField,
  AuthFooterLink,
  OrDivider,
  PasswordEye,
  PrimaryButton,
  authStyles,
} from "@/components/auth/auth-ui";

// Keep only the 9 local digits of a Sri Lankan mobile number and group them
// as "77 123 4567". Accepts pasted "+94…", "94…" and "0…" forms.
function formatLocalPhone(input: string): string {
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("94") && digits.length > 9) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = digits.slice(1);
  digits = digits.slice(0, 9);
  return [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5)]
    .filter(Boolean)
    .join(" ");
}

export default function LoginScreen() {
  const router = useRouter();
  // Phone the OTP sheet is verifying (null = sheet closed).
  const [otpPhone, setOtpPhone] = useState<string | null>(null);
  const { toast } = useToast();
  const insets = useSafeAreaInsets();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(false);
  const [phoneFocused, setPhoneFocused] = useState(false);
  const phoneRef = useRef<TextInput>(null);
  const phoneOk = /^\+947\d{8}$/.test(normalizePhoneE164(phone));
  const phoneInvalid = phone.trim().length >= 4 && !phoneFocused && !phoneOk;
  // Phone OTP is the default; email + password stays available.
  const [method, setMethod] = useState<"phone" | "email">("phone");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const passwordRef = useRef<TextInput>(null);
  const emailOk = EMAIL_REGEX.test(email.trim());
  const emailInvalid = email.trim().length > 0 && !emailFocused && !emailOk;
  const inputOk = method === "phone" ? phoneOk : emailOk && password.length > 0;

  const signInWithEmail = async () => {
    if (!emailOk) {
      toast("Enter a valid email address", "error");
      return;
    }
    if (!password) {
      toast("Please enter your password", "error");
      return;
    }
    Keyboard.dismiss();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (error) {
      toast(error.message, "error");
      return;
    }
    try {
      await mergeAnonSessionOnLogin();
    } catch {
      // ignore
    }
    toast("Welcome back!", "success");
    // Auth state listener in _layout.tsx handles redirection.
  };


  const sendPhoneOtp = async () => {
    if (!phone.trim()) {
      toast("Please enter your phone number", "error");
      return;
    }
    if (!phoneOk) {
      toast("Enter a valid Sri Lankan mobile number", "error");
      return;
    }

    const e164 = normalizePhoneE164(phone);
    Keyboard.dismiss();
    if (FIXED_LOGIN_CODE_ENABLED) {
      setOtpPhone(e164);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      phone: e164,
    });
    setLoading(false);

    if (error) {
      toast(error.message, "error");
    } else {
      setOtpPhone(e164);
    }
  };

  const submit = method === "phone" ? sendPhoneOtp : signInWithEmail;

  // Not surfaced in the UI right now; kept so Google sign-in can be re-enabled.
  const handleSocialLogin = async () => {
    setSocialLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: "luxe://auth/callback",
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        toast(error.message, "error");
        return;
      }

      if (!data?.url) {
        toast("Couldn't start Google sign-in. Please try again.", "error");
        return;
      }

      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        "luxe://auth/callback",
      );

      if (result.type === "success" && result.url) {
        const { error: cbError } = await completeAuthCallback(result.url);
        if (cbError) {
          toast(cbError, "error");
        } else {
          try {
            await mergeAnonSessionOnLogin();
          } catch {
            // ignore
          }
          toast("Welcome back!", "success");
        }
      } else if (result.type === "cancel" || result.type === "dismiss") {
        toast("Google sign-in was cancelled", "error");
      } else {
        toast("Google sign-in didn't complete. Please try again.", "error");
      }
    } finally {
      setSocialLoading(false);
    }
  };
  void handleSocialLogin;
  void socialLoading;

  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/(auth)/welcome"));
  const switchMethod = () => setMethod((m) => (m === "phone" ? "email" : "phone"));
  const ctaLabel = method === "phone" ? "Send login code" : "Login";

  return (
    <KeyboardAvoidingView style={authStyles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
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
            Welcome back! Glad to see you, again!
          </Text>
          <Text style={authStyles.subtitle}>
            {method === "phone"
              ? "Sign in with your mobile number — we’ll text you a code."
              : "Sign in with your email and password."}
          </Text>
        </Animated.View>

        <Animated.View key={method} entering={FadeIn.duration(260)} style={authStyles.form}>
          {method === "phone" ? (
            <>
              <AuthField
                ref={phoneRef}
                value={phone}
                onChangeText={(t) => setPhone(formatLocalPhone(t))}
                onFocus={() => setPhoneFocused(true)}
                onBlur={() => setPhoneFocused(false)}
                placeholder="77 123 4567"
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
                returnKeyType="send"
                maxLength={11}
                onSubmitEditing={sendPhoneOtp}
                accessibilityLabel="Mobile number"
                accessibilityHint="Nine digit Sri Lankan mobile number"
                invalid={phoneInvalid}
                valid={phoneOk}
                leading={
                  <View style={styles.prefix}>
                    <Text style={styles.flag}>🇱🇰</Text>
                    <Text style={styles.prefixText}>+94</Text>
                  </View>
                }
              />
              <Text style={phoneInvalid ? authStyles.error : authStyles.hint}>
                {phoneInvalid
                  ? "Enter a valid Sri Lankan mobile number."
                  : "We’ll text you a 6-digit code. No password needed."}
              </Text>
            </>
          ) : (
            <>
              <AuthField
                value={email}
                onChangeText={setEmail}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                placeholder="Enter your email"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                accessibilityLabel="Email"
                invalid={emailInvalid}
                valid={emailOk}
              />
              {emailInvalid ? <Text style={authStyles.error}>Enter a valid email address.</Text> : null}
              <AuthField
                ref={passwordRef}
                value={password}
                onChangeText={setPassword}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                placeholder="Enter your password"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="password"
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={signInWithEmail}
                accessibilityLabel="Password"
                trailing={<PasswordEye shown={showPassword} onToggle={() => setShowPassword((v) => !v)} />}
              />
              <Pressable
                onPress={() => router.push("/(auth)/forgot-password")}
                hitSlop={8}
                style={styles.forgot}
                accessibilityRole="link"
              >
                <Text style={authStyles.link}>Forgot Password?</Text>
              </Pressable>
            </>
          )}

          <PrimaryButton
            label={ctaLabel}
            onPress={submit}
            disabled={!inputOk}
            loading={loading}
            style={{ marginTop: 8 }}
          />
        </Animated.View>

        <View style={styles.alt}>
          <OrDivider label="Or continue with" />
          <View style={styles.tiles}>
            <AltTile
              icon={method === "phone" ? "mail-outline" : "phone-portrait-outline"}
              label={method === "phone" ? "Email" : "Phone"}
              onPress={() => {
                // Unmounted inputs never fire onBlur — clear focus state here.
                setPhoneFocused(false);
                setEmailFocused(false);
                setPasswordFocused(false);
                switchMethod();
              }}
            />
            <AltTile icon="bag-handle-outline" label="Guest" onPress={() => router.replace("/(main)")} />
          </View>
        </View>

        <View style={{ flex: 1, minHeight: 24 }} />
        <AuthFooterLink
          prompt="Don’t have an account?"
          action="Register Now"
          onPress={() => router.push("/(auth)/register")}
        />
      </ScrollView>
      <VerifyOtpSheet visible={!!otpPhone} phone={otpPhone ?? ""} onClose={() => setOtpPhone(null)} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  prefix: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingRight: 12,
    marginRight: 2,
    borderRightWidth: 1,
    borderRightColor: "rgba(22,23,15,0.12)",
  },
  flag: { fontSize: 18 },
  prefixText: { fontFamily: fontFamilies.sans.bold, fontSize: 15.5, color: C.text },
  forgot: { alignSelf: "flex-end", marginTop: -2 },
  alt: { marginTop: 30, gap: 16 },
  tiles: { flexDirection: "row", gap: 12 },
});
