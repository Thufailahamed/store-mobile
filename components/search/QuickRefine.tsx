import React from "react";
import { View, ScrollView, TouchableOpacity, StyleSheet, Text } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@/components/ui/Icon";
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
  /** Chips only — no kicker/"All filters" row and no tinted band. For hosts
   *  that already render their own Filters button (ProductGridControls). */
  compact?: boolean;
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
export function QuickRefine({ filters, onChange, onOpenSheet, activeCount, compact = false }: QuickRefineProps) {
  const colors_ = filters.colors ?? [];
  const sizes_ = filters.sizes ?? [];
  const price = filters.price ?? [PRICE_BOUNDS.min, PRICE_BOUNDS.max];
  const priceActive = price[0] > PRICE_BOUNDS.min || price[1] < PRICE_BOUNDS.max;
  const priceLabel = priceActive
    ? `${formatPrice(price[0])} – ${formatPrice(price[1])}`
    : "Any price";

  return (
    <View style={compact ? styles.rootCompact : styles.root}>
      {!compact && (
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
      )}

      {compact ? (
        <View style={styles.card}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardRow}>
            <Label style={styles.groupLabel}>Colour</Label>
            {COLORS.map((c) => {
              const on = colors_.includes(c.key);
              const light = c.light;
              return (
                <TouchableOpacity
                  key={c.key}
                  onPress={() =>
                    onChange({
                      ...filters,
                      colors: on ? colors_.filter((v) => v !== c.key) : [...colors_, c.key],
                    })
                  }
                  activeOpacity={0.8}
                  hitSlop={4}
                  accessibilityLabel={c.name}
                  accessibilityState={{ selected: on }}
                  style={[styles.dotRing, on && styles.dotRingActive]}
                >
                  <View style={[styles.dot26, { backgroundColor: c.hex }, light && styles.swatchBorder]}>
                    {on ? (
                      <Ionicons name="checkmark" size={12} color={light ? colors.olive[900] : "#fff"} />
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            })}

            <View style={styles.cardDivider} />

            <Label style={styles.groupLabel}>Size</Label>
            {SIZES.map((sz) => {
              const on = sizes_.includes(sz);
              return (
                <TouchableOpacity
                  key={sz}
                  onPress={() =>
                    onChange({
                      ...filters,
                      sizes: on ? sizes_.filter((v) => v !== sz) : [...sizes_, sz],
                    })
                  }
                  activeOpacity={0.8}
                  accessibilityLabel={`Size ${sz}`}
                  accessibilityState={{ selected: on }}
                  style={[styles.sizeTile, on && styles.tileActive]}
                >
                  <Text style={[styles.tileText, on && styles.tileTextActive]}>{sz}</Text>
                </TouchableOpacity>
              );
            })}

            <View style={styles.cardDivider} />

            <TouchableOpacity
              onPress={onOpenSheet}
              activeOpacity={0.8}
              style={[styles.priceTile, priceActive && styles.tileActive]}
            >
              <Ionicons
                name="pricetag-outline"
                size={12}
                color={priceActive ? colors.paper.cream : colors.ink.mute}
              />
              <Text style={[styles.tileText, priceActive && styles.tileTextActive]}>{priceLabel}</Text>
              <Ionicons
                name="chevron-down"
                size={11}
                color={priceActive ? colors.paper.cream : colors.ink.mute}
              />
            </TouchableOpacity>
          </ScrollView>
          {/* Edge fade — hints that the row scrolls */}
          <LinearGradient
            colors={["rgba(255,255,255,0)", "#ffffff"]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.edgeFade}
            pointerEvents="none"
          />
        </View>
      ) : (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {COLORS.map((c) => {
          const on = colors_.includes(c.key);
          const light = c.light;
          return (
            <TouchableOpacity
              key={c.key}
              onPress={() =>
                onChange({
                  ...filters,
                  colors: on ? colors_.filter((v) => v !== c.key) : [...colors_, c.key],
                })
              }
              activeOpacity={0.8}
              accessibilityLabel={c.name}
              accessibilityState={{ selected: on }}
              style={[styles.swatchRing, on && styles.swatchRingActive]}
            >
              <View
                style={[
                  styles.swatch,
                  { backgroundColor: c.hex },
                  light && styles.swatchBorder,
                ]}
              >
                {on ? (
                  <Ionicons name="checkmark" size={13} color={light ? colors.olive[900] : "#fff"} />
                ) : null}
              </View>
            </TouchableOpacity>
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
      )}
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
  rootCompact: {
    paddingHorizontal: spacing[4],
  },
  card: {
    borderRadius: 20,
    backgroundColor: "#ffffff",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${colors.olive[900]}1A`,
    overflow: "hidden",
    shadowColor: colors.ink.DEFAULT,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 1,
  },
  cardRow: {
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingLeft: 14,
    paddingRight: 34,
  },
  groupLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: colors.ink.mute,
    marginRight: 2,
  },
  dotRing: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  dotRingActive: {
    borderColor: colors.ink.DEFAULT,
  },
  dot26: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cardDivider: {
    width: StyleSheet.hairlineWidth,
    height: 22,
    backgroundColor: `${colors.olive[900]}33`,
    marginHorizontal: 8,
  },
  sizeTile: {
    minWidth: 38,
    height: 32,
    paddingHorizontal: 9,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.paper.DEFAULT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${colors.olive[900]}22`,
  },
  priceTile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: radii.full,
    backgroundColor: colors.paper.DEFAULT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${colors.olive[900]}22`,
  },
  tileActive: {
    backgroundColor: colors.ink.DEFAULT,
    borderColor: colors.ink.DEFAULT,
  },
  tileText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    color: colors.ink.DEFAULT,
  },
  tileTextActive: {
    color: colors.paper.cream,
  },
  edgeFade: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    width: 36,
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
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  allBtnText: {
    color: colors.light.primary,
    fontSize: 9.5,
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
    gap: 6,
  },
  swatchRing: {
    padding: 2,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  swatchRingActive: {
    borderColor: colors.olive[900],
  },
  swatch: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  swatchBorder: {
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  divider: {
    width: 1,
    height: 20,
    backgroundColor: colors.light.border,
    marginHorizontal: spacing[1],
  },
  sizeChip: {
    minWidth: 40,
    height: 32,
    paddingHorizontal: 10,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.light.card,
    alignItems: "center",
    justifyContent: "center",
  },
  sizeChipActive: {
    backgroundColor: colors.olive[900],
    borderColor: colors.olive[900],
  },
  priceChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 32,
    paddingHorizontal: 10,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.light.card,
  },
  priceChipActive: {
    backgroundColor: colors.olive[900],
    borderColor: colors.olive[900],
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
