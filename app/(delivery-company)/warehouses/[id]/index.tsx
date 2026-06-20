import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import {
  WarehouseFormFields,
  warehouseFormFromApi,
  warehousePayloadFromForm,
  type WarehouseFormValues,
} from "@/components/warehouse/WarehouseFormFields";
import {
  deleteWarehouse,
  getDeliveryCompanyWarehouse,
  hasStoreApi,
  updateWarehouse,
  type DcWarehouse,
} from "@/lib/api/delivery-company-api";
import { colors, typography, radii } from "@/lib/theme/tokens";

export default function WarehouseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [warehouse, setWarehouse] = useState<DcWarehouse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState<WarehouseFormValues | null>(null);
  const [isActive, setIsActive] = useState(true);

  const fetchData = useCallback(async () => {
    if (!id || !hasStoreApi()) {
      setLoading(false);
      return;
    }
    try {
      const res = await getDeliveryCompanyWarehouse(id);
      if (res.ok) {
        setWarehouse(res.data.warehouse);
        setForm(warehouseFormFromApi(res.data.warehouse));
        setIsActive(res.data.warehouse.is_active !== false);
      }
    } catch (err) {
      console.warn("[warehouse detail] fetch failed", err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const save = async () => {
    if (!id || !form || saving) return;
    if (!form.postal_code.trim()) {
      Alert.alert("Missing postal code", "Enter a valid postal code for the hub address.");
      return;
    }
    setSaving(true);
    try {
      const payload = warehousePayloadFromForm(form);
      const res = await updateWarehouse(id, {
        ...payload,
        latitude: payload.latitude,
        longitude: payload.longitude,
        is_active: isActive,
      });
      if (!res.ok) Alert.alert("Save failed", res.error);
      else {
        Alert.alert("Saved", "Warehouse updated.");
        fetchData();
      }
    } finally {
      setSaving(false);
    }
  };

  const remove = () => {
    if (!id || deleting) return;
    Alert.alert("Delete warehouse", "Only empty hubs can be deleted.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setDeleting(true);
          try {
            const res = await deleteWarehouse(id);
            if (!res.ok) Alert.alert("Failed", res.error);
            else router.back();
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.light.primary} />
      </View>
    );
  }

  if (!warehouse || !form) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Warehouse" />
        <View style={styles.center}>
          <Text style={styles.muted}>Warehouse not found.</Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScreenHeader title="Edit warehouse" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {warehouse.routing_warnings && warehouse.routing_warnings.length > 0 ? (
          <View style={styles.warnBox}>
            {warehouse.routing_warnings.map((w) => (
              <Text key={w} style={styles.warnText}>• {w}</Text>
            ))}
          </View>
        ) : warehouse.routing_ready ? (
          <View style={styles.okBox}>
            <Text style={styles.okText}>Routing ready — nearest-hub pickup can use this hub.</Text>
          </View>
        ) : null}

        <WarehouseFormFields
          values={form}
          onChange={(patch) => setForm((f) => (f ? { ...f, ...patch } : f))}
        />

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Active</Text>
          <Switch value={isActive} onValueChange={setIsActive} trackColor={{ true: colors.light.primary }} />
        </View>

        <TouchableOpacity style={[styles.saveBtn, saving && styles.disabled]} onPress={save} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={[styles.deleteBtn, deleting && styles.disabled]} onPress={remove} disabled={deleting}>
          {deleting ? (
            <ActivityIndicator color="#dc2626" />
          ) : (
            <Text style={styles.deleteText}>Delete warehouse</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  content: { padding: 16, paddingBottom: 40 },
  warnBox: {
    backgroundColor: "#fff7ed",
    borderRadius: radii.lg,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#fed7aa",
    gap: 4,
  },
  warnText: { fontSize: typography.fontSizes.xs, color: "#9a3412" },
  okBox: {
    backgroundColor: "#f0fdf4",
    borderRadius: radii.lg,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  okText: { fontSize: typography.fontSizes.xs, color: "#166534" },
  switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  switchLabel: { fontWeight: typography.fontWeights.medium },
  saveBtn: {
    backgroundColor: colors.light.primary,
    paddingVertical: 14,
    borderRadius: radii.lg,
    alignItems: "center",
    marginBottom: 12,
  },
  saveText: { color: "#fff", fontWeight: typography.fontWeights.semibold },
  disabled: { opacity: 0.6 },
  deleteBtn: { paddingVertical: 14, alignItems: "center" },
  deleteText: { color: "#dc2626", fontWeight: typography.fontWeights.medium },
  muted: { color: colors.light.mutedForeground },
});
