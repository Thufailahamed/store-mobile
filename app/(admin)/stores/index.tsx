import React, { useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, TextInput, Alert } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAdminStores, approveStore } from "@/lib/api";
import { Card, Badge, Skeleton, Button } from "@/components/ui";
import { colors, typography, radii } from "@/lib/theme/tokens";

const STATUS_TABS = ["all", "pending", "approved", "rejected"];

export default function AdminStores() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");

  const storesQuery = useQuery({
    queryKey: ["admin-stores", status, search],
    queryFn: async () => {
      const res = await getAdminStores({ status, search });
      return res.ok ? res.data : { stores: [], total: 0 };
    },
  });

  const approveMutation = useMutation({
    mutationFn: ({ storeId, newStatus }: { storeId: string; newStatus: "approved" | "rejected" }) =>
      approveStore(storeId, newStatus),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-stores"] });
    },
  });

  const stores = storesQuery.data?.stores ?? [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Stores</Text>
        <Text style={styles.count}>{storesQuery.data?.total ?? 0}</Text>
      </View>

      <TextInput
        style={styles.search}
        placeholder="Search stores..."
        placeholderTextColor={colors.light.muted}
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

      {storesQuery.isLoading ? (
        <View style={styles.list}>
          {[1, 2, 3].map((i) => (
            <Card key={i} style={styles.storeCard}>
              <Skeleton width="60%" height={16} />
              <Skeleton width="40%" height={12} style={{ marginTop: 8 }} />
            </Card>
          ))}
        </View>
      ) : stores.length === 0 ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 40 }}>
          <Text style={{ fontSize: typography.fontSizes.lg, fontWeight: typography.fontWeights.semibold, color: colors.light.foreground, marginBottom: 8 }}>No stores</Text>
          <Text style={{ fontSize: typography.fontSizes.base, color: colors.light.muted, textAlign: "center" }}>No stores found.</Text>
        </View>
      ) : (
        <FlatList
          data={stores}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Card style={styles.storeCard}>
              <View style={styles.storeRow}>
                <View style={styles.storeInfo}>
                  <Text style={styles.storeName}>{item.name}</Text>
                  <Text style={styles.storeSlug}>@{item.slug}</Text>
                  <View style={styles.storeMeta}>
                    <Badge
                      variant={item.status === "approved" ? "default" : item.status === "pending" ? "secondary" : "destructive"}
                    >
                      {item.status}
                    </Badge>
                    <Text style={styles.storeRating}>★ {item.rating?.toFixed(1) ?? "0.0"}</Text>
                  </View>
                </View>
                {item.status === "pending" && (
                  <View style={styles.actions}>
                    <Button
                      onPress={() => {
                        Alert.alert("Approve", `Approve "${item.name}"?`, [
                          { text: "Cancel", style: "cancel" },
                          { text: "Approve", onPress: () => approveMutation.mutate({ storeId: item.id, newStatus: "approved" }) },
                        ]);
                      }}
                      size="sm"
                      style={styles.approveBtn}
                    >
                      Approve
                    </Button>
                    <Button
                      onPress={() => {
                        Alert.alert("Reject", `Reject "${item.name}"?`, [
                          { text: "Cancel", style: "cancel" },
                          { text: "Reject", style: "destructive", onPress: () => approveMutation.mutate({ storeId: item.id, newStatus: "rejected" }) },
                        ]);
                      }}
                      variant="outline"
                      size="sm"
                    >
                      Reject
                    </Button>
                  </View>
                )}
              </View>
            </Card>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 24, paddingBottom: 0 },
  title: { fontSize: typography.fontSizes["2xl"], fontWeight: typography.fontWeights.bold, color: colors.light.foreground },
  count: { fontSize: typography.fontSizes.sm, color: colors.light.muted },
  search: { margin: 24, marginBottom: 16, padding: 16, backgroundColor: colors.light.card, borderRadius: radii.md, borderWidth: 1, borderColor: colors.light.border, fontSize: typography.fontSizes.base, color: colors.light.foreground },
  tabs: { flexDirection: "row", paddingHorizontal: 24, gap: 4, marginBottom: 16 },
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: radii.full },
  tabActive: { backgroundColor: colors.light.primary },
  tabText: { fontSize: typography.fontSizes.sm, color: colors.light.muted },
  tabTextActive: { color: "#fff", fontWeight: "600" },
  list: { padding: 24 },
  storeCard: { marginBottom: 16, padding: 24 },
  storeRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  storeInfo: { flex: 1 },
  storeName: { fontSize: typography.fontSizes.base, fontWeight: typography.fontWeights.semibold, color: colors.light.foreground },
  storeSlug: { fontSize: typography.fontSizes.sm, color: colors.light.muted, marginTop: 4 },
  storeMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  storeRating: { fontSize: typography.fontSizes.sm, color: colors.light.foreground },
  actions: { gap: 4 },
  approveBtn: { marginBottom: 0 },
});
