import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import {
  getDeliveryCompanyDrivers,
  getDeliveryCompanyPackages,
  getDeliveryCompanyRoutes,
  hasStoreApi,
  updateDriverMember,
  type DcDriverMember,
} from "@/lib/api/delivery-company-api";
import { colors, typography, radii } from "@/lib/theme/tokens";

export default function DriverDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [member, setMember] = useState<DcDriverMember | null>(null);
  const [routeCount, setRouteCount] = useState(0);
  const [stopCount, setStopCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    if (!id || !hasStoreApi()) return;
    const [driversRes, routesRes, packagesRes] = await Promise.all([
      getDeliveryCompanyDrivers(),
      getDeliveryCompanyRoutes({ driver_id: id }),
      getDeliveryCompanyPackages(),
    ]);
    if (driversRes.ok) {
      setMember(driversRes.data.members.find((m) => m.user_id === id) ?? null);
    }
    if (routesRes.ok) {
      setRouteCount(routesRes.data.routes.length);
    }
    if (packagesRes.ok) {
      const stops = (packagesRes.data.route_stops as any[]).filter(
        (s) => s.route?.driver_id === id,
      );
      setStopCount(stops.length);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const capacity = member?.capacity_max ?? 10;
  const activeLoad = member?.active_load ?? 0;

  const adjustCapacity = async (delta: number) => {
    if (!member) return;
    const next = Math.max(0, Math.min(1000, capacity + delta));
    setSaving(true);
    const res = await updateDriverMember(member.id, { capacity_max: next });
    setSaving(false);
    if (!res.ok) Alert.alert("Failed", res.error);
    else fetchData();
  };

  const toggleActive = () => {
    if (!member) return;
    const next = !member.is_active;
    Alert.alert(next ? "Activate" : "Deactivate", `Change status for ${member.user?.full_name}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm",
        onPress: async () => {
          const res = await updateDriverMember(member.id, { is_active: next });
          if (!res.ok) Alert.alert("Failed", res.error);
          else fetchData();
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

  if (!member) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Driver" />
        <View style={styles.center}>
          <Text style={styles.muted}>Driver not found in your company.</Text>
        </View>
      </View>
    );
  }

  const u = member.user;

  return (
    <View style={styles.container}>
      <ScreenHeader title="Driver profile" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={32} color={colors.light.primary} />
          </View>
          <Text style={styles.name}>{u?.full_name ?? "Driver"}</Text>
          {u?.email ? <Text style={styles.meta}>{u.email}</Text> : null}
          {u?.phone ? <Text style={styles.meta}>{u.phone}</Text> : null}
          <View style={styles.tags}>
            <Tag label={member.company_role} />
            {member.driver_type ? <Tag label={member.driver_type.replace(/_/g, " ")} /> : null}
            <Tag label={member.is_active ? "Active" : "Inactive"} />
          </View>
        </View>

        <View style={styles.kpiRow}>
          <View style={styles.kpi}>
            <Text style={styles.kpiValue}>{activeLoad}/{capacity}</Text>
            <Text style={styles.kpiLabel}>Active load</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiValue}>{routeCount}</Text>
            <Text style={styles.kpiLabel}>Routes</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiValue}>{stopCount}</Text>
            <Text style={styles.kpiLabel}>Stops</Text>
          </View>
        </View>

        <Text style={styles.section}>Capacity</Text>
        <View style={styles.stepper}>
          <TouchableOpacity style={styles.stepBtn} onPress={() => adjustCapacity(-1)} disabled={saving}>
            <Ionicons name="remove" size={20} color={colors.light.foreground} />
          </TouchableOpacity>
          <Text style={styles.stepValue}>{capacity}</Text>
          <TouchableOpacity style={styles.stepBtn} onPress={() => adjustCapacity(1)} disabled={saving}>
            <Ionicons name="add" size={20} color={colors.light.foreground} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.actionBtn} onPress={toggleActive}>
          <Ionicons name={member.is_active ? "power" : "power-outline"} size={18} color={colors.light.primary} />
          <Text style={styles.actionText}>{member.is_active ? "Deactivate driver" : "Activate driver"}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={() => router.push(`/(delivery-company)/routes`)}>
          <Ionicons name="map-outline" size={18} color={colors.light.primary} />
          <Text style={styles.actionText}>View routes</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <View style={styles.tag}>
      <Text style={styles.tagText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  content: { padding: 16, paddingBottom: 40 },
  hero: { alignItems: "center", marginBottom: 20 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: radii.full,
    backgroundColor: colors.light.muted,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  name: { fontSize: typography.fontSizes.xl, fontWeight: typography.fontWeights.bold },
  meta: { fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground, marginTop: 4 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12, justifyContent: "center" },
  tag: { backgroundColor: colors.light.muted, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.full },
  tagText: { fontSize: typography.fontSizes.xs, textTransform: "capitalize" },
  kpiRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
  kpi: {
    flex: 1,
    backgroundColor: colors.light.card,
    borderRadius: radii.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.light.border,
    alignItems: "center",
  },
  kpiValue: { fontSize: typography.fontSizes.lg, fontWeight: typography.fontWeights.bold },
  kpiLabel: { fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground, marginTop: 4 },
  section: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold,
    color: colors.light.mutedForeground,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  stepper: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 20, marginBottom: 20 },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    backgroundColor: colors.light.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  stepValue: { fontSize: typography.fontSizes["2xl"], fontWeight: typography.fontWeights.bold, minWidth: 40, textAlign: "center" },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.light.card,
    padding: 14,
    borderRadius: radii.lg,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  actionText: { fontWeight: typography.fontWeights.medium, color: colors.light.primary },
  muted: { color: colors.light.mutedForeground },
});
