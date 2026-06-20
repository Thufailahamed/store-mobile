import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { supabase } from "@/lib/supabase/client";
import { Button, Input, useToast } from "@/components/ui";
import { colors, spacing } from "@/lib/theme/tokens";
import { Display, Label, Body } from "@/components/ui/Typography";

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
        <View style={styles.header}>
          <Label style={styles.kicker}>— Recovery</Label>
          <View style={styles.titleRow}>
            <Display size="4xl" style={styles.titleText}>Set a new </Display>
            <Display italic size="4xl" style={styles.titleTextItalic}>password</Display>
            <Display size="4xl" style={styles.titleText}>.</Display>
          </View>
        </View>

        <View style={styles.form}>
          <Body size="sm" muted style={styles.infoText}>
            Enter a new password for your LUXE account. You will be signed out
            and asked to sign in again.
          </Body>

          <Input
            label="New password"
            placeholder="At least 8 characters"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPwd}
            autoCapitalize="none"
            autoComplete="password-new"
            leftIcon={<Ionicons name="lock-closed-outline" size={18} color={colors.light.mutedForeground} />}
            rightIcon={
              <TouchableOpacity onPress={() => setShowPwd((v) => !v)}>
                <Ionicons
                  name={showPwd ? "eye-off-outline" : "eye-outline"}
                  size={18}
                  color={colors.light.mutedForeground}
                />
              </TouchableOpacity>
            }
          />

          <Input
            label="Confirm new password"
            placeholder="Re-enter the password"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry={!showPwd}
            autoCapitalize="none"
            autoComplete="password-new"
            leftIcon={<Ionicons name="lock-closed-outline" size={18} color={colors.light.mutedForeground} />}
          />

          <Button
            onPress={handleSubmit}
            loading={loading}
            variant="brand"
            style={styles.submitButton}
          >
            Update Password
          </Button>
        </View>

        <TouchableOpacity
          style={styles.backLink}
          onPress={() => router.replace("/(auth)/login")}
        >
          <Ionicons name="arrow-back" size={14} color={colors.light.mutedForeground} style={{ marginRight: 4 }} />
          <Label style={styles.backText}>Back to Sign In</Label>
        </TouchableOpacity>
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
    paddingHorizontal: spacing[6],
  },
  header: {
    marginBottom: spacing[8],
  },
  kicker: {
    color: colors.light.mutedForeground,
    letterSpacing: 1.5,
    marginBottom: spacing[2],
    fontSize: 11,
    textTransform: "uppercase",
  },
  titleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "baseline",
  },
  titleText: {
    color: colors.light.foreground,
  },
  titleTextItalic: {
    color: colors.light.foreground,
    fontStyle: "italic",
  },
  form: {
    gap: spacing[4],
  },
  infoText: {
    marginBottom: spacing[2],
  },
  submitButton: {
    marginTop: spacing[2],
  },
  backLink: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing[6],
    alignSelf: "flex-start",
  },
  backText: {
    color: colors.light.mutedForeground,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
});