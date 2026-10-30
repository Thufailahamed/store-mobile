import React, { useState, useRef, useEffect } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { supabase } from "@/lib/supabase/client";
import { FIXED_LOGIN_CODE, FIXED_LOGIN_CODE_ENABLED } from "@/lib/supabase/fixed-login-code";
import { mergeAnonSessionOnLogin } from "@/lib/recommender";
import { applyReferralCodeBackend, verifyPhoneOtpBackend } from "@/lib/api/backend";
import { acceptDriverInvite, hasStoreApi } from "@/lib/api/delivery-company-api";
import { useToast } from "@/components/ui";
import { fontFamilies } from "@/lib/theme/fonts";
import { colors } from "@/lib/theme/tokens";
import { C } from "@/components/orders/parcel-track";
import { AuthBackButton, PrimaryButton, authStyles } from "@/components/auth/auth-ui";

export default function VerifyOtpScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ email?: string; phone?: string; referral?: string; invite?: string }>();
  const email = params.email || "";
  const phone = params.phone || "";

  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [timer, setTimer] = useState(30);
  const [loading, setLoading] = useState(false);
  const refs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (timer > 0) {
      const t = setTimeout(() => setTimer(timer - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [timer]);

  // Focus the first input on mount
  useEffect(() => {
    setTimeout(() => {
      refs.current[0]?.focus();
    }, 100);
  }, []);

  const handleChange = (text: string, index: number) => {
    // A pasted / autofilled code arrives as several digits in one cell.
    const digits = text.replace(/\D/g, "");
    if (digits.length > 1) {
      const nextCode = [...code];
      for (let i = 0; i < digits.length && index + i < 6; i++) nextCode[index + i] = digits[i];
      setCode(nextCode);
      refs.current[Math.min(index + digits.length, 5)]?.focus();
      return;
    }
    // Only accept numeric input
    if (text && !/^\d$/.test(text)) return;

    const nextCode = [...code];
    nextCode[index] = text;
    setCode(nextCode);

    // Auto focus next cell
    if (text && index < 5) {
      refs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === "Backspace" && !code[index] && index > 0) {
      const nextCode = [...code];
      nextCode[index - 1] = "";
      setCode(nextCode);
      refs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const token = code.join("");
    if (token.length < 6) {
      toast("Please enter all 6 digits", "error");
      return;
    }

    setLoading(true);
    let error;

    if (phone) {
      // Fixed login code (backend flag): exchange a magic-link token instead.
      const fixed = await verifyPhoneOtpBackend(phone, token);
      const { error: err } = fixed.ok
        ? await supabase.auth.verifyOtp({ token_hash: fixed.data.token_hash, type: "magiclink" })
        : await supabase.auth.verifyOtp({ phone, token, type: "sms" });
      error = err;
    } else {
      const { error: err } = await supabase.auth.verifyOtp({
        email,
        token,
        type: "email",
      });
      error = err;
    }

    setLoading(false);

    if (error) {
      toast(error.message, "error");
    } else {
      try {
        await mergeAnonSessionOnLogin();
      } catch {
        // ignore
      }
      // Post-signup extras captured on the register screen (best-effort).
      try {
        if (params.referral && (await hasStoreApi())) await applyReferralCodeBackend(params.referral);
        if (params.invite && (await hasStoreApi())) {
          const accept = await acceptDriverInvite(params.invite);
          if (accept.ok) await supabase.auth.refreshSession();
          else toast(`Invite could not be redeemed: ${accept.error}`, "error");
        }
      } catch {
        // non-blocking
      }
      toast("Welcome back!", "success");
      // Auth state listener in _layout.tsx will handle redirection to main flow
    }
  };

  const handleResend = async () => {
    if (FIXED_LOGIN_CODE_ENABLED && phone) {
      setTimer(30);
      setCode(["", "", "", "", "", ""]);
      refs.current[0]?.focus();
      toast(`Use the test code ${FIXED_LOGIN_CODE}`, "info");
      return;
    }

    setLoading(true);
    let error;

    if (phone) {
      const { error: err } = await supabase.auth.signInWithOtp({
        phone,
      });
      error = err;
    } else {
      const { error: err } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: "luxe://auth/callback",
        },
      });
      error = err;
    }

    setLoading(false);

    if (error) {
      toast(error.message, "error");
    } else {
      setTimer(30);
      setCode(["", "", "", "", "", ""]);
      refs.current[0]?.focus();
      toast("Verification code resent!", "success");
    }
  };

  const targetIdentifier = email || phone || "your contact details";

  const [focused, setFocused] = useState(0);
  const filled = code.every((d) => d !== "");
  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/(auth)/login"));

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
            OTP Verification
          </Text>
          <Text style={authStyles.subtitle}>
            Enter the 6-digit code we just sent to{" "}
            <Text style={styles.strong}>{targetIdentifier}</Text>
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(450).delay(80)} style={styles.codeRow}>
          {code.map((val, idx) => (
            <TextInput
              key={idx}
              ref={(el) => {
                refs.current[idx] = el;
              }}
              style={[
                styles.cell,
                val !== "" && styles.cellFilled,
                focused === idx && styles.cellFocused,
              ]}
              keyboardType="number-pad"
              textContentType={idx === 0 ? "oneTimeCode" : "none"}
              autoComplete={idx === 0 ? "sms-otp" : "off"}
              maxLength={idx === 0 ? 6 : 1}
              value={val}
              onChangeText={(text) => handleChange(text, idx)}
              onKeyPress={(e) => handleKeyPress(e, idx)}
              onFocus={() => setFocused(idx)}
              selectionColor={colors.olive[600]}
              selectTextOnFocus
              accessibilityLabel={`Digit ${idx + 1}`}
            />
          ))}
        </Animated.View>

        <PrimaryButton
          label="Verify"
          onPress={handleVerify}
          disabled={!filled}
          loading={loading}
          style={{ marginTop: 28 }}
        />

        <View style={{ flex: 1, minHeight: 24 }} />
        <View style={styles.resend}>
          <Text style={styles.resendPrompt}>Didn’t receive the code? </Text>
          {timer > 0 ? (
            <Text style={styles.resendTimer}>Resend in 0:{String(timer).padStart(2, "0")}</Text>
          ) : (
            <Pressable onPress={handleResend} disabled={loading} hitSlop={8} accessibilityRole="button">
              <Text style={styles.resendAction}>Resend</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  strong: { fontFamily: fontFamilies.sans.bold, color: C.text },
  codeRow: { flexDirection: "row", justifyContent: "space-between", gap: 8, marginTop: 32 },
  cell: {
    flex: 1,
    maxWidth: 56,
    height: 62,
    borderRadius: 16,
    backgroundColor: "#efede4",
    borderWidth: 1.5,
    borderColor: "transparent",
    textAlign: "center",
    fontFamily: fontFamilies.sans.bold,
    fontSize: 22,
    color: C.text,
  },
  cellFilled: { backgroundColor: "#FFFFFF", borderColor: "rgba(22,23,15,0.14)" },
  cellFocused: { backgroundColor: "#FFFFFF", borderColor: colors.olive[600] },
  resend: { flexDirection: "row", justifyContent: "center", alignItems: "center", paddingVertical: 8 },
  resendPrompt: { fontFamily: fontFamilies.sans.regular, fontSize: 14.5, color: C.text },
  resendTimer: { fontFamily: fontFamilies.sans.semibold, fontSize: 14.5, color: C.muted },
  resendAction: { fontFamily: fontFamilies.sans.bold, fontSize: 14.5, color: colors.olive[600] },
});
