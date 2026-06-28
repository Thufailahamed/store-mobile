import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { BrandScreenHeader } from "@/components/brand/BrandScreenHeader";
import { BrandStatCard } from "@/components/brand/BrandStatCard";
import { FilterChips } from "@/components/brand/FilterChips";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { getBrandInventory } from "@/lib/api";
import type { BrandInventoryRow } from "@/lib/api/backend";
import { colors, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";

type Filter = "all" | "low" | "out" | "healthy";
const FILTERS: ReadonlyArray<{ value: Filter; label: string }> = [
  { value: "all", label: "All" },
  { value: "low", label: "Low" },
  { value: "out", label: "Out" },
  { value: "healthy", label: "Healthy" },
];

function stockLevel(row: BrandInventoryRow): number {
  return (row.inventory?.quantity ?? 0) - (row.inventory?.reserved ?? 0);
}

export default function BrandInventory() {
  const [filter, setFilter] = React.useState<Filter>("all");
  const q = useQuery({
    queryKey: ["brand-inventory"],
    queryFn: async () => {
      const r = await getBrandInventory();
      return r.ok ? r.data : [];
    },
  });

  const rows = q.data ?? [];
  const totalSkus = rows.length;
  const healthy = rows.filter((r) => stockLevel(r) > 10).length;
  const low = rows.filter((r) => stockLevel(r) > 0 && stockLevel(r) <= 10).length;
  const out = rows.filter((r) => stockLevel(r) <= 0).length;

  const filtered = rows.filter((r) => {
    const s = stockLevel(r);
    if (filter === "all") return true;
    if (filter === "out") return s <= 0;
    if (filter === "low") return s > 0 && s <= 10;
    return s > 10;
  });

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <BrandScreenHeader
        eyebrow="Brand HQ"
        title="Inventory"
        subtitle={`${totalSkus} SKUs across stores`}
        back={{ onPress: () => router.back() }}
      />
      {q.isLoading ? (
        <Skeleton style={styles.skel} />
      ) : (
        <>
          <View style={styles.grid}>
            <BrandStatCard label="Total SKUs" value={totalSkus} />
            <BrandStatCard label="Healthy" value={healthy} tone="accent" />
            <BrandStatCard label="Low stock" value={low} tone="warn" />
            <BrandStatCard label="Out of stock" value={out} tone="warn" />
          </View>
          <FilterChips value={filter} options={FILTERS} onChange={setFilter} />
          {filtered.length === 0 ? (
            <EmptyState icon="layers-outline" title="No SKUs match" />
          ) : (
            filtered.map((row) => <InventoryRow key={row.id} row={row} />)
          )}
        </>
      )}
    </ScrollView>
  );
}

function InventoryRow({ row }: { row: BrandInventoryRow }) {
  const s = stockLevel(row);
  const tone = s <= 0 ? colors.light.destructive : s <= 10 ? "#7a5b1a" : colors.olive[500];
  return (
    <Card style={styles.invCard}>
      <View style={styles.invRow}>
        <Text style={styles.invName} numberOfLines={1}>{row.product?.name ?? "—"}</Text>
        <Text style={[styles.invStock, { color: tone }]}>{s} in stock</Text>
      </View>
      <View style={styles.invMetaRow}>
        <Text style={styles.invMeta}>SKU: {row.sku ?? "—"}</Text>
        <Text style={styles.invMeta}>{row.size ?? ""} {row.color ?? ""}</Text>
        <Text style={styles.invMeta}>{formatPrice(row.price, "LKR")}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.light.background },
  content: { paddingBottom: 32 },
  skel: { height: 120, margin: 20, borderRadius: 16 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingHorizontal: 20, paddingTop: 8 },
  invCard: { marginHorizontal: 20, marginBottom: 8, padding: 12, gap: 6 },
  invRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  invName: { flex: 1, fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.sm, color: colors.light.foreground },
  invStock: { fontFamily: fontFamilies.mono.medium, fontSize: typography.fontSizes.xs },
  invMetaRow: { flexDirection: "row", gap: 12 },
  invMeta: { fontFamily: fontFamilies.mono.regular, fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground },
});
