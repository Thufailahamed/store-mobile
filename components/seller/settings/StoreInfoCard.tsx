import React from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
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
    { icon: "link-outline", label: "Store link", value: store.slug ? `/stores/${store.slug}` : null, empty: "Not set" },
    { icon: "call-outline", label: "Phone", value: displayValue(phone), empty: "Add phone number" },
    { icon: "mail-outline", label: "Email", value: displayValue(email), empty: "Add contact email" },
  ];

  const memberSince = store.created_at ? new Date(store.created_at).getFullYear() : null;
  const stats: { label: string; value: string }[] = [
    { label: "Products", value: compact(store.total_products) },
    { label: "Followers", value: compact(store.total_followers) },
    { label: "Rating", value: store.rating ? Number(store.rating).toFixed(1) : "—" },
    { label: "Sales", value: compact(store.total_sales) },
  ];

  return (
    <View style={styles.card}>
      <View style={styles.banner}>
        {store.banner_url ? (
          <Image source={{ uri: store.banner_url }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : null}
        <LinearGradient
          colors={
            store.banner_url
              ? ["rgba(22,26,10,0.15)", "rgba(22,26,10,0.75)"]
              : [colors.olive[700], colors.olive[900], INK]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.ringLarge} />
        <View style={styles.ringSmall} />
        <View style={styles.bannerGlow} />

        <View style={styles.bannerTop}>
          <Text style={styles.bannerKicker}>
            {memberSince ? `Maison · Est. ${memberSince}` : "Maison"}
          </Text>
          {!editing ? (
            <TouchableOpacity
              style={styles.editBtn}
              onPress={onEdit}
              accessibilityRole="button"
              accessibilityLabel="Edit store details"
              activeOpacity={0.8}
            >
              <Ionicons name="create-outline" size={13} color={CREAM} />
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <View style={styles.bannerHairline} />
      </View>

      <View style={styles.body}>
        <View style={styles.logoRing}>
          <View style={styles.logoWrap}>
            {store.logo_url ? (
              <Image source={{ uri: store.logo_url }} style={styles.logo} contentFit="cover" />
            ) : (
              <LinearGradient
                colors={[colors.olive[700], colors.olive[900]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.monogram}
              >
                <Text style={styles.monogramText}>{monogram}</Text>
              </LinearGradient>
            )}
          </View>
        </View>

        <View style={styles.nameBlock}>
          <Text style={styles.name} numberOfLines={2}>{store.name}</Text>
          <View style={styles.tagRow}>
            <View style={[styles.liveTag, !live && styles.liveTagOff]}>
              <View style={[styles.liveDotHalo, !live && styles.liveDotHaloOff]}>
                <View style={[styles.liveDot, !live && styles.liveDotOff]} />
              </View>
              <Text style={[styles.liveText, !live && styles.liveTextOff]}>{live ? "Live" : "Offline"}</Text>
            </View>
            {status ? (
              <View style={[styles.statusTag, !approved && styles.statusTagPending]}>
                <Ionicons
                  name={approved ? "shield-checkmark" : "time-outline"}
                  size={11}
                  color={approved ? GOLD : "#8A6A1C"}
                />
                <Text style={[styles.statusText, !approved && styles.statusTextPending]}>
                  {approved ? "Verified" : status.replace(/_/g, " ")}
                </Text>
              </View>
            ) : null}
          </View>
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
          <View style={styles.quote}>
            <View style={styles.quoteRule} />
            <Text
              style={[styles.description, !description && styles.descriptionEmpty]}
              numberOfLines={4}
            >
              {description ?? "Add a short description so customers know what your store is about."}
            </Text>
          </View>

          <View style={styles.stats}>
            {stats.map((st, i) => (
              <View key={st.label} style={[styles.stat, i > 0 && styles.statDivider]}>
                <Text style={styles.statValue}>{st.value}</Text>
                <Text style={styles.statLabel}>{st.label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.sectionHead}>
            <Text style={styles.sectionLabel}>Contact & identity</Text>
            <View style={styles.sectionLine} />
          </View>

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
                <View style={[styles.rowIcon, !r.value && styles.rowIconEmpty]}>
                  <Ionicons name={r.icon} size={16} color={r.value ? colors.olive[800] : GOLD} />
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
                {r.value ? (
                  <Ionicons name="checkmark-circle" size={16} color={colors.olive[500]} />
                ) : (
                  <View style={styles.addPill}>
                    <Ionicons name="add" size={12} color="#8A6A1C" />
                    <Text style={styles.addPillText}>Add</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            onPress={() => router.push(`/stores/${store.slug || store.id}` as any)}
            accessibilityRole="button"
            accessibilityLabel="View public storefront"
            activeOpacity={0.85}
            style={styles.ctaShadow}
          >
            <LinearGradient
              colors={[colors.olive[800], INK]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.storefrontLink}
            >
              <View style={styles.ctaIcon}>
                <Ionicons name="storefront-outline" size={16} color={GOLD} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.storefrontLinkText}>View public storefront</Text>
                <Text style={styles.storefrontLinkSub} numberOfLines={1}>
                  See your maison as customers do
                </Text>
              </View>
              <View style={styles.ctaArrow}>
                <Ionicons name="arrow-forward" size={14} color={INK} />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </>
      )}
      </View>
    </View>
  );
}

function compact(n: number | null | undefined) {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v) || v <= 0) return "0";
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(Math.round(v));
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
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(200,164,74,0.22)",
    overflow: "hidden",
    ...shadows.editorial,
  },
  banner: {
    height: 112,
    backgroundColor: colors.olive[900],
    overflow: "hidden",
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
  },
  bannerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  bannerKicker: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "rgba(250,248,241,0.62)",
  },
  ringLarge: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    right: -90,
    top: -120,
    borderWidth: 1,
    borderColor: "rgba(200,164,74,0.35)",
  },
  ringSmall: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    right: -50,
    top: -80,
    borderWidth: 1,
    borderColor: "rgba(200,164,74,0.18)",
  },
  bannerGlow: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    left: -80,
    bottom: -140,
    backgroundColor: "rgba(200,164,74,0.14)",
  },
  bannerHairline: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 1,
    backgroundColor: "rgba(200,164,74,0.55)",
  },
  body: { paddingHorizontal: spacing[5], paddingBottom: spacing[5], gap: spacing[3] },
  logoRing: {
    alignSelf: "flex-start",
    marginTop: -42,
    padding: 2,
    borderRadius: 30,
    backgroundColor: GOLD,
    ...shadows.soft,
  },
  logoWrap: { padding: 3, borderRadius: 28, backgroundColor: "#FFFFFF" },
  logo: { width: 72, height: 72, borderRadius: 25, backgroundColor: colors.olive[100] },
  monogram: {
    width: 72,
    height: 72,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
  },
  monogramText: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 34,
    color: CREAM,
  },
  nameBlock: { gap: 8 },
  name: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 30,
    lineHeight: 36,
    color: INK,
    letterSpacing: -0.6,
  },
  tagRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
  liveTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
    backgroundColor: "rgba(83,94,44,0.08)",
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.18)",
  },
  liveTagOff: { backgroundColor: "rgba(184,92,58,0.06)", borderColor: "rgba(184,92,58,0.22)" },
  liveDotHalo: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "rgba(83,94,44,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  liveDotHaloOff: { backgroundColor: "rgba(184,92,58,0.16)" },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.olive[600] },
  liveDotOff: { backgroundColor: colors.accent2.rust },
  liveText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    letterSpacing: 1.4,
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
    backgroundColor: INK,
  },
  statusTagPending: { backgroundColor: "rgba(200,164,74,0.16)" },
  statusText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: CREAM,
  },
  statusTextPending: { color: "#8A6A1C" },
  quote: { flexDirection: "row", gap: 12 },
  quoteRule: { width: 2, borderRadius: 1, backgroundColor: GOLD },
  description: {
    flex: 1,
    fontFamily: fontFamilies.display.italic,
    fontSize: 16,
    lineHeight: 24,
    color: colors.olive[900],
  },
  descriptionEmpty: { color: colors.light.mutedForeground },
  stats: {
    flexDirection: "row",
    paddingVertical: 14,
    borderRadius: 20,
    backgroundColor: colors.paper.cream,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.08)",
    marginTop: 4,
  },
  stat: { flex: 1, alignItems: "center", gap: 3 },
  statDivider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: "rgba(83,94,44,0.2)" },
  statValue: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 20,
    color: INK,
    letterSpacing: -0.3,
  },
  statLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 8.5,
    letterSpacing: 1.3,
    textTransform: "uppercase",
    color: colors.olive[600],
  },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 },
  sectionLabel: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: colors.olive[700],
  },
  sectionLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: "rgba(200,164,74,0.5)" },
  list: {
    backgroundColor: colors.paper.cream,
    borderRadius: 22,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.1)",
  },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minHeight: 34,
    paddingHorizontal: 14,
    borderRadius: radii.full,
    backgroundColor: "rgba(250,248,241,0.1)",
    borderWidth: 1,
    borderColor: "rgba(200,164,74,0.5)",
  },
  editBtnText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: typography.fontSizes.xs,
    letterSpacing: 0.3,
    color: CREAM,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13 },
  rowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(83,94,44,0.14)",
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  rowIconEmpty: { borderStyle: "dashed", borderColor: "rgba(200,164,74,0.6)" },
  rowText: { flex: 1 },
  rowLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    color: colors.olive[600],
    textTransform: "uppercase",
    letterSpacing: 1.4,
  },
  rowValue: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: typography.fontSizes.sm,
    color: INK,
    marginTop: 3,
  },
  rowValueEmpty: {
    color: colors.light.mutedForeground,
    fontFamily: fontFamilies.sans.regular,
  },
  addPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
    backgroundColor: "rgba(200,164,74,0.14)",
  },
  addPillText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 11,
    color: "#8A6A1C",
  },
  ctaShadow: { borderRadius: 22, marginTop: 4, ...shadows.glow },
  storefrontLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 64,
    paddingLeft: 10,
    paddingRight: 10,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(200,164,74,0.35)",
  },
  ctaIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(200,164,74,0.12)",
    borderWidth: 1,
    borderColor: "rgba(200,164,74,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  storefrontLinkText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.sm,
    color: CREAM,
  },
  storefrontLinkSub: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 10,
    color: "rgba(250,248,241,0.55)",
    marginTop: 2,
  },
  ctaArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: GOLD,
    alignItems: "center",
    justifyContent: "center",
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
