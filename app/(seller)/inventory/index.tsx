import React, { useEffect, useState, useCallback, useMemo } from "react";
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
  Share,
} from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/supabase/auth";
import {
  getSellerStore,
  getSellerInventory,
  updateVariantStock,
  type Result,
} from "@/lib/api";
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
  try {
    return `Rs. ${Number(n ?? 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  } catch {
    return `Rs. ${n}`;
  }
}

function toCSV(rows: InventoryRow[]): string {
  const header = ["SKU", "Product", "Size", "Color", "On hand", "Reserved", "Available", "Price", "Value"];
  const escape = (s: string | number | undefined) => {
    if (s == null) return "";
    const str = String(s);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        escape(r.sku),
        escape(r.productName),
        escape(r.size),
        escape(r.color),
        r.onHand,
        r.reserved,
        r.available,
        r.price,
        r.onHand * r.price,
      ].join(","),
    );
  }
  return lines.join("\n");
}

export default function SellerInventory() {
  const router = useRouter();
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

  // Bulk edit mode
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStock, setBulkStock] = useState("0");
  const [bulkBusy, setBulkBusy] = useState(false);

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

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((r) => {
      const matchSearch = !q ||
        r.productName.toLowerCase().includes(q) ||
        r.sku.toLowerCase().includes(q) ||
        (r.size ?? "").toLowerCase().includes(q) ||
        (r.color ?? "").toLowerCase().includes(q);
      if (filter === "low") return matchSearch && r.available > 0 && r.available < LOW_STOCK_THRESHOLD;
      if (filter === "out") return matchSearch && r.available === 0;
      if (filter === "healthy") return matchSearch && r.available >= LOW_STOCK_THRESHOLD;
      return matchSearch;
    });
  }, [rows, search, filter]);

  const stats = useMemo(() => ({
    total: rows.length,
    healthy: rows.filter((r) => r.available >= LOW_STOCK_THRESHOLD).length,
    low: rows.filter((r) => r.available > 0 && r.available < LOW_STOCK_THRESHOLD).length,
    out: rows.filter((r) => r.available === 0).length,
  }), [rows]);

  const totalValue = useMemo(
    () => filtered.reduce((sum, r) => sum + r.onHand * r.price, 0),
    [filtered],
  );

  // Top 5 at-risk variants by available stock, asc. Drives the "Lowest stock" panel.
  const lowestRows = useMemo(
    () =>
      rows
        .filter((r) => r.available < LOW_STOCK_THRESHOLD)
        .slice()
        .sort((a, b) => a.available - b.available)
        .slice(0, 5),
    [rows],
  );

  // Cash value of the at-risk stock — Rs. X on hand across the low subset.
  const lowStockValue = useMemo(
    () =>
      rows
        .filter((r) => r.available > 0 && r.available < LOW_STOCK_THRESHOLD)
        .reduce((s, r) => s + r.available * r.price, 0),
    [rows],
  );

  // Shared reserved-stock safety check. Any target whose new stock would drop
  // below its held/reserved quantity is a "breach" — warn before proceeding
  // instead of silently letting the change break an in-progress cart.
  const confirmReservedStock = (
    targets: InventoryRow[],
    newStock: number,
    onConfirm: () => void,
  ) => {
    const breaches = targets.filter((r) => newStock < r.reserved);
    if (breaches.length === 0) {
      onConfirm();
      return;
    }
    if (breaches.length === 1) {
      const row = breaches[0];
      const available = Math.max(0, newStock - row.reserved);
      Alert.alert(
        "Held stock exceeds on-hand",
        `${row.reserved} units are held in carts. Setting on-hand to ${newStock} makes ${available} available to shoppers.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Save anyway", onPress: onConfirm },
        ],
      );
      return;
    }
    const totalReserved = breaches.reduce((sum, r) => sum + r.reserved, 0);
    const preview = breaches
      .slice(0, 5)
      .map((r) => `${r.sku} (${r.reserved} held)`)
      .join("\n");
    const more = breaches.length > 5 ? `\n…and ${breaches.length - 5} more` : "";
    Alert.alert(
      "Held stock exceeds on-hand",
      `${breaches.length} of the selected variants have ${totalReserved} unit(s) held in carts. Setting on-hand to ${newStock} will make some or all of those carts break:\n\n${preview}${more}`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Apply anyway", onPress: onConfirm },
      ],
    );
  };

  const handleSaveStock = async (row: InventoryRow) => {
    const newStock = Math.max(0, Number(draftStock) || 0);
    confirmReservedStock([row], newStock, () => void saveStock(row, newStock));
  };

  const saveStock = async (row: InventoryRow, newStock: number) => {
    setSaving(true);
    const res = await updateVariantStock(row.productId, row.variantId, newStock);
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

  const exitSelect = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const bulkApply = () => {
    if (selectedIds.size === 0) return;
    const newStock = Math.max(0, Number(bulkStock) || 0);
    const targets = rows.filter((r) => selectedIds.has(r.variantId));
    confirmReservedStock(targets, newStock, () => void performBulkApply(targets, newStock));
  };

  const performBulkApply = async (targets: InventoryRow[], newStock: number) => {
    const ids = new Set(targets.map((r) => r.variantId));
    setBulkBusy(true);
    const results = await Promise.allSettled(
      targets.map((r) => updateVariantStock(r.productId, r.variantId, newStock) as Promise<Result<void>>),
    );
    setBulkBusy(false);
    const failed = results.filter(
      (r) => r.status === "rejected" || (r.status === "fulfilled" && !r.value.ok),
    );
    if (failed.length === 0) {
      Alert.alert("Done", `${targets.length} variant(s) updated to ${newStock}.`);
      setRows((prev) =>
        prev.map((r) =>
          ids.has(r.variantId)
            ? { ...r, onHand: newStock, available: Math.max(0, newStock - r.reserved) }
            : r
        )
      );
      exitSelect();
    } else {
      Alert.alert(
        "Partial",
        `${targets.length - failed.length} updated, ${failed.length} failed.`,
        [{ text: "OK", onPress: () => onRefresh() }],
      );
    }
  };

  const exportCSV = async () => {
    if (filtered.length === 0) {
      Alert.alert("Nothing to export", "No rows match the current filters.");
      return;
    }
    const csv = toCSV(filtered);
    try {
      await Share.share({
        message: csv,
        title: `inventory-${new Date().toISOString().slice(0, 10)}.csv`,
      });
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not share");
    }
  };

  const renderRow = ({ item }: { item: InventoryRow }) => {
    const isEditing = editing === item.variantId;
    const stockStatus =
      item.available === 0 ? "out" : item.available < LOW_STOCK_THRESHOLD ? "low" : "healthy";
    const selected = selectedIds.has(item.variantId);

    return (
      <View style={[styles.tableRow, selected && styles.rowSelected, stockStatus === "out" && styles.rowOut, stockStatus === "low" && styles.rowLow]}>
        {selectMode && (
          <TouchableOpacity
            style={styles.checkbox}
            onPress={() => toggleSelect(item.variantId)}
            hitSlop={6}
          >
            <Ionicons
              name={selected ? "checkbox" : "square-outline"}
              size={20}
              color={selected ? colors.light.primary : colors.light.mutedForeground}
            />
          </TouchableOpacity>
        )}
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
        <View style={styles.tableCellPrice}>
          <Text style={styles.cellPrice}>{formatPrice(item.price)}</Text>
          <Text style={styles.cellValue}>{formatPrice(item.onHand * item.price)}</Text>
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
        {!selectMode && (
          <View style={styles.tableCellAction}>
            <TouchableOpacity
              onPress={() => { setEditing(item.variantId); setDraftStock(String(item.onHand)); }}
              hitSlop={6}
            >
              <Text style={styles.editBtn}>Edit</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Inventory</Text>
          <Text style={styles.count}>
            {filtered.length} of {rows.length} variants · {formatPrice(totalValue)} value
          </Text>
        </View>
        <View style={styles.headerActions}>
          {selectMode ? (
            <TouchableOpacity style={styles.cancelBtn} onPress={exitSelect}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                style={styles.headerBtn}
                onPress={() => setSelectMode(true)}
                disabled={filtered.length === 0}
              >
                <Ionicons name="checkmark-circle-outline" size={16} color={colors.light.foreground} />
                <Text style={styles.headerBtnText}>Select</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerBtn}
                onPress={exportCSV}
                disabled={filtered.length === 0}
              >
                <Ionicons name="share-outline" size={16} color={colors.light.foreground} />
                <Text style={styles.headerBtnText}>CSV</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
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

      {/* Low-stock alert banner — only shown when at least one variant is at risk. */}
      {stats.low > 0 ? (
        <View style={styles.lowStockBanner}>
          <View style={styles.lowStockIcon}>
            <Ionicons name="alert-circle" size={18} color="#b45309" />
          </View>
          <View style={styles.lowStockText}>
            <Text style={styles.lowStockTitle}>
              {stats.low} variant{stats.low === 1 ? "" : "s"} running low
            </Text>
            <Text style={styles.lowStockSub}>
              Below the {LOW_STOCK_THRESHOLD}-unit threshold · {formatPrice(lowStockValue)} of stock on hand
            </Text>
          </View>
          <TouchableOpacity
            style={styles.lowStockCta}
            onPress={() => setFilter("low")}
            hitSlop={6}
          >
            <Text style={styles.lowStockCtaText}>Review</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Lowest-stock visual map — top 5 at-risk variants sorted by available stock asc. */}
      {lowestRows.length > 0 ? (
        <View style={styles.lowStockPanel}>
          <View style={styles.lowStockPanelHeader}>
            <View style={styles.lowStockPanelTitleRow}>
              <Ionicons name="trending-down" size={14} color="#b45309" />
              <Text style={styles.lowStockPanelTitle}>At risk · Lowest stock first</Text>
            </View>
            <Text style={styles.lowStockPanelHint}>Tap to restock</Text>
          </View>
          {lowestRows.map((r) => {
            const pct = Math.max(2, Math.min(100, Math.round((r.available / LOW_STOCK_THRESHOLD) * 100)));
            // Red < 30%, amber < 70%, green otherwise.
            const tone =
              r.available === 0
                ? { bar: "#dc2626", label: "Out" }
                : r.available < 2
                  ? { bar: "#dc2626", label: "Critical" }
                  : r.available < 4
                    ? { bar: "#f59e0b", label: "Low" }
                    : { bar: "#10b981", label: "Close" };
            return (
              <TouchableOpacity
                key={r.variantId}
                style={styles.lowStockRow}
                onPress={() => {
                  // Jump straight into stock-edit mode for this variant.
                  setEditing(r.variantId);
                  setDraftStock(String(r.onHand));
                }}
                activeOpacity={0.8}
              >
                {r.image ? (
                  <Image source={{ uri: r.image }} style={styles.lowStockImage} />
                ) : (
                  <View style={[styles.lowStockImage, styles.cellImagePlaceholder]}>
                    <Text style={{ fontSize: 16 }}>📦</Text>
                  </View>
                )}
                <View style={styles.lowStockInfo}>
                  <Text style={styles.lowStockName} numberOfLines={1}>{r.productName}</Text>
                  <View style={styles.lowStockVariantRow}>
                    <Text style={styles.lowStockVariant} numberOfLines={1}>
                      {[r.size, r.color].filter(Boolean).join(" · ") || "—"}
                    </Text>
                    <View style={[styles.lowStockTonePill, { backgroundColor: tone.bar + "20" }]}>
                      <View style={[styles.lowStockToneDot, { backgroundColor: tone.bar }]} />
                      <Text style={[styles.lowStockToneText, { color: tone.bar }]}>{tone.label}</Text>
                    </View>
                  </View>
                  <View style={styles.lowStockBarTrack}>
                    <View style={[styles.lowStockBarFill, { width: `${pct}%`, backgroundColor: tone.bar }]} />
                  </View>
                </View>
                <View style={styles.lowStockNumbers}>
                  <Text style={styles.lowStockCount}>{r.available}</Text>
                  <Text style={styles.lowStockCountSub}>avail</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      {/* Search + Filter */}
      <View style={styles.filterRow}>
        <View style={styles.searchInputWrap}>
          <Ionicons name="search" size={16} color={colors.light.mutedForeground} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search SKU, product, size, color..."
            value={search}
            onChangeText={setSearch}
            placeholderTextColor={colors.light.mutedForeground}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")} hitSlop={6}>
              <Ionicons name="close-circle" size={16} color={colors.light.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
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
        {selectMode && (
          <View style={{ width: 36, alignItems: "center" }}>
            <TouchableOpacity onPress={() => {
              const allVisible = filtered.every((r) => selectedIds.has(r.variantId));
              setSelectedIds(allVisible ? new Set() : new Set(filtered.map((r) => r.variantId)));
            }} hitSlop={6}>
              <Ionicons
                name={filtered.every((r) => selectedIds.has(r.variantId)) && filtered.length > 0 ? "checkbox" : "square-outline"}
                size={18}
                color={colors.light.mutedForeground}
              />
            </TouchableOpacity>
          </View>
        )}
        <Text style={[styles.tableHeaderText, { width: 44 }]}> </Text>
        <Text style={[styles.tableHeaderText, { flex: 1 }]}>Product</Text>
        <Text style={[styles.tableHeaderText, { width: 70, textAlign: "right" }]}>Price / Val</Text>
        <Text style={[styles.tableHeaderText, { width: 72, textAlign: "right" }]}>Stock</Text>
        <Text style={[styles.tableHeaderText, { width: 44, textAlign: "center" }]}>Stat</Text>
        {!selectMode && <Text style={[styles.tableHeaderText, { width: 38 }]}> </Text>}
      </View>

      {/* Table */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.variantId}
        renderItem={renderRow}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.light.primary} />}
        contentContainerStyle={[styles.listContent, selectMode && { paddingBottom: 96 }]}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyTitle}>No variants found</Text>
            </View>
          ) : null
        }
      />

      {/* Bulk action bar */}
      {selectMode && (
        <View style={styles.bulkBar}>
          <View style={styles.bulkInfo}>
            <Text style={styles.bulkCount}>{selectedIds.size} selected</Text>
          </View>
          <View style={styles.bulkControls}>
            <Text style={styles.bulkLabel}>Set stock</Text>
            <TextInput
              style={styles.bulkInput}
              value={bulkStock}
              onChangeText={setBulkStock}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor="rgba(255,255,255,0.5)"
            />
            <TouchableOpacity
              style={[styles.bulkApplyBtn, bulkBusy && styles.bulkApplyBtnBusy]}
              onPress={bulkApply}
              disabled={bulkBusy || selectedIds.size === 0}
            >
              <Text style={styles.bulkApplyText}>{bulkBusy ? "…" : "Apply"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
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
  headerActions: { flexDirection: "row", alignItems: "center", gap: 6 },
  title: {
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.bold as any,
    color: colors.light.foreground,
  },
  count: {
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    marginTop: 2,
  },
  headerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: colors.light.muted,
  },
  headerBtnText: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.medium as any,
    color: colors.light.foreground,
  },
  cancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: colors.light.muted,
  },
  cancelBtnText: {
    fontSize: typography.fontSizes.xs,
    color: colors.light.foreground,
    fontWeight: typography.fontWeights.medium as any,
  },

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
  searchInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.lg,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
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
    gap: 4,
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
  rowSelected: { backgroundColor: "#f0f9ff" },
  rowOut: { backgroundColor: "#fef2f2" },
  rowLow: { backgroundColor: "#fffbeb" },

  checkbox: {
    width: 36,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 4,
  },

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
  tableCellPrice: { width: 70, alignItems: "flex-end", marginRight: 4 },
  cellPrice: {
    fontSize: typography.fontSizes.xs,
    color: colors.light.foreground,
    fontWeight: typography.fontWeights.medium as any,
  },
  cellValue: {
    fontSize: 9,
    color: colors.light.mutedForeground,
    marginTop: 1,
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
    width: 40,
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

  tableCellStatus: { width: 44, alignItems: "center" },
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

  tableCellAction: { width: 38, alignItems: "flex-end" },
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

  bulkBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.light.foreground,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
  bulkInfo: { flex: 1 },
  bulkCount: {
    color: colors.light.background,
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold as any,
  },
  bulkControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  bulkLabel: {
    color: colors.light.background,
    fontSize: typography.fontSizes.xs,
  },
  bulkInput: {
    width: 56,
    height: 32,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.light.background,
    color: colors.light.background,
    paddingHorizontal: 8,
    fontSize: typography.fontSizes.sm,
  },
  bulkApplyBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.md,
    backgroundColor: "#10b981",
  },
  bulkApplyBtnBusy: { opacity: 0.5 },
  bulkApplyText: {
    color: "#fff",
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.semibold as any,
  },

  /* Low-stock alert banner */
  lowStockBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: radii.lg,
    backgroundColor: "#fef3c7",
    borderWidth: 1,
    borderColor: "#fde68a",
  },
  lowStockIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#fffbeb",
    alignItems: "center",
    justifyContent: "center",
  },
  lowStockText: { flex: 1 },
  lowStockTitle: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold as any,
    color: "#92400e",
  },
  lowStockSub: {
    fontSize: 11,
    color: "#b45309",
    marginTop: 1,
  },
  lowStockCta: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
    backgroundColor: "#92400e",
  },
  lowStockCtaText: {
    color: "#fffbeb",
    fontSize: 10,
    fontWeight: typography.fontWeights.semibold as any,
  },

  /* Lowest-stock visual map */
  lowStockPanel: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 14,
    borderRadius: radii.lg,
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.border,
    gap: 10,
  },
  lowStockPanelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  lowStockPanelTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  lowStockPanelTitle: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold as any,
    color: colors.light.foreground,
  },
  lowStockPanelHint: {
    fontSize: 10,
    color: colors.light.mutedForeground,
    fontStyle: "italic",
  },
  lowStockRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  lowStockImage: {
    width: 38,
    height: 38,
    borderRadius: radii.md,
  },
  lowStockInfo: { flex: 1, gap: 4 },
  lowStockName: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.semibold as any,
    color: colors.light.foreground,
  },
  lowStockVariantRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  lowStockVariant: {
    fontSize: 10,
    color: colors.light.mutedForeground,
    textTransform: "capitalize",
    flex: 1,
  },
  lowStockTonePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  lowStockToneDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  lowStockToneText: {
    fontSize: 9,
    fontWeight: typography.fontWeights.semibold as any,
  },
  lowStockBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.light.muted,
    overflow: "hidden",
  },
  lowStockBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  lowStockNumbers: {
    alignItems: "flex-end",
    minWidth: 44,
  },
  lowStockCount: {
    fontSize: typography.fontSizes.base,
    fontWeight: typography.fontWeights.bold as any,
    color: colors.light.foreground,
  },
  lowStockCountSub: {
    fontSize: 9,
    color: colors.light.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});