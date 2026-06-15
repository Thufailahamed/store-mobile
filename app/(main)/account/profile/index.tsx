import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  ScrollView,
  TextInput,
  StyleSheet,
  Alert,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ScreenHeader } from "@/components/layout";
import { Avatar, Button } from "@/components/ui";
import { Body, Label } from "@/components/ui/Typography";
import { useAuth } from "@/lib/supabase/auth";
import { supabase } from "@/lib/supabase/client";
import { colors, radii, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

export default function ProfileScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    dob: "",
    bio: "",
  });

  const displayName = user?.user_metadata?.full_name || form.name || "Guest";

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.replace("/(auth)/login");
      return;
    }

    let cancelled = false;
    (async () => {
      const { data: profile } = await supabase
        .from("users")
        .select("full_name, phone, metadata")
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled) return;

      setForm({
        name: profile?.full_name ?? user.user_metadata?.full_name ?? "",
        email: user.email ?? "",
        phone: profile?.phone ?? "",
        dob: (profile as { metadata?: { dob?: string } } | null)?.metadata?.dob ?? "",
        bio: (profile as { metadata?: { bio?: string } } | null)?.metadata?.bio ?? "",
      });
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user, authLoading, router]);

  const handleSave = useCallback(async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("users")
      .update({
        full_name: form.name,
        phone: form.phone || null,
        metadata: { dob: form.dob, bio: form.bio },
      })
      .eq("id", user.id);

    setSaving(false);
    if (error) {
      Alert.alert("Error", error.message);
    } else {
      Alert.alert("Saved", "Your profile has been updated.");
    }
  }, [user, form]);

  if (authLoading || loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <ScreenHeader title="Profile" />
        <View style={styles.loading}>
          <Body muted>Loading profile…</Body>
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title="Profile" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.avatarSection}>
            <Avatar
              name={displayName}
              uri={user.user_metadata?.avatar_url}
              size={88}
            />
            <Body muted size="sm" style={styles.avatarHint}>
              Profile photo uses your initials until you add a custom image in settings.
            </Body>
          </View>

          <View style={styles.form}>
            <ProfileField
              label="Full name"
              value={form.name}
              onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
            />
            <ProfileField label="Email" value={form.email} editable={false} />
            <ProfileField
              label="Phone"
              value={form.phone}
              onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))}
              keyboardType="phone-pad"
            />
            <ProfileField
              label="Date of birth"
              value={form.dob}
              onChangeText={(v) => setForm((f) => ({ ...f, dob: v }))}
              placeholder="YYYY-MM-DD"
            />
            <View style={styles.field}>
              <Label style={styles.fieldLabel}>Bio</Label>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={form.bio}
                onChangeText={(v) => setForm((f) => ({ ...f, bio: v }))}
                multiline
                numberOfLines={4}
                placeholder="Tell us about yourself"
                placeholderTextColor={colors.light.mutedForeground}
              />
            </View>
          </View>

          <Button onPress={handleSave} loading={saving} style={styles.saveBtn}>
            Save changes
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ProfileField({
  label,
  value,
  onChangeText,
  editable = true,
  keyboardType,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText?: (v: string) => void;
  editable?: boolean;
  keyboardType?: "default" | "phone-pad";
  placeholder?: string;
}) {
  return (
    <View style={styles.field}>
      <Label style={styles.fieldLabel}>{label}</Label>
      <TextInput
        style={[styles.input, !editable && styles.inputDisabled]}
        value={value}
        onChangeText={onChangeText}
        editable={editable}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={colors.light.mutedForeground}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.light.background,
  },
  flex: { flex: 1 },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    padding: spacing[5],
    paddingBottom: spacing[10],
  },
  avatarSection: {
    alignItems: "center",
    gap: spacing[3],
    marginBottom: spacing[6],
  },
  avatarHint: {
    textAlign: "center",
    maxWidth: 280,
  },
  form: {
    gap: spacing[4],
    marginBottom: spacing[6],
  },
  field: {
    gap: spacing[2],
  },
  fieldLabel: {
    color: colors.light.mutedForeground,
    fontSize: typography.fontSizes.xs,
    fontFamily: fontFamilies.sans.medium,
  },
  input: {
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.xl,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    fontSize: typography.fontSizes.sm,
    color: colors.light.foreground,
    fontFamily: fontFamilies.sans.regular,
  },
  inputDisabled: {
    backgroundColor: colors.olive[50],
    color: colors.light.mutedForeground,
  },
  textArea: {
    minHeight: 96,
    textAlignVertical: "top",
  },
  saveBtn: {
    alignSelf: "stretch",
  },
});
