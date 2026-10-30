import React from "react";
import { View, ScrollView, TouchableOpacity, StyleSheet, Text } from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { QuickRefine } from "@/components/search/QuickRefine";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";
import {
  VIEW_MODES,
  PRICE_BOUNDS,
  type ProductFilters,
  type SortOption,
  type ViewMode,
} from "@/lib/api/facets";

interface ProductGridControlsProps {
  sort: string;
  setSort: (s: string) => void;
  sorts: SortOption[];
  view: ViewMode;
  setView: (v: ViewMode) => void;
  filterCount: number;
  openFilter: () => void;
  filters: ProductFilters;
  setFilters: (f: ProductFilters) => void;
  /** Optional result summary shown left of the view toggle, e.g. "20 pieces". */
  summary?: string;
  /** Restrict the view toggle (e.g. Search has no editorial view). */
  viewModes?: ViewMode[];
}

interface ActiveFacet {
  key: string;
  label: string;
  remove: (f: ProductFilters) => ProductFilters;
}

/** Flatten the current filters into removable pills. Brand/category facets
 *  are id-based, so they collapse into a single "N brands" pill. */
function activeFacets(f: ProductFilters): ActiveFacet[] {
  const out: ActiveFacet[] = [];
  if (f.price && (f.price[0] > PRICE_BOUNDS.min || f.price[1] < PRICE_BOUNDS.max)) {
    const [lo, hi] = f.price;
    out.push({
      key: "price",
      label: hi >= PRICE_BOUNDS.max ? `${formatPrice(lo)}+` : `${formatPrice(lo)} – ${formatPrice(hi)}`,
      remove: (x) => ({ ...x, price: [PRICE_BOUNDS.min, PRICE_BOUNDS.max] }),
    });
  }
  if (f.minDiscount) {
    out.push({ key: "disc", label: `${f.minDiscount}%+ off`, remove: (x) => ({ ...x, minDiscount: 0 }) });
  }
  if (f.minRating) {
    out.push({ key: "rating", label: `${f.minRating}★ & up`, remove: (x) => ({ ...x, minRating: 0 }) });
  }
  if (f.gender) {
    out.push({
      key: "gender",
      label: f.gender.charAt(0).toUpperCase() + f.gender.slice(1),
      remove: (x) => ({ ...x, gender: undefined }),
    });
  }
  for (const c of f.colors ?? []) {
    out.push({ key: `c-${c}`, label: c, remove: (x) => ({ ...x, colors: (x.colors ?? []).filter((v) => v !== c) }) });
  }
  for (const s of f.sizes ?? []) {
    out.push({ key: `s-${s}`, label: `Size ${s}`, remove: (x) => ({ ...x, sizes: (x.sizes ?? []).filter((v) => v !== s) }) });
  }
  const nCat = f.categories?.length ?? 0;
  if (nCat) {
    out.push({ key: "cats", label: nCat === 1 ? "1 category" : `${nCat} categories`, remove: (x) => ({ ...x, categories: [] }) });
  }
  const nBrand = f.brands?.length ?? 0;
  if (nBrand) {
    out.push({ key: "brands", label: nBrand === 1 ? "1 brand" : `${nBrand} brands`, remove: (x) => ({ ...x, brands: [] }) });
  }
  return out;
}

/**
 * Sort bar + Filters button + grid/list toggle + QuickRefine row — the
 * toolbar shown above a paginated product grid. Shared by the Shop screen
 * and Home's appended "browse everything" section so both stay in sync.
 */
export function ProductGridControls({
  sort,
  setSort,
  sorts,
  view,
  setView,
  filterCount,
  openFilter,
  filters,
  setFilters,
  summary,
  viewModes,
}: ProductGridControlsProps) {
  const modes = viewModes ? VIEW_MODES.filter((m) => viewModes.includes(m.value)) : VIEW_MODES;
  const facets = activeFacets(filters);
  const hasFilters = filterCount > 0;

  return (
    <View style={styles.root}>
      {/* Filters (pinned) + sort chips (scroll) */}
      <View style={styles.sortRow}>
        <TouchableOpacity
          style={[styles.filterBtn, hasFilters && styles.filterBtnActive]}
          onPress={openFilter}
          activeOpacity={0.85}
          accessibilityLabel={hasFilters ? `Filters, ${filterCount} active` : "Filters"}
        >
          <Ionicons name="options-outline" size={15} color={colors.paper.cream} />
          <Text style={styles.filterText}>Filters</Text>
          {hasFilters ? (
            <View style={styles.filterCount}>
              <Text style={styles.filterCountText}>{filterCount}</Text>
            </View>
          ) : null}
        </TouchableOpacity>

        <View style={styles.sortTrack}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sortBar}
        >
          {sorts.map((opt) => {
            const active = sort === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                onPress={() => setSort(opt.value)}
                activeOpacity={0.85}
                style={[styles.sortChip, active && styles.sortChipActive]}
                accessibilityState={{ selected: active }}
              >
                {opt.value === "for_you" ? (
                  <Ionicons
                    name="sparkles"
                    size={11}
                    color={colors.accent2.ochre}
                  />
                ) : null}
                <Text style={[styles.sortText, active && styles.sortTextActive]}>{opt.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        </View>
      </View>

      <QuickRefine
        filters={filters}
        onChange={setFilters}
        onOpenSheet={openFilter}
        activeCount={filterCount}
        compact
      />

      {facets.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.facetRow}
        >
          {facets.map((f) => (
            <TouchableOpacity
              key={f.key}
              onPress={() => setFilters(f.remove(filters))}
              activeOpacity={0.8}
              style={styles.facetPill}
              accessibilityLabel={`Remove filter ${f.label}`}
            >
              <Text style={styles.facetText}>{f.label}</Text>
              <Ionicons name="close" size={12} color={colors.olive[800]} />
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            onPress={() =>
              setFilters({
                ...filters,
                price: [PRICE_BOUNDS.min, PRICE_BOUNDS.max],
                brands: [],
                categories: [],
                colors: [],
                sizes: [],
                minRating: 0,
                minDiscount: 0,
                gender: undefined,
              })
            }
            activeOpacity={0.7}
            style={styles.clearAll}
          >
            <Text style={styles.clearAllText}>Clear all</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : null}

      {/* Result summary + view toggle */}
      <View style={styles.metaRow}>
        <Text style={styles.summary} numberOfLines={1}>
          {summary ?? ""}
        </Text>
        <View style={styles.viewToggle}>
          {modes.map((m) => {
            const active = view === m.value;
            return (
              <TouchableOpacity
                key={m.value}
                onPress={() => setView(m.value)}
                activeOpacity={0.85}
                style={[styles.viewBtn, active && styles.viewBtnActive]}
                accessibilityLabel={`${m.label} view`}
                accessibilityState={{ selected: active }}
              >
                <Ionicons
                  name={m.icon as any}
                  size={15}
                  color={active ? colors.light.foreground : colors.light.mutedForeground}
                />
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing[3],
    marginBottom: spacing[3],
  },
  sortRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: spacing[4],
  },
  filterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    height: 42,
    paddingLeft: 14,
    paddingRight: 16,
    borderRadius: radii.full,
    backgroundColor: colors.ink.DEFAULT,
    shadowColor: colors.ink.DEFAULT,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 3,
  },
  filterBtnActive: {
    backgroundColor: colors.olive[900],
  },
  filterText: {
    color: colors.paper.cream,
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
  },
  filterCount: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.accent2.ochre,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  filterCountText: {
    color: colors.olive[950],
    fontFamily: fontFamilies.sans.bold,
    fontSize: 10,
  },
  sortTrack: {
    flex: 1,
    height: 42,
    borderRadius: radii.full,
    backgroundColor: `${colors.olive[900]}0D`,
    overflow: "hidden",
  },
  sortBar: {
    padding: 4,
    gap: 2,
    alignItems: "center",
  },
  sortChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 34,
    paddingHorizontal: 14,
    borderRadius: radii.full,
  },
  sortChipActive: {
    backgroundColor: "#ffffff",
    shadowColor: colors.ink.DEFAULT,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 2,
  },
  sortText: {
    color: colors.light.mutedForeground,
    fontFamily: fontFamilies.sans.medium,
    fontSize: 13,
  },
  sortTextActive: {
    color: colors.ink.DEFAULT,
    fontFamily: fontFamilies.sans.bold,
  },
  facetRow: {
    paddingHorizontal: spacing[4],
    gap: 6,
    alignItems: "center",
  },
  facetPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 30,
    paddingLeft: 12,
    paddingRight: 9,
    borderRadius: radii.full,
    backgroundColor: colors.olive[100],
  },
  facetText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    color: colors.olive[900],
  },
  clearAll: {
    height: 30,
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  clearAllText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    color: colors.accent2.rust,
    textDecorationLine: "underline",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[4],
    paddingTop: spacing[1],
    gap: spacing[3],
  },
  summary: {
    flex: 1,
    fontFamily: fontFamilies.mono.medium,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.light.mutedForeground,
  },
  viewToggle: {
    flexDirection: "row",
    backgroundColor: `${colors.olive[900]}0D`,
    borderRadius: radii.full,
    padding: 3,
    gap: 2,
  },
  viewBtn: {
    width: 34,
    height: 28,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
  },
  viewBtnActive: {
    backgroundColor: colors.light.card,
    shadowColor: colors.ink.DEFAULT,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
});
