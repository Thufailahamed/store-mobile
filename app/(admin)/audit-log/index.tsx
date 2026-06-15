import React, { useState } from "react";
import { View, Text, FlatList, RefreshControl, StyleSheet, TextInput } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { getAdminAuditLog } from "@/lib/api";
import { Card, ListRow, EmptyState, Skeleton } from "@/components/ui";
import { colors, typography, radii, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

function rel(s: string) {
  const d = new Date(s).getTime();
  const m = Math.floor((Date.now() - d) / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function color(action: string) {
  if (action.includes("delete") || action.includes("reject")) return colors.light.destructive;
  if (action.includes("create") || action.includes("approve") || action.includes("login")) return colors.olive[500];
  if (action.includes("update") || action.includes("edit")) return "#c8a44a";
  return colors.light.muted;
}

function humanize(s: string) {
  return s.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AuditLogScreen() {
  const [search, setSearch] = useState("");
  const q = useQuery({
    queryKey: ["admin-audit-log"],
    queryFn: async () => {
      const r = await getAdminAuditLog(200);
      return r.ok ? r.data : [];
    },
    refetchInterval: 30_000,
  });

  const entries = (q.data ?? []).filter((e: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (e.action ?? "").toLowerCase().includes(s) || (e.actor_name ?? "").toLowerCase().includes(s);
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>ACTIVITY</Text>
          <Text style={styles.title}>Audit Log</Text>
        </View>
        <Text style={styles.count}>{entries.length}</Text>
      </View>

      <TextInput
        style={styles.search}
        placeholder="Search actor or action…"
        placeholderTextColor={colors.light.muted}
        value={search}
        onChangeText={setSearch}
      />

      <FlatList
        data={entries}
        keyExtractor={(e: any) => e.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} />}
        ListEmptyComponent={q.isLoading ? <Skeleton height={80} /> : <EmptyState icon="time-outline" title="No activity" />}
        renderItem={({ item, index }: any) => (
          <ListRow
            index={index + 1}
            leftIcon={<View style={[styles.dot, { backgroundColor: color(item.action) }]} />}
            title={item.actor_name ?? "Admin"}
            subtitle={humanize(item.action)}
            meta={rel(item.created_at)}
            showDivider={index < entries.length - 1}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  header: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", padding: 20, paddingBottom: 12 },
  eyebrow: { fontFamily: fontFamilies.mono.medium, fontSize: 10, color: colors.light.primary, letterSpacing: 1.4 },
  title: { fontFamily: fontFamilies.display.regular, fontSize: 28, color: colors.light.foreground, marginTop: 4, letterSpacing: -0.5 },
  count: { fontFamily: fontFamilies.mono.regular, fontSize: 12, color: colors.light.mutedForeground },
  search: { marginHorizontal: 20, marginBottom: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.light.card, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.light.border, fontSize: 14, color: colors.light.foreground },
  list: { paddingBottom: 100 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 4 },
});
