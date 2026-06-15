import React, { useState } from "react";
import { View, Text, FlatList, Pressable, RefreshControl, StyleSheet, TextInput, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAdminBrands, approveBrand } from "@/lib/api";
import { Card, ListRow, EmptyState, Badge, Skeleton } from "@/components/ui";
import { colors, typography, radii, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

const STATUS_TABS = ["all", "approved", "pending", "rejected"];

function rel(s: string) {
  const d = new Date(s).getTime();
  const m = Math.floor((Date.now() - d) / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function AdminBrands() {
  const router = useRouter();
  const qc = useQueryClient();
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");

  const q = useQuery({
    queryKey: ["admin-brands", status, search],
    queryFn: async () => {
      const r = await getAdminBrands({ status, search });
      return r.ok ? r.data : { brands: [], total: 0 };
    },
  });

  const approveM = useMutation({ mutationFn: (id: string) => approveBrand(id, "approved"), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-brands"] }) });
  const rejectM = useMutation({ mutationFn: (id: string) => approveBrand(id, "rejected"), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-brands"] }) });

  const brands = q.data?.brands ?? [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>BRANDS</Text>
          <Text style={styles.title}>Directory</Text>
        </View>
        <Text style={styles.count}>{q.data?.total ?? 0}</Text>
      </View>

      <TextInput
        style={styles.search}
        placeholder="Search brands…"
        placeholderTextColor={colors.light.muted}
        value={search}
        onChangeText={setSearch}
      />

      <FlatList
        horizontal
        data={STATUS_TABS}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
        keyExtractor={(s) => s}
        renderItem={({ item: t }) => (
          <Pressable onPress={() => setStatus(t)} style={[styles.chip, status === t && styles.chipActive]}>
            <Text style={[styles.chipText, status === t && styles.chipTextActive]}>{t}</Text>
          </Pressable>
        )}
      />

      {q.isLoading ? (
        <View style={styles.list}><Skeleton height={80} /></View>
      ) : brands.length === 0 ? (
        <EmptyState icon="pricetag-outline" title="No brands" />
      ) : (
        <FlatList
          data={brands}
          keyExtractor={(b: any) => b.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} />}
          renderItem={({ item, index }: any) => (
            <Card style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.index}>{String(index + 1).padStart(2, "0")}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.meta}>@{item.slug} · {item.total_followers ?? 0} followers · {rel(item.created_at)} ago</Text>
                </View>
                <Badge variant={item.status === "approved" ? "default" : item.status === "pending" ? "secondary" : "destructive"}>
                  {item.status}
                </Badge>
              </View>
              {item.status === "pending" && (
                <View style={styles.actions}>
                  <Pressable onPress={() => Alert.alert("Approve", item.name, [{ text: "Cancel", style: "cancel" }, { text: "Approve", onPress: () => approveM.mutate(item.id) }])} style={[styles.btn, styles.btnPrimary]}>
                    <Text style={styles.btnPrimaryText}>Approve</Text>
                  </Pressable>
                  <Pressable onPress={() => Alert.alert("Reject", item.name, [{ text: "Cancel", style: "cancel" }, { text: "Reject", style: "destructive", onPress: () => rejectM.mutate(item.id) }])} style={styles.btn}>
                    <Text style={styles.btnText}>Reject</Text>
                  </Pressable>
                </View>
              )}
            </Card>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  header: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", padding: 20, paddingBottom: 12 },
  eyebrow: { fontFamily: fontFamilies.mono.medium, fontSize: 10, color: colors.light.primary, letterSpacing: 1.4 },
  title: { fontFamily: fontFamilies.display.regular, fontSize: 28, color: colors.light.foreground, marginTop: 4, letterSpacing: -0.5 },
  count: { fontFamily: fontFamilies.mono.regular, fontSize: 12, color: colors.light.mutedForeground },
  search: {
    marginHorizontal: 20,
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
  chipText: { fontFamily: fontFamilies.mono.medium, fontSize: 10, color: colors.light.mutedForeground, letterSpacing: 0.5, textTransform: "uppercase" },
  chipTextActive: { color: "#fff" },
  list: { padding: 20, paddingTop: 0, paddingBottom: 100, gap: 10 },
  card: { padding: 14, ...shadows.soft },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  index: { fontFamily: fontFamilies.mono.regular, fontSize: 11, color: colors.light.mutedForeground, width: 24 },
  name: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: colors.light.foreground },
  meta: { fontFamily: fontFamilies.sans.regular, fontSize: 11, color: colors.light.mutedForeground, marginTop: 2 },
  actions: { flexDirection: "row", gap: 8, marginTop: 12 },
  btn: { flex: 1, paddingVertical: 8, borderRadius: radii.md, borderWidth: 1, borderColor: colors.light.border, alignItems: "center" },
  btnPrimary: { backgroundColor: colors.light.primary, borderColor: colors.light.primary },
  btnText: { fontFamily: fontFamilies.sans.semibold, fontSize: 11, color: colors.light.foreground, letterSpacing: 0.5, textTransform: "uppercase" },
  btnPrimaryText: { fontFamily: fontFamilies.sans.semibold, fontSize: 11, color: "#fff", letterSpacing: 0.5, textTransform: "uppercase" },
});
