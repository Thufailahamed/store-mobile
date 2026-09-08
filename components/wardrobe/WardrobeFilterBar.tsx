import React from "react";
import { View, Pressable, StyleSheet, Text, ScrollView, TextInput, Platform } from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { fontFamilies } from "@/lib/theme/fonts";
import { radii, shadows } from "@/lib/theme/tokens";
import type { GarmentType } from "@/lib/types";

const INK = "#181b12";
const MUTED = "#6b6b6b";
const BORDER = "rgba(22, 23, 15, 0.08)";

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
      {/* Category Scroll */}
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

      {/* Search & Status Row */}
      <View style={styles.searchRow}>
        <View style={styles.searchInput}>
          <Ionicons name="search" size={14} color={MUTED} />
          <TextInput
            value={q}
            onChangeText={onQ}
            placeholder="Search closet by piece or designer…"
            placeholderTextColor={MUTED}
            style={styles.searchText}
            returnKeyType="search"
          />
          {q.length > 0 && (
            <Pressable onPress={() => onQ("")} hitSlop={8}>
              <Ionicons name="close-circle" size={14} color={MUTED} />
            </Pressable>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statusScroll}
        >
          {(["active", "archived", "sold", "donated", "all"] as WardrobeStatusFilter[]).map((s) => {
            const active = status === s;
            return (
              <Pressable
                key={s}
                onPress={() => onStatus(s)}
                style={({ pressed }) => [
                  styles.statusPill,
                  active && styles.statusPillActive,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Text style={[styles.statusText, active && styles.statusTextActive]}>
                  {STATUS_LABEL[s]}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

const STATUS_LABEL: Record<WardrobeStatusFilter, string> = {
  active: "Active Closet",
  archived: "Archived",
  sold: "Sold",
  donated: "Donated",
  all: "All Status",
};

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
        active ? styles.pillActive : styles.pillIdle,
        pressed && { opacity: 0.85 },
      ]}
    >
      <Text style={[styles.pillText, active && styles.pillTextActive]} numberOfLines={1}>
        {label}
      </Text>
      <View style={[styles.countBadge, active && styles.countBadgeActive]}>
        <Text style={[styles.pillCount, active && styles.pillCountActive]}>{count}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 12,
  },
  scroll: {
    paddingHorizontal: 16,
    gap: 7,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 7,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  pillIdle: {
    backgroundColor: "#ffffff",
    borderColor: BORDER,
    ...shadows.soft,
  },
  pillActive: {
    backgroundColor: INK,
    borderColor: INK,
  },
  pillText: {
    fontSize: 11.5,
    color: INK,
    fontFamily: fontFamilies.sans.medium,
    letterSpacing: 0.2,
  },
  pillTextActive: {
    color: "#ffffff",
    fontFamily: fontFamilies.sans.semibold,
  },
  countBadge: {
    backgroundColor: "rgba(22, 23, 15, 0.06)",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
  },
  countBadgeActive: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  pillCount: {
    fontSize: 9.5,
    color: MUTED,
    fontFamily: fontFamilies.mono.medium,
  },
  pillCountActive: {
    color: "#ffffff",
  },
  searchRow: {
    flexDirection: "column",
    paddingHorizontal: 16,
    gap: 8,
  },
  searchInput: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 10 : 6,
    backgroundColor: "#ffffff",
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.09)",
    ...shadows.soft,
  },
  searchText: {
    flex: 1,
    fontSize: 12.5,
    color: INK,
    fontFamily: fontFamilies.sans.regular,
    padding: 0,
  },
  statusScroll: {
    gap: 6,
  },
  statusPill: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#ffffff",
  },
  statusPillActive: {
    backgroundColor: INK,
    borderColor: INK,
  },
  statusText: {
    fontSize: 10.5,
    color: MUTED,
    fontFamily: fontFamilies.mono.medium,
  },
  statusTextActive: {
    color: "#ffffff",
    fontFamily: fontFamilies.mono.semibold,
  },
});
