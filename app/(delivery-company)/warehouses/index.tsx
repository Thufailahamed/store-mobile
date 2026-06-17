import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import {
  createWarehouse,
  getDeliveryCompanyWarehouses,
  hasStoreApi,
  type DcWarehouse,
} from "@/lib/api/delivery-company-api";
import { colors, typography, radii } from "@/lib/theme/tokens";

export default function CompanyWarehousesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [warehouses, setWarehouses] = useState<DcWarehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    line1: "",
    city: "",
    state: "",
    postal_code: "",
  });

  const load = useCallback(async () => {
    if (!hasStoreApi()) {
      setError("EXPO_PUBLIC_STORE_API_URL is not configured");
      setLoading(false);
      setRefreshing(false);
      return;
    }
    const res = await getDeliveryCompanyWarehouses();
    if (res.ok) setWarehouses(res.data.warehouses);
    else setError(res.error);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    if (!form.name.trim() || !form.line1.trim() || !form.city.trim()) {
      Alert.alert("Missing fields", "Name, address line, and city are required.");
      return;
    }
    setSaving(true);
    const res = await createWarehouse({
      name: form.name.trim(),
      address: {
        line1: form.line1.trim(),
        city: form.city.trim(),
        state: form.state.trim() || form.city.trim(),
        postal_code: form.postal_code.trim() || "00000",
        country: "Sri Lanka",
      },
    });
    setSaving(false);
    if (!res.ok) {
      Alert.alert("Could not create hub", res.error);
      return;
    }
    setCreateOpen(false);
    setForm({ name: "", line1: "", city: "", state: "", postal_code: "" });
    load();
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Warehouses"
        right={
          <TouchableOpacity onPress={() => setCreateOpen(true)} style={styles.addBtn}>
            <Ionicons name="add" size={24} color={colors.light.primary} />
          </TouchableOpacity>
        }
      />
      <TouchableOpacity style={styles.scanLink} onPress={() => router.push("/(delivery)/scan")}>
        <Ionicons name="qr-code-outline" size={18} color={colors.light.primary} />
        <Text style={styles.scanLinkText}>Scan to receive packages at hub</Text>
      </TouchableOpacity>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.light.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={warehouses}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="storefront-outline" size={40} color={colors.light.mutedForeground} />
              <Text style={styles.emptyTitle}>No hubs yet</Text>
              <Text style={styles.emptySub}>Create a warehouse to start receiving packages.</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => setCreateOpen(true)}>
                <Text style={styles.emptyBtnText}>Add warehouse</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => router.push(`/(delivery-company)/warehouses/${item.id}` as any)} activeOpacity={0.85}>
              <WarehouseRow warehouse={item} />
            </TouchableOpacity>
          )}
        />
      )}

      <Modal visible={createOpen} animationType="slide" transparent onRequestClose={() => setCreateOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New warehouse</Text>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Field label="Name" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
              <Field label="Address line" value={form.line1} onChange={(v) => setForm((f) => ({ ...f, line1: v }))} />
              <Field label="City" value={form.city} onChange={(v) => setForm((f) => ({ ...f, city: v }))} />
              <Field label="State / district" value={form.state} onChange={(v) => setForm((f) => ({ ...f, state: v }))} />
              <Field label="Postal code" value={form.postal_code} onChange={(v) => setForm((f) => ({ ...f, postal_code: v }))} />
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setCreateOpen(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={handleCreate} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.modalSaveText}>Create</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.fieldInput}
        value={value}
        onChangeText={onChange}
        placeholderTextColor={colors.light.mutedForeground}
      />
    </View>
  );
}

function WarehouseRow({ warehouse }: { warehouse: DcWarehouse }) {
  const addr = warehouse.address;
  const line = addr
    ? [addr.line1, addr.city, addr.postal_code].filter(Boolean).join(", ")
    : "No address";

  return (
    <View style={[styles.card, warehouse.is_active === false && styles.cardInactive]}>
      <View style={styles.iconWrap}>
        <Ionicons name="storefront-outline" size={22} color={colors.light.primary} />
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.name}>{warehouse.name}</Text>
        <Text style={styles.addr}>{line}</Text>
        {warehouse.capacity_max != null ? (
          <Text style={styles.cap}>Capacity: {warehouse.capacity_max}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  addBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  scanLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    backgroundColor: "#f0fdf4",
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  scanLinkText: { fontSize: typography.fontSizes.sm, color: colors.light.primary, fontWeight: typography.fontWeights.medium },
  card: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: colors.light.card,
    borderRadius: radii.lg,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  cardInactive: { opacity: 0.6 },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.light.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: { flex: 1 },
  name: { fontSize: typography.fontSizes.base, fontWeight: typography.fontWeights.semibold, color: colors.light.foreground },
  addr: { fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground, marginTop: 4 },
  cap: { fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground, marginTop: 6 },
  empty: { alignItems: "center", paddingTop: 48, gap: 8 },
  emptyTitle: { fontSize: typography.fontSizes.lg, fontWeight: typography.fontWeights.semibold },
  emptySub: { fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground, textAlign: "center", paddingHorizontal: 32 },
  emptyBtn: {
    marginTop: 12,
    backgroundColor: colors.light.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: radii.lg,
  },
  emptyBtnText: { color: "#fff", fontWeight: typography.fontWeights.semibold },
  errorText: { fontSize: typography.fontSizes.sm, color: "#dc2626", textAlign: "center" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalCard: {
    backgroundColor: colors.light.card,
    borderTopLeftRadius: radii["2xl"],
    borderTopRightRadius: radii["2xl"],
    padding: 20,
    maxHeight: "85%",
  },
  modalTitle: { fontSize: typography.fontSizes.lg, fontWeight: typography.fontWeights.bold, marginBottom: 16 },
  field: { marginBottom: 12 },
  fieldLabel: { fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground, marginBottom: 4 },
  fieldInput: {
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: typography.fontSizes.base,
    color: colors.light.foreground,
    backgroundColor: colors.light.background,
  },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 16 },
  modalCancel: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: radii.lg,
    backgroundColor: colors.light.muted,
  },
  modalCancelText: { fontWeight: typography.fontWeights.semibold, color: colors.light.foreground },
  modalSave: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: radii.lg,
    backgroundColor: colors.light.primary,
  },
  modalSaveText: { fontWeight: typography.fontWeights.semibold, color: "#fff" },
});
