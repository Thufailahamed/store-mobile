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
import { getRiderPickupRuns } from "@/lib/api";
import { useRiderRealtime } from "@/lib/hooks/useRiderRealtime";
import { colors, typography, radii } from "@/lib/theme/tokens";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { formatWarehouseAddress } from "@/lib/utils/warehouse-address";
import type { Order } from "@/lib/types";

export default function StorePickupsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [runs, setRuns] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    const res = await getRiderPickupRuns(user.id);
    if (res.ok) setRuns(res.data);
    setLoading(false);
    setRefreshing(false);
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  useRiderRealtime(user?.id, load);

  return (
    <View style={styles.container}>
      <ScreenHeader title="Store pickups" showBack />
      <FlatList
        data={runs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No store pickups</Text>
              <Text style={styles.emptySub}>Assigned pickup runs will appear here.</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const hub = (item as { pickup_warehouse?: { name?: string; address?: unknown } }).pickup_warehouse;
          const hubAddr = formatWarehouseAddress(hub?.address as string | Record<string, unknown> | null);
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/(delivery)/orders/${item.id}` as any)}
            >
              <Text style={styles.orderNum}>{item.order_number}</Text>
              <Text style={styles.meta}>
                {(item as { pickup_decision?: string }).pickup_decision?.replace(/_/g, " ") ?? "pending decision"}
              </Text>
              {hub?.name ? (
                <Text style={styles.hub}>Hub: {hub.name}{hubAddr ? ` · ${hubAddr}` : ""}</Text>
              ) : null}
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  list: { padding: 16, paddingBottom: 32 },
  card: {
    backgroundColor: colors.light.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: 14,
    marginBottom: 10,
  },
  orderNum: {
    fontSize: typography.fontSizes.base,
    fontWeight: typography.fontWeights.semibold as any,
    color: colors.light.foreground,
    fontFamily: "monospace",
  },
  meta: { fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground, marginTop: 4 },
  hub: { fontSize: typography.fontSizes.sm, color: colors.light.foreground, marginTop: 6 },
  empty: { alignItems: "center", paddingTop: 48, gap: 8 },
  emptyTitle: { fontSize: typography.fontSizes.lg, fontWeight: typography.fontWeights.semibold as any },
  emptySub: { fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground, textAlign: "center" },
});
