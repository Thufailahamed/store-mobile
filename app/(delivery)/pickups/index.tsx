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
import { useTheme } from "@/lib/hooks/useTheme";
import { typography, radii } from "@/lib/theme/tokens";
import { formatRelative, PICKUP_STATUS_COLORS } from "@/lib/utils/delivery-format";

const STATUS_COLORS = PICKUP_STATUS_COLORS;

export default function ReturnPickupsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const [pickups, setPickups] = useState<ReturnPickup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const styles = makeStyles(colors);

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
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPickups(); }} tintColor={colors.primary} />
        }
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📦</Text>
              <Text style={styles.emptyTitle}>No return pickups</Text>
              <Text style={styles.emptySub}>Assigned pickups will appear here</Text>
            </View>
          )
        }
      />
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useTheme>["colors"]) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingTop: 56, paddingHorizontal: 24, paddingBottom: 12 },
    title: { fontSize: typography.fontSizes["2xl"], fontWeight: typography.fontWeights.bold as any, color: colors.foreground },
    count: { fontSize: typography.fontSizes.sm, color: colors.mutedForeground, marginTop: 4 },
    list: { paddingHorizontal: 24, paddingBottom: 32 },
    card: {
      backgroundColor: colors.card,
      borderRadius: radii.xl,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      marginBottom: 12,
    },
    cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    cardTitle: { fontSize: typography.fontSizes.base, fontWeight: typography.fontWeights.semibold as any, color: colors.foreground },
    badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.full },
    badgeText: { fontSize: typography.fontSizes.xs, fontWeight: typography.fontWeights.semibold as any, textTransform: "capitalize" },
    meta: { fontSize: typography.fontSizes.xs, color: colors.mutedForeground, marginTop: 6 },
    address: { fontSize: typography.fontSizes.sm, marginTop: 8, color: colors.foreground },
    scheduled: { fontSize: typography.fontSizes.xs, color: colors.mutedForeground, marginTop: 6 },
    empty: { alignItems: "center", paddingTop: 60, gap: 8 },
    emptyIcon: { fontSize: 40 },
    emptyTitle: { fontSize: typography.fontSizes.lg, fontWeight: typography.fontWeights.semibold as any, color: colors.foreground },
    emptySub: { fontSize: typography.fontSizes.sm, color: colors.mutedForeground },
  });
