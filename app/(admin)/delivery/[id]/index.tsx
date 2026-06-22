import React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Alert,
  RefreshControl,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@/components/ui/Icon";
import { getAdminDeliveryCompanyDetail, getDeliveryPipelineZones, updateAdminDeliveryCompanyStatus } from "@/lib/api";
import { Card, EmptyState, Badge, Skeleton, Button } from "@/components/ui";
import { colors, radii, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

function rel(s: string) {
  const d = new Date(s).getTime();
  const m = Math.floor((Date.now() - d) / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function statusVariant(status: string): "default" | "secondary" | "destructive" {
  if (status === "active") return "default";
  if (status === "pending") return "secondary";
  return "destructive";
}

export default function AdminDeliveryCompanyDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const q = useQuery({
    queryKey: ["admin-delivery-company", id],
    queryFn: async () => {
      const r = await getAdminDeliveryCompanyDetail(id!);
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    enabled: !!id,
  });

  const zonesQ = useQuery({
    queryKey: ["admin-delivery-zones", id],
    queryFn: async () => {
      const r = await getDeliveryPipelineZones({ company_id: id!, include_inactive: true });
      if (!r.ok) throw new Error(r.error);
      return r.data.zones;
    },
    enabled: !!id,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-delivery-company", id] });
    queryClient.invalidateQueries({ queryKey: ["admin-delivery-companies"] });
  };

  const updateMutation = useMutation({
    mutationFn: (nextStatus: "active" | "suspended" | "rejected") =>
      updateAdminDeliveryCompanyStatus(id!, nextStatus),
    onSuccess: (res) => {
      if (!res.ok) {
        Alert.alert("Action failed", res.error);
        return;
      }
      invalidate();
      Alert.alert("Updated", `Company marked as ${res.data.status}.`);
    },
  });

  const confirmStatus = (nextStatus: "active" | "suspended" | "rejected") => {
    const name = q.data?.company.name ?? "This company";
    const unlinkNote =
      nextStatus === "suspended" || nextStatus === "rejected"
        ? " Linked stores will be unlinked."
        : "";
    Alert.alert(
      `Mark ${nextStatus}?`,
      `${name} will be marked as ${nextStatus}.${unlinkNote}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          style: nextStatus === "active" ? "default" : "destructive",
          onPress: () => updateMutation.mutate(nextStatus),
        },
      ],
    );
  };

  if (q.isLoading) {
    return (
      <View style={styles.container}>
        <Skeleton height={200} style={{ margin: 20 }} />
      </View>
    );
  }

  if (!q.data?.company) {
    return <EmptyState icon="car-outline" title="Company not found" />;
  }

  const c = q.data.company;
  const members = q.data.members ?? [];
  const warehouses = q.data.warehouses ?? [];
  const routes = q.data.routes ?? [];
  const audit = q.data.audit ?? [];
  const zones = zonesQ.data ?? [];
  const busy = updateMutation.isPending;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} />}
    >
      <Pressable onPress={() => router.back()} style={styles.back}>
        <Ionicons name="arrow-back" size={18} color={colors.light.mutedForeground} />
        <Text style={styles.backText}>Back</Text>
      </Pressable>

      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>DELIVERY COMPANY</Text>
          <Text style={styles.title}>{c.name}</Text>
          <Text style={styles.meta}>
            {c.slug} · {c.total_deliveries ?? 0} deliveries · joined {rel(c.created_at)} ago
          </Text>
          <Text style={styles.owner}>
            Owner: {c.owner?.full_name ?? "—"} ({c.owner?.email ?? c.contact_email ?? "—"})
          </Text>
        </View>
        <Badge variant={statusVariant(c.status)}>{c.status}</Badge>
      </View>

      <View style={styles.actions}>
        {c.status !== "active" ? (
          <Button size="sm" onPress={() => confirmStatus("active")} loading={busy}>
            Approve
          </Button>
        ) : null}
        {c.status !== "suspended" ? (
          <Button size="sm" variant="outline" onPress={() => confirmStatus("suspended")} loading={busy}>
            Suspend
          </Button>
        ) : null}
        {c.status !== "rejected" ? (
          <Button size="sm" variant="destructive" onPress={() => confirmStatus("rejected")} loading={busy}>
            Reject
          </Button>
        ) : null}
      </View>

      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Members ({members.length})</Text>
        {members.length === 0 ? (
          <Text style={styles.empty}>No members yet.</Text>
        ) : (
          members.map((m) => (
            <View key={m.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{m.user?.full_name ?? "—"}</Text>
                <Text style={styles.rowMeta}>{m.user?.email ?? "—"} · joined {rel(m.joined_at)} ago</Text>
              </View>
              <Badge variant="outline">{m.company_role}</Badge>
            </View>
          ))
        )}
      </Card>

      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Warehouses ({warehouses.length})</Text>
        {warehouses.length === 0 ? (
          <Text style={styles.empty}>No warehouses.</Text>
        ) : (
          warehouses.map((w) => (
            <View key={w.id} style={styles.row}>
              <Ionicons name="location-outline" size={16} color={colors.light.mutedForeground} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{w.name}</Text>
                <Text style={styles.rowMeta}>
                  {[w.address?.city, w.address?.postal_code].filter(Boolean).join(", ") || "—"}
                </Text>
              </View>
            </View>
          ))
        )}
      </Card>

      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Delivery zones ({zones.length})</Text>
        {zonesQ.isLoading ? (
          <Text style={styles.empty}>Loading zones…</Text>
        ) : zonesQ.isError ? (
          <Text style={styles.empty}>Could not load zones.</Text>
        ) : zones.length === 0 ? (
          <Text style={styles.empty}>No zones configured. Manage zones on the web admin console.</Text>
        ) : (
          zones.map((z) => (
            <View key={z.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{z.name}</Text>
                <Text style={styles.rowMeta}>
                  {[z.city, z.area].filter(Boolean).join(" · ")}
                  {z.hub?.name ? ` · hub: ${z.hub.name}` : ""}
                </Text>
                {z.postal_codes?.length ? (
                  <Text style={styles.rowMeta}>{z.postal_codes.length} postal code(s)</Text>
                ) : null}
              </View>
              <Badge variant={z.is_active ? "outline" : "secondary"}>
                {z.is_active ? "active" : "inactive"}
              </Badge>
            </View>
          ))
        )}
      </Card>

      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Recent routes ({routes.length})</Text>
        {routes.length === 0 ? (
          <Text style={styles.empty}>No routes yet.</Text>
        ) : (
          routes.slice(0, 20).map((r) => (
            <View key={r.id} style={styles.row}>
              <Text style={styles.rowMeta}>
                {r.total_stops ?? 0} stop(s) · {r.started_at ? `${rel(r.started_at)} ago` : "not started"}
              </Text>
              <Badge variant="secondary">{r.status}</Badge>
            </View>
          ))
        )}
      </Card>

      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Audit log</Text>
        {audit.length === 0 ? (
          <Text style={styles.empty}>No audit entries.</Text>
        ) : (
          audit.slice(0, 30).map((e) => (
            <View key={e.id} style={styles.auditRow}>
              <Text style={styles.auditTime}>{rel(e.created_at)}</Text>
              <Text style={styles.auditActor}>{e.actor?.full_name ?? "—"}</Text>
              <Text style={styles.auditAction}>{e.action.replace(/[._]/g, " ")}</Text>
            </View>
          ))
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  content: { padding: 20, paddingBottom: 100, gap: 12 },
  back: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  backText: { fontFamily: fontFamilies.sans.medium, fontSize: 14, color: colors.light.mutedForeground },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  eyebrow: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    color: colors.light.primary,
    letterSpacing: 1.4,
  },
  title: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 26,
    color: colors.light.foreground,
    marginTop: 4,
    letterSpacing: -0.5,
  },
  meta: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.light.mutedForeground, marginTop: 4 },
  owner: { fontFamily: fontFamilies.mono.regular, fontSize: 10, color: colors.light.mutedForeground, marginTop: 6 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  card: { padding: 14, ...shadows.soft },
  sectionTitle: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: colors.light.foreground, marginBottom: 10 },
  empty: { fontFamily: fontFamilies.sans.regular, fontSize: 13, color: colors.light.mutedForeground },
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.light.border },
  rowTitle: { fontFamily: fontFamilies.sans.medium, fontSize: 13, color: colors.light.foreground },
  rowMeta: { fontFamily: fontFamilies.sans.regular, fontSize: 11, color: colors.light.mutedForeground, marginTop: 2 },
  auditRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.light.border },
  auditTime: { fontFamily: fontFamilies.mono.regular, fontSize: 10, color: colors.light.mutedForeground },
  auditActor: { fontFamily: fontFamilies.sans.medium, fontSize: 11, color: colors.light.foreground },
  auditAction: { fontFamily: fontFamilies.sans.regular, fontSize: 11, color: colors.light.mutedForeground },
});
