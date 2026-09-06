import React from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { Ionicons, type IonIconName } from "@/components/ui/Icon";
import { colors, typography, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import type { Store } from "@/lib/types";

const GOLD = colors.accent2.ochre;
const CREAM = colors.paper.cream;
const INK = colors.olive[950];

interface Props {
  store: Store;
  phone: string | null;
  email: string | null;
  editing: boolean;
  saving: boolean;
  draftName: string;
  draftDescription: string;
  draftPhone: string;
  draftEmail: string;
  onChangeName: (v: string) => void;
  onChangeDescription: (v: string) => void;
  onChangePhone: (v: string) => void;
  onChangeEmail: (v: string) => void;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
}

function displayValue(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function StoreInfoCard({
  store,
  phone,
  email,
  editing,
  saving,
  draftName,
  draftDescription,
  draftPhone,
  draftEmail,
  onChangeName,
  onChangeDescription,
  onChangePhone,
  onChangeEmail,
  onEdit,
  onCancel,
  onSave,
}: Props) {
  const monogram = (store.name || "S").trim().charAt(0).toUpperCase();
  const live = store.is_online === true;
  const status = String(store.status ?? "").trim();
  const rows: Array<{ icon: IonIconName; label: string; value: string | null }> = [
    { icon: "link-outline", label: "Slug", value: displayValue(store.slug) },
    { icon: "document-text-outline", label: "Description", value: displayValue(store.description) },
    { icon: "call-outline", label: "Phone", value: displayValue(phone) },
    { icon: "mail-outline", label: "Email", value: displayValue(email) },
  ];

  return (
    <View style={styles.card}>
      <View style={styles.identity}>
        {store.logo_url ? (
          <Image source={{ uri: store.logo_url }} style={styles.logo} contentFit="cover" />
        ) : (
          <View style={styles.monogram}>
            <Text style={styles.monogramText}>{monogram}</Text>
          </View>
        )}
        <View style={styles.identityText}>
          <Text style={styles.name} numberOfLines={1}>{store.name}</Text>
          <View style={styles.tagRow}>
            <View style={[styles.liveTag, !live && styles.liveTagOff]}>
              <View style={[styles.liveDot, !live && styles.liveDotOff]} />
              <Text style={styles.liveText}>{live ? "Live" : "Offline"}</Text>
            </View>
            {status ? (
              <Text style={styles.statusText}>{status.replace(/_/g, " ")}</Text>
            ) : null}
          </View>
        </View>
        {!editing ? (
          <TouchableOpacity
            style={styles.editBtn}
            onPress={onEdit}
            accessibilityRole="button"
            accessibilityLabel="Edit store details"
          >
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {editing ? (
        <View style={styles.form}>
          <Field label="Name" value={draftName} onChangeText={onChangeName} />
          <Field
            label="Description"
            value={draftDescription}
            onChangeText={onChangeDescription}
            multiline
          />
          <Field
            label="Phone"
            value={draftPhone}
            onChangeText={onChangePhone}
            keyboardType="phone-pad"
            placeholder="Not on file"
          />
          <Field
            label="Email"
            value={draftEmail}
            onChangeText={onChangeEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="Not on file"
          />
          <View style={styles.formActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} disabled={saving}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={onSave}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel="Save store details"
            >
              <Text style={styles.saveText}>{saving ? "Saving…" : "Save"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        rows.map((r) => (
          <View key={r.label} style={styles.row}>
            <Ionicons name={r.icon} size={16} color={colors.olive[700]} />
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>{r.label}</Text>
              <Text
                style={[styles.rowValue, !r.value && styles.rowValueEmpty]}
                numberOfLines={r.label === "Description" ? 3 : 2}
              >
                {r.value ?? "Not on file"}
              </Text>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "email-address" | "phone-pad";
  autoCapitalize?: "none" | "sentences";
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.rowLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.light.mutedForeground}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        multiline={multiline}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: CREAM,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.12)",
    padding: spacing[4],
    gap: spacing[3],
  },
  identity: { flexDirection: "row", alignItems: "center", gap: 12 },
  logo: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.olive[100] },
  monogram: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.olive[900],
    borderWidth: 1,
    borderColor: GOLD,
    alignItems: "center",
    justifyContent: "center",
  },
  monogramText: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 22,
    color: CREAM,
  },
  identityText: { flex: 1, minWidth: 0 },
  name: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 22,
    color: INK,
    letterSpacing: -0.3,
  },
  tagRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  liveTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    backgroundColor: "rgba(83,94,44,0.1)",
  },
  liveTagOff: { backgroundColor: "rgba(160,64,48,0.08)" },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.olive[600] },
  liveDotOff: { backgroundColor: colors.accent2.rust },
  liveText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.olive[800],
  },
  statusText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.light.mutedForeground,
  },
  editBtn: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 14,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  editBtnText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: typography.fontSizes.sm,
    color: colors.olive[800],
  },
  row: { flexDirection: "row", alignItems: "flex-start", gap: spacing[3] },
  rowText: { flex: 1 },
  rowLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    color: colors.olive[700],
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  rowValue: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    color: INK,
    marginTop: 2,
  },
  rowValueEmpty: {
    color: colors.light.mutedForeground,
    fontStyle: "italic",
  },
  form: { gap: spacing[3], marginTop: 4 },
  field: { gap: 6 },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.18)",
    borderRadius: radii.lg,
    paddingHorizontal: 12,
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    color: INK,
    backgroundColor: colors.light.background,
  },
  inputMultiline: { minHeight: 88, paddingTop: 12, textAlignVertical: "top" },
  formActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  cancelBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.18)",
  },
  cancelText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: typography.fontSizes.sm,
    color: colors.olive[800],
  },
  saveBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.olive[900],
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.sm,
    color: CREAM,
  },
});
