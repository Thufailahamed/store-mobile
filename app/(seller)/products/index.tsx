import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
  ActionSheetIOS,
  Platform,
  Share,
  ActivityIndicator,
  StatusBar,
} from "react-native";
import { Image } from "expo-image";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@/components/ui/Icon";
import { useAuth } from "@/lib/supabase/auth";
import {
  getSellerStore,
  getSellerProducts,
  deleteSellerProduct,
  duplicateSellerProduct,
  bulkSetSellerStatus,
} from "@/lib/api";
import { colors, typography, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";
import { getVariantAvailableStock, LOW_STOCK_THRESHOLD } from "@/lib/inventory";
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
import type { Product } from "@/lib/types";

const GOLD = SELLER_GOLD;
const RUST = SELLER_RUST;
const CREAM = SELLER_CREAM;
const INK = SELLER_INK;

const STATUS_TABS = [
  { key: "all", label: "All" },
  { key: "active", label: "Live" },
  { key: "draft", label: "Draft" },
  { key: "pending", label: "Review" },
  { key: "flagged", label: "Flagged" },
  { key: "archived", label: "Archive" },
] as const;

type StatusKey = (typeof STATUS_TABS)[number]["key"];
type SortKey = "newest" | "oldest" | "price_asc" | "price_desc" | "sales_desc" | "name_asc";
type ViewMode = "list" | "grid";

const SORT_TABS: { key: SortKey; label: string }[] = [
  { key: "newest", label: "Newest" },
  { key: "sales_desc", label: "Bestsellers" },
  { key: "price_desc", label: "Price high" },
  { key: "price_asc", label: "Price low" },
  { key: "name_asc", label: "A–Z" },
  { key: "oldest", label: "Oldest" },
];
const PAGE_SIZE = 20;
// Backend caps `limit` at 100 per request, so a full-catalogue export has to
// page through results rather than exporting whatever page happens to be loaded.
const EXPORT_PAGE_SIZE = 100;

interface ProductStats {
  all: number;
  active: number;
  draft: number;
  pending: number;
  archived: number;
  flagged: number;
}

function parseStats(raw: Record<string, number> | undefined): ProductStats | null {
  if (!raw || Object.keys(raw).length === 0) return null;
  const num = (v: unknown) => {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  return {
    all: num(raw.all ?? raw.total),
    active: num(raw.active),
    draft: num(raw.draft),
    pending: num(raw.pending),
    archived: num(raw.archived),
    flagged: num(raw.flagged),
  };
}

function productImageUrl(p: Product): string | null {
  const imgs = p.images ?? [];
  return imgs.find((i) => i.is_primary)?.url || imgs[0]?.url || null;
}

function productPrice(p: Product): string {
  return formatPrice(Number(p.price ?? 0), p.currency || "LKR");
}

/** Sellable units for a list row. Missing stock stays null so we never invent "0 in stock". */
function productAvailableStock(p: Product): number | null {
  const variants = p.variants ?? [];
  if (variants.length === 0) return null;
  let any = false;
  let sum = 0;
  for (const v of variants) {
    if (v.stock == null) continue;
    any = true;
    sum += getVariantAvailableStock(v, v.stock);
  }
  return any ? sum : null;
}

type StockTone = "ok" | "low" | "out" | "unknown";

function describeStock(n: number | null): { label: string; short: string; tone: StockTone } {
  if (n == null) return { label: "Stock —", short: "—", tone: "unknown" };
  if (n <= 0) return { label: "Out of stock", short: "Out", tone: "out" };
  if (n <= LOW_STOCK_THRESHOLD) return { label: `${n} low`, short: String(n), tone: "low" };
  return { label: `${n} ready`, short: String(n), tone: "ok" };
}

function formatDate(iso?: string) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  } catch {
    return "";
  }
}

function toCsv(products: Product[]): string {
  const header = ["name", "sku", "status", "price", "mrp", "total_sales", "stock", "created_at"];
  const escape = (v: unknown) => {
    if (v == null) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [header.join(",")];
  for (const p of products) {
    const stock = productAvailableStock(p);
    lines.push(
      [
        escape(p.name),
        escape(p.sku),
        escape(p.status),
        escape(p.price),
        escape(p.mrp),
        escape(p.total_sales ?? 0),
        escape(stock),
        escape(p.created_at),
      ].join(","),
    );
  }
  return lines.join("\n");
}

function showActions(item: Product, onAction: (key: string) => void) {
  const actions = [
    { label: "View public page", key: "view" },
    {
      label: item.status === "archived" ? "Restore" : "Archive",
      key: item.status === "archived" ? "restore" : "archive",
    },
    { label: "Duplicate", key: "duplicate" },
    {
      label: item.status === "active" ? "Move to draft" : "Activate",
      key: item.status === "active" ? "draft" : "activate",
    },
    { label: "Delete", key: "delete" },
  ];
  const opts = [...actions.map((a) => a.label), "Cancel"];
  if (Platform.OS === "ios") {
    ActionSheetIOS.showActionSheetWithOptions(
      { options: opts, cancelButtonIndex: actions.length, destructiveButtonIndex: actions.length - 1 },
      (i) => {
        if (i >= 0 && i < actions.length) onAction(actions[i].key);
      },
    );
  } else {
    Alert.alert(item.name, undefined, [
      ...actions.map((a) => ({
        text: a.label,
        style: a.key === "delete" ? ("destructive" as const) : ("default" as const),
        onPress: () => onAction(a.key),
      })),
      { text: "Cancel", style: "cancel" as const },
    ]);
  }
}

function statusTone(status: string): { bg: string; text: string; label: string } {
  if (status === "active") return { bg: colors.olive[50], text: colors.olive[800], label: "Live" };
  if (status === "draft") return { bg: colors.paper.warm, text: colors.ink.mute, label: "Draft" };
  if (status === "archived") return { bg: "#f4e6df", text: RUST, label: "Archive" };
  if (status === "pending") return { bg: "#f3efe2", text: "#8a6a2a", label: "Review" };
  if (status === "rejected") return { bg: "#f4e6df", text: RUST, label: "Rejected" };
  return { bg: "#f3efe2", text: "#8a6a2a", label: status };
}

function stockColors(tone: StockTone): { bg: string; text: string } {
  if (tone === "out") return { bg: "#f4e6df", text: RUST };
  if (tone === "low") return { bg: "#f3efe2", text: "#8a6a2a" };
  if (tone === "ok") return { bg: colors.olive[50], text: colors.olive[800] };
  return { bg: colors.paper.warm, text: colors.ink.mute };
}

function ProductThumb({ uri, style }: { uri: string | null; style: object }) {
  if (uri) {
    return <Image source={{ uri }} style={style} contentFit="cover" transition={200} />;
  }
  return (
    <View style={[style, styles.thumbEmpty]}>
      <Ionicons name="image-outline" size={18} color={colors.light.mutedForeground} />
    </View>
  );
}

function ModerationChip({ p }: { p: Product }) {
  const reasons = (p.suspicious_reasons ?? []) as { blocking: boolean }[];
  if (p.status === "active" && p.auto_approved) {
    return (
      <View style={[styles.modChip, { backgroundColor: colors.olive[50], borderColor: colors.olive[200] }]}>
        <Ionicons name="shield-checkmark" size={11} color={colors.olive[700]} />
        <Text style={[styles.modChipText, { color: colors.olive[800] }]}>auto</Text>
      </View>
    );
  }
  if (p.is_flagged) {
    const blocking = reasons.some((r) => r.blocking);
    return (
      <View
        style={[
          styles.modChip,
          {
            backgroundColor: blocking ? "#f3efe2" : "#f4e6df",
            borderColor: blocking ? "rgba(200,164,74,0.45)" : "rgba(184,92,58,0.35)",
          },
        ]}
      >
        <Ionicons name={blocking ? "close-circle" : "alert-circle"} size={11} color={blocking ? "#8a6a2a" : RUST} />
        <Text style={[styles.modChipText, { color: blocking ? "#8a6a2a" : RUST }]}>
          flagged · {p.risk_score ?? 0}
        </Text>
      </View>
    );
  }
  if (p.status === "pending") {
    return (
      <View style={[styles.modChip, { backgroundColor: "#f3efe2", borderColor: "rgba(200,164,74,0.45)" }]}>
        <Ionicons name="alert-circle" size={11} color="#8a6a2a" />
        <Text style={[styles.modChipText, { color: "#8a6a2a" }]}>review</Text>
      </View>
    );
  }
  return null;
}

function ProductListSkeleton() {
  return (
    <View style={{ paddingHorizontal: spacing[4], paddingTop: 4, gap: 10 }}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={styles.skeletonCard}>
          <Skeleton width={80} height={104} borderRadius={radii.md} />
          <View style={{ flex: 1, gap: 8, paddingVertical: 8 }}>
            <Skeleton width="70%" height={14} />
            <Skeleton width="40%" height={10} />
            <Skeleton width="85%" height={10} />
          </View>
        </View>
      ))}
    </View>
  );
}

export default function SellerProducts() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [storeId, setStoreId] = useState<string | null>(null);
  const [storeError, setStoreError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [stats, setStats] = useState<ProductStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<StatusKey>("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [offset, setOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [exporting, setExporting] = useState(false);

  const mountedRef = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const resetList = useCallback(() => {
    setProducts([]);
    setOffset(0);
    setHasMore(true);
  }, []);

  const loadPage = useCallback(
    async (pageOffset: number, append: boolean) => {
      if (!storeId) return;
      const res = await getSellerProducts(storeId, {
        status: status === "all" ? undefined : status,
        search: debouncedSearch || undefined,
        sort,
        limit: PAGE_SIZE,
        offset: pageOffset,
      });
      if (!res.ok) {
        if (!append) setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
        // Keep the message on screen; an alert alone left an empty list
        // that looked like the seller had no products.
        if (append) Alert.alert("Couldn’t load more", res.error);
        else setListError(res.error);
        return;
      }
      setListError(null);
      const incoming = res.data.products ?? [];
      setTotal(res.data.total ?? 0);
      if (pageOffset === 0) {
        const next = parseStats(res.data.stats);
        if (next) setStats(next);
      }
      setProducts((prev) => (append ? [...prev, ...incoming] : incoming));
      setHasMore(incoming.length >= PAGE_SIZE);
      setOffset(pageOffset + incoming.length);
      if (!append) setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    },
    [storeId, status, debouncedSearch, sort],
  );

  const loadStore = useCallback(async () => {
    if (!user) return;
    setStoreError(null);
    setLoading(true);
    const storeRes = await getSellerStore(user.id);
    if (storeRes.ok && storeRes.data) {
      setStoreId(storeRes.data.id);
      return;
    }
    setLoading(false);
    setStoreError(!storeRes.ok ? storeRes.error : "No store found for this account.");
  }, [user]);

  useEffect(() => {
    if (!user || storeId) return;
    void loadStore();
  }, [user, storeId, loadStore]);

  useEffect(() => {
    if (!storeId) return;
    resetList();
    setLoading(true);
    loadPage(0, false);
  }, [storeId, status, sort, debouncedSearch, loadPage, resetList]);

  useFocusEffect(
    useCallback(() => {
      if (!storeId || !mountedRef.current) {
        mountedRef.current = true;
        return;
      }
      resetList();
      setRefreshing(true);
      loadPage(0, false);
    }, [storeId, resetList, loadPage]),
  );

  const onRefresh = useCallback(() => {
    if (!storeId) {
      void loadStore();
      return;
    }
    setRefreshing(true);
    resetList();
    loadPage(0, false);
  }, [loadPage, resetList, storeId, loadStore]);

  const onEndReached = useCallback(() => {
    if (loadingMore || loading || refreshing || !hasMore) return;
    setLoadingMore(true);
    loadPage(offset, true);
  }, [loadingMore, loading, refreshing, hasMore, offset, loadPage]);

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

  const handleDelete = (product: Product) => {
    Alert.alert(
      "Delete this piece?",
      `"${product.name}" will be removed permanently.`,
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
              setTotal((t) => Math.max(0, t - 1));
              setSelectedIds((prev) => {
                const next = new Set(prev);
                next.delete(product.id);
                return next;
              });
            } else {
              Alert.alert("Error", res.error);
            }
          },
        },
      ],
    );
  };

  const handleDuplicate = async (product: Product) => {
    if (!storeId) return;
    setBusyId(product.id);
    const res = await duplicateSellerProduct(product.id, storeId);
    setBusyId(null);
    if (res.ok && res.data?.id) {
      router.replace(`/(seller)/products/${res.data.id}` as any);
    } else if (!res.ok) {
      Alert.alert("Error", res.error);
    }
  };

  const handleArchive = async (product: Product) => {
    if (!storeId) return;
    setBusyId(product.id);
    const target = product.status === "archived" ? "draft" : "archived";
    const res = await bulkSetSellerStatus([product.id], target, storeId);
    setBusyId(null);
    if (res.ok) {
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, status: target as Product["status"] } : p)),
      );
    } else {
      Alert.alert("Error", res.error);
    }
  };

  const handleActivate = async (product: Product) => {
    if (!storeId) return;
    setBusyId(product.id);
    const target = product.status === "active" ? "draft" : "active";
    const res = await bulkSetSellerStatus([product.id], target, storeId);
    setBusyId(null);
    if (res.ok) {
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, status: target as Product["status"] } : p)),
      );
    } else {
      Alert.alert("Error", res.error);
    }
  };

  const handleAction = (product: Product, key: string) => {
    switch (key) {
      case "view":
        router.push(`/(main)/products/${product.slug}` as any);
        break;
      case "delete":
        handleDelete(product);
        break;
      case "duplicate":
        void handleDuplicate(product);
        break;
      case "archive":
      case "restore":
        void handleArchive(product);
        break;
      case "activate":
      case "draft":
        void handleActivate(product);
        break;
    }
  };

  const bulkApply = async (target: "draft" | "active" | "archived") => {
    if (!storeId || selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    setBulkBusy(true);
    const res = await bulkSetSellerStatus(ids, target, storeId);
    setBulkBusy(false);
    if (res.ok) {
      Alert.alert("Done", `${res.data.updated} piece(s) moved to ${target}.`);
      exitSelect();
      onRefresh();
    } else {
      Alert.alert("Error", res.error);
    }
  };

  const bulkDelete = () => {
    if (selectedIds.size === 0) return;
    Alert.alert(
      "Delete pieces?",
      `${selectedIds.size} piece(s) will be removed.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const ids = Array.from(selectedIds);
            setBulkBusy(true);
            const results = await Promise.allSettled(ids.map((id) => deleteSellerProduct(id)));
            setBulkBusy(false);
            const failed = results.filter((r) => r.status === "rejected" || (r.status === "fulfilled" && !r.value.ok));
            if (failed.length) {
              Alert.alert("Partial", `${ids.length - failed.length} deleted, ${failed.length} failed.`);
            } else {
              Alert.alert("Done", `${ids.length} deleted.`);
            }
            exitSelect();
            onRefresh();
          },
        },
      ],
    );
  };

  const exportCsv = async () => {
    if (!storeId || (total === 0 && products.length === 0)) {
      Alert.alert("Nothing to export", "Load some products first.");
      return;
    }
    setExporting(true);
    try {
      let all: Product[] = [];
      let pageOffset = 0;
      for (;;) {
        const res = await getSellerProducts(storeId, {
          status: status === "all" ? undefined : status,
          search: debouncedSearch || undefined,
          sort,
          limit: EXPORT_PAGE_SIZE,
          offset: pageOffset,
        });
        if (!res.ok) {
          Alert.alert("Export failed", res.error);
          return;
        }
        const batch = res.data.products ?? [];
        all = all.concat(batch);
        pageOffset += batch.length;
        if (batch.length < EXPORT_PAGE_SIZE) break;
      }
      if (all.length === 0) {
        Alert.alert("Nothing to export", "Load some products first.");
        return;
      }
      const csv = toCsv(all);
      await Share.share({
        message: csv,
        title: `products-${new Date().toISOString().slice(0, 10)}.csv`,
      });
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not share");
    } finally {
      setExporting(false);
    }
  };

  const openOverflowMenu = () => {
    if (exporting) return;
    const opts = ["Export CSV", "Cancel"];
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: opts, cancelButtonIndex: 1 },
        (i) => {
          if (i === 0) void exportCsv();
        },
      );
    } else {
      Alert.alert("More", undefined, [
        { text: "Export CSV", onPress: () => void exportCsv() },
        { text: "Cancel", style: "cancel" },
      ]);
    }
  };

  const openSortMenu = () => {
    Alert.alert(
      "Sort",
      undefined,
      [
        ...SORT_TABS.map((s) => ({
          text: sort === s.key ? `✓ ${s.label}` : s.label,
          onPress: () => setSort(s.key),
        })),
        { text: "Cancel", style: "cancel" as const },
      ],
    );
  };

  const sortLabel = SORT_TABS.find((s) => s.key === sort)?.label ?? "Sort";

  const openProduct = (item: Product) => {
    if (selectMode) {
      toggleSelect(item.id);
      return;
    }
    router.push(`/(seller)/products/${item.id}` as any);
  };

  const onLongPressProduct = (item: Product) => {
    if (!selectMode) {
      setSelectMode(true);
      setSelectedIds(new Set([item.id]));
    } else {
      toggleSelect(item.id);
    }
  };

  const renderProduct = ({ item }: { item: Product }) => {
    const stock = describeStock(productAvailableStock(item));
    const selected = selectedIds.has(item.id);
    const sc = statusTone(item.status);
    const sold = item.total_sales ?? 0;
    return (
      <View style={[styles.productCard, selected && styles.productCardSelected]}>
        {selectMode && (
          <TouchableOpacity
            style={styles.checkbox}
            onPress={() => toggleSelect(item.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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
          style={styles.productCardMain}
          onPress={() => openProduct(item)}
          onLongPress={() => onLongPressProduct(item)}
          delayLongPress={350}
          activeOpacity={0.75}
        >
          <ProductThumb uri={productImageUrl(item)} style={styles.productImage} />
          <View style={styles.productInfo}>
            <View style={styles.productHeader}>
              <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
              <View style={styles.badges}>
                <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                  <Text style={[styles.statusText, { color: sc.text }]}>{sc.label}</Text>
                </View>
                <ModerationChip p={item} />
              </View>
            </View>
            <Text style={styles.productSku}>{item.sku ?? item.slug ?? "—"}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaPrice}>{productPrice(item)}</Text>
              <Text style={styles.metaSep}>·</Text>
              <Text style={[styles.metaItem, stock.tone === "out" && styles.stockOut, stock.tone === "low" && styles.stockLow]}>
                {stock.label}
              </Text>
              <Text style={styles.metaSep}>·</Text>
              <Text style={styles.metaItem}>{sold} sold</Text>
              {item.created_at ? (
                <>
                  <Text style={styles.metaSep}>·</Text>
                  <Text style={styles.metaItem}>{formatDate(item.created_at)}</Text>
                </>
              ) : null}
            </View>
          </View>
        </TouchableOpacity>
        {!selectMode && (
          <TouchableOpacity
            style={styles.moreBtn}
            onPress={() => showActions(item, (k) => handleAction(item, k))}
            disabled={busyId === item.id}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="More actions"
          >
            {busyId === item.id ? (
              <ActivityIndicator size="small" color={colors.olive[700]} />
            ) : (
              <Ionicons name="ellipsis-vertical" size={18} color={colors.ink.mute} />
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderGrid = ({ item }: { item: Product }) => {
    const stock = describeStock(productAvailableStock(item));
    const selected = selectedIds.has(item.id);
    const sc = statusTone(item.status);
    const tone = stockColors(stock.tone);
    return (
      <TouchableOpacity
        style={[styles.gridCard, selected && styles.gridCardSelected]}
        onPress={() => openProduct(item)}
        onLongPress={() => onLongPressProduct(item)}
        delayLongPress={350}
        activeOpacity={0.85}
      >
        {selectMode ? (
          <View style={styles.gridCheckbox}>
            <Ionicons
              name={selected ? "checkbox" : "square-outline"}
              size={18}
              color={selected ? CREAM : CREAM}
            />
          </View>
        ) : null}
        <View style={styles.gridImageWrap}>
          <ProductThumb uri={productImageUrl(item)} style={styles.gridImage} />
          <View style={[styles.gridStatusPill, { backgroundColor: sc.bg }]}>
            <Text style={[styles.gridStatusText, { color: sc.text }]}>{sc.label}</Text>
          </View>
          <View style={[styles.gridStockPill, { backgroundColor: tone.bg }]}>
            <Text style={[styles.gridStockText, { color: tone.text }]}>{stock.short}</Text>
          </View>
        </View>
        <View style={styles.gridBody}>
          <Text style={styles.gridName} numberOfLines={2}>{item.name}</Text>
          <Text style={styles.gridSku} numberOfLines={1}>{item.sku ?? "—"}</Text>
          <View style={styles.gridFooter}>
            <Text style={styles.gridPrice}>{productPrice(item)}</Text>
            <Text style={styles.gridSales}>{item.total_sales ?? 0} sold</Text>
          </View>
          <ModerationChip p={item} />
        </View>
      </TouchableOpacity>
    );
  };

  const empty = useMemo(() => {
    // A failed fetch must not read as "the collection is empty".
    if (listError) {
      return {
        icon: "cloud-offline-outline" as const,
        title: "Couldn’t load the collection",
        sub: listError,
        showCta: false,
        showRetry: true,
      };
    }
    if (search || status !== "all") {
      return {
        icon: "search-outline" as const,
        title: "No matches",
        sub: "Try a different search or status filter.",
        showCta: false,
        showRetry: false,
      };
    }
    return {
      icon: "cube-outline" as const,
      title: "The collection is empty",
      sub: "Add a piece to start listing in the maison.",
      showCta: true,
      showRetry: false,
    };
  }, [search, status, listError]);

  const countLabel = (() => {
    if (loading && products.length === 0) return "Loading";
    if (total > 0) {
      return products.length < total
        ? `${products.length} of ${total}`
        : `${total} ${total === 1 ? "piece" : "pieces"}`;
    }
    return products.length === 0 ? "No pieces yet" : `${products.length} pieces`;
  })();

  const listFooter = loadingMore ? (
    <View style={styles.footerLoader}>
      <ActivityIndicator size="small" color={colors.olive[700]} />
    </View>
  ) : hasMore && products.length > 0 ? (
    <TouchableOpacity style={styles.loadMoreBtn} onPress={onEndReached}>
      <Text style={styles.loadMoreText}>Load more</Text>
    </TouchableOpacity>
  ) : products.length > 0 ? (
    <View style={styles.footerEnd}>
      <Text style={styles.footerEndText}>End of collection</Text>
    </View>
  ) : null;

  const emptyEl = loading ? (
    <ProductListSkeleton />
  ) : (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name={empty.icon} size={28} color={colors.olive[700]} />
      </View>
      <Text style={styles.emptyTitle}>{empty.title}</Text>
      <Text style={styles.emptySub}>{empty.sub}</Text>
      {empty.showCta ? (
        <TouchableOpacity
          style={styles.emptyCta}
          onPress={() => router.push("/(seller)/products/new" as any)}
        >
          <Ionicons name="add" size={16} color={CREAM} />
          <Text style={styles.emptyCtaText}>Add a piece</Text>
        </TouchableOpacity>
      ) : null}
      {empty.showRetry ? (
        <TouchableOpacity
          style={styles.emptyCta}
          onPress={() => void loadPage(0, false)}
          accessibilityRole="button"
          accessibilityLabel="Retry loading products"
        >
          <Text style={styles.emptyCtaText}>Try again</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );

  if (storeError && !storeId) {
    return (
      <View style={[styles.container, styles.errorWrap, { paddingTop: Math.max(insets.top, 24) }]}>
        <StatusBar barStyle="dark-content" />
        <Ionicons name="cloud-offline-outline" size={40} color={colors.olive[700]} />
        <Text style={styles.emptyTitle}>Couldn’t load the collection</Text>
        <Text style={styles.emptySub}>{storeError}</Text>
        <TouchableOpacity style={styles.emptyCta} onPress={() => void loadStore()}>
          <Text style={styles.emptyCtaText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 8 }]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.kicker}>Catalogue</Text>
          <Text style={styles.title}>Products</Text>
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
                onPress={openOverflowMenu}
                disabled={exporting}
                accessibilityLabel="More actions"
              >
                {exporting ? (
                  <ActivityIndicator size="small" color={INK} />
                ) : (
                  <Ionicons name="ellipsis-horizontal" size={18} color={INK} />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => router.push("/(seller)/products/new" as any)}
                accessibilityLabel="Add a piece"
              >
                <Ionicons name="add" size={18} color={CREAM} />
                <Text style={styles.addButtonText}>Add</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
      <View style={styles.goldRule} />

      <View style={styles.searchContainer}>
        <SellerSearchField
          value={search}
          onChangeText={setSearch}
          placeholder="Search the collection"
          style={{ flex: 1 }}
        />
        <View style={styles.viewToggle}>
          <TouchableOpacity
            style={[styles.viewBtn, viewMode === "list" && styles.viewBtnActive]}
            onPress={() => setViewMode("list")}
            accessibilityLabel="List view"
          >
            <Ionicons
              name="list-outline"
              size={16}
              color={viewMode === "list" ? CREAM : colors.olive[800]}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewBtn, viewMode === "grid" && styles.viewBtnActive]}
            onPress={() => setViewMode("grid")}
            accessibilityLabel="Grid view"
          >
            <Ionicons
              name="grid-outline"
              size={16}
              color={viewMode === "grid" ? CREAM : colors.olive[800]}
            />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.chipRow}>
        <TouchableOpacity
          style={[styles.sortChip, styles.sortTrigger]}
          onPress={openSortMenu}
          accessibilityRole="button"
          accessibilityLabel={`Sort by ${sortLabel}`}
        >
          <Ionicons name="swap-vertical" size={14} color={colors.olive[800]} />
          <Text style={styles.sortChipText} numberOfLines={1}>
            {sortLabel}
          </Text>
        </TouchableOpacity>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={STATUS_TABS}
          keyExtractor={(s) => s.key}
          style={styles.statusList}
          renderItem={({ item: s }) => {
            const active = status === s.key;
            const count = stats ? stats[s.key] : undefined;
            return (
              <SellerFilterTab
                label={s.label}
                count={typeof count === "number" ? count : undefined}
                active={active}
                onPress={() => setStatus(s.key)}
              />
            );
          }}
          contentContainerStyle={styles.tabsContent}
        />
      </View>

      {viewMode === "grid" ? (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          renderItem={renderGrid}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.olive[700]} />}
          contentContainerStyle={[styles.listContent, selectMode && { paddingBottom: 96 }]}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          ListFooterComponent={listFooter}
          ListEmptyComponent={emptyEl}
        />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          renderItem={renderProduct}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.olive[700]} />}
          contentContainerStyle={[styles.listContent, selectMode && { paddingBottom: 96 }]}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          ListFooterComponent={listFooter}
          ListEmptyComponent={emptyEl}
        />
      )}

      {selectMode && (
        <View style={[styles.bulkBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Text style={styles.bulkCount}>{selectedIds.size} selected</Text>
          <View style={styles.bulkActions}>
            <TouchableOpacity
              style={[styles.bulkBtn, styles.bulkBtnGhost]}
              onPress={() => bulkApply("archived")}
              disabled={bulkBusy}
            >
              <Text style={styles.bulkBtnGhostText}>Archive</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bulkBtn, styles.bulkBtnGhost]}
              onPress={() => bulkApply("active")}
              disabled={bulkBusy}
            >
              <Text style={styles.bulkBtnGhostText}>Activate</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bulkBtn, styles.bulkBtnGhost]}
              onPress={() => bulkApply("draft")}
              disabled={bulkBusy}
            >
              <Text style={styles.bulkBtnGhostText}>Draft</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bulkBtn, styles.bulkBtnDanger]}
              onPress={bulkDelete}
              disabled={bulkBusy}
              accessibilityLabel="Delete selected"
            >
              <Ionicons name="trash" size={14} color={CREAM} />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  errorWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 8,
  },

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
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.olive[800],
    paddingHorizontal: 16,
    minHeight: 44,
    borderRadius: radii.full,
  },
  addButtonText: {
    color: CREAM,
    fontSize: typography.fontSizes.sm,
    fontFamily: fontFamilies.sans.semibold,
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

  searchContainer: {
    flexDirection: "row",
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    marginBottom: spacing[2],
    gap: 8,
    alignItems: "center",
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: CREAM,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.14)",
    borderRadius: radii.xl,
    paddingHorizontal: 12,
    minHeight: 44,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: typography.fontSizes.sm,
    fontFamily: fontFamilies.sans.regular,
    color: colors.light.foreground,
  },
  viewToggle: {
    flexDirection: "row",
    backgroundColor: CREAM,
    borderRadius: radii.lg,
    padding: 2,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.14)",
  },
  viewBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.md,
  },
  viewBtnActive: { backgroundColor: colors.olive[800] },

  chipRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    paddingLeft: spacing[5],
    gap: 8,
  },
  statusList: { flexGrow: 0, flexShrink: 1 },
  tabsContent: { paddingRight: spacing[5], gap: 8 },
  sortChip: {
    paddingHorizontal: 14,
    minHeight: 44,
    justifyContent: "center",
    borderRadius: radii.full,
    backgroundColor: CREAM,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.14)",
  },
  sortTrigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    maxWidth: 120,
    flexShrink: 0,
  },
  sortChipActive: {
    backgroundColor: colors.olive[800],
    borderColor: colors.olive[800],
  },
  sortChipText: {
    fontSize: 12,
    color: colors.olive[800],
    fontFamily: fontFamilies.sans.medium,
  },
  sortChipTextActive: { color: CREAM },

  listContent: { padding: spacing[5], paddingTop: 4 },

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

  productCard: {
    flexDirection: "row",
    backgroundColor: CREAM,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.12)",
    marginBottom: 10,
    overflow: "hidden",
    alignItems: "stretch",
  },
  productCardSelected: {
    borderColor: colors.olive[600],
    backgroundColor: colors.olive[50],
  },
  productCardMain: { flex: 1, flexDirection: "row" },
  checkbox: {
    width: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: "rgba(83,94,44,0.12)",
    backgroundColor: colors.light.background,
  },
  moreBtn: {
    width: 44,
    alignItems: "center",
    justifyContent: "center",
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: "rgba(83,94,44,0.12)",
  },
  productImage: { width: 80, height: 104 },
  thumbEmpty: {
    backgroundColor: colors.paper.warm,
    justifyContent: "center",
    alignItems: "center",
  },
  productInfo: { flex: 1, paddingVertical: 12, paddingHorizontal: 12, justifyContent: "center" },
  productHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  productName: {
    fontSize: typography.fontSizes.sm,
    fontFamily: fontFamilies.display.semibold,
    color: INK,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  statusText: {
    fontSize: 10,
    fontFamily: fontFamilies.sans.semibold,
    letterSpacing: 0.3,
  },
  badges: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 0 },
  modChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  modChipText: { fontSize: 10, fontFamily: fontFamilies.sans.semibold },

  productSku: {
    fontSize: 11,
    color: colors.light.mutedForeground,
    fontFamily: fontFamilies.mono.regular,
    marginTop: 4,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 8,
    gap: 4,
  },
  metaPrice: {
    fontSize: typography.fontSizes.xs,
    fontFamily: fontFamilies.sans.semibold,
    color: INK,
  },
  metaItem: {
    fontSize: typography.fontSizes.xs,
    fontFamily: fontFamilies.sans.regular,
    color: colors.light.mutedForeground,
  },
  metaSep: { fontSize: 10, color: colors.light.mutedForeground, opacity: 0.5 },
  stockOut: { color: RUST, fontFamily: fontFamilies.sans.semibold },
  stockLow: { color: GOLD, fontFamily: fontFamilies.sans.semibold },

  gridRow: {
    gap: 10,
    marginBottom: 10,
  },
  gridCard: {
    flex: 1,
    backgroundColor: CREAM,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.12)",
    overflow: "hidden",
  },
  gridCardSelected: {
    borderColor: colors.olive[600],
    backgroundColor: colors.olive[50],
  },
  gridImageWrap: { position: "relative" },
  gridImage: {
    width: "100%",
    aspectRatio: 3 / 4,
  },
  gridCheckbox: {
    position: "absolute",
    top: 8,
    left: 8,
    zIndex: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(22,26,10,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  gridStatusPill: {
    position: "absolute",
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  gridStatusText: {
    fontSize: 9,
    fontFamily: fontFamilies.sans.semibold,
  },
  gridStockPill: {
    position: "absolute",
    bottom: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  gridStockText: {
    fontSize: 10,
    fontFamily: fontFamilies.sans.semibold,
  },
  gridBody: { padding: 12, gap: 3 },
  gridName: {
    fontSize: typography.fontSizes.sm,
    fontFamily: fontFamilies.display.semibold,
    color: INK,
    minHeight: 36,
  },
  gridSku: {
    fontSize: 10,
    color: colors.light.mutedForeground,
    fontFamily: fontFamilies.mono.regular,
  },
  gridFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
  },
  gridPrice: {
    fontSize: typography.fontSizes.sm,
    fontFamily: fontFamilies.sans.semibold,
    color: INK,
  },
  gridSales: {
    fontSize: 9,
    color: colors.light.mutedForeground,
    fontFamily: fontFamilies.sans.medium,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },

  emptyContainer: { alignItems: "center", paddingVertical: 56 },
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
    lineHeight: 20,
  },
  emptyCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.olive[800],
    paddingHorizontal: 18,
    minHeight: 44,
    borderRadius: radii.full,
    marginTop: 20,
  },
  emptyCtaText: {
    color: CREAM,
    fontSize: typography.fontSizes.sm,
    fontFamily: fontFamilies.sans.semibold,
  },

  footerLoader: { paddingVertical: 16, alignItems: "center" },
  footerEnd: { paddingVertical: 20, alignItems: "center" },
  footerEndText: {
    fontSize: 11,
    color: colors.light.mutedForeground,
    fontFamily: fontFamilies.sans.regular,
    opacity: 0.7,
  },
  loadMoreBtn: {
    marginTop: 8,
    marginHorizontal: 16,
    minHeight: 44,
    borderRadius: radii.lg,
    backgroundColor: CREAM,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  loadMoreText: {
    fontSize: typography.fontSizes.sm,
    color: colors.olive[800],
    fontFamily: fontFamilies.sans.medium,
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
  },
  bulkCount: {
    color: CREAM,
    fontSize: typography.fontSizes.sm,
    fontFamily: fontFamilies.sans.semibold,
  },
  bulkActions: { flexDirection: "row", gap: 6 },
  bulkBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    minHeight: 36,
    borderRadius: radii.md,
  },
  bulkBtnGhost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(250,248,241,0.35)",
  },
  bulkBtnGhostText: {
    color: CREAM,
    fontSize: typography.fontSizes.xs,
    fontFamily: fontFamilies.sans.semibold,
  },
  bulkBtnDanger: {
    backgroundColor: RUST,
    width: 36,
    paddingHorizontal: 0,
  },
});
