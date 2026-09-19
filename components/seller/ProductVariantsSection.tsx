import React from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { colors, radii, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

export interface VariantDraft {
  key: string;
  id?: string;
  sku: string;
  size: string;
  color: string;
  colorHex: string;
  material: string;
  pattern: string;
  fit: string;
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
    colorHex: "",
    material: "",
    pattern: "",
    fit: "",
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
        <View style={styles.headerTitleRow}>
          <View style={styles.headerIcon}>
            <Ionicons name="git-branch-outline" size={17} color={colors.olive[800]} />
          </View>
          <View>
            <Text style={styles.kicker}>STOCK ROOM</Text>
            <Text style={styles.title}>Variants</Text>
            <Text style={styles.subtitle}>{variants.length} variant{variants.length === 1 ? "" : "s"} · size, colour and stock</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={addVariant} activeOpacity={0.85}>
          <Ionicons name="add" size={16} color={colors.paper.cream} />
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
              <View style={styles.colorRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={variant.color}
                  onChangeText={(color) => updateVariant(variant.key, { color })}
                  placeholder="Black, Navy…"
                  placeholderTextColor={colors.light.mutedForeground}
                />
                {variant.colorHex ? (
                  <View style={[styles.colorSwatch, { backgroundColor: variant.colorHex }]} />
                ) : null}
              </View>
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Color hex</Text>
              <TextInput
                style={styles.input}
                value={variant.colorHex}
                onChangeText={(colorHex) => updateVariant(variant.key, { colorHex })}
                placeholder="#000000"
                placeholderTextColor={colors.light.mutedForeground}
                autoCapitalize="none"
              />
            </View>
            <View style={{ width: 10 }} />
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Material</Text>
              <TextInput
                style={styles.input}
                value={variant.material}
                onChangeText={(material) => updateVariant(variant.key, { material })}
                placeholder="Cotton…"
                placeholderTextColor={colors.light.mutedForeground}
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Pattern</Text>
              <TextInput
                style={styles.input}
                value={variant.pattern}
                onChangeText={(pattern) => updateVariant(variant.key, { pattern })}
                placeholder="Solid…"
                placeholderTextColor={colors.light.mutedForeground}
              />
            </View>
            <View style={{ width: 10 }} />
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Fit</Text>
              <TextInput
                style={styles.input}
                value={variant.fit}
                onChangeText={(fit) => updateVariant(variant.key, { fit })}
                placeholder="Slim…"
                placeholderTextColor={colors.light.mutedForeground}
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>SKU</Text>
              <TextInput
                style={[styles.input, styles.mono]}
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
                style={[styles.input, styles.mono]}
                value={variant.stock}
                onChangeText={(stock) => updateVariant(variant.key, { stock })}
                placeholder="0"
                keyboardType="number-pad"
                placeholderTextColor={colors.light.mutedForeground}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>SKU price (optional)</Text>
            <TextInput
              style={[styles.input, styles.mono]}
              value={variant.price}
              onChangeText={(price) => updateVariant(variant.key, { price })}
              placeholder={basePrice ? `Defaults to LKR ${basePrice}` : "Uses selling price"}
              keyboardType="numeric"
              placeholderTextColor={colors.light.mutedForeground}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

const CREAM = colors.paper.cream;
const INK = colors.olive[950];

const styles = StyleSheet.create({
  section: { marginBottom: 16, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "rgba(83,94,44,0.12)", borderRadius: 22, padding: 16 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    gap: 10,
  },
  headerTitleRow: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10 },
  headerIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.olive[50], alignItems: "center", justifyContent: "center" },
  kicker: { fontFamily: fontFamilies.mono.semibold, fontSize: 8, letterSpacing: 1.1, color: colors.olive[600] },
  title: { fontFamily: fontFamilies.display.semibold, fontSize: 18, color: INK, marginTop: 2 },
  subtitle: { fontFamily: fontFamilies.sans.regular, fontSize: 10, color: colors.light.mutedForeground, marginTop: 2 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.olive[900],
    paddingHorizontal: 12,
    minHeight: 36,
    borderRadius: radii.full,
  },
  addBtnText: {
    fontSize: typography.fontSizes.xs,
    color: CREAM,
    fontFamily: fontFamilies.sans.semibold,
  },
  card: {
    backgroundColor: "#FAF9F5",
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.12)",
    borderRadius: 17,
    padding: 13,
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
    fontFamily: fontFamilies.display.semibold,
    color: INK,
  },
  row: { flexDirection: "row" },
  field: { marginBottom: 10 },
  label: {
    fontSize: 10,
    color: colors.olive[800],
    marginBottom: 4,
    fontFamily: fontFamilies.sans.medium,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.14)",
    borderRadius: 13,
    paddingHorizontal: 12,
    minHeight: 46,
    fontSize: typography.fontSizes.sm,
    fontFamily: fontFamilies.sans.regular,
    color: INK,
  },
  mono: { fontFamily: fontFamilies.mono.regular },
  colorRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  colorSwatch: {
    width: 22,
    height: 22,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.18)",
  },
});
