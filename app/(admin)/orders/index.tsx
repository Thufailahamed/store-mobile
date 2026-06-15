import React, { useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { getAdminOrders } from "@/lib/api";
import type { Order } from "@/lib/types";
import { Card, Badge, Skeleton } from "@/components/ui";
import { colors, typography, radii } from "@/lib/theme/tokens";

const STATUS_TABS = ["all", "pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];

const STATUS_COLORS: Record<string, string> = {
  pending: colors.light.accent,
  confirmed: colors.light.secondary,
  processing: colors.light.primary,
  shipped: colors.light.secondary,
  out_for_delivery: colors.light.primary,
  delivered: colors.olive[300],
  cancelled: colors.light.destructive,
  returned: colors.light.destructive,
  refunded: colors.light.muted,
};

export default function AdminOrders() {
  const router = useRouter();
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");

  const ordersQuery = useQuery({
    queryKey: ["admin-orders", status, search],
    queryFn: async () => {
      const res = await getAdminOrders({ status, search });
      return res.ok ? res.data : [];
    },
  });

  const orders = ordersQuery.data ?? [];

  const renderOrder = ({ item }: { item: Order }) => (
    <Pressable onPress={() => router.push({ pathname: "/(admin)/orders/[id]", params: { id: item.id } })}>
      <Card style={styles.orderCard}>
        <View style={styles.orderRow}>
          <View style={styles.orderInfo}>
            <Text style={styles.orderNumber}>{item.order_number}</Text>
            <Text style={styles.orderDate}>
              {new Date(item.placed_at).toLocaleDateString("en-LK", { month: "short", day: "numeric" })}
            </Text>
          </View>
          <View style={styles.orderRight}>
            <Text style={styles.orderTotal}>LKR {item.total.toLocaleString()}</Text>
            <Badge
              variant={item.status === "delivered" ? "default" : item.status === "cancelled" ? "destructive" : "secondary"}
            >
              {item.status}
            </Badge>
          </View>
        </View>
      </Card>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Orders</Text>
        <Text style={styles.count}>{orders.length}</Text>
      </View>

      <TextInput
        style={styles.search}
        placeholder="Search by order number..."
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

      {ordersQuery.isLoading ? (
        <View style={styles.list}>
          {[1, 2, 3].map((i) => (
            <Card key={i} style={styles.orderCard}>
              <Skeleton width="50%" height={16} />
              <Skeleton width="30%" height={12} style={{ marginTop: 8 }} />
            </Card>
          ))}
        </View>
      ) : orders.length === 0 ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 40 }}>
          <Text style={{ fontSize: typography.fontSizes.lg, fontWeight: typography.fontWeights.semibold, color: colors.light.foreground, marginBottom: 8 }}>No orders</Text>
          <Text style={{ fontSize: typography.fontSizes.base, color: colors.light.muted, textAlign: "center" }}>No orders found.</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={renderOrder}
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
  tabs: { flexDirection: "row", paddingHorizontal: 24, gap: 4, marginBottom: 16, flexWrap: "wrap" },
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: radii.full },
  tabActive: { backgroundColor: colors.light.primary },
  tabText: { fontSize: typography.fontSizes.sm, color: colors.light.muted },
  tabTextActive: { color: "#fff", fontWeight: "600" },
  list: { padding: 24 },
  orderCard: { marginBottom: 16, padding: 24 },
  orderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  orderInfo: { flex: 1 },
  orderNumber: { fontSize: typography.fontSizes.base, fontWeight: typography.fontWeights.semibold, color: colors.light.foreground },
  orderDate: { fontSize: typography.fontSizes.sm, color: colors.light.muted, marginTop: 4 },
  orderRight: { alignItems: "flex-end", gap: 4 },
  orderTotal: { fontSize: typography.fontSizes.base, fontWeight: typography.fontWeights.semibold, color: colors.light.primary },
});
