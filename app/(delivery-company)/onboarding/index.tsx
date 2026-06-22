import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/lib/supabase/auth";
import { supabase } from "@/lib/supabase/client";
import { hasStoreApi, onboardDeliveryCompany } from "@/lib/api/delivery-company-api";
import { colors, typography, radii } from "@/lib/theme/tokens";

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export default function CompanyOnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugDirty, setSlugDirty] = useState(false);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState(user?.email ?? "");
  const [description, setDescription] = useState("");
  const [postals, setPostals] = useState("");
  const [policy, setPolicy] = useState<"zone" | "round_robin" | "manual">("zone");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!slugDirty) setSlug(slugify(name));
  }, [name, slugDirty]);

  const submit = async () => {
    if (!name.trim() || !slug.trim()) {
      Alert.alert("Missing fields", "Company name and URL slug are required.");
      return;
    }
    if (!hasStoreApi()) {
      Alert.alert("Not configured", "Set EXPO_PUBLIC_STORE_API_URL first.");
      return;
    }
    setSubmitting(true);
    const postalList = postals.split(/[\s,]+/).map((p) => p.trim()).filter(Boolean).slice(0, 500);
    const res = await onboardDeliveryCompany({
      name: name.trim(),
      slug: slug.trim(),
      contact_phone: phone.trim() || undefined,
      contact_email: email.trim() || undefined,
      description: description.trim() || undefined,
      serviceable_postal_codes: postalList,
      default_assignment_policy: policy,
    });
    setSubmitting(false);
    if (!res.ok) {
      Alert.alert("Failed", res.error);
      return;
    }
    await supabase.auth.refreshSession().catch(() => undefined);
    Alert.alert("Submitted", "Your application is pending admin approval.", [
      { text: "OK", onPress: () => router.replace("/(delivery-company)") },
    ]);
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 16, padding: 16, paddingBottom: 40 }}>
        <View style={styles.hero}>
          <Ionicons name="business-outline" size={36} color={colors.light.primary} />
          <Text style={styles.title}>Start a delivery company</Text>
          <Text style={styles.sub}>
            Register your logistics operation. Admin approval is required before you can dispatch at scale.
          </Text>
        </View>

        <Field label="Company name" value={name} onChange={setName} />
        <Field
          label="URL slug"
          value={slug}
          onChange={(v) => {
            setSlugDirty(true);
            setSlug(v);
          }}
          autoCapitalize="none"
        />
        <Field label="Description" value={description} onChange={setDescription} multiline />
        <Field label="Contact phone" value={phone} onChange={setPhone} keyboardType="phone-pad" />
        <Field label="Contact email" value={email} onChange={setEmail} keyboardType="email-address" autoCapitalize="none" />
        <Field label="Serviceable postal codes" value={postals} onChange={setPostals} multiline placeholder="00500, 00501" />

        <Text style={styles.fieldLabel}>Default policy</Text>
        <View style={styles.policyRow}>
          {(["zone", "round_robin", "manual"] as const).map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.policyChip, policy === p && styles.policyChipActive]}
              onPress={() => setPolicy(p)}
            >
              <Text style={[styles.policyText, policy === p && styles.policyTextActive]}>{p.replace(/_/g, " ")}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={[styles.submitBtn, submitting && styles.submitDisabled]} onPress={submit} disabled={submitting}>
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>Submit application</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  value,
  onChange,
  multiline,
  placeholder,
  keyboardType,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  placeholder?: string;
  keyboardType?: "default" | "email-address" | "phone-pad";
  autoCapitalize?: "none" | "sentences";
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMulti]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.light.mutedForeground}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  hero: { alignItems: "center", marginBottom: 24, gap: 8 },
  title: { fontSize: typography.fontSizes["2xl"], fontWeight: typography.fontWeights.bold, textAlign: "center" },
  sub: { fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground, textAlign: "center", paddingHorizontal: 16 },
  field: { marginBottom: 12 },
  fieldLabel: { fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: typography.fontSizes.base,
    backgroundColor: colors.light.card,
  },
  inputMulti: { minHeight: 72, textAlignVertical: "top" },
  policyRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  policyChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.full, backgroundColor: colors.light.muted },
  policyChipActive: { backgroundColor: colors.light.primary },
  policyText: { fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground, textTransform: "capitalize" },
  policyTextActive: { color: "#fff", fontWeight: typography.fontWeights.semibold },
  submitBtn: {
    backgroundColor: colors.light.primary,
    paddingVertical: 14,
    borderRadius: radii.lg,
    alignItems: "center",
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: "#fff", fontWeight: typography.fontWeights.semibold },
});
