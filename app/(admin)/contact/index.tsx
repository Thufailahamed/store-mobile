import React, { useState } from "react";
import { View, Text, FlatList, Pressable, RefreshControl, StyleSheet, Linking, Alert } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { getAdminContactSubmissions } from "@/lib/api";
import { Card, EmptyState, Badge, Skeleton } from "@/components/ui";
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

export default function AdminContact() {
  const [filter, setFilter] = useState("all");
  const q = useQuery({
    queryKey: ["admin-contact"],
    queryFn: async () => {
      const r = await getAdminContactSubmissions();
      return r.ok ? r.data : [];
    },
  });
  const items = (q.data ?? []).filter((s: any) => filter === "all" || s.status === filter);
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>INBOX</Text>
          <Text style={styles.title}>Contact</Text>
        </View>
        <Text style={styles.count}>{items.length}</Text>
      </View>

      <FlatList
        horizontal
        data={["all", "new", "in_progress", "resolved"]}
        keyExtractor={(s) => s}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
        renderItem={({ item: t }) => (
          <Pressable onPress={() => setFilter(t)} style={[styles.chip, filter === t && styles.chipActive]}>
            <Text style={[styles.chipText, filter === t && styles.chipTextActive]}>{t.replace("_", " ")}</Text>
          </Pressable>
        )}
      />

      <FlatList
        data={items}
        keyExtractor={(s: any) => s.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} />}
        ListEmptyComponent={q.isLoading ? <Skeleton height={80} /> : <EmptyState icon="mail-outline" title="No submissions" />}
        renderItem={({ item, index }: any) => (
          <Pressable onPress={() => Alert.alert("Reply", `Open email to ${item.email}?`, [{ text: "Cancel" }, { text: "Open", onPress: () => Linking.openURL(`mailto:${item.email}?subject=Re: ${item.subject}`) }])}>
            <Card style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.index}>{String(index + 1).padStart(2, "0")}</Text>
                <View style={{ flex: 1 }}>
                  <View style={styles.titleRow}>
                    <Text style={styles.subject} numberOfLines={1}>{item.subject}</Text>
                    <Badge variant={item.status === "new" ? "secondary" : item.status === "resolved" ? "default" : "outline"}>{item.status}</Badge>
                  </View>
                  <Text style={styles.name}>{item.name} · {item.email}</Text>
                  <Text style={styles.body} numberOfLines={2}>{item.message}</Text>
                  <Text style={styles.meta}>{rel(item.created_at)} ago</Text>
                </View>
              </View>
            </Card>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  header: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", padding: 20, paddingBottom: 8 },
  eyebrow: { fontFamily: fontFamilies.mono.medium, fontSize: 10, color: colors.light.primary, letterSpacing: 1.4 },
  title: { fontFamily: fontFamilies.display.regular, fontSize: 28, color: colors.light.foreground, marginTop: 4, letterSpacing: -0.5 },
  count: { fontFamily: fontFamilies.mono.regular, fontSize: 12, color: colors.light.mutedForeground },
  filters: { paddingHorizontal: 20, gap: 8, paddingBottom: 12 },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.light.card, borderWidth: 1, borderColor: colors.light.border },
  chipActive: { backgroundColor: colors.light.primary, borderColor: colors.light.primary },
  chipText: { fontFamily: fontFamilies.mono.medium, fontSize: 10, color: colors.light.mutedForeground, letterSpacing: 0.5, textTransform: "uppercase" },
  chipTextActive: { color: "#fff" },
  list: { padding: 20, paddingTop: 0, paddingBottom: 100, gap: 10 },
  card: { padding: 14, ...shadows.soft },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  index: { fontFamily: fontFamilies.mono.regular, fontSize: 11, color: colors.light.mutedForeground, width: 24, marginTop: 2 },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  subject: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: colors.light.foreground, flex: 1 },
  name: { fontFamily: fontFamilies.sans.regular, fontSize: 11, color: colors.light.mutedForeground, marginTop: 4 },
  body: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.light.foreground, marginTop: 6, lineHeight: 18 },
  meta: { fontFamily: fontFamilies.mono.regular, fontSize: 10, color: colors.light.mutedForeground, marginTop: 6, letterSpacing: 0.5, textTransform: "uppercase" },
});
