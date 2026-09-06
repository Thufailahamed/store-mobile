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
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
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
import {
  SellerSearchField,
  SellerFilterTab,
  sellerBorder,
  SELLER_CREAM,
  SELLER_INK,
  SELLER_GOLD,
  SELLER_RUST,
} from "@/components/seller/chrome";
import type { Product, ProductVariant } from "@/lib/types";

const GOLD = SELLER_GOLD;
const RUST = SELLER_RUST;
const CREAM = SELLER_CREAM;
const INK = SELLER_INK;

interface InventoryRow {
  productId: string;
  productName: string;
  variantId: string;
  sku: string;
  size?: string;
  color?: string;
  onHand: number | null;
  reserved: number;
  available: number | null;
  price: number | null;
  currency: string;
  image?: string;
}

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

function Thumb({ uri, style }: { uri?: string; style: object }) {
  if (uri) {
    return <Image source={{ uri }} style={style} contentFit="cover" transition={200} />;
  }
  return (
    <View style={[style, styles.thumbEmpty]}>
      <Ionicons name="image-outline" size={16} color={colors.light.mutedForeground} />
    </View>
  );
}

export default function SellerInventory() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [storeId, setStoreId] = useState<string | null>(null);
  const [storeError, setStoreError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "low" | "out" | "healthy">("all");
  const [editing, setEditing] = useState<string | null>(null);
  const [draftStock, setDraftStock] = useState("0");
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
    for (const r of filtered) {
      if (r.onHand == null || r.price == null) continue;
      any = true;
      sum += r.onHand * r.price;
    }
    return any ? sum : null;
  }, [filtered]);

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
      setEditing(null);
    } else {
      setRows((prev) =>
        prev.map((r) => (r.variantId === row.variantId ? snapshot : r)),
      );
      Alert.alert("Error", res.error);
    }
  };

  const adjustStock = (row: InventoryRow, delta: number) => {
    if (savingId === row.variantId) return;
    const current = row.onHand ?? 0;
    const next = Math.max(0, current + delta);
    if (next === current) return;
    confirmReservedStock([row], next, () => void saveStock(row, next));
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
      Alert.alert("Done", `${targets.length} SKU(s) updated to ${newStock}.`);
      setRows((prev) =>
        prev.map((r) =>
          ids.has(r.variantId)
            ? { ...r, onHand: newStock, available: Math.max(0, newStock - r.reserved) }
            : r,
        ),
      );
      exitSelect();
    } else {
      Alert.alert("Partial", `${targets.length - failed.length} updated, ${failed.length} failed.`, [
        { text: "OK", onPress: () => onRefresh() },
      ]);
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

  const startEdit = (row: InventoryRow) => {
    setEditing(row.variantId);
    setDraftStock(String(row.onHand ?? 0));
  };

  const toneMeta = (tone: StockTone) => {
    if (tone === "out") return { label: "Out", color: RUST, bg: "rgba(184,92,58,0.12)" };
    if (tone === "low") return { label: "Low", color: "#8a6a2a", bg: "rgba(200,164,74,0.18)" };
    if (tone === "ok") return { label: "In stock", color: colors.olive[800], bg: "rgba(83,94,44,0.1)" };
    return { label: "—", color: colors.ink.mute, bg: colors.olive[50] };
  };

  const renderRow = ({ item }: { item: InventoryRow }) => {
    const isEditing = editing === item.variantId;
    const isSaving = savingId === item.variantId;
    const tone = stockTone(item.available);
    const meta = toneMeta(tone);
    const selected = selectedIds.has(item.variantId);
    const variantLabel = [item.size, item.color].filter(Boolean).join(" · ");
    const qty = item.onHand ?? item.available;
    const qtyLabel = qty == null ? "—" : String(qty);

    return (
      <View
        style={[
          styles.card,
          selected && styles.cardSelected,
          tone === "out" && styles.cardOut,
          tone === "low" && styles.cardLow,
        ]}
      >
        <View style={[styles.toneBar, { backgroundColor: meta.color }]} />
        <View style={styles.cardRow}>
          {selectMode && (
            <TouchableOpacity
              style={styles.checkbox}
              onPress={() => toggleSelect(item.variantId)}
              hitSlop={6}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
            >
              <Ionicons
                name={selected ? "checkbox" : "square-outline"}
                size={22}
                color={selected ? colors.olive[700] : colors.light.mutedForeground}
              />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.cardMain}
            onPress={() =>
              selectMode
                ? toggleSelect(item.variantId)
                : router.push(`/(seller)/products/${item.productId}` as any)
            }
            onLongPress={() => {
              if (!selectMode) {
                setSelectMode(true);
                setSelectedIds(new Set([item.variantId]));
              }
            }}
            delayLongPress={350}
            activeOpacity={0.75}
          >
            <Thumb uri={item.image} style={styles.thumb} />
            <View style={styles.cardInfo}>
              <Text style={styles.cardName} numberOfLines={2}>
                {item.productName}
              </Text>
              <Text style={styles.cardSku}>{item.sku}</Text>
              {variantLabel ? <Text style={styles.cardMeta}>{variantLabel}</Text> : null}
              <View style={styles.cardFooter}>
                <Text style={styles.cardPrice}>{money(item.price, item.currency)}</Text>
                {item.reserved > 0 ? (
                  <>
                    <Text style={styles.cardDot}>·</Text>
                    <Text style={styles.cardHeld}>{item.reserved} held</Text>
                  </>
                ) : null}
              </View>
            </View>
          </TouchableOpacity>

          {!selectMode && (
            <View style={styles.stockPanel}>
              <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
                <Text style={[styles.statusPillText, { color: meta.color }]}>{meta.label}</Text>
              </View>

              {isEditing ? (
                <View style={styles.editStack}>
                  <TextInput
                    style={[styles.qtyInput, { borderColor: meta.color }]}
                    value={draftStock}
                    onChangeText={setDraftStock}
                    keyboardType="number-pad"
                    autoFocus
                    selectTextOnFocus
                    onSubmitEditing={() => handleSaveStock(item)}
                    accessibilityLabel="On-hand quantity"
                  />
                  <View style={styles.editActions}>
                    <TouchableOpacity
                      style={styles.editCancelBtn}
                      onPress={() => setEditing(null)}
                      accessibilityLabel="Cancel"
                    >
                      <Text style={styles.editCancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.editSaveBtn}
                      onPress={() => handleSaveStock(item)}
                      disabled={saving}
                      accessibilityLabel="Save stock"
                    >
                      {saving && isSaving ? (
                        <ActivityIndicator size="small" color={CREAM} />
                      ) : (
                        <Text style={styles.editSaveText}>Save</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <>
                  <View style={styles.stepper}>
                    <TouchableOpacity
                      style={[styles.stepBtn, isSaving && styles.stepBtnDisabled]}
                      onPress={() => adjustStock(item, -1)}
                      disabled={isSaving || (item.onHand ?? 0) <= 0}
                      accessibilityLabel="Decrease stock"
                    >
                      <Ionicons name="remove" size={18} color={INK} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.qtyTap}
                      onPress={() => startEdit(item)}
                      accessibilityLabel={`Stock ${qtyLabel}. Tap to edit`}
                      accessibilityRole="button"
                    >
                      {isSaving ? (
                        <ActivityIndicator size="small" color={meta.color} />
                      ) : (
                        <Text style={[styles.qtyValue, { color: meta.color }]}>{qtyLabel}</Text>
                      )}
                      <Text style={styles.qtyHint}>on hand</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.stepBtn, isSaving && styles.stepBtnDisabled]}
                      onPress={() => adjustStock(item, 1)}
                      disabled={isSaving}
                      accessibilityLabel="Increase stock"
                    >
                      <Ionicons name="add" size={18} color={INK} />
                    </TouchableOpacity>
                  </View>
                  {tone === "out" ? (
                    <TouchableOpacity
                      style={styles.quickRestock}
                      onPress={() => {
                        const next = Math.max(10, (item.reserved || 0) + 5);
                        confirmReservedStock([item], next, () => void saveStock(item, next));
                      }}
                      disabled={isSaving}
                      accessibilityLabel="Quick restock to 10"
                    >
                      <Text style={styles.quickRestockText}>+10</Text>
                    </TouchableOpacity>
                  ) : null}
                </>
              )}
            </View>
          )}
        </View>
      </View>
    );
  };

  const countLabel = (() => {
    if (loading && rows.length === 0) return "Loading";
    const value = totalValue == null ? "On-hand —" : `On-hand ${money(totalValue)}`;
    return `${filtered.length} of ${rows.length} SKUs · ${value}`;
  })();

  const listHeader = (
    <>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 8 }]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.kicker}>Stock</Text>
          <Text style={styles.title}>Inventory</Text>
          <Text style={styles.count}>{countLabel}</Text>
        </View>
        <View style={styles.headerActions}>
          {selectMode ? (
            <TouchableOpacity style={styles.cancelSelectBtn} onPress={exitSelect}>
              <Text style={styles.cancelSelectText}>Cancel</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => setSelectMode(true)}
                disabled={filtered.length === 0}
                accessibilityLabel="Select SKUs"
              >
                <Ionicons name="checkmark-circle-outline" size={18} color={INK} />
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
      <View style={styles.goldRule} />

      <View style={styles.ledger}>
        <TouchableOpacity
          style={styles.ledgerStat}
          onPress={() => setFilter("healthy")}
          accessibilityRole="button"
          accessibilityLabel={`${stats.healthy} healthy`}
        >
          <Text style={[styles.ledgerValue, { color: colors.olive[700] }]}>{stats.healthy}</Text>
          <Text style={styles.ledgerLabel}>Healthy</Text>
        </TouchableOpacity>
        <View style={styles.ledgerRule} />
        <TouchableOpacity
          style={styles.ledgerStat}
          onPress={() => setFilter("low")}
          accessibilityRole="button"
          accessibilityLabel={`${stats.low} low`}
        >
          <Text style={[styles.ledgerValue, { color: "#8a6a2a" }]}>{stats.low}</Text>
          <Text style={styles.ledgerLabel}>Low</Text>
        </TouchableOpacity>
        <View style={styles.ledgerRule} />
        <TouchableOpacity
          style={styles.ledgerStat}
          onPress={() => setFilter("out")}
          accessibilityRole="button"
          accessibilityLabel={`${stats.out} out`}
        >
          <Text style={[styles.ledgerValue, { color: RUST }]}>{stats.out}</Text>
          <Text style={styles.ledgerLabel}>Out</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrap}>
        <SellerSearchField
          value={search}
          onChangeText={setSearch}
          placeholder="Search SKU, piece, size, colour"
        />
      </View>
      <View style={styles.filterTabs}>
        {([
          { key: "all" as const, label: "All", count: rows.length },
          { key: "healthy" as const, label: "Healthy", count: stats.healthy },
          { key: "low" as const, label: "Low", count: stats.low },
          { key: "out" as const, label: "Out", count: stats.out },
        ]).map((f) => (
          <SellerFilterTab
            key={f.key}
            label={f.label}
            count={f.count}
            active={filter === f.key}
            onPress={() => setFilter(f.key)}
          />
        ))}
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
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.variantId}
        renderItem={renderRow}
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

      {selectMode && (
        <View style={[styles.bulkBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Text style={styles.bulkCount}>{selectedIds.size} selected</Text>
          <View style={styles.bulkControls}>
            <Text style={styles.bulkLabel}>On-hand</Text>
            <TextInput
              style={styles.bulkInput}
              value={bulkStock}
              onChangeText={setBulkStock}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor="rgba(250,248,241,0.45)"
            />
            <TouchableOpacity
              style={[styles.bulkApplyBtn, bulkBusy && { opacity: 0.5 }]}
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
  errorWrap: { alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 8 },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[3],
    gap: 12,
  },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  kicker: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 10,
    letterSpacing: typography.letterSpacing.editorial,
    textTransform: "uppercase",
    color: colors.olive[700],
    marginBottom: 2,
  },
  title: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 28,
    color: INK,
    letterSpacing: -0.4,
  },
  count: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    marginTop: 4,
  },
  goldRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(200,164,74,0.55)",
    marginHorizontal: spacing[5],
    marginBottom: spacing[3],
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: CREAM,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelSelectBtn: {
    paddingHorizontal: 16,
    minHeight: 44,
    justifyContent: "center",
    borderRadius: radii.full,
    backgroundColor: colors.light.muted,
  },
  cancelSelectText: {
    color: colors.light.foreground,
    fontSize: typography.fontSizes.sm,
    fontFamily: fontFamilies.sans.medium,
  },

  ledger: {
    flexDirection: "row",
    marginHorizontal: spacing[5],
    marginBottom: spacing[3],
    backgroundColor: CREAM,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.12)",
    paddingVertical: 10,
  },
  ledgerStat: { flex: 1, alignItems: "center", minHeight: 44, justifyContent: "center" },
  ledgerRule: { width: StyleSheet.hairlineWidth, backgroundColor: "rgba(83,94,44,0.14)" },
  ledgerValue: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 20,
    color: INK,
  },
  ledgerLabel: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 10,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: colors.light.mutedForeground,
    marginTop: 2,
  },

  searchWrap: {
    marginHorizontal: spacing[5],
    marginBottom: 10,
  },
  filterTabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: spacing[5],
    marginBottom: 12,
  },
  filterTab: {
    paddingHorizontal: 14,
    minHeight: 44,
    justifyContent: "center",
    borderRadius: radii.full,
    backgroundColor: CREAM,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.14)",
  },
  filterTabActive: {
    backgroundColor: colors.olive[800],
    borderColor: colors.olive[800],
  },
  filterTabText: {
    fontSize: 12,
    fontFamily: fontFamilies.sans.medium,
    color: colors.olive[800],
  },
  filterTabTextActive: { color: CREAM },

  listContent: { paddingBottom: 24 },
  skeletonCard: {
    flexDirection: "row",
    backgroundColor: CREAM,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.12)",
    overflow: "hidden",
    paddingRight: 12,
    gap: 12,
  },

  card: {
    flexDirection: "row",
    marginHorizontal: spacing[5],
    marginBottom: 10,
    backgroundColor: CREAM,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.12)",
    overflow: "hidden",
  },
  cardOut: {
    borderColor: "rgba(184,92,58,0.28)",
    backgroundColor: "rgba(184,92,58,0.04)",
  },
  cardLow: {
    borderColor: "rgba(200,164,74,0.4)",
    backgroundColor: "rgba(200,164,74,0.06)",
  },
  toneBar: {
    width: 4,
    alignSelf: "stretch",
  },
  cardRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "stretch",
  },
  cardSelected: {
    borderColor: colors.olive[600],
    backgroundColor: colors.olive[50],
  },
  checkbox: {
    width: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: "rgba(83,94,44,0.12)",
  },
  cardMain: { flex: 1, flexDirection: "row", minWidth: 0 },
  thumb: { width: 64, height: 88 },
  thumbEmpty: {
    backgroundColor: colors.paper.warm,
    justifyContent: "center",
    alignItems: "center",
  },
  cardInfo: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 10,
    paddingHorizontal: 10,
    justifyContent: "center",
  },
  cardName: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: typography.fontSizes.sm,
    color: INK,
  },
  cardSku: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 11,
    color: colors.light.mutedForeground,
    marginTop: 3,
  },
  cardMeta: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: colors.light.mutedForeground,
    marginTop: 2,
    textTransform: "capitalize",
  },
  cardFooter: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
  },
  cardPrice: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.xs,
    color: INK,
  },
  cardDot: { color: colors.light.mutedForeground, fontSize: 10 },
  cardHeld: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: typography.fontSizes.xs,
    color: "#8a6a2a",
  },
  stockPanel: {
    width: 118,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: "rgba(83,94,44,0.12)",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(250,248,241,0.65)",
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  statusPillText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.2)",
    backgroundColor: CREAM,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnDisabled: { opacity: 0.4 },
  qtyTap: {
    minWidth: 40,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  qtyValue: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: -0.5,
  },
  qtyHint: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 9,
    color: colors.ink.mute,
    marginTop: 1,
  },
  quickRestock: {
    minHeight: 28,
    paddingHorizontal: 10,
    borderRadius: radii.full,
    backgroundColor: colors.olive[900],
    alignItems: "center",
    justifyContent: "center",
  },
  quickRestockText: {
    color: CREAM,
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 11,
  },
  editStack: {
    width: "100%",
    gap: 8,
    alignItems: "center",
  },
  qtyInput: {
    width: "100%",
    minHeight: 40,
    borderWidth: 1.5,
    borderRadius: radii.md,
    textAlign: "center",
    fontSize: 20,
    fontFamily: fontFamilies.display.semibold,
    color: INK,
    paddingHorizontal: 6,
    backgroundColor: colors.light.background,
  },
  editActions: {
    flexDirection: "row",
    gap: 6,
    width: "100%",
  },
  editCancelBtn: {
    flex: 1,
    minHeight: 32,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: sellerBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  editCancelText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 11,
    color: colors.olive[800],
  },
  editSaveBtn: {
    flex: 1,
    minHeight: 32,
    borderRadius: radii.full,
    backgroundColor: colors.olive[900],
    alignItems: "center",
    justifyContent: "center",
  },
  editSaveText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 11,
    color: CREAM,
  },

  emptyContainer: { alignItems: "center", paddingVertical: 48 },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: CREAM,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontFamily: fontFamilies.display.semibold,
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
    backgroundColor: INK,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    gap: 12,
  },
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
    width: 56,
    minHeight: 36,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(250,248,241,0.35)",
    color: CREAM,
    paddingHorizontal: 8,
    fontSize: typography.fontSizes.sm,
    fontFamily: fontFamilies.mono.medium,
    textAlign: "center",
  },
  bulkApplyBtn: {
    paddingHorizontal: 14,
    minHeight: 36,
    borderRadius: radii.md,
    backgroundColor: GOLD,
    justifyContent: "center",
  },
  bulkApplyText: {
    color: INK,
    fontSize: typography.fontSizes.xs,
    fontFamily: fontFamilies.sans.semibold,
  },
});
