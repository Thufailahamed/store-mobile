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
import { Ionicons } from "@/components/ui/Icon";
import { Button, Input, useToast } from "@/components/ui";
import { useAuth } from "@/lib/supabase/auth";
import { colors, spacing } from "@/lib/theme/tokens";
import { Display, Label, Body } from "@/components/ui/Typography";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const { resetPassword } = useAuth();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

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
          <Label style={styles.kicker}>— Reset</Label>
          <View style={styles.titleRow}>
            <Display size="4xl" style={styles.titleText}>Reset </Display>
            <Display italic size="4xl" style={styles.titleTextItalic}>password</Display>
            <Display size="4xl" style={styles.titleText}>.</Display>
          </View>
        </View>

        {sent ? (
          <View style={styles.form}>
            <Body size="sm" style={styles.infoText}>
              We've sent a password reset link to <Body style={{ fontWeight: "600" }}>{email}</Body>. Please check your email to continue.
            </Body>
            <Button
              onPress={() => router.replace("/(auth)/login")}
              variant="brand"
              style={styles.submitButton}
            >
              Back to Sign In
            </Button>
          </View>
        ) : (
          <View style={styles.form}>
            <Body size="sm" muted style={styles.infoText}>
              Enter your email address and we'll send you a link to reset your password.
            </Body>

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

            <Button
              onPress={handleReset}
              loading={loading}
              variant="brand"
              style={styles.submitButton}
            >
              Send Reset Link
            </Button>
          </View>
        )}

        {/* Back Link */}
        <TouchableOpacity
          style={styles.backLink}
          onPress={() => router.back()}
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
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  header: {
    marginBottom: 24,
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
  form: {
    gap: 16,
  },
  infoText: {
    lineHeight: 20,
    marginBottom: 8,
  },
  submitButton: {
    marginTop: 8,
  },
  backLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 40,
    paddingVertical: 8,
  },
  backText: {
    color: colors.light.mutedForeground,
    fontSize: 10,
  },
});
