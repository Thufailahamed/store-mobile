import React from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { colors, radii, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

export interface LinkFieldProps {
  value: { url?: string; label?: string };
  onChange: (v: { url?: string; label?: string }) => void;
  schema: { label?: string };
}

export function LinkField({ value, onChange, schema }: LinkFieldProps) {
  return (
    <View style={styles.wrap}>
      {schema.label ? <Text style={styles.label}>{schema.label}</Text> : null}
      <TextInput
        value={value?.label ?? ""}
        onChangeText={(label) => onChange({ ...value, label })}
        placeholder="Link label"
        accessibilityLabel="Link label"
        style={styles.input}
      />
      <TextInput
        value={value?.url ?? ""}
        onChangeText={(url) => onChange({ ...value, url })}
        placeholder="https://"
        autoCapitalize="none"
        keyboardType="url"
        accessibilityLabel="Link URL"
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginVertical: spacing[2], gap: spacing[1] },
  label: { fontFamily: fontFamilies.sans.medium, fontSize: typography.fontSizes.sm, color: colors.light.foreground, marginBottom: spacing[1] },
  input: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    color: colors.light.foreground,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    backgroundColor: colors.light.background,
  },
});
