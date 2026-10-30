import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { Ionicons } from "@/components/ui/Icon";
import { useToast } from "@/components/ui";
import { useAuth } from "@/lib/supabase/auth";
import { EMAIL_REGEX } from "@/lib/contact-validation";
import { fontFamilies } from "@/lib/theme/fonts";
import { C } from "@/components/orders/parcel-track";
import {
  AuthBackButton,
  AuthField,
  AuthFooterLink,
  OutlineButton,
  PrimaryButton,
  authStyles,
} from "@/components/auth/auth-ui";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const { resetPassword } = useAuth();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const emailOk = EMAIL_REGEX.test(email.trim());

  const handleReset = async () => {
    if (!email.trim()) {
      toast("Please enter your email", "error");
      return;
    }

    setLoading(true);
    const { error } = await resetPassword(email.trim());
    setLoading(false);

    if (error) {
      toast(error, "error");
    } else {
      setSent(true);
      toast("Reset link sent!", "success");
    }
  };

  const toLogin = () => (router.canGoBack() ? router.back() : router.replace("/(auth)/login"));

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
        <AuthBackButton onPress={toLogin} />

        {sent ? (
          <Animated.View key="sent" entering={FadeIn.duration(320)} style={styles.sentWrap}>
            <View style={styles.badge}>
              <Ionicons name="mail-open-outline" size={30} color={C.lime} />
            </View>
            <Text style={[authStyles.title, styles.center]}>Check your email</Text>
            <Text style={[authStyles.subtitle, styles.center]}>
              We sent a password reset link to{"\n"}
              <Text style={styles.strong}>{email.trim()}</Text>
            </Text>
            <View style={styles.sentActions}>
              <PrimaryButton label="Back to Login" onPress={() => router.replace("/(auth)/login")} />
              <OutlineButton label="Use a different email" onPress={() => setSent(false)} />
            </View>
          </Animated.View>
        ) : (
          <Animated.View key="form" entering={FadeInDown.duration(450)}>
            <Text style={authStyles.title} accessibilityRole="header">
              Forgot password?
            </Text>
            <Text style={authStyles.subtitle}>
              Don’t worry! Enter the email linked with your account and we’ll send you a reset link.
            </Text>
            <View style={authStyles.form}>
              <AuthField
                placeholder="Enter your email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="send"
                onSubmitEditing={handleReset}
                accessibilityLabel="Email"
                valid={emailOk}
              />
              <PrimaryButton
                label="Send Reset Link"
                onPress={handleReset}
                disabled={!emailOk}
                loading={loading}
                style={{ marginTop: 6 }}
              />
            </View>
          </Animated.View>
        )}

        <View style={{ flex: 1, minHeight: 24 }} />
        <AuthFooterLink
          prompt={sent ? "Didn’t get it?" : "Remember password?"}
          action={sent ? "Resend" : "Login"}
          onPress={sent ? handleReset : toLogin}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  sentWrap: { alignItems: "center", marginTop: 40 },
  badge: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: C.ink,
    borderWidth: 2,
    borderColor: C.goldSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  center: { textAlign: "center" },
  strong: { fontFamily: fontFamilies.sans.bold, color: C.text },
  sentActions: { alignSelf: "stretch", gap: 12, marginTop: 30 },
});
