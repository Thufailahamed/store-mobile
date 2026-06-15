import React, { useEffect, useState } from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Pressable,
  TextInput,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
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
import { colors, radii, spacing, typography } from "@/lib/theme/tokens";
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
  { key: "rating", label: "Top Rated" },
  { key: "sale", label: "Biggest Sale" },
  { key: "price_asc", label: "Price: Low to High" },
  { key: "price_desc", label: "Price: High to Low" },
];

interface FilterSheetProps {
  visible: boolean;
  onClose: () => void;
  filters: ProductFilters;
  onApply: (filters: ProductFilters) => void;
  sort: string;
  onSortChange: (sort: string) => void;
  resultCount: number;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Label style={styles.sectionKicker}>{children}</Label>;
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
    >
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

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <View>
            <Display size="xl">Refine</Display>
            {draftCount > 0 ? (
              <Label style={styles.headerSub}>
                {draftCount} filter{draftCount === 1 ? "" : "s"} set
              </Label>
            ) : null}
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={22} color={colors.light.foreground} />
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

          <SectionLabel>Price (LKR)</SectionLabel>
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

          <SectionLabel>Discount</SectionLabel>
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

          <SectionLabel>Rating</SectionLabel>
          <View style={styles.chipsWrap}>
            {[3, 4, 4.5].map((r) => (
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

          {categories.length > 0 ? (
            <>
              <SectionLabel>Category</SectionLabel>
              <View style={styles.chipsWrap}>
                {categories.map((c) => {
                  const list = draft.categories ?? [];
                  const on = list.includes(c.id);
                  return (
                    <Chip
                      key={c.id}
                      label={c.name}
                      active={on}
                      onPress={() =>
                        setDraft({
                          ...draft,
                          categories: on ? list.filter((v) => v !== c.id) : [...list, c.id],
                        })
                      }
                    />
                  );
                })}
              </View>
            </>
          ) : null}

          {brands.length > 0 ? (
            <>
              <SectionLabel>Brand</SectionLabel>
              <View style={styles.chipsWrap}>
                {brands.map((b) => {
                  const list = draft.brands ?? [];
                  const on = list.includes(b.id);
                  return (
                    <Chip
                      key={b.id}
                      label={b.name}
                      active={on}
                      onPress={() =>
                        setDraft({
                          ...draft,
                          brands: on ? list.filter((v) => v !== b.id) : [...list, b.id],
                        })
                      }
                    />
                  );
                })}
              </View>
            </>
          ) : null}

          <SectionLabel>Color</SectionLabel>
          <View style={styles.colorRow}>
            {COLORS.map((c) => {
              const list = draft.colors ?? [];
              const on = list.includes(c.name);
              return (
                <TouchableOpacity
                  key={c.name}
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
                    on && styles.swatchActive,
                    c.name === "White" && styles.swatchBorder,
                  ]}
                />
              );
            })}
          </View>

          <SectionLabel>Size</SectionLabel>
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

          <SectionLabel>Gender</SectionLabel>
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
          <Body muted size="sm">
            {resultCount} {resultCount === 1 ? "piece" : "pieces"}
          </Body>
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
    backgroundColor: "rgba(22, 23, 15, 0.4)",
  },
  sheet: {
    backgroundColor: colors.paper.cream,
    borderTopLeftRadius: radii["2xl"],
    borderTopRightRadius: radii["2xl"],
    maxHeight: "88%",
    paddingBottom: spacing[4],
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
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[5],
    marginBottom: spacing[3],
  },
  headerSub: {
    color: colors.light.primary,
    marginTop: 2,
  },
  content: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[4],
  },
  sectionKicker: {
    color: colors.light.primary,
    marginTop: spacing[4],
    marginBottom: spacing[2],
  },
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[2],
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.light.card,
  },
  chipActive: {
    backgroundColor: colors.light.foreground,
    borderColor: colors.light.foreground,
  },
  chipText: {
    color: colors.light.foreground,
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: typography.letterSpacing.wide,
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
  colorRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[2],
  },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  swatchBorder: {
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  swatchActive: {
    borderWidth: 2,
    borderColor: colors.light.primary,
    transform: [{ scale: 1.05 }],
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
  footerActions: {
    flexDirection: "row",
    gap: spacing[2],
  },
});

// Default export of the price label for reuse.
export { formatPrice };
