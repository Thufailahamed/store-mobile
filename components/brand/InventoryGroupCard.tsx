import React from "react";
import { View, Text, StyleSheet } from "react-native";
import type { InventoryGroup } from "@/lib/brand-inventory";
import { InventoryVariantCard } from "./InventoryVariantCard";
import type { BrandInventoryRow } from "@/lib/api/backend";
import { colors, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

interface Props {
  group: InventoryGroup;
  pendingId?: string | null;
  onStep: (row: BrandInventoryRow, next: number) => void;
  onEdit: (row: BrandInventoryRow) => void;
}

export function InventoryGroupCard({ group, pendingId, onStep, onEdit }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.title} numberOfLines={1}>{group.productName}</Text>
        <Text style={styles.count}>{group.rows.length} variant{group.rows.length === 1 ? "" : "s"}</Text>
      </View>
      {group.rows.map((r) => (
        <InventoryVariantCard key={r.id} row={r} pending={pendingId === r.id} onStep={(n) => onStep(r, n)} onEdit={() => onEdit(r)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, marginBottom: 12, gap: 8 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  title: { flex: 1, fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.sm, color: colors.light.foreground },
  count: { fontFamily: fontFamilies.mono.regular, fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground },
});
