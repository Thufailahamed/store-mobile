import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/supabase/auth";
import { getReturnPickups, type ReturnPickup } from "@/lib/api";
import { useRiderRealtime } from "@/lib/hooks/useRiderRealtime";
import { colors, typography, radii } from "@/lib/theme/tokens";

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  scheduled: { bg: "#fef3c7", text: "#92400e" },
  out_for_pickup: { bg: "#dbeafe", text: "#1e40af" },
  picked_up: { bg: "#e0e7ff", text: "#3730a3" },
  completed: { bg: "#dcfce7", text: "#166534" },
  failed: { bg: "#fee2e2", text: "#b91c1c" },
  cancelled: { bg: "#f3f4f6", text: "#6b7280" },
};

function formatRelative(dateStr: string) {
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function ReturnPickupsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [pickups, setPickups] = useState<ReturnPickup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPickups = useCallback(async () => {
    const res = await getReturnPickups();
    if (res.ok) setPickups(res.data.pickups);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchPickups();
  }, [fetchPickups]);

  useRiderRealtime(user?.id, fetchPickups);

  const active = pickups.filter((p) => !["completed", "cancelled", "failed"].includes(p.status));

  const renderItem = ({ item }: { item: ReturnPickup }) => {
    const sc = STATUS_COLORS[item.status] ?? STATUS_COLORS.scheduled;
    const addr = item.pickup_address;
    const addressLine = addr
      ? [addr.line1, addr.city].filter(Boolean).join(", ")
      : "Address on file";

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/(delivery)/pickups/${item.id}` as any)}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Return pickup</Text>
          <View style={[styles.badge, { backgroundColor: sc.bg }]}>
            <Text style={[styles.badgeText, { color: sc.text }]}>{item.status.replace(/_/g, " ")}</Text>
          </View>
        </View>
        <Text style={styles.meta}>{formatRelative(item.created_at)}</Text>
        <Text style={styles.address} numberOfLines={2}>{addressLine}</Text>
        {item.scheduled_at ? (
          <Text style={styles.scheduled}>Scheduled · {new Date(item.scheduled_at).toLocaleString("en-LK")}</Text>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Return pickups</Text>
        <Text style={styles.count}>{active.length} active · {pickups.length} total</Text>
      </View>

      <FlatList
        data={pickups}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPickups(); }} />
        }
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📦</Text>
              <Text style={styles.emptyTitle}>No return pickups</Text>
              <Text style={styles.emptySub}>Assigned pickups will appear here</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  header: { paddingTop: 56, paddingHorizontal: 24, paddingBottom: 12 },
  title: { fontSize: typography.fontSizes["2xl"], fontWeight: typography.fontWeights.bold as any },
  count: { fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground, marginTop: 4 },
  list: { paddingHorizontal: 24, paddingBottom: 32 },
  card: {
    backgroundColor: colors.light.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontSize: typography.fontSizes.base, fontWeight: typography.fontWeights.semibold as any },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.full },
  badgeText: { fontSize: typography.fontSizes.xs, fontWeight: typography.fontWeights.semibold as any, textTransform: "capitalize" },
  meta: { fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground, marginTop: 6 },
  address: { fontSize: typography.fontSizes.sm, marginTop: 8, color: colors.light.foreground },
  scheduled: { fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground, marginTop: 6 },
  empty: { alignItems: "center", paddingTop: 60, gap: 8 },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { fontSize: typography.fontSizes.lg, fontWeight: typography.fontWeights.semibold as any },
  emptySub: { fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground },
});
