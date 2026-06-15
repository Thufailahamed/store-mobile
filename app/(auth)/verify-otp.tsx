import React, { useState, useRef, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  TextInput,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { supabase } from "@/lib/supabase/client";
import { Button, useToast } from "@/components/ui";
import { colors, typography, spacing, radii } from "@/lib/theme/tokens";
import { Display, Label, Body } from "@/components/ui/Typography";
import { fontFamilies } from "@/lib/theme/fonts";

export default function VerifyOtpScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ email?: string; phone?: string }>();
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
      const { error: err } = await supabase.auth.verifyOtp({
        phone,
        token,
        type: "sms",
      });
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
      toast("Welcome back!", "success");
      // Auth state listener in _layout.tsx will handle redirection to main flow
    }
  };

  const handleResend = async () => {
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
          <Label style={styles.kicker}>— Verification</Label>
          <View style={styles.titleRow}>
            <Display size="4xl" style={styles.titleText}>Verify </Display>
            <Display italic size="4xl" style={styles.titleTextItalic}>code</Display>
            <Display size="4xl" style={styles.titleText}>.</Display>
          </View>
          <Body muted style={styles.subtitle}>
            Enter the 6-digit code sent to{" "}
            <Body style={{ fontWeight: "600" }}>{targetIdentifier}</Body>.
          </Body>
        </View>

        {/* Verification code fields */}
        <View style={styles.codeRow}>
          {code.map((val, idx) => (
            <TextInput
              key={idx}
              ref={(el) => {
                refs.current[idx] = el;
              }}
              style={styles.codeCell}
              keyboardType="number-pad"
              maxLength={1}
              value={val}
              onChangeText={(text) => handleChange(text, idx)}
              onKeyPress={(e) => handleKeyPress(e, idx)}
              placeholderTextColor={colors.light.mutedForeground}
              selectTextOnFocus
            />
          ))}
        </View>

        <View style={styles.actions}>
          <Button
            onPress={handleVerify}
            loading={loading}
            variant="brand"
            style={styles.submitButton}
          >
            Verify
          </Button>

          <View style={styles.resendContainer}>
            {timer > 0 ? (
              <Body size="sm" muted>Resend code in {timer}s</Body>
            ) : (
              <TouchableOpacity onPress={handleResend} disabled={loading}>
                <Label style={styles.resendText}>Resend code</Label>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Back Link */}
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
  codeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 32,
  },
  codeCell: {
    width: 44,
    height: 52,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.lg,
    backgroundColor: colors.light.card,
    fontSize: 22,
    fontFamily: fontFamilies.sans.semibold,
    color: colors.light.foreground,
    textAlign: "center",
  },
  actions: {
    gap: 16,
  },
  submitButton: {
    width: "100%",
  },
  resendContainer: {
    alignItems: "center",
    justifyContent: "center",
    height: 24,
  },
  resendText: {
    color: colors.olive[700],
    fontSize: 10,
    textDecorationLine: "underline",
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
