import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Modal } from "@/components/ui/Modal";
import { Ionicons } from "@/components/ui/Icon";
import {
  EMPTY_STORE_FILTERS,
  STORE_SORTS,
  countActiveStoreFilters,
  filterStoreProducts,
  pricePresets,
  type FacetCount,
  type StoreFacets,
  type StoreFilters,
  type StoreSort,
} from "@/lib/store-catalogue";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import type { Product } from "@/lib/types";

type ListKey = "categories" | "genders" | "sizes" | "colors" | "brands";

/**
 * Bottom sheet holding every store filter plus sort. Edits a draft; the
 * footer shows the live result count and applies on tap.
 */
export function StoreFilterSheet({
  visible,
  onClose,
  products,
  facets,
  currency,
  filters,
  sort,
  onApply,
}: {
  visible: boolean;
  onClose: () => void;
  products: Product[];
  facets: StoreFacets;
  currency: string;
  filters: StoreFilters;
  sort: StoreSort;
  onApply: (filters: StoreFilters, sort: StoreSort) => void;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [draft, setDraft] = useState(filters);
  const [draftSort, setDraftSort] = useState(sort);

  // Re-seed the draft each time the sheet opens.
  useEffect(() => {
    if (visible) {
      setDraft(filters);
      setDraftSort(sort);
    }
  }, [visible, filters, sort]);

  const count = useMemo(() => filterStoreProducts(products, draft).length, [products, draft]);
  const presets = useMemo(() => pricePresets(facets.price, currency), [facets.price, currency]);
  const activeCount = countActiveStoreFilters(draft);

  const toggle = (key: ListKey, value: string) =>
    setDraft((d) => ({
      ...d,
      [key]: d[key].includes(value) ? d[key].filter((v) => v !== value) : [...d[key], value],
    }));

  const sorts = STORE_SORTS.filter((s) => s.value !== "rating" || facets.ratedCount > 0);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close filters" />
        <View style={[styles.sheet, { maxHeight: height * 0.88, paddingBottom: insets.bottom + spacing[3] }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Pressable onPress={onClose} hitSlop={10} style={styles.headerIcon} accessibilityLabel="Close">
              <Ionicons name="close" size={20} color={colors.ink.DEFAULT} />
            </Pressable>
            <Text style={styles.headerTitle}>Filter & sort</Text>
            <Pressable
              onPress={() => {
                setDraft({ ...EMPTY_STORE_FILTERS, query: draft.query });
                setDraftSort("curated");
              }}
              hitSlop={10}
              disabled={!activeCount && draftSort === "curated"}
            >
              <Text style={[styles.reset, !activeCount && draftSort === "curated" && { opacity: 0.35 }]}>Reset</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            <Group title="Sort by">
              <View style={styles.sortList}>
                {sorts.map((s) => {
                  const active = draftSort === s.value;
                  return (
                    <Pressable
                      key={s.value}
                      onPress={() => setDraftSort(s.value)}
                      style={styles.sortRow}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: active }}
                    >
                      <Text style={[styles.sortText, active && styles.sortTextActive]}>{s.label}</Text>
                      <View style={[styles.radio, active && styles.radioActive]}>
                        {active ? <View style={styles.radioDot} /> : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </Group>

            {facets.categories.length > 1 ? (
              <Group title="Category" selected={draft.categories.length}>
                <ChipList items={facets.categories} selected={draft.categories} onToggle={(v) => toggle("categories", v)} />
              </Group>
            ) : null}

            {facets.genders.length > 1 ? (
              <Group title="Shop for" selected={draft.genders.length}>
                <ChipList items={facets.genders} selected={draft.genders} onToggle={(v) => toggle("genders", v)} />
              </Group>
            ) : null}

            {facets.sizes.length ? (
              <Group title="Size" selected={draft.sizes.length}>
                <View style={styles.wrap}>
                  {facets.sizes.map((s) => {
                    const active = draft.sizes.includes(s.value);
                    return (
                      <Pressable
                        key={s.value}
                        onPress={() => toggle("sizes", s.value)}
                        style={[styles.size, active && styles.sizeActive]}
                        accessibilityState={{ selected: active }}
                      >
                        <Text style={[styles.sizeText, active && styles.sizeTextActive]}>{s.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Group>
            ) : null}

            {facets.colors.length ? (
              <Group title="Colour" selected={draft.colors.length}>
                <View style={styles.colorGrid}>
                  {facets.colors.map((c) => {
                    const active = draft.colors.includes(c.value);
                    return (
                      <Pressable
                        key={c.value}
                        onPress={() => toggle("colors", c.value)}
                        style={styles.colorItem}
                        accessibilityLabel={c.label}
                        accessibilityState={{ selected: active }}
                      >
                        <View style={[styles.swatchRing, active && styles.swatchRingActive]}>
                          <View style={[styles.swatch, { backgroundColor: c.hex }]}>
                            {active ? (
                              <Ionicons name="checkmark" size={14} color={isLight(c.hex) ? colors.ink.DEFAULT : "#fff"} />
                            ) : null}
                          </View>
                        </View>
                        <Text style={[styles.colorLabel, active && { color: colors.ink.DEFAULT }]} numberOfLines={1}>
                          {c.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Group>
            ) : null}

            {facets.brands.length > 1 ? (
              <Group title="Brand" selected={draft.brands.length}>
                <ChipList items={facets.brands} selected={draft.brands} onToggle={(v) => toggle("brands", v)} />
              </Group>
            ) : null}

            {facets.price.max > facets.price.min ? (
              <Group title="Price" selected={draft.price ? 1 : 0}>
                <View style={styles.priceGrid}>
                  {presets.map((p) => {
                    const active = draft.price?.[0] === p.range[0] && draft.price?.[1] === p.range[1];
                    return (
                      <Pressable
                        key={p.label}
                        onPress={() => setDraft((d) => ({ ...d, price: active ? null : p.range }))}
                        style={[styles.price, active && styles.priceActive]}
                        accessibilityState={{ selected: active }}
                      >
                        <Text style={[styles.priceText, active && styles.priceTextActive]} numberOfLines={2}>
                          {p.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Group>
            ) : null}

            {facets.onSaleCount > 0 || facets.ratedCount > 0 ? (
              <Group title="Availability" last>
                {facets.onSaleCount > 0 ? (
                  <ToggleRow
                    icon="pricetag-outline"
                    label="On sale"
                    hint={`${facets.onSaleCount} marked down`}
                    on={draft.onSale}
                    onPress={() => setDraft((d) => ({ ...d, onSale: !d.onSale }))}
                  />
                ) : null}
                {facets.ratedCount > 0 ? (
                  <ToggleRow
                    icon="star-outline"
                    label="Rated 4★ & up"
                    hint={`${facets.ratedCount} loved pieces`}
                    on={draft.minRating >= 4}
                    onPress={() => setDraft((d) => ({ ...d, minRating: d.minRating >= 4 ? 0 : 4 }))}
                  />
                ) : null}
              </Group>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              onPress={() => onApply(draft, draftSort)}
              disabled={count === 0}
              style={({ pressed }) => [styles.apply, pressed && { opacity: 0.9 }, count === 0 && { opacity: 0.5 }]}
              accessibilityRole="button"
            >
              <LinearGradient colors={[colors.ink.soft, colors.ink.DEFAULT]} style={StyleSheet.absoluteFill} />
              <Text style={styles.applyText}>
                {count === 0 ? "No matching pieces" : `Show ${count} ${count === 1 ? "piece" : "pieces"}`}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Group({
  title,
  selected = 0,
  last,
  children,
}: {
  title: string;
  selected?: number;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.group, last && { borderBottomWidth: 0 }]}>
      <View style={styles.groupHead}>
        <Text style={styles.groupTitle}>{title}</Text>
        {selected ? (
          <View style={styles.groupBadge}>
            <Text style={styles.groupBadgeText}>{selected}</Text>
          </View>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function ChipList({
  items,
  selected,
  onToggle,
}: {
  items: FacetCount[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <View style={styles.wrap}>
      {items.map((item) => {
        const active = selected.includes(item.value);
        return (
          <Pressable
            key={item.value}
            onPress={() => onToggle(item.value)}
            style={[styles.chip, active && styles.chipActive]}
            accessibilityState={{ selected: active }}
          >
            {active ? <Ionicons name="checkmark" size={13} color={colors.accent2.ochre} /> : null}
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.label}</Text>
            <Text style={[styles.chipCount, active && { color: "rgba(250,248,241,0.6)" }]}>{item.count}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ToggleRow({
  icon,
  label,
  hint,
  on,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint: string;
  on: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.toggleRow} accessibilityRole="switch" accessibilityState={{ checked: on }}>
      <View style={styles.toggleIcon}>
        <Ionicons name={icon} size={16} color={colors.olive[700]} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.toggleHint}>{hint}</Text>
      </View>
      <View style={[styles.switch, on && styles.switchOn]}>
        <View style={[styles.knob, on && styles.knobOn]} />
      </View>
    </Pressable>
  );
}

function isLight(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 180;
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(22,23,15,0.45)" },
  sheet: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: colors.paper.cream,
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.15,
    shadowRadius: 30,
    elevation: 20,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    marginTop: 10,
    backgroundColor: "rgba(22,23,15,0.18)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    paddingBottom: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(22,23,15,0.12)",
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.paper.warm,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontFamily: fontFamilies.display.regular,
    fontSize: 21,
    color: colors.ink.DEFAULT,
  },
  reset: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13.5,
    color: colors.ink.DEFAULT,
    textDecorationLine: "underline",
  },
  body: { paddingHorizontal: spacing[5], paddingBottom: spacing[4] },

  group: {
    paddingVertical: spacing[5],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(22,23,15,0.1)",
  },
  groupHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: spacing[3] },
  groupTitle: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: colors.ink.DEFAULT,
  },
  groupBadge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent2.ochre,
  },
  groupBadgeText: { fontFamily: fontFamilies.sans.bold, fontSize: 10, color: colors.ink.DEFAULT },

  sortList: { gap: 2 },
  sortRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  sortText: { fontFamily: fontFamilies.sans.regular, fontSize: 15, color: colors.ink.mute },
  sortTextActive: { fontFamily: fontFamilies.sans.semibold, color: colors.ink.DEFAULT },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "rgba(22,23,15,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  radioActive: { borderColor: colors.ink.DEFAULT },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.ink.DEFAULT },

  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 38,
    paddingHorizontal: 14,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "rgba(22,23,15,0.12)",
    backgroundColor: "#fff",
  },
  chipActive: { backgroundColor: colors.ink.DEFAULT, borderColor: colors.ink.DEFAULT },
  chipText: { fontFamily: fontFamilies.sans.medium, fontSize: 13.5, color: colors.ink.DEFAULT },
  chipTextActive: { color: colors.paper.cream },
  chipCount: { fontFamily: fontFamilies.sans.semibold, fontSize: 11, color: colors.ink.mute },

  size: {
    minWidth: 52,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(22,23,15,0.12)",
    backgroundColor: "#fff",
  },
  sizeActive: { backgroundColor: colors.ink.DEFAULT, borderColor: colors.ink.DEFAULT },
  sizeText: { fontFamily: fontFamilies.sans.semibold, fontSize: 13.5, color: colors.ink.DEFAULT },
  sizeTextActive: { color: colors.paper.cream },

  colorGrid: { flexDirection: "row", flexWrap: "wrap", rowGap: spacing[3] },
  colorItem: { width: "20%", alignItems: "center", gap: 6 },
  swatchRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    padding: 3,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  swatchRingActive: { borderColor: colors.ink.DEFAULT },
  swatch: {
    flex: 1,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.15)",
  },
  colorLabel: { fontFamily: fontFamilies.sans.medium, fontSize: 11, color: colors.ink.mute },

  priceGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  price: {
    width: "48.5%",
    minHeight: 46,
    paddingVertical: 8,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "rgba(22,23,15,0.12)",
    backgroundColor: "#fff",
  },
  priceActive: { backgroundColor: colors.ink.DEFAULT, borderColor: colors.ink.DEFAULT },
  priceText: { fontFamily: fontFamilies.sans.medium, fontSize: 12.5, lineHeight: 17, textAlign: "center", color: colors.ink.DEFAULT },
  priceTextActive: { color: colors.paper.cream, fontFamily: fontFamilies.sans.semibold },

  toggleRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  toggleIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.olive[50],
  },
  toggleLabel: { fontFamily: fontFamilies.sans.semibold, fontSize: 14.5, color: colors.ink.DEFAULT },
  toggleHint: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.ink.mute, marginTop: 1 },
  switch: {
    width: 46,
    height: 28,
    borderRadius: 14,
    padding: 3,
    backgroundColor: "rgba(22,23,15,0.14)",
  },
  switchOn: { backgroundColor: colors.olive[600] },
  knob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  knobOn: { transform: [{ translateX: 18 }] },

  footer: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(22,23,15,0.12)",
  },
  apply: {
    height: 54,
    borderRadius: radii.full,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  applyText: { fontFamily: fontFamilies.sans.semibold, fontSize: 15.5, color: colors.paper.cream, letterSpacing: 0.2 },
});
