import React, { useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, TextInput, Alert, TouchableOpacity } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
  getAdminProducts,
  approveProduct,
  setProductFeatured,
  setProductActive,
} from "@/lib/api";
import { Card, Badge, Skeleton } from "@/components/ui";
import { colors, typography, radii } from "@/lib/theme/tokens";

const STATUS_TABS = ["all", "active", "pending", "draft", "archived"];

export default function AdminProducts() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");

  const productsQuery = useQuery({
    queryKey: ["admin-products", status, search],
    queryFn: async () => {
      const res = await getAdminProducts({ status, search });
      return res.ok ? res.data : { products: [], total: 0 };
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (productId: string) => approveProduct(productId, "archived"),
    onSuccess: (res) => {
      if (!res.ok) Alert.alert("Action failed", res.error);
      else queryClient.invalidateQueries({ queryKey: ["admin-products"] });
    },
  });

  const featuredMutation = useMutation({
    mutationFn: ({ id, next }: { id: string; next: boolean }) => setProductFeatured(id, next),
    onSuccess: (res) => {
      if (!res.ok) Alert.alert("Action failed", res.error);
      else queryClient.invalidateQueries({ queryKey: ["admin-products"] });
    },
  });

  const activeMutation = useMutation({
    mutationFn: ({ id, next }: { id: string; next: boolean }) => setProductActive(id, next),
    onSuccess: (res) => {
      if (!res.ok) Alert.alert("Action failed", res.error);
      else queryClient.invalidateQueries({ queryKey: ["admin-products"] });
    },
  });

  const products = productsQuery.data?.products ?? [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Products</Text>
        <Text style={styles.count}>{productsQuery.data?.total ?? 0}</Text>
      </View>

      <TextInput
        style={styles.search}
        placeholder="Search products..."
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

      {productsQuery.isLoading ? (
        <View style={styles.list}>
          {[1, 2, 3].map((i) => (
            <Card key={i} style={styles.productCard}>
              <Skeleton width="70%" height={16} />
              <Skeleton width="30%" height={12} style={{ marginTop: 8 }} />
            </Card>
          ))}
        </View>
      ) : products.length === 0 ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 40 }}>
          <Text style={{ fontSize: typography.fontSizes.lg, fontWeight: typography.fontWeights.semibold, color: colors.light.foreground, marginBottom: 8 }}>No products</Text>
          <Text style={{ fontSize: typography.fontSizes.base, color: colors.light.muted, textAlign: "center" }}>No products found.</Text>
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push(`/(admin)/products/${item.id}` as any)}>
              <Card style={styles.productCard}>
              <View style={styles.productRow}>
                <View style={styles.productInfo}>
                  <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.productPrice}>LKR {item.price.toLocaleString()}</Text>
                  <View style={styles.productMeta}>
                    <Badge
                      variant={item.status === "active" ? "default" : item.status === "pending" ? "secondary" : "outline"}
                    >
                      {item.status}
                    </Badge>
                    {item.store && <Text style={styles.storeName}>{item.store.name}</Text>}
                    {item.brand && <Text style={styles.brandName}>{item.brand.name}</Text>}
                  </View>
                </View>
                <Text style={styles.sales}>{item.total_sales ?? 0} sales</Text>
              </View>
              {/* Admin actions: archive, toggle featured, toggle active.
                  Each action confirms before mutation to prevent fat-finger. */}
              <View style={styles.adminActions}>
                <TouchableOpacity
                  style={styles.adminBtn}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    Alert.alert("Archive", `Archive "${item.name}"?`, [
                      { text: "Cancel", style: "cancel" },
                      { text: "Archive", style: "destructive", onPress: () => archiveMutation.mutate(item.id) },
                    ]);
                  }}
                >
                  <Text style={styles.adminBtnText}>Archive</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.adminBtn, item.is_featured && styles.adminBtnActive]}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    featuredMutation.mutate({ id: item.id, next: !item.is_featured });
                  }}
                >
                  <Text style={[styles.adminBtnText, item.is_featured && styles.adminBtnTextActive]}>
                    {item.is_featured ? "★ Featured" : "Feature"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.adminBtn, item.is_active === false && styles.adminBtnMuted]}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    activeMutation.mutate({ id: item.id, next: item.is_active === false });
                  }}
                >
                  <Text style={styles.adminBtnText}>
                    {item.is_active === false ? "Activate" : "Deactivate"}
                  </Text>
                </TouchableOpacity>
              </View>
            </Card>
            </Pressable>
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
  productCard: { marginBottom: 16, padding: 24 },
  productRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  productInfo: { flex: 1 },
  productName: { fontSize: typography.fontSizes.base, fontWeight: typography.fontWeights.semibold, color: colors.light.foreground, marginBottom: 4 },
  productPrice: { fontSize: typography.fontSizes.base, color: colors.light.primary, marginBottom: 8 },
  productMeta: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  storeName: { fontSize: typography.fontSizes.sm, color: colors.light.muted },
  brandName: { fontSize: typography.fontSizes.sm, color: colors.light.primary },
  sales: { fontSize: typography.fontSizes.sm, color: colors.light.muted },
  adminActions: {
    flexDirection: "row",
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
  },
  adminBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.light.card,
  },
  adminBtnActive: { backgroundColor: colors.light.primary, borderColor: colors.light.primary },
  adminBtnMuted: { opacity: 0.6 },
  adminBtnText: {
    fontSize: typography.fontSizes.xs,
    color: colors.light.foreground,
    fontWeight: "500",
  },
  adminBtnTextActive: { color: colors.light.primaryForeground },
});
