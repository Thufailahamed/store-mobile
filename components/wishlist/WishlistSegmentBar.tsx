import React, { useState } from "react";
import {
  View,
  Pressable,
  Modal,
  FlatList,
  StyleSheet,
  type ViewStyle,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "@/lib/hooks/useTheme";
import { Label, Body } from "@/components/ui/Typography";
import { fontFamilies } from "@/lib/theme/fonts";
import { typography, spacing, radii } from "@/lib/theme/tokens";

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
  style?: ViewStyle;
}

export function WishlistSegmentBar({
  filter,
  sort,
  onFilterChange,
  onSortChange,
  style,
}: WishlistSegmentBarProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const currentSort = SORTS.find((s) => s.key === sort) ?? SORTS[0];

  return (
    <>
      <View
        style={[
          styles.wrap,
          {
            backgroundColor: theme.colors.background,
            borderColor: theme.colors.border,
          },
          style,
        ]}
      >
        <View style={styles.chipRow}>
          {FILTERS.map((f) => {
            const selected = f.key === filter;
            return (
              <Pressable
                key={f.key}
                onPress={() => onFilterChange(f.key)}
                style={({ pressed }) => [
                  styles.chip,
                  {
                    backgroundColor: selected
                      ? theme.olive[700]
                      : theme.colors.card,
                    borderColor: selected
                      ? theme.olive[700]
                      : theme.colors.border,
                  },
                  pressed && { opacity: 0.75 },
                ]}
              >
                <Label
                  style={{
                    color: selected ? "#fff" : theme.colors.foreground,
                    fontSize: 10,
                  }}
                >
                  {f.label}
                </Label>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={() => setOpen(true)}
          hitSlop={6}
          style={({ pressed }) => [
            styles.sortBtn,
            {
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.border,
            },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Ionicons
            name="swap-vertical"
            size={12}
            color={theme.olive[700]}
          />
          <Label
            style={{
              color: theme.colors.foreground,
              fontSize: 10,
              marginLeft: 4,
            }}
          >
            {currentSort.label}
          </Label>
        </Pressable>
      </View>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => setOpen(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation?.()}
            style={[
              styles.sheet,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <View style={styles.sheetHandle}>
              <View
                style={[
                  styles.handleBar,
                  { backgroundColor: theme.colors.border },
                ]}
              />
            </View>
            <Label
              style={{
                color: theme.olive[600],
                marginBottom: 4,
                paddingHorizontal: 18,
              }}
            >
              Sort by
            </Label>
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
                      index < SORTS.length - 1 && {
                        borderBottomWidth: 1,
                        borderBottomColor: theme.colors.border,
                      },
                      pressed && { opacity: 0.6 },
                    ]}
                  >
                    <Body
                      size="md"
                      style={{
                        fontFamily: fontFamilies.display.regular,
                        color: theme.colors.foreground,
                      }}
                    >
                      {item.label}
                    </Body>
                    {selected ? (
                      <Ionicons
                        name="checkmark"
                        size={18}
                        color={theme.olive[700]}
                      />
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 10,
  },
  chipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  sortBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    paddingBottom: 32,
    borderTopWidth: 1,
  },
  sheetHandle: {
    alignItems: "center",
    paddingBottom: 14,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
});
