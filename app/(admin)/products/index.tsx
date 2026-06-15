import React, { useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, TextInput } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { getAdminProducts } from "@/lib/api";
import { Card, Badge, Skeleton } from "@/components/ui";
import { colors, typography, radii } from "@/lib/theme/tokens";

const STATUS_TABS = ["all", "active", "pending", "draft", "archived"];

export default function AdminProducts() {
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");

  const productsQuery = useQuery({
    queryKey: ["admin-products", status, search],
    queryFn: async () => {
      const res = await getAdminProducts({ status, search });
      return res.ok ? res.data : { products: [], total: 0 };
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
  productCard: { marginBottom: 16, padding: 24 },
  productRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  productInfo: { flex: 1 },
  productName: { fontSize: typography.fontSizes.base, fontWeight: typography.fontWeights.semibold, color: colors.light.foreground, marginBottom: 4 },
  productPrice: { fontSize: typography.fontSizes.base, color: colors.light.primary, marginBottom: 8 },
  productMeta: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  storeName: { fontSize: typography.fontSizes.sm, color: colors.light.muted },
  brandName: { fontSize: typography.fontSizes.sm, color: colors.light.primary },
  sales: { fontSize: typography.fontSizes.sm, color: colors.light.muted },
});
