import React, { useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, TextInput, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/supabase/auth";
import { getBrandByOwner, getBrandProducts, deleteSellerProduct } from "@/lib/api";
import { Card, Badge, Skeleton } from "@/components/ui";
import { colors, typography, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { useDebounce } from "@/lib/hooks/useDebounce";

const STATUS_TABS = ["all", "active", "pending", "draft", "archived"];

export default function BrandProducts() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 350);

  const brandQuery = useQuery({
    queryKey: ["brand-owner", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const res = await getBrandByOwner(user.id);
      return res.ok ? res.data : null;
    },
    enabled: !!user,
  });

  const productsQuery = useQuery({
    queryKey: ["brand-products", brandQuery.data?.id, status, debouncedSearch],
    queryFn: async () => {
      if (!brandQuery.data) return { products: [], total: 0 };
      const res = await getBrandProducts(brandQuery.data.id, { status, search: debouncedSearch });
      return res.ok ? res.data : { products: [], total: 0 };
    },
    enabled: !!brandQuery.data,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSellerProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brand-products"] });
    },
  });

  const products = productsQuery.data?.products ?? [];

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.title}>Products</Text>
        <Text style={styles.count}>{productsQuery.data?.total ?? 0} total</Text>
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
              <Skeleton width="100%" height={16} />
              <Skeleton width={80} height={14} style={{ marginTop: 8 }} />
            </Card>
          ))}
        </View>
      ) : products.length === 0 ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 40 }}>
          <Text style={{ fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.lg, color: colors.light.foreground, marginBottom: 8 }}>No products</Text>
          <Text style={{ fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.base, color: colors.light.muted, textAlign: "center" }}>No products found for this brand.</Text>
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
                    {item.store && (
                      <Text style={styles.storeName}>{item.store.name}</Text>
                    )}
                  </View>
                </View>
                <Pressable
                  style={styles.deleteBtn}
                  onPress={() => {
                    Alert.alert("Delete", `Delete "${item.name}"?`, [
                      { text: "Cancel", style: "cancel" },
                      { text: "Delete", style: "destructive", onPress: () => deleteMutation.mutate(item.id) },
                    ]);
                  }}
                >
                  <Text style={styles.deleteText}>Delete</Text>
                </Pressable>
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
  title: { fontFamily: fontFamilies.display.semibold, fontSize: typography.fontSizes["2xl"], color: colors.light.foreground },
  count: { fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.sm, color: colors.light.muted },
  search: { margin: 24, marginBottom: 16, padding: 16, backgroundColor: colors.light.card, borderRadius: radii.md, borderWidth: 1, borderColor: colors.light.border, fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.base, color: colors.light.foreground },
  tabs: { flexDirection: "row", paddingHorizontal: 24, gap: 4, marginBottom: 16 },
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: radii.full },
  tabActive: { backgroundColor: colors.light.primary },
  tabText: { fontFamily: fontFamilies.sans.medium, fontSize: typography.fontSizes.sm, color: colors.light.muted },
  tabTextActive: { fontFamily: fontFamilies.sans.semibold, color: "#fff" },
  list: { padding: 24 },
  productCard: { marginBottom: 16, padding: 24 },
  productRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  productInfo: { flex: 1 },
  productName: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.base, color: colors.light.foreground, marginBottom: 4 },
  productPrice: { fontFamily: fontFamilies.mono.medium, fontSize: typography.fontSizes.base, color: colors.light.primary, marginBottom: 8 },
  productMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  storeName: { fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.sm, color: colors.light.muted },
  deleteBtn: { paddingHorizontal: 16, paddingVertical: 8 },
  deleteText: { fontFamily: fontFamilies.sans.medium, fontSize: typography.fontSizes.sm, color: colors.light.destructive },
});
