import React from "react";
import { View, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Label } from "@/components/ui/Typography";
import { COLORS, SIZES, PRICE_BOUNDS, type ProductFilters } from "@/lib/api/facets";
import { colors, radii, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";

interface QuickRefineProps {
  filters: ProductFilters;
  onChange: (next: ProductFilters) => void;
  onOpenSheet: () => void;
  activeCount: number;
}

function ChipLabel({
  children,
  active = false,
}: {
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <Label
      style={[
        styles.chipText,
        active && styles.chipTextActive,
      ]}
    >
      {children}
    </Label>
  );
}

/**
 * QuickRefine — the single row above the grid. Color swatches + size
 * chips + a "Refine" button that opens the full FilterSheet. Mirrors
 * web `components/search/quick-refine.tsx` (mobile-collapsed layout).
 */
export function QuickRefine({ filters, onChange, onOpenSheet, activeCount }: QuickRefineProps) {
  const colors_ = filters.colors ?? [];
  const sizes_ = filters.sizes ?? [];
  const price = filters.price ?? [PRICE_BOUNDS.min, PRICE_BOUNDS.max];
  const priceActive = price[0] > PRICE_BOUNDS.min || price[1] < PRICE_BOUNDS.max;
  const priceLabel = priceActive
    ? `${formatPrice(price[0])} – ${formatPrice(price[1])}`
    : "Any price";

  return (
    <View style={styles.root}>
      <View style={styles.kickerRow}>
        <Label style={styles.kicker}>
          Quick filters · {colors_.length + sizes_.length + (priceActive ? 1 : 0)} active
        </Label>
        <TouchableOpacity onPress={onOpenSheet} style={styles.allBtn} activeOpacity={0.7}>
          <Ionicons name="options-outline" size={12} color={colors.light.primary} />
          <Label style={styles.allBtnText}>All filters</Label>
          {activeCount > 0 ? <View style={styles.dot} /> : null}
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {COLORS.map((c) => {
          const on = colors_.includes(c.name);
          return (
            <TouchableOpacity
              key={c.name}
              onPress={() =>
                onChange({
                  ...filters,
                  colors: on ? colors_.filter((v) => v !== c.name) : [...colors_, c.name],
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

        <View style={styles.divider} />

        {SIZES.map((s) => {
          const on = sizes_.includes(s);
          return (
            <TouchableOpacity
              key={s}
              onPress={() =>
                onChange({
                  ...filters,
                  sizes: on ? sizes_.filter((v) => v !== s) : [...sizes_, s],
                })
              }
              activeOpacity={0.8}
              accessibilityState={{ selected: on }}
              style={[styles.sizeChip, on && styles.sizeChipActive]}
            >
              <ChipLabel active={on}>{s}</ChipLabel>
            </TouchableOpacity>
          );
        })}

        <View style={styles.divider} />

        <TouchableOpacity
          onPress={onOpenSheet}
          activeOpacity={0.8}
          style={[styles.priceChip, priceActive && styles.priceChipActive]}
        >
          <Label style={[styles.chipText, priceActive && styles.chipTextActive]}>
            {priceLabel}
          </Label>
          <Ionicons
            name="chevron-down"
            size={11}
            color={priceActive ? colors.light.primaryForeground : colors.light.foreground}
          />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingTop: spacing[3],
    paddingBottom: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
    backgroundColor: colors.paper.warm,
  },
  kickerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[5],
    marginBottom: spacing[2],
  },
  kicker: {
    color: colors.light.mutedForeground,
    fontSize: 10,
  },
  allBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  allBtnText: {
    color: colors.light.primary,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent2.rust,
    marginLeft: 2,
  },
  row: {
    paddingHorizontal: spacing[5],
    alignItems: "center",
    gap: spacing[2],
  },
  swatch: {
    width: 26,
    height: 26,
    borderRadius: 13,
    marginRight: 6,
  },
  swatchBorder: {
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  swatchActive: {
    borderWidth: 2,
    borderColor: colors.light.primary,
    transform: [{ scale: 1.1 }],
  },
  divider: {
    width: 1,
    height: 20,
    backgroundColor: colors.light.border,
    marginHorizontal: spacing[1],
  },
  sizeChip: {
    minWidth: 32,
    height: 30,
    paddingHorizontal: 8,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.light.card,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  sizeChipActive: {
    backgroundColor: colors.light.foreground,
    borderColor: colors.light.foreground,
  },
  priceChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 30,
    paddingHorizontal: 10,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.light.card,
  },
  priceChipActive: {
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
});
