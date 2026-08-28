import React from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { colors, radii, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

export interface ColorFieldProps {
  value: string;
  onChange: (v: string) => void;
  schema: { label?: string; presets?: string[] };
}

const PRESET_COLORS = ["#000000", "#FFFFFF", "#535E2C", "#A86F4C", "#7A1F1F", "#1B2A4E"];

function contrastRatio(hex: string): number {
  const rgb = hex.replace("#", "").match(/.{2}/g)?.map((c) => parseInt(c, 16)) ?? [0, 0, 0];
  const lum = (r: number, g: number, b: number) => {
    const t = (c: number) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * t(r) + 0.7152 * t(g) + 0.0722 * t(b);
  };
  const L = lum(rgb[0], rgb[1], rgb[2]) + 0.05;
  return Math.min(L / 0.05, 0.05 / L);
}

export function ColorField({ value, onChange, schema }: ColorFieldProps) {
  const presets = schema.presets ?? PRESET_COLORS;
  const safeHex = /^#[0-9a-fA-F]{6}$/.test(value ?? "") ? value : "#000000";
  const ratio = contrastRatio(safeHex);

  return (
    <View style={styles.wrap}>
      {schema.label ? <Text style={styles.label}>{schema.label}</Text> : null}
      <View style={styles.row}>
        <TextInput
          value={value ?? ""}
          onChangeText={(v) => onChange(v.startsWith("#") ? v : `#${v}`)}
          maxLength={7}
          placeholder="#000000"
          autoCapitalize="none"
          accessibilityLabel="Color hex value"
          style={styles.input}
        />
        <View style={[styles.swatch, { backgroundColor: safeHex }]} accessibilityLabel={`Color preview ${safeHex}`} />
        <Text style={styles.ratio}>contrast {ratio.toFixed(2)}:1 {ratio < 4.5 ? "⚠" : "✓"}</Text>
      </View>
      <View style={styles.presets}>
        {presets.map((c) => (
          <Pressable key={c} onPress={() => onChange(c)} accessibilityLabel={`Use color ${c}`} style={[styles.preset, { backgroundColor: c }, value === c && styles.presetActive]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginVertical: spacing[2] },
  label: { fontFamily: fontFamilies.sans.medium, fontSize: typography.fontSizes.sm, color: colors.light.foreground, marginBottom: spacing[1] },
  row: { flexDirection: "row", alignItems: "center", gap: spacing[2] },
  input: {
    flex: 1, fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.sm, color: colors.light.foreground,
    borderWidth: 1, borderColor: colors.light.border, borderRadius: radii.md, paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    backgroundColor: colors.light.background,
  },
  swatch: { width: 36, height: 36, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.light.border },
  ratio: { fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground },
  presets: { flexDirection: "row", gap: spacing[1], marginTop: spacing[2], flexWrap: "wrap" },
  preset: { width: 32, height: 32, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.light.border },
  presetActive: { borderWidth: 3, borderColor: colors.light.primary },
});
