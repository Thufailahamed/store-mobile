import React from "react";
import { View, Pressable, StyleSheet, Text, ScrollView, TextInput, Platform } from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { fontFamilies } from "@/lib/theme/fonts";
import { colors, radii } from "@/lib/theme/tokens";
import type { GarmentType } from "@/lib/types";

const INK = colors.light.foreground;
const MUTED = colors.light.mutedForeground;
const HAIRLINE = "rgba(22, 23, 15, 0.08)";

const GARMENT_LABEL: Record<GarmentType, string> = {
  top: "Tops",
  bottom: "Bottoms",
  dress: "Dresses",
  footwear: "Footwear",
  bag: "Bags",
  accessory: "Accessories",
  jewelry: "Jewelry",
  watch: "Watches",
  beauty: "Beauty",
  other: "Other",
};

const GARMENT_ORDER: GarmentType[] = [
  "top", "bottom", "dress", "footwear", "bag", "accessory", "jewelry", "watch", "beauty", "other",
];

export type WardrobeGarmentFilter = GarmentType | "all";
export type WardrobeStatusFilter = "active" | "archived" | "sold" | "donated" | "all";

const STATUS_ORDER: WardrobeStatusFilter[] = ["active", "archived", "sold", "donated", "all"];

const STATUS_LABEL: Record<WardrobeStatusFilter, string> = {
  active: "In closet",
  archived: "Archived",
  sold: "Sold",
  donated: "Donated",
  all: "All",
};

interface Props {
  garment: WardrobeGarmentFilter;
  status: WardrobeStatusFilter;
  q: string;
  onGarment: (g: WardrobeGarmentFilter) => void;
  onStatus: (s: WardrobeStatusFilter) => void;
  onQ: (q: string) => void;
  counts: Partial<Record<GarmentType, number>>;
  totalCount: number;
}

export function WardrobeFilterBar({
  garment,
  status,
  q,
  onGarment,
  onStatus,
  onQ,
  counts,
  totalCount,
}: Props) {
  return (
    <View style={styles.wrap}>
      {/* Search */}
      <View style={styles.searchRow}>
        <View style={styles.searchInput}>
          <Ionicons name="search" size={16} color={MUTED} />
          <TextInput
            value={q}
            onChangeText={onQ}
            placeholder="Search pieces or designers"
            placeholderTextColor={MUTED}
            style={styles.searchText}
            returnKeyType="search"
          />
          {q.length > 0 && (
            <Pressable onPress={() => onQ("")} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={MUTED} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Categories */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <Pill
          label="All"
          count={totalCount}
          active={garment === "all"}
          onPress={() => onGarment("all")}
        />
        {GARMENT_ORDER.map((g) => (
          <Pill
            key={g}
            label={GARMENT_LABEL[g]}
            count={counts[g] ?? 0}
            active={garment === g}
            onPress={() => onGarment(g)}
          />
        ))}
      </ScrollView>

      {/* Status — underline tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.statusScroll}
      >
        {STATUS_ORDER.map((s) => {
          const active = status === s;
          return (
            <Pressable
              key={s}
              onPress={() => onStatus(s)}
              style={styles.statusTab}
              hitSlop={4}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.statusText, active && styles.statusTextActive]}>
                {STATUS_LABEL[s]}
              </Text>
              <View style={[styles.statusUnderline, active && styles.statusUnderlineActive]} />
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function Pill({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        active && styles.pillActive,
        pressed && { opacity: 0.85 },
      ]}
    >
      <Text style={[styles.pillText, active && styles.pillTextActive]} numberOfLines={1}>
        {label}
      </Text>
      {count > 0 && (
        <Text style={[styles.pillCount, active && styles.pillCountActive]}>{count}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 12,
  },
  searchRow: {
    paddingHorizontal: 16,
  },
  searchInput: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "ios" ? 12 : 8,
    backgroundColor: colors.paper.cream,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: HAIRLINE,
  },
  searchText: {
    flex: 1,
    fontSize: 13.5,
    color: INK,
    fontFamily: fontFamilies.sans.regular,
    padding: 0,
  },
  scroll: {
    paddingHorizontal: 16,
    gap: 6,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 34,
    paddingHorizontal: 14,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: HAIRLINE,
    backgroundColor: colors.paper.cream,
  },
  pillActive: {
    backgroundColor: colors.olive[900],
    borderColor: colors.olive[900],
  },
  pillText: {
    fontSize: 12.5,
    color: colors.ink.mute,
    fontFamily: fontFamilies.sans.semibold,
  },
  pillTextActive: {
    color: colors.paper.cream,
  },
  pillCount: {
    fontSize: 10.5,
    color: MUTED,
    fontFamily: fontFamilies.mono.semibold,
  },
  pillCountActive: {
    color: "#E8CF8F",
  },
  statusScroll: {
    paddingHorizontal: 16,
    gap: 20,
  },
  statusTab: {
    paddingTop: 2,
    alignItems: "center",
  },
  statusText: {
    fontSize: 12.5,
    color: MUTED,
    fontFamily: fontFamilies.sans.medium,
  },
  statusTextActive: {
    color: INK,
    fontFamily: fontFamilies.sans.bold,
  },
  statusUnderline: {
    height: 2,
    alignSelf: "stretch",
    borderRadius: 1,
    marginTop: 6,
    backgroundColor: "transparent",
  },
  statusUnderlineActive: {
    backgroundColor: colors.accent2.ochre,
  },
});
