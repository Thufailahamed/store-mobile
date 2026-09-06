import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Card } from "@/components/ui/Card";
import { QtyStepper } from "@/components/ui";
import { ProgressBar } from "@/components/ui";
import type { BrandInventoryRow } from "@/lib/api/backend";
import { getAvailable, getStatus } from "@/lib/brand-inventory";
import { colors, typography, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";

interface Props {
  row: BrandInventoryRow;
  pending?: boolean;
  onStep: (nextAvailable: number) => void;
  onEdit: () => void;
}

const TONE: Record<string, string> = {
  out: colors.light.destructive,
  low: colors.accent2.ochre,
  healthy: colors.olive[500],
};

export function InventoryVariantCard({ row, pending, onStep, onEdit }: Props) {
  const avail = getAvailable(row);
  const status = getStatus(avail);
  const tone = TONE[status];
  const reserved = Math.max(0, row.inventory?.reserved ?? 0);
  const canEdit = !!row.product?.id;
  const label = status === "out" ? `OUT • ${avail}` : status === "low" ? `LOW • ${avail}` : `HEALTHY • ${avail}`;
  return (
    <Card style={[styles.card, { borderLeftColor: tone, borderLeftWidth: 4 }]}>
      <View style={styles.top}>
        <View style={[styles.badge, { backgroundColor: tone }]}>
          <Text style={styles.badgeText}>{label}</Text>
        </View>
        <Text style={styles.res}>Res {reserved}</Text>
      </View>
      <Text style={styles.variant} numberOfLines={1}>
        {[row.color, row.size].filter(Boolean).join(" / ") || "Standard"} • SKU {row.sku ?? "—"}
      </Text>
      <Text style={styles.price}>{formatPrice(row.price, "LKR")}</Text>
      <ProgressBar value={Math.min(100, (avail / 20) * 100)} fillColor={tone} style={styles.bar} />
      <View style={styles.bottom}>
        {canEdit ? (
          <QtyStepper value={avail} min={0} max={9999} size="sm" disabled={pending} onChange={onStep} />
        ) : (
          <Text style={styles.res}>{avail} in stock</Text>
        )}
        {canEdit ? (
          <Pressable accessibilityRole="button" accessibilityLabel={status === "out" ? "Restock" : "Edit stock"} disabled={pending} onPress={onEdit} style={[styles.edit, pending && { opacity: 0.5 }]}>
            <Text style={styles.editText}>{status === "out" ? "Restock" : "Edit"}</Text>
          </Pressable>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: 12, gap: 6, marginBottom: 8 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  badge: { borderRadius: radii.full, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontFamily: fontFamilies.mono.medium, fontSize: typography.fontSizes.xs, color: "#fff", letterSpacing: typography.letterSpacing.wide },
  res: { fontFamily: fontFamilies.mono.regular, fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground },
  variant: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.sm, color: colors.light.foreground },
  price: { fontFamily: fontFamilies.mono.regular, fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground },
  bar: { marginTop: 4 },
  bottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 },
  edit: { backgroundColor: colors.light.primary, borderRadius: radii.full, paddingHorizontal: 16, paddingVertical: 8 },
  editText: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.sm, color: colors.light.primaryForeground },
});
