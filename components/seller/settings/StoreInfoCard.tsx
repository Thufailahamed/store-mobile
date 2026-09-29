import React from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Ionicons, type IonIconName } from "@/components/ui/Icon";
import { colors, typography, radii, shadows, spacing } from "@/lib/theme/tokens";
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
  const router = useRouter();
  const monogram = (store.name || "S").trim().charAt(0).toUpperCase();
  const live = store.is_online === true;
  const status = String(store.status ?? "").trim();
  const description = displayValue(store.description);
  const statusKey = status.toLowerCase();
  const approved = statusKey === "approved" || statusKey === "active";
  const rows: { icon: IonIconName; label: string; value: string | null; empty: string }[] = [
    { icon: "link-outline", label: "Slug", value: displayValue(store.slug), empty: "Not set" },
    { icon: "call-outline", label: "Phone", value: displayValue(phone), empty: "Add phone number" },
    { icon: "mail-outline", label: "Email", value: displayValue(email), empty: "Add contact email" },
  ];

  return (
    <View style={styles.card}>
      <View style={styles.banner}>
        <View style={styles.bannerGlow} />
        <View style={styles.bannerGlowSmall} />
        {!editing ? (
          <TouchableOpacity
            style={styles.editBtn}
            onPress={onEdit}
            accessibilityRole="button"
            accessibilityLabel="Edit store details"
          >
            <Ionicons name="create-outline" size={14} color={CREAM} />
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.body}>
        <View style={styles.logoWrap}>
          {store.logo_url ? (
            <Image source={{ uri: store.logo_url }} style={styles.logo} contentFit="cover" />
          ) : (
            <View style={styles.monogram}>
              <Text style={styles.monogramText}>{monogram}</Text>
            </View>
          )}
        </View>

        <Text style={styles.name} numberOfLines={2}>{store.name}</Text>
        <View style={styles.tagRow}>
          <View style={[styles.liveTag, !live && styles.liveTagOff]}>
            <View style={[styles.liveDot, !live && styles.liveDotOff]} />
            <Text style={[styles.liveText, !live && styles.liveTextOff]}>{live ? "Live" : "Offline"}</Text>
          </View>
          {status ? (
            <View style={[styles.statusTag, !approved && styles.statusTagPending]}>
              <Ionicons
                name={approved ? "checkmark-circle" : "time-outline"}
                size={12}
                color={approved ? colors.olive[700] : "#8A6A1C"}
              />
              <Text style={[styles.statusText, !approved && styles.statusTextPending]}>
                {status.replace(/_/g, " ")}
              </Text>
            </View>
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
        <>
          <Text
            style={[styles.description, !description && styles.descriptionEmpty]}
            numberOfLines={4}
          >
            {description ?? "Add a short description so customers know what your store is about."}
          </Text>

          <View style={styles.list}>
            {rows.map((r, i) => (
              <TouchableOpacity
                key={r.label}
                activeOpacity={r.value ? 1 : 0.6}
                onPress={r.value ? undefined : onEdit}
                style={[styles.row, i > 0 && styles.rowBorder]}
                accessibilityRole={r.value ? undefined : "button"}
                accessibilityLabel={r.value ? `${r.label}: ${r.value}` : r.empty}
              >
                <View style={styles.rowIcon}>
                  <Ionicons name={r.icon} size={16} color={colors.olive[800]} />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowLabel}>{r.label}</Text>
                  <Text
                    style={[styles.rowValue, !r.value && styles.rowValueEmpty]}
                    numberOfLines={1}
                  >
                    {r.value ?? r.empty}
                  </Text>
                </View>
                {!r.value ? <Ionicons name="add-circle-outline" size={18} color={GOLD} /> : null}
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={styles.storefrontLink}
            onPress={() => router.push(`/store/${store.slug || store.id}` as any)}
            accessibilityRole="button"
            accessibilityLabel="View public storefront"
          >
            <Ionicons name="storefront-outline" size={16} color={CREAM} />
            <Text style={styles.storefrontLinkText}>View public storefront</Text>
            <Ionicons name="arrow-forward" size={14} color={CREAM} />
          </TouchableOpacity>
        </>
      )}
      </View>
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
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.12)",
    overflow: "hidden",
    ...shadows.soft,
  },
  banner: {
    height: 92,
    backgroundColor: colors.olive[900],
    overflow: "hidden",
    alignItems: "flex-end",
    padding: spacing[3],
  },
  bannerGlow: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    right: -60,
    top: -110,
    backgroundColor: "rgba(200,164,74,0.22)",
  },
  bannerGlowSmall: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    left: -30,
    bottom: -70,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  body: { paddingHorizontal: spacing[4], paddingBottom: spacing[4], gap: spacing[3] },
  logoWrap: {
    marginTop: -36,
    alignSelf: "flex-start",
    padding: 4,
    borderRadius: 26,
    backgroundColor: "#FFFFFF",
  },
  logo: { width: 64, height: 64, borderRadius: 22, backgroundColor: colors.olive[100] },
  monogram: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: colors.olive[800],
    borderWidth: 1,
    borderColor: GOLD,
    alignItems: "center",
    justifyContent: "center",
  },
  monogramText: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 26,
    color: CREAM,
  },
  name: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 26,
    color: INK,
    letterSpacing: -0.4,
    marginTop: -4,
  },
  tagRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: -4 },
  liveTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
    backgroundColor: "rgba(83,94,44,0.1)",
  },
  liveTagOff: { backgroundColor: "rgba(160,64,48,0.09)" },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.olive[600] },
  liveDotOff: { backgroundColor: colors.accent2.rust },
  liveText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.olive[800],
  },
  liveTextOff: { color: colors.accent2.rust },
  statusTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
    backgroundColor: "rgba(83,94,44,0.1)",
  },
  statusTagPending: { backgroundColor: "rgba(200,164,74,0.16)" },
  statusText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.olive[800],
  },
  statusTextPending: { color: "#8A6A1C" },
  description: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    lineHeight: 21,
    color: colors.olive[900],
  },
  descriptionEmpty: { color: colors.light.mutedForeground, fontStyle: "italic" },
  list: {
    backgroundColor: colors.olive[50],
    borderRadius: 20,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.08)",
  },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: radii.full,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
  },
  editBtnText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: typography.fontSizes.sm,
    color: CREAM,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  rowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(83,94,44,0.16)",
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: { flex: 1 },
  rowLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    color: colors.olive[700],
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  rowValue: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: typography.fontSizes.sm,
    color: INK,
    marginTop: 2,
  },
  rowValueEmpty: {
    color: colors.light.mutedForeground,
    fontFamily: fontFamilies.sans.regular,
  },
  storefrontLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 50,
    borderRadius: radii.full,
    backgroundColor: colors.olive[900],
  },
  storefrontLinkText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.sm,
    color: CREAM,
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
