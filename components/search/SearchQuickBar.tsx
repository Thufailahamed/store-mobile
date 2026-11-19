import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Modal } from "@/components/ui/Modal";
import { Ionicons, type IonIconName } from "@/components/ui/Icon";
import { colors } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { COLORS, SIZES, SORTS } from "@/lib/api/facets";
import type { ProductFilters, SortOption } from "@/lib/api/facets";
import { productColorFamilies } from "@/lib/facet-vocab";
import { applySearchFilters } from "@/lib/search-filters";
import type { Product } from "@/lib/types";

const INK = colors.ink.DEFAULT;
const MUTED = "#6b6b68";
const LINE = "#e6e4dc";

type QuickMode = "sort" | "brand" | "size" | "color";

interface BarProps {
  sort: string;
  filters: ProductFilters;
  products: Product[];
  filterCount: number;
  onSortChange: (sort: string) => void;
  onFiltersChange: (filters: ProductFilters) => void;
  onOpenFilters: () => void;
  /** Sort choices (default: browse SORTS) and the one that counts as "not sorted". */
  sorts?: SortOption[];
  defaultSort?: string;
}

/**
 * Floating bottom action bar for search results: Sort · Brand · Size ·
 * Color | Filters. The first four open a focused quick sheet; Filters opens
 * the full refine sheet.
 */
export function SearchQuickBar({
  sort,
  filters,
  products,
  filterCount,
  onSortChange,
  onFiltersChange,
  onOpenFilters,
  sorts = SORTS,
  defaultSort = "newest",
}: BarProps) {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<QuickMode | null>(null);

  const items: { key: QuickMode; label: string; icon: IonIconName; active: boolean }[] = [
    { key: "sort", label: "Sort", icon: "swap-vertical", active: sort !== defaultSort },
    { key: "brand", label: "Brand", icon: "pricetag-outline", active: !!filters.brands?.length },
    { key: "size", label: "Size", icon: "resize-outline", active: !!filters.sizes?.length },
    { key: "color", label: "Color", icon: "color-palette-outline", active: !!filters.colors?.length },
  ];

  return (
    <>
      <View style={[styles.wrap, { bottom: Math.max(insets.bottom, 10) + 6 }]} pointerEvents="box-none">
        <View style={styles.bar}>
          {items.map((it) => (
            <TouchableOpacity
              key={it.key}
              style={styles.item}
              activeOpacity={0.7}
              onPress={() => setMode(it.key)}
              accessibilityRole="button"
              accessibilityLabel={it.label}
              accessibilityState={{ selected: it.active }}
            >
              <View>
                <Ionicons name={it.icon} size={21} color={INK} />
                {it.active ? <View style={styles.dot} /> : null}
              </View>
              <Text style={styles.label}>{it.label}</Text>
            </TouchableOpacity>
          ))}
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.item}
            activeOpacity={0.7}
            onPress={onOpenFilters}
            accessibilityRole="button"
            accessibilityLabel={filterCount > 0 ? `Filters, ${filterCount} active` : "Filters"}
          >
            <View>
              <Ionicons name="options-outline" size={21} color={INK} />
              {filterCount > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{filterCount}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.label}>Filters</Text>
          </TouchableOpacity>
        </View>
      </View>

      <QuickSheet
        mode={mode}
        onClose={() => setMode(null)}
        sort={sort}
        sorts={sorts}
        filters={filters}
        products={products}
        onSortChange={onSortChange}
        onFiltersChange={onFiltersChange}
      />
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────── */

function QuickSheet({
  mode,
  onClose,
  sort,
  sorts,
  filters,
  products,
  onSortChange,
  onFiltersChange,
}: {
  mode: QuickMode | null;
  onClose: () => void;
  sort: string;
  sorts: SortOption[];
  filters: ProductFilters;
  products: Product[];
  onSortChange: (s: string) => void;
  onFiltersChange: (f: ProductFilters) => void;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [draft, setDraft] = useState<string[]>([]);

  const key = mode === "brand" ? "brands" : mode === "size" ? "sizes" : mode === "color" ? "colors" : null;

  useEffect(() => {
    if (mode && key) setDraft([...(filters[key] ?? [])]);
    // Reset only when the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const brandOptions = useMemo(() => {
    const m = new Map<string, { label: string; count: number }>();
    for (const p of products) {
      const id = p.brand_id ?? p.brand?.id;
      if (id && p.brand?.name) m.set(id, { label: p.brand.name, count: (m.get(id)?.count ?? 0) + 1 });
    }
    return [...m.entries()].map(([value, v]) => ({ value, ...v })).sort((a, b) => b.count - a.count);
  }, [products]);

  const colorOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of products) for (const f of new Set(productColorFamilies(p))) counts.set(f, (counts.get(f) ?? 0) + 1);
    return COLORS.filter((c) => counts.has(c.key) || draft.includes(c.key)).map((c) => ({
      value: c.key,
      label: c.name,
      hex: c.hex,
      light: c.light,
      count: counts.get(c.key) ?? 0,
    }));
  }, [products, draft]);

  const preview = useMemo(
    () => (key ? applySearchFilters(products, { ...filters, [key]: draft }).length : 0),
    [products, filters, key, draft],
  );

  if (!mode) return null;

  const toggle = (v: string) => setDraft((d) => (d.includes(v) ? d.filter((x) => x !== v) : [...d, v]));
  const apply = () => {
    if (key) onFiltersChange({ ...filters, [key]: draft });
    onClose();
  };

  const title = mode === "sort" ? "Sort by" : mode === "brand" ? "Brand" : mode === "size" ? "Size" : "Color";

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { maxHeight: height * 0.7, paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.handle} />
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>{title}</Text>
            {key && draft.length > 0 ? (
              <TouchableOpacity onPress={() => setDraft([])} hitSlop={8}>
                <Text style={styles.clear}>Clear</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {mode === "sort" ? (
            <View>
              {sorts.map((s) => {
                const on = s.value === sort;
                return (
                  <TouchableOpacity
                    key={s.value}
                    style={styles.row}
                    activeOpacity={0.7}
                    onPress={() => {
                      onSortChange(s.value);
                      onClose();
                    }}
                    accessibilityState={{ selected: on }}
                  >
                    <Text style={[styles.rowText, on && styles.rowTextOn]}>{s.label}</Text>
                    <Ionicons
                      name={on ? "radio-button-on" : "radio-button-off"}
                      size={20}
                      color={on ? INK : "#b5b4ad"}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <>
              <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={styles.body}>
                {mode === "size" ? (
                  <View style={styles.sizeWrap}>
                    {SIZES.map((sz) => {
                      const on = draft.includes(sz);
                      return (
                        <TouchableOpacity
                          key={sz}
                          style={[styles.sizeChip, on && styles.sizeChipOn]}
                          onPress={() => toggle(sz)}
                          activeOpacity={0.8}
                          accessibilityState={{ selected: on }}
                        >
                          <Text style={[styles.sizeText, on && styles.sizeTextOn]}>{sz}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : (mode === "brand" ? brandOptions : colorOptions).length === 0 ? (
                  <Text style={styles.empty}>No {title.toLowerCase()} options in these results.</Text>
                ) : (
                  (mode === "brand" ? brandOptions : colorOptions).map((o) => {
                    const on = draft.includes(o.value);
                    const hex = "hex" in o ? (o as { hex: string; light?: boolean }) : null;
                    return (
                      <TouchableOpacity
                        key={o.value}
                        style={styles.row}
                        activeOpacity={0.7}
                        onPress={() => toggle(o.value)}
                        accessibilityState={{ selected: on }}
                      >
                        <Ionicons name={on ? "checkbox" : "square-outline"} size={21} color={on ? INK : "#b5b4ad"} />
                        {hex ? (
                          <View
                            style={[
                              styles.swatch,
                              { backgroundColor: hex.hex },
                              hex.light && { borderWidth: 1, borderColor: LINE },
                            ]}
                          />
                        ) : null}
                        <Text style={[styles.rowText, { flex: 1 }, on && styles.rowTextOn]} numberOfLines={1}>
                          {o.label}
                        </Text>
                        <Text style={styles.count}>{o.count}</Text>
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>
              <TouchableOpacity style={styles.applyBtn} activeOpacity={0.85} onPress={apply}>
                <Text style={styles.applyText}>
                  Show {preview} {preview === 1 ? "item" : "items"}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 16, right: 16 },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    height: 66,
    paddingHorizontal: 6,
    borderRadius: 33,
    backgroundColor: "#ffffff",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 10,
  },
  item: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3, height: "100%" },
  label: { fontFamily: fontFamilies.sans.medium, fontSize: 12, color: INK },
  divider: { width: StyleSheet.hairlineWidth, height: 34, backgroundColor: "#c9c9c4" },
  dot: {
    position: "absolute",
    top: -1,
    right: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent2.rust,
  },
  badge: {
    position: "absolute",
    top: -6,
    right: -10,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: colors.accent2.rust,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontFamily: fontFamilies.sans.bold, fontSize: 10, color: "#fff" },

  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(16,17,12,0.4)" },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
  },
  handle: { alignSelf: "center", width: 38, height: 4, borderRadius: 2, backgroundColor: "#d8d6cf", marginTop: 10 },
  sheetHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
  },
  sheetTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 16, letterSpacing: 0.4, color: INK },
  clear: { fontFamily: fontFamilies.sans.semibold, fontSize: 13.5, color: colors.accent2.rust },
  body: { paddingVertical: 6 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 50,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
  },
  rowText: { flex: 1, fontFamily: fontFamilies.sans.regular, fontSize: 15, color: "#3d3d3a" },
  rowTextOn: { fontFamily: fontFamilies.sans.semibold, color: INK },
  count: { fontFamily: fontFamilies.sans.medium, fontSize: 13, color: MUTED },
  swatch: { width: 18, height: 18, borderRadius: 9 },
  empty: { fontFamily: fontFamilies.sans.regular, fontSize: 14, color: MUTED, paddingVertical: 20 },
  sizeWrap: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingVertical: 14 },
  sizeChip: {
    minWidth: 56,
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#cfcdc5",
    alignItems: "center",
    justifyContent: "center",
  },
  sizeChipOn: { backgroundColor: INK, borderColor: INK },
  sizeText: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: INK },
  sizeTextOn: { color: "#fff" },
  applyBtn: {
    marginTop: 12,
    height: 52,
    borderRadius: 26,
    backgroundColor: INK,
    alignItems: "center",
    justifyContent: "center",
  },
  applyText: { fontFamily: fontFamilies.sans.bold, fontSize: 15, color: "#fff", letterSpacing: 0.3 },
});
