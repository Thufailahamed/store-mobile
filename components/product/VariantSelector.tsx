import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { Label, Body } from "@/components/ui/Typography";
import { colors, spacing, radii, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { sortSizes } from "@/lib/size-presets";
import type { ProductVariant } from "@/lib/types";

interface VariantSelectorProps {
  variants: ProductVariant[];
  selectedColor: string | null;
  selectedSize: string | null;
  onColorChange: (color: string) => void;
  onSizeChange: (size: string) => void;
  /** Live sellable units per size label (overrides variant.stock when set). */
  stockForSize?: (size: string) => number;
  onOpenSizeGuide?: () => void;
}

/** True when a swatch is light enough that a dark checkmark reads better. */
function isLightHex(hex: string): boolean {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(n)) return false;
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 170;
}

export function VariantSelector({
  variants,
  selectedColor,
  selectedSize,
  onColorChange,
  onSizeChange,
  stockForSize,
  onOpenSizeGuide,
}: VariantSelectorProps) {
  const uniqueColors = Array.from(
    new Map(
      variants
        .filter((v) => v.color && v.is_active)
        .map((v) => [v.color!, { color: v.color!, hex: v.color_hex || "#000" }])
    ).values()
  );

  const sizesForColor = sortSizes(
    new Set(
      variants
        .filter((v) => v.size && v.is_active && (!selectedColor || v.color === selectedColor))
        .map((v) => v.size!)
    )
  );

  const getVariantStock = (size: string) => {
    if (stockForSize) return stockForSize(size);
    const v = variants.find(
      (v) => v.size === size && v.is_active && (!selectedColor || v.color === selectedColor)
    );
    return v?.stock ?? 0;
  };

  return (
    <View style={styles.container}>
      {/* Color selector */}
      {uniqueColors.length > 0 && (
        <View style={styles.section}>
          <View style={styles.colorHeader}>
            <View style={styles.headerLeft}>
              <Label style={styles.sectionLabel}>COLOR</Label>
              {selectedColor ? (
                <Body size="sm" style={styles.selectedValue}>{selectedColor}</Body>
              ) : null}
            </View>
            <Body size="xs" muted style={styles.colorCountInline}>
              {uniqueColors.length} shade{uniqueColors.length !== 1 ? "s" : ""}
            </Body>
          </View>
          <View style={styles.colorRow}>
            {uniqueColors.map(({ color, hex }) => {
              const isActive = selectedColor === color;
              return (
                <View key={color} style={styles.colorItem}>
                  <TouchableOpacity
                    style={[styles.colorCircle, isActive && styles.colorCircleActive]}
                    onPress={() => onColorChange(color)}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                    accessibilityLabel={`Color ${color}`}
                  >
                    <View style={[styles.colorFill, { backgroundColor: hex }]}>
                      {isActive && (
                        <Ionicons
                          name="checkmark"
                          size={16}
                          color={isLightHex(hex) ? colors.olive[900] : colors.paper.cream}
                        />
                      )}
                    </View>
                  </TouchableOpacity>
                  <Body
                    size="xs"
                    style={[styles.colorItemName, isActive && styles.colorItemNameActive]}
                  >
                    {color}
                  </Body>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Size selector */}
      {sizesForColor.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sizeHeader}>
            <View style={styles.headerLeft}>
              <Label style={styles.sectionLabel}>SIZE</Label>
              {selectedSize ? (
                <Body size="sm" style={styles.selectedValue}>{selectedSize}</Body>
              ) : null}
            </View>
            {onOpenSizeGuide && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={onOpenSizeGuide}
                hitSlop={6}
                style={styles.sizeChartBtn}
              >
                <Ionicons name="resize-outline" size={13} color={colors.olive[800]} />
                <Body size="xs" style={styles.sizeChart}>Size guide</Body>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.sizeGrid}>
            {sizesForColor.map((s) => {
              const isActive = selectedSize === s;
              const stock = getVariantStock(s);
              const soldOut = stock <= 0;
              const isLow = !soldOut && stock <= 3;
              return (
                <TouchableOpacity
                  key={s}
                  style={[
                    styles.sizeChip,
                    isActive && styles.sizeChipActive,
                    soldOut && styles.sizeChipSoldOut,
                  ]}
                  onPress={() => onSizeChange(s)}
                  disabled={soldOut}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive, disabled: soldOut }}
                  accessibilityLabel={`Size ${s}${soldOut ? ", sold out" : ""}`}
                >
                  <Body
                    size="sm"
                    style={[
                      styles.sizeText,
                      isActive && styles.sizeTextActive,
                      soldOut && styles.sizeTextSoldOut,
                    ]}
                  >
                    {s}
                  </Body>
                  {isLow && !isActive && (
                    <View style={styles.chipLowDot} />
                  )}
                  {isActive && <View style={styles.chipActiveDot} />}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Low-stock urgency warning for selected size */}
          {selectedSize && (() => {
            const stock = getVariantStock(selectedSize);
            if (stock > 0 && stock <= 3) {
              return (
                <View style={styles.lowStockBanner}>
                  <View style={styles.lowStockDot} />
                  <Body size="xs" style={styles.lowStockText}>
                    Only {stock} {stock === 1 ? "item" : "items"} left in size {selectedSize}
                  </Body>
                </View>
              );
            }
            return null;
          })()}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing[5],
    gap: spacing[6],
  },
  section: {
    gap: spacing[3],
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing[2],
  },
  colorHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionLabel: {
    color: colors.light.mutedForeground,
    fontSize: 10,
    letterSpacing: 2,
    fontFamily: fontFamilies.sans.bold,
  },
  selectedValue: {
    color: colors.light.foreground,
    fontFamily: fontFamilies.display.semibold,
    fontSize: 16,
  },
  colorCountInline: {
    fontFamily: fontFamilies.sans.regular,
    color: colors.light.mutedForeground,
  },
  colorRow: {
    flexDirection: "row",
    gap: spacing[5],
    flexWrap: "wrap",
    alignItems: "flex-start",
  },
  colorItem: {
    alignItems: "center",
    gap: spacing[1.5],
  },
  colorItemName: {
    fontSize: 11.5,
    color: colors.light.mutedForeground,
    fontFamily: fontFamilies.sans.regular,
    textAlign: "center",
  },
  colorItemNameActive: {
    color: colors.light.foreground,
    fontFamily: fontFamilies.sans.semibold,
  },
  colorCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    borderColor: `${colors.olive[900]}14`,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    shadowColor: colors.ink.DEFAULT,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  colorCircleActive: {
    borderWidth: 2,
    borderColor: colors.olive[950],
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  colorFill: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  sizeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sizeChartBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.full,
    backgroundColor: colors.olive[50],
    borderWidth: 1,
    borderColor: `${colors.olive[600]}1F`,
  },
  sizeChart: {
    color: colors.olive[800],
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 11.5,
  },
  sizeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[2.5],
  },
  sizeChip: {
    minWidth: 64,
    height: 54,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: `${colors.olive[900]}1A`,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[4],
    backgroundColor: "#ffffff",
    shadowColor: colors.ink.DEFAULT,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  sizeChipActive: {
    backgroundColor: colors.olive[950],
    borderColor: colors.olive[950],
    ...shadows.glow,
    shadowColor: colors.olive[950],
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  chipActiveDot: {
    position: "absolute",
    bottom: 7,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent2.ochre,
  },
  sizeChipSoldOut: {
    opacity: 0.4,
    backgroundColor: "transparent",
    borderStyle: "dashed",
  },
  sizeText: {
    color: colors.light.foreground,
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 15,
    letterSpacing: 0.4,
  },
  sizeTextActive: {
    color: colors.paper.cream,
    fontFamily: fontFamilies.sans.bold,
  },
  sizeTextSoldOut: {
    textDecorationLine: "line-through",
    color: colors.light.mutedForeground,
  },
  chipLowDot: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.accent2.rust,
  },
  lowStockBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    backgroundColor: `${colors.accent2.rust}12`,
    borderWidth: 1,
    borderColor: `${colors.accent2.rust}22`,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radii.full,
    alignSelf: "flex-start",
    marginTop: 2,
  },
  lowStockDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent2.rust,
  },
  lowStockText: {
    color: colors.accent2.rust,
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 11.5,
  },
});
