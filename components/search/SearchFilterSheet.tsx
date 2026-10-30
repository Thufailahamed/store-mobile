import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Modal } from "@/components/ui/Modal";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, type IonIconName } from "@/components/ui/Icon";
import { colors, radii, spacing } from "@/lib/theme/tokens";
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
import type { ProductFilters } from "@/lib/api/facets";
import { productColorFamilies, productOccasion, productMaterial } from "@/lib/facet-vocab";
import { OCCASIONS as OCCASION_CHIPS, MATERIALS as MATERIAL_CHIPS } from "@/lib/api/facets";
import { applySearchFilters } from "@/lib/search-filters";
import { formatPrice } from "@/lib/utils";
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

const SORT_ICONS: Record<string, IonIconName> = {
  newest: "time-outline",
  for_you: "sparkles",
  rating: "star-outline",
  sale: "flame-outline",
  price_asc: "trending-up-outline",
  price_desc: "trending-down-outline",
};

function Chip({
  label,
  active,
  onPress,
  count,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  count?: number;
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityState={{ selected: active }}
    >
      {active ? <Ionicons name="checkmark" size={13} color={colors.olive[200]} /> : null}
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
      {typeof count === "number" ? (
        <Text style={[styles.chipCount, active && styles.chipCountActive]}>{count}</Text>
      ) : null}
    </TouchableOpacity>
  );
}

function Section({
  index,
  title,
  hint,
  children,
}: {
  index: number;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionIndex}>{String(index).padStart(2, "0")}</Text>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={{ flex: 1 }} />
        {hint ? (
          <View style={styles.sectionHint}>
            <Text style={styles.sectionHintText} numberOfLines={1}>{hint}</Text>
          </View>
        ) : null}
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

  const sortLabel = SORTS.find((s) => s.value === draftSort)?.label;
  const priceActive = priceMin > PRICE_BOUNDS.min || priceMax < PRICE_BOUNDS.max;
  // Canonical facet keys present in these results (AI attrs + colour families).
  const presentOccasions = new Set(products.map(productOccasion).filter(Boolean));
  const presentMaterials = new Set(products.map(productMaterial).filter(Boolean));
  const presentColors = new Set(products.flatMap(productColorFamilies));
  const occasionChips = OCCASION_CHIPS.filter((o) => draft.occasion === o.key || presentOccasions.has(o.key));
  const materialChips = MATERIAL_CHIPS.filter((m) => draft.material === m.key || presentMaterials.has(m.key));
  const colorChips = products.length
    ? COLORS.filter((c) => presentColors.has(c.key) || !!draft.colors?.includes(c.key))
    : COLORS;
  let n = 0;
  const next = () => ++n;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.backdropTouch} activeOpacity={1} onPress={onClose} />
        {/* Fixed height (not maxHeight): the ScrollView below uses flex:1 and
            collapses to zero inside a parent with no definite height. */}
        <View style={[styles.sheet, { height: screenHeight * 0.88 }]}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={styles.handle} />
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.kickerRow}>
                  <View style={[styles.kickerDot, activeCount > 0 && { backgroundColor: colors.accent2.ochre }]} />
                  <Text style={styles.kicker}>
                    Refine{activeCount > 0 ? ` · ${activeCount} active` : ""}
                  </Text>
                </View>
                <Text style={styles.title}>Filters</Text>
              </View>
              {activeCount > 0 || draftSort !== "newest" ? (
                <TouchableOpacity onPress={handleClear} hitSlop={8} style={styles.resetBtn} activeOpacity={0.8}>
                  <Ionicons name="refresh" size={13} color={colors.accent2.rust} />
                  <Text style={styles.resetText}>Reset</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close filters" activeOpacity={0.8}>
                <Ionicons name="close" size={18} color={colors.ink.DEFAULT} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            style={styles.sheetBody}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.sheetBodyContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Sort — icon tiles, two per row */}
            <Section index={next()} title="Sort by" hint={sortLabel}>
              <View style={styles.sortGrid}>
                {SORTS.map((s) => {
                  const on = draftSort === s.value;
                  return (
                    <TouchableOpacity
                      key={s.value}
                      style={[styles.sortTile, on && styles.sortTileActive]}
                      onPress={() => setDraftSort(s.value)}
                      activeOpacity={0.85}
                      accessibilityState={{ selected: on }}
                    >
                      <View style={[styles.sortIcon, on && styles.sortIconActive]}>
                        <Ionicons
                          name={SORT_ICONS[s.value] ?? "swap-vertical"}
                          size={14}
                          color={on ? colors.olive[950] : s.value === "for_you" ? colors.accent2.ochre : colors.ink.mute}
                        />
                      </View>
                      <Text style={[styles.sortText, on && styles.sortTextActive]} numberOfLines={1}>
                        {s.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Section>

            {/* Price — one joined range field + presets */}
            <Section
              index={next()}
              title="Price"
              hint={priceActive ? `${formatPrice(priceMin)} – ${priceMax >= PRICE_BOUNDS.max ? "any" : formatPrice(priceMax)}` : "LKR"}
            >
              <View style={styles.rangeField}>
                <View style={styles.rangeSide}>
                  <Text style={styles.rangeLabel}>Min</Text>
                  <TextInput
                    value={priceMinInput}
                    onChangeText={setPriceMinInput}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor={`${colors.ink.mute}88`}
                    style={styles.rangeInput}
                  />
                </View>
                <View style={styles.rangeDivider}>
                  <Ionicons name="arrow-forward" size={13} color={colors.ink.mute} />
                </View>
                <View style={styles.rangeSide}>
                  <Text style={styles.rangeLabel}>Max</Text>
                  <TextInput
                    value={priceMaxInput}
                    onChangeText={setPriceMaxInput}
                    keyboardType="number-pad"
                    placeholder="No limit"
                    placeholderTextColor={`${colors.ink.mute}88`}
                    style={styles.rangeInput}
                  />
                </View>
              </View>
              <View style={styles.segment}>
                {PRICE_PRESETS.map((preset) => {
                  const on = priceMin === preset.range[0] && priceMax === preset.range[1];
                  return (
                    <TouchableOpacity
                      key={preset.label}
                      style={[styles.segmentItem, on && styles.segmentItemActive]}
                      onPress={() =>
                        on ? priceToInputs(undefined) : priceToInputs([preset.range[0], preset.range[1]])
                      }
                      activeOpacity={0.85}
                      accessibilityState={{ selected: on }}
                    >
                      <Text style={[styles.segmentText, on && styles.segmentTextActive]} numberOfLines={1}>
                        {preset.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Section>

            {categoryFacets.length > 1 ? (
              <Section
                index={next()}
                title="Category"
                hint={draft.categories?.length ? `${draft.categories.length} selected` : undefined}
              >
                <View style={styles.chipWrap}>
                  {categoryFacets.map((c) => (
                    <Chip
                      key={c.id}
                      label={c.name}
                      count={c.count}
                      active={(draft.categories ?? []).includes(c.id)}
                      onPress={() => toggleIn("categories", c.id)}
                    />
                  ))}
                </View>
              </Section>
            ) : null}

            {brandFacets.length > 1 ? (
              <Section
                index={next()}
                title="Brand"
                hint={draft.brands?.length ? `${draft.brands.length} selected` : undefined}
              >
                <View style={styles.chipWrap}>
                  {brandFacets.map((b) => (
                    <Chip
                      key={b.id}
                      label={b.name}
                      count={b.count}
                      active={(draft.brands ?? []).includes(b.id)}
                      onPress={() => toggleIn("brands", b.id)}
                    />
                  ))}
                </View>
              </Section>
            ) : null}

            {/* Colour — 4-up swatch grid */}
            <Section
              index={next()}
              title="Colour"
              hint={draft.colors?.length ? `${draft.colors.length} selected` : undefined}
            >
              <View style={styles.colorGrid}>
                {colorChips.map((c) => {
                  const on = !!draft.colors?.includes(c.key);
                  const light = c.light;
                  return (
                    <TouchableOpacity
                      key={c.key}
                      style={[styles.colorItem, on && styles.colorItemActive]}
                      onPress={() => toggleIn("colors", c.key)}
                      activeOpacity={0.85}
                      accessibilityLabel={c.name}
                      accessibilityState={{ selected: on }}
                    >
                      <View style={[styles.colorSwatch, { backgroundColor: c.hex }, light && styles.colorSwatchLight]}>
                        {on ? (
                          <Ionicons name="checkmark" size={15} color={light ? colors.ink.DEFAULT : "#fff"} />
                        ) : null}
                      </View>
                      <Text style={[styles.colorName, on && styles.colorNameActive]}>{c.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Section>

            {/* Size — equal tiles */}
            <Section
              index={next()}
              title="Size"
              hint={draft.sizes?.length ? draft.sizes.join(", ") : undefined}
            >
              <View style={styles.sizeGrid}>
                {SIZES.map((sz) => {
                  const on = !!draft.sizes?.includes(sz);
                  return (
                    <TouchableOpacity
                      key={sz}
                      style={[styles.sizeTile, on && styles.sizeTileActive]}
                      onPress={() => toggleIn("sizes", sz)}
                      activeOpacity={0.85}
                      accessibilityLabel={`Size ${sz}`}
                      accessibilityState={{ selected: on }}
                    >
                      <Text style={[styles.sizeText, on && styles.sizeTextActive]}>{sz}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Section>

            {occasionChips.length > 0 ? (
              <Section index={next()} title="Occasion">
                <View style={styles.chipWrap}>
                  {occasionChips.map((o) => (
                    <Chip
                      key={o.key}
                      label={o.label}
                      active={draft.occasion === o.key}
                      onPress={() => setDraft({ ...draft, occasion: draft.occasion === o.key ? undefined : o.key })}
                    />
                  ))}
                </View>
              </Section>
            ) : null}

            {materialChips.length > 0 ? (
              <Section index={next()} title="Material">
                <View style={styles.chipWrap}>
                  {materialChips.map((m) => (
                    <Chip
                      key={m.key}
                      label={m.label}
                      active={draft.material === m.key}
                      onPress={() => setDraft({ ...draft, material: draft.material === m.key ? undefined : m.key })}
                    />
                  ))}
                </View>
              </Section>
            ) : null}

            {/* Discount + rating side-by-side style: segmented rows */}
            <Section index={next()} title="Discount">
              <View style={styles.segment}>
                {DISCOUNTS.map((d) => {
                  const on = draft.minDiscount === d.min;
                  return (
                    <TouchableOpacity
                      key={d.min}
                      style={[styles.segmentItem, on && styles.segmentItemActive]}
                      onPress={() => setDraft({ ...draft, minDiscount: on ? 0 : d.min })}
                      activeOpacity={0.85}
                      accessibilityLabel={d.label}
                      accessibilityState={{ selected: on }}
                    >
                      <Text style={[styles.segmentText, on && styles.segmentTextActive]}>{d.min}%+</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Section>

            <Section index={next()} title="Rating">
              <View style={styles.segment}>
                {RATINGS.map((r) => {
                  const on = (draft.minRating ?? 0) === r;
                  return (
                    <TouchableOpacity
                      key={String(r)}
                      style={[styles.segmentItem, on && styles.segmentItemActive]}
                      onPress={() => setDraft({ ...draft, minRating: r })}
                      activeOpacity={0.85}
                      accessibilityLabel={r === 0 ? "Any rating" : `${r} stars and up`}
                      accessibilityState={{ selected: on }}
                    >
                      {r > 0 ? (
                        <Ionicons name="star" size={11} color={on ? colors.accent2.ochre : colors.accent2.ochre} />
                      ) : null}
                      <Text style={[styles.segmentText, on && styles.segmentTextActive]}>
                        {r === 0 ? "Any" : `${r}+`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Section>

            <Section index={next()} title="Gender">
              <View style={styles.segment}>
                {GENDERS.map((g) => {
                  const on = (draft.gender || "") === g.key;
                  return (
                    <TouchableOpacity
                      key={g.key || "all"}
                      style={[styles.segmentItem, on && styles.segmentItemActive]}
                      onPress={() => setDraft({ ...draft, gender: g.key || undefined })}
                      activeOpacity={0.85}
                      accessibilityState={{ selected: on }}
                    >
                      <Text style={[styles.segmentText, on && styles.segmentTextActive]} numberOfLines={1}>
                        {g.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Section>
          </ScrollView>

          {/* Footer */}
          <View style={[styles.sheetFooter, { paddingBottom: Math.max(insets.bottom, spacing[4]) }]}>
            <LinearGradient
              colors={[`${colors.paper.DEFAULT}00`, colors.paper.DEFAULT]}
              style={styles.footerFade}
              pointerEvents="none"
            />
            <TouchableOpacity onPress={handleClear} style={styles.clearBtn} activeOpacity={0.8}>
              <Text style={styles.clearText}>Clear all</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleApply}
              disabled={previewCount === 0}
              style={[styles.applyBtn, previewCount === 0 && styles.applyBtnDisabled]}
              activeOpacity={0.9}
              accessibilityLabel={previewCount === 0 ? "No matches" : `Show ${previewCount} results`}
            >
              <Text style={styles.applyText}>
                {previewCount === 0 ? "No matches" : "Show results"}
              </Text>
              {previewCount > 0 ? (
                <View style={styles.applyCount}>
                  <Text style={styles.applyCountText}>{previewCount}</Text>
                  <Ionicons name="arrow-forward" size={13} color={colors.olive[950]} />
                </View>
              ) : null}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const INK = colors.ink.DEFAULT;
const LINE = `${colors.olive[900]}1F`;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(22, 23, 15, 0.55)",
  },
  backdropTouch: {
    position: "absolute",
    inset: 0,
  },
  sheet: {
    backgroundColor: colors.paper.DEFAULT,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: "hidden",
  },

  /* Header */
  sheetHeader: {
    paddingHorizontal: spacing[5],
    paddingTop: 10,
    paddingBottom: spacing[3],
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: `${colors.olive[900]}26`,
    alignSelf: "center",
    marginBottom: spacing[4],
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing[2],
  },
  kickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  kickerDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.olive[500],
  },
  kicker: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: colors.ink.mute,
  },
  title: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.5,
    color: INK,
  },
  resetBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: radii.full,
    backgroundColor: `${colors.accent2.rust}14`,
  },
  resetText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: colors.accent2.rust,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },

  /* Body */
  sheetBody: {
    flex: 1,
  },
  sheetBodyContent: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[1],
    paddingBottom: spacing[8],
    gap: 10,
  },
  section: {
    gap: 14,
    padding: spacing[4],
    borderRadius: 22,
    backgroundColor: "#ffffff",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionIndex: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.olive[500],
  },
  sectionTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 17,
    color: INK,
  },
  sectionHint: {
    maxWidth: "55%",
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radii.full,
    backgroundColor: colors.olive[50],
  },
  sectionHintText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    color: colors.olive[700],
  },

  /* Generic chip */
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: radii.full,
    backgroundColor: colors.paper.DEFAULT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
  chipActive: {
    backgroundColor: INK,
    borderColor: INK,
  },
  chipText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 13,
    color: INK,
  },
  chipTextActive: {
    color: colors.paper.cream,
    fontFamily: fontFamilies.sans.semibold,
  },
  chipCount: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    color: colors.ink.mute,
  },
  chipCountActive: {
    color: colors.olive[300],
  },

  /* Sort tiles */
  sortGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 8,
  },
  sortTile: {
    width: "48.5%",
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    height: 48,
    paddingHorizontal: 8,
    borderRadius: 16,
    backgroundColor: colors.paper.DEFAULT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
  sortTileActive: {
    backgroundColor: INK,
    borderColor: INK,
  },
  sortIcon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  sortIconActive: {
    backgroundColor: colors.olive[200],
  },
  sortText: {
    flex: 1,
    fontFamily: fontFamilies.sans.medium,
    fontSize: 13,
    color: INK,
  },
  sortTextActive: {
    color: colors.paper.cream,
    fontFamily: fontFamilies.sans.semibold,
  },

  /* Price range */
  rangeField: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    backgroundColor: colors.paper.DEFAULT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
  rangeSide: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 9,
    paddingBottom: 7,
  },
  rangeLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.ink.mute,
  },
  rangeInput: {
    height: 28,
    paddingVertical: 0,
    fontFamily: fontFamilies.display.semibold,
    fontSize: 18,
    color: INK,
  },
  rangeDivider: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },

  /* Segmented rows (price presets, discount, rating, gender) */
  segment: {
    flexDirection: "row",
    padding: 4,
    gap: 2,
    borderRadius: 14,
    backgroundColor: `${colors.olive[900]}0D`,
  },
  segmentItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    height: 36,
    borderRadius: 11,
  },
  segmentItemActive: {
    backgroundColor: "#ffffff",
    shadowColor: INK,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 2,
  },
  segmentText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12,
    color: colors.light.mutedForeground,
  },
  segmentTextActive: {
    fontFamily: fontFamilies.sans.bold,
    color: INK,
  },

  /* Colour grid */
  colorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 8,
  },
  colorItem: {
    width: "23%",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "transparent",
  },
  colorItemActive: {
    backgroundColor: colors.paper.DEFAULT,
    borderColor: INK,
  },
  colorSwatch: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: INK,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
  },
  colorSwatchLight: {
    borderWidth: 1,
    borderColor: LINE,
  },
  colorName: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 11,
    color: colors.ink.mute,
  },
  colorNameActive: {
    color: INK,
    fontFamily: fontFamilies.sans.bold,
  },

  /* Size grid */
  sizeGrid: {
    flexDirection: "row",
    gap: 6,
  },
  sizeTile: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.paper.DEFAULT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
  },
  sizeTileActive: {
    backgroundColor: INK,
    borderColor: INK,
  },
  sizeText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: INK,
  },
  sizeTextActive: {
    color: colors.paper.cream,
  },

  /* Footer */
  sheetFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    backgroundColor: colors.paper.DEFAULT,
  },
  footerFade: {
    position: "absolute",
    top: -28,
    left: 0,
    right: 0,
    height: 28,
  },
  clearBtn: {
    height: 54,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  clearText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14,
    color: INK,
    textDecorationLine: "underline",
  },
  applyBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 54,
    paddingLeft: 22,
    paddingRight: 8,
    borderRadius: radii.full,
    backgroundColor: INK,
    shadowColor: INK,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
  },
  applyBtnDisabled: {
    backgroundColor: colors.ink.mute,
    shadowOpacity: 0,
    justifyContent: "center",
    paddingRight: 22,
  },
  applyText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 15,
    color: colors.paper.cream,
  },
  applyCount: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 38,
    paddingHorizontal: 14,
    borderRadius: radii.full,
    backgroundColor: colors.olive[200],
  },
  applyCountText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 13,
    color: colors.olive[950],
  },
});
