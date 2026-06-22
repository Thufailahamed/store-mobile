import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import {
  getDeliveryCompanyReturns,
  hasStoreApi,
  type DcReturnPickup,
} from "@/lib/api/delivery-company-api";
import { colors, typography, radii } from "@/lib/theme/tokens";

const TABS = ["all", "scheduled", "out_for_pickup", "picked_up", "completed", "failed", "cancelled"] as const;

export default function CompanyReturnsScreen() {
  const [pickups, setPickups] = useState<DcReturnPickup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<(typeof TABS)[number]>("all");

  const load = useCallback(async () => {
    if (!hasStoreApi()) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    const res = await getDeliveryCompanyReturns(tab !== "all" ? { status: tab } : undefined);
    if (res.ok) setPickups(res.data.pickups);
    setLoading(false);
    setRefreshing(false);
  }, [tab]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return pickups;
    return pickups.filter((p) => {
      const hay = `${p.order?.order_number ?? ""} ${p.pickup_address?.full_name ?? ""} ${p.pickup_address?.city ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [pickups, search]);

  return (
    <View style={styles.container}>
      <ScreenHeader title="Returns" />
      <Text style={styles.sub}>Return pickups assigned to your company's drivers.</Text>
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={18} color={colors.light.mutedForeground} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search order, customer, city…"
          value={search}
          onChangeText={setSearch}
          placeholderTextColor={colors.light.mutedForeground}
        />
      </View>
      <View style={styles.filters}>
        {TABS.map((t) => (
          <TouchableOpacity key={t} style={[styles.chip, tab === t && styles.chipActive]} onPress={() => setTab(t)}>
            <Text style={[styles.chipText, tab === t && styles.chipTextActive]}>
              {t === "all" ? "All" : t.replace(/_/g, " ")}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.light.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="return-down-back-outline" size={40} color={colors.light.mutedForeground} />
              <Text style={styles.emptyTitle}>No return pickups</Text>
              <Text style={styles.emptySub}>Returns appear when sellers schedule pickups with your drivers.</Text>
            </View>
          }
          renderItem={({ item }) => <ReturnCard pickup={item} />}
        />
      )}
    </View>
  );
}

function ReturnCard({ pickup }: { pickup: DcReturnPickup }) {
  const addr = pickup.pickup_address;
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.orderNum}>#{pickup.order?.order_number ?? "—"}</Text>
        <View style={styles.statusPill}>
          <Text style={styles.statusText}>{pickup.status.replace(/_/g, " ")}</Text>
        </View>
      </View>
      {addr?.full_name ? <Text style={styles.line}>{addr.full_name}</Text> : null}
      <Text style={styles.meta}>
        {[addr?.city, addr?.postal_code].filter(Boolean).join(" ")}
      </Text>
      <Text style={styles.meta}>Driver: {pickup.delivery_person?.full_name ?? "Unassigned"}</Text>
      {pickup.scheduled_at ? (
        <Text style={styles.date}>Scheduled {new Date(pickup.scheduled_at).toLocaleString()}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  sub: { fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground, paddingHorizontal: 16, marginBottom: 8 },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.light.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.light.border,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: typography.fontSizes.base },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingHorizontal: 16, marginBottom: 8 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.full, backgroundColor: colors.light.muted },
  chipActive: { backgroundColor: colors.light.primary },
  chipText: { fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground, textTransform: "capitalize" },
  chipTextActive: { color: "#fff", fontWeight: typography.fontWeights.semibold },
  card: {
    backgroundColor: colors.light.card,
    borderRadius: radii.lg,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  orderNum: { fontWeight: typography.fontWeights.semibold },
  statusPill: { backgroundColor: colors.light.muted, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.full },
  statusText: { fontSize: typography.fontSizes.xs, textTransform: "capitalize" },
  line: { fontSize: typography.fontSizes.sm },
  meta: { fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground, marginTop: 2 },
  date: { fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground, marginTop: 6 },
  empty: { alignItems: "center", paddingTop: 48, gap: 8 },
  emptyTitle: { fontWeight: typography.fontWeights.semibold },
  emptySub: { fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground, textAlign: "center", paddingHorizontal: 24 },
});
