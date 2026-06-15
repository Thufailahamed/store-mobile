import React, { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ScreenHeader } from "@/components/layout";
import { Badge, Button, Skeleton, useToast } from "@/components/ui";
import { Body, Display, Label } from "@/components/ui/Typography";
import { useAuth } from "@/lib/supabase/auth";
import {
  createAddress,
  deleteAddress,
  getAddresses,
  updateAddress,
} from "@/lib/api";
import type { Address } from "@/lib/types";
import { colors, radii, shadows, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

type AddressType = "home" | "work" | "other";

const TYPE_META: Record<AddressType, { label: string; icon: keyof typeof Ionicons.glyphMap; copy: string }> = {
  home: { label: "Home", icon: "home-outline", copy: "Where you live, where things get tried on." },
  work: { label: "Work", icon: "briefcase-outline", copy: "Office or studio — for daytime deliveries." },
  other: { label: "Other", icon: "location-outline", copy: "A second home, a friend's, a hotel…" },
};

interface AddressForm {
  type: AddressType;
  full_name: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  is_default: boolean;
}

const EMPTY_FORM: AddressForm = {
  type: "home",
  full_name: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postal_code: "",
  country: "Sri Lanka",
  is_default: false,
};

export default function AddressesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AddressForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    const userId = user.id;
    let cancelled = false;
    getAddresses(userId).then((res) => {
      if (cancelled) return;
      if (res.ok) setAddresses(res.data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const refresh = async () => {
    if (!user?.id) return;
    const res = await getAddresses(user.id);
    if (res.ok) setAddresses(res.data);
  };

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, full_name: user?.user_metadata?.full_name ?? "", phone: (user?.user_metadata?.phone as string) ?? "" });
    setModalOpen(true);
  };

  const openEdit = (a: Address) => {
    setEditingId(a.id);
    setForm({
      type: a.type,
      full_name: a.full_name,
      phone: a.phone,
      line1: a.line1,
      line2: a.line2 ?? "",
      city: a.city,
      state: a.state,
      postal_code: a.postal_code,
      country: a.country,
      is_default: a.is_default,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleSave = async () => {
    if (!user?.id) return;
    if (!form.full_name.trim() || !form.phone.trim() || !form.line1.trim() || !form.city.trim() || !form.state.trim() || !form.postal_code.trim()) {
      toast("Fill in all required fields", "error");
      return;
    }

    setSaving(true);

    if (form.is_default) {
      // clear other defaults first
      for (const a of addresses) {
        if (a.is_default && a.id !== editingId) {
          await updateAddress(a.id, { is_default: false });
        }
      }
    }

    let res;
    const payload = {
      user_id: user.id,
      type: form.type,
      full_name: form.full_name.trim(),
      phone: form.phone.trim(),
      line1: form.line1.trim(),
      line2: form.line2.trim() || undefined,
      city: form.city.trim(),
      state: form.state.trim(),
      postal_code: form.postal_code.trim(),
      country: form.country.trim() || "Sri Lanka",
      is_default: form.is_default || addresses.length === 0,
    };

    if (editingId) {
      res = await updateAddress(editingId, payload);
    } else {
      res = await createAddress(payload as any);
    }

    setSaving(false);
    if (!res.ok) {
      toast(res.error, "error");
      return;
    }
    toast(editingId ? "Address updated" : "Address added", "success");
    closeModal();
    refresh();
  };

  const handleDelete = (a: Address) => {
    Alert.alert("Remove address", "This will remove the address from your saved list.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          const res = await deleteAddress(a.id);
          if (!res.ok) {
            toast(res.error, "error");
            return;
          }
          toast("Address removed", "success");
          refresh();
        },
      },
    ]);
  };

  const setDefault = async (a: Address) => {
    for (const existing of addresses) {
      if (existing.is_default && existing.id !== a.id) {
        await updateAddress(existing.id, { is_default: false });
      }
    }
    const res = await updateAddress(a.id, { is_default: true });
    if (!res.ok) {
      toast(res.error, "error");
      return;
    }
    toast("Default updated", "success");
    refresh();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <ScreenHeader title="Addresses" />
        <View style={styles.loading}>
          {[1, 2].map((i) => (
            <View key={i} style={styles.skeletonRow}>
              <Skeleton height={120} borderRadius={radii.xl} />
            </View>
          ))}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader
        title="Addresses"
        right={
          <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
            <Ionicons name="add" size={20} color={colors.light.primaryForeground} />
          </TouchableOpacity>
        }
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View>
            <Label style={styles.heroLabel}>Saved places</Label>
            <Display size="2xl" style={styles.heroTitle}>
              Where to send the boxes
            </Display>
            <Body muted>Pick a default to speed up checkout. Add as many as you like.</Body>
          </View>
          <View style={styles.iconBadge}>
            <Ionicons name="map-outline" size={20} color={colors.light.primaryForeground} />
          </View>
        </View>

        <View style={styles.statsRow}>
          <Stat label="Saved" value={addresses.length} icon="location-outline" />
          <Stat label="Default" value={addresses.find((a) => a.is_default)?.type ?? "—"} icon="checkmark-circle-outline" />
        </View>

        {addresses.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="location-outline" size={28} color={colors.light.mutedForeground} />
            </View>
            <Display size="xl">No saved addresses</Display>
            <Body muted>Add a place where you'd love to receive parcels.</Body>
            <Button onPress={openAdd}>
              <Ionicons name="add" size={14} color={colors.light.primaryForeground} style={{ marginRight: 6 }} />
              Add new address
            </Button>
          </View>
        ) : (
          <View style={styles.list}>
            {addresses.map((a) => {
              const meta = TYPE_META[a.type];
              return (
                <View key={a.id} style={styles.addressCard}>
                  <View style={styles.typeStripe} />
                  <View style={styles.addressBody}>
                    <View style={styles.addressHeader}>
                      <View style={styles.typeRow}>
                        <View style={styles.typeIcon}>
                          <Ionicons name={meta.icon} size={14} color={colors.light.primary} />
                        </View>
                        <Label style={styles.typeLabel}>{meta.label.toUpperCase()}</Label>
                        {a.is_default && (
                          <Badge style={{ backgroundColor: colors.olive[100] }}>
                            <Label style={{ color: colors.olive[700], fontSize: 9 }}>DEFAULT</Label>
                          </Badge>
                        )}
                      </View>
                      <View style={styles.actionRow}>
                        <TouchableOpacity onPress={() => openEdit(a)} style={styles.iconBtn}>
                          <Ionicons name="create-outline" size={16} color={colors.light.foreground} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDelete(a)} style={styles.iconBtn}>
                          <Ionicons name="trash-outline" size={16} color={colors.light.destructive} />
                        </TouchableOpacity>
                      </View>
                    </View>
                    <Body size="sm" style={styles.addressName}>{a.full_name}</Body>
                    <Body muted size="xs" style={styles.addressLine}>
                      {a.line1}{a.line2 ? `, ${a.line2}` : ""}
                    </Body>
                    <Body muted size="xs" style={styles.addressLine}>
                      {a.city}, {a.state} {a.postal_code}
                    </Body>
                    <Body muted size="xs" style={styles.addressLine}>{a.country}</Body>
                    <View style={styles.addressFooter}>
                      <Body muted size="xs">
                        <Ionicons name="call-outline" size={11} color={colors.light.mutedForeground} /> {a.phone}
                      </Body>
                      {!a.is_default && (
                        <TouchableOpacity onPress={() => setDefault(a)} style={styles.setDefaultBtn}>
                          <Ionicons name="star-outline" size={12} color={colors.olive[700]} />
                          <Label style={styles.setDefaultText}>Make default</Label>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <TouchableOpacity style={styles.addRow} onPress={openAdd} activeOpacity={0.85}>
          <View style={styles.addRowIcon}>
            <Ionicons name="add" size={18} color={colors.light.primary} />
          </View>
          <View>
            <Body size="sm" style={styles.addRowTitle}>Add a new address</Body>
            <Body muted size="xs">Home, work, or anywhere in between.</Body>
          </View>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={closeModal}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalBackdrop}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View>
                <Label style={styles.modalKicker}>{editingId ? "Update" : "Add"}</Label>
                <Display size="xl">Address</Display>
              </View>
              <TouchableOpacity onPress={closeModal} style={styles.modalClose}>
                <Ionicons name="close" size={18} color={colors.light.foreground} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Label style={styles.fieldGroup}>Type</Label>
              <View style={styles.typeChips}>
                {(["home", "work", "other"] as AddressType[]).map((t) => {
                  const meta = TYPE_META[t];
                  const isActive = form.type === t;
                  return (
                    <TouchableOpacity
                      key={t}
                      style={[styles.typeChip, isActive && styles.typeChipActive]}
                      onPress={() => setForm((f) => ({ ...f, type: t }))}
                    >
                      <Ionicons name={meta.icon} size={14} color={isActive ? colors.light.primaryForeground : colors.light.foreground} />
                      <Label style={[styles.typeChipText, isActive && styles.typeChipTextActive]}>{meta.label}</Label>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Body muted size="xs" style={styles.typeCopy}>{TYPE_META[form.type].copy}</Body>

              <Field label="Full name" required value={form.full_name} onChangeText={(v) => setForm((f) => ({ ...f, full_name: v }))} />
              <Field label="Phone" required keyboardType="phone-pad" value={form.phone} onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))} />
              <Field label="Address line 1" required value={form.line1} onChangeText={(v) => setForm((f) => ({ ...f, line1: v }))} />
              <Field label="Address line 2 (apt, suite, floor)" value={form.line2} onChangeText={(v) => setForm((f) => ({ ...f, line2: v }))} />
              <View style={styles.rowFields}>
                <View style={{ flex: 1 }}>
                  <Field label="City" required value={form.city} onChangeText={(v) => setForm((f) => ({ ...f, city: v }))} />
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="State / province" required value={form.state} onChangeText={(v) => setForm((f) => ({ ...f, state: v }))} />
                </View>
              </View>
              <View style={styles.rowFields}>
                <View style={{ flex: 1 }}>
                  <Field label="Postal code" required keyboardType="number-pad" value={form.postal_code} onChangeText={(v) => setForm((f) => ({ ...f, postal_code: v }))} />
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="Country" value={form.country} onChangeText={(v) => setForm((f) => ({ ...f, country: v }))} />
                </View>
              </View>

              <View style={styles.defaultRow}>
                <View style={{ flex: 1 }}>
                  <Body style={styles.defaultLabel}>Set as default</Body>
                  <Body muted size="xs">Use this for quick checkout</Body>
                </View>
                <Switch
                  value={form.is_default}
                  onValueChange={(v) => setForm((f) => ({ ...f, is_default: v }))}
                  trackColor={{ false: colors.light.border, true: colors.light.primary }}
                  thumbColor={colors.paper.cream}
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <Button variant="outline" onPress={closeModal}>Cancel</Button>
              <Button loading={saving} onPress={handleSave}>
                {editingId ? "Save changes" : "Add address"}
              </Button>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function Stat({ label, value, icon }: { label: string; value: string | number; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statIcon}>
        <Ionicons name={icon} size={16} color={colors.light.primary} />
      </View>
      <Body size="sm" numberOfLines={1} style={styles.statValue}>{typeof value === "number" ? value.toLocaleString() : value}</Body>
      <Label style={styles.statLabel}>{label}</Label>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  required,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  required?: boolean;
  keyboardType?: "default" | "phone-pad" | "number-pad";
}) {
  return (
    <View style={styles.field}>
      <Label style={styles.fieldLabel}>
        {label}{required ? " *" : ""}
      </Label>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholderTextColor={colors.light.mutedForeground}
        autoCapitalize={keyboardType === "default" ? "words" : "none"}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  loading: { flex: 1, padding: spacing[5], gap: 12 },
  skeletonRow: { marginBottom: 4 },
  content: { padding: spacing[5], paddingBottom: spacing[8] },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.light.primary,
  },
  hero: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    backgroundColor: colors.light.card,
    borderRadius: radii["2xl"],
    padding: 20,
    borderWidth: 1,
    borderColor: colors.light.border,
    ...shadows.soft,
    marginBottom: spacing[5],
  },
  heroLabel: { color: colors.light.mutedForeground },
  heroTitle: { marginTop: spacing[2], marginBottom: spacing[2] },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.light.primary,
  },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: spacing[5] },
  statCard: {
    flex: 1,
    backgroundColor: colors.light.card,
    borderRadius: radii.xl,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.light.border,
    gap: 4,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.olive[50],
    marginBottom: 4,
  },
  statValue: { fontFamily: fontFamilies.mono.semibold, color: colors.light.foreground },
  statLabel: { color: colors.light.mutedForeground, fontSize: typography.fontSizes.xs },
  empty: {
    alignItems: "center",
    backgroundColor: colors.light.card,
    borderRadius: radii["2xl"],
    padding: spacing[8],
    borderWidth: 1,
    borderColor: colors.light.border,
    gap: spacing[3],
  },
  emptyIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.olive[50],
  },
  list: { gap: 12, marginBottom: spacing[4] },
  addressCard: {
    backgroundColor: colors.light.card,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: colors.light.border,
    flexDirection: "row",
    overflow: "hidden",
    ...shadows.soft,
  },
  typeStripe: { width: 4, backgroundColor: colors.light.primary },
  addressBody: { flex: 1, padding: 14, gap: 4 },
  addressHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  typeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  typeIcon: {
    width: 24,
    height: 24,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.olive[50],
  },
  typeLabel: {
    color: colors.light.mutedForeground,
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
    letterSpacing: 0.6,
  },
  actionRow: { flexDirection: "row", gap: 4 },
  iconBtn: {
    width: 28,
    height: 28,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.olive[50],
  },
  addressName: { fontWeight: typography.fontWeights.semibold, color: colors.light.foreground },
  addressLine: { lineHeight: 16 },
  addressFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
  },
  setDefaultBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.olive[50],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  setDefaultText: {
    color: colors.olive[700],
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
  },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    backgroundColor: colors.light.card,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: colors.olive[200],
    borderStyle: "dashed",
    padding: spacing[4],
  },
  addRowIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.olive[50],
  },
  addRowTitle: { fontWeight: typography.fontWeights.semibold, color: colors.light.foreground },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: colors.light.card,
    borderTopLeftRadius: radii["3xl"],
    borderTopRightRadius: radii["3xl"],
    padding: spacing[5],
    paddingBottom: spacing[6],
    maxHeight: "92%",
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.light.border,
    alignSelf: "center",
    marginBottom: spacing[3],
  },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing[4] },
  modalKicker: { color: colors.light.mutedForeground, marginBottom: 2 },
  modalClose: {
    width: 32,
    height: 32,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.olive[50],
  },
  modalBody: { marginBottom: spacing[4] },
  fieldGroup: { color: colors.light.mutedForeground, marginBottom: spacing[2] },
  typeChips: { flexDirection: "row", gap: 8, marginBottom: 6 },
  typeChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: radii.lg,
    backgroundColor: colors.olive[50],
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  typeChipActive: { backgroundColor: colors.light.primary, borderColor: colors.light.primary },
  typeChipText: { color: colors.light.foreground, fontFamily: fontFamilies.mono.medium, fontSize: typography.fontSizes.xs },
  typeChipTextActive: { color: colors.light.primaryForeground },
  typeCopy: { marginBottom: spacing[4], marginTop: 2 },
  field: { gap: 6, marginBottom: spacing[3] },
  fieldLabel: { color: colors.light.mutedForeground },
  input: {
    backgroundColor: colors.paper.cream,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.light.foreground,
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.base,
  },
  rowFields: { flexDirection: "row", gap: 10 },
  defaultRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
    backgroundColor: colors.olive[50],
    borderRadius: radii.lg,
    marginTop: spacing[2],
  },
  defaultLabel: { fontWeight: typography.fontWeights.semibold },
  modalFooter: {
    flexDirection: "row",
    gap: 10,
    paddingTop: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
  },
});
