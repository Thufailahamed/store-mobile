import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  Pressable,
  Alert,
  TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAdminDeliveryCompanies, updateAdminDeliveryCompanyStatus } from "@/lib/api";
import { Card, EmptyState, Badge, Skeleton, Button } from "@/components/ui";
import { colors, typography, radii, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

const STATUS_TABS = ["all", "pending", "active", "suspended", "rejected"] as const;

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

export default function AdminDelivery() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<(typeof STATUS_TABS)[number]>("all");
  const [search, setSearch] = useState("");

  const q = useQuery({
    queryKey: ["admin-delivery-companies", status, search],
    queryFn: async () => {
      const r = await getAdminDeliveryCompanies({
        status: status === "all" ? undefined : status,
        search: search.trim() || undefined,
      });
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, nextStatus }: { id: string; nextStatus: "active" | "suspended" | "rejected" }) =>
      updateAdminDeliveryCompanyStatus(id, nextStatus),
    onSuccess: (res) => {
      if (!res.ok) {
        Alert.alert("Action failed", res.error);
        return;
      }
      Alert.alert("Updated", `Company marked as ${res.data.status}.`);
      queryClient.invalidateQueries({ queryKey: ["admin-delivery-companies"] });
    },
  });

  const confirmStatus = (id: string, name: string, nextStatus: "active" | "suspended" | "rejected") => {
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
          onPress: () => updateMutation.mutate({ id, nextStatus }),
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>LOGISTICS</Text>
          <Text style={styles.title}>Delivery companies</Text>
        </View>
        <Text style={styles.count}>{(q.data ?? []).length}</Text>
      </View>

      <TextInput
        style={styles.search}
        placeholder="Search by name, slug, email..."
        placeholderTextColor={colors.light.mutedForeground}
        value={search}
        onChangeText={setSearch}
      />

      <View style={styles.tabs}>
        {STATUS_TABS.map((tab) => (
          <Pressable
            key={tab}
            style={[styles.tab, status === tab && styles.tabActive]}
            onPress={() => setStatus(tab)}
          >
            <Text style={[styles.tabText, status === tab && styles.tabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={q.data ?? []}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} />}
        ListEmptyComponent={
          q.isLoading ? <Skeleton height={80} /> : <EmptyState icon="car-outline" title="No companies" />
        }
        renderItem={({ item, index }) => (
          <Pressable onPress={() => router.push(`/(admin)/delivery/${item.id}`)}>
            <Card style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.index}>{String(index + 1).padStart(2, "0")}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.meta}>
                  {item.slug} · {item.total_deliveries ?? 0} deliveries
                </Text>
                <Text style={styles.meta2}>
                  {item.owner?.full_name ?? item.owner?.email ?? item.contact_email ?? item.contact_phone ?? "—"} · joined{" "}
                  {rel(item.created_at)} ago
                </Text>
                <View style={styles.actions}>
                  {item.status !== "active" ? (
                    <Button
                      size="sm"
                      onPress={() => confirmStatus(item.id, item.name, "active")}
                      loading={updateMutation.isPending}
                    >
                      Approve
                    </Button>
                  ) : null}
                  {item.status !== "suspended" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onPress={() => confirmStatus(item.id, item.name, "suspended")}
                      loading={updateMutation.isPending}
                    >
                      Suspend
                    </Button>
                  ) : null}
                  {item.status !== "rejected" ? (
                    <Button
                      size="sm"
                      variant="destructive"
                      onPress={() => confirmStatus(item.id, item.name, "rejected")}
                      loading={updateMutation.isPending}
                    >
                      Reject
                    </Button>
                  ) : null}
                </View>
              </View>
                <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
              </View>
            </Card>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    padding: 20,
    paddingBottom: 12,
  },
  eyebrow: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    color: colors.light.primary,
    letterSpacing: 1.4,
  },
  title: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 28,
    color: colors.light.foreground,
    marginTop: 4,
    letterSpacing: -0.5,
  },
  count: { fontFamily: fontFamilies.mono.regular, fontSize: 12, color: colors.light.mutedForeground },
  search: {
    marginHorizontal: 20,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 14,
    color: colors.light.foreground,
    backgroundColor: colors.light.card,
  },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 20, marginBottom: 8 },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.light.card,
  },
  tabActive: { borderColor: colors.light.primary, backgroundColor: `${colors.light.primary}14` },
  tabText: { fontFamily: fontFamilies.sans.medium, fontSize: 12, color: colors.light.mutedForeground },
  tabTextActive: { color: colors.light.primary },
  list: { padding: 20, paddingBottom: 100, gap: 10 },
  card: { padding: 14, ...shadows.soft },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  index: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 11,
    color: colors.light.mutedForeground,
    width: 24,
    marginTop: 2,
  },
  name: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: colors.light.foreground },
  meta: { fontFamily: fontFamilies.sans.regular, fontSize: 11, color: colors.light.mutedForeground, marginTop: 2 },
  meta2: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 10,
    color: colors.light.mutedForeground,
    marginTop: 4,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
});
