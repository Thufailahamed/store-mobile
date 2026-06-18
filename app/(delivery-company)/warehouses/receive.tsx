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
import { useRouter } from "expo-router";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import {
  getDeliveryCompanyWarehouses,
  hasStoreApi,
  receiveAtWarehouse,
  type DcWarehouse,
} from "@/lib/api/delivery-company-api";
import { colors, typography, radii } from "@/lib/theme/tokens";

export default function WarehouseReceiveScreen() {
  const router = useRouter();
  const [warehouses, setWarehouses] = useState<DcWarehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState<string | null>(null);
  const [orderId, setOrderId] = useState("");
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
      setWarehouseId((prev) => prev ?? active[0]?.id ?? null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    if (!warehouseId) {
      Alert.alert("Select hub", "Choose a warehouse to receive into.");
      return;
    }
    const trimmed = orderId.trim();
    if (!trimmed) {
      Alert.alert("Order required", "Enter the order ID to receive.");
      return;
    }
    setSubmitting(true);
    const res = await receiveAtWarehouse(warehouseId, trimmed);
    setSubmitting(false);
    if (!res.ok) {
      Alert.alert("Receive failed", res.error);
      return;
    }
    Alert.alert("Received", "Package recorded at the hub.", [
      { text: "Receive another", onPress: () => setOrderId("") },
      { text: "Done", onPress: () => router.back() },
    ]);
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
          Record a package arrival using the order ID. This uses the delivery company receive API
          (not the driver scan flow).
        </Text>

        {warehouses.length === 0 ? (
          <Text style={styles.muted}>Create an active warehouse before receiving packages.</Text>
        ) : (
          <>
            <Text style={styles.label}>Warehouse</Text>
            <View style={styles.chips}>
              {warehouses.map((w) => (
                <TouchableOpacity
                  key={w.id}
                  style={[styles.chip, warehouseId === w.id && styles.chipActive]}
                  onPress={() => setWarehouseId(w.id)}
                >
                  <Text style={[styles.chipText, warehouseId === w.id && styles.chipTextActive]}>
                    {w.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Order ID</Text>
            <TextInput
              style={styles.input}
              value={orderId}
              onChangeText={setOrderId}
              placeholder="Paste order UUID"
              placeholderTextColor={colors.light.mutedForeground}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TouchableOpacity
              style={[styles.submit, submitting && styles.disabled]}
              onPress={submit}
              disabled={submitting}
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
