import React, { useState } from "react";
import { View, Text, FlatList, Pressable, RefreshControl, StyleSheet, TextInput, Alert } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAdminReviews, moderateReview, getAdminQA } from "@/lib/api";
import { Card, EmptyState, Skeleton, Badge } from "@/components/ui";
import { colors, typography, radii, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

const TABS = [
  { key: "reviews", label: "Reviews" },
  { key: "qa", label: "Q&A" },
];

function rel(s: string) {
  const d = new Date(s).getTime();
  const m = Math.floor((Date.now() - d) / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function AdminContent() {
  const [tab, setTab] = useState<"reviews" | "qa">("reviews");
  const [status, setStatus] = useState("pending");

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>MODERATION</Text>
        <Text style={styles.title}>Content</Text>
      </View>

      <View style={styles.tabs}>
        {TABS.map((t) => (
          <Pressable key={t.key} onPress={() => setTab(t.key as any)} style={[styles.tab, tab === t.key && styles.tabActive]}>
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.subFilters}>
        {["pending", "approved", "rejected", "all"].map((s) => (
          <Pressable key={s} onPress={() => setStatus(s)} style={[styles.chip, status === s && styles.chipActive]}>
            <Text style={[styles.chipText, status === s && styles.chipTextActive]}>{s}</Text>
          </Pressable>
        ))}
      </View>

      {tab === "reviews" ? <ReviewsList status={status} /> : <QAList status={status} />}
    </View>
  );
}

function ReviewsList({ status }: { status: string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-reviews", status], queryFn: async () => { const r = await getAdminReviews(status); return r.ok ? r.data : []; } });
  const moderate = useMutation({ mutationFn: ({ id, action }: { id: string; action: "approved" | "rejected" }) => moderateReview(id, action), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-reviews"] }) });
  return (
    <FlatList
      data={q.data ?? []}
      keyExtractor={(r: any) => r.id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} />}
      ListEmptyComponent={q.isLoading ? <Skeleton height={80} /> : <EmptyState icon="star-outline" title="No reviews" />}
      renderItem={({ item, index }: any) => (
        <Card style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.index}>{String(index + 1).padStart(2, "0")}</Text>
            <View style={{ flex: 1 }}>
              <View style={styles.titleRow}>
                <Text style={styles.title2} numberOfLines={1}>{item.product?.name ?? "Product"}</Text>
                <Text style={styles.stars}>{"★".repeat(item.rating ?? 0)}</Text>
              </View>
              <Text style={styles.body} numberOfLines={3}>{item.body}</Text>
              <Text style={styles.meta}>{item.user_name ?? "User"} · {rel(item.created_at)} ago</Text>
            </View>
          </View>
          {item.status === "pending" && (
            <View style={styles.actions}>
              <Pressable onPress={() => moderate.mutate({ id: item.id, action: "approved" })} style={[styles.btn, styles.btnPrimary]}>
                <Text style={styles.btnPrimaryText}>Approve</Text>
              </Pressable>
              <Pressable onPress={() => moderate.mutate({ id: item.id, action: "rejected" })} style={styles.btn}>
                <Text style={styles.btnText}>Reject</Text>
              </Pressable>
            </View>
          )}
        </Card>
      )}
    />
  );
}

function QAList({ status }: { status: string }) {
  const q = useQuery({ queryKey: ["admin-qa", status], queryFn: async () => { const r = await getAdminQA(status); return r.ok ? r.data : []; } });
  return (
    <FlatList
      data={q.data ?? []}
      keyExtractor={(q: any) => q.id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} />}
      ListEmptyComponent={q.isLoading ? <Skeleton height={80} /> : <EmptyState icon="help-circle-outline" title="No questions" />}
      renderItem={({ item, index }: any) => (
        <Card style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.index}>{String(index + 1).padStart(2, "0")}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.title2} numberOfLines={1}>{item.product?.name ?? "Product"}</Text>
              <Text style={styles.body}>{item.question}</Text>
              {item.answer ? <Text style={styles.answer}>↳ {item.answer}</Text> : null}
              <Text style={styles.meta}>{item.user_name ?? "User"} · {rel(item.created_at)} ago</Text>
            </View>
            <Badge variant={item.status === "answered" ? "default" : item.status === "pending" ? "secondary" : "destructive"}>{item.status}</Badge>
          </View>
        </Card>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  header: { padding: 20, paddingBottom: 12 },
  eyebrow: { fontFamily: fontFamilies.mono.medium, fontSize: 10, color: colors.light.primary, letterSpacing: 1.4 },
  title: { fontFamily: fontFamilies.display.regular, fontSize: 28, color: colors.light.foreground, marginTop: 4, letterSpacing: -0.5 },
  tabs: { flexDirection: "row", paddingHorizontal: 20, gap: 8, marginBottom: 12 },
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.light.card, borderWidth: 1, borderColor: colors.light.border },
  tabActive: { backgroundColor: colors.light.primary, borderColor: colors.light.primary },
  tabText: { fontFamily: fontFamilies.mono.semibold, fontSize: 11, color: colors.light.mutedForeground, letterSpacing: 0.5, textTransform: "uppercase" },
  tabTextActive: { color: "#fff" },
  subFilters: { flexDirection: "row", paddingHorizontal: 20, gap: 6, marginBottom: 12, flexWrap: "wrap" },
  chip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, backgroundColor: colors.light.card, borderWidth: 1, borderColor: colors.light.border },
  chipActive: { backgroundColor: colors.light.primary, borderColor: colors.light.primary },
  chipText: { fontFamily: fontFamilies.mono.medium, fontSize: 10, color: colors.light.mutedForeground, letterSpacing: 0.5, textTransform: "uppercase" },
  chipTextActive: { color: "#fff" },
  list: { padding: 20, paddingTop: 0, paddingBottom: 100, gap: 10 },
  card: { padding: 14, ...shadows.soft },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  index: { fontFamily: fontFamilies.mono.regular, fontSize: 11, color: colors.light.mutedForeground, width: 24, marginTop: 2 },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  title2: { fontFamily: fontFamilies.sans.semibold, fontSize: 13, color: colors.light.foreground, flex: 1 },
  stars: { fontFamily: fontFamilies.mono.regular, fontSize: 11, color: "#c8a44a" },
  body: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.light.foreground, marginTop: 4, lineHeight: 18 },
  answer: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.olive[600], marginTop: 4, fontStyle: "italic" },
  meta: { fontFamily: fontFamilies.mono.regular, fontSize: 10, color: colors.light.mutedForeground, marginTop: 6, letterSpacing: 0.5, textTransform: "uppercase" },
  actions: { flexDirection: "row", gap: 8, marginTop: 12 },
  btn: { flex: 1, paddingVertical: 8, borderRadius: radii.md, borderWidth: 1, borderColor: colors.light.border, alignItems: "center" },
  btnPrimary: { backgroundColor: colors.light.primary, borderColor: colors.light.primary },
  btnText: { fontFamily: fontFamilies.sans.semibold, fontSize: 11, color: colors.light.foreground, letterSpacing: 0.5, textTransform: "uppercase" },
  btnPrimaryText: { fontFamily: fontFamilies.sans.semibold, fontSize: 11, color: "#fff", letterSpacing: 0.5, textTransform: "uppercase" },
});
