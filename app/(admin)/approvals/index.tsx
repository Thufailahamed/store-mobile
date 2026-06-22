import React, { useState, useMemo } from "react";
import { View, Text, ScrollView, RefreshControl, Pressable, Alert, StyleSheet, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@/components/ui/Icon";
import {
  getAdminPendingApprovals,
  approveStore,
  approveBrand,
  approveProduct,
} from "@/lib/api";
import { Card, ListRow, EmptyState, Chip, Badge } from "@/components/ui";
import { colors, typography, radii, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "store", label: "Stores" },
  { key: "brand", label: "Brands" },
  { key: "product", label: "Products" },
];

function rel(s: string) {
  const d = new Date(s).getTime();
  const m = Math.floor((Date.now() - d) / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function ApprovalsScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const q = useQuery({
    queryKey: ["admin-approvals"],
    queryFn: async () => {
      const r = await getAdminPendingApprovals(50);
      return r.ok ? r.data : { stores: [], brands: [], products: [] };
    },
    refetchInterval: 30_000,
  });

  const rows = useMemo(() => {
    const all = [
      ...(q.data?.stores ?? []).map((r) => ({
        ...r,
        kind: "store" as const,
        kindLabel: "Store",
        icon: "storefront-outline" as const,
        route: `/(admin)/stores/${r.id}`,
      })),
      ...(q.data?.brands ?? []).map((r) => ({ ...r, kind: "brand" as const, kindLabel: "Brand", icon: "pricetag-outline" as const, route: "/(admin)/brands" })),
      ...(q.data?.products ?? []).map((r) => ({ ...r, kind: "product" as const, kindLabel: "Product", icon: "cube-outline" as const, route: "/(admin)/products" })),
    ]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return all.filter((r) => {
      if (filter !== "all" && r.kind !== filter) return false;
      if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [q.data, filter, search]);

  const approveStoreM = useMutation({
    mutationFn: (id: string) => approveStore(id, "approved"),
    onSuccess: (res) => {
      if (!res.ok) {
        Alert.alert("Cannot approve store", res.error);
        return;
      }
      qc.invalidateQueries({ queryKey: ["admin-approvals"] });
    },
  });
  const rejectStoreM = useMutation({
    mutationFn: (id: string) => approveStore(id, "rejected"),
    onSuccess: (res) => {
      if (!res.ok) {
        Alert.alert("Cannot reject store", res.error);
        return;
      }
      qc.invalidateQueries({ queryKey: ["admin-approvals"] });
    },
  });
  const approveBrandM = useMutation({ mutationFn: (id: string) => approveBrand(id, "approved"), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-approvals"] }) });
  const rejectBrandM = useMutation({ mutationFn: (id: string) => approveBrand(id, "rejected"), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-approvals"] }) });
  const approveProductM = useMutation({ mutationFn: (id: string) => approveProduct(id, "active"), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-approvals"] }) });
  const rejectProductM = useMutation({ mutationFn: (id: string) => approveProduct(id, "rejected"), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-approvals"] }) });

  const handle = (row: any, action: "approve" | "reject") => {
    const fn = row.kind === "store"
      ? (action === "approve" ? approveStoreM : rejectStoreM).mutate
      : row.kind === "brand"
        ? (action === "approve" ? approveBrandM : rejectBrandM).mutate
        : (action === "approve" ? approveProductM : rejectProductM).mutate;
    Alert.alert(`${action === "approve" ? "Approve" : "Reject"} ${row.kindLabel}`, row.name, [
      { text: "Cancel", style: "cancel" },
      { text: action === "approve" ? "Approve" : "Reject", style: action === "approve" ? "default" : "destructive", onPress: () => fn(row.id) },
    ]);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={colors.light.primary} />}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>APPROVAL QUEUE</Text>
          <Text style={styles.title}>Pending Review</Text>
        </View>
        <Text style={styles.count}>{rows.length}</Text>
      </View>

      <TextInput
        style={styles.search}
        placeholder="Search…"
        placeholderTextColor={colors.light.muted}
        value={search}
        onChangeText={setSearch}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {FILTERS.map((f) => (
          <Pressable key={f.key} onPress={() => setFilter(f.key)} style={[styles.chip, filter === f.key && styles.chipActive]}>
            <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>{f.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {q.isLoading ? (
        <View style={styles.list}>
          {[0, 1, 2].map((i) => (
            <Card key={i} style={styles.row}><Text style={styles.muted}>…</Text></Card>
          ))}
        </View>
      ) : rows.length === 0 ? (
        <EmptyState icon="checkmark-done" title="Inbox zero" description="Nothing pending. Take a breath." />
      ) : (
        <View style={styles.list}>
          {rows.map((row, i) => (
            <Card key={`${row.kind}-${row.id}`} style={styles.rowCard}>
              <View style={styles.rowHead}>
                <View style={styles.rowHeadLeft}>
                  <View style={[styles.kindIcon, { backgroundColor: kindBg(row.kind) }]}>
                    <Ionicons name={row.icon} size={16} color={colors.light.foreground} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowName} numberOfLines={1}>{row.name}</Text>
                    <Text style={styles.rowMeta}>
                      {row.kindLabel} · {rel(row.created_at)} ago
                    </Text>
                  </View>
                </View>
                <Badge variant={row.kind === "store" ? "default" : row.kind === "brand" ? "secondary" : "outline"}>
                  {row.kindLabel}
                </Badge>
              </View>
              <View style={styles.rowActions}>
                <Pressable onPress={() => handle(row, "approve")} style={[styles.btn, styles.btnPrimary]}>
                  <Ionicons name="checkmark" size={14} color="#fff" />
                  <Text style={styles.btnPrimaryText}>Approve</Text>
                </Pressable>
                <Pressable onPress={() => handle(row, "reject")} style={styles.btn}>
                  <Ionicons name="close" size={14} color={colors.light.foreground} />
                  <Text style={styles.btnText}>Reject</Text>
                </Pressable>
                <Pressable
                  onPress={() => router.push(row.route as any)}
                  style={styles.btn}
                >
                  <Ionicons name="open-outline" size={14} color={colors.light.foreground} />
                  <Text style={styles.btnText}>View</Text>
                </Pressable>
              </View>
            </Card>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function kindBg(k: string) {
  if (k === "store") return "#dde4d6";
  if (k === "brand") return "#fdf3d7";
  return "#e6e6d0";
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  content: { paddingBottom: 100 },
  header: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", padding: 20, paddingBottom: 12 },
  eyebrow: { fontFamily: fontFamilies.mono.medium, fontSize: 10, color: colors.light.primary, letterSpacing: 1.4 },
  title: { fontFamily: fontFamilies.display.regular, fontSize: 28, color: colors.light.foreground, marginTop: 4, letterSpacing: -0.5 },
  count: { fontFamily: fontFamilies.mono.regular, fontSize: 12, color: colors.light.mutedForeground },
  search: {
    marginHorizontal: 20,
    marginTop: 4,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.light.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.light.border,
    fontSize: 14,
    color: colors.light.foreground,
  },
  filters: { paddingHorizontal: 20, gap: 8, paddingBottom: 12 },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.light.card, borderWidth: 1, borderColor: colors.light.border },
  chipActive: { backgroundColor: colors.light.primary, borderColor: colors.light.primary },
  chipText: { fontFamily: fontFamilies.mono.medium, fontSize: 11, color: colors.light.mutedForeground, letterSpacing: 0.5 },
  chipTextActive: { color: "#fff" },
  list: { paddingHorizontal: 20, gap: 10 },
  row: { padding: 16 },
  rowCard: { padding: 16, gap: 12, ...shadows.soft },
  rowHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  rowHeadLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  kindIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  rowName: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: colors.light.foreground },
  rowMeta: { fontFamily: fontFamilies.sans.regular, fontSize: 11, color: colors.light.mutedForeground, marginTop: 2 },
  rowActions: { flexDirection: "row", gap: 6 },
  btn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.light.card,
  },
  btnPrimary: { backgroundColor: colors.light.primary, borderColor: colors.light.primary },
  btnText: { fontFamily: fontFamilies.sans.semibold, fontSize: 11, color: colors.light.foreground, letterSpacing: 0.5 },
  btnPrimaryText: { fontFamily: fontFamilies.sans.semibold, fontSize: 11, color: "#fff", letterSpacing: 0.5 },
  muted: { color: colors.light.mutedForeground },
});
