import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Modal,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import {
  autoAssignOrders,
  getAssignmentCandidates,
  getDeliveryCompanyPackages,
  hasStoreApi,
  manualAssignOrder,
  type AssignmentPolicy,
  type DcAssignCandidate,
} from "@/lib/api/delivery-company-api";
import { colors, typography, radii } from "@/lib/theme/tokens";

type Leg = "pickup" | "last_mile" | "delivery";

const LEGS: { id: Leg; label: string }[] = [
  { id: "pickup", label: "Pickup" },
  { id: "last_mile", label: "Last mile" },
  { id: "delivery", label: "Delivery" },
];

const STUCK_MS = 2 * 60 * 60 * 1000;

const POLICIES: { id: AssignmentPolicy | undefined; label: string }[] = [
  { id: undefined, label: "Auto" },
  { id: "zone", label: "Zone" },
  { id: "round_robin", label: "Round robin" },
  { id: "distance", label: "Distance" },
  { id: "auto_pickup", label: "Auto pickup" },
  { id: "auto_last_mile", label: "Auto last mile" },
];

export default function CompanyAssignmentsScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [leg, setLeg] = useState<Leg>("pickup");
  const [policy, setPolicy] = useState<AssignmentPolicy | undefined>(undefined);
  const [pending, setPending] = useState<
    Array<{
      id: string;
      order_number: string;
      total: number;
      shipping_address?: Record<string, string> | null;
      _warehouse?: { id: string; name: string } | null;
      _received_at?: string | null;
    }>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [manualOrder, setManualOrder] = useState<{
    id: string;
    order_number: string;
    warehouse_id?: string;
  } | null>(null);
  const [candidates, setCandidates] = useState<DcAssignCandidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [manualAssigning, setManualAssigning] = useState(false);

  const load = useCallback(async () => {
    if (!hasStoreApi()) {
      setError("EXPO_PUBLIC_STORE_API_URL is not configured");
      setLoading(false);
      setRefreshing(false);
      return;
    }
    const res = await getDeliveryCompanyPackages();
    if (!res.ok) {
      setError(res.error);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    const seen = new Set<string>();
    const list: typeof pending = [];
    for (const i of res.data.inventory) {
      if (i.status === "received" && i.order && !seen.has(i.order_id)) {
        seen.add(i.order_id);
        list.push({
          ...i.order,
          _warehouse: i.warehouse,
          _received_at: i.received_at,
        });
      }
    }
    list.sort((a, b) => {
      const ta = a._received_at ? new Date(a._received_at).getTime() : Number.POSITIVE_INFINITY;
      const tb = b._received_at ? new Date(b._received_at).getTime() : Number.POSITIVE_INFINITY;
      return ta - tb;
    });
    setPending(list);
    setError(null);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stuckCount = useMemo(() => {
    const now = Date.now();
    return pending.filter((o) => o._received_at && now - new Date(o._received_at).getTime() > STUCK_MS).length;
  }, [pending]);

  const toggle = (id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === pending.length) setSelected(new Set());
    else setSelected(new Set(pending.map((o) => o.id)));
  };

  const runAutoAssign = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) {
      Alert.alert("Select orders", "Choose at least one package to assign.");
      return;
    }
    setAssigning(true);
    const res = await autoAssignOrders(ids, leg, policy);
    setAssigning(false);
    if (!res.ok) {
      Alert.alert("Assignment failed", res.error);
      return;
    }
    const assigned = (res.data.assignments as unknown[] | undefined)?.length ?? 0;
    const skipped = res.data.skipped?.length ?? 0;
    Alert.alert("Done", `${assigned} assigned · ${skipped} skipped`);
    setSelected(new Set());
    load();
  };

  const openManual = async (order: (typeof pending)[0]) => {
    setManualOrder({
      id: order.id,
      order_number: order.order_number,
      warehouse_id: order._warehouse?.id,
    });
    setCandidates([]);
    setLoadingCandidates(true);
    const res = await getAssignmentCandidates(order.id, leg);
    setLoadingCandidates(false);
    if (!res.ok) {
      Alert.alert("Could not load drivers", res.error);
      setManualOrder(null);
      return;
    }
    setCandidates(res.data.candidates.filter((c) => c.eligible));
  };

  const confirmManual = async (driverId: string) => {
    if (!manualOrder) return;
    setManualAssigning(true);
    const res = await manualAssignOrder(manualOrder.id, driverId, {
      leg,
      warehouse_id: manualOrder.warehouse_id,
    });
    setManualAssigning(false);
    if (!res.ok) {
      Alert.alert("Assignment failed", res.error);
      return;
    }
    Alert.alert("Assigned", `Order #${manualOrder.order_number} assigned.`);
    setManualOrder(null);
    load();
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Assignments" showBack={false} />
      <View style={styles.summary}>
        <Text style={styles.summaryCount}>{pending.length} pending</Text>
        {stuckCount > 0 ? (
          <View style={styles.stuckBadge}>
            <Ionicons name="alert-circle" size={14} color="#ea580c" />
            <Text style={styles.stuckText}>{stuckCount} waiting 2h+</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.legRow}>
        {LEGS.map((l) => (
          <TouchableOpacity
            key={l.id}
            style={[styles.legChip, leg === l.id && styles.legChipActive]}
            onPress={() => setLeg(l.id)}
          >
            <Text style={[styles.legText, leg === l.id && styles.legTextActive]}>{l.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.policyScroll} contentContainerStyle={styles.policyRow}>
        {POLICIES.map((p) => (
          <TouchableOpacity
            key={p.label}
            style={[styles.policyChip, policy === p.id && styles.policyChipActive]}
            onPress={() => setPolicy(p.id)}
          >
            <Text style={[styles.policyText, policy === p.id && styles.policyTextActive]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.toolbar}>
        <TouchableOpacity onPress={toggleAll} style={styles.selectAll}>
          <Ionicons
            name={selected.size === pending.length && pending.length > 0 ? "checkbox" : "square-outline"}
            size={22}
            color={colors.light.primary}
          />
          <Text style={styles.selectAllText}>
            {selected.size} of {pending.length} selected
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.assignBtn, (assigning || selected.size === 0) && styles.assignBtnDisabled]}
          onPress={runAutoAssign}
          disabled={assigning || selected.size === 0}
        >
          {assigning ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="flash-outline" size={18} color="#fff" />
              <Text style={styles.assignBtnText}>Auto-assign</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.light.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={pending}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="checkmark-circle-outline" size={40} color={colors.light.mutedForeground} />
              <Text style={styles.emptyTitle}>All caught up</Text>
              <Text style={styles.emptySub}>No packages waiting for driver assignment.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isStuck =
              item._received_at && Date.now() - new Date(item._received_at).getTime() > STUCK_MS;
            const checked = selected.has(item.id);
            return (
              <View style={[styles.card, isStuck && styles.cardStuck]}>
                <TouchableOpacity style={styles.cardMain} onPress={() => toggle(item.id)} activeOpacity={0.8}>
                  <Ionicons
                    name={checked ? "checkbox" : "square-outline"}
                    size={24}
                    color={checked ? colors.light.primary : colors.light.mutedForeground}
                  />
                  <View style={styles.cardBody}>
                    <Text style={styles.orderNum}>#{item.order_number}</Text>
                    <Text style={styles.meta}>
                      {item._warehouse?.name ?? "Hub"} · Rs. {item.total.toLocaleString("en-LK")}
                    </Text>
                    {item.shipping_address?.full_name ? (
                      <Text style={styles.customer}>{item.shipping_address.full_name}</Text>
                    ) : null}
                  </View>
                  {isStuck ? <Ionicons name="time-outline" size={18} color="#ea580c" /> : null}
                </TouchableOpacity>
                <TouchableOpacity style={styles.manualBtn} onPress={() => openManual(item)} hitSlop={8}>
                  <Ionicons name="person-add-outline" size={20} color={colors.light.primary} />
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}

      <Modal visible={!!manualOrder} animationType="slide" transparent onRequestClose={() => setManualOrder(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Assign #{manualOrder?.order_number}</Text>
            <Text style={styles.modalSub}>Pick a driver for {leg.replace(/_/g, " ")}</Text>
            {loadingCandidates ? (
              <ActivityIndicator style={{ marginVertical: 24 }} color={colors.light.primary} />
            ) : candidates.length === 0 ? (
              <Text style={styles.modalEmpty}>No eligible drivers found.</Text>
            ) : (
              <ScrollView style={{ maxHeight: 360 }}>
                {candidates.map((c) => (
                  <TouchableOpacity
                    key={c.user_id}
                    style={styles.candidateRow}
                    onPress={() => confirmManual(c.user_id)}
                    disabled={manualAssigning}
                  >
                    <View style={styles.candidateBody}>
                      <Text style={styles.candidateName}>{c.full_name}</Text>
                      <Text style={styles.candidateMeta}>
                        Load {c.active_load}/{c.capacity_max} · score {Math.round(c.score)}
                      </Text>
                      {c.reason ? <Text style={styles.candidateReason}>{c.reason}</Text> : null}
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.light.mutedForeground} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <TouchableOpacity style={styles.modalClose} onPress={() => setManualOrder(null)}>
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  summaryCount: { fontSize: typography.fontSizes.sm, fontWeight: typography.fontWeights.semibold, color: colors.light.foreground },
  stuckBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
  stuckText: { fontSize: typography.fontSizes.xs, color: "#ea580c", fontWeight: typography.fontWeights.medium },
  legRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, marginBottom: 10 },
  legChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.full,
    backgroundColor: colors.light.muted,
  },
  legChipActive: { backgroundColor: colors.light.primary },
  legText: { fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground },
  legTextActive: { color: "#fff", fontWeight: typography.fontWeights.semibold },
  policyScroll: { marginBottom: 10, maxHeight: 40 },
  policyRow: { paddingHorizontal: 16, gap: 8 },
  policyChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: colors.light.muted,
  },
  policyChipActive: { backgroundColor: colors.light.primary },
  policyText: { fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground },
  policyTextActive: { color: "#fff", fontWeight: typography.fontWeights.semibold },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 12,
  },
  selectAll: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  selectAllText: { fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground },
  assignBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.light.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.lg,
  },
  assignBtnDisabled: { opacity: 0.5 },
  assignBtnText: { color: "#fff", fontSize: typography.fontSizes.sm, fontWeight: typography.fontWeights.semibold },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.light.card,
    borderRadius: radii.lg,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.light.border,
    overflow: "hidden",
  },
  cardMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
  },
  cardStuck: { borderColor: "#fed7aa", backgroundColor: "#fff7ed" },
  cardBody: { flex: 1 },
  orderNum: { fontSize: typography.fontSizes.base, fontWeight: typography.fontWeights.semibold, color: colors.light.foreground },
  meta: { fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground, marginTop: 2 },
  customer: { fontSize: typography.fontSizes.sm, color: colors.light.foreground, marginTop: 4 },
  manualBtn: { paddingHorizontal: 14, paddingVertical: 14, borderLeftWidth: 1, borderLeftColor: colors.light.border },
  empty: { alignItems: "center", paddingTop: 48, gap: 8 },
  emptyTitle: { fontSize: typography.fontSizes.lg, fontWeight: typography.fontWeights.semibold },
  emptySub: { fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground, textAlign: "center", paddingHorizontal: 32 },
  errorText: { fontSize: typography.fontSizes.sm, color: "#dc2626", textAlign: "center" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalCard: {
    backgroundColor: colors.light.card,
    borderTopLeftRadius: radii["2xl"],
    borderTopRightRadius: radii["2xl"],
    padding: 20,
    maxHeight: "80%",
  },
  modalTitle: { fontSize: typography.fontSizes.lg, fontWeight: typography.fontWeights.bold },
  modalSub: { fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground, marginBottom: 12 },
  modalEmpty: { fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground, paddingVertical: 24, textAlign: "center" },
  candidateRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
    gap: 8,
  },
  candidateBody: { flex: 1 },
  candidateName: { fontWeight: typography.fontWeights.semibold, color: colors.light.foreground },
  candidateMeta: { fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground, marginTop: 2 },
  candidateReason: { fontSize: typography.fontSizes.xs, color: colors.light.primary, marginTop: 4 },
  modalClose: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: colors.light.muted,
    borderRadius: radii.lg,
  },
  modalCloseText: { fontWeight: typography.fontWeights.semibold },
});
