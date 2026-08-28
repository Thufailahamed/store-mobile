import React from "react";
import { TextInput, View, Text, StyleSheet } from "react-native";
import { colors, radii, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

export interface TextFieldProps {
  value: string;
  onChange: (v: string) => void;
  schema: { label?: string; multiline?: boolean; maxLength?: number; placeholder?: string };
}

export function TextField({ value, onChange, schema }: TextFieldProps) {
  return (
    <View style={styles.wrap}>
      {schema.label ? <Text style={styles.label}>{schema.label}</Text> : null}
      <TextInput
        value={value ?? ""}
        onChangeText={onChange}
        multiline={schema.multiline ?? false}
        maxLength={schema.maxLength}
        placeholder={schema.placeholder ?? ""}
        accessibilityLabel={schema.label ?? "Text field"}
        style={[styles.input, schema.multiline ? styles.multiline : null]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginVertical: spacing[2] },
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
  multiline: { minHeight: 80, textAlignVertical: "top" },
});
