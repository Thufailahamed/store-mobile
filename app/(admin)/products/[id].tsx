import React, { useEffect } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Ionicons from "@expo/vector-icons/Ionicons";
import { getProductById, approveProduct } from "@/lib/api";
import { Card, StatTile, EmptyState, Skeleton, Badge, ProgressBar } from "@/components/ui";
import { colors, typography, radii, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";

export default function AdminProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["admin-product", id],
    queryFn: async () => {
      const r = await getProductById(id!);
      return r.ok ? r.data : null;
    },
    enabled: !!id,
  });

  const approve = useMutation({ mutationFn: () => approveProduct(id!, "active"), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-product", id] }) });

  if (q.isLoading) return <View style={styles.container}><Skeleton height={200} /></View>;
  const p: any = q.data;
  if (!p) return <EmptyState icon="cube-outline" title="Product not found" />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Ionicons name="chevron-back" size={20} color={colors.light.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>PRODUCT</Text>
          <Text style={styles.title} numberOfLines={2}>{p.name}</Text>
        </View>
      </View>

      <Card style={styles.heroCard}>
        <Text style={styles.eyebrow2}>STATUS</Text>
        <View style={styles.statusRow}>
          <Badge variant={p.status === "approved" ? "default" : p.status === "pending" ? "secondary" : "destructive"}>{p.status}</Badge>
          <Text style={styles.sku}>SKU {p.sku ?? "—"}</Text>
        </View>
        <View style={styles.priceRow}>
          <Text style={styles.price}>{formatPrice(p.price, p.currency ?? "LKR")}</Text>
          {p.compare_at_price ? <Text style={styles.compare}>{formatPrice(p.compare_at_price, p.currency ?? "LKR")}</Text> : null}
        </View>
      </Card>

      <View style={styles.statRow}>
        <StatTile label="Stock" value={String(p.stock ?? 0)} sub={p.stock > 10 ? "Healthy" : p.stock > 0 ? "Low" : "Out"} size="md" />
        <StatTile label="Sales" value={String(p.units_sold ?? 0)} sub="lifetime" size="md" />
        <StatTile label="Rating" value={p.rating_avg ? p.rating_avg.toFixed(1) : "—"} sub={`${p.rating_count ?? 0} reviews`} size="md" />
      </View>

      {p.status === "pending" && (
        <View style={styles.approvalRow}>
          <Pressable onPress={() => approve.mutate()} style={styles.approve}>
            <Text style={styles.approveText}>Approve</Text>
          </Pressable>
          <Pressable style={styles.reject}>
            <Text style={styles.rejectText}>Reject</Text>
          </Pressable>
        </View>
      )}

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Inventory</Text>
        <View style={{ marginTop: 12, gap: 12 }}>
          <Stat label="Variants" value={p.variant_count ?? 0} />
          <Stat label="Categories" value={p.category_count ?? 0} />
          <Stat label="Views" value={p.view_count ?? 0} />
        </View>
      </Card>

      {p.description ? (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.body}>{p.description}</Text>
        </Card>
      ) : null}
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{String(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  content: { paddingBottom: 100 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 20, paddingBottom: 12 },
  back: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.light.card, alignItems: "center", justifyContent: "center", marginTop: 18 },
  eyebrow: { fontFamily: fontFamilies.mono.medium, fontSize: 10, color: colors.light.primary, letterSpacing: 1.4 },
  eyebrow2: { fontFamily: fontFamilies.mono.medium, fontSize: 10, color: colors.light.mutedForeground, letterSpacing: 1.4, marginBottom: 8 },
  title: { fontFamily: fontFamilies.display.regular, fontSize: 24, color: colors.light.foreground, marginTop: 4, letterSpacing: -0.4 },
  heroCard: { marginHorizontal: 20, padding: 16, ...shadows.soft },
  statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sku: { fontFamily: fontFamilies.mono.regular, fontSize: 11, color: colors.light.mutedForeground },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 12 },
  price: { fontFamily: fontFamilies.display.semibold, fontSize: 28, color: colors.light.foreground, letterSpacing: -0.5 },
  compare: { fontFamily: fontFamilies.sans.regular, fontSize: 14, color: colors.light.mutedForeground, textDecorationLine: "line-through" },
  statRow: { flexDirection: "row", gap: 8, padding: 20, paddingBottom: 0 },
  approvalRow: { flexDirection: "row", gap: 8, padding: 20, paddingBottom: 0 },
  approve: { flex: 1, paddingVertical: 12, borderRadius: radii.md, backgroundColor: colors.light.primary, alignItems: "center" },
  approveText: { fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: "#fff", letterSpacing: 0.5, textTransform: "uppercase" },
  reject: { flex: 1, paddingVertical: 12, borderRadius: radii.md, borderWidth: 1, borderColor: colors.light.destructive, alignItems: "center" },
  rejectText: { fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: colors.light.destructive, letterSpacing: 0.5, textTransform: "uppercase" },
  section: { margin: 20, marginBottom: 0, padding: 16, ...shadows.soft },
  sectionTitle: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: colors.light.foreground, letterSpacing: 0.5 },
  body: { fontFamily: fontFamilies.sans.regular, fontSize: 13, color: colors.light.foreground, lineHeight: 20, marginTop: 8 },
  stat: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.light.border },
  statLabel: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.light.mutedForeground },
  statValue: { fontFamily: fontFamilies.mono.semibold, fontSize: 13, color: colors.light.foreground },
});
