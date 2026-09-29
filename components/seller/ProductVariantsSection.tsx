import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { colors, radii } from "@/lib/theme/tokens";
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
  // Single-variant products open straight into the form; multi-variant
  // products start as a compact summary list so stock is scannable.
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(variants.length === 1 ? [variants[0].key] : []),
  );

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const updateVariant = (key: string, patch: Partial<VariantDraft>) => {
    onChange(variants.map((v) => (v.key === key ? { ...v, ...patch } : v)));
  };

  const removeVariant = (key: string) => {
    if (variants.length <= 1) return;
    onChange(variants.filter((v) => v.key !== key));
  };

  const addVariant = () => {
    const draft = createEmptyVariant();
    setExpanded((prev) => new Set(prev).add(draft.key));
    onChange([...variants, draft]);
  };

  const totalStock = variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Variants & stock</Text>
          <Text style={styles.subtitle}>
            {variants.length} variant{variants.length === 1 ? "" : "s"} · {totalStock} in stock
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={addVariant}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Add variant"
        >
          <Ionicons name="add" size={16} color={colors.olive[900]} />
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      {variants.map((variant, index) => {
        const open = expanded.has(variant.key);
        const stock = Number(variant.stock) || 0;
        const priceLabel = variant.price ? `LKR ${variant.price}` : basePrice ? `LKR ${basePrice}` : "Base price";
        return (
          <View key={variant.key} style={[styles.card, open && styles.cardOpen]}>
            <TouchableOpacity
              style={styles.cardHeader}
              onPress={() => toggle(variant.key)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityState={{ expanded: open }}
              accessibilityLabel={`${variantLabel(variant, index)}, ${stock} in stock`}
            >
              {variant.colorHex ? (
                <View style={[styles.colorSwatch, { backgroundColor: variant.colorHex }]} />
              ) : null}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.cardTitle} numberOfLines={1}>{variantLabel(variant, index)}</Text>
                <Text style={styles.cardMeta} numberOfLines={1}>
                  {priceLabel}{variant.sku ? ` · ${variant.sku}` : ""}
                </Text>
              </View>
              <View style={[styles.stockBadge, stock === 0 && styles.stockBadgeOut]}>
                <Text style={[styles.stockBadgeText, stock === 0 && styles.stockBadgeTextOut]}>
                  {stock === 0 ? "Out" : `${stock} left`}
                </Text>
              </View>
              <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.olive[800]} />
            </TouchableOpacity>

            {open ? (
              <View style={styles.cardBody}>
                <View style={styles.row}>
                  <Field label="Size" style={{ flex: 1 }}>
                    <TextInput
                      style={styles.input}
                      value={variant.size}
                      onChangeText={(size) => updateVariant(variant.key, { size })}
                      placeholder="S, M, L…"
                      placeholderTextColor={colors.light.mutedForeground}
                    />
                  </Field>
                  <Field label="Colour" style={{ flex: 1 }}>
                    <TextInput
                      style={styles.input}
                      value={variant.color}
                      onChangeText={(color) => updateVariant(variant.key, { color })}
                      placeholder="Black, Navy…"
                      placeholderTextColor={colors.light.mutedForeground}
                    />
                  </Field>
                </View>

                <View style={styles.row}>
                  <Field label="Stock" style={{ flex: 1 }}>
                    <TextInput
                      style={[styles.input, styles.numeric]}
                      value={variant.stock}
                      onChangeText={(value) => updateVariant(variant.key, { stock: value })}
                      placeholder="0"
                      keyboardType="number-pad"
                      placeholderTextColor={colors.light.mutedForeground}
                    />
                  </Field>
                  <Field label="Price override" style={{ flex: 1 }}>
                    <TextInput
                      style={[styles.input, styles.numeric]}
                      value={variant.price}
                      onChangeText={(price) => updateVariant(variant.key, { price })}
                      placeholder={basePrice ? `LKR ${basePrice}` : "Selling price"}
                      keyboardType="numeric"
                      placeholderTextColor={colors.light.mutedForeground}
                    />
                  </Field>
                </View>

                <View style={styles.row}>
                  <Field label="Variant SKU" style={{ flex: 1 }}>
                    <TextInput
                      style={[styles.input, styles.mono]}
                      value={variant.sku}
                      onChangeText={(sku) => updateVariant(variant.key, { sku })}
                      placeholder="Optional"
                      placeholderTextColor={colors.light.mutedForeground}
                      autoCapitalize="characters"
                      autoCorrect={false}
                    />
                  </Field>
                  <Field label="Colour hex" style={{ flex: 1 }}>
                    <TextInput
                      style={[styles.input, styles.mono]}
                      value={variant.colorHex}
                      onChangeText={(colorHex) => updateVariant(variant.key, { colorHex })}
                      placeholder="#000000"
                      placeholderTextColor={colors.light.mutedForeground}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </Field>
                </View>

                <View style={styles.row}>
                  <Field label="Material" style={{ flex: 1 }}>
                    <TextInput
                      style={styles.input}
                      value={variant.material}
                      onChangeText={(material) => updateVariant(variant.key, { material })}
                      placeholder="Cotton…"
                      placeholderTextColor={colors.light.mutedForeground}
                    />
                  </Field>
                  <Field label="Pattern" style={{ flex: 1 }}>
                    <TextInput
                      style={styles.input}
                      value={variant.pattern}
                      onChangeText={(pattern) => updateVariant(variant.key, { pattern })}
                      placeholder="Solid…"
                      placeholderTextColor={colors.light.mutedForeground}
                    />
                  </Field>
                </View>

                <Field label="Fit">
                  <TextInput
                    style={styles.input}
                    value={variant.fit}
                    onChangeText={(fit) => updateVariant(variant.key, { fit })}
                    placeholder="Slim, regular…"
                    placeholderTextColor={colors.light.mutedForeground}
                  />
                </Field>

                {variants.length > 1 ? (
                  <TouchableOpacity
                    style={styles.removeBtn}
                    onPress={() => removeVariant(variant.key)}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${variantLabel(variant, index)}`}
                  >
                    <Ionicons name="trash-outline" size={15} color={colors.accent2.rust} />
                    <Text style={styles.removeBtnText}>Remove variant</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function Field({
  label,
  style,
  children,
}: {
  label: string;
  style?: object;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const INK = colors.olive[950];

const styles = StyleSheet.create({
  section: { marginBottom: 14, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "rgba(83,94,44,0.12)", borderRadius: 22, padding: 16 },
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14, gap: 10 },
  headerCopy: { flex: 1, minWidth: 0, gap: 3 },
  title: { fontFamily: fontFamilies.display.semibold, fontSize: 19, color: INK },
  subtitle: { fontFamily: fontFamilies.sans.regular, fontSize: 13, color: colors.light.mutedForeground },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.olive[50],
    paddingLeft: 10,
    paddingRight: 14,
    minHeight: 38,
    borderRadius: radii.full,
  },
  addBtnText: { fontSize: 14, color: colors.olive[900], fontFamily: fontFamilies.sans.semibold },
  card: {
    backgroundColor: "#FAF9F5",
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.12)",
    borderRadius: 16,
    marginBottom: 8,
    overflow: "hidden",
  },
  cardOpen: { backgroundColor: "#FFFFFF", borderColor: "rgba(83,94,44,0.22)" },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 60, paddingHorizontal: 14, paddingVertical: 10 },
  cardTitle: { fontSize: 15, fontFamily: fontFamilies.sans.semibold, color: INK },
  cardMeta: { fontSize: 12, fontFamily: fontFamilies.sans.regular, color: colors.light.mutedForeground, marginTop: 2 },
  stockBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: radii.full, backgroundColor: colors.olive[50] },
  stockBadgeOut: { backgroundColor: "rgba(184,92,58,0.1)" },
  stockBadgeText: { fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: colors.olive[800] },
  stockBadgeTextOut: { color: colors.accent2.rust },
  cardBody: { paddingHorizontal: 14, paddingBottom: 6, paddingTop: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(83,94,44,0.12)" },
  row: { flexDirection: "row", gap: 10 },
  field: { marginTop: 12 },
  label: { fontSize: 13, color: colors.olive[900], marginBottom: 6, fontFamily: fontFamilies.sans.medium },
  input: {
    backgroundColor: "#FAF9F5",
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.14)",
    borderRadius: 13,
    paddingHorizontal: 12,
    minHeight: 48,
    fontSize: 15,
    fontFamily: fontFamilies.sans.regular,
    color: INK,
  },
  numeric: { fontFamily: fontFamilies.sans.medium, fontVariant: ["tabular-nums"] },
  mono: { fontFamily: fontFamilies.mono.regular, fontSize: 14 },
  colorSwatch: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.18)",
  },
  removeBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 44, marginTop: 8 },
  removeBtnText: { fontFamily: fontFamilies.sans.semibold, fontSize: 13, color: colors.accent2.rust },
});
