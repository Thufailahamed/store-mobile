import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { Display, Label, Body } from "@/components/ui/Typography";
import { Button } from "@/components/ui";
import { colors, radii, spacing, shadows, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { COLORS, SIZES, PRICE_PRESETS, PRICE_BOUNDS } from "@/lib/api/facets";
import type { ProductFilters } from "@/lib/api/facets";

const { height: SCREEN_H } = Dimensions.get("window");

interface SearchFilterSheetProps {
  visible: boolean;
  onClose: () => void;
  filters: ProductFilters;
  onApply: (filters: ProductFilters) => void;
}

export function SearchFilterSheet({
  visible,
  onClose,
  filters,
  onApply,
}: SearchFilterSheetProps) {
  const [draft, setDraft] = useState<ProductFilters>({ ...filters });

  const activeCount =
    (draft.colors?.length ?? 0) +
    (draft.sizes?.length ?? 0) +
    (draft.brands?.length ?? 0) +
    (draft.categories?.length ?? 0) +
    (draft.minRating ? 1 : 0) +
    (draft.minDiscount ? 1 : 0) +
    (draft.price && (draft.price[0] > PRICE_BOUNDS.min || draft.price[1] < PRICE_BOUNDS.max) ? 1 : 0);

  const toggleColor = (c: string) => {
    const cur = draft.colors ?? [];
    setDraft({
      ...draft,
      colors: cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c],
    });
  };

  const toggleSize = (s: string) => {
    const cur = draft.sizes ?? [];
    setDraft({
      ...draft,
      sizes: cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s],
    });
  };

  const toggleBrand = (b: string) => {
    const cur = draft.brands ?? [];
    setDraft({
      ...draft,
      brands: cur.includes(b) ? cur.filter((x) => x !== b) : [...cur, b],
    });
  };

  const setPriceRange = (range: [number, number]) => {
    setDraft({ ...draft, price: range });
  };

  const handleClear = () => {
    setDraft({
      price: [PRICE_BOUNDS.min, PRICE_BOUNDS.max],
      colors: [],
      sizes: [],
      brands: [],
      categories: [],
      minRating: 0,
      minDiscount: 0,
    });
  };

  const handleApply = () => {
    onApply(draft);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.backdropTouch} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={styles.handle} />
            <View style={styles.headerRow}>
              <Display size="lg">Filters</Display>
              {activeCount > 0 && (
                <View style={styles.activeBadge}>
                  <Body style={styles.activeBadgeText}>{activeCount}</Body>
                </View>
              )}
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={colors.light.foreground} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            style={styles.sheetBody}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.sheetBodyContent}
          >
            {/* Price Range */}
            <View style={styles.filterSection}>
              <Label style={styles.filterLabel}>PRICE RANGE</Label>
              <View style={styles.presetGrid}>
                {PRICE_PRESETS.map((preset) => {
                  const isActive =
                    draft.price &&
                    draft.price[0] === preset.range[0] &&
                    draft.price[1] === preset.range[1];
                  return (
                    <TouchableOpacity
                      key={preset.label}
                      style={[styles.presetChip, isActive && styles.presetChipActive]}
                      onPress={() => setPriceRange(preset.range)}
                    >
                      <Body
                        size="sm"
                        style={[styles.presetText, isActive && styles.presetTextActive]}
                      >
                        {preset.label}
                      </Body>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Colors */}
            <View style={styles.filterSection}>
              <Label style={styles.filterLabel}>COLOR</Label>
              <View style={styles.colorGrid}>
                {COLORS.map((c) => {
                  const isActive = draft.colors?.includes(c.name);
                  return (
                    <TouchableOpacity
                      key={c.name}
                      style={[styles.colorItem, isActive && styles.colorItemActive]}
                      onPress={() => toggleColor(c.name)}
                    >
                      <View style={[styles.colorSwatch, { backgroundColor: c.hex }]}>
                        {isActive && (
                          <Ionicons name="checkmark" size={12} color="#fff" />
                        )}
                      </View>
                      <Body size="xs" style={styles.colorName}>{c.name}</Body>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Sizes */}
            <View style={styles.filterSection}>
              <Label style={styles.filterLabel}>SIZE</Label>
              <View style={styles.sizeGrid}>
                {SIZES.map((s) => {
                  const isActive = draft.sizes?.includes(s);
                  return (
                    <TouchableOpacity
                      key={s}
                      style={[styles.sizeChip, isActive && styles.sizeChipActive]}
                      onPress={() => toggleSize(s)}
                    >
                      <Body
                        size="sm"
                        style={[styles.sizeText, isActive && styles.sizeTextActive]}
                      >
                        {s}
                      </Body>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Discount */}
            <View style={styles.filterSection}>
              <Label style={styles.filterLabel}>DISCOUNT</Label>
              <View style={styles.sizeGrid}>
                {[10, 25, 50, 70].map((d) => {
                  const isActive = draft.minDiscount === d;
                  return (
                    <TouchableOpacity
                      key={d}
                      style={[styles.sizeChip, isActive && styles.sizeChipActive]}
                      onPress={() =>
                        setDraft({ ...draft, minDiscount: isActive ? 0 : d })
                      }
                    >
                      <Body
                        size="sm"
                        style={[styles.sizeText, isActive && styles.sizeTextActive]}
                      >
                        {d}%+
                      </Body>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Rating */}
            <View style={styles.filterSection}>
              <Label style={styles.filterLabel}>MINIMUM RATING</Label>
              <View style={styles.sizeGrid}>
                {[0, 3, 4, 4.5].map((r) => {
                  const isActive = draft.minRating === r;
                  const label = r === 0 ? "Any" : `${r}★ & up`;
                  return (
                    <TouchableOpacity
                      key={String(r)}
                      style={[styles.sizeChip, isActive && styles.sizeChipActive]}
                      onPress={() => setDraft({ ...draft, minRating: r })}
                    >
                      <Body
                        size="sm"
                        style={[styles.sizeText, isActive && styles.sizeTextActive]}
                      >
                        {label}
                      </Body>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.sheetFooter}>
            <Button variant="ghost" onPress={handleClear}>
              Clear all
            </Button>
            <Button variant="brand" onPress={handleApply} style={styles.applyBtn}>
              Show results
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(22, 23, 15, 0.5)",
  },
  backdropTouch: {
    position: "absolute",
    inset: 0,
  },
  sheet: {
    maxHeight: SCREEN_H * 0.82,
    backgroundColor: colors.light.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    ...shadows.editorial,
  },
  sheetHeader: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    paddingBottom: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: `${colors.light.primary}15`,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.light.border,
    alignSelf: "center",
    marginBottom: spacing[3],
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
  },
  activeBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.olive[600],
    alignItems: "center",
    justifyContent: "center",
  },
  activeBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  closeBtn: {
    marginLeft: "auto",
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.light.muted,
  },
  sheetBody: {
    flex: 1,
  },
  sheetBodyContent: {
    padding: spacing[5],
    gap: spacing[6],
  },
  filterSection: {
    gap: spacing[3],
  },
  filterLabel: {
    color: colors.olive[600],
  },
  presetGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[2],
  },
  presetChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.full,
    borderWidth: 1.5,
    borderColor: colors.light.border,
    backgroundColor: colors.light.card,
  },
  presetChipActive: {
    backgroundColor: colors.light.foreground,
    borderColor: colors.light.foreground,
  },
  presetText: {
    color: colors.light.foreground,
  },
  presetTextActive: {
    color: colors.light.primaryForeground,
  },
  colorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[3],
  },
  colorItem: {
    alignItems: "center",
    gap: 4,
  },
  colorItemActive: {},
  colorSwatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  colorName: {
    color: colors.light.mutedForeground,
    fontSize: 10,
  },
  sizeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[2],
  },
  sizeChip: {
    minWidth: 52,
    height: 44,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: colors.light.border,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[3],
    backgroundColor: colors.light.card,
  },
  sizeChipActive: {
    backgroundColor: colors.light.foreground,
    borderColor: colors.light.foreground,
  },
  sizeText: {
    color: colors.light.foreground,
  },
  sizeTextActive: {
    color: colors.light.primaryForeground,
  },
  sheetFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
    borderTopWidth: 1,
    borderTopColor: `${colors.light.primary}15`,
  },
  applyBtn: {
    flex: 1,
  },
});
