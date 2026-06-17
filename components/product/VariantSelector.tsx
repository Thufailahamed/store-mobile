import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Label, Body } from "@/components/ui/Typography";
import { colors, spacing, radii, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import type { ProductVariant } from "@/lib/types";

interface VariantSelectorProps {
  variants: ProductVariant[];
  selectedColor: string | null;
  selectedSize: string | null;
  onColorChange: (color: string) => void;
  onSizeChange: (size: string) => void;
  /** Live sellable units per size label (overrides variant.stock when set). */
  stockForSize?: (size: string) => number;
}

export function VariantSelector({
  variants,
  selectedColor,
  selectedSize,
  onColorChange,
  onSizeChange,
  stockForSize,
}: VariantSelectorProps) {
  const uniqueColors = Array.from(
    new Map(
      variants
        .filter((v) => v.color && v.is_active)
        .map((v) => [v.color!, { color: v.color!, hex: v.color_hex || "#000" }])
    ).values()
  );

  const sizesForColor = Array.from(
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

  const isSizeSoldOut = (size: string) => getVariantStock(size) <= 0;

  return (
    <View style={styles.container}>
      {/* Color selector */}
      {uniqueColors.length > 0 && (
        <View style={styles.section}>
          <View style={styles.colorHeader}>
            <Label style={styles.sectionLabel}>COLOR</Label>
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
                  >
                    <View style={[styles.colorFill, { backgroundColor: hex }]} />
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
            <Label style={styles.sectionLabel}>SIZE</Label>
            <TouchableOpacity activeOpacity={0.6}>
              <Body size="xs" style={styles.sizeChart}>
                Size chart →
              </Body>
            </TouchableOpacity>
          </View>
          <View style={styles.sizeGrid}>
            {sizesForColor.map((s) => {
              const isActive = selectedSize === s;
              const soldOut = isSizeSoldOut(s);
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
                  activeOpacity={0.7}
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
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing[5],
    gap: spacing[5],
  },
  section: {
    gap: spacing[2.5],
  },
  colorHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionLabel: {
    color: colors.light.foreground,
  },
  colorCountInline: {
    fontFamily: fontFamilies.sans.regular,
    color: colors.light.mutedForeground,
  },
  colorRow: {
    flexDirection: "row",
    gap: spacing[4],
    flexWrap: "wrap",
    alignItems: "flex-start",
  },
  colorItem: {
    alignItems: "center",
    gap: spacing[1],
  },
  colorItemName: {
    fontSize: 11,
    color: colors.light.mutedForeground,
    fontFamily: fontFamilies.sans.regular,
    marginTop: 2,
    textAlign: "center",
  },
  colorItemNameActive: {
    color: colors.light.foreground,
    fontFamily: fontFamilies.sans.semibold,
  },
  colorCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  colorCircleActive: {
    borderColor: colors.light.primary,
  },
  colorFill: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.2,
    borderColor: "rgba(22, 23, 15, 0.12)",
  },
  sizeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sizeChart: {
    color: colors.olive[600],
    fontFamily: fontFamilies.mono.medium,
    fontSize: 11,
    textDecorationLine: "underline",
    textDecorationStyle: "solid",
    textDecorationColor: colors.olive[600],
  },
  sizeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[2],
  },
  sizeChip: {
    minWidth: 46,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.light.border,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[3],
    backgroundColor: colors.light.card,
  },
  sizeChipActive: {
    backgroundColor: colors.light.primary,
    borderColor: colors.light.primary,
  },
  sizeChipSoldOut: {
    opacity: 0.35,
    backgroundColor: "transparent",
  },
  sizeText: {
    color: colors.light.foreground,
    fontFamily: fontFamilies.sans.medium,
    fontSize: 13,
  },
  sizeTextActive: {
    color: colors.light.primaryForeground,
    fontFamily: fontFamilies.sans.semibold,
  },
  sizeTextSoldOut: {
    textDecorationLine: "line-through",
    color: colors.light.mutedForeground,
  },
});
