import React, { useState, useRef, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Animated,
  Easing,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useSafeAreaInsets } from "react-native-safe-area-context";

WebBrowser.maybeCompleteAuthSession();
import { Ionicons } from "@/components/ui/Icon";
import Svg, { Path } from "react-native-svg";
import { supabase } from "@/lib/supabase/client";
import { completeAuthCallback } from "@/lib/supabase/oauth";
import { isOperationalStoreStatus } from "@/lib/catalog-visibility";
import { isValidEmail, isValidPhone } from "@/lib/contact-validation";
import { Button, Input, useToast } from "@/components/ui";
import { colors, typography, spacing, radii } from "@/lib/theme/tokens";
import { Display, Label, Body } from "@/components/ui/Typography";
import { fontFamilies } from "@/lib/theme/fonts";

type Method = "password" | "otp" | "phone";

export default function LoginScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [method, setMethod] = useState<Method>("password");

  // Sliding tab animation state
  const [containerWidth, setContainerWidth] = useState(0);
  const indicatorTranslateX = useRef(new Animated.Value(0)).current;

  const methods: { key: Method; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: "password", label: "Password", icon: "key-outline" },
    { key: "otp", label: "Magic link", icon: "sparkles-outline" },
    { key: "phone", label: "Phone OTP", icon: "call-outline" },
  ];

  const activeIndex = methods.findIndex((m) => m.key === method);

  useEffect(() => {
    if (containerWidth > 0) {
      const tabWidth = (containerWidth - 8) / 3;
      Animated.timing(indicatorTranslateX, {
        toValue: activeIndex * tabWidth,
        duration: 280,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    }
  }, [activeIndex, containerWidth]);

  const handleLogin = async () => {
    if (method === "otp") {
      sendMagicLink();
      return;
    }
    if (method === "phone") {
      sendPhoneOtp();
      return;
    }

    if (!email.trim() || !password.trim()) {
      toast("Please fill in all fields", "error");
      return;
    }

    if (!isValidEmail(email)) {
      toast("Enter a valid email address", "error");
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);

    if (error) {
      toast(error.message, "error");
      return;
    }

    toast("Welcome back!", "success");
  };

  const sendMagicLink = async () => {
    if (!email.trim()) {
      toast("Please enter your email", "error");
      return;
    }
    if (!isValidEmail(email)) {
      toast("Enter a valid email address", "error");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: "luxe://auth/callback",
      },
    });
    setLoading(false);

    if (error) {
      toast(error.message, "error");
    } else {
      toast("Magic link sent! Check your inbox.", "success");
      router.push({
        pathname: "/(auth)/verify-otp",
        params: { email: email.trim() },
      });
    }
  };

  const sendPhoneOtp = async () => {
    if (!phone.trim()) {
      toast("Please enter your phone number", "error");
      return;
    }
    if (!isValidPhone(phone)) {
      toast("Phone number looks invalid", "error");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      phone: phone.trim(),
    });
    setLoading(false);

    if (error) {
      toast(error.message, "error");
    } else {
      toast("Verification code sent!", "success");
      router.push({
        pathname: "/(auth)/verify-otp",
        params: { phone: phone.trim() },
      });
    }
  };

  const handleSocialLogin = async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: "luxe://auth/callback",
      },
    });
    setLoading(false);

    if (error) {
      toast(error.message, "error");
      return;
    }

    if (data?.url) {
      const result = await WebBrowser.openAuthSessionAsync(data.url, "luxe://auth/callback");
      if (result.type === "success" && result.url) {
        const { error: cbError } = await completeAuthCallback(result.url);
        if (cbError) {
          toast(cbError, "error");
        } else {
          toast("Welcome back!", "success");
        }
      }
    }
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
        {/* Header section with luxury editorial brand details */}
        <View style={styles.header}>
          <Label style={styles.kicker}>— 01 / Sign in</Label>
          <View style={styles.titleRow}>
            <Display size="4xl" style={styles.titleText}>Welcome </Display>
            <Display italic size="4xl" style={styles.titleTextItalic}>back</Display>
            <Display size="4xl" style={styles.titleText}>.</Display>
          </View>
          <Body muted style={styles.subtitle}>
            Sign in to track orders, save pieces, and pick up where you left off.
          </Body>
        </View>

        {/* Social Google sign-in */}
        <View style={styles.socialSection}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleSocialLogin}
            disabled={loading}
            style={styles.googleBtn}
          >
            <Svg viewBox="0 0 24 24" width={16} height={16}>
              <Path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <Path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/>
              <Path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.72.12-1.42.34-2.1V7.07H2.18A11 11 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.83z"/>
              <Path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z"/>
            </Svg>
            <Label style={styles.googleBtnText}>Sign in with Google</Label>
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Label style={styles.dividerText}>or continue with</Label>
          <View style={styles.dividerLine} />
        </View>

        {/* Method selector tab pill */}
        <View
          style={styles.pillContainer}
          onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
        >
          {containerWidth > 0 && (
            <Animated.View
              style={[
                styles.pillIndicator,
                {
                  width: (containerWidth - 8) / 3,
                  transform: [{ translateX: indicatorTranslateX }],
                },
              ]}
            />
          )}
          {methods.map((m) => {
            const active = method === m.key;
            return (
              <TouchableOpacity
                key={m.key}
                activeOpacity={0.8}
                onPress={() => setMethod(m.key)}
                style={styles.pillTab}
              >
                <Ionicons
                  name={m.icon}
                  size={14}
                  color={active ? colors.light.primaryForeground : colors.light.mutedForeground}
                  style={styles.tabIcon}
                />
                <Label
                  style={[
                    styles.tabLabel,
                    active ? styles.tabLabelActive : styles.tabLabelInactive,
                  ]}
                  numberOfLines={1}
                >
                  {m.label}
                </Label>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Form area */}
        <View style={styles.form}>
          {method !== "phone" ? (
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
          ) : (
            <Input
              label="Phone number"
              placeholder="077 123 4567"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoComplete="tel"
              leftIcon={<Ionicons name="call-outline" size={18} color={colors.light.mutedForeground} />}
            />
          )}

          {method === "password" && (
            <>
              <Input
                label="Password"
                placeholder="Enter your password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPwd}
                autoComplete="password"
                leftIcon={<Ionicons name="lock-closed-outline" size={18} color={colors.light.mutedForeground} />}
                rightIcon={
                  <TouchableOpacity onPress={() => setShowPwd(!showPwd)} activeOpacity={0.7}>
                    <Ionicons
                      name={showPwd ? "eye-off-outline" : "eye-outline"}
                      size={18}
                      color={colors.light.mutedForeground}
                    />
                  </TouchableOpacity>
                }
              />

              <View style={styles.optionsRow}>
                <TouchableOpacity
                  style={styles.rememberRow}
                  activeOpacity={0.8}
                  onPress={() => setRemember(!remember)}
                >
                  <View style={[styles.checkbox, remember && styles.checkboxChecked]}>
                    {remember && <Ionicons name="checkmark" size={10} color="#fff" />}
                  </View>
                  <Body size="sm" style={styles.rememberText}>Remember me</Body>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => router.push("/(auth)/forgot-password")}
                  style={styles.forgotLink}
                >
                  <Body size="sm" style={styles.forgotText}>Forgot password?</Body>
                </TouchableOpacity>
              </View>
            </>
          )}

          {method === "otp" && (
            <Body size="sm" muted style={styles.methodInfo}>
              We'll email you a one-time link/code. No password needed.
            </Body>
          )}

          {method === "phone" && (
            <Body size="sm" muted style={styles.methodInfo}>
              Enter your mobile number. We'll send you a 6-digit code.
            </Body>
          )}

          <Button
            onPress={handleLogin}
            loading={loading}
            variant="brand"
            style={styles.submitButton}
          >
            {method === "password" ? "Sign In" : method === "otp" ? "Send magic link" : "Send SMS OTP"}
          </Button>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Body size="sm" muted>New to LUXE? </Body>
          <TouchableOpacity onPress={() => router.push("/(auth)/register")}>
            <Body size="sm" style={styles.footerLink}>Create an account</Body>
          </TouchableOpacity>
        </View>

        <Label style={styles.finePrint}>
          Protected by industry-standard encryption
        </Label>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.light.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  header: {
    marginBottom: 32,
  },
  kicker: {
    color: colors.olive[600],
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
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
    marginTop: 4,
  },
  socialSection: {
    marginBottom: 24,
  },
  googleBtn: {
    flexDirection: "row",
    height: 48,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.light.card,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowColor: colors.light.foreground,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  googleBtnText: {
    color: colors.light.foreground,
    fontSize: 11,
    textTransform: "none",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.light.border,
  },
  dividerText: {
    color: colors.light.mutedForeground,
    fontSize: 9,
  },
  pillContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(229, 229, 219, 0.5)",
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.full,
    padding: 3,
    marginBottom: 24,
    position: "relative",
    height: 40,
  },
  pillIndicator: {
    position: "absolute",
    top: 3,
    bottom: 3,
    left: 3,
    backgroundColor: colors.light.foreground,
    borderRadius: radii.full,
  },
  pillTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  tabIcon: {
    marginRight: 4,
  },
  tabLabel: {
    fontSize: 10,
  },
  tabLabelActive: {
    color: colors.light.primaryForeground,
  },
  tabLabelInactive: {
    color: colors.light.mutedForeground,
  },
  form: {
    gap: 16,
  },
  optionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.sm,
    backgroundColor: colors.light.card,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: colors.olive[700],
    borderColor: colors.olive[700],
  },
  rememberText: {
    color: colors.light.mutedForeground,
  },
  forgotLink: {
    paddingVertical: 2,
  },
  forgotText: {
    color: colors.light.mutedForeground,
    textDecorationLine: "underline",
  },
  methodInfo: {
    lineHeight: 20,
  },
  submitButton: {
    marginTop: 8,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 32,
  },
  footerLink: {
    color: colors.olive[700],
    fontFamily: fontFamilies.sans.semibold,
  },
  finePrint: {
    textAlign: "center",
    color: colors.light.mutedForeground,
    fontSize: 8,
    marginTop: 40,
  },
});
