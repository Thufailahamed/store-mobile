import React from "react";
import { View, StyleSheet, Text } from "react-native";
import { fontFamilies } from "@/lib/theme/fonts";
import { radii } from "@/lib/theme/tokens";
import { formatPrice } from "@/lib/utils";
import type { WardrobeStats } from "@/lib/types";

const INK = "#16170f";
const MUTED = "#6b6b6b";
const BORDER = "rgba(22,23,15,0.10)";

export function WardrobeStatsBar({ stats }: { stats: WardrobeStats | null }) {
  const totals = stats?.totals;
  const cells = [
    { k: "Items", v: String(totals?.total_items ?? 0) },
    { k: "Spent", v: formatPrice(totals?.total_spent ?? 0) },
    { k: "Wears", v: String(totals?.total_wears ?? 0) },
    {
      k: "Avg/wear",
      v: typeof totals?.avg_cost_per_wear === "number"
        ? formatPrice(totals.avg_cost_per_wear)
        : "—",
    },
  ];

  return (
    <View style={styles.grid}>
      {cells.map((c, idx) => (
        <View key={c.k} style={idx > 0 ? [styles.cell, styles.cellBorder] : styles.cell}>
          <Text style={styles.label}>{c.k}</Text>
          <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
            {c.v}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles: Record<string, any> = StyleSheet.create({
  grid: {
    flexDirection: "row",
    marginHorizontal: 16,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  cell: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  cellBorder: {
    borderLeftWidth: 1,
    borderColor: BORDER,
  },
  label: {
    fontSize: 9,
    color: MUTED,
    fontFamily: fontFamilies.sans.regular,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  value: {
    fontSize: 16,
    color: INK,
    fontFamily: fontFamilies.display.semibold,
    fontWeight: "700",
    marginTop: 2,
  },
});
