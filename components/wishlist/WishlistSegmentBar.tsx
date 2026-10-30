import React, { useState } from "react";
import {
  View,
  Pressable,
  FlatList,
  StyleSheet,
  Text,
} from "react-native";
import { Modal } from "@/components/ui/Modal";
import { Ionicons } from "@/components/ui/Icon";
import { fontFamilies } from "@/lib/theme/fonts";
import { colors, spacing, radii, shadows } from "@/lib/theme/tokens";

const INK = colors.ink.DEFAULT;
const MUTED = colors.ink.mute;

export type WishlistFilter = "all" | "in_stock" | "on_sale";
export type WishlistSort =
  | "recent"
  | "price_asc"
  | "price_desc"
  | "name";

const FILTERS: { key: WishlistFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "in_stock", label: "In stock" },
  { key: "on_sale", label: "On sale" },
];

const SORTS: { key: WishlistSort; label: string; icon: string }[] = [
  { key: "recent", label: "Recently added", icon: "time-outline" },
  { key: "price_asc", label: "Price · low to high", icon: "trending-up-outline" },
  { key: "price_desc", label: "Price · high to low", icon: "trending-down-outline" },
  { key: "name", label: "Name · A → Z", icon: "text-outline" },
];

interface WishlistSegmentBarProps {
  filter: WishlistFilter;
  sort: WishlistSort;
  onFilterChange: (f: WishlistFilter) => void;
  onSortChange: (s: WishlistSort) => void;
  counts?: Partial<Record<WishlistFilter, number>>;
  visibleCount?: number;
}

export function WishlistSegmentBar({
  filter,
  sort,
  onFilterChange,
  onSortChange,
  counts,
  visibleCount,
}: WishlistSegmentBarProps) {
  const [open, setOpen] = useState(false);
  const activeSort = SORTS.find((s) => s.key === sort) ?? SORTS[0];

  return (
    <>
      <View style={styles.wrap}>
        <View style={styles.bar}>
          <View style={styles.segment}>
            {FILTERS.map((f) => {
              const selected = f.key === filter;
              const count = counts?.[f.key];
              return (
                <Pressable
                  key={f.key}
                  onPress={() => onFilterChange(f.key)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  style={({ pressed }) => [
                    styles.chip,
                    selected && styles.chipActive,
                    pressed && !selected && { opacity: 0.6 },
                  ]}
                >
                  <Text
                    style={[styles.chipText, selected && styles.chipTextActive]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.85}
                  >
                    {f.label}
                  </Text>
                  {count != null ? (
                    <Text style={[styles.chipCount, selected && styles.chipCountActive]}>
                      {count}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={() => setOpen(true)}
            style={({ pressed }) => [styles.sortBtn, pressed && { opacity: 0.7 }]}
            accessibilityLabel={`Sort: ${activeSort.label}`}
          >
            <Ionicons name="swap-vertical" size={16} color={INK} />
            {sort !== "recent" ? <View style={styles.sortDot} /> : null}
          </Pressable>
        </View>

        <Pressable onPress={() => setOpen(true)} style={styles.metaRow} hitSlop={6}>
          {visibleCount != null ? (
            <Text style={styles.metaCount}>
              {visibleCount} {visibleCount === 1 ? "piece" : "pieces"}
            </Text>
          ) : (
            <View />
          )}
          <View style={styles.metaSort}>
            <Text style={styles.metaSortLabel}>Sorted by </Text>
            <Text style={styles.metaSortValue}>{activeSort.label}</Text>
            <Ionicons name="chevron-down" size={12} color={MUTED} />
          </View>
        </Pressable>
      </View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable onPress={(e) => e.stopPropagation?.()} style={styles.sheet}>
            <View style={styles.sheetHandle}>
              <View style={styles.handleBar} />
            </View>
            <Text style={styles.sheetKicker}>ARRANGE</Text>
            <Text style={styles.sheetTitle}>Sort your collection</Text>
            <FlatList
              data={SORTS}
              keyExtractor={(item) => item.key}
              scrollEnabled={false}
              contentContainerStyle={styles.optionList}
              renderItem={({ item }) => {
                const selected = item.key === sort;
                return (
                  <Pressable
                    onPress={() => {
                      onSortChange(item.key);
                      setOpen(false);
                    }}
                    style={({ pressed }) => [
                      styles.option,
                      selected && styles.optionSelected,
                      pressed && { opacity: 0.6 },
                    ]}
                  >
                    <View style={[styles.optionIcon, selected && styles.optionIconSelected]}>
                      <Ionicons
                        name={item.icon as any}
                        size={16}
                        color={selected ? colors.paper.cream : colors.olive[700]}
                      />
                    </View>
                    <Text style={styles.optionText}>{item.label}</Text>
                    {selected ? (
                      <Ionicons name="checkmark-circle" size={20} color={colors.olive[800]} />
                    ) : null}
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing[3],
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    width: "100%",
  },
  segment: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: 4,
    borderRadius: radii.full,
    backgroundColor: colors.paper.warm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${colors.olive[700]}1F`,
    minWidth: 0,
  },
  chip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: spacing[1.5],
    height: 36,
    borderRadius: radii.full,
    minWidth: 0,
  },
  chipActive: {
    backgroundColor: colors.olive[900],
    ...shadows.soft,
  },
  chipText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    color: colors.ink.soft,
    letterSpacing: 0.1,
    flexShrink: 1,
  },
  chipTextActive: {
    color: colors.paper.cream,
  },
  chipCount: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    color: MUTED,
  },
  chipCountActive: {
    color: colors.accent2.ochre,
  },
  sortBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${colors.olive[700]}33`,
    backgroundColor: colors.paper.cream,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    ...shadows.soft,
  },
  sortDot: {
    position: "absolute",
    top: 9,
    right: 9,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.accent2.rust,
    borderWidth: 1.5,
    borderColor: colors.paper.cream,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  metaCount: {
    fontFamily: fontFamilies.display.italic,
    fontSize: 14,
    color: colors.ink.soft,
  },
  metaSort: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  metaSortLabel: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: MUTED,
  },
  metaSortValue: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    color: INK,
    marginRight: 2,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(22,23,15,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.paper.cream,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    paddingBottom: 36,
  },
  sheetHandle: {
    alignItems: "center",
    paddingBottom: 18,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: `${colors.olive[700]}30`,
  },
  sheetKicker: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    color: colors.accent2.ochre,
    letterSpacing: 1.6,
    paddingHorizontal: 24,
  },
  sheetTitle: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 24,
    color: INK,
    letterSpacing: -0.4,
    paddingHorizontal: 24,
    marginTop: 4,
    marginBottom: 14,
  },
  optionList: {
    paddingHorizontal: 12,
    gap: 4,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: radii.xl,
  },
  optionSelected: {
    backgroundColor: colors.paper.warm,
  },
  optionIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.paper.warm,
  },
  optionIconSelected: {
    backgroundColor: colors.olive[900],
  },
  optionText: {
    flex: 1,
    fontFamily: fontFamilies.sans.medium,
    fontSize: 15,
    color: INK,
  },
});
