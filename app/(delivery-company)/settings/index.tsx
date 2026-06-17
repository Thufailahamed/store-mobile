import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import {
  getDeliveryCompanyMe,
  hasStoreApi,
  updateDeliveryCompany,
  type DeliveryCompany,
} from "@/lib/api/delivery-company-api";
import { colors, typography, radii } from "@/lib/theme/tokens";

const POLICIES = [
  { id: "zone", label: "Zone-based" },
  { id: "round_robin", label: "Round-robin" },
  { id: "manual", label: "Manual only" },
] as const;

export default function CompanySettingsScreen() {
  const [company, setCompany] = useState<DeliveryCompany | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [postals, setPostals] = useState("");
  const [policy, setPolicy] = useState<"zone" | "round_robin" | "manual">("zone");
  const [autoLastMile, setAutoLastMile] = useState(false);

  const load = useCallback(async () => {
    if (!hasStoreApi()) {
      setLoading(false);
      return;
    }
    const res = await getDeliveryCompanyMe();
    if (res.ok) {
      const c = res.data.company;
      setCompany(c);
      setName(c.name);
      setDescription(c.description ?? "");
      setPhone(c.contact_phone ?? "");
      setEmail(c.contact_email ?? "");
      setPostals((c.serviceable_postal_codes ?? []).join(", "));
      setPolicy((c.default_assignment_policy as typeof policy) ?? "zone");
      setAutoLastMile(!!c.auto_assign_last_mile_on_receive);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const statusBanner = useMemo(() => {
    const s = company?.status;
    if (!s || s === "active") return null;
    const messages: Record<string, string> = {
      pending: "Awaiting admin approval. You can still set up profile and invite drivers.",
      suspended: "Suspended by admin. Contact support to reactivate.",
      rejected: "Application rejected. Contact support for details.",
    };
    return messages[s] ?? `Status: ${s}`;
  }, [company?.status]);

  const save = async () => {
    const postalList = postals.split(/[\s,]+/).map((p) => p.trim()).filter(Boolean);
    setSaving(true);
    const res = await updateDeliveryCompany({
      name: name.trim(),
      description: description.trim() || undefined,
      contact_phone: phone.trim() || undefined,
      contact_email: email.trim() || undefined,
      serviceable_postal_codes: postalList,
      default_assignment_policy: policy,
      auto_assign_last_mile_on_receive: autoLastMile,
    });
    setSaving(false);
    if (!res.ok) Alert.alert("Save failed", res.error);
    else {
      Alert.alert("Saved", "Company settings updated.");
      load();
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.light.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScreenHeader title="Settings" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {statusBanner ? (
          <View style={styles.banner}>
            <Text style={styles.bannerTitle}>Status: {company?.status}</Text>
            <Text style={styles.bannerText}>{statusBanner}</Text>
          </View>
        ) : null}

        <Text style={styles.section}>Profile</Text>
        <Field label="Company name" value={name} onChange={setName} />
        <Field label="Description" value={description} onChange={setDescription} multiline />
        <Field label="Contact phone" value={phone} onChange={setPhone} keyboardType="phone-pad" />
        <Field label="Contact email" value={email} onChange={setEmail} keyboardType="email-address" autoCapitalize="none" />

        <Text style={styles.section}>Operations</Text>
        <Field
          label="Serviceable postal codes"
          value={postals}
          onChange={setPostals}
          multiline
          placeholder="00500, 00501"
        />
        <Text style={styles.hint}>Used for zone-based auto-assignment.</Text>

        <Text style={styles.fieldLabel}>Default assignment policy</Text>
        <View style={styles.policyRow}>
          {POLICIES.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={[styles.policyChip, policy === p.id && styles.policyChipActive]}
              onPress={() => setPolicy(p.id)}
            >
              <Text style={[styles.policyText, policy === p.id && styles.policyTextActive]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchLabel}>Auto-assign last mile on receive</Text>
            <Text style={styles.hint}>When a package is scanned into a hub, queue last-mile assignment.</Text>
          </View>
          <Switch value={autoLastMile} onValueChange={setAutoLastMile} trackColor={{ true: colors.light.primary }} />
        </View>

        <TouchableOpacity style={[styles.saveBtn, saving && styles.saveDisabled]} onPress={save} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save settings</Text>}
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
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  content: { padding: 16, paddingBottom: 40 },
  banner: {
    backgroundColor: "#fffbeb",
    borderRadius: radii.lg,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#fde68a",
  },
  bannerTitle: { fontWeight: typography.fontWeights.semibold, color: "#a16207", textTransform: "capitalize" },
  bannerText: { fontSize: typography.fontSizes.sm, color: "#92400e", marginTop: 4 },
  section: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold,
    color: colors.light.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: typography.letterSpacing.wider,
    marginBottom: 10,
    marginTop: 8,
  },
  field: { marginBottom: 12 },
  fieldLabel: { fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: typography.fontSizes.base,
    color: colors.light.foreground,
    backgroundColor: colors.light.card,
  },
  inputMulti: { minHeight: 72, textAlignVertical: "top" },
  hint: { fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground, marginBottom: 12 },
  policyRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  policyChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.full,
    backgroundColor: colors.light.muted,
  },
  policyChipActive: { backgroundColor: colors.light.primary },
  policyText: { fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground },
  policyTextActive: { color: "#fff", fontWeight: typography.fontWeights.semibold },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 },
  switchLabel: { fontSize: typography.fontSizes.sm, fontWeight: typography.fontWeights.medium },
  saveBtn: {
    backgroundColor: colors.light.primary,
    paddingVertical: 14,
    borderRadius: radii.lg,
    alignItems: "center",
  },
  saveDisabled: { opacity: 0.6 },
  saveText: { color: "#fff", fontWeight: typography.fontWeights.semibold },
});
