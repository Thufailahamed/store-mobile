import React from "react";
import { View, Text, FlatList, RefreshControl, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { getAdminDeliveryCompanies } from "@/lib/api";
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

export default function AdminDelivery() {
  const q = useQuery({
    queryKey: ["admin-delivery-companies"],
    queryFn: async () => {
      const r = await getAdminDeliveryCompanies();
      return r.ok ? r.data : [];
    },
  });
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>LOGISTICS</Text>
          <Text style={styles.title}>Delivery</Text>
        </View>
        <Text style={styles.count}>{(q.data ?? []).length}</Text>
      </View>
      <FlatList
        data={q.data ?? []}
        keyExtractor={(c: any) => c.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} />}
        ListEmptyComponent={q.isLoading ? <Skeleton height={80} /> : <EmptyState icon="car-outline" title="No companies" />}
        renderItem={({ item, index }: any) => (
          <Card style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.index}>{String(index + 1).padStart(2, "0")}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.meta}>
                  {item.coverage_areas?.join(" · ") ?? "—"} · {item.total_deliveries ?? 0} deliveries
                </Text>
                <Text style={styles.meta2}>{item.contact_email ?? item.contact_phone ?? ""} · joined {rel(item.created_at)} ago</Text>
              </View>
              <Badge variant={item.status === "approved" ? "default" : item.status === "pending" ? "secondary" : "destructive"}>
                {item.status}
              </Badge>
            </View>
          </Card>
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
  list: { padding: 20, paddingBottom: 100, gap: 10 },
  card: { padding: 14, ...shadows.soft },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  index: { fontFamily: fontFamilies.mono.regular, fontSize: 11, color: colors.light.mutedForeground, width: 24, marginTop: 2 },
  name: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: colors.light.foreground },
  meta: { fontFamily: fontFamilies.sans.regular, fontSize: 11, color: colors.light.mutedForeground, marginTop: 2 },
  meta2: { fontFamily: fontFamilies.mono.regular, fontSize: 10, color: colors.light.mutedForeground, marginTop: 4, letterSpacing: 0.5, textTransform: "uppercase" },
});
