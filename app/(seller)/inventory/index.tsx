import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  RefreshControl,
  Alert,
  Share,
  StatusBar,
  ScrollView,
} from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/lib/supabase/auth";
import {
  getSellerStore,
  getSellerInventory,
  getSellerProducts,
  updateVariantStock,
  type Result,
} from "@/lib/api";
import { colors, typography, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";
import { LOW_STOCK_THRESHOLD } from "@/lib/inventory";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui";
import { SellerProductGroup } from "@/components/seller/SellerProductGroup";
import { SellerStockSheet } from "@/components/seller/SellerStockSheet";
import type { SellerInventoryRow as InventoryRow } from "@/lib/seller-inventory";
import { groupSellerRows } from "@/lib/seller-inventory";
import {
  SellerFilterTab,
  SellerGlow,
  SellerSearchField,
  SELLER_CREAM,
  SELLER_INK,
  SELLER_GOLD,
} from "@/components/seller/chrome";
import { HERO, LuxeHero, PressScale } from "@/components/seller/luxe";
import type { Product, ProductVariant } from "@/lib/types";

const GOLD = SELLER_GOLD;
const CREAM = SELLER_CREAM;
const INK = SELLER_INK;

type StockTone = "ok" | "low" | "out" | "unknown";

function stockTone(available: number | null): StockTone {
  if (available == null) return "unknown";
  if (available <= 0) return "out";
  if (available <= LOW_STOCK_THRESHOLD) return "low";
  return "ok";
}

function money(n: number | null | undefined, currency = "LKR"): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return formatPrice(n, currency);
}

/** "LKR 33,439,000" → { currency: "LKR", amount: "33,439,000" } so the code can sit small beside the figure. */
function splitMoney(label: string): { currency: string; amount: string } {
  const m = label.match(/^([^\d\s-]+)\s*(.+)$/);
  return m ? { currency: m[1], amount: m[2] } : { currency: "", amount: label };
}

function productImageUrl(p: Product): string | undefined {
  const imgs = p.images ?? [];
  return imgs.find((i) => i.is_primary)?.url || imgs[0]?.url || undefined;
}

function toCSV(rows: InventoryRow[]): string {
  const header = ["SKU", "Product", "Size", "Color", "On hand", "Reserved", "Available", "Price", "Value"];
  const escape = (s: string | number | null | undefined) => {
    if (s == null) return "";
    const str = String(s);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const lines = [header.join(",")];
  for (const r of rows) {
    const value = r.onHand != null && r.price != null ? r.onHand * r.price : "";
    lines.push(
      [
        escape(r.sku),
        escape(r.productName),
        escape(r.size),
        escape(r.color),
        escape(r.onHand),
        r.reserved,
        escape(r.available),
        escape(r.price),
        escape(value === "" ? "" : value),
      ].join(","),
    );
  }
  return lines.join("\n");
}

export default function SellerInventory() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { toast } = useToast();
  const [storeId, setStoreId] = useState<string | null>(null);
  const [storeError, setStoreError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "low" | "out" | "healthy">("all");
  const [sheetRow, setSheetRow] = useState<InventoryRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStock, setBulkStock] = useState("0");
  const [bulkBusy, setBulkBusy] = useState(false);

  const flattenRows = (
    data: {
      product: Product;
      variants: (ProductVariant & {
        quantity: number | null;
        reserved: number;
        available: number | null;
        stock: number | null;
      })[];
    }[],
    imageByProduct: Map<string, string>,
  ) => {
    const all: InventoryRow[] = [];
    for (const item of data) {
      const fallbackImage = productImageUrl(item.product) || imageByProduct.get(item.product.id);
      for (const v of item.variants) {
        const priceRaw = v.price ?? item.product.price;
        const price = typeof priceRaw === "number" && Number.isFinite(priceRaw) ? priceRaw : null;
        all.push({
          productId: item.product.id,
          productName: item.product.name,
          variantId: v.id,
          sku: v.sku ?? item.product.sku ?? `${item.product.slug}-${v.size}-${v.color}`,
          size: v.size ?? undefined,
          color: v.color ?? undefined,
          onHand: v.quantity ?? null,
          reserved: v.reserved ?? 0,
          available: v.available ?? null,
          price,
          currency: item.product.currency || "LKR",
          image: fallbackImage,
        });
      }
    }
    setRows(all);
  };

  const fetchData = useCallback(async () => {
    if (!user) return;
    let id = storeId;
    if (!id) {
      const storeRes = await getSellerStore(user.id);
      if (!storeRes.ok || !storeRes.data) {
        setStoreError(!storeRes.ok ? storeRes.error : "No store found for this account.");
        setLoading(false);
        setRefreshing(false);
        return;
      }
      id = storeRes.data.id;
      setStoreId(id);
      setStoreError(null);
    }

    const [invRes, prodRes] = await Promise.all([
      getSellerInventory(id),
      getSellerProducts(id, { limit: 100 }),
    ]);
    if (!invRes.ok) {
      // Surfaced inline rather than only in an alert — a dismissed alert
      // left the list looking like the store genuinely had no SKUs.
      setLoadError(invRes.error);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setLoadError(null);
    const imageByProduct = new Map<string, string>();
    if (prodRes.ok) {
      for (const p of prodRes.data.products ?? []) {
        const url = productImageUrl(p);
        if (url) imageByProduct.set(p.id, url);
      }
    }
    flattenRows(invRes.data, imageByProduct);
    setLoading(false);
    setRefreshing(false);
  }, [user, storeId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void fetchData();
  }, [fetchData]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const list = rows.filter((r) => {
      const matchSearch =
        !q ||
        r.productName.toLowerCase().includes(q) ||
        r.sku.toLowerCase().includes(q) ||
        (r.size ?? "").toLowerCase().includes(q) ||
        (r.color ?? "").toLowerCase().includes(q);
      if (!matchSearch) return false;
      const tone = stockTone(r.available);
      if (filter === "low") return tone === "low";
      if (filter === "out") return tone === "out";
      if (filter === "healthy") return tone === "ok";
      return true;
    });
    // Urgency-first so sellers see problems without hunting.
    const rank = (t: StockTone) => (t === "out" ? 0 : t === "low" ? 1 : t === "unknown" ? 2 : 3);
    return [...list].sort((a, b) => rank(stockTone(a.available)) - rank(stockTone(b.available)));
  }, [rows, search, filter]);

  const stats = useMemo(() => {
    let healthy = 0;
    let low = 0;
    let out = 0;
    for (const r of rows) {
      const tone = stockTone(r.available);
      if (tone === "ok") healthy += 1;
      else if (tone === "low") low += 1;
      else if (tone === "out") out += 1;
    }
    return { healthy, low, out };
  }, [rows]);

  const totalValue = useMemo(() => {
    let sum = 0;
    let any = false;
    for (const r of rows) {
      if (r.onHand == null || r.price == null) continue;
      any = true;
      sum += r.onHand * r.price;
    }
    return any ? sum : null;
  }, [rows]);

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

  const saveStock = async (row: InventoryRow, newStock: number) => {
    setSaving(true);
    setSavingId(row.variantId);
    const snapshot: InventoryRow = { ...row };
    // Optimistic UI so ± feels instant on phone.
    setRows((prev) =>
      prev.map((r) =>
        r.variantId === row.variantId
          ? {
              ...r,
              onHand: newStock,
              available: Math.max(0, newStock - r.reserved),
            }
          : r,
      ),
    );
    const res = await updateVariantStock(row.productId, row.variantId, newStock);
    setSaving(false);
    setSavingId(null);
    if (res.ok) {
      setSheetRow(null);
      toast.success("Stock updated");
    } else {
      setRows((prev) =>
        prev.map((r) => (r.variantId === row.variantId ? snapshot : r)),
      );
      toast.error(res.error);
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
      toast.success(`${targets.length} SKU(s) updated to ${newStock}.`);
      setRows((prev) =>
        prev.map((r) =>
          ids.has(r.variantId)
            ? { ...r, onHand: newStock, available: Math.max(0, newStock - r.reserved) }
            : r,
        ),
      );
      exitSelect();
    } else {
      toast.error(`${targets.length - failed.length} updated, ${failed.length} failed.`);
      onRefresh();
    }
  };

  const exportCSV = async () => {
    if (filtered.length === 0) {
      toast.info("No rows match the current filters.");
      return;
    }
    const csv = toCSV(filtered);
    try {
      await Share.share({
        message: csv,
        title: `inventory-${new Date().toISOString().slice(0, 10)}.csv`,
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Could not share");
    }
  };

  const groups = useMemo(() => groupSellerRows(filtered), [filtered]);

  const countLabel = loading && rows.length === 0
    ? "Loading inventory"
    : filtered.length === rows.length
      ? `${rows.length} SKUs across ${new Set(rows.map((r) => r.productId)).size} products`
      : `Showing ${filtered.length} of ${rows.length} SKUs`;

  const attention = stats.low + stats.out;
  const productCount = useMemo(() => new Set(rows.map((r) => r.productId)).size, [rows]);
  const valueParts = loading && rows.length === 0 ? { currency: "", amount: "—" } : splitMoney(money(totalValue));
  const healthItems = [
    { key: "out" as const, label: "Out", value: stats.out, color: "#D2714E" },
    { key: "low" as const, label: "Low", value: stats.low, color: GOLD },
    { key: "healthy" as const, label: "Healthy", value: stats.healthy, color: "#9AA86A" },
  ];

  const listHeader = (
    <>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 10 }]}>
        <View style={styles.headerCopy}>
          <Text style={styles.title} accessibilityRole="header">Inventory</Text>
          <Text style={styles.count}>{countLabel}</Text>
        </View>
        <View style={styles.headerActions}>
          {selectMode ? (
            <TouchableOpacity style={styles.cancelSelectBtn} onPress={exitSelect}>
              <Text style={styles.cancelSelectText}>Done</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => setSelectMode(true)}
                disabled={filtered.length === 0}
                accessibilityLabel="Select SKUs"
              >
                <Ionicons name="checkmark-done-outline" size={18} color={INK} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={exportCSV}
                disabled={filtered.length === 0}
                accessibilityLabel="Export CSV"
              >
                <Ionicons name="share-outline" size={18} color={INK} />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      <LuxeHero style={styles.overviewCard}>

        <View style={styles.overviewTop}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.overviewLabel}>On-hand value</Text>
            <Text style={styles.overviewPeriod}>
              Across {productCount} {productCount === 1 ? "product" : "products"}
            </Text>
          </View>
          <View style={styles.skuPill}>
            <Ionicons name="layers-outline" size={12} color={colors.olive[800]} />
            <Text style={styles.skuPillText}>{rows.length} SKUs</Text>
          </View>
        </View>

        <View style={styles.overviewValueRow}>
          {valueParts.currency ? <Text style={styles.overviewCurrency}>{valueParts.currency}</Text> : null}
          <Text style={styles.overviewValue} numberOfLines={1}>
            {valueParts.amount}
          </Text>
        </View>

        {rows.length > 0 ? (
          <>
            <View style={styles.healthBar}>
              {healthItems.map((item) =>
                item.value > 0 ? (
                  <View key={item.key} style={{ flex: item.value, backgroundColor: item.color, borderRadius: 3 }} />
                ) : null,
              )}
            </View>
            <View style={styles.statGrid}>
              {healthItems.map((item) => {
                const active = filter === item.key;
                const pct = rows.length ? Math.round((item.value / rows.length) * 100) : 0;
                return (
                  <PressScale
                    key={item.key}
                    style={[styles.statTile, active && styles.statTileActive]}
                    onPress={() => setFilter(active ? "all" : item.key)}
                    accessibilityLabel={`${item.value} ${item.label}`}
                  >
                    <View style={styles.statHead}>
                      <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                      <Text style={[styles.statLabel, active && styles.statTextActive]}>{item.label}</Text>
                    </View>
                    <View style={styles.statValueRow}>
                      <Text style={[styles.statValue, active && styles.statTextActive]}>{item.value}</Text>
                      <Text style={[styles.statPct, active && styles.statPctActive]}>{pct}%</Text>
                    </View>
                  </PressScale>
                );
              })}
            </View>
          </>
        ) : null}

        {attention > 0 ? (
          <PressScale
            style={styles.attentionRow}
            onPress={() => setFilter(stats.out > 0 ? "out" : "low")}
            accessibilityLabel="Review SKUs that need attention"
          >
            <View style={styles.attentionIcon}>
              <Ionicons name="flash" size={11} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.attentionText}>
                {attention} SKU{attention === 1 ? "" : "s"} need{attention === 1 ? "s" : ""} attention
              </Text>
            </View>
            <View style={styles.attentionCta}>
              <Text style={styles.attentionCtaText}>Review</Text>
              <Ionicons name="arrow-forward" size={13} color={CREAM} />
            </View>
          </PressScale>
        ) : (
          <View style={styles.overviewHintRow}>
            <Ionicons name="checkmark-circle" size={15} color={colors.olive[600]} />
            <Text style={styles.overviewHint}>
              {rows.length > 0 ? "Stock levels look healthy" : "Your inventory summary will appear here"}
            </Text>
          </View>
        )}
      </LuxeHero>

      <View style={styles.searchWrap}>
        <SellerSearchField
          value={search}
          onChangeText={setSearch}
          placeholder="Search SKU, product, size or colour"
        />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.segment}
        contentContainerStyle={styles.segmentRow}
      >
        {([
          { key: "all" as const, label: "All", count: rows.length },
          { key: "healthy" as const, label: "Healthy", count: stats.healthy },
          { key: "low" as const, label: "Low", count: stats.low },
          { key: "out" as const, label: "Out", count: stats.out },
        ]).map((item) => (
          <SellerFilterTab
            key={item.key}
            label={item.label}
            count={item.count}
            active={filter === item.key}
            onPress={() => setFilter(item.key)}
          />
        ))}
      </ScrollView>

      <View style={styles.resultsHeader}>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={styles.resultsEyebrowRow}>
            <View style={styles.resultsRule} />
            <Text style={styles.resultsMeta}>MOST URGENT FIRST</Text>
          </View>
          <Text style={styles.resultsTitle}>
            {groups.length} {groups.length === 1 ? "product" : "products"}
          </Text>
        </View>
        {filter !== "all" || search ? (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => {
              setFilter("all");
              setSearch("");
            }}
          >
            <Ionicons name="close" size={12} color={colors.olive[800]} />
            <Text style={styles.clearButtonText}>Clear filters</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </>
  );

  if (storeError && !storeId) {
    return (
      <View style={[styles.container, styles.errorWrap, { paddingTop: Math.max(insets.top, 24) }]}>
        <StatusBar barStyle="dark-content" />
        <Ionicons name="cloud-offline-outline" size={40} color={colors.olive[700]} />
        <Text style={styles.emptyTitle}>Couldn’t load the stock room</Text>
        <Text style={styles.emptySub}>{storeError}</Text>
        <TouchableOpacity style={styles.emptyCta} onPress={() => void fetchData()}>
          <Text style={styles.emptyCtaText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SellerGlow />
      <FlatList
        data={groups}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => (
          <SellerProductGroup
            group={item}
            autoExpand={search.trim().length > 0 || filter !== "all"}
            savingId={savingId}
            selectMode={selectMode}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onLongPress={(id) => {
              if (!selectMode) {
                setSelectMode(true);
                setSelectedIds(new Set([id]));
              }
            }}
            onOpenProduct={(productId) => router.push(`/(seller)/products/${productId}` as any)}
            onStep={(row, next) => {
              if (savingId === row.variantId) return;
              if (next === (row.onHand ?? 0)) return;
              confirmReservedStock([row], next, () => void saveStock(row, next));
            }}
            onEdit={(row) => setSheetRow(row)}
            onQuickRestock={(row) => {
              const next = Math.max(10, (row.reserved || 0) + 5);
              confirmReservedStock([row], next, () => void saveStock(row, next));
            }}
          />
        )}
        ListHeaderComponent={listHeader}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.olive[700]} />}
        contentContainerStyle={[styles.listContent, selectMode && { paddingBottom: 96 }]}
        ListEmptyComponent={
          loading ? (
            <View style={{ paddingHorizontal: spacing[5], gap: 10 }}>
              {[0, 1, 2, 3].map((i) => (
                <View key={i} style={styles.skeletonCard}>
                  <Skeleton width={72} height={96} borderRadius={radii.md} />
                  <View style={{ flex: 1, gap: 8, paddingVertical: 8 }}>
                    <Skeleton width="70%" height={14} />
                    <Skeleton width="40%" height={10} />
                    <Skeleton width="55%" height={10} />
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconWrap}>
                <Ionicons
                  name={loadError ? "cloud-offline-outline" : "layers-outline"}
                  size={28}
                  color={colors.olive[700]}
                />
              </View>
              <Text style={styles.emptyTitle}>
                {loadError ? "Couldn’t load stock" : "No SKUs match"}
              </Text>
              <Text style={styles.emptySub}>
                {loadError ?? "Try a different search or stock filter."}
              </Text>
              {loadError ? (
                <TouchableOpacity
                  style={styles.emptyCta}
                  onPress={() => void fetchData()}
                  accessibilityRole="button"
                  accessibilityLabel="Retry loading stock"
                >
                  <Text style={styles.emptyCtaText}>Try again</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )
        }
      />

      <SellerStockSheet
        visible={!!sheetRow}
        row={sheetRow}
        saving={saving}
        onClose={() => setSheetRow(null)}
        onSave={(n) => {
          if (!sheetRow) return;
          const target = sheetRow;
          confirmReservedStock([target], n, () => void saveStock(target, n));
        }}
      />

      {selectMode && (
        <View style={[styles.bulkWrap, { paddingBottom: Math.max(insets.bottom, 10) }]} pointerEvents="box-none">
          <View style={styles.bulkBar}>
            <View style={styles.bulkCountWrap}>
              <Text style={styles.bulkCountValue}>{selectedIds.size}</Text>
              <Text style={styles.bulkCount}>selected</Text>
            </View>
            <View style={styles.bulkControls}>
              <Text style={styles.bulkLabel}>Set on-hand</Text>
              <TextInput
                style={styles.bulkInput}
                value={bulkStock}
                onChangeText={setBulkStock}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor="rgba(250,248,241,0.45)"
              />
              <TouchableOpacity
                style={[styles.bulkApplyBtn, (bulkBusy || selectedIds.size === 0) && { opacity: 0.5 }]}
                onPress={bulkApply}
                disabled={bulkBusy || selectedIds.size === 0}
                activeOpacity={0.85}
              >
                <Text style={styles.bulkApplyText}>{bulkBusy ? "…" : "Apply"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f7f2" },
  errorWrap: { alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 8 },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing[5],
    paddingBottom: 16,
    gap: 12,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  kicker: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: colors.olive[700],
    marginBottom: 3,
  },
  title: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 31,
    color: INK,
    letterSpacing: -0.8,
  },
  count: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 13,
    color: colors.light.mutedForeground,
    marginTop: 2,
  },
  iconBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#16170f",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  cancelSelectBtn: {
    paddingHorizontal: 16,
    minHeight: 42,
    justifyContent: "center",
    borderRadius: radii.full,
    backgroundColor: colors.olive[900],
  },
  cancelSelectText: {
    color: CREAM,
    fontSize: typography.fontSizes.sm,
    fontFamily: fontFamilies.sans.semibold,
  },
  overviewCard: { marginHorizontal: spacing[5], marginBottom: spacing[4] },
  overviewTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  overviewLabel: { fontFamily: fontFamilies.mono.medium, fontSize: 9.5, letterSpacing: 1.6, textTransform: "uppercase", color: HERO.kicker },
  overviewPeriod: { fontFamily: fontFamilies.display.italic, fontSize: 13, color: HERO.mute, marginTop: 2 },
  overviewValueRow: { flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 8 },
  overviewCurrency: { fontFamily: fontFamilies.mono.medium, fontSize: 11, letterSpacing: 1.1, color: HERO.mute },
  overviewValue: { flex: 1, fontFamily: fontFamilies.display.regular, fontSize: 34, lineHeight: 40, letterSpacing: -0.9, color: HERO.ink, fontVariant: ["tabular-nums"] },
  overviewHintRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: HERO.divider },
  overviewHint: { flex: 1, fontFamily: fontFamilies.sans.medium, fontSize: 12, color: HERO.text },
  skuPill: { flexDirection: "row", alignItems: "center", gap: 5, height: 28, paddingHorizontal: 10, borderRadius: radii.full, backgroundColor: HERO.chip, borderWidth: StyleSheet.hairlineWidth, borderColor: HERO.chipBorder },
  skuPillText: { fontFamily: fontFamilies.mono.semibold, fontSize: 9.5, letterSpacing: 0.5, color: HERO.text },
  healthBar: { marginTop: 12, height: 5, borderRadius: 3, flexDirection: "row", gap: 3, overflow: "hidden", backgroundColor: "rgba(83,94,44,0.08)" },
  statGrid: { flexDirection: "row", gap: 6, marginTop: 10 },
  statTile: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: HERO.tile,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: HERO.tileBorder,
  },
  statTileActive: { backgroundColor: HERO.ink, borderColor: HERO.ink },
  statHead: { flexDirection: "row", alignItems: "center", gap: 5 },
  statLabel: { fontFamily: fontFamilies.sans.medium, fontSize: 10.5, color: HERO.mute },
  statValueRow: { flexDirection: "row", alignItems: "baseline", gap: 5, marginTop: 3 },
  statValue: { fontFamily: fontFamilies.display.semibold, fontSize: 19, color: HERO.ink, fontVariant: ["tabular-nums"] },
  statPct: { fontFamily: fontFamilies.sans.regular, fontSize: 10, color: HERO.mute },
  statTextActive: { color: CREAM },
  statPctActive: { color: "rgba(250,248,241,0.6)" },
  legendDot: { width: 6, height: 6, borderRadius: 3 },
  attentionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
    paddingVertical: 7,
    paddingLeft: 8,
    paddingRight: 7,
    borderRadius: 16,
    backgroundColor: "rgba(184,92,58,0.08)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(184,92,58,0.28)",
  },
  attentionIcon: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#C8643F", alignItems: "center", justifyContent: "center" },
  attentionText: { fontFamily: fontFamilies.sans.semibold, fontSize: 12.5, color: HERO.ink },
  attentionCta: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999, backgroundColor: HERO.ink },
  attentionCtaText: { fontFamily: fontFamilies.sans.bold, fontSize: 11.5, color: CREAM },
  searchWrap: { marginHorizontal: spacing[5], marginBottom: 10 },
  segment: { flexGrow: 0, marginTop: 6, marginBottom: 14 },
  segmentRow: { paddingHorizontal: spacing[5], gap: 10 },
  resultsHeader: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", paddingHorizontal: spacing[5], marginTop: spacing[5], marginBottom: 12, gap: 10 },
  resultsEyebrowRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  resultsRule: { width: 14, height: 1.5, borderRadius: 1, backgroundColor: GOLD },
  resultsMeta: { fontFamily: fontFamilies.mono.semibold, fontSize: 8.5, letterSpacing: 1.4, color: colors.olive[600] },
  resultsTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 20, color: INK, letterSpacing: -0.2 },
  clearButton: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: radii.full, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: colors.olive[50] },
  clearButtonText: { fontFamily: fontFamilies.sans.semibold, fontSize: 11, color: colors.olive[800] },

  listContent: { paddingBottom: 24 },
  skeletonCard: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.12)",
    overflow: "hidden",
    paddingRight: 12,
    gap: 12,
  },

  emptyContainer: { alignItems: "center", paddingVertical: 48 },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 20,
    color: INK,
    marginTop: 16,
    textAlign: "center",
  },
  emptySub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
    marginTop: 6,
    textAlign: "center",
    paddingHorizontal: 32,
  },
  emptyCta: {
    marginTop: 16,
    backgroundColor: colors.olive[800],
    paddingHorizontal: 18,
    minHeight: 44,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCtaText: {
    color: CREAM,
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.sm,
  },

  bulkWrap: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 12 },
  bulkBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingLeft: 16,
    paddingRight: 10,
    backgroundColor: colors.olive[950],
    borderRadius: 22,
    gap: 12,
    shadowColor: INK,
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  bulkCountWrap: { flexDirection: "row", alignItems: "baseline", gap: 5 },
  bulkCountValue: { fontFamily: fontFamilies.display.semibold, fontSize: 20, color: CREAM },
  bulkCount: {
    color: CREAM,
    fontSize: typography.fontSizes.sm,
    fontFamily: fontFamilies.sans.semibold,
  },
  bulkControls: { flexDirection: "row", alignItems: "center", gap: 8 },
  bulkLabel: {
    color: CREAM,
    fontSize: typography.fontSizes.xs,
    fontFamily: fontFamilies.sans.medium,
  },
  bulkInput: {
    width: 60,
    minHeight: 40,
    borderRadius: 12,
    backgroundColor: "rgba(250,248,241,0.08)",
    borderWidth: 1,
    borderColor: "rgba(250,248,241,0.35)",
    color: CREAM,
    paddingHorizontal: 8,
    fontSize: typography.fontSizes.sm,
    fontFamily: fontFamilies.mono.medium,
    textAlign: "center",
  },
  bulkApplyBtn: {
    paddingHorizontal: 16,
    minHeight: 40,
    borderRadius: 12,
    backgroundColor: GOLD,
    justifyContent: "center",
  },
  bulkApplyText: {
    color: INK,
    fontSize: typography.fontSizes.xs,
    fontFamily: fontFamilies.sans.semibold,
  },
});
