import React, { useState } from "react";
import {
  View,
  Pressable,
  Modal,
  FlatList,
  StyleSheet,
  Text,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { fontFamilies } from "@/lib/theme/fonts";
import { spacing, radii } from "@/lib/theme/tokens";

const INK = "#16170f";
const BORDER = "#16170f";
const MUTED = "#6b6b6b";

export type WishlistFilter = "all" | "in_stock" | "on_sale";
export type WishlistSort =
  | "recent"
  | "price_asc"
  | "price_desc"
  | "name";

const FILTERS: { key: WishlistFilter; label: string }[] = [
  { key: "all", label: "ALL" },
  { key: "in_stock", label: "IN STOCK" },
  { key: "on_sale", label: "ON SALE" },
];

const SORTS: { key: WishlistSort; label: string }[] = [
  { key: "recent", label: "Recently added" },
  { key: "price_asc", label: "Price · low to high" },
  { key: "price_desc", label: "Price · high to low" },
  { key: "name", label: "Name · A → Z" },
];

interface WishlistSegmentBarProps {
  filter: WishlistFilter;
  sort: WishlistSort;
  onFilterChange: (f: WishlistFilter) => void;
  onSortChange: (s: WishlistSort) => void;
}

export function WishlistSegmentBar({
  filter,
  sort,
  onFilterChange,
  onSortChange,
}: WishlistSegmentBarProps) {
  const [open, setOpen] = useState(false);
  const activeSort = SORTS.find((s) => s.key === sort) ?? SORTS[0];

  return (
    <>
      <View style={styles.bar}>
        <View style={styles.filters}>
          {FILTERS.map((f) => {
            const selected = f.key === filter;
            return (
              <Pressable
                key={f.key}
                onPress={() => onFilterChange(f.key)}
                style={({ pressed }) => [
                  styles.chip,
                  selected ? styles.chipActive : styles.chipIdle,
                  pressed && { opacity: 0.8 },
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
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={() => setOpen(true)}
          style={({ pressed }) => [
            styles.sortBtn,
            pressed && { opacity: 0.8 },
          ]}
          accessibilityLabel={`Sort: ${activeSort.label}`}
        >
          <Ionicons name="swap-vertical" size={15} color={INK} />
        </Pressable>
      </View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable onPress={(e) => e.stopPropagation?.()} style={styles.sheet}>
            <View style={styles.sheetHandle}>
              <View style={styles.handleBar} />
            </View>
            <Text style={styles.sheetTitle}>Sort by</Text>
            <FlatList
              data={SORTS}
              keyExtractor={(item) => item.key}
              scrollEnabled={false}
              renderItem={({ item, index }) => {
                const selected = item.key === sort;
                return (
                  <Pressable
                    onPress={() => {
                      onSortChange(item.key);
                      setOpen(false);
                    }}
                    style={({ pressed }) => [
                      styles.option,
                      index < SORTS.length - 1 && styles.optionBorder,
                      pressed && { opacity: 0.6 },
                    ]}
                  >
                    <Text style={styles.optionText}>{item.label}</Text>
                    {selected ? (
                      <Ionicons name="checkmark" size={18} color={INK} />
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
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    width: "100%",
  },
  filters: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[1.5],
    minWidth: 0,
  },
  chip: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[1.5],
    paddingVertical: 9,
    borderRadius: radii.full,
    borderWidth: 1,
    minWidth: 0,
  },
  chipActive: {
    backgroundColor: INK,
    borderColor: INK,
  },
  chipIdle: {
    backgroundColor: "#ffffff",
    borderColor: BORDER,
  },
  chipText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 9,
    color: INK,
    letterSpacing: 0.4,
    textAlign: "center",
  },
  chipTextActive: {
    color: "#ffffff",
  },
  sortBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderColor: "#e5e5e5",
  },
  sheetHandle: {
    alignItems: "center",
    paddingBottom: 14,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#e5e5e5",
  },
  sheetTitle: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 11,
    color: MUTED,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  optionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  optionText: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 16,
    color: INK,
  },
});
