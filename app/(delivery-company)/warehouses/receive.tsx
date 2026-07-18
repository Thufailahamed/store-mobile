import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import {
  getDeliveryCompanyMe,
  getDeliveryCompanyWarehouses,
  hasStoreApi,
  lookupDeliveryCompanyOrder,
  receiveAtWarehouse,
  type DcWarehouse,
} from "@/lib/api/delivery-company-api";
import { useAuth } from "@/lib/supabase/auth";
import { useCompanyRealtime } from "@/lib/hooks/useCompanyRealtime";
import { canReceiveAtWarehouse } from "@/lib/warehouse-routing";
import { colors, typography, radii } from "@/lib/theme/tokens";

function warehouseCapacityLabel(w: DcWarehouse): string {
  const inv = w.inventory_count ?? 0;
  const cap = w.capacity_max;
  if (cap == null) return `${inv} in hub`;
  return `${inv}/${cap}`;
}

export default function WarehouseReceiveScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ warehouseId?: string; orderId?: string }>();
  const { user } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [warehouses, setWarehouses] = useState<DcWarehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState<string | null>(params.warehouseId ?? null);
  const [orderRef, setOrderRef] = useState(params.orderId ?? "");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!hasStoreApi()) {
      setLoading(false);
      return;
    }
    const res = await getDeliveryCompanyWarehouses();
    if (res.ok) {
      const active = res.data.warehouses.filter((w) => w.is_active !== false);
      setWarehouses(active);
      setWarehouseId((prev) => prev ?? params.warehouseId ?? active[0]?.id ?? null);
    }
    const meRes = await getDeliveryCompanyMe();
    if (meRes.ok) setCompanyId(meRes.data.company.id);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useCompanyRealtime(companyId, user?.id, load);

  const selectedWarehouse = warehouses.find((w) => w.id === warehouseId) ?? null;
  const receiveBlocked =
    selectedWarehouse &&
    !canReceiveAtWarehouse(
      selectedWarehouse.inventory_count ?? 0,
      selectedWarehouse.capacity_max,
    ).ok;

  const commitReceive = async (whId: string, orderId: string, orderNumber: string) => {
    setSubmitting(true);
    try {
      const res = await receiveAtWarehouse(whId, orderId);
      if (!res.ok) {
        Alert.alert("Receive failed", res.error);
        return;
      }
      const lastMileNote = res.data.last_mile_error
        ? `\n\nAuto last-mile: ${res.data.last_mile_error.replace(/_/g, " ")}`
        : "";
      Alert.alert("Received", `Package recorded at hub (#${orderNumber}).${lastMileNote}`, [
        { text: "Receive another", onPress: () => setOrderRef("") },
        { text: "Done", onPress: () => router.back() },
      ]);
    } finally {
      setSubmitting(false);
    }
  };

  const submit = async () => {
    if (submitting) return;
    if (!warehouseId) {
      Alert.alert("Select hub", "Choose a warehouse to receive into.");
      return;
    }
    const trimmed = orderRef.trim();
    if (!trimmed) {
      Alert.alert("Order required", "Enter an order number or ID to receive.");
      return;
    }
    setSubmitting(true);
    const lookup = await lookupDeliveryCompanyOrder(trimmed).finally(() => setSubmitting(false));
    if (!lookup.ok) {
      Alert.alert("Order lookup failed", lookup.error);
      return;
    }
    // Confirm before committing — the dispatcher should see which real order
    // the reference resolved to (a typo'd order ref can still match a valid,
    // but wrong, order) before the receive is recorded.
    const warehouseName = selectedWarehouse?.name ?? "the selected hub";
    Alert.alert(
      "Confirm receive",
      `Order #${lookup.data.order_number}\nStatus: ${lookup.data.status.replace(/_/g, " ")}\nHub: ${warehouseName}\n\nReceive this package?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Receive",
          onPress: () => {
            void commitReceive(warehouseId, lookup.data.order_id, lookup.data.order_number);
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.light.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Receive at hub" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.help}>
          Record a package arrival using the order number or ID. This uses the delivery company receive API
          (not the driver scan flow).
        </Text>

        {warehouses.length === 0 ? (
          <Text style={styles.muted}>Create an active warehouse before receiving packages.</Text>
        ) : (
          <>
            <Text style={styles.label}>Warehouse</Text>
            <View style={styles.chips}>
              {warehouses.map((w) => {
                const full =
                  w.capacity_max != null &&
                  (w.inventory_count ?? 0) >= w.capacity_max;
                return (
                  <TouchableOpacity
                    key={w.id}
                    style={[
                      styles.chip,
                      warehouseId === w.id && styles.chipActive,
                      full && styles.chipFull,
                    ]}
                    onPress={() => setWarehouseId(w.id)}
                  >
                    <Text style={[styles.chipText, warehouseId === w.id && styles.chipTextActive]}>
                      {w.name} ({warehouseCapacityLabel(w)})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {receiveBlocked ? (
              <Text style={styles.capacityWarn}>
                Selected hub is at capacity. Dispatch packages before receiving more.
              </Text>
            ) : null}

            <Text style={styles.label}>Order number or ID</Text>
            <TextInput
              style={styles.input}
              value={orderRef}
              onChangeText={setOrderRef}
              placeholder="ORD-12345 or paste UUID"
              placeholderTextColor={colors.light.mutedForeground}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TouchableOpacity
              style={[styles.submit, (submitting || receiveBlocked) && styles.disabled]}
              onPress={submit}
              disabled={submitting || Boolean(receiveBlocked)}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitText}>Receive package</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  content: { padding: 16, paddingBottom: 40, gap: 8 },
  help: {
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
    lineHeight: 20,
    marginBottom: 8,
  },
  label: {
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    marginTop: 8,
    marginBottom: 4,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.light.card,
  },
  chipActive: {
    borderColor: colors.light.primary,
    backgroundColor: "#f0fdf4",
  },
  chipFull: { borderColor: "#fca5a5", backgroundColor: "#fef2f2" },
  capacityWarn: { fontSize: typography.fontSizes.xs, color: "#dc2626", marginTop: 4 },
  chipText: { fontSize: typography.fontSizes.sm, color: colors.light.foreground },
  chipTextActive: { color: colors.light.primary, fontWeight: typography.fontWeights.semibold },
  input: {
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.lg,
    padding: 12,
    fontSize: typography.fontSizes.base,
    color: colors.light.foreground,
    backgroundColor: colors.light.card,
  },
  submit: {
    marginTop: 16,
    backgroundColor: colors.light.primary,
    paddingVertical: 14,
    borderRadius: radii.lg,
    alignItems: "center",
  },
  submitText: { color: "#fff", fontWeight: typography.fontWeights.semibold },
  disabled: { opacity: 0.6 },
  muted: { color: colors.light.mutedForeground, fontSize: typography.fontSizes.sm },
});
