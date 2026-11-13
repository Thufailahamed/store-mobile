import React, { useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
} from "react-native";
import { AddressMapPicker } from "@/components/address/AddressMapPicker";
import { isWarehouseGeocoded } from "@/lib/warehouse-routing";
import { colors, typography, radii } from "@/lib/theme/tokens";

export interface WarehouseFormValues {
  name: string;
  line1: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  capacity_max: string;
  latitude: number | null;
  longitude: number | null;
}

interface WarehouseFormFieldsProps {
  values: WarehouseFormValues;
  onChange: (patch: Partial<WarehouseFormValues>) => void;
  showCapacity?: boolean;
}

export function emptyWarehouseForm(): WarehouseFormValues {
  return {
    name: "",
    line1: "",
    city: "",
    state: "",
    postal_code: "",
    country: "Sri Lanka",
    capacity_max: "500",
    latitude: null,
    longitude: null,
  };
}

export function warehouseFormFromApi(wh: {
  name: string;
  address?: Record<string, string> | null;
  capacity_max?: number;
  latitude?: number | null;
  longitude?: number | null;
}): WarehouseFormValues {
  return {
    name: wh.name,
    line1: wh.address?.line1 ?? "",
    city: wh.address?.city ?? "",
    state: wh.address?.state ?? "",
    postal_code: wh.address?.postal_code ?? "",
    country: wh.address?.country ?? "Sri Lanka",
    capacity_max: String(wh.capacity_max ?? 500),
    latitude: wh.latitude ?? null,
    longitude: wh.longitude ?? null,
  };
}

export function warehousePayloadFromForm(form: WarehouseFormValues) {
  const postal = form.postal_code.trim();
  return {
    name: form.name.trim(),
    address: {
      line1: form.line1.trim(),
      city: form.city.trim(),
      state: form.state.trim() || form.city.trim(),
      postal_code: postal,
      country: form.country.trim() || "Sri Lanka",
    },
    capacity_max: parseInt(form.capacity_max, 10) || 500,
    latitude: form.latitude,
    longitude: form.longitude,
  };
}

export function WarehouseFormFields({ values, onChange, showCapacity = true }: WarehouseFormFieldsProps) {
  const handleMapChange = useCallback(
    (lat: number, lng: number) => onChange({ latitude: lat, longitude: lng }),
    [onChange],
  );

  const geocoded = isWarehouseGeocoded(values);

  return (
    <View>
      <Field label="Name" value={values.name} onChange={(v) => onChange({ name: v })} />
      <Text style={styles.mapLabel}>Pin hub location (required for nearest-warehouse routing)</Text>
      <AddressMapPicker
        latitude={values.latitude}
        longitude={values.longitude}
        onLocationChange={handleMapChange}
        height={180}
      />
      {geocoded ? (
        <Text style={styles.coordsOk}>
          Coordinates set · {values.latitude!.toFixed(5)}, {values.longitude!.toFixed(5)}
        </Text>
      ) : (
        <Text style={styles.coordsWarn}>
          No coordinates — pickup orders will not route to the nearest hub.
        </Text>
      )}

      <Field label="Address line" value={values.line1} onChange={(v) => onChange({ line1: v })} />
      <Field label="City" value={values.city} onChange={(v) => onChange({ city: v })} />
      <Field label="State / district" value={values.state} onChange={(v) => onChange({ state: v })} />
      <Field label="Postal code" value={values.postal_code} onChange={(v) => onChange({ postal_code: v })} />
      {showCapacity ? (
        <Field
          label="Capacity max (packages)"
          value={values.capacity_max}
          onChange={(v) => onChange({ capacity_max: v })}
          keyboardType="numeric"
        />
      ) : null}
    </View>
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
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.fieldInput}
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType}
        placeholderTextColor={colors.light.mutedForeground}
      />
    </View>
  );
}

const styles = StyleSheet.create({
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
  detectBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.light.primary,
    marginBottom: 12,
  },
  detectText: { fontSize: typography.fontSizes.sm, color: colors.light.primary, fontWeight: typography.fontWeights.medium },
  mapLabel: {
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    marginBottom: 6,
  },
  geoRow: { flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 6 },
  geoText: { fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground },
  coordsOk: { fontSize: typography.fontSizes.xs, color: "#166534", marginBottom: 12 },
  coordsWarn: { fontSize: typography.fontSizes.xs, color: "#ea580c", marginBottom: 12 },
});
