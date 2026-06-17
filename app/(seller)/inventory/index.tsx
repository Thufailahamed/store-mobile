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
import { useAuth } from "@/lib/supabase/auth";
import { getSellerStore, getSellerInventory, updateVariantStock } from "@/lib/api";
import { colors, typography, radii } from "@/lib/theme/tokens";
import type { Product, ProductVariant } from "@/lib/types";

const LOW_STOCK_THRESHOLD = 5;

interface InventoryRow {
  productId: string;
  productName: string;
  variantId: string;
  sku: string;
  size?: string;
  color?: string;
  onHand: number;
  reserved: number;
  available: number;
  price: number;
  image?: string;
}

function formatPrice(n: number) {
  return `Rs. ${n.toLocaleString("en-LK")}`;
}

export default function SellerInventory() {
  const { user } = useAuth();
  const [storeId, setStoreId] = useState<string | null>(null);
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "low" | "out" | "healthy">("all");
  const [editing, setEditing] = useState<string | null>(null);
  const [draftStock, setDraftStock] = useState("0");
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) return;
    if (!storeId) {
      const storeRes = await getSellerStore(user.id);
      if (storeRes.ok && storeRes.data) {
        setStoreId(storeRes.data.id);
        const res = await getSellerInventory(storeRes.data.id);
        if (res.ok) flattenRows(res.data);
      }
    } else {
      const res = await getSellerInventory(storeId);
      if (res.ok) flattenRows(res.data);
    }
    setLoading(false);
    setRefreshing(false);
  }, [user, storeId]);

  const flattenRows = (data: {
    product: Product;
    variants: (ProductVariant & {
      quantity: number;
      reserved: number;
      available: number;
      stock: number;
    })[];
  }[]) => {
    const all: InventoryRow[] = [];
    for (const item of data) {
      for (const v of item.variants) {
        all.push({
          productId: item.product.id,
          productName: item.product.name,
          variantId: v.id,
          sku: v.sku ?? item.product.sku ?? `${item.product.slug}-${v.size}-${v.color}`,
          size: v.size ?? undefined,
          color: v.color ?? undefined,
          onHand: v.quantity ?? v.stock ?? 0,
          reserved: v.reserved ?? 0,
          available: v.available ?? Math.max(0, (v.quantity ?? v.stock ?? 0) - (v.reserved ?? 0)),
          price: v.price ?? item.product.price,
          image: item.product.images?.[0]?.url,
        });
      }
    }
    setRows(all);
  };

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const filtered = rows.filter((r) => {
    const matchSearch = !search ||
      r.productName.toLowerCase().includes(search.toLowerCase()) ||
      r.sku.toLowerCase().includes(search.toLowerCase());
    if (filter === "low") return matchSearch && r.available > 0 && r.available < LOW_STOCK_THRESHOLD;
    if (filter === "out") return matchSearch && r.available === 0;
    if (filter === "healthy") return matchSearch && r.available >= LOW_STOCK_THRESHOLD;
    return matchSearch;
  });

  const stats = {
    total: rows.length,
    healthy: rows.filter((r) => r.available >= LOW_STOCK_THRESHOLD).length,
    low: rows.filter((r) => r.available > 0 && r.available < LOW_STOCK_THRESHOLD).length,
    out: rows.filter((r) => r.available === 0).length,
  };

  const handleSaveStock = async (row: InventoryRow) => {
    const newStock = Math.max(0, Number(draftStock) || 0);
    if (newStock < row.reserved) {
      const available = Math.max(0, newStock - row.reserved);
      Alert.alert(
        "Held stock exceeds on-hand",
        `${row.reserved} units are held in carts. Setting on-hand to ${newStock} makes ${available} available to shoppers.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Save anyway", onPress: () => void saveStock(row, newStock) },
        ],
      );
      return;
    }
    await saveStock(row, newStock);
  };

  const saveStock = async (row: InventoryRow, newStock: number) => {
    setSaving(true);
    const res = await updateVariantStock(row.variantId, newStock);
    setSaving(false);
    if (res.ok) {
      setRows((prev) =>
        prev.map((r) =>
          r.variantId === row.variantId
            ? {
                ...r,
                onHand: newStock,
                available: Math.max(0, newStock - r.reserved),
              }
            : r
        )
      );
      setEditing(null);
    } else {
      Alert.alert("Error", res.error);
    }
  };

  const renderRow = ({ item }: { item: InventoryRow }) => {
    const isEditing = editing === item.variantId;
    const stockStatus =
      item.available === 0 ? "out" : item.available < LOW_STOCK_THRESHOLD ? "low" : "healthy";

    return (
      <View style={[styles.tableRow, stockStatus === "out" && styles.rowOut, stockStatus === "low" && styles.rowLow]}>
        <View style={styles.tableCellImage}>
          {item.image ? (
            <Image source={{ uri: item.image }} style={styles.cellImage} />
          ) : (
            <View style={[styles.cellImage, styles.cellImagePlaceholder]}>
              <Text>📦</Text>
            </View>
          )}
        </View>
        <View style={styles.tableCellInfo}>
          <Text style={styles.cellProduct} numberOfLines={1}>{item.productName}</Text>
          <Text style={styles.cellSku}>{item.sku}</Text>
          <Text style={styles.cellVariant}>
            {[item.size, item.color].filter(Boolean).join(" · ") || "—"}
          </Text>
        </View>
        <View style={styles.tableCellStock}>
          {isEditing ? (
            <View style={styles.editRow}>
              <TextInput
                style={styles.editInput}
                value={draftStock}
                onChangeText={setDraftStock}
                keyboardType="numeric"
                autoFocus
                onSubmitEditing={() => handleSaveStock(item)}
              />
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={() => handleSaveStock(item)}
                disabled={saving}
              >
                <Text style={styles.saveBtnText}>✓</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditing(null)}>
                <Text style={styles.cancelBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.stockStack}>
              <Text style={[styles.cellStock, stockStatus === "out" && styles.stockOut, stockStatus === "low" && styles.stockLow]}>
                {item.onHand}
              </Text>
              {item.reserved > 0 && (
                <Text style={styles.cellHeld}>{item.reserved} held</Text>
              )}
              <Text style={styles.cellAvail}>{item.available} avail</Text>
            </View>
          )}
        </View>
        <View style={styles.tableCellStatus}>
          {stockStatus === "out" ? (
            <View style={[styles.badge, styles.badgeOut]}>
              <Text style={[styles.badgeText, styles.badgeTextOut]}>Out</Text>
            </View>
          ) : stockStatus === "low" ? (
            <View style={[styles.badge, styles.badgeLow]}>
              <Text style={[styles.badgeText, styles.badgeTextLow]}>Low</Text>
            </View>
          ) : (
            <View style={[styles.badge, styles.badgeHealthy]}>
              <Text style={[styles.badgeText, styles.badgeTextHealthy]}>OK</Text>
            </View>
          )}
        </View>
        <View style={styles.tableCellAction}>
          {!isEditing && (
            <TouchableOpacity onPress={() => { setEditing(item.variantId); setDraftStock(String(item.onHand)); }}>
              <Text style={styles.editBtn}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Inventory</Text>
        <Text style={styles.count}>{rows.length} variants</Text>
      </View>

      {/* KPI Cards */}
      <View style={styles.kpiRow}>
        <View style={[styles.kpiCard, { backgroundColor: "#f3f4f6" }]}>
          <Text style={styles.kpiValue}>{stats.total}</Text>
          <Text style={styles.kpiLabel}>Total</Text>
        </View>
        <View style={[styles.kpiCard, { backgroundColor: "#dcfce7" }]}>
          <Text style={[styles.kpiValue, { color: "#166534" }]}>{stats.healthy}</Text>
          <Text style={styles.kpiLabel}>Healthy</Text>
        </View>
        <View style={[styles.kpiCard, { backgroundColor: "#fef9c3" }]}>
          <Text style={[styles.kpiValue, { color: "#854d0e" }]}>{stats.low}</Text>
          <Text style={styles.kpiLabel}>Low</Text>
        </View>
        <View style={[styles.kpiCard, { backgroundColor: "#fce7f3" }]}>
          <Text style={[styles.kpiValue, { color: "#9d174d" }]}>{stats.out}</Text>
          <Text style={styles.kpiLabel}>Out</Text>
        </View>
      </View>

      {/* Search + Filter */}
      <View style={styles.filterRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search SKU or product..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor={colors.light.mutedForeground}
        />
      </View>
      <View style={styles.filterTabs}>
        {(["all", "healthy", "low", "out"] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterTabText, filter === f && styles.filterTabTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Table Header */}
      <View style={styles.tableHeader}>
        <Text style={[styles.tableHeaderText, { width: 44 }]}> </Text>
        <Text style={[styles.tableHeaderText, { flex: 1 }]}>Product</Text>
        <Text style={[styles.tableHeaderText, { width: 72 }]}>Stock</Text>
        <Text style={[styles.tableHeaderText, { width: 50 }]}>Status</Text>
        <Text style={[styles.tableHeaderText, { width: 44 }]}> </Text>
      </View>

      {/* Table */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.variantId}
        renderItem={renderRow}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.light.primary} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyTitle}>No variants found</Text>
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
  count: { fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground },

  kpiRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  kpiCard: {
    flex: 1,
    padding: 12,
    borderRadius: radii.lg,
    alignItems: "center",
  },
  kpiValue: {
    fontSize: 24,
    fontWeight: typography.fontWeights.bold as any,
    color: colors.light.foreground,
  },
  kpiLabel: {
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    marginTop: 2,
  },

  filterRow: { paddingHorizontal: 16, marginBottom: 8 },
  searchInput: {
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.lg,
    padding: 12,
    fontSize: typography.fontSizes.sm,
    color: colors.light.foreground,
  },
  filterTabs: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  filterTab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  filterTabActive: {
    backgroundColor: colors.light.primary,
    borderColor: colors.light.primary,
  },
  filterTabText: {
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    fontWeight: typography.fontWeights.medium as any,
  },
  filterTabTextActive: { color: colors.light.card },

  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.light.muted,
  },
  tableHeaderText: {
    fontSize: 10,
    fontWeight: typography.fontWeights.semibold as any,
    color: colors.light.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  listContent: { paddingHorizontal: 16 },

  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  rowOut: { backgroundColor: "#fef2f2" },
  rowLow: { backgroundColor: "#fffbeb" },

  tableCellImage: { width: 44, marginRight: 8 },
  cellImage: { width: 36, height: 36, borderRadius: radii.md },
  cellImagePlaceholder: {
    backgroundColor: colors.light.muted,
    justifyContent: "center",
    alignItems: "center",
  },
  tableCellInfo: { flex: 1, marginRight: 8 },
  cellProduct: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.medium as any,
    color: colors.light.foreground,
  },
  cellSku: {
    fontSize: 10,
    color: colors.light.mutedForeground,
    fontFamily: "monospace",
  },
  cellVariant: {
    fontSize: 10,
    color: colors.light.mutedForeground,
    textTransform: "capitalize",
  },
  tableCellStock: { width: 72, alignItems: "flex-end" },
  stockStack: { alignItems: "flex-end" },
  cellStock: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.bold as any,
    color: colors.light.foreground,
  },
  cellHeld: {
    fontSize: 9,
    color: "#7c3aed",
    marginTop: 1,
  },
  cellAvail: {
    fontSize: 9,
    color: colors.light.mutedForeground,
    marginTop: 1,
  },
  stockOut: { color: "#dc2626" },
  stockLow: { color: "#d97706" },

  editRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  editInput: {
    width: 44,
    height: 28,
    borderWidth: 1,
    borderColor: colors.light.primary,
    borderRadius: radii.sm,
    textAlign: "center",
    fontSize: typography.fontSizes.sm,
    color: colors.light.foreground,
    padding: 0,
  },
  saveBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#10b981",
    justifyContent: "center",
    alignItems: "center",
  },
  saveBtnText: { color: "#fff", fontSize: 12, fontWeight: "bold" },
  cancelBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.light.muted,
    justifyContent: "center",
    alignItems: "center",
  },
  cancelBtnText: { color: colors.light.mutedForeground, fontSize: 12 },

  tableCellStatus: { width: 50, alignItems: "center" },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  badgeOut: { backgroundColor: "#fce7f3" },
  badgeLow: { backgroundColor: "#fef9c3" },
  badgeHealthy: { backgroundColor: "#dcfce7" },
  badgeText: { fontSize: 10, fontWeight: typography.fontWeights.semibold as any },
  badgeTextOut: { color: "#9d174d" },
  badgeTextLow: { color: "#854d0e" },
  badgeTextHealthy: { color: "#166534" },

  tableCellAction: { width: 44, alignItems: "flex-end" },
  editBtn: {
    fontSize: typography.fontSizes.xs,
    color: colors.light.primary,
    fontWeight: typography.fontWeights.medium as any,
  },

  emptyContainer: { alignItems: "center", paddingVertical: 48 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: {
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
    marginTop: 12,
  },
});
