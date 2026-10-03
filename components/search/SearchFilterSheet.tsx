import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  StyleSheet,

  ScrollView,
  TouchableOpacity,
  TextInput,
  useWindowDimensions,
} from "react-native";
import { Modal } from "@/components/ui/Modal";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@/components/ui/Icon";
import { Display, Body } from "@/components/ui/Typography";
import { Button } from "@/components/ui";
import { colors, radii, spacing, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import {
  COLORS,
  SIZES,
  DISCOUNTS,
  SORTS,
  PRICE_PRESETS,
  PRICE_BOUNDS,
  EMPTY_FILTERS,
  activeFilterCount,
} from "@/lib/api/facets";
import type { ProductFilters, OCCASIONS, MATERIALS } from "@/lib/api/facets";
import { OCCASIONS as OCCASION_CHIPS, MATERIALS as MATERIAL_CHIPS } from "@/lib/api/facets";
import { applySearchFilters } from "@/lib/search-filters";
import type { Product } from "@/lib/types";

const GENDERS = [
  { key: "", label: "All" },
  { key: "women", label: "Women" },
  { key: "men", label: "Men" },
  { key: "unisex", label: "Unisex" },
  { key: "kids", label: "Kids" },
];

const RATINGS = [0, 3, 4, 4.5];

interface SearchFilterSheetProps {
  visible: boolean;
  onClose: () => void;
  filters: ProductFilters;
  onApply: (filters: ProductFilters) => void;
  sort: string;
  onSortChange: (sort: string) => void;
  /** Unfiltered search results — facets and the live count are derived from these. */
  products: Product[];
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityState={{ selected: active }}
    >
      <Body size="sm" style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
      </Body>
    </TouchableOpacity>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Body style={styles.sectionTitle}>{title}</Body>
        {hint ? <Body size="xs" muted>{hint}</Body> : null}
      </View>
      {children}
    </View>
  );
}

function parsePrice(raw: string, fallback: number): number {
  const n = Number(raw.replace(/[^0-9]/g, ""));
  return raw.trim() === "" || !Number.isFinite(n) ? fallback : n;
}

export function SearchFilterSheet({
  visible,
  onClose,
  filters,
  onApply,
  sort,
  onSortChange,
  products,
}: SearchFilterSheetProps) {
  const { height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<ProductFilters>({ ...filters });
  const [draftSort, setDraftSort] = useState(sort);
  const [priceMinInput, setPriceMinInput] = useState("");
  const [priceMaxInput, setPriceMaxInput] = useState("");

  const priceToInputs = (price: ProductFilters["price"]) => {
    const [min, max] = price ?? [PRICE_BOUNDS.min, PRICE_BOUNDS.max];
    setPriceMinInput(min > PRICE_BOUNDS.min ? String(min) : "");
    setPriceMaxInput(max < PRICE_BOUNDS.max ? String(max) : "");
  };

  useEffect(() => {
    if (visible) {
      setDraft({ ...filters });
      setDraftSort(sort);
      priceToInputs(filters.price);
    }
    // Reset the draft only when the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Brand + category facets come from the current results, so every option
  // shown can actually match something.
  const { brandFacets, categoryFacets } = useMemo(() => {
    const brands = new Map<string, { name: string; count: number }>();
    const categories = new Map<string, { name: string; count: number }>();
    for (const p of products) {
      const bId = p.brand_id ?? p.brand?.id;
      if (bId && p.brand?.name) {
        const cur = brands.get(bId);
        brands.set(bId, { name: p.brand.name, count: (cur?.count ?? 0) + 1 });
      }
      const cId = p.category_id ?? p.category?.id;
      if (cId && p.category?.name) {
        const cur = categories.get(cId);
        categories.set(cId, { name: p.category.name, count: (cur?.count ?? 0) + 1 });
      }
    }
    const sorted = (m: Map<string, { name: string; count: number }>) =>
      [...m.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.count - a.count);
    return { brandFacets: sorted(brands), categoryFacets: sorted(categories) };
  }, [products]);

  let priceMin = parsePrice(priceMinInput, PRICE_BOUNDS.min);
  let priceMax = parsePrice(priceMaxInput, PRICE_BOUNDS.max);
  if (priceMin > priceMax) [priceMin, priceMax] = [priceMax, priceMin];
  const effective: ProductFilters = { ...draft, price: [priceMin, priceMax] };

  const activeCount = activeFilterCount(effective);
  const previewCount = useMemo(
    () => applySearchFilters(products, effective).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [products, JSON.stringify(effective)],
  );

  const toggleIn = (key: "colors" | "sizes" | "brands" | "categories", value: string) => {
    const cur = draft[key] ?? [];
    setDraft({ ...draft, [key]: cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value] });
  };

  const handleClear = () => {
    setDraft({ ...EMPTY_FILTERS });
    setDraftSort("newest");
    priceToInputs(undefined);
  };

  const handleApply = () => {
    onApply(effective);
    onSortChange(draftSort);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.backdropTouch} activeOpacity={1} onPress={onClose} />
        {/* Fixed height (not maxHeight): the ScrollView below uses flex:1 and
            collapses to zero inside a parent with no definite height. */}
        <View style={[styles.sheet, { height: screenHeight * 0.86 }]}>
          <View style={styles.sheetHeader}>
            <View style={styles.handle} />
            <View style={styles.headerRow}>
              <Display size="lg">Filters</Display>
              {activeCount > 0 && (
                <View style={styles.activeBadge}>
                  <Body style={styles.activeBadgeText}>{activeCount}</Body>
                </View>
              )}
              <View style={{ flex: 1 }} />
              {activeCount > 0 || draftSort !== "newest" ? (
                <TouchableOpacity onPress={handleClear} hitSlop={8} style={styles.resetBtn}>
                  <Body size="sm" style={styles.resetText}>Reset</Body>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close filters">
                <Ionicons name="close" size={18} color={colors.light.foreground} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            style={styles.sheetBody}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.sheetBodyContent}
            keyboardShouldPersistTaps="handled"
          >
            <Section title="Sort by">
              <View style={styles.chipWrap}>
                {SORTS.map((s) => (
                  <Chip key={s.value} label={s.label} active={draftSort === s.value} onPress={() => setDraftSort(s.value)} />
                ))}
              </View>
            </Section>

            <Section title="Price" hint="LKR">
              <View style={styles.priceRow}>
                <View style={styles.priceField}>
                  <Body size="xs" muted style={styles.priceFieldLabel}>Min</Body>
                  <TextInput
                    value={priceMinInput}
                    onChangeText={setPriceMinInput}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor={colors.light.mutedForeground}
                    style={styles.priceInput}
                  />
                </View>
                <View style={styles.priceDash} />
                <View style={styles.priceField}>
                  <Body size="xs" muted style={styles.priceFieldLabel}>Max</Body>
                  <TextInput
                    value={priceMaxInput}
                    onChangeText={setPriceMaxInput}
                    keyboardType="number-pad"
                    placeholder="No limit"
                    placeholderTextColor={colors.light.mutedForeground}
                    style={styles.priceInput}
                  />
                </View>
              </View>
              <View style={styles.chipWrap}>
                {PRICE_PRESETS.map((preset) => {
                  const on = priceMin === preset.range[0] && priceMax === preset.range[1];
                  return (
                    <Chip
                      key={preset.label}
                      label={preset.label}
                      active={on}
                      onPress={() =>
                        on
                          ? priceToInputs(undefined)
                          : priceToInputs([preset.range[0], preset.range[1]])
                      }
                    />
                  );
                })}
              </View>
            </Section>

            {categoryFacets.length > 1 ? (
              <Section title="Category">
                <View style={styles.chipWrap}>
                  {categoryFacets.map((c) => (
                    <Chip
                      key={c.id}
                      label={`${c.name} · ${c.count}`}
                      active={(draft.categories ?? []).includes(c.id)}
                      onPress={() => toggleIn("categories", c.id)}
                    />
                  ))}
                </View>
              </Section>
            ) : null}

            {brandFacets.length > 1 ? (
              <Section title="Brand">
                <View style={styles.chipWrap}>
                  {brandFacets.map((b) => (
                    <Chip
                      key={b.id}
                      label={`${b.name} · ${b.count}`}
                      active={(draft.brands ?? []).includes(b.id)}
                      onPress={() => toggleIn("brands", b.id)}
                    />
                  ))}
                </View>
              </Section>
            ) : null}

            <Section title="Colour" hint={draft.colors?.length ? `${draft.colors.length} selected` : undefined}>
              <View style={styles.colorGrid}>
                {COLORS.map((c) => {
                  const on = !!draft.colors?.includes(c.name);
                  const light = c.name === "White" || c.name === "Sand";
                  return (
                    <TouchableOpacity
                      key={c.name}
                      style={styles.colorItem}
                      onPress={() => toggleIn("colors", c.name)}
                      activeOpacity={0.8}
                      accessibilityLabel={c.name}
                      accessibilityState={{ selected: on }}
                    >
                      <View style={[styles.colorRing, on && styles.colorRingActive]}>
                        <View style={[styles.colorSwatch, { backgroundColor: c.hex }, light && styles.colorSwatchLight]}>
                          {on && <Ionicons name="checkmark" size={14} color={light ? colors.light.foreground : "#fff"} />}
                        </View>
                      </View>
                      <Body size="xs" style={[styles.colorName, on && styles.colorNameActive]}>{c.name}</Body>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Section>

            <Section title="Size">
              <View style={styles.chipWrap}>
                {SIZES.map((s) => (
                  <Chip key={s} label={s} active={!!draft.sizes?.includes(s)} onPress={() => toggleIn("sizes", s)} />
                ))}
              </View>
            </Section>

            <Section title="Occasion">
              <View style={styles.chipWrap}>
                {OCCASION_CHIPS.map((o) => {
                  // Reveal-if-present: chip shows when ≥1 loaded product carries it,
                  // or while it is the active selection.
                  const present = products.some((p) => p.ai_attrs?.occasion?.toLowerCase() === o.toLowerCase());
                  if (!present && draft.occasion !== o) return null;
                  return (
                    <Chip
                      key={o}
                      label={o}
                      active={draft.occasion === o}
                      onPress={() => setDraft({ ...draft, occasion: draft.occasion === o ? undefined : o })}
                    />
                  );
                })}
              </View>
            </Section>

            <Section title="Material">
              <View style={styles.chipWrap}>
                {MATERIAL_CHIPS.map((m) => {
                  const present = products.some((p) => p.ai_attrs?.material?.toLowerCase() === m.toLowerCase());
                  if (!present && draft.material !== m) return null;
                  return (
                    <Chip
                      key={m}
                      label={m}
                      active={draft.material === m}
                      onPress={() => setDraft({ ...draft, material: draft.material === m ? undefined : m })}
                    />
                  );
                })}
              </View>
            </Section>

            <Section title="Discount">
              <View style={styles.chipWrap}>
                {DISCOUNTS.map((d) => {
                  const on = draft.minDiscount === d.min;
                  return (
                    <Chip
                      key={d.min}
                      label={d.label}
                      active={on}
                      onPress={() => setDraft({ ...draft, minDiscount: on ? 0 : d.min })}
                    />
                  );
                })}
              </View>
            </Section>

            <Section title="Rating">
              <View style={styles.chipWrap}>
                {RATINGS.map((r) => (
                  <Chip
                    key={String(r)}
                    label={r === 0 ? "Any" : `${r}★ & up`}
                    active={(draft.minRating ?? 0) === r}
                    onPress={() => setDraft({ ...draft, minRating: r })}
                  />
                ))}
              </View>
            </Section>

            <Section title="Gender">
              <View style={styles.chipWrap}>
                {GENDERS.map((g) => (
                  <Chip
                    key={g.key || "all"}
                    label={g.label}
                    active={(draft.gender || "") === g.key}
                    onPress={() => setDraft({ ...draft, gender: g.key || undefined })}
                  />
                ))}
              </View>
            </Section>
          </ScrollView>

          <View style={[styles.sheetFooter, { paddingBottom: Math.max(insets.bottom, spacing[4]) }]}>
            <Button variant="outline" onPress={handleClear} style={styles.clearBtn}>
              Clear all
            </Button>
            <Button
              variant="brand"
              onPress={handleApply}
              style={styles.applyBtn}
              disabled={previewCount === 0}
            >
              {previewCount === 0
                ? "No matches"
                : `Show ${previewCount} result${previewCount === 1 ? "" : "s"}`}
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(22, 23, 15, 0.5)",
  },
  backdropTouch: {
    position: "absolute",
    inset: 0,
  },
  sheet: {
    backgroundColor: colors.light.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
    ...shadows.editorial,
  },
  sheetHeader: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    paddingBottom: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.light.border,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.light.border,
    alignSelf: "center",
    marginBottom: spacing[3],
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
  },
  activeBadge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: colors.accent2.rust,
    alignItems: "center",
    justifyContent: "center",
  },
  activeBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: fontFamilies.sans.semibold,
  },
  resetBtn: {
    paddingHorizontal: spacing[2],
  },
  resetText: {
    color: colors.olive[700],
    fontFamily: fontFamilies.sans.semibold,
    textDecorationLine: "underline",
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.light.muted,
  },
  sheetBody: {
    flex: 1,
  },
  sheetBodyContent: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[6],
  },
  section: {
    gap: spacing[3],
    paddingVertical: spacing[4],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.light.border,
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 15,
    color: colors.light.foreground,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[2],
  },
  chip: {
    minWidth: 48,
    height: 38,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.light.border,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    backgroundColor: colors.light.card,
  },
  chipActive: {
    backgroundColor: colors.light.foreground,
    borderColor: colors.light.foreground,
  },
  chipText: {
    color: colors.light.foreground,
    fontFamily: fontFamilies.sans.medium,
    fontSize: 13,
  },
  chipTextActive: {
    color: colors.light.primaryForeground,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing[2],
  },
  priceField: {
    flex: 1,
    gap: 4,
  },
  priceFieldLabel: {
    fontSize: 11,
  },
  priceInput: {
    height: 44,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.light.card,
    borderRadius: radii.lg,
    paddingHorizontal: spacing[3],
    color: colors.light.foreground,
    fontSize: 15,
    fontFamily: fontFamilies.sans.medium,
  },
  priceDash: {
    width: 10,
    height: 1,
    backgroundColor: colors.light.mutedForeground,
    marginBottom: 22,
  },
  colorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: spacing[3],
    columnGap: spacing[2],
  },
  colorItem: {
    width: 58,
    alignItems: "center",
    gap: 4,
  },
  colorRing: {
    padding: 3,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  colorRingActive: {
    borderColor: colors.light.foreground,
  },
  colorSwatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  colorSwatchLight: {
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  colorName: {
    color: colors.light.mutedForeground,
    fontSize: 11,
  },
  colorNameActive: {
    color: colors.light.foreground,
    fontFamily: fontFamilies.sans.semibold,
  },
  sheetFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.light.border,
    backgroundColor: colors.light.background,
  },
  clearBtn: {
    flex: 1,
    height: 50,
    borderRadius: radii.xl,
  },
  applyBtn: {
    flex: 2,
    height: 50,
    borderRadius: radii.xl,
  },
});
