import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Image,
  RefreshControl,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/supabase/auth";
import { getSellerStore, getSellerProducts, deleteSellerProduct } from "@/lib/api";
import { colors, typography, radii } from "@/lib/theme/tokens";
import type { Product } from "@/lib/types";

const STATUS_TABS = ["all", "active", "draft", "pending", "archived"] as const;

function formatPrice(n: number) {
  return `Rs. ${n.toLocaleString("en-LK")}`;
}

export default function SellerProducts() {
  const router = useRouter();
  const { user } = useAuth();
  const [storeId, setStoreId] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    if (!storeId) {
      if (!user) return;
      const storeRes = await getSellerStore(user.id);
      if (storeRes.ok && storeRes.data) {
        setStoreId(storeRes.data.id);
        const res = await getSellerProducts(storeRes.data.id, { status, search });
        if (res.ok) setProducts(res.data.products);
      }
    } else {
      const res = await getSellerProducts(storeId, { status, search });
      if (res.ok) setProducts(res.data.products);
    }
    setLoading(false);
    setRefreshing(false);
  }, [user, storeId, status, search]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchProducts();
  }, [fetchProducts]);

  const handleDelete = (product: Product) => {
    Alert.alert(
      "Delete product?",
      `Are you sure you want to delete "${product.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setBusyId(product.id);
            const res = await deleteSellerProduct(product.id);
            setBusyId(null);
            if (res.ok) {
              setProducts((prev) => prev.filter((p) => p.id !== product.id));
            }
          },
        },
      ]
    );
  };

  const renderProduct = ({ item }: { item: Product }) => {
    const stock = item.variants?.reduce((s, v) => s + (v.stock ?? 0), 0) ?? 0;
    return (
      <View style={styles.productCard}>
        <TouchableOpacity
          style={styles.productCardMain}
          onPress={() => router.push(`/(seller)/products/${item.id}` as any)}
        >
        {item.images?.[0]?.url ? (
          <Image source={{ uri: item.images[0].url }} style={styles.productImage} />
        ) : (
          <View style={[styles.productImage, styles.productImagePlaceholder]}>
            <Text style={{ color: colors.light.mutedForeground }}>📦</Text>
          </View>
        )}
        <View style={styles.productInfo}>
          <View style={styles.productHeader}>
            <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
            <View style={[styles.statusBadge, item.status === "active" ? styles.statusActive : item.status === "draft" ? styles.statusDraft : styles.statusPending]}>
              <Text style={[styles.statusText, item.status === "active" ? styles.statusTextActive : item.status === "draft" ? styles.statusTextDraft : styles.statusTextPending]}>
                {item.status}
              </Text>
            </View>
          </View>
          <Text style={styles.productSku}>{item.sku ?? "No SKU"}</Text>
          <View style={styles.productFooter}>
            <Text style={styles.productPrice}>{formatPrice(item.price)}</Text>
            <Text style={[styles.productStock, stock === 0 && styles.stockOut, stock > 0 && stock < 10 && styles.stockLow]}>
              {stock} in stock
            </Text>
          </View>
        </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteIconBtn}
          onPress={() => handleDelete(item)}
          disabled={busyId === item.id}
        >
          <Text style={styles.deleteIconText}>{busyId === item.id ? "…" : "🗑"}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Products</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push("/(seller)/products/new" as any)}
        >
          <Text style={styles.addButtonText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search products..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor={colors.light.mutedForeground}
        />
      </View>

      {/* Status Tabs */}
      <View style={styles.tabsContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={STATUS_TABS}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.tab, status === item && styles.tabActive]}
              onPress={() => setStatus(item)}
            >
              <Text style={[styles.tabText, status === item && styles.tabTextActive]}>
                {item.charAt(0).toUpperCase() + item.slice(1)}
              </Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.tabsContent}
        />
      </View>

      {/* Products List */}
      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        renderItem={renderProduct}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.light.primary} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyTitle}>
              {search ? "No matches" : "No products yet"}
            </Text>
            <Text style={styles.emptySub}>
              {search ? "Try a different search" : "Add your first product to start selling"}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.bold as any,
    color: colors.light.foreground,
  },
  addButton: {
    backgroundColor: colors.light.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radii.full,
  },
  addButtonText: {
    color: colors.light.card,
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold as any,
  },

  searchContainer: { paddingHorizontal: 16, marginBottom: 8 },
  searchInput: {
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.lg,
    padding: 12,
    fontSize: typography.fontSizes.sm,
    color: colors.light.foreground,
  },

  tabsContainer: { marginBottom: 8 },
  tabsContent: { paddingHorizontal: 16, gap: 8 },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radii.full,
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  tabActive: {
    backgroundColor: colors.light.primary,
    borderColor: colors.light.primary,
  },
  tabText: {
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
    fontWeight: typography.fontWeights.medium as any,
  },
  tabTextActive: { color: colors.light.card },

  listContent: { padding: 16, paddingTop: 8 },

  productCard: {
    flexDirection: "row",
    backgroundColor: colors.light.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.light.border,
    marginBottom: 10,
    overflow: "hidden",
    alignItems: "stretch",
  },
  productCardMain: {
    flex: 1,
    flexDirection: "row",
  },
  deleteIconBtn: {
    width: 44,
    alignItems: "center",
    justifyContent: "center",
    borderLeftWidth: 1,
    borderLeftColor: colors.light.border,
    backgroundColor: colors.light.muted,
  },
  deleteIconText: { fontSize: 16 },
  productImage: { width: 90, height: 90 },
  productImagePlaceholder: {
    backgroundColor: colors.light.muted,
    justifyContent: "center",
    alignItems: "center",
  },
  productInfo: { flex: 1, padding: 12, justifyContent: "center" },
  productHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  productName: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold as any,
    color: colors.light.foreground,
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  statusActive: { backgroundColor: "#dcfce7" },
  statusDraft: { backgroundColor: "#f3f4f6" },
  statusPending: { backgroundColor: "#fef9c3" },
  statusText: { fontSize: 10, fontWeight: typography.fontWeights.semibold as any, textTransform: "capitalize" },
  statusTextActive: { color: "#166534" },
  statusTextDraft: { color: "#6b7280" },
  statusTextPending: { color: "#854d0e" },

  productSku: {
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    fontFamily: "monospace",
    marginTop: 2,
  },
  productFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
  },
  productPrice: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.bold as any,
    color: colors.light.foreground,
  },
  productStock: {
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
  },
  stockOut: { color: "#dc2626", fontWeight: typography.fontWeights.semibold as any },
  stockLow: { color: "#d97706", fontWeight: typography.fontWeights.semibold as any },

  emptyContainer: { alignItems: "center", paddingVertical: 48 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: {
    fontSize: typography.fontSizes.base,
    fontWeight: typography.fontWeights.semibold as any,
    color: colors.light.foreground,
    marginTop: 12,
  },
  emptySub: {
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
    marginTop: 4,
  },
});
