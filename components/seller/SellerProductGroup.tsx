import React, { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Image } from "expo-image";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { Ionicons } from "@/components/ui/Icon";
import type { SellerGroup, SellerInventoryRow } from "@/lib/seller-inventory";
import { sellerStatus } from "@/lib/seller-inventory";
import { SellerStockCard, toneMeta } from "./SellerStockCard";
import { SELLER_GOLD, SELLER_RUST } from "./chrome";
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
  /** Open the variants by default — e.g. while searching or filtering. */
  autoExpand?: boolean;
}

// Products start collapsed so long variant lists (8 sizes × 4 colours) don't
// bury every other product; tapping the product reveals its variants.
export function SellerProductGroup(props: Props) {
  const { group } = props;
  const [expanded, setExpanded] = useState(!!props.autoExpand);
  useEffect(() => {
    setExpanded(!!props.autoExpand);
  }, [props.autoExpand]);
  const meta = toneMeta(group.worst);

  let available = 0;
  const counts = { out: 0, low: 0, ok: 0, unknown: 0 };
  for (const row of group.rows) {
    available += Math.max(0, row.available ?? 0);
    counts[sellerStatus(row.available)] += 1;
  }
  const total = group.rows.length;
  const issues = counts.out + counts.low;

  const open = expanded || props.selectMode;

  return (
    <View style={styles.wrap}>
      <View style={styles.panel}>
        <TouchableOpacity
          style={[styles.head, open && styles.headOpen]}
          onPress={() => !props.selectMode && setExpanded((v) => !v)}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={`${group.productName}, ${meta.label}. ${open ? "Hide" : "Show"} ${total} variants`}
        >
          <View style={styles.thumbWrap}>
            {group.image ? (
              <Image source={{ uri: group.image }} style={styles.groupThumb} contentFit="cover" />
            ) : (
              <View style={[styles.groupThumb, styles.thumbEmpty]}>
                <Ionicons name="image-outline" size={20} color={colors.ink.mute} />
              </View>
            )}
            {issues > 0 ? (
              <View style={[styles.thumbBadge, { backgroundColor: counts.out > 0 ? SELLER_RUST : SELLER_GOLD }]}>
                <Ionicons name="alert" size={10} color="#FFFFFF" />
                <Text style={styles.thumbBadgeText}>{issues}</Text>
              </View>
            ) : (
              <View style={[styles.thumbBadge, { backgroundColor: colors.olive[700] }]}>
                <Ionicons name="checkmark" size={11} color="#FFFFFF" />
              </View>
            )}
          </View>
          <View style={styles.headInfo}>
            <View style={styles.titleRow}>
              <Text style={styles.title} numberOfLines={1}>{group.productName}</Text>
              <TouchableOpacity
                style={styles.openBtn}
                onPress={() => props.onOpenProduct(group.productId)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Open ${group.productName}`}
              >
                <Ionicons name="arrow-forward" size={13} color={colors.olive[800]} />
              </TouchableOpacity>
            </View>
            <Text style={styles.count} numberOfLines={1}>
              {total} variant{total === 1 ? "" : "s"} · <Text style={styles.countStrong}>{available}</Text> {available === 1 ? "unit" : "units"} available
            </Text>
            <View style={styles.bar}>
              {counts.out > 0 ? <View style={{ flex: counts.out, backgroundColor: SELLER_RUST, borderRadius: 3 }} /> : null}
              {counts.low > 0 ? <View style={{ flex: counts.low, backgroundColor: SELLER_GOLD, borderRadius: 3 }} /> : null}
              {counts.ok > 0 ? <View style={{ flex: counts.ok, backgroundColor: colors.olive[500], borderRadius: 3 }} /> : null}
              {counts.unknown > 0 ? <View style={{ flex: counts.unknown, backgroundColor: "rgba(83,94,44,0.15)", borderRadius: 3 }} /> : null}
            </View>
            <View style={styles.chips}>
              {counts.out > 0 ? <CountChip label="Out" value={counts.out} status="out" /> : null}
              {counts.low > 0 ? <CountChip label="Low" value={counts.low} status="low" /> : null}
              {counts.ok > 0 ? <CountChip label="Healthy" value={counts.ok} status="ok" /> : null}
              <View style={{ flex: 1 }} />
              {!props.selectMode ? (
                <View style={[styles.toggle, open && styles.toggleOpen]}>
                  <Text style={[styles.toggleText, open && styles.toggleTextOpen]}>{open ? "Hide" : "Variants"}</Text>
                  <Ionicons name={open ? "chevron-up" : "chevron-down"} size={12} color={open ? "#FAF8F1" : colors.olive[800]} />
                </View>
              ) : null}
            </View>
          </View>
        </TouchableOpacity>

        {open ? (
          <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)} style={styles.variants}>
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
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
}

function CountChip({ label, value, status }: { label: string; value: number; status: "out" | "low" | "ok" }) {
  const m = toneMeta(status);
  return (
    <View style={[styles.chip, { backgroundColor: m.bg }]}>
      <Text style={[styles.chipValue, { color: m.color }]}>{value}</Text>
      <Text style={[styles.chipLabel, { color: m.color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, marginBottom: 14 },
  panel: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.12)",
    overflow: "hidden",
    ...shadows.soft,
    shadowOpacity: 0.06,
  },
  head: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14, backgroundColor: "#FFFFFF" },
  headOpen: { backgroundColor: colors.paper.cream },
  thumbWrap: { position: "relative" },
  groupThumb: { width: 72, height: 72, borderRadius: 18 },
  thumbEmpty: { backgroundColor: colors.olive[50], alignItems: "center", justifyContent: "center" },
  thumbBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  thumbBadgeText: { fontFamily: fontFamilies.mono.semibold, fontSize: 9.5, color: "#FFFFFF" },
  headInfo: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { flex: 1, fontFamily: fontFamilies.sans.bold, fontSize: 18, lineHeight: 23, color: colors.light.foreground, letterSpacing: -0.2 },
  openBtn: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.olive[50], alignItems: "center", justifyContent: "center" },
  count: { marginTop: 2, fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.light.mutedForeground },
  countStrong: { fontFamily: fontFamilies.sans.semibold, color: colors.light.foreground },
  bar: { marginTop: 9, height: 5, borderRadius: 3, flexDirection: "row", gap: 2, overflow: "hidden", backgroundColor: "rgba(83,94,44,0.08)" },
  chips: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 5, marginTop: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999 },
  chipValue: { fontFamily: fontFamilies.sans.bold, fontSize: 11 },
  chipLabel: { fontFamily: fontFamilies.sans.medium, fontSize: 11 },
  toggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingLeft: 9,
    paddingRight: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.olive[50],
  },
  toggleOpen: { backgroundColor: colors.olive[950] },
  toggleText: { fontFamily: fontFamilies.sans.semibold, fontSize: 11, color: colors.olive[800] },
  toggleTextOpen: { color: "#FAF8F1" },
  variants: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(83,94,44,0.14)" },
});
