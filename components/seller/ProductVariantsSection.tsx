import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, type LayoutChangeEvent } from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { colors, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { EditorCard, Field, Input, editorStyles, INK, CREAM, RUST, GOLD, OK_GREEN, FIELD_BG } from "./product-editor/primitives";
import { SIZE_PRESETS, SIZE_SYSTEM_LABELS, type SizeSystem } from "@/lib/size-presets";

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

/** The one colour the product comes in. Every size row uses it. */
export interface VariantColor {
  name: string;
  hex: string;
}

type Props = {
  variants: VariantDraft[];
  basePrice: string;
  onChange: (variants: VariantDraft[]) => void;
  color: VariantColor;
  onColorChange: (color: VariantColor) => void;
  lowStockThreshold?: number;
  /** Apparel letters vs UK shoe sizes vs one-size — set from the category. */
  sizeSystem?: SizeSystem;
  /** Called when the seller picks another size system. */
  onSizeSystemChange?: (system: SizeSystem) => void;
  onLayout?: (e: LayoutChangeEvent) => void;
};

// Same option sets as the web editor (store/src/lib/size-presets.ts).
export const QUICK_COLORS = [
  { name: "Black", hex: "#16170f" },
  { name: "White", hex: "#f5f4ef" },
  { name: "Olive", hex: "#535e2c" },
  { name: "Sand", hex: "#cccca0" },
  { name: "Rust", hex: "#b85c3a" },
  { name: "Blue", hex: "#2563EB" },
  { name: "Pink", hex: "#e2a4b8" },
  { name: "Grey", hex: "#7a7a72" },
  { name: "Navy", hex: "#1e3a5f" },
  { name: "Green", hex: "#2d6a4f" },
  { name: "Red", hex: "#c1121f" },
  { name: "Beige", hex: "#d4c5a9" },
] as const;

const FALLBACK_HEX = "#d9d4c5";
const sameText = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const KNOWN_SIZES = new Set<string>(Object.values(SIZE_PRESETS).flat());

function variantLabel(v: VariantDraft, index: number): string {
  const parts = [v.size, v.color].filter(Boolean);
  return parts.length > 0 ? parts.join(" / ") : `Variant ${index + 1}`;
}

/** Hex for a colour: the one the seller/AI gave, else the preset with the same name. */
function resolveHex(c: VariantColor): string {
  if (/^#[0-9a-fA-F]{6}$/.test(c.hex)) return c.hex;
  return QUICK_COLORS.find((x) => sameText(x.name, c.name))?.hex ?? FALLBACK_HEX;
}

const isLightHex = (hex: string) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return false;
  const n = parseInt(m[1], 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 160;
};

export function createEmptyVariant(key?: string): VariantDraft {
  return {
    key: key ?? `variant-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    sku: "",
    size: "",
    color: "",
    colorHex: "",
    material: "",
    pattern: "",
    fit: "",
    price: "",
    stock: "0",
  };
}

export function ProductVariantsSection({
  variants,
  basePrice,
  onChange,
  color,
  onColorChange,
  lowStockThreshold = 5,
  sizeSystem = "apparel",
  onSizeSystemChange,
  onLayout,
}: Props) {
  // Single-variant products open straight into the form; multi-variant
  // products start as a compact summary list so stock is scannable.
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(variants.length === 1 ? [variants[0].key] : []),
  );

  // Custom sizes the seller typed (e.g. 15 or 15.5) sit after the presets.
  const [customSizes, setCustomSizes] = useState<string[]>(() =>
    Array.from(new Set(variants.map((v) => v.size.trim()).filter((s) => s && !KNOWN_SIZES.has(s)))),
  );
  const [customSize, setCustomSize] = useState("");
  const [bulkStock, setBulkStock] = useState("");
  const presetSizes = SIZE_PRESETS[sizeSystem];
  const sizeChips = [...presetSizes, ...customSizes.filter((s) => !presetSizes.includes(s))];
  const hasSize = (size: string) => variants.some((v) => sameText(v.size, size));
  const sizeOrder = (size: string) => {
    const i = sizeChips.findIndex((s) => sameText(s, size));
    return i < 0 ? sizeChips.length : i;
  };

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
    onChange(variants.filter((v) => v.key !== key));
  };

  // One colour per product. Picking another colour recolours the rows; sizes and stock stay.
  const pickColor = (next: VariantColor) => {
    if (sameText(next.name, color.name)) return;
    const hex = resolveHex(next);
    onColorChange({ name: next.name, hex });
    if (variants.length) onChange(variants.map((v) => ({ ...v, color: next.name, colorHex: hex })));
  };

  // A picked size adds one row in the chosen colour. Tapping it again removes that row.
  const toggleSize = (size: string) => {
    if (!color.name) return;
    if (hasSize(size)) {
      onChange(variants.filter((v) => !sameText(v.size, size)));
      return;
    }
    const row = { ...createEmptyVariant(), size, color: color.name, colorHex: resolveHex(color) };
    onChange([...variants, row].sort((a, b) => sizeOrder(a.size) - sizeOrder(b.size)));
  };

  const addCustomSize = () => {
    const v = customSize.trim().replace(/\s+/g, " ");
    setCustomSize("");
    if (!v || !color.name) return;
    const existing = sizeChips.find((s) => sameText(s, v));
    if (existing) {
      if (!hasSize(existing)) toggleSize(existing);
      return;
    }
    setCustomSizes((c) => [...c, v]);
    toggleSize(v);
  };

  const changeSystem = (sys: SizeSystem) => {
    onSizeSystemChange?.(sys);
    // Rows in a size the new system doesn't have are dropped.
    const allowed = [...SIZE_PRESETS[sys], ...customSizes];
    const kept = variants.filter((v) => allowed.some((s) => sameText(s, v.size)));
    if (kept.length !== variants.length) onChange(kept);
  };

  const applyBulkStock = () => {
    const n = Math.max(0, Number(bulkStock) || 0);
    onChange(variants.map((v) => ({ ...v, stock: String(n) })));
    setBulkStock("");
  };

  const totalStock = variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
  const outCount = variants.filter((v) => (Number(v.stock) || 0) === 0).length;
  const lowCount = variants.filter((v) => {
    const s = Number(v.stock) || 0;
    return s > 0 && s <= lowStockThreshold;
  }).length;
  const health: "out" | "low" | "in" = totalStock <= 0 ? "out" : outCount > 0 || lowCount > 0 ? "low" : "in";
  const healthCopy = {
    out: { label: "No stock yet — set quantities below", icon: "close-circle" as const, color: RUST },
    low: {
      label: [outCount ? `${outCount} sold out` : null, lowCount ? `${lowCount} running low` : null].filter(Boolean).join(" · "),
      icon: "alert-circle" as const,
      color: "#8a6d1f",
    },
    in: { label: "All variants in stock", icon: "checkmark-circle" as const, color: OK_GREEN },
  }[health];
  const fillPct = variants.length ? ((variants.length - outCount) / variants.length) * 100 : 0;
  const colorIsPreset = QUICK_COLORS.some((c) => sameText(c.name, color.name));

  return (
    <EditorCard
      icon="layers-outline"
      title="Variants & stock"
      hint={`${variants.length} variant${variants.length === 1 ? "" : "s"} · ${totalStock} units`}
      required
      onLayout={onLayout}
    >
      {/* Stock health */}
      {variants.length > 0 ? (
        <View style={styles.health}>
          <View style={styles.healthTop}>
            <Ionicons name={healthCopy.icon} size={15} color={healthCopy.color} />
            <Text style={[styles.healthText, { color: healthCopy.color }]} numberOfLines={1}>
              {healthCopy.label}
            </Text>
            <Text style={styles.healthTotal}>{totalStock} total</Text>
          </View>
          <View style={styles.healthTrack}>
            <View
              style={[
                styles.healthFill,
                { width: `${fillPct}%`, backgroundColor: health === "in" ? OK_GREEN : health === "low" ? GOLD : RUST },
              ]}
            />
          </View>
        </View>
      ) : null}

      {/* Step 1: colour (single choice) */}
      <Text style={editorStyles.subLabel}>1 · Colour</Text>
      <View style={styles.colorGrid}>
        {QUICK_COLORS.map((c) => (
          <ColorChip
            key={c.name}
            name={c.name}
            hex={c.hex}
            on={sameText(c.name, color.name)}
            onPress={() => pickColor({ name: c.name, hex: c.hex })}
          />
        ))}
        {color.name && !colorIsPreset ? (
          <ColorChip name={color.name} hex={resolveHex(color)} on onPress={() => undefined} />
        ) : null}
      </View>

      {/* Step 2: sizes (each tap adds or removes a row) */}
      <Text style={[editorStyles.subLabel, { marginTop: 18 }]}>2 · Sizes</Text>
      {!color.name ? <Text style={styles.stepHint}>Pick a colour first.</Text> : null}
      <View style={styles.systemRow}>
        {(Object.keys(SIZE_PRESETS) as SizeSystem[]).map((sys) => {
          const active = sys === sizeSystem;
          return (
            <TouchableOpacity
              key={sys}
              style={[styles.systemChip, active && styles.systemChipOn]}
              onPress={() => changeSystem(sys)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.systemText, active && styles.systemTextOn]}>{SIZE_SYSTEM_LABELS[sys]}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={styles.sizeRow}>
        {sizeChips.map((s) => {
          const on = hasSize(s);
          return (
            <TouchableOpacity
              key={s}
              style={[styles.sizeChip, on && styles.sizeChipOn, !color.name && styles.chipDisabled]}
              onPress={() => toggleSize(s)}
              disabled={!color.name}
              accessibilityRole="button"
              accessibilityState={{ selected: on, disabled: !color.name }}
            >
              <Text style={[styles.sizeText, on && styles.sizeTextOn]}>{s}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={styles.customRow}>
        <TextInput
          value={customSize}
          onChangeText={setCustomSize}
          onSubmitEditing={addCustomSize}
          placeholder="Other size, e.g. 15 or 15.5"
          placeholderTextColor="rgba(22,23,15,0.4)"
          maxLength={20}
          returnKeyType="done"
          editable={!!color.name}
          style={styles.customInput}
          accessibilityLabel="Add a custom size"
        />
        <TouchableOpacity
          style={[styles.customAdd, (!customSize.trim() || !color.name) && styles.chipDisabled]}
          onPress={addCustomSize}
          disabled={!customSize.trim() || !color.name}
          accessibilityRole="button"
        >
          <Text style={styles.customAddText}>Add size</Text>
        </TouchableOpacity>
      </View>

      {/* Step 3: stock per size row */}
      {variants.length === 0 ? (
        <Text style={[styles.stepHint, { marginTop: 14 }]}>Each size you pick gets its own row here to enter stock.</Text>
      ) : (
        <>
          <Text style={[editorStyles.subLabel, { marginTop: 18 }]}>3 · Stock per size</Text>
          {variants.length > 1 ? (
            <View style={styles.bulkRow}>
              <Ionicons name="cube-outline" size={15} color={colors.olive[800]} />
              <Text style={styles.bulkLabel}>Set all stock to</Text>
              <TextInput
                style={styles.bulkInput}
                value={bulkStock}
                onChangeText={setBulkStock}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={colors.light.mutedForeground}
              />
              <TouchableOpacity
                style={[styles.bulkApply, !bulkStock && { opacity: 0.4 }]}
                disabled={!bulkStock}
                onPress={applyBulkStock}
                accessibilityRole="button"
              >
                <Text style={styles.bulkApplyText}>Apply</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {variants.map((variant, index) => {
            const open = expanded.has(variant.key);
            const stock = Number(variant.stock) || 0;
            const low = stock > 0 && stock <= lowStockThreshold;
            const priceLabel = variant.price ? `LKR ${variant.price}` : basePrice ? `LKR ${basePrice}` : "Base price";
            const step = (d: number) => updateVariant(variant.key, { stock: String(Math.max(0, stock + d)) });
            return (
              <View key={variant.key} style={[styles.card, open && styles.cardOpen]}>
                <View style={styles.cardHeader}>
                  <TouchableOpacity
                    style={styles.cardHeaderMain}
                    onPress={() => toggle(variant.key)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: open }}
                    accessibilityLabel={`${variantLabel(variant, index)}, ${stock} in stock`}
                  >
                    {variant.colorHex ? (
                      <View style={[styles.colorSwatch, { backgroundColor: variant.colorHex }]} />
                    ) : (
                      <View style={[styles.colorSwatch, styles.sizeSwatch]}>
                        <Text style={styles.sizeSwatchText} numberOfLines={1}>
                          {(variant.size || "—").slice(0, 3)}
                        </Text>
                      </View>
                    )}
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {variantLabel(variant, index)}
                      </Text>
                      <Text style={[styles.cardMeta, stock === 0 ? { color: RUST } : low ? { color: "#8a6d1f" } : null]} numberOfLines={1}>
                        {stock === 0 ? "Sold out" : low ? "Low stock" : priceLabel}
                        {variant.sku ? ` · ${variant.sku}` : ""}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  <View style={styles.stepper}>
                    <TouchableOpacity style={styles.stepBtn} onPress={() => step(-1)} hitSlop={4} accessibilityLabel="Decrease stock">
                      <Ionicons name="remove" size={15} color={colors.olive[900]} />
                    </TouchableOpacity>
                    <TextInput
                      style={styles.stepValue}
                      value={variant.stock}
                      onChangeText={(value) => updateVariant(variant.key, { stock: value.replace(/[^0-9]/g, "") })}
                      keyboardType="number-pad"
                      selectTextOnFocus
                    />
                    <TouchableOpacity style={styles.stepBtn} onPress={() => step(1)} hitSlop={4} accessibilityLabel="Increase stock">
                      <Ionicons name="add" size={15} color={colors.olive[900]} />
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity onPress={() => toggle(variant.key)} hitSlop={8} accessibilityLabel="Edit variant details">
                    <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.olive[800]} />
                  </TouchableOpacity>
                </View>

                {open ? (
                  <View style={styles.cardBody}>
                    <View style={editorStyles.row}>
                      <Field label="Price override" style={{ flex: 1, marginBottom: 12 }}>
                        <Input
                          value={variant.price}
                          onChangeText={(price) => updateVariant(variant.key, { price })}
                          placeholder={basePrice ? `LKR ${basePrice}` : "Selling price"}
                          keyboardType="numeric"
                        />
                      </Field>
                      <Field label="Variant SKU" style={{ flex: 1, marginBottom: 12 }}>
                        <Input
                          mono
                          value={variant.sku}
                          onChangeText={(sku) => updateVariant(variant.key, { sku })}
                          placeholder="Optional"
                          autoCapitalize="characters"
                          autoCorrect={false}
                        />
                      </Field>
                    </View>

                    <View style={editorStyles.row}>
                      <Field label="Material" style={{ flex: 1, marginBottom: 12 }}>
                        <Input
                          value={variant.material}
                          onChangeText={(material) => updateVariant(variant.key, { material })}
                          placeholder="Cotton…"
                        />
                      </Field>
                      <Field label="Pattern" style={{ flex: 1, marginBottom: 12 }}>
                        <Input
                          value={variant.pattern}
                          onChangeText={(pattern) => updateVariant(variant.key, { pattern })}
                          placeholder="Solid…"
                        />
                      </Field>
                    </View>

                    <Field label="Fit" style={{ marginBottom: 8 }}>
                      <Input value={variant.fit} onChangeText={(fit) => updateVariant(variant.key, { fit })} placeholder="Slim, regular…" />
                    </Field>

                    <TouchableOpacity
                      style={styles.removeBtn}
                      onPress={() => removeVariant(variant.key)}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${variantLabel(variant, index)}`}
                    >
                      <Ionicons name="trash-outline" size={15} color={RUST} />
                      <Text style={styles.removeBtnText}>Remove variant</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            );
          })}
        </>
      )}
    </EditorCard>
  );
}

function ColorChip({ name, hex, on, onPress }: { name: string; hex: string; on: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={styles.colorCell}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={name}
      accessibilityState={{ selected: on }}
    >
      <View style={[styles.colorRing, on && styles.colorRingOn]}>
        <View style={[styles.colorDot, { backgroundColor: hex }]}>
          {on ? <Ionicons name="checkmark" size={15} color={isLightHex(hex) ? INK : "#FFFFFF"} /> : null}
        </View>
      </View>
      <Text style={[styles.colorName, on && styles.colorNameOn]} numberOfLines={1}>
        {name}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  health: { padding: 12, borderRadius: 14, backgroundColor: FIELD_BG, gap: 9, marginBottom: 14 },
  healthTop: { flexDirection: "row", alignItems: "center", gap: 6 },
  healthText: { flex: 1, fontFamily: fontFamilies.sans.semibold, fontSize: 13 },
  healthTotal: { fontFamily: fontFamilies.sans.medium, fontSize: 12, color: colors.ink.mute, fontVariant: ["tabular-nums"] },
  healthTrack: { height: 5, borderRadius: 3, backgroundColor: "rgba(83,94,44,0.1)", overflow: "hidden" },
  healthFill: { height: "100%", borderRadius: 3 },

  stepHint: { fontFamily: fontFamilies.sans.regular, fontSize: 12.5, color: "rgba(22,23,15,0.6)", marginBottom: 8 },
  chipDisabled: { opacity: 0.4 },

  colorGrid: { flexDirection: "row", flexWrap: "wrap", rowGap: 10 },
  colorCell: { width: "16.66%", alignItems: "center", gap: 4 },
  colorRing: { padding: 2.5, borderRadius: 22, borderWidth: 2, borderColor: "transparent" },
  colorRingOn: { borderColor: colors.olive[700] },
  colorDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "rgba(22,23,15,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  colorName: { fontFamily: fontFamilies.sans.medium, fontSize: 10.5, color: colors.ink.mute },
  colorNameOn: { color: colors.olive[800], fontFamily: fontFamilies.sans.semibold },

  systemRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  systemChip: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(22,23,15,0.12)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  systemChipOn: { backgroundColor: INK, borderColor: INK },
  systemText: { fontFamily: fontFamilies.sans.semibold, fontSize: 12.5, color: "rgba(22,23,15,0.65)" },
  systemTextOn: { color: CREAM },

  sizeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  sizeChip: {
    minWidth: 56,
    height: 42,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(22,23,15,0.12)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  sizeChipOn: { backgroundColor: INK, borderColor: INK },
  sizeText: { fontFamily: fontFamilies.sans.semibold, fontSize: 13.5, color: "rgba(22,23,15,0.65)" },
  sizeTextOn: { color: CREAM },
  customRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  customInput: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(22,23,15,0.12)",
    paddingHorizontal: 12,
    backgroundColor: "#FFFFFF",
    fontFamily: fontFamilies.sans.regular,
    fontSize: 14,
    color: INK,
  },
  customAdd: {
    height: 42,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(22,23,15,0.12)",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  customAddText: { fontFamily: fontFamilies.sans.semibold, fontSize: 13, color: "rgba(22,23,15,0.7)" },

  bulkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: FIELD_BG,
    marginBottom: 10,
  },
  bulkLabel: { flex: 1, fontFamily: fontFamilies.sans.medium, fontSize: 13, color: colors.olive[900] },
  bulkInput: {
    width: 64,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.18)",
    backgroundColor: "#FFFFFF",
    textAlign: "center",
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14,
    color: INK,
  },
  bulkApply: { height: 36, paddingHorizontal: 14, borderRadius: radii.full, backgroundColor: colors.olive[900], justifyContent: "center" },
  bulkApplyText: { fontFamily: fontFamilies.sans.semibold, fontSize: 13, color: CREAM },

  card: {
    backgroundColor: FIELD_BG,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.12)",
    borderRadius: 16,
    marginBottom: 8,
    overflow: "hidden",
  },
  cardOpen: { backgroundColor: "#FFFFFF", borderColor: "rgba(83,94,44,0.24)" },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 62, paddingLeft: 12, paddingRight: 12 },
  cardHeaderMain: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  cardTitle: { fontSize: 14.5, fontFamily: fontFamilies.sans.semibold, color: INK },
  cardMeta: { fontSize: 12, fontFamily: fontFamilies.sans.regular, color: colors.light.mutedForeground, marginTop: 2 },
  colorSwatch: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: "rgba(83,94,44,0.18)" },
  sizeSwatch: { backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  sizeSwatchText: { fontFamily: fontFamilies.sans.semibold, fontSize: 10, color: colors.olive[900] },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.16)",
    backgroundColor: "#FFFFFF",
    height: 34,
  },
  stepBtn: { width: 30, height: 32, alignItems: "center", justifyContent: "center" },
  stepValue: {
    minWidth: 34,
    paddingHorizontal: 2,
    textAlign: "center",
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14,
    color: INK,
    fontVariant: ["tabular-nums"],
  },
  cardBody: {
    paddingHorizontal: 12,
    paddingBottom: 6,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(83,94,44,0.14)",
  },
  removeBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 44, marginTop: 4 },
  removeBtnText: { fontFamily: fontFamilies.sans.semibold, fontSize: 13, color: RUST },
});
