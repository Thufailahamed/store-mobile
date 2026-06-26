import React from "react";
import { View, Pressable, StyleSheet, Text, ScrollView } from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { fontFamilies } from "@/lib/theme/fonts";
import { radii } from "@/lib/theme/tokens";
import type { GarmentType } from "@/lib/types";

const INK = "#16170f";
const MUTED = "#6b6b6b";
const BORDER = "rgba(22,23,15,0.10)";

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

      <View style={styles.searchRow}>
        <View style={styles.searchInput}>
          <Ionicons name="search-outline" size={14} color={MUTED} />
          <TextInput
            value={q}
            onChangeText={onQ}
            placeholder="Search by name or brand"
            placeholderTextColor={MUTED}
            style={styles.searchText}
          />
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
  active: "Active",
  archived: "Archived",
  sold: "Sold",
  donated: "Donated",
  all: "All",
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
      <Text style={[styles.pillCount, active && styles.pillCountActive]}>{count}</Text>
    </Pressable>
  );
}

// Local TextInput keeps imports minimal.
import { TextInput } from "react-native";

const styles: Record<string, any> = StyleSheet.create({
  wrap: {
    gap: 10,
  },
  scroll: {
    paddingHorizontal: 16,
    gap: 6,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  pillIdle: {
    backgroundColor: "rgba(251,250,243,0.85)",
    borderColor: BORDER,
  },
  pillActive: {
    backgroundColor: INK,
    borderColor: INK,
  },
  pillText: {
    fontSize: 11,
    color: INK,
    fontFamily: fontFamilies.sans.regular,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  pillTextActive: {
    color: "#fff",
  },
  pillCount: {
    fontSize: 10,
    color: MUTED,
    fontFamily: fontFamilies.sans.regular,
  },
  pillCountActive: {
    color: "rgba(255,255,255,0.6)",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 10,
  },
  searchInput: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "rgba(251,250,243,0.85)",
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: BORDER,
    minWidth: 180,
    flex: 1,
  },
  searchText: {
    flex: 1,
    fontSize: 12,
    color: INK,
    fontFamily: fontFamilies.sans.regular,
    padding: 0,
  },
  statusScroll: {
    gap: 6,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#fff",
  },
  statusPillActive: {
    backgroundColor: "#556b2f",
    borderColor: "#556b2f",
  },
  statusText: {
    fontSize: 10,
    color: INK,
    fontFamily: fontFamilies.sans.regular,
    fontWeight: "600",
  },
  statusTextActive: {
    color: "#fff",
  },
});
