import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { supabase } from "@/lib/supabase/client";
import { Button, Input, useToast } from "@/components/ui";
import { colors, typography, spacing, radii } from "@/lib/theme/tokens";
import { Display, Label, Body } from "@/components/ui/Typography";
import { fontFamilies } from "@/lib/theme/fonts";
import { acceptDriverInvite, hasStoreApi } from "@/lib/api/delivery-company-api";

type UserRole = "customer" | "store_owner" | "brand_owner" | "delivery";

export default function RegisterScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ role?: string; code?: string }>();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [role, setRole] = useState<UserRole>(
    params.role === "delivery" ? "delivery" : "customer",
  );
  const [inviteCode, setInviteCode] = useState(params.code ?? "");
  const [terms, setTerms] = useState(false);
  const [loading, setLoading] = useState(false);

  const rolesList: { key: UserRole; label: string; sub: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: "customer", label: "Shop", sub: "Discover & buy", icon: "bag-handle-outline" },
    { key: "store_owner", label: "Sell", sub: "Run your store", icon: "storefront-outline" },
    { key: "brand_owner", label: "Brand", sub: "Scale your label", icon: "pricetag-outline" },
    { key: "delivery", label: "Deliver", sub: "Join as rider", icon: "bicycle-outline" },
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

    if (password.length < 6) {
      toast("Password must be at least 6 characters", "error");
      return;
    }

    if (role === "delivery" && !inviteCode.trim()) {
      toast("Enter the invite code your company sent you", "error");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          role: role,
          phone: phone.trim() || undefined,
        },
      },
    });

    if (error) {
      setLoading(false);
      toast(error.message, "error");
      return;
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
        {/* Header section with luxury editorial brand details */}
        <View style={styles.header}>
          <Label style={styles.kicker}>— 02 / Create account</Label>
          <View style={styles.titleRow}>
            <Display size="4xl" style={styles.titleText}>Join the </Display>
            <Display italic size="4xl" style={styles.titleTextItalic}>maison</Display>
            <Display size="4xl" style={styles.titleText}>.</Display>
          </View>
          <Body muted style={styles.subtitle}>
            Choose your path — shopper, seller, or label — and we'll tailor the experience.
          </Body>
        </View>

        {/* Role cards selection */}
        <View style={styles.rolesContainer}>
          <Label style={styles.rolesTitle}>I want to</Label>
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
                      color={active ? colors.light.primaryForeground : colors.light.primary}
                    />
                  </View>
                  <Label style={styles.roleLabel}>{item.label}</Label>
                  <Body size="xs" muted style={styles.roleSub}>{item.sub}</Body>
                  {active && (
                    <View style={styles.checkBadge}>
                      <Ionicons name="checkmark" size={10} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Form area */}
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

          {role === "delivery" && (
            <Input
              label="Invite code"
              placeholder="Code from your company"
              value={inviteCode}
              onChangeText={setInviteCode}
              autoCapitalize="characters"
              autoCorrect={false}
              leftIcon={<Ionicons name="key-outline" size={18} color={colors.light.mutedForeground} />}
            />
          )}

          <Input
            label="Phone (optional)"
            placeholder="077 123 4567"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoComplete="tel"
            leftIcon={<Ionicons name="call-outline" size={18} color={colors.light.mutedForeground} />}
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
            placeholder="Min. 6 characters"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPwd}
            autoComplete="new-password"
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

          {/* Terms checkbox */}
          <TouchableOpacity
            style={styles.termsRow}
            activeOpacity={0.8}
            onPress={() => setTerms(!terms)}
          >
            <View style={[styles.checkbox, terms && styles.checkboxChecked]}>
              {terms && <Ionicons name="checkmark" size={10} color="#fff" />}
            </View>
            <Body size="xs" style={styles.termsText}>
              I agree to the Terms and Privacy Policy.
            </Body>
          </TouchableOpacity>

          <Button
            onPress={handleRegister}
            loading={loading}
            variant="brand"
            style={styles.submitButton}
          >
            Create Account
          </Button>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Body size="sm" muted>Already have an account? </Body>
          <TouchableOpacity onPress={() => router.back()}>
            <Body size="sm" style={styles.footerLink}>Sign In</Body>
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
  subtitle: {
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
    lineHeight: 20,
    marginTop: 4,
  },
  rolesContainer: {
    marginBottom: 24,
  },
  rolesTitle: {
    color: colors.light.mutedForeground,
    fontSize: 10,
    textAlign: "center",
    marginBottom: 12,
  },
  rolesGrid: {
    flexDirection: "row",
    gap: 8,
  },
  roleCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.xl,
    backgroundColor: colors.light.card,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: "center",
    position: "relative",
    shadowColor: colors.light.foreground,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  roleCardActive: {
    borderColor: colors.olive[700],
    backgroundColor: colors.olive[50],
  },
  roleIconContainer: {
    width: 32,
    height: 32,
    borderRadius: radii.lg,
    backgroundColor: colors.light.background,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  roleIconActive: {
    backgroundColor: colors.olive[700],
  },
  roleLabel: {
    fontSize: 12,
    color: colors.light.foreground,
    fontWeight: typography.fontWeights.semibold,
    marginBottom: 2,
  },
  roleSub: {
    fontSize: 9,
    textAlign: "center",
    lineHeight: 12,
  },
  checkBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.olive[700],
    alignItems: "center",
    justifyContent: "center",
  },
  form: {
    gap: 16,
  },
  termsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
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
  termsText: {
    color: colors.light.mutedForeground,
    flex: 1,
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
