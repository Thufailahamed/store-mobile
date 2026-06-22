import React from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { colors, radii, typography } from "@/lib/theme/tokens";

export interface VariantDraft {
  key: string;
  id?: string;
  sku: string;
  size: string;
  color: string;
  price: string;
  stock: string;
}

type Props = {
  variants: VariantDraft[];
  basePrice: string;
  onChange: (variants: VariantDraft[]) => void;
};

function variantLabel(v: VariantDraft, index: number): string {
  const parts = [v.size, v.color].filter(Boolean);
  return parts.length > 0 ? parts.join(" / ") : `Variant ${index + 1}`;
}

export function createEmptyVariant(key?: string): VariantDraft {
  return {
    key: key ?? `variant-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    sku: "",
    size: "One Size",
    color: "",
    price: "",
    stock: "0",
  };
}

export function ProductVariantsSection({ variants, basePrice, onChange }: Props) {
  const updateVariant = (key: string, patch: Partial<VariantDraft>) => {
    onChange(variants.map((v) => (v.key === key ? { ...v, ...patch } : v)));
  };

  const removeVariant = (key: string) => {
    if (variants.length <= 1) return;
    onChange(variants.filter((v) => v.key !== key));
  };

  const addVariant = () => {
    onChange([...variants, createEmptyVariant()]);
  };

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Variants & stock</Text>
          <Text style={styles.subtitle}>Size, color, SKU, and quantity per SKU</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={addVariant} activeOpacity={0.85}>
          <Ionicons name="add" size={16} color={colors.light.primaryForeground} />
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      {variants.map((variant, index) => (
        <View key={variant.key} style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{variantLabel(variant, index)}</Text>
            {variants.length > 1 ? (
              <TouchableOpacity onPress={() => removeVariant(variant.key)} hitSlop={8}>
                <Ionicons name="trash-outline" size={18} color={colors.light.destructive} />
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.row}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Size</Text>
              <TextInput
                style={styles.input}
                value={variant.size}
                onChangeText={(size) => updateVariant(variant.key, { size })}
                placeholder="S, M, L…"
                placeholderTextColor={colors.light.mutedForeground}
              />
            </View>
            <View style={{ width: 10 }} />
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Color</Text>
              <TextInput
                style={styles.input}
                value={variant.color}
                onChangeText={(color) => updateVariant(variant.key, { color })}
                placeholder="Black, Navy…"
                placeholderTextColor={colors.light.mutedForeground}
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>SKU</Text>
              <TextInput
                style={styles.input}
                value={variant.sku}
                onChangeText={(sku) => updateVariant(variant.key, { sku })}
                placeholder="Optional"
                placeholderTextColor={colors.light.mutedForeground}
                autoCapitalize="characters"
              />
            </View>
            <View style={{ width: 10 }} />
            <View style={[styles.field, { flex: 0.7 }]}>
              <Text style={styles.label}>Stock</Text>
              <TextInput
                style={styles.input}
                value={variant.stock}
                onChangeText={(stock) => updateVariant(variant.key, { stock })}
                placeholder="0"
                keyboardType="number-pad"
                placeholderTextColor={colors.light.mutedForeground}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Variant price (optional)</Text>
            <TextInput
              style={styles.input}
              value={variant.price}
              onChangeText={(price) => updateVariant(variant.key, { price })}
              placeholder={basePrice ? `Defaults to Rs. ${basePrice}` : "Uses product price"}
              keyboardType="numeric"
              placeholderTextColor={colors.light.mutedForeground}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 20 },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 10,
    gap: 12,
  },
  title: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold as any,
    color: colors.light.foreground,
  },
  subtitle: {
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    marginTop: 2,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.light.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.full,
  },
  addBtnText: {
    fontSize: typography.fontSizes.xs,
    color: colors.light.primaryForeground,
    fontWeight: typography.fontWeights.semibold as any,
  },
  card: {
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.lg,
    padding: 12,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold as any,
    color: colors.light.foreground,
  },
  row: { flexDirection: "row" },
  field: { marginBottom: 10 },
  label: {
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    marginBottom: 4,
    fontWeight: typography.fontWeights.medium as any,
  },
  input: {
    backgroundColor: colors.light.background,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.md,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: typography.fontSizes.sm,
    color: colors.light.foreground,
  },
});
