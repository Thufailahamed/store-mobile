import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import {
  cancelRoute,
  dispatchRoute,
  getDeliveryCompanyRoutes,
  hasStoreApi,
  type DcRoute,
  type DcRouteStop,
} from "@/lib/api/delivery-company-api";
import { colors, typography, radii } from "@/lib/theme/tokens";

export default function CompanyRouteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [route, setRoute] = useState<DcRoute | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id || !hasStoreApi()) return;
    const res = await getDeliveryCompanyRoutes();
    if (res.ok) {
      const found = res.data.routes.find((r) => r.id === id) ?? null;
      setRoute(found);
      if (!found) setError("Route not found");
    } else {
      setError(res.error);
    }
    setLoading(false);
    setRefreshing(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDispatch = () => {
    if (!route) return;
    Alert.alert("Dispatch route", "Mint OTPs and notify the driver?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Dispatch",
        onPress: async () => {
          setActing(true);
          const res = await dispatchRoute(route.id);
          setActing(false);
          if (!res.ok) {
            Alert.alert("Failed", res.error);
            return;
          }
          Alert.alert("Dispatched", "Driver has been notified.");
          load();
        },
      },
    ]);
  };

  const handleCancel = () => {
    if (!route) return;
    Alert.alert("Cancel route", "Unassign stops and return packages to pending?", [
      { text: "Keep", style: "cancel" },
      {
        text: "Cancel route",
        style: "destructive",
        onPress: async () => {
          setActing(true);
          const res = await cancelRoute(route.id, "Cancelled from mobile HQ");
          setActing(false);
          if (!res.ok) {
            Alert.alert("Failed", res.error);
            return;
          }
          router.back();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.light.primary} />
      </View>
    );
  }

  if (!route) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Route" />
        <View style={styles.center}>
          <Text style={styles.errorText}>{error ?? "Route not found"}</Text>
        </View>
      </View>
    );
  }

  const stops = route.stops ?? [];
  const canDispatch = route.status === "planned" && stops.length > 0;
  const canCancel = route.status === "planned" || route.status === "active";

  return (
    <View style={styles.container}>
      <ScreenHeader title="Route detail" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <View style={styles.hero}>
          <Text style={styles.driverName}>{route.driver?.full_name ?? "Driver"}</Text>
          {route.driver?.phone ? <Text style={styles.phone}>{route.driver.phone}</Text> : null}
          <View style={styles.heroMeta}>
            <MetaChip icon="flag-outline" label={route.status} />
            <MetaChip icon="git-branch-outline" label={route.route_kind?.replace(/_/g, " ") ?? "delivery"} />
            {route.warehouse?.name ? <MetaChip icon="storefront-outline" label={route.warehouse.name} /> : null}
          </View>
        </View>

        {(canDispatch || canCancel) && (
          <View style={styles.actions}>
            {canDispatch ? (
              <TouchableOpacity
                style={[styles.primaryBtn, acting && styles.btnDisabled]}
                onPress={handleDispatch}
                disabled={acting}
              >
                {acting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="send-outline" size={18} color="#fff" />
                    <Text style={styles.primaryBtnText}>Dispatch</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : null}
            {canCancel ? (
              <TouchableOpacity
                style={[styles.dangerBtn, acting && styles.btnDisabled]}
                onPress={handleCancel}
                disabled={acting}
              >
                <Ionicons name="close-circle-outline" size={18} color="#dc2626" />
                <Text style={styles.dangerBtnText}>Cancel route</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}

        <Text style={styles.sectionTitle}>Stops ({stops.length})</Text>
        {stops.length === 0 ? (
          <Text style={styles.emptyStops}>No stops on this route yet.</Text>
        ) : (
          stops.map((stop) => <StopRow key={stop.id} stop={stop} />)
        )}
      </ScrollView>
    </View>
  );
}

function MetaChip({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.chip}>
      <Ionicons name={icon} size={14} color={colors.light.primary} />
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

function StopRow({ stop }: { stop: DcRouteStop }) {
  const addr = stop.address_snapshot ?? stop.order?.shipping_address;
  const cityLine = [addr?.city, addr?.postal_code].filter(Boolean).join(" ");

  return (
    <View style={styles.stopCard}>
      <View style={styles.stopSeq}>
        <Text style={styles.stopSeqText}>{stop.sequence}</Text>
      </View>
      <View style={styles.stopBody}>
        <Text style={styles.stopOrder}>#{stop.order?.order_number ?? stop.order_id.slice(0, 8)}</Text>
        {addr?.full_name ? <Text style={styles.stopName}>{addr.full_name}</Text> : null}
        {cityLine ? <Text style={styles.stopAddr}>{cityLine}</Text> : null}
        <Text style={styles.stopStatus}>{stop.status}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  content: { padding: 16, paddingBottom: 40 },
  hero: {
    backgroundColor: colors.light.card,
    borderRadius: radii.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.light.border,
    marginBottom: 16,
  },
  driverName: {
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.bold,
    color: colors.light.foreground,
  },
  phone: { fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground, marginTop: 4 },
  heroMeta: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.light.muted,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
  },
  chipText: { fontSize: typography.fontSizes.xs, color: colors.light.foreground, textTransform: "capitalize" },
  actions: { flexDirection: "row", gap: 10, marginBottom: 20 },
  primaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.light.primary,
    paddingVertical: 12,
    borderRadius: radii.lg,
  },
  primaryBtnText: { color: "#fff", fontWeight: typography.fontWeights.semibold },
  dangerBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    paddingVertical: 12,
    borderRadius: radii.lg,
  },
  dangerBtnText: { color: "#dc2626", fontWeight: typography.fontWeights.semibold },
  btnDisabled: { opacity: 0.6 },
  sectionTitle: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold,
    color: colors.light.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: typography.letterSpacing.wider,
    marginBottom: 10,
  },
  emptyStops: { fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground },
  stopCard: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: colors.light.card,
    borderRadius: radii.lg,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  stopSeq: {
    width: 32,
    height: 32,
    borderRadius: radii.full,
    backgroundColor: colors.light.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  stopSeqText: { fontWeight: typography.fontWeights.bold, color: colors.light.primary },
  stopBody: { flex: 1 },
  stopOrder: { fontWeight: typography.fontWeights.semibold, color: colors.light.foreground },
  stopName: { fontSize: typography.fontSizes.sm, marginTop: 2 },
  stopAddr: { fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground, marginTop: 2 },
  stopStatus: {
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    marginTop: 6,
    textTransform: "capitalize",
  },
  errorText: { fontSize: typography.fontSizes.sm, color: "#dc2626", textAlign: "center" },
});
