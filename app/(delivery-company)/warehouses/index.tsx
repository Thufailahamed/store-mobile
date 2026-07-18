import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@/components/ui/Icon";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import {
  WarehouseFormFields,
  emptyWarehouseForm,
  warehousePayloadFromForm,
  type WarehouseFormValues,
} from "@/components/warehouse/WarehouseFormFields";
import {
  createWarehouse,
  getDeliveryCompanyMe,
  getDeliveryCompanyWarehouses,
  hasStoreApi,
  type DcWarehouse,
} from "@/lib/api/delivery-company-api";
import { useAuth } from "@/lib/supabase/auth";
import { useCompanyRealtime } from "@/lib/hooks/useCompanyRealtime";
import { useIsTablet } from "@/lib/hooks/useIsTablet";
import { getDeliveryCompanyAccessState } from "@/lib/delivery-company-access";
import { isWarehouseGeocoded } from "@/lib/warehouse-routing";
import { colors, typography, radii } from "@/lib/theme/tokens";

export default function CompanyWarehousesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const isTablet = useIsTablet();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [warehouses, setWarehouses] = useState<DcWarehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<WarehouseFormValues>(emptyWarehouseForm());
  const [canReceive, setCanReceive] = useState(false);

  const load = useCallback(async () => {
    if (!hasStoreApi()) {
      setError("EXPO_PUBLIC_STORE_API_URL is not configured");
      setLoading(false);
      setRefreshing(false);
      return;
    }
    const me = await getDeliveryCompanyMe();
    if (me.ok) {
      setCanReceive(getDeliveryCompanyAccessState(me.data.company).canUseCompanyTools);
      setCompanyId(me.data.company.id);
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

  useCompanyRealtime(companyId, user?.id, load);

  const routingSummary = useMemo(() => {
    const active = warehouses.filter((w) => w.is_active !== false);
    const ready = active.filter((w) => w.routing_ready).length;
    const geocoded = active.filter((w) => isWarehouseGeocoded(w)).length;
    return { active: active.length, ready, geocoded };
  }, [warehouses]);

  const handleCreate = async () => {
    if (!form.name.trim() || !form.line1.trim() || !form.city.trim()) {
      Alert.alert("Missing fields", "Name, address line, and city are required.");
      return;
    }
    if (!form.postal_code.trim()) {
      Alert.alert("Missing postal code", "Enter a valid postal code for the hub address.");
      return;
    }
    if (!isWarehouseGeocoded(form)) {
      Alert.alert(
        "Coordinates recommended",
        "Without map coordinates, pickup orders cannot route to the nearest hub. Save anyway?",
        [
          { text: "Add location", style: "cancel" },
          {
            text: "Save without coords",
            onPress: () => submitCreate(),
          },
        ],
      );
      return;
    }
    await submitCreate();
  };

  const submitCreate = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const payload = warehousePayloadFromForm(form);
      const res = await createWarehouse({
        ...payload,
        latitude: payload.latitude ?? undefined,
        longitude: payload.longitude ?? undefined,
      });
      if (!res.ok) {
        Alert.alert("Could not create hub", res.error);
        return;
      }
      setCreateOpen(false);
      setForm(emptyWarehouseForm());
      load();
    } finally {
      setSaving(false);
    }
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

      {routingSummary.active > 0 ? (
        <View style={styles.routingBanner}>
          <Ionicons name="navigate-outline" size={16} color={colors.light.primary} />
          <Text style={styles.routingBannerText}>
            {routingSummary.ready}/{routingSummary.active} hubs routing-ready · {routingSummary.geocoded} geocoded
          </Text>
        </View>
      ) : null}

      {canReceive ? (
        <TouchableOpacity
          style={styles.scanLink}
          onPress={() => router.push("/(delivery-company)/warehouses/receive")}
        >
          <Ionicons name="download-outline" size={18} color={colors.light.primary} />
          <Text style={styles.scanLinkText}>Receive package at hub</Text>
        </TouchableOpacity>
      ) : null}

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
          key={isTablet ? "grid-2" : "grid-1"}
          data={warehouses}
          keyExtractor={(item) => item.id}
          numColumns={isTablet ? 2 : 1}
          columnWrapperStyle={isTablet ? styles.columnWrapper : undefined}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="storefront-outline" size={40} color={colors.light.mutedForeground} />
              <Text style={styles.emptyTitle}>No hubs yet</Text>
              <Text style={styles.emptySub}>Create a geocoded warehouse to enable nearest-hub pickup routing.</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => setCreateOpen(true)}>
                <Text style={styles.emptyBtnText}>Add warehouse</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={isTablet ? styles.gridItem : undefined}
              onPress={() => router.push(`/(delivery-company)/warehouses/${item.id}` as any)}
              activeOpacity={0.85}
            >
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
              <WarehouseFormFields
                values={form}
                onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
              />
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

function WarehouseRow({ warehouse }: { warehouse: DcWarehouse }) {
  const addr = warehouse.address;
  const line = addr
    ? [addr.line1, addr.city, addr.postal_code].filter(Boolean).join(", ")
    : "No address";
  const inv = warehouse.inventory_count ?? 0;
  const cap = warehouse.capacity_max;

  return (
    <View style={[styles.card, warehouse.is_active === false && styles.cardInactive]}>
      <View style={styles.iconWrap}>
        <Ionicons name="storefront-outline" size={22} color={colors.light.primary} />
      </View>
      <View style={styles.cardBody}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{warehouse.name}</Text>
          {warehouse.capacity_status === "full" ? (
            <View style={styles.fullPill}>
              <Text style={styles.fullPillText}>Full</Text>
            </View>
          ) : warehouse.capacity_status === "near_full" ? (
            <View style={styles.warnPill}>
              <Text style={styles.warnPillText}>Near full</Text>
            </View>
          ) : warehouse.routing_ready ? (
            <View style={styles.readyPill}>
              <Text style={styles.readyPillText}>Routing ready</Text>
            </View>
          ) : warehouse.is_active !== false ? (
            <View style={styles.warnPill}>
              <Text style={styles.warnPillText}>Setup needed</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.addr}>{line}</Text>
        <Text style={styles.cap}>
          {inv}{cap != null ? `/${cap}` : ""} packages
          {warehouse.pickup_driver_count != null ? ` · ${warehouse.pickup_driver_count} pickup drivers` : ""}
        </Text>
        {!isWarehouseGeocoded(warehouse) && warehouse.is_active !== false ? (
          <Text style={styles.warnLine}>Add map coordinates for nearest-hub routing</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  addBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  routingBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 10,
    backgroundColor: "#eff6ff",
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  routingBannerText: { flex: 1, fontSize: typography.fontSizes.xs, color: colors.light.primary },
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
  columnWrapper: { gap: 12 },
  gridItem: { flex: 1 },
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
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  name: { fontSize: typography.fontSizes.base, fontWeight: typography.fontWeights.semibold, color: colors.light.foreground },
  readyPill: { backgroundColor: "#dcfce7", paddingHorizontal: 8, paddingVertical: 2, borderRadius: radii.full },
  readyPillText: { fontSize: 10, color: "#166534", fontWeight: typography.fontWeights.semibold },
  warnPill: { backgroundColor: "#ffedd5", paddingHorizontal: 8, paddingVertical: 2, borderRadius: radii.full },
  warnPillText: { fontSize: 10, color: "#ea580c", fontWeight: typography.fontWeights.semibold },
  fullPill: { backgroundColor: "#fee2e2", paddingHorizontal: 8, paddingVertical: 2, borderRadius: radii.full },
  fullPillText: { fontSize: 10, color: "#dc2626", fontWeight: typography.fontWeights.semibold },
  addr: { fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground, marginTop: 4 },
  cap: { fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground, marginTop: 6 },
  warnLine: { fontSize: typography.fontSizes.xs, color: "#ea580c", marginTop: 4 },
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
    maxHeight: "90%",
  },
  modalTitle: { fontSize: typography.fontSizes.lg, fontWeight: typography.fontWeights.bold, marginBottom: 16 },
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
