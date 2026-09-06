import React from "react";
import { View, Text, ScrollView, RefreshControl, Pressable, StyleSheet } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { BrandScreenHeader } from "@/components/brand/BrandScreenHeader";
import { BrandStatCard } from "@/components/brand/BrandStatCard";
import { FilterChips } from "@/components/brand/FilterChips";
import { InventoryGroupCard } from "@/components/brand/InventoryGroupCard";
import { StockEditSheet } from "@/components/brand/StockEditSheet";
import { Input, EmptyState, Skeleton, useToast } from "@/components/ui";
import { getBrandInventory, updateVariantStock } from "@/lib/api";
import type { BrandInventoryRow } from "@/lib/api/backend";
import { getAvailable, getStatus, groupByProduct, filterRows, sortRows, buildOptimisticQuantity } from "@/lib/brand-inventory";
import type { StockFilter, StockSort } from "@/lib/brand-inventory";
import { colors, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

const FILTERS: ReadonlyArray<{ value: StockFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "low", label: "Low" },
  { value: "out", label: "Out" },
  { value: "healthy", label: "Healthy" },
];
const SORTS: ReadonlyArray<{ value: StockSort; label: string }> = [
  { value: "urgency", label: "Urgency" },
  { value: "lowest", label: "Lowest" },
  { value: "name", label: "Name" },
];

export default function BrandInventory() {
  const [filter, setFilter] = React.useState<StockFilter>("all");
  const [sort, setSort] = React.useState<StockSort>("urgency");
  const [query, setQuery] = React.useState("");
  const [editing, setEditing] = React.useState<BrandInventoryRow | null>(null);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const qc = useQueryClient();
  const { toast } = useToast();

  const q = useQuery({
    queryKey: ["brand-inventory"],
    queryFn: async () => {
      const r = await getBrandInventory();
      return r.ok ? r.data : [];
    },
  });

  const m = useMutation({
    mutationFn: async ({ row, next }: { row: BrandInventoryRow; next: number }) => {
      const productId = row.product?.id;
      if (!productId) throw new Error("Missing product id");
      const res = await updateVariantStock(productId, row.id, buildOptimisticQuantity(row, next));
      if (!res.ok) throw new Error(typeof res.error === "string" ? res.error : "Update failed");
    },
    onMutate: async ({ row, next }) => {
      await qc.cancelQueries({ queryKey: ["brand-inventory"] });
      const prev = qc.getQueryData<BrandInventoryRow[]>(["brand-inventory"]);
      qc.setQueryData<BrandInventoryRow[]>(["brand-inventory"], (old) =>
        (old ?? []).map((r) =>
          r.id === row.id ? { ...r, inventory: { quantity: buildOptimisticQuantity(r, next), reserved: r.inventory?.reserved ?? 0 } } : r,
        ),
      );
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["brand-inventory"], ctx.prev);
      const msg = err instanceof Error ? err.message : "Couldn't update — try again";
      setSaveError(msg);
      toast.error(msg);
    },
    onSuccess: (_d, vars) => {
      if (editing && vars.row.id === editing.id) setEditing(null);
      setSaveError(null);
      toast.success("Stock updated");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["brand-inventory"] });
    },
  });

  const rows = q.data ?? [];
  const counts = React.useMemo(() => {
    let healthy = 0, low = 0, out = 0;
    for (const r of rows) {
      const s = getStatus(getAvailable(r));
      if (s === "healthy") healthy += 1;
      else if (s === "low") low += 1;
      else out += 1;
    }
    return { total: rows.length, healthy, low, out };
  }, [rows]);

  const visible = React.useMemo(() => sortRows(filterRows(rows, filter, query), sort), [rows, filter, query, sort]);
  const groups = React.useMemo(() => groupByProduct(visible), [visible]);

  const submit = (row: BrandInventoryRow, next: number) => {
    setSaveError(null);
    m.mutate({ row, next });
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} />}
    >
      <BrandScreenHeader
        eyebrow="Brand HQ"
        title="Inventory"
        subtitle={`${counts.total} SKUs • ${counts.low} low • ${counts.out} out`}
        back={{ onPress: () => router.back() }}
      />
      {q.isLoading ? (
        <Skeleton style={styles.skel} />
      ) : q.isError ? (
        <EmptyState icon="alert-circle-outline" title="Couldn't load inventory" description="Check your connection and try again." action={<Pressable onPress={() => q.refetch()} style={styles.retry}><Text style={styles.retryText}>Retry</Text></Pressable>} />
      ) : (
        <>
          <View style={styles.grid}>
            <BrandStatCard label="Total SKUs" value={counts.total} />
            <BrandStatCard label="Healthy" value={counts.healthy} tone="accent" />
            <BrandStatCard label="Low stock" value={counts.low} tone="warn" sub="≤5 left" />
            <BrandStatCard label="Out of stock" value={counts.out} tone="warn" />
          </View>
          <View style={styles.searchWrap}>
            <Input placeholder="Search product, SKU…" value={query} onChangeText={setQuery} />
            <View style={styles.sortRow}>
              {SORTS.map((s) => (
                <Pressable key={s.value} onPress={() => setSort(s.value)} style={[styles.sortPill, sort === s.value && styles.sortActive]}>
                  <Text style={[styles.sortText, sort === s.value && styles.sortTextActive]}>{s.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <FilterChips
            value={filter}
            options={FILTERS.map((f) => ({
              value: f.value,
              label: f.value === "all" ? `All ${counts.total}` : f.value === "low" ? `Low ${counts.low}` : f.value === "out" ? `Out ${counts.out}` : `Healthy ${counts.healthy}`,
            }))}
            onChange={setFilter}
          />
          {visible.length === 0 ? (
            <EmptyState icon="layers-outline" title={rows.length === 0 ? "No inventory yet" : "No SKUs match"} description={rows.length === 0 ? undefined : "Try clearing search or filters."} />
          ) : (
            groups.map((g) => (
              <InventoryGroupCard key={g.key} group={g} pendingId={m.isPending ? m.variables?.row.id ?? null : null} onStep={submit} onEdit={(r) => { setSaveError(null); setEditing(r); }} />
            ))
          )}
        </>
      )}
      <StockEditSheet visible={!!editing} row={editing} saving={m.isPending} error={saveError} onClose={() => setEditing(null)} onSave={(n) => editing && submit(editing, n)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.light.background },
  content: { paddingBottom: 32 },
  skel: { height: 120, margin: 20, borderRadius: 16 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingHorizontal: 20, paddingTop: 8 },
  searchWrap: { paddingHorizontal: 20, paddingTop: 12, gap: 8 },
  sortRow: { flexDirection: "row", gap: 8 },
  sortPill: { borderWidth: 1, borderColor: colors.light.border, borderRadius: 9999, paddingHorizontal: 12, paddingVertical: 6 },
  sortActive: { backgroundColor: colors.light.primary, borderColor: colors.light.primary },
  sortText: { fontFamily: fontFamilies.sans.medium, fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground },
  sortTextActive: { color: colors.light.primaryForeground },
  retry: { backgroundColor: colors.light.primary, borderRadius: 9999, paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.sm, color: colors.light.primaryForeground },
});
