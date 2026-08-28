import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { colors, radii, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

export interface SelectFieldProps {
  value: string;
  onChange: (v: string) => void;
  schema: { label?: string; options: Array<{ value: string; label: string }> };
}

export function SelectField({ value, onChange, schema }: SelectFieldProps) {
  return (
    <View style={styles.wrap}>
      {schema.label ? <Text style={styles.label}>{schema.label}</Text> : null}
      <View style={styles.row}>
        {schema.options.map((o) => (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: value === o.value }}
            accessibilityLabel={o.label}
            style={[styles.chip, value === o.value && styles.chipActive]}
          >
            <Text style={[styles.chipText, value === o.value && styles.chipTextActive]}>{o.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginVertical: spacing[2] },
  label: { fontFamily: fontFamilies.sans.medium, fontSize: typography.fontSizes.sm, color: colors.light.foreground, marginBottom: spacing[1] },
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2] },
  chip: { paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radii.full, borderWidth: 1, borderColor: colors.light.border },
  chipActive: { borderColor: colors.light.primary, backgroundColor: colors.light.primary + "15" },
  chipText: { fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.sm, color: colors.light.foreground },
  chipTextActive: { fontFamily: fontFamilies.sans.medium, color: colors.light.primary },
});
