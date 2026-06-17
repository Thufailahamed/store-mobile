import React, { useCallback, useEffect, useState } from "react";
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
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import {
  deleteWarehouse,
  getDeliveryCompanyWarehouses,
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
  const [name, setName] = useState("");
  const [line1, setLine1] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postal, setPostal] = useState("");
  const [capacity, setCapacity] = useState("500");
  const [isActive, setIsActive] = useState(true);

  const fetchData = useCallback(async () => {
    if (!id || !hasStoreApi()) return;
    const res = await getDeliveryCompanyWarehouses();
    if (res.ok) {
      const wh = res.data.warehouses.find((w) => w.id === id) ?? null;
      setWarehouse(wh);
      if (wh) {
        setName(wh.name);
        setLine1(wh.address?.line1 ?? "");
        setCity(wh.address?.city ?? "");
        setState(wh.address?.state ?? "");
        setPostal(wh.address?.postal_code ?? "");
        setCapacity(String(wh.capacity_max ?? 500));
        setIsActive(wh.is_active !== false);
      }
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const save = async () => {
    if (!id) return;
    setSaving(true);
    const res = await updateWarehouse(id, {
      name: name.trim(),
      address: {
        line1: line1.trim(),
        city: city.trim(),
        state: state.trim() || city.trim(),
        postal_code: postal.trim() || "00000",
        country: "Sri Lanka",
      },
      capacity_max: parseInt(capacity, 10) || 500,
      is_active: isActive,
    });
    setSaving(false);
    if (!res.ok) Alert.alert("Save failed", res.error);
    else {
      Alert.alert("Saved", "Warehouse updated.");
      fetchData();
    }
  };

  const remove = () => {
    if (!id) return;
    Alert.alert("Delete warehouse", "Only empty hubs can be deleted.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const res = await deleteWarehouse(id);
          if (!res.ok) Alert.alert("Failed", res.error);
          else router.back();
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

  if (!warehouse) {
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
        <Field label="Name" value={name} onChange={setName} />
        <Field label="Address" value={line1} onChange={setLine1} />
        <Field label="City" value={city} onChange={setCity} />
        <Field label="State / district" value={state} onChange={setState} />
        <Field label="Postal code" value={postal} onChange={setPostal} />
        <Field label="Capacity max" value={capacity} onChange={setCapacity} keyboardType="numeric" />

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Active</Text>
          <Switch value={isActive} onValueChange={setIsActive} trackColor={{ true: colors.light.primary }} />
        </View>

        <TouchableOpacity style={[styles.saveBtn, saving && styles.disabled]} onPress={save} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteBtn} onPress={remove}>
          <Text style={styles.deleteText}>Delete warehouse</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  value,
  onChange,
  keyboardType,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  keyboardType?: "default" | "numeric";
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} value={value} onChangeText={onChange} keyboardType={keyboardType} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  content: { padding: 16, paddingBottom: 40 },
  field: { marginBottom: 12 },
  label: { fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.lg,
    padding: 12,
    backgroundColor: colors.light.card,
  },
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
