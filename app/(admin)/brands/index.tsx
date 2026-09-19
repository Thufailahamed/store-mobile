import React, { useState } from "react";
import { View, Text, FlatList, Pressable, RefreshControl, StyleSheet, TextInput, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Ionicons } from "@/components/ui/Icon";
import { getAdminBrands, approveBrand } from "@/lib/api";
import { EmptyState, Skeleton } from "@/components/ui";
import { colors, radii, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { resolveImageUrl } from "@/lib/utils";

const RUST = "#7a2f1a";
const GOLD = "#8a6a2a";

const STATUS_TABS = ["all", "approved", "pending", "rejected"];

const STATUS_TONES: Record<string, { bg: string; text: string }> = {
  approved: { bg: "rgba(83,94,44,0.14)", text: colors.olive[800] },
  pending: { bg: "rgba(200,164,74,0.20)", text: GOLD },
  rejected: { bg: "rgba(184,92,58,0.14)", text: RUST },
};

function StatusPill({ status }: { status: string }) {
  const tone = STATUS_TONES[status] ?? { bg: colors.light.muted, text: colors.light.mutedForeground };
  return (
    <View style={[styles.statusPill, { backgroundColor: tone.bg }]}>
      <Text style={[styles.statusPillText, { color: tone.text }]}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Text>
    </View>
  );
}

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
      if (r.ok) return { brands: r.data.brands, error: null as string | null };
      return { brands: [] as any[], error: r.error ?? "Failed to load brands" };
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-brands"] });
  const approveM = useMutation({
    mutationFn: (id: string) => approveBrand(id, "approved"),
    onSuccess: invalidate,
  });
  const rejectM = useMutation({
    mutationFn: (id: string) => approveBrand(id, "rejected"),
    onSuccess: invalidate,
  });

  const brands = q.data?.brands ?? [];
  const loadError = q.data?.error ?? null;
  const busy = approveM.isPending || rejectM.isPending;

  const onApprove = (item: any) =>
    Alert.alert("Approve brand", item.name, [
      { text: "Cancel", style: "cancel" },
      { text: "Approve", onPress: () => approveM.mutate(item.id) },
    ]);
  const onReject = (item: any) =>
    Alert.alert("Reject brand", item.name, [
      { text: "Cancel", style: "cancel" },
      { text: "Reject", style: "destructive", onPress: () => rejectM.mutate(item.id) },
    ]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>BRANDS</Text>
          <Text style={styles.title}>Directory</Text>
        </View>
        <Text style={styles.count}>{q.data?.brands?.length ?? 0}</Text>
      </View>

      <TextInput
        style={styles.search}
        placeholder="Search brands…"
        placeholderTextColor={colors.light.mutedForeground}
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
        <View style={styles.list}>
          <Skeleton height={76} style={{ borderRadius: radii.xl }} />
          <Skeleton height={76} style={{ borderRadius: radii.xl }} />
          <Skeleton height={76} style={{ borderRadius: radii.xl }} />
        </View>
      ) : loadError ? (
        <EmptyState icon="cloud-offline-outline" title="Couldn't load brands" description={loadError} />
      ) : brands.length === 0 ? (
        <EmptyState
          icon="pricetag-outline"
          title="No brands found"
          description="No brands match your search or filter."
        />
      ) : (
        <FlatList
          data={brands}
          keyExtractor={(b: any) => b.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={colors.light.primary} />
          }
          renderItem={({ item }: any) => {
            const logo = item.logo_url ? resolveImageUrl(item.logo_url) || item.logo_url : null;
            const pending = item.status === "pending";
            return (
              <View style={[styles.card, pending && styles.cardPending]}>
                {pending ? <View style={styles.pendingAccent} /> : null}
                <Pressable
                  onPress={() => router.push({ pathname: "/(admin)/brands/[id]", params: { id: item.id } } as any)}
                  style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                >
                  {logo ? (
                    <Image source={{ uri: logo }} style={styles.thumb} contentFit="cover" />
                  ) : (
                    <View style={[styles.thumb, styles.thumbPlaceholder]}>
                      <Ionicons name="pricetag-outline" size={18} color={GOLD} />
                    </View>
                  )}
                  <View style={styles.body}>
                    <View style={styles.nameRow}>
                      <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                      {item.is_verified ? (
                        <Ionicons name="checkmark-circle" size={13} color={colors.olive[800]} />
                      ) : null}
                      {item.is_featured ? (
                        <Ionicons name="star" size={12} color={GOLD} />
                      ) : null}
                    </View>
                    <Text style={styles.meta} numberOfLines={1}>
                      @{item.slug} · joined {rel(item.created_at)} ago
                    </Text>
                    <View style={styles.statsRow}>
                      <Ionicons name="people-outline" size={11} color={colors.light.mutedForeground} />
                      <Text style={styles.statText}>{item.total_followers ?? 0}</Text>
                      {typeof item.total_products === "number" ? (
                        <>
                          <Ionicons name="cube-outline" size={11} color={colors.light.mutedForeground} />
                          <Text style={styles.statText}>{item.total_products}</Text>
                        </>
                      ) : null}
                    </View>
                  </View>
                  <StatusPill status={item.status} />
                  <View style={styles.chevronCircle}>
                    <Ionicons name="chevron-forward" size={13} color={colors.olive[800]} />
                  </View>
                </Pressable>
                {pending ? (
                  <View style={styles.actions}>
                    <Pressable
                      onPress={() => onApprove(item)}
                      disabled={busy}
                      style={[styles.btn, styles.btnApprove, busy && styles.btnDisabled]}
                    >
                      <Ionicons name="checkmark" size={13} color="#fff" />
                      <Text style={styles.btnApproveText}>Approve brand</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => onReject(item)}
                      disabled={busy}
                      style={[styles.btn, styles.btnReject, busy && styles.btnDisabled]}
                    >
                      <Ionicons name="close" size={13} color={colors.light.destructive} />
                      <Text style={styles.btnRejectText}>Reject</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            );
          }}
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
  card: {
    backgroundColor: colors.light.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
    overflow: "hidden",
    ...shadows.soft,
  },
  cardPending: { borderColor: "rgba(200,164,74,0.55)" },
  pendingAccent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: "#c8a44a",
  },
  pressed: { opacity: 0.7 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, paddingLeft: 18 },
  thumb: { width: 46, height: 46, borderRadius: 11, backgroundColor: colors.olive[100] },
  thumbPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fdf3d7",
    borderWidth: 1,
    borderColor: "#eedeac",
  },
  body: { flex: 1, gap: 2 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  name: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: colors.light.foreground, flexShrink: 1 },
  meta: { fontFamily: fontFamilies.sans.regular, fontSize: 11, color: colors.light.mutedForeground },
  statsRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 1 },
  statText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    color: colors.light.mutedForeground,
    marginRight: 6,
  },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.full },
  statusPillText: { fontFamily: fontFamilies.mono.semibold, fontSize: 9, letterSpacing: 0.5, textTransform: "uppercase" },
  chevronCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#f8f6f0",
    borderWidth: 1,
    borderColor: "#e4dfd3",
    alignItems: "center",
    justifyContent: "center",
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 10,
    marginTop: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.light.border,
  },
  btn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 9,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  btnDisabled: { opacity: 0.5 },
  btnApprove: { backgroundColor: colors.olive[900], borderColor: colors.olive[900] },
  btnApproveText: { fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: "#fff" },
  btnReject: { backgroundColor: "rgba(184,92,58,0.08)", borderColor: "rgba(184,92,58,0.35)" },
  btnRejectText: { fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: colors.light.destructive },
});
