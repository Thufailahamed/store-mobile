import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Ionicons } from "@/components/ui/Icon";
import { supabase } from "@/lib/supabase/client";
import { useToast } from "@/components/ui";
import { fontFamilies } from "@/lib/theme/fonts";
import { colors } from "@/lib/theme/tokens";
import { C } from "@/components/orders/parcel-track";
import {
  AuthBackButton,
  AuthField,
  PasswordEye,
  PrimaryButton,
  authStyles,
} from "@/components/auth/auth-ui";

/**
 * Set a new password after the user clicks the email recovery link.
 * The PASSWORD_RECOVERY event in lib/supabase/auth.ts routes the user
 * here from the deep-link handler. We then call updateUser({ password })
 * which is allowed because Supabase has issued a recovery session.
 */
export default function ResetPasswordScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const insets = useSafeAreaInsets();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!password || password.length < 8) {
      toast("Password must be at least 8 characters", "error");
      return;
    }
    if (password !== confirm) {
      toast("Passwords do not match", "error");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        toast(error.message, "error");
        return;
      }
      toast("Password updated. Please sign in.", "success");
      // Sign out the recovery session and force the user to sign in with
      // their new credentials.
      await supabase.auth.signOut();
      router.replace("/(auth)/login");
    } catch (e: any) {
      toast(e?.message ?? "Could not reset password", "error");
    } finally {
      setLoading(false);
    }
  };

  const longEnough = password.length >= 8;
  const matches = confirm.length > 0 && password === confirm;
  const rules = [
    { ok: longEnough, label: "At least 8 characters" },
    { ok: matches, label: "Both passwords match" },
  ];

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
        <AuthBackButton onPress={() => router.replace("/(auth)/login")} />

        <Animated.View entering={FadeInDown.duration(450)}>
          <Text style={authStyles.title} accessibilityRole="header">
            Create new password
          </Text>
          <Text style={authStyles.subtitle}>
            Your new password must be different from the one you used before. You’ll sign in again afterwards.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(450).delay(80)} style={authStyles.form}>
          <AuthField
            placeholder="New password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPwd}
            autoCapitalize="none"
            autoComplete="password-new"
            textContentType="newPassword"
            accessibilityLabel="New password"
            trailing={<PasswordEye shown={showPwd} onToggle={() => setShowPwd((v) => !v)} />}
          />
          <AuthField
            placeholder="Confirm password"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry={!showPwd}
            autoCapitalize="none"
            autoComplete="password-new"
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={handleSubmit}
            accessibilityLabel="Confirm new password"
            invalid={confirm.length > 0 && !matches}
            trailing={<PasswordEye shown={showPwd} onToggle={() => setShowPwd((v) => !v)} />}
          />

          <View style={styles.rules}>
            {rules.map((r) => (
              <View key={r.label} style={styles.rule}>
                <Ionicons
                  name={r.ok ? "checkmark-circle" : "ellipse-outline"}
                  size={16}
                  color={r.ok ? colors.olive[600] : C.faint}
                />
                <Text style={[styles.ruleText, r.ok && styles.ruleTextOk]}>{r.label}</Text>
              </View>
            ))}
          </View>

          <PrimaryButton
            label="Reset Password"
            onPress={handleSubmit}
            disabled={!longEnough || !matches}
            loading={loading}
            style={{ marginTop: 6 }}
          />
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  rules: { gap: 8, paddingHorizontal: 4 },
  rule: { flexDirection: "row", alignItems: "center", gap: 8 },
  ruleText: { fontFamily: fontFamilies.sans.medium, fontSize: 13, color: C.muted },
  ruleTextOk: { color: C.text },
});
