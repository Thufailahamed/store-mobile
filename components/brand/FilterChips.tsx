import React from "react";
import { ScrollView, StyleSheet, type ViewStyle } from "react-native";
import { Chip } from "@/components/ui/Chip";

interface FilterChipsProps<T extends string> {
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (next: T) => void;
  style?: ViewStyle;
}

export function FilterChips<T extends string>({ value, options, onChange, style }: FilterChipsProps<T>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.row, style]}
    >
      {options.map((opt) => (
        <Chip key={opt.value} selected={value === opt.value} onPress={() => onChange(opt.value)}>
          {opt.label}
        </Chip>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingHorizontal: 20, paddingVertical: 8 },
});
