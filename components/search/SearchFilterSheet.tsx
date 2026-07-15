import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { Display, Label, Body } from "@/components/ui/Typography";
import { Button } from "@/components/ui";
import { colors, radii, spacing, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { COLORS, SIZES, DISCOUNTS, SORTS, PRICE_PRESETS, PRICE_BOUNDS, EMPTY_FILTERS, activeFilterCount } from "@/lib/api/facets";
import type { ProductFilters } from "@/lib/api/facets";
import * as api from "@/lib/api";
import type { Brand, Category } from "@/lib/types";

const GENDERS = [
  { key: "", label: "All" },
  { key: "women", label: "Women" },
  { key: "men", label: "Men" },
  { key: "unisex", label: "Unisex" },
  { key: "kids", label: "Kids" },
];

interface SearchFilterSheetProps {
  visible: boolean;
  onClose: () => void;
  filters: ProductFilters;
  onApply: (filters: ProductFilters) => void;
  sort: string;
  onSortChange: (sort: string) => void;
  resultCount: number;
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.sizeChip, active && styles.sizeChipActive]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Body size="sm" style={[styles.sizeText, active && styles.sizeTextActive]}>
        {label}
      </Body>
    </TouchableOpacity>
  );
}

export function SearchFilterSheet({
  visible,
  onClose,
  filters,
  onApply,
  sort,
  onSortChange,
  resultCount,
}: SearchFilterSheetProps) {
  const { height: screenHeight } = useWindowDimensions();
  const [draft, setDraft] = useState<ProductFilters>({ ...filters });
  const [draftSort, setDraftSort] = useState(sort);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [priceMinInput, setPriceMinInput] = useState(
    String(filters.price?.[0] ?? PRICE_BOUNDS.min)
  );
  const [priceMaxInput, setPriceMaxInput] = useState(
    String(filters.price?.[1] ?? PRICE_BOUNDS.max)
  );

  useEffect(() => {
    if (visible) {
      setDraft({ ...filters });
      setDraftSort(sort);
      setPriceMinInput(String(filters.price?.[0] ?? PRICE_BOUNDS.min));
      setPriceMaxInput(String(filters.price?.[1] ?? PRICE_BOUNDS.max));
    }
  }, [visible, filters, sort]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    Promise.all([api.getBrands({ limit: 200 }), api.getCategories(100)]).then(([br, cat]) => {
      if (cancelled) return;
      if (br.ok) setBrands(br.data);
      if (cat.ok) setCategories(cat.data);
    });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const activeCount = activeFilterCount({
    ...draft,
    price: [Number(priceMinInput) || PRICE_BOUNDS.min, Number(priceMaxInput) || PRICE_BOUNDS.max],
  });

  const toggleColor = (c: string) => {
    const cur = draft.colors ?? [];
    setDraft({
      ...draft,
      colors: cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c],
    });
  };

  const toggleSize = (s: string) => {
    const cur = draft.sizes ?? [];
    setDraft({
      ...draft,
      sizes: cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s],
    });
  };

  const toggleBrand = (b: string) => {
    const cur = draft.brands ?? [];
    setDraft({
      ...draft,
      brands: cur.includes(b) ? cur.filter((x) => x !== b) : [...cur, b],
    });
  };

  const toggleCategory = (c: string) => {
    const cur = draft.categories ?? [];
    setDraft({
      ...draft,
      categories: cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c],
    });
  };

  const handleClear = () => {
    setDraft({ ...EMPTY_FILTERS });
    setDraftSort("newest");
    setPriceMinInput(String(PRICE_BOUNDS.min));
    setPriceMaxInput(String(PRICE_BOUNDS.max));
  };

  const handleApply = () => {
    const min = Number(priceMinInput) || PRICE_BOUNDS.min;
    const max = Number(priceMaxInput) || PRICE_BOUNDS.max;
    onApply({ ...draft, price: [min, max] });
    onSortChange(draftSort);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.backdropTouch} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { maxHeight: screenHeight * 0.82 }]}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={styles.handle} />
            <View style={styles.headerRow}>
              <Display size="lg">Filters</Display>
              {activeCount > 0 && (
                <View style={styles.activeBadge}>
                  <Body style={styles.activeBadgeText}>{activeCount}</Body>
                </View>
              )}
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={colors.light.foreground} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            style={styles.sheetBody}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.sheetBodyContent}
          >
            {/* Sort */}
            <View style={styles.filterSection}>
              <Label style={styles.filterLabel}>SORT BY</Label>
              <View style={styles.sizeGrid}>
                {SORTS.map((s) => (
                  <Chip
                    key={s.value}
                    label={s.label}
                    active={draftSort === s.value}
                    onPress={() => setDraftSort(s.value)}
                  />
                ))}
              </View>
            </View>

            {/* Price Range */}
            <View style={styles.filterSection}>
              <Label style={styles.filterLabel}>PRICE RANGE (LKR)</Label>
              <View style={styles.priceRow}>
                <View style={styles.priceInputWrap}>
                  <Label style={styles.priceInputLabel}>Min</Label>
                  <TextInput
                    value={priceMinInput}
                    onChangeText={setPriceMinInput}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={colors.light.mutedForeground}
                    style={styles.priceInput}
                  />
                </View>
                <View style={styles.priceDash} />
                <View style={styles.priceInputWrap}>
                  <Label style={styles.priceInputLabel}>Max</Label>
                  <TextInput
                    value={priceMaxInput}
                    onChangeText={setPriceMaxInput}
                    keyboardType="numeric"
                    placeholder={String(PRICE_BOUNDS.max)}
                    placeholderTextColor={colors.light.mutedForeground}
                    style={styles.priceInput}
                  />
                </View>
              </View>
              <View style={styles.presetGrid}>
                {PRICE_PRESETS.map((preset) => {
                  const isActive =
                    Number(priceMinInput) === preset.range[0] && Number(priceMaxInput) === preset.range[1];
                  return (
                    <TouchableOpacity
                      key={preset.label}
                      style={[styles.presetChip, isActive && styles.presetChipActive]}
                      onPress={() => {
                        setPriceMinInput(String(preset.range[0]));
                        setPriceMaxInput(String(preset.range[1]));
                      }}
                    >
                      <Body size="sm" style={[styles.presetText, isActive && styles.presetTextActive]}>
                        {preset.label}
                      </Body>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Category */}
            {categories.length > 0 ? (
              <View style={styles.filterSection}>
                <Label style={styles.filterLabel}>CATEGORY</Label>
                <View style={styles.sizeGrid}>
                  {categories.map((c) => {
                    const list = draft.categories ?? [];
                    const on = list.includes(c.id);
                    return (
                      <Chip key={c.id} label={c.name} active={on} onPress={() => toggleCategory(c.id)} />
                    );
                  })}
                </View>
              </View>
            ) : null}

            {/* Brand */}
            {brands.length > 0 ? (
              <View style={styles.filterSection}>
                <Label style={styles.filterLabel}>BRAND</Label>
                <View style={styles.sizeGrid}>
                  {brands.map((b) => {
                    const list = draft.brands ?? [];
                    const on = list.includes(b.id);
                    return (
                      <Chip key={b.id} label={b.name} active={on} onPress={() => toggleBrand(b.id)} />
                    );
                  })}
                </View>
              </View>
            ) : null}

            {/* Colors */}
            <View style={styles.filterSection}>
              <Label style={styles.filterLabel}>COLOR</Label>
              <View style={styles.colorGrid}>
                {COLORS.map((c) => {
                  const isActive = draft.colors?.includes(c.name);
                  return (
                    <TouchableOpacity
                      key={c.name}
                      style={[styles.colorItem, isActive && styles.colorItemActive]}
                      onPress={() => toggleColor(c.name)}
                    >
                      <View style={[styles.colorSwatch, { backgroundColor: c.hex }]}>
                        {isActive && (
                          <Ionicons name="checkmark" size={12} color="#fff" />
                        )}
                      </View>
                      <Body size="xs" style={styles.colorName}>{c.name}</Body>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Sizes */}
            <View style={styles.filterSection}>
              <Label style={styles.filterLabel}>SIZE</Label>
              <View style={styles.sizeGrid}>
                {SIZES.map((s) => {
                  const isActive = draft.sizes?.includes(s);
                  return (
                    <Chip key={s} label={s} active={!!isActive} onPress={() => toggleSize(s)} />
                  );
                })}
              </View>
            </View>

            {/* Discount */}
            <View style={styles.filterSection}>
              <Label style={styles.filterLabel}>DISCOUNT</Label>
              <View style={styles.sizeGrid}>
                {DISCOUNTS.map((d) => {
                  const isActive = draft.minDiscount === d.min;
                  return (
                    <Chip
                      key={d.min}
                      label={d.label}
                      active={isActive}
                      onPress={() => setDraft({ ...draft, minDiscount: isActive ? 0 : d.min })}
                    />
                  );
                })}
              </View>
            </View>

            {/* Rating */}
            <View style={styles.filterSection}>
              <Label style={styles.filterLabel}>MINIMUM RATING</Label>
              <View style={styles.sizeGrid}>
                {[0, 3, 4, 4.5].map((r) => {
                  const isActive = draft.minRating === r;
                  const label = r === 0 ? "Any" : `${r}★ & up`;
                  return (
                    <Chip
                      key={String(r)}
                      label={label}
                      active={isActive}
                      onPress={() => setDraft({ ...draft, minRating: r })}
                    />
                  );
                })}
              </View>
            </View>

            {/* Gender */}
            <View style={styles.filterSection}>
              <Label style={styles.filterLabel}>GENDER</Label>
              <View style={styles.sizeGrid}>
                {GENDERS.map((g) => (
                  <Chip
                    key={g.key || "all"}
                    label={g.label}
                    active={(draft.gender || "") === g.key}
                    onPress={() => setDraft({ ...draft, gender: g.key || undefined })}
                  />
                ))}
              </View>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.sheetFooter}>
            <Body muted size="sm" style={styles.resultLabel}>
              {resultCount} {resultCount === 1 ? "piece" : "pieces"}
            </Body>
            <View style={styles.footerActions}>
              <Button variant="ghost" onPress={handleClear}>
                Clear all
              </Button>
              <Button variant="brand" onPress={handleApply} style={styles.applyBtn}>
                Show results
              </Button>
            </View>
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
    ...shadows.editorial,
  },
  sheetHeader: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    paddingBottom: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: `${colors.light.primary}15`,
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
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.olive[600],
    alignItems: "center",
    justifyContent: "center",
  },
  activeBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  closeBtn: {
    marginLeft: "auto",
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.light.muted,
  },
  sheetBody: {
    flex: 1,
  },
  sheetBodyContent: {
    padding: spacing[5],
    gap: spacing[6],
  },
  filterSection: {
    gap: spacing[3],
  },
  filterLabel: {
    color: colors.olive[600],
  },
  presetGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[2],
  },
  presetChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.full,
    borderWidth: 1.5,
    borderColor: colors.light.border,
    backgroundColor: colors.light.card,
  },
  presetChipActive: {
    backgroundColor: colors.light.foreground,
    borderColor: colors.light.foreground,
  },
  presetText: {
    color: colors.light.foreground,
  },
  presetTextActive: {
    color: colors.light.primaryForeground,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing[2],
  },
  priceInputWrap: {
    flex: 1,
  },
  priceInputLabel: {
    color: colors.light.mutedForeground,
    fontSize: 9,
    marginBottom: 4,
  },
  priceInput: {
    height: 40,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.light.card,
    borderRadius: radii.md,
    paddingHorizontal: spacing[3],
    color: colors.light.foreground,
    fontSize: 14,
    fontFamily: fontFamilies.sans.medium,
  },
  priceDash: {
    width: 12,
    height: 1,
    backgroundColor: colors.light.border,
    marginBottom: 20,
  },
  colorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[3],
  },
  colorItem: {
    alignItems: "center",
    gap: 4,
  },
  colorItemActive: {},
  colorSwatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  colorName: {
    color: colors.light.mutedForeground,
    fontSize: 10,
  },
  sizeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[2],
  },
  sizeChip: {
    minWidth: 52,
    height: 44,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: colors.light.border,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[3],
    backgroundColor: colors.light.card,
  },
  sizeChipActive: {
    backgroundColor: colors.light.foreground,
    borderColor: colors.light.foreground,
  },
  sizeText: {
    color: colors.light.foreground,
  },
  sizeTextActive: {
    color: colors.light.primaryForeground,
  },
  sheetFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[3],
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
    borderTopWidth: 1,
    borderTopColor: `${colors.light.primary}15`,
  },
  resultLabel: {
    flexShrink: 1,
  },
  footerActions: {
    flexDirection: "row",
    gap: spacing[2],
  },
  applyBtn: {
    flex: 1,
  },
});
