import React from "react";
import { View, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { Label } from "@/components/ui/Typography";
import { QuickRefine } from "@/components/search/QuickRefine";
import { colors, radii, shadows, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { VIEW_MODES, type ProductFilters, type SortOption, type ViewMode } from "@/lib/api/facets";

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
}

/**
 * Sort bar + Refine button + grid/list toggle + QuickRefine row — the
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
}: ProductGridControlsProps) {
  return (
    <View>
      <View style={styles.controlsSurface}>
        <View style={styles.controlsHeader}>
          <View>
            <Label style={styles.controlsKicker}>Browse controls</Label>
            <Label style={styles.controlsMeta}>
              {sorts.find((option) => option.value === sort)?.label ?? "Sort"} · {VIEW_MODES.find((mode) => mode.value === view)?.label ?? "Grid"}
            </Label>
          </View>
          {filterCount > 0 ? (
            <View style={styles.activeFilterPill}>
              <Label style={styles.activeFilterText}>{filterCount} active</Label>
            </View>
          ) : null}
        </View>

        <View style={styles.toolbar}>
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
                  activeOpacity={0.8}
                  style={[styles.sortChip, active && styles.sortChipActive]}
                >
                  <Label style={[styles.sortText, active && styles.sortTextActive]}>
                    {opt.label}
                  </Label>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.secondaryBar}>
          <TouchableOpacity style={styles.refineBtn} onPress={openFilter} activeOpacity={0.8}>
            <Ionicons name="options-outline" size={14} color={colors.light.primary} />
            <Label style={styles.refineText}>Refine catalogue</Label>
            {filterCount > 0 ? (
              <View style={styles.refineCount}>
                <Label style={styles.refineCountText}>{filterCount}</Label>
              </View>
            ) : null}
          </TouchableOpacity>

          <View style={styles.viewToggle}>
            {VIEW_MODES.map((m) => {
              const active = view === m.value;
              return (
                <TouchableOpacity
                  key={m.value}
                  onPress={() => setView(m.value)}
                  activeOpacity={0.8}
                  style={[styles.viewBtn, active && styles.viewBtnActive]}
                  accessibilityLabel={m.label}
                  accessibilityState={{ selected: active }}
                >
                  <Ionicons
                    name={m.icon as any}
                    size={16}
                    color={active ? colors.light.primaryForeground : colors.light.foreground}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>

      <QuickRefine
        filters={filters}
        onChange={setFilters}
        onOpenSheet={openFilter}
        activeCount={filterCount}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  controlsSurface: {
    marginHorizontal: spacing[5],
    marginBottom: spacing[3],
    paddingVertical: spacing[3],
    borderRadius: radii.xl,
    backgroundColor: colors.paper.cream,
    borderWidth: 1,
    borderColor: colors.light.border,
    overflow: "hidden",
    ...shadows.soft,
  },
  controlsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[3],
    marginBottom: spacing[1],
  },
  controlsKicker: {
    color: colors.olive[700],
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: typography.letterSpacing.wide,
    textTransform: "uppercase",
  },
  controlsMeta: {
    color: colors.light.mutedForeground,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 10,
    marginTop: 2,
  },
  activeFilterPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: "rgba(200,164,74,0.18)",
  },
  activeFilterText: {
    color: colors.olive[800],
    fontSize: 9,
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing[2],
  },
  sortBar: {
    paddingHorizontal: spacing[3],
    gap: 8,
  },
  sortChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.light.card,
  },
  sortChipActive: {
    backgroundColor: colors.light.foreground,
    borderColor: colors.light.foreground,
  },
  sortText: {
    color: colors.light.foreground,
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: typography.letterSpacing.wide,
  },
  sortTextActive: {
    color: colors.light.primaryForeground,
  },
  secondaryBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[3],
    paddingTop: spacing[2],
    marginTop: spacing[1],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.light.border,
  },
  refineBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.light.card,
  },
  refineText: {
    color: colors.light.primary,
    fontFamily: fontFamilies.mono.medium,
    fontSize: 11,
    letterSpacing: typography.letterSpacing.wide,
  },
  refineCount: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.accent2.rust,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  refineCountText: {
    color: "#fff",
    fontSize: 9,
  },
  viewToggle: {
    flexDirection: "row",
    backgroundColor: colors.light.card,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: 3,
    gap: 2,
  },
  viewBtn: {
    width: 30,
    height: 28,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
  },
  viewBtnActive: {
    backgroundColor: colors.light.foreground,
  },
});
