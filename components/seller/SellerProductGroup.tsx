import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Image } from "expo-image";
import type { SellerGroup, SellerInventoryRow } from "@/lib/seller-inventory";
import { SellerStockCard } from "./SellerStockCard";
import { toneMeta } from "./SellerStockCard";
import { colors, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

interface Props {
  group: SellerGroup;
  savingId: string | null;
  selectMode: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onLongPress: (id: string) => void;
  onOpenProduct: (productId: string) => void;
  onStep: (row: SellerInventoryRow, nextOnHand: number) => void;
  onEdit: (row: SellerInventoryRow) => void;
  onQuickRestock: (row: SellerInventoryRow) => void;
}

export function SellerProductGroup(props: Props) {
  const { group } = props;
  const meta = toneMeta(group.worst);
  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        {group.image ? (
          <Image source={{ uri: group.image }} style={styles.groupThumb} contentFit="cover" />
        ) : null}
        <Text style={styles.title} numberOfLines={1}>{group.productName}</Text>
        <View style={[styles.headBadge, { backgroundColor: meta.bg }]}>
          <Text style={[styles.headBadgeText, { color: meta.color }]}>{meta.label}</Text>
        </View>
        <Text style={styles.count}>{group.rows.length} variant{group.rows.length === 1 ? "" : "s"}</Text>
      </View>
      {group.rows.map((r) => (
        <SellerStockCard
          key={r.variantId}
          row={r}
          selectMode={props.selectMode}
          selected={props.selectedIds.has(r.variantId)}
          saving={props.savingId === r.variantId}
          onToggleSelect={() => props.onToggleSelect(r.variantId)}
          onLongPress={() => props.onLongPress(r.variantId)}
          onOpenProduct={() => props.onOpenProduct(r.productId)}
          onStep={(n) => props.onStep(r, n)}
          onEdit={() => props.onEdit(r)}
          onQuickRestock={() => props.onQuickRestock(r)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, marginBottom: 12 },
  head: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  groupThumb: { width: 28, height: 28, borderRadius: 14 },
  title: { flex: 1, fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.sm, color: colors.light.foreground },
  count: { fontFamily: fontFamilies.mono.regular, fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground },
  headBadge: { borderRadius: 9999, paddingHorizontal: 8, paddingVertical: 2 },
  headBadgeText: { fontFamily: fontFamilies.mono.medium, fontSize: 10, letterSpacing: 0.4, textTransform: "uppercase" },
});
