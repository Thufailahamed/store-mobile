import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Share,
  Alert,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import {
  getDeliveryCompanyAudit,
  getDeliveryCompanyRoutes,
  hasStoreApi,
  iterateDeliveryCompanyHistory,
  type DcAuditEntry,
  type DcHistoryExportRow,
  type DcRoute,
} from "@/lib/api/delivery-company-api";
import { colors, typography, radii } from "@/lib/theme/tokens";

export default function CompanyHistoryScreen() {
  const [routes, setRoutes] = useState<DcRoute[]>([]);
  const [audit, setAudit] = useState<DcAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    if (!hasStoreApi()) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    const [routesRes, auditRes] = await Promise.all([getDeliveryCompanyRoutes(), getDeliveryCompanyAudit()]);
    if (routesRes.ok) setRoutes(routesRes.data.routes);
    if (auditRes.ok) setAudit(auditRes.data.entries);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const stops = routes.flatMap((r) => r.stops ?? []);
    return {
      total: routes.length,
      completed: routes.filter((r) => r.status === "completed").length,
      delivered: stops.filter((s) => s.status === "delivered").length,
      failed: stops.filter((s) => s.status === "failed").length,
    };
  }, [routes]);

  const completedRoutes = useMemo(
    () => routes.filter((r) => r.status === "completed" || r.status === "cancelled").slice(0, 10),
    [routes],
  );

  const exportCsv = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const headers = [
        "route_id", "driver", "warehouse", "status",
        "sequence", "completed_at", "address", "cod_collected",
      ];
      const allRows: DcHistoryExportRow[] = [];
      let pages = 0;
      for await (const page of iterateDeliveryCompanyHistory({ pageSize: 200 })) {
        allRows.push(...page.rows);
        pages += 1;
        if (page.done) break;
        if (pages >= 25) break; // 25 × 200 = 5000 hard cap
      }
      if (allRows.length === 0) {
        Alert.alert("No history", "Nothing to export yet.");
        return;
      }
      const csv = [
        headers.join(","),
        ...allRows.map((row) =>
          headers.map((h) => JSON.stringify((row as Record<string, unknown>)[h] ?? "")).join(","),
        ),
      ].join("\n");
      try {
        await Share.share({
          message: csv,
          title: `delivery-history-${new Date().toISOString().slice(0, 10)}.csv`,
        });
      } catch {
        /* user dismissed */
      }
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.light.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="History"
        right={
          <TouchableOpacity onPress={exportCsv} style={styles.exportBtn} disabled={exporting}>
            {exporting ? (
              <ActivityIndicator size="small" color={colors.light.primary} />
            ) : (
              <Ionicons name="share-outline" size={22} color={colors.light.primary} />
            )}
          </TouchableOpacity>
        }
      />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <View style={styles.kpiRow}>
          <Kpi label="Routes" value={stats.total} />
          <Kpi label="Delivered" value={stats.delivered} />
          <Kpi label="Failed" value={stats.failed} />
          <Kpi label="Completed" value={stats.completed} />
        </View>

        <Text style={styles.section}>Recent routes</Text>
        {completedRoutes.length === 0 ? (
          <Text style={styles.empty}>No completed routes yet.</Text>
        ) : (
          completedRoutes.map((r) => (
            <View key={r.id} style={styles.card}>
              <Text style={styles.cardTitle}>{r.driver?.full_name ?? "Driver"}</Text>
              <Text style={styles.cardMeta}>
                {r.total_stops ?? r.stops?.length ?? 0} stops · {r.status}
              </Text>
            </View>
          ))
        )}

        <Text style={styles.section}>Audit log</Text>
        {audit.length === 0 ? (
          <Text style={styles.empty}>No audit entries yet.</Text>
        ) : (
          audit.slice(0, 30).map((e) => (
            <View key={e.id} style={styles.auditRow}>
              <Text style={styles.auditAction}>{e.action.replace(/\./g, " · ")}</Text>
              <Text style={styles.auditMeta}>
                {e.actor?.full_name ?? "System"} · {new Date(e.created_at).toLocaleString()}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.kpi}>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  exportBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  content: { padding: 16, paddingBottom: 40 },
  kpiRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  kpi: {
    width: "47%",
    backgroundColor: colors.light.card,
    borderRadius: radii.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  kpiValue: { fontSize: typography.fontSizes.xl, fontWeight: typography.fontWeights.bold },
  kpiLabel: { fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground, marginTop: 4 },
  section: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold,
    color: colors.light.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: typography.letterSpacing.wider,
    marginBottom: 10,
    marginTop: 8,
  },
  card: {
    backgroundColor: colors.light.card,
    borderRadius: radii.lg,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  cardTitle: { fontWeight: typography.fontWeights.semibold },
  cardMeta: { fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground, marginTop: 2 },
  auditRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  auditAction: { fontSize: typography.fontSizes.sm, fontWeight: typography.fontWeights.medium },
  auditMeta: { fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground, marginTop: 2 },
  empty: { fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground, marginBottom: 16 },
});
