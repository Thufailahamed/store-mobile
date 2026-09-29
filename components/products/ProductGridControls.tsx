import React from "react";
import { View, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { Body, Label } from "@/components/ui/Typography";
import { QuickRefine } from "@/components/search/QuickRefine";
import { colors, radii, spacing } from "@/lib/theme/tokens";
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
  /** Optional result summary shown left of the view toggle, e.g. "20 pieces". */
  summary?: string;
  /** Restrict the view toggle (e.g. Search has no editorial view). */
  viewModes?: ViewMode[];
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
  return (
    <View style={styles.root}>
      {/* Filters (pinned) + sort chips (scroll) */}
      <View style={styles.sortRow}>
        <TouchableOpacity
          style={[styles.filterBtn, filterCount > 0 && styles.filterBtnActive]}
          onPress={openFilter}
          activeOpacity={0.8}
          accessibilityLabel={filterCount > 0 ? `Filters, ${filterCount} active` : "Filters"}
        >
          <Ionicons
            name="options-outline"
            size={15}
            color={filterCount > 0 ? colors.light.primaryForeground : colors.light.foreground}
          />
          <Body size="sm" style={[styles.filterText, filterCount > 0 && styles.filterTextActive]}>
            Filters
          </Body>
          {filterCount > 0 ? (
            <View style={styles.filterCount}>
              <Label style={styles.filterCountText}>{filterCount}</Label>
            </View>
          ) : null}
        </TouchableOpacity>

        <View style={styles.sortDivider} />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sortBar}
          style={styles.sortScroll}
        >
          {sorts.map((opt) => {
            const active = sort === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                onPress={() => setSort(opt.value)}
                activeOpacity={0.8}
                style={[styles.sortChip, active && styles.sortChipActive]}
                accessibilityState={{ selected: active }}
              >
                <Body size="sm" style={[styles.sortText, active && styles.sortTextActive]}>
                  {opt.label}
                </Body>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <QuickRefine
        filters={filters}
        onChange={setFilters}
        onOpenSheet={openFilter}
        activeCount={filterCount}
        compact
      />

      {/* Result summary + view toggle */}
      <View style={styles.metaRow}>
        <Body size="sm" muted style={styles.summary} numberOfLines={1}>
          {summary ?? ""}
        </Body>
        <View style={styles.viewToggle}>
          {modes.map((m) => {
            const active = view === m.value;
            return (
              <TouchableOpacity
                key={m.value}
                onPress={() => setView(m.value)}
                activeOpacity={0.8}
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
    gap: spacing[2],
    marginBottom: spacing[2],
  },
  sortRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: spacing[4],
  },
  filterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.light.card,
  },
  filterBtnActive: {
    backgroundColor: colors.light.foreground,
    borderColor: colors.light.foreground,
  },
  filterText: {
    color: colors.light.foreground,
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
  },
  filterTextActive: {
    color: colors.light.primaryForeground,
  },
  filterCount: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.accent2.rust,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  filterCountText: {
    color: "#fff",
    fontSize: 10,
  },
  sortDivider: {
    width: StyleSheet.hairlineWidth,
    height: 22,
    backgroundColor: colors.light.border,
    marginLeft: spacing[2],
  },
  sortScroll: {
    flex: 1,
  },
  sortBar: {
    paddingLeft: spacing[2],
    paddingRight: spacing[4],
    gap: 6,
  },
  sortChip: {
    height: 36,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: radii.full,
  },
  sortChipActive: {
    backgroundColor: `${colors.olive[900]}12`,
  },
  sortText: {
    color: colors.light.mutedForeground,
    fontFamily: fontFamilies.sans.medium,
    fontSize: 13,
  },
  sortTextActive: {
    color: colors.light.foreground,
    fontFamily: fontFamilies.sans.semibold,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[4],
    gap: spacing[3],
  },
  summary: {
    flex: 1,
    fontSize: 13,
  },
  viewToggle: {
    flexDirection: "row",
    backgroundColor: `${colors.olive[900]}0D`,
    borderRadius: radii.full,
    padding: 3,
    gap: 2,
  },
  viewBtn: {
    width: 32,
    height: 28,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
  },
  viewBtnActive: {
    backgroundColor: colors.light.card,
  },
});
