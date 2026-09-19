import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Pressable,
  TextInput,
} from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { Label, Display, Body } from "@/components/ui/Typography";
import { Button } from "@/components/ui";
import {
  COLORS,
  SIZES,
  DISCOUNTS,
  PRICE_BOUNDS,
  PRICE_PRESETS,
  EMPTY_FILTERS,
  type ProductFilters,
} from "@/lib/api/facets";
import * as api from "@/lib/api";
import type { Brand, Category } from "@/lib/types";
import { colors, radii, spacing, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";

const GENDERS = [
  { key: "", label: "All" },
  { key: "women", label: "Women" },
  { key: "men", label: "Men" },
  { key: "unisex", label: "Unisex" },
  { key: "kids", label: "Kids" },
];

const SORTS = [
  { key: "newest", label: "Newest" },
  { key: "for_you", label: "For You" },
  { key: "rating", label: "Top Rated" },
  { key: "sale", label: "Biggest Sale" },
  { key: "price_asc", label: "Price: Low to High" },
  { key: "price_desc", label: "Price: High to Low" },
];

const RATINGS = [3, 4, 4.5];

interface FilterSheetProps {
  visible: boolean;
  onClose: () => void;
  filters: ProductFilters;
  onApply: (filters: ProductFilters) => void;
  sort: string;
  onSortChange: (sort: string) => void;
  resultCount: number;
}

/** Drop duplicate facet rows (e.g. a subcategory named like its parent)
 *  by normalized display name, keeping the first occurrence. */
function uniqueByName<T extends { id: string; name: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((r) => {
    const key = r.name.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function SectionLabel({
  children,
  selected,
}: {
  children: React.ReactNode;
  selected?: number;
}) {
  return (
    <View style={styles.sectionHead}>
      <Label style={styles.sectionKicker}>{children}</Label>
      {selected ? (
        <View style={styles.selectedPill}>
          <Label style={styles.selectedPillText}>{selected} selected</Label>
        </View>
      ) : null}
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityState={{ selected: active }}
    >
      {active ? (
        <Ionicons name="checkmark" size={11} color={colors.light.primaryForeground} />
      ) : null}
      <Label style={[styles.chipText, active && styles.chipTextActive]}>{label}</Label>
    </TouchableOpacity>
  );
}

export function FilterSheet({
  visible,
  onClose,
  filters,
  onApply,
  sort,
  onSortChange,
  resultCount,
}: FilterSheetProps) {
  const [draft, setDraft] = useState<ProductFilters>(filters);
  const [draftSort, setDraftSort] = useState(sort);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [showAllBrands, setShowAllBrands] = useState(false);
  const [priceMinInput, setPriceMinInput] = useState(
    String(filters.price?.[0] ?? PRICE_BOUNDS.min)
  );
  const [priceMaxInput, setPriceMaxInput] = useState(
    String(filters.price?.[1] ?? PRICE_BOUNDS.max)
  );

  useEffect(() => {
    if (visible) {
      setDraft(filters);
      setDraftSort(sort);
      setShowAllCategories(false);
      setShowAllBrands(false);
      setPriceMinInput(String(filters.price?.[0] ?? PRICE_BOUNDS.min));
      setPriceMaxInput(String(filters.price?.[1] ?? PRICE_BOUNDS.max));
    }
  }, [visible, filters, sort]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    Promise.all([api.getBrands({ limit: 200 }), api.getCategories(100)]).then(
      ([br, cat]) => {
        if (cancelled) return;
        if (br.ok) setBrands(br.data);
        if (cat.ok) setCategories(cat.data);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const uniqueCategories = useMemo(() => uniqueByName(categories), [categories]);
  const uniqueBrands = useMemo(() => uniqueByName(brands), [brands]);
  const visibleCategories = useMemo(() => {
    if (showAllCategories) return uniqueCategories;
    const selected = new Set(draft.categories ?? []);
    return uniqueCategories
      .filter((item, index) => index < 8 || selected.has(item.id))
      .slice(0, 12);
  }, [draft.categories, showAllCategories, uniqueCategories]);
  const visibleBrands = useMemo(() => {
    if (showAllBrands) return uniqueBrands;
    const selected = new Set(draft.brands ?? []);
    return uniqueBrands
      .filter((item, index) => index < 8 || selected.has(item.id))
      .slice(0, 12);
  }, [draft.brands, showAllBrands, uniqueBrands]);

  const handleApply = () => {
    const min = Number(priceMinInput) || PRICE_BOUNDS.min;
    const max = Number(priceMaxInput) || PRICE_BOUNDS.max;
    const next: ProductFilters = {
      ...draft,
      price: [min, max],
    };
    onApply(next);
    onSortChange(draftSort);
    onClose();
  };

  const handleReset = () => {
    setDraft({ ...EMPTY_FILTERS });
    setDraftSort("newest");
    setPriceMinInput(String(PRICE_BOUNDS.min));
    setPriceMaxInput(String(PRICE_BOUNDS.max));
  };

  const draftCount = (() => {
    let n = 0;
    if (draft.gender) n += 1;
    const min = Number(priceMinInput) || PRICE_BOUNDS.min;
    const max = Number(priceMaxInput) || PRICE_BOUNDS.max;
    if (min > PRICE_BOUNDS.min || max < PRICE_BOUNDS.max) n += 1;
    n += draft.brands?.length ?? 0;
    n += draft.categories?.length ?? 0;
    n += draft.colors?.length ?? 0;
    n += draft.sizes?.length ?? 0;
    if (draft.minRating && draft.minRating > 0) n += 1;
    if (draft.minDiscount && draft.minDiscount > 0) n += 1;
    return n;
  })();

  const toggleId = (key: "brands" | "categories", id: string) => {
    const list = draft[key] ?? [];
    setDraft({
      ...draft,
      [key]: list.includes(id) ? list.filter((v) => v !== id) : [...list, id],
    });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Label style={styles.headerEyebrow}>Catalogue</Label>
            <View style={styles.headerTitleRow}>
              <Display size="xl">Refine</Display>
              {draftCount > 0 ? (
                <View style={styles.countBadge}>
                  <Label style={styles.countBadgeText}>{draftCount}</Label>
                </View>
              ) : null}
            </View>
            <Body muted size="xs">Sort and narrow {resultCount} pieces</Body>
          </View>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={12}
            style={styles.closeBtn}
            accessibilityLabel="Close filters"
          >
            <Ionicons name="close" size={18} color={colors.light.foreground} />
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          <SectionLabel>Sort by</SectionLabel>
          <View style={styles.chipsWrap}>
            {SORTS.map((s) => (
              <Chip
                key={s.key}
                label={s.label}
                active={draftSort === s.key}
                onPress={() => setDraftSort(s.key)}
              />
            ))}
          </View>

          <SectionLabel
            selected={
              (Number(priceMinInput) || PRICE_BOUNDS.min) > PRICE_BOUNDS.min ||
              (Number(priceMaxInput) || PRICE_BOUNDS.max) < PRICE_BOUNDS.max
                ? 1
                : 0
            }
          >
            Price (LKR)
          </SectionLabel>
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
          <View style={styles.chipsWrap}>
            {PRICE_PRESETS.map((p) => {
              const on =
                Number(priceMinInput) === p.range[0] && Number(priceMaxInput) === p.range[1];
              return (
                <Chip
                  key={p.label}
                  label={p.label}
                  active={on}
                  onPress={() => {
                    setPriceMinInput(String(p.range[0]));
                    setPriceMaxInput(String(p.range[1]));
                  }}
                />
              );
            })}
          </View>

          <SectionLabel selected={draft.minDiscount ? 1 : 0}>Discount</SectionLabel>
          <View style={styles.chipsWrap}>
            {DISCOUNTS.map((d) => (
              <Chip
                key={d.min}
                label={d.label}
                active={draft.minDiscount === d.min}
                onPress={() =>
                  setDraft({
                    ...draft,
                    minDiscount: draft.minDiscount === d.min ? 0 : d.min,
                  })
                }
              />
            ))}
          </View>

          <SectionLabel selected={draft.minRating ? 1 : 0}>Rating</SectionLabel>
          <View style={styles.chipsWrap}>
            {RATINGS.map((r) => (
              <Chip
                key={r}
                label={`${r}★ & up`}
                active={draft.minRating === r}
                onPress={() =>
                  setDraft({ ...draft, minRating: draft.minRating === r ? 0 : r })
                }
              />
            ))}
          </View>

          {uniqueCategories.length > 0 ? (
            <>
              <SectionLabel selected={draft.categories?.length ?? 0}>
                Category
              </SectionLabel>
              <View style={styles.chipsWrap}>
                {visibleCategories.map((c) => {
                  const on = (draft.categories ?? []).includes(c.id);
                  return (
                    <Chip
                      key={c.id}
                      label={c.name}
                      active={on}
                      onPress={() => toggleId("categories", c.id)}
                    />
                  );
                })}
              </View>
              {uniqueCategories.length > visibleCategories.length || showAllCategories ? (
                <TouchableOpacity
                  style={styles.expandButton}
                  onPress={() => setShowAllCategories((value) => !value)}
                >
                  <Body size="xs" style={styles.expandText}>
                    {showAllCategories
                      ? "Show fewer categories"
                      : `View ${uniqueCategories.length - visibleCategories.length} more categories`}
                  </Body>
                  <Ionicons
                    name={showAllCategories ? "chevron-up" : "chevron-down"}
                    size={14}
                    color={colors.olive[700]}
                  />
                </TouchableOpacity>
              ) : null}
            </>
          ) : null}

          {uniqueBrands.length > 0 ? (
            <>
              <SectionLabel selected={draft.brands?.length ?? 0}>Brand</SectionLabel>
              <View style={styles.chipsWrap}>
                {visibleBrands.map((b) => {
                  const on = (draft.brands ?? []).includes(b.id);
                  return (
                    <Chip
                      key={b.id}
                      label={b.name}
                      active={on}
                      onPress={() => toggleId("brands", b.id)}
                    />
                  );
                })}
              </View>
              {uniqueBrands.length > visibleBrands.length || showAllBrands ? (
                <TouchableOpacity
                  style={styles.expandButton}
                  onPress={() => setShowAllBrands((value) => !value)}
                >
                  <Body size="xs" style={styles.expandText}>
                    {showAllBrands
                      ? "Show fewer brands"
                      : `View ${uniqueBrands.length - visibleBrands.length} more brands`}
                  </Body>
                  <Ionicons
                    name={showAllBrands ? "chevron-up" : "chevron-down"}
                    size={14}
                    color={colors.olive[700]}
                  />
                </TouchableOpacity>
              ) : null}
            </>
          ) : null}

          <SectionLabel selected={draft.colors?.length ?? 0}>Color</SectionLabel>
          <View style={styles.colorRow}>
            {COLORS.map((c) => {
              const list = draft.colors ?? [];
              const on = list.includes(c.name);
              return (
                <View key={c.name} style={styles.swatchItem}>
                  <View style={[styles.swatchRing, on && styles.swatchRingActive]}>
                    <TouchableOpacity
                      onPress={() =>
                        setDraft({
                          ...draft,
                          colors: on ? list.filter((v) => v !== c.name) : [...list, c.name],
                        })
                      }
                      activeOpacity={0.8}
                      accessibilityLabel={c.name}
                      accessibilityState={{ selected: on }}
                      style={[
                        styles.swatch,
                        { backgroundColor: c.hex },
                        c.name === "White" && styles.swatchBorder,
                      ]}
                    >
                      {on ? (
                        <Ionicons
                          name="checkmark"
                          size={14}
                          color={c.name === "White" || c.name === "Sand" ? colors.olive[900] : "#fff"}
                        />
                      ) : null}
                    </TouchableOpacity>
                  </View>
                  <Body size="xs" style={[styles.swatchName, on && styles.swatchNameActive]}>
                    {c.name}
                  </Body>
                </View>
              );
            })}
          </View>

          <SectionLabel selected={draft.sizes?.length ?? 0}>Size</SectionLabel>
          <View style={styles.chipsWrap}>
            {SIZES.map((s) => {
              const list = draft.sizes ?? [];
              const on = list.includes(s);
              return (
                <Chip
                  key={s}
                  label={s}
                  active={on}
                  onPress={() =>
                    setDraft({
                      ...draft,
                      sizes: on ? list.filter((v) => v !== s) : [...list, s],
                    })
                  }
                />
              );
            })}
          </View>

          <SectionLabel selected={draft.gender ? 1 : 0}>Gender</SectionLabel>
          <View style={styles.chipsWrap}>
            {GENDERS.map((g) => (
              <Chip
                key={g.key || "all"}
                label={g.label}
                active={(draft.gender || "") === g.key}
                onPress={() => setDraft({ ...draft, gender: g.key || undefined })}
              />
            ))}
          </View>
          <View style={{ height: spacing[4] }} />
        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.footerMeta}>
            <Label style={styles.footerCount}>{resultCount}</Label>
            <Body muted size="xs">
              {resultCount === 1 ? "piece" : "pieces"}
            </Body>
          </View>
          <View style={styles.footerActions}>
            <Button variant="outline" size="sm" onPress={handleReset}>
              Reset
            </Button>
            <Button variant="brand" size="sm" onPress={handleApply}>
              {draftCount > 0 ? `Apply · ${draftCount}` : "Apply"}
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
    backgroundColor: "rgba(22, 23, 15, 0.45)",
  },
  sheet: {
    backgroundColor: colors.paper.cream,
    borderTopLeftRadius: radii["2xl"],
    borderTopRightRadius: radii["2xl"],
    maxHeight: "88%",
    paddingBottom: spacing[4],
    ...shadows.editorial,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.light.border,
    alignSelf: "center",
    marginTop: spacing[2],
    marginBottom: spacing[3],
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[3],
    marginBottom: spacing[1],
    borderBottomWidth: 1,
    borderBottomColor: `${colors.light.primary}12`,
  },
  headerText: {
    gap: 2,
  },
  headerEyebrow: {
    color: colors.light.mutedForeground,
    fontSize: 9,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
  },
  countBadge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: colors.olive[900],
    alignItems: "center",
    justifyContent: "center",
  },
  countBadgeText: {
    color: colors.paper.cream,
    fontSize: 10,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.border,
    marginTop: 2,
  },
  content: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[4],
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing[4],
    marginBottom: spacing[2],
  },
  sectionKicker: {
    color: colors.light.primary,
  },
  selectedPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    backgroundColor: `${colors.accent2.ochre}20`,
    borderWidth: 1,
    borderColor: `${colors.accent2.ochre}55`,
  },
  selectedPillText: {
    color: colors.accent2.ochre,
    fontSize: 8,
  },
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[2],
  },
  expandButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    marginTop: spacing[2],
    paddingHorizontal: 2,
    paddingVertical: 5,
  },
  expandText: {
    color: colors.olive[700],
    fontFamily: fontFamilies.sans.semibold,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.light.card,
  },
  chipActive: {
    backgroundColor: colors.olive[900],
    borderColor: colors.olive[900],
  },
  chipText: {
    color: colors.light.foreground,
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  chipTextActive: {
    color: colors.light.primaryForeground,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing[2],
    marginBottom: spacing[2],
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
    height: 44,
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
    marginBottom: 22,
  },
  colorRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[3],
  },
  swatchItem: {
    alignItems: "center",
    gap: 4,
    width: 44,
  },
  swatch: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  swatchRing: {
    padding: 3,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  swatchRingActive: {
    borderColor: colors.accent2.ochre,
  },
  swatchBorder: {
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  swatchName: {
    color: colors.light.mutedForeground,
    fontSize: 9,
  },
  swatchNameActive: {
    color: colors.light.foreground,
    fontFamily: fontFamilies.sans.semibold,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
  },
  footerMeta: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  footerCount: {
    color: colors.light.foreground,
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 13,
  },
  footerActions: {
    flexDirection: "row",
    gap: spacing[2],
  },
});

// Default export of the price label for reuse.
export { formatPrice };
