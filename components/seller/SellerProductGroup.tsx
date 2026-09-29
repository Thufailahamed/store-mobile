import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@/components/ui/Icon";
import type { SellerGroup, SellerInventoryRow } from "@/lib/seller-inventory";
import { sellerStatus } from "@/lib/seller-inventory";
import { SellerStockCard, toneMeta } from "./SellerStockCard";
import { SELLER_CREAM, SELLER_GOLD, SELLER_RUST } from "./chrome";
import { colors, shadows } from "@/lib/theme/tokens";
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

// Long variant lists (e.g. 8 sizes × 4 colours) buried every other product.
// Rows arrive urgency-sorted, so the collapsed preview shows the problems first.
const PREVIEW_ROWS = 3;

export function SellerProductGroup(props: Props) {
  const { group } = props;
  const [expanded, setExpanded] = useState(false);
  const meta = toneMeta(group.worst);

  let available = 0;
  const counts = { out: 0, low: 0, ok: 0, unknown: 0 };
  for (const row of group.rows) {
    available += Math.max(0, row.available ?? 0);
    counts[sellerStatus(row.available)] += 1;
  }
  const total = group.rows.length;
  const summary = [
    counts.out > 0 ? `${counts.out} out` : null,
    counts.low > 0 ? `${counts.low} low` : null,
    counts.ok > 0 ? `${counts.ok} healthy` : null,
  ].filter(Boolean).join(" · ");

  const showAll = expanded || props.selectMode || total <= PREVIEW_ROWS + 1;
  const visible = showAll ? group.rows : group.rows.slice(0, PREVIEW_ROWS);
  const hidden = total - visible.length;
  const canToggle = !props.selectMode && total > PREVIEW_ROWS + 1;

  return (
    <View style={styles.wrap}>
      <View style={styles.panel}>
        <TouchableOpacity
          style={styles.head}
          onPress={() => props.onOpenProduct(group.productId)}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={`Open ${group.productName}, ${meta.label}`}
        >
          {group.image ? (
            <Image source={{ uri: group.image }} style={styles.groupThumb} contentFit="cover" />
          ) : (
            <View style={[styles.groupThumb, styles.thumbEmpty]}>
              <Ionicons name="image-outline" size={18} color={colors.ink.mute} />
            </View>
          )}
          <View style={styles.headInfo}>
            <View style={styles.titleRow}>
              <Text style={styles.title} numberOfLines={1}>{group.productName}</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.ink.mute} />
            </View>
            <Text style={styles.count} numberOfLines={1}>
              {total} variant{total === 1 ? "" : "s"} · <Text style={styles.countStrong}>{available}</Text> {available === 1 ? "unit" : "units"} available
            </Text>
            <View style={styles.bar}>
              {counts.out > 0 ? <View style={{ flex: counts.out, backgroundColor: SELLER_RUST }} /> : null}
              {counts.low > 0 ? <View style={{ flex: counts.low, backgroundColor: SELLER_GOLD }} /> : null}
              {counts.ok > 0 ? <View style={{ flex: counts.ok, backgroundColor: colors.olive[600] }} /> : null}
              {counts.unknown > 0 ? <View style={{ flex: counts.unknown, backgroundColor: "rgba(83,94,44,0.15)" }} /> : null}
            </View>
            {summary ? <Text style={[styles.summary, { color: meta.color }]}>{summary}</Text> : null}
          </View>
        </TouchableOpacity>

        <View style={styles.variants}>
          {visible.map((row, index) => (
            <SellerStockCard
              key={row.variantId}
              row={row}
              last={index === visible.length - 1 && !canToggle}
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
          {canToggle ? (
            <TouchableOpacity
              style={styles.moreButton}
              onPress={() => setExpanded((v) => !v)}
              accessibilityRole="button"
              accessibilityState={{ expanded }}
            >
              <Text style={styles.moreText}>
                {expanded ? "Show fewer" : `Show ${hidden} more variant${hidden === 1 ? "" : "s"}`}
              </Text>
              <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={13} color={colors.olive[800]} />
            </TouchableOpacity>
          ) : null}
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
  head: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: "#FFFFFF" },
  groupThumb: { width: 60, height: 60, borderRadius: 16 },
  thumbEmpty: { backgroundColor: colors.olive[50], alignItems: "center", justifyContent: "center" },
  headInfo: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  title: { flexShrink: 1, fontFamily: fontFamilies.display.semibold, fontSize: 17, lineHeight: 22, color: colors.light.foreground },
  count: { marginTop: 2, fontFamily: fontFamilies.sans.regular, fontSize: 11, color: colors.light.mutedForeground },
  countStrong: { fontFamily: fontFamilies.sans.semibold, color: colors.light.foreground },
  bar: { marginTop: 8, height: 5, borderRadius: 3, flexDirection: "row", gap: 2, overflow: "hidden", backgroundColor: "rgba(83,94,44,0.08)" },
  summary: { marginTop: 5, fontFamily: fontFamilies.mono.semibold, fontSize: 9, letterSpacing: 0.4, textTransform: "uppercase" },
  moreButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    minHeight: 44,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(83,94,44,0.14)",
    backgroundColor: "#FFFFFF",
  },
  moreText: { fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: colors.olive[800] },
  variants: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(83,94,44,0.14)" },
});
