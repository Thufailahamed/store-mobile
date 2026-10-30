import React, { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, type LayoutChangeEvent } from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { colors, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { EditorCard, Field, Input, editorStyles, INK, CREAM, RUST, GOLD, OK_GREEN, FIELD_BG } from "./product-editor/primitives";
import { SIZE_PRESETS, SIZE_SYSTEM_LABELS, DEFAULT_SIZES, type SizeSystem } from "@/lib/size-presets";

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
  lowStockThreshold?: number;
  /** Apparel letters vs UK shoe sizes vs one-size — set from the category. */
  sizeSystem?: SizeSystem;
  /** Called when the seller picks another size system in the builder. */
  onSizeSystemChange?: (system: SizeSystem) => void;
  onLayout?: (e: LayoutChangeEvent) => void;
};

// Same option sets as the web editor (store/src/lib/size-presets.ts).
export const QUICK_SIZES = SIZE_PRESETS.apparel;
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

function variantLabel(v: VariantDraft, index: number): string {
  const parts = [v.size, v.color].filter(Boolean);
  return parts.length > 0 ? parts.join(" / ") : `Variant ${index + 1}`;
}

const comboKey = (size: string, color: string) => `${size.trim().toLowerCase()}|${color.trim().toLowerCase()}`;

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

const uniqueValues = (values: string[]) => Array.from(new Set(values.filter(Boolean)));
const sameValues = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));
const KNOWN_SIZES = new Set<string>(Object.values(SIZE_PRESETS).flat());

export function ProductVariantsSection({
  variants,
  basePrice,
  onChange,
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
  const [builderOpen, setBuilderOpen] = useState(false);
  // Start from the sizes and colours the product already has, so opening a
  // saved product doesn't read as a fresh selection.
  const [initialPick] = useState(() => ({
    sizes: uniqueValues(variants.map((v) => v.size.trim())),
    colors: uniqueValues(variants.map((v) => v.color.trim())),
  }));
  const [pickSizes, setPickSizes] = useState<string[]>(initialPick.sizes);
  const [pickColors, setPickColors] = useState<string[]>(initialPick.colors);
  const prevPick = useRef(initialPick);
  // Rows the seller deleted stay gone until its size or colour is picked again.
  const deletedCombos = useRef(new Set<string>());
  const [defaultStock, setDefaultStock] = useState("10");
  const [bulkStock, setBulkStock] = useState("");

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
    const target = variants.find((v) => v.key === key);
    if (target) deletedCombos.current.add(comboKey(target.size, target.color));
    onChange(variants.filter((v) => v.key !== key));
  };

  // Custom sizes the seller typed (e.g. 15 or 15.5) sit after the presets.
  const [customSizes, setCustomSizes] = useState<string[]>(() =>
    initialPick.sizes.filter((s) => !KNOWN_SIZES.has(s)),
  );
  const [customSize, setCustomSize] = useState("");
  const presetSizes = SIZE_PRESETS[sizeSystem];
  const sizeChips = [...presetSizes, ...customSizes.filter((s) => !presetSizes.includes(s))];

  const addCustomSize = () => {
    const v = customSize.trim().replace(/\s+/g, " ");
    setCustomSize("");
    if (!v) return;
    const existing = sizeChips.find((s) => s.toLowerCase() === v.toLowerCase());
    if (existing) {
      setPickSizes((p) => (p.includes(existing) ? p : [...p, existing]));
      return;
    }
    setCustomSizes((c) => [...c, v]);
    setPickSizes((p) => [...p, v]);
  };
  const newSizeDefault =
    DEFAULT_SIZES[sizeSystem][1] ?? DEFAULT_SIZES[sizeSystem][0];

  const addVariant = () => {
    const draft = { ...createEmptyVariant(), size: newSizeDefault };
    setExpanded((prev) => new Set(prev).add(draft.key));
    onChange([...variants, draft]);
  };

  // Rows follow the picked sizes × colours as the seller picks them, like the web
  // editor. Only a change to the picks reconciles rows, so a saved product keeps
  // every row it already has.
  useEffect(() => {
    const prev = prevPick.current;
    if (sameValues(prev.sizes, pickSizes) && sameValues(prev.colors, pickColors)) return;
    prevPick.current = { sizes: pickSizes, colors: pickColors };

    const droppedSizes = prev.sizes.filter((s) => !pickSizes.includes(s));
    const droppedColors = prev.colors.filter((c) => !pickColors.includes(c));
    // Deselecting a size or colour also forgets the rows deleted under it.
    for (const key of Array.from(deletedCombos.current)) {
      const [size, color] = key.split("|");
      const sizeDropped = droppedSizes.some((s) => s.toLowerCase() === size);
      const colorDropped = droppedColors.some((c) => c.toLowerCase() === color);
      if (sizeDropped || colorDropped) deletedCombos.current.delete(key);
    }

    const kept = variants.filter(
      (v) => !droppedSizes.includes(v.size) && !droppedColors.includes(v.color),
    );
    const present = new Set(kept.map((v) => comboKey(v.size, v.color)));
    const stock = String(Math.max(0, Number(defaultStock) || 0));
    const added: VariantDraft[] = [];
    for (const s of pickSizes) {
      for (const c of pickColors) {
        const key = comboKey(s, c);
        if (present.has(key) || deletedCombos.current.has(key)) continue;
        present.add(key);
        added.push({
          ...createEmptyVariant(`variant-${Date.now()}-${added.length}-${Math.random().toString(36).slice(2, 5)}`),
          size: s,
          color: c,
          colorHex: QUICK_COLORS.find((x) => x.name === c)?.hex ?? "",
          stock,
        });
      }
    }
    if (added.length || droppedSizes.length || droppedColors.length) {
      onChange([...kept, ...added]);
    }
  }, [pickSizes, pickColors, variants, defaultStock, onChange]);

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

  return (
    <EditorCard
      icon="layers-outline"
      title="Variants & stock"
      hint={`${variants.length} variant${variants.length === 1 ? "" : "s"} · ${totalStock} units`}
      required
      onLayout={onLayout}
      action={
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
      }
    >
      {/* Stock health */}
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

      {/* Quick builder */}
      <TouchableOpacity
        style={[styles.builderToggle, builderOpen && styles.builderToggleOpen]}
        onPress={() => setBuilderOpen((v) => !v)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityState={{ expanded: builderOpen }}
      >
        <View style={styles.builderIcon}>
          <Ionicons name="color-wand-outline" size={16} color={CREAM} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.builderTitle}>Quick add sizes & colours</Text>
          <Text style={styles.builderHint}>Pick options — we’ll create every combination</Text>
        </View>
        <Ionicons name={builderOpen ? "chevron-up" : "chevron-down"} size={18} color={colors.olive[800]} />
      </TouchableOpacity>

      {builderOpen ? (
        <View style={styles.builder}>
          <Text style={editorStyles.subLabel}>Size system</Text>
          <View style={styles.systemRow}>
            {(Object.keys(SIZE_PRESETS) as SizeSystem[]).map((sys) => {
              const active = sys === sizeSystem;
              return (
                <TouchableOpacity
                  key={sys}
                  style={[styles.systemChip, active && styles.systemChipOn]}
                  onPress={() => {
                    // Picks from the old system no longer match the chips.
                    setPickSizes([]);
                    onSizeSystemChange?.(sys);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.systemText, active && styles.systemTextOn]}>
                    {SIZE_SYSTEM_LABELS[sys]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[editorStyles.subLabel, { marginTop: 14 }]}>Sizes</Text>
          <View style={styles.sizeRow}>
            {sizeChips.map((s) => {
              const on = pickSizes.includes(s);
              return (
                <TouchableOpacity
                  key={s}
                  style={[styles.sizeChip, styles.sizeChipWrap, on && styles.sizeChipOn]}
                  onPress={() => setPickSizes((p) => (on ? p.filter((x) => x !== s) : [...p, s]))}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
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
              style={styles.customInput}
              accessibilityLabel="Add a custom size"
            />
            <TouchableOpacity
              style={[styles.customAdd, !customSize.trim() && styles.customAddDisabled]}
              onPress={addCustomSize}
              disabled={!customSize.trim()}
              accessibilityRole="button"
            >
              <Text style={styles.customAddText}>Add size</Text>
            </TouchableOpacity>
          </View>

          <Text style={[editorStyles.subLabel, { marginTop: 16 }]}>Colours</Text>
          <View style={styles.colorGrid}>
            {QUICK_COLORS.map((c) => {
              const on = pickColors.includes(c.name);
              return (
                <TouchableOpacity
                  key={c.name}
                  style={styles.colorCell}
                  onPress={() => setPickColors((p) => (on ? p.filter((x) => x !== c.name) : [...p, c.name]))}
                  accessibilityRole="button"
                  accessibilityLabel={c.name}
                  accessibilityState={{ selected: on }}
                >
                  <View style={[styles.colorRing, on && styles.colorRingOn]}>
                    <View style={[styles.colorDot, { backgroundColor: c.hex }]}>
                      {on ? (
                        <Ionicons
                          name="checkmark"
                          size={15}
                          color={["White", "Sand", "Beige", "Pink"].includes(c.name) ? INK : "#FFFFFF"}
                        />
                      ) : null}
                    </View>
                  </View>
                  <Text style={[styles.colorName, on && styles.colorNameOn]}>{c.name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.builderFoot}>
            <View style={{ width: 110 }}>
              <Text style={styles.miniLabel}>Stock each</Text>
              <TextInput
                style={styles.miniInput}
                value={defaultStock}
                onChangeText={setDefaultStock}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={colors.light.mutedForeground}
              />
            </View>
            <Text style={styles.builderHintText}>
              {pickSizes.length && pickColors.length
                ? "Rows update as you pick. New rows use this stock."
                : "Pick a size and a colour to add rows."}
            </Text>
          </View>
        </View>
      ) : null}

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
              {/* Inline stepper so stock can be tuned without expanding */}
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
                  <Field label="Size" style={{ flex: 1, marginBottom: 12 }}>
                    <Input
                      value={variant.size}
                      onChangeText={(size) => updateVariant(variant.key, { size })}
                      placeholder="S, M, L…"
                    />
                  </Field>
                  <Field label="Colour" style={{ flex: 1, marginBottom: 12 }}>
                    <Input
                      value={variant.color}
                      onChangeText={(color) => {
                        const preset = QUICK_COLORS.find((c) => c.name.toLowerCase() === color.trim().toLowerCase());
                        updateVariant(variant.key, preset && !variant.colorHex ? { color, colorHex: preset.hex } : { color });
                      }}
                      placeholder="Black, Navy…"
                    />
                  </Field>
                </View>

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

                <Text style={styles.miniLabel}>Swatch colour</Text>
                <View style={styles.swatchRow}>
                  {QUICK_COLORS.map((c) => {
                    const on = variant.colorHex.toLowerCase() === c.hex.toLowerCase();
                    return (
                      <TouchableOpacity
                        key={c.hex}
                        onPress={() =>
                          updateVariant(variant.key, { colorHex: c.hex, color: variant.color || c.name })
                        }
                        style={[styles.swatchPick, on && styles.swatchPickOn]}
                        accessibilityLabel={c.name}
                        accessibilityState={{ selected: on }}
                      >
                        <View style={[styles.swatchPickDot, { backgroundColor: c.hex }]} />
                      </TouchableOpacity>
                    );
                  })}
                  <Input
                    mono
                    value={variant.colorHex}
                    onChangeText={(colorHex) => updateVariant(variant.key, { colorHex })}
                    placeholder="#000000"
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={styles.hexInput}
                  />
                </View>

                <View style={[editorStyles.row, { marginTop: 12 }]}>
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

                {(
                  <TouchableOpacity
                    style={styles.removeBtn}
                    onPress={() => removeVariant(variant.key)}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${variantLabel(variant, index)}`}
                  >
                    <Ionicons name="trash-outline" size={15} color={RUST} />
                    <Text style={styles.removeBtnText}>Remove variant</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : null}
          </View>
        );
      })}
    </EditorCard>
  );
}

const styles = StyleSheet.create({
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.olive[50],
    paddingLeft: 10,
    paddingRight: 14,
    minHeight: 36,
    borderRadius: radii.full,
  },
  addBtnText: { fontSize: 14, color: colors.olive[900], fontFamily: fontFamilies.sans.semibold },

  health: { padding: 12, borderRadius: 14, backgroundColor: FIELD_BG, gap: 9, marginBottom: 12 },
  healthTop: { flexDirection: "row", alignItems: "center", gap: 6 },
  healthText: { flex: 1, fontFamily: fontFamilies.sans.semibold, fontSize: 13 },
  healthTotal: { fontFamily: fontFamilies.sans.medium, fontSize: 12, color: colors.ink.mute, fontVariant: ["tabular-nums"] },
  healthTrack: { height: 5, borderRadius: 3, backgroundColor: "rgba(83,94,44,0.1)", overflow: "hidden" },
  healthFill: { height: "100%", borderRadius: 3 },

  builderToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(83,94,44,0.3)",
    marginBottom: 12,
  },
  builderToggleOpen: { borderStyle: "solid", backgroundColor: colors.olive[50], borderColor: "rgba(83,94,44,0.2)", marginBottom: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  builderIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: colors.olive[900], alignItems: "center", justifyContent: "center" },
  builderTitle: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: INK },
  builderHint: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.light.mutedForeground, marginTop: 1 },
  builder: {
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: "rgba(83,94,44,0.2)",
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    backgroundColor: "#FFFFFF",
  },
  sizeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  sizeChipWrap: { flex: 0, minWidth: 56, paddingHorizontal: 10 },
  systemRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  systemChip: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "rgba(22,23,15,0.12)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  systemChipOn: { backgroundColor: INK, borderColor: INK },
  systemText: { fontFamily: fontFamilies.sans.semibold, fontSize: 12.5, color: "rgba(22,23,15,0.65)" },
  systemTextOn: { color: CREAM },
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
  customAddDisabled: { opacity: 0.4 },
  builderHintText: { flex: 1, fontFamily: fontFamilies.sans.regular, fontSize: 12.5, lineHeight: 17, color: "rgba(22,23,15,0.6)" },
  customAddText: { fontFamily: fontFamilies.sans.semibold, fontSize: 13, color: "rgba(22,23,15,0.7)" },
  sizeChip: {
    flex: 1,
    minWidth: 0,
    height: 42,
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
  colorGrid: { flexDirection: "row", flexWrap: "wrap", rowGap: 12 },
  colorCell: { width: "16.66%", alignItems: "center", gap: 5 },
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
  builderFoot: { flexDirection: "row", alignItems: "flex-end", gap: 10, marginTop: 18 },
  miniLabel: { fontFamily: fontFamilies.sans.medium, fontSize: 12, color: colors.olive[900], marginBottom: 6 },
  miniInput: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.14)",
    backgroundColor: FIELD_BG,
    paddingHorizontal: 12,
    fontFamily: fontFamilies.sans.medium,
    fontSize: 15,
    color: INK,
    fontVariant: ["tabular-nums"],
  },
  generateBtn: {
    flex: 1,
    height: 46,
    borderRadius: radii.full,
    backgroundColor: colors.olive[900],
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  generateText: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: CREAM },

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
  swatchRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
  swatchPick: { padding: 2, borderRadius: 14, borderWidth: 1.5, borderColor: "transparent" },
  swatchPickOn: { borderColor: colors.olive[700] },
  swatchPickDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: "rgba(22,23,15,0.12)" },
  hexInput: { flexGrow: 1, minWidth: 100, minHeight: 40, height: 40, marginTop: 4 },
  removeBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 44, marginTop: 4 },
  removeBtnText: { fontFamily: fontFamilies.sans.semibold, fontSize: 13, color: RUST },
});
