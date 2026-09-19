import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@/components/ui/Icon";
import type { SellerGroup, SellerInventoryRow } from "@/lib/seller-inventory";
import { SellerStockCard, toneMeta } from "./SellerStockCard";
import { SELLER_CREAM } from "./chrome";
import { colors, radii, shadows, typography } from "@/lib/theme/tokens";
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
  const available = group.rows.reduce((sum, row) => sum + Math.max(0, row.available ?? 0), 0);

  return (
    <View style={styles.wrap}>
      <View style={styles.panel}>
        <TouchableOpacity
          style={styles.head}
          onPress={() => props.onOpenProduct(group.productId)}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={`Open ${group.productName}`}
        >
          {group.image ? (
            <Image source={{ uri: group.image }} style={styles.groupThumb} contentFit="cover" />
          ) : (
            <View style={[styles.groupThumb, styles.thumbEmpty]}>
              <Ionicons name="image-outline" size={18} color={colors.ink.mute} />
            </View>
          )}
          <View style={styles.headInfo}>
            <Text style={styles.title} numberOfLines={1}>{group.productName}</Text>
            <Text style={styles.count}>
              {group.rows.length} variant{group.rows.length === 1 ? "" : "s"} · {available} available
            </Text>
          </View>
          <View style={[styles.headBadge, { backgroundColor: meta.bg }]}>
            <View style={[styles.badgeDot, { backgroundColor: meta.color }]} />
            <Text style={[styles.headBadgeText, { color: meta.color }]}>{meta.label}</Text>
          </View>
          <Ionicons name="chevron-forward" size={15} color={colors.ink.mute} />
        </TouchableOpacity>

        <View style={styles.variants}>
          {group.rows.map((row, index) => (
            <SellerStockCard
              key={row.variantId}
              row={row}
              last={index === group.rows.length - 1}
              selectMode={props.selectMode}
              selected={props.selectedIds.has(row.variantId)}
              saving={props.savingId === row.variantId}
              onToggleSelect={() => props.onToggleSelect(row.variantId)}
              onLongPress={() => props.onLongPress(row.variantId)}
              onOpenProduct={() => props.onOpenProduct(row.productId)}
              onStep={(next) => props.onStep(row, next)}
              onEdit={() => props.onEdit(row)}
              onQuickRestock={() => props.onQuickRestock(row)}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, marginBottom: 14 },
  panel: {
    backgroundColor: SELLER_CREAM,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.13)",
    overflow: "hidden",
    ...shadows.soft,
  },
  head: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: 10, padding: 12, backgroundColor: "#FFFFFF" },
  groupThumb: { width: 50, height: 50, borderRadius: 15 },
  thumbEmpty: { backgroundColor: colors.olive[50], alignItems: "center", justifyContent: "center" },
  headInfo: { flex: 1, minWidth: 0, gap: 3 },
  title: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.sm, color: colors.light.foreground },
  count: { fontFamily: fontFamilies.sans.regular, fontSize: 10, color: colors.light.mutedForeground },
  headBadge: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: radii.full, paddingHorizontal: 8, paddingVertical: 5 },
  badgeDot: { width: 5, height: 5, borderRadius: 3 },
  headBadgeText: { fontFamily: fontFamilies.mono.semibold, fontSize: 8, letterSpacing: 0.5, textTransform: "uppercase" },
  variants: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(83,94,44,0.14)" },
});
