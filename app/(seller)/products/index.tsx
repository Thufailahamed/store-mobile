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
  SellerFilterTab,
  SellerGlow,
  SellerSearchField,
  SELLER_CREAM,
  SELLER_INK,
  SELLER_RUST,
  SELLER_GOLD,
} from "@/components/seller/chrome";
import type { Product } from "@/lib/types";
const RUST = SELLER_RUST;
const CREAM = SELLER_CREAM;
const INK = SELLER_INK;
const GOLD = SELLER_GOLD;
const LIVE_GREEN = "#5f9a4a";
const CARD_SHADOW = {
  shadowColor: "#161a0a",
  shadowOpacity: 0.06,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 6 },
  elevation: 2,
} as const;

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
  if (n <= 0) return { label: "Out of stock", short: "Sold out", tone: "out" };
  if (n <= LOW_STOCK_THRESHOLD) return { label: `Only ${n} left`, short: `${n} left`, tone: "low" };
  return { label: `${n} in stock`, short: `${n} in stock`, tone: "ok" };
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
    <View style={{ paddingHorizontal: spacing[5], paddingTop: 4, gap: 12 }}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={styles.skeletonCard}>
          <Skeleton width={96} height={124} borderRadius={16} />
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
    const addManually = () => router.push("/(seller)/products/create" as any);
    const opts = ["Add product manually", "Export CSV", "Cancel"];
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: opts, cancelButtonIndex: 2 },
        (i) => {
          if (i === 0) addManually();
          if (i === 1) void exportCsv();
        },
      );
    } else {
      Alert.alert("More", undefined, [
        { text: "Add product manually", onPress: addManually },
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
    const tone = stockColors(stock.tone);
    const isLive = item.status === "active";
    return (
      <TouchableOpacity
        style={[styles.productCard, selected && styles.productCardSelected]}
        onPress={() => openProduct(item)}
        onLongPress={() => onLongPressProduct(item)}
        delayLongPress={350}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, ${sc.label}, ${stock.label}`}
      >
        <View style={styles.productImageWrap}>
          <ProductThumb uri={productImageUrl(item)} style={styles.productImage} />
          <View style={styles.imageStatus}>
            <View style={[styles.imageStatusDot, { backgroundColor: isLive ? LIVE_GREEN : sc.text }]} />
            <Text style={styles.imageStatusText}>{sc.label}</Text>
          </View>
          {selectMode ? (
            <View style={[styles.checkbox, selected && styles.checkboxOn]}>
              {selected ? <Ionicons name="checkmark" size={14} color={CREAM} /> : null}
            </View>
          ) : null}
        </View>
        <View style={styles.productInfo}>
          <View style={styles.productTitleRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.productSku} numberOfLines={1}>{item.sku ?? item.slug ?? "—"}</Text>
              <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
            </View>
            {selectMode ? null : (
              <TouchableOpacity
                style={styles.moreBtn}
                onPress={() => showActions(item, (key) => handleAction(item, key))}
                disabled={busyId === item.id}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel={`More actions for ${item.name}`}
              >
                {busyId === item.id ? (
                  <ActivityIndicator size="small" color={colors.olive[700]} />
                ) : (
                  <Ionicons name="ellipsis-horizontal" size={16} color={colors.ink.mute} />
                )}
              </TouchableOpacity>
            )}
          </View>
          <ModerationChip p={item} />
          <Text style={styles.metaPrice}>{productPrice(item)}</Text>
          <View style={styles.cardRule} />
          <View style={styles.productFooter}>
            <View style={styles.stockInline}>
              <View style={[styles.stockDot, { backgroundColor: stock.tone === "ok" ? LIVE_GREEN : tone.text }]} />
              <Text style={[styles.stockInlineText, { color: tone.text }]} numberOfLines={1}>{stock.label}</Text>
            </View>
            <View style={styles.soldInline}>
              <Ionicons name="trending-up" size={12} color={colors.ink.mute} />
              <Text style={styles.soldText}>{sold} sold</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderGrid = ({ item }: { item: Product }) => {
    const stock = describeStock(productAvailableStock(item));
    const selected = selectedIds.has(item.id);
    const sc = statusTone(item.status);
    const tone = stockColors(stock.tone);
    const isLive = item.status === "active";
    return (
      <TouchableOpacity
        style={[styles.gridCard, selected && styles.gridCardSelected]}
        onPress={() => openProduct(item)}
        onLongPress={() => onLongPressProduct(item)}
        delayLongPress={350}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, ${sc.label}, ${stock.label}`}
      >
        <View style={styles.gridImageWrap}>
          <ProductThumb uri={productImageUrl(item)} style={styles.gridImage} />
          <View style={[styles.imageStatus, styles.gridStatusPos]}>
            <View style={[styles.imageStatusDot, { backgroundColor: isLive ? LIVE_GREEN : sc.text }]} />
            <Text style={styles.imageStatusText}>{sc.label}</Text>
          </View>
          {selectMode ? (
            <View style={[styles.checkbox, styles.gridCheckboxPos, selected && styles.checkboxOn]}>
              {selected ? <Ionicons name="checkmark" size={14} color={CREAM} /> : null}
            </View>
          ) : null}
        </View>
        <View style={styles.gridBody}>
          <Text style={styles.productSku} numberOfLines={1}>{item.sku ?? "—"}</Text>
          <Text style={styles.gridName} numberOfLines={2}>{item.name}</Text>
          <Text style={styles.gridPrice}>{productPrice(item)}</Text>
          <View style={styles.gridFooter}>
            <View style={styles.stockInline}>
              <View style={[styles.stockDot, { backgroundColor: stock.tone === "ok" ? LIVE_GREEN : tone.text }]} />
              <Text style={[styles.gridStockText, { color: tone.text }]} numberOfLines={1}>{stock.short}</Text>
            </View>
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

  const filtered = status !== "all" || !!search;
  const shownCount = total || products.length;

  const attention = stats ? stats.pending + stats.flagged : 0;
  const overview = stats
    ? [
        { key: "active" as StatusKey, label: "Live", value: stats.active, icon: "radio-button-on" as const },
        { key: "draft" as StatusKey, label: "Drafts", value: stats.draft, icon: "create-outline" as const },
        {
          key: (stats.flagged > 0 ? "flagged" : "pending") as StatusKey,
          label: "Attention",
          value: attention,
          icon: "alert-circle-outline" as const,
        },
      ]
    : null;

  const listHeader = (
    <View>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 10 }]}>
        <View style={styles.headerCopy}>
          <Text style={styles.title} accessibilityRole="header">Products</Text>
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
                onPress={openOverflowMenu}
                disabled={exporting}
                accessibilityRole="button"
                accessibilityLabel="Catalogue actions"
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
                accessibilityRole="button"
                accessibilityLabel="Add product"
              >
                <View style={styles.addIcon}>
                  <Ionicons name="add" size={16} color={INK} />
                </View>
                <Text style={styles.addButtonText}>New</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {overview ? (
        <View style={styles.overview}>
          <View style={styles.overviewTop}>
            <Text style={styles.overviewKicker}>Collection</Text>
            <Text style={styles.overviewTotal}>
              {stats!.all}
              <Text style={styles.overviewTotalUnit}> {stats!.all === 1 ? "piece" : "pieces"}</Text>
            </Text>
          </View>
          <View style={styles.overviewRow}>
            {overview.map((m, i) => {
              const active = status === m.key;
              const warn = m.label === "Attention" && m.value > 0;
              return (
                <TouchableOpacity
                  key={m.label}
                  style={[styles.overviewCell, i > 0 && styles.overviewCellDivider]}
                  onPress={() => setStatus(active ? "all" : m.key)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${m.label}, ${m.value}`}
                >
                  <View style={styles.overviewLabelRow}>
                    <Ionicons name={m.icon} size={12} color={warn ? GOLD : colors.light.mutedForeground} />
                    <Text style={[styles.overviewLabel, active && { color: INK }]}>{m.label}</Text>
                  </View>
                  <Text style={[styles.overviewValue, warn && { color: GOLD }]}>{m.value}</Text>
                  {active ? <View style={styles.overviewActiveBar} /> : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={styles.toolbar}>
        <View style={{ flex: 1 }}>
          <SellerSearchField
            value={search}
            onChangeText={setSearch}
            placeholder="Search name or SKU"
          />
        </View>
        <View style={styles.viewToggle}>
          {(["list", "grid"] as const).map((mode) => {
            const on = viewMode === mode;
            return (
              <TouchableOpacity
                key={mode}
                style={[styles.viewToggleBtn, on && styles.viewToggleBtnOn]}
                onPress={() => setViewMode(mode)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={mode === "list" ? "List view" : "Grid view"}
              >
                <Ionicons
                  name={mode === "list" ? "list" : "grid-outline"}
                  size={16}
                  color={on ? CREAM : colors.ink.mute}
                />
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={STATUS_TABS}
        keyExtractor={(item) => item.key}
        style={styles.statusList}
        renderItem={({ item }) => (
          <SellerFilterTab
            label={item.label}
            count={stats ? stats[item.key] : undefined}
            active={status === item.key}
            onPress={() => setStatus(item.key)}
          />
        )}
        contentContainerStyle={styles.tabsContent}
      />

      <View style={styles.resultsHeader}>
        <Text style={styles.resultsText}>
          {loading && products.length === 0 ? "Loading…" : `${shownCount} ${shownCount === 1 ? "result" : "results"}`}
        </Text>
        <View style={styles.resultsActions}>
          {filtered ? (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => {
                setStatus("all");
                setSearch("");
              }}
              accessibilityRole="button"
              accessibilityLabel="Clear filters"
            >
              <Ionicons name="close" size={12} color={colors.olive[800]} />
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={styles.sortTrigger}
            onPress={openSortMenu}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={`Sort by ${sortLabel}`}
          >
            <Text style={styles.sortLabel}>Sort</Text>
            <Text style={styles.sortValue} numberOfLines={1}>{sortLabel}</Text>
            <Ionicons name="chevron-down" size={12} color={INK} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <SellerGlow />
      <StatusBar barStyle="dark-content" />
      {viewMode === "grid" ? (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          numColumns={2}
          key="grid"
          columnWrapperStyle={styles.gridRow}
          renderItem={renderGrid}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.olive[700]} />}
          contentContainerStyle={[styles.listContent, selectMode && { paddingBottom: 120 }]}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          ListHeaderComponent={listHeader}
          ListFooterComponent={listFooter}
          ListEmptyComponent={emptyEl}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          renderItem={renderProduct}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.olive[700]} />}
          contentContainerStyle={[styles.listContent, selectMode && { paddingBottom: 120 }]}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          ListHeaderComponent={listHeader}
          ListFooterComponent={listFooter}
          ListEmptyComponent={emptyEl}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        />
      )}

      <View pointerEvents="none" style={[styles.statusScrim, { height: insets.top }]} />

      {selectMode && (
        <View style={[styles.bulkBar, { bottom: Math.max(insets.bottom, 12) }]}>
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
  container: { flex: 1, backgroundColor: "#f8f7f2" },
  errorWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 8,
  },

  statusScrim: { position: "absolute", top: 0, left: 0, right: 0, backgroundColor: "#ebe5cc" },

  // Header
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
  kickerRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  kickerRule: { width: 18, height: 1, backgroundColor: GOLD },
  kicker: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: colors.olive[700],
  },
  title: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 31,
    color: INK,
    letterSpacing: -0.8,
  },
  iconBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    ...CARD_SHADOW,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: INK,
    paddingLeft: 6,
    paddingRight: 18,
    height: 46,
    borderRadius: radii.full,
    shadowColor: "#161a0a",
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  addIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#c8e08a",
    alignItems: "center",
    justifyContent: "center",
  },
  addButtonText: { color: CREAM, fontSize: 14, fontFamily: fontFamilies.sans.semibold, letterSpacing: 0.2 },
  cancelSelectBtn: {
    paddingHorizontal: 18,
    height: 42,
    justifyContent: "center",
    borderRadius: radii.full,
    backgroundColor: INK,
  },
  cancelSelectText: { color: CREAM, fontSize: 14, fontFamily: fontFamilies.sans.semibold },

  // Overview card
  overview: {
    marginHorizontal: spacing[5],
    marginBottom: spacing[4],
    backgroundColor: "#FFFFFF",
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(22,23,15,0.07)",
    paddingTop: 18,
    paddingBottom: 16,
    overflow: "hidden",
    shadowColor: "#16170f",
    shadowOpacity: 0.07,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  overviewTop: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    marginBottom: 14,
  },
  overviewKicker: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: colors.olive[600],
  },
  overviewTotal: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 22,
    color: INK,
    letterSpacing: -0.4,
  },
  overviewTotalUnit: {
    fontFamily: fontFamilies.display.italic,
    fontSize: 15,
    color: colors.light.mutedForeground,
  },
  overviewRow: { flexDirection: "row" },
  overviewCell: { flex: 1, paddingHorizontal: 18, paddingVertical: 2 },
  overviewCellDivider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: "rgba(22,23,15,0.08)" },
  overviewLabelRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  overviewLabel: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12,
    color: colors.light.mutedForeground,
  },
  overviewValue: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 28,
    lineHeight: 34,
    color: INK,
    marginTop: 2,
    fontVariant: ["tabular-nums"],
  },
  overviewActiveBar: { marginTop: 6, width: 18, height: 2, borderRadius: 1, backgroundColor: GOLD },

  // Toolbar
  toolbar: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing[5], gap: 10, marginBottom: 6 },
  searchField: { backgroundColor: "#FFFFFF", borderColor: "transparent", minHeight: 44, ...CARD_SHADOW },
  viewToggle: {
    flexDirection: "row",
    padding: 3,
    borderRadius: radii.full,
    backgroundColor: "#FFFFFF",
    ...CARD_SHADOW,
  },
  viewToggleBtn: { width: 36, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  viewToggleBtnOn: { backgroundColor: INK },

  // Editorial status tabs
  statusList: {
    flexGrow: 0,
    flexShrink: 0,
    marginTop: 12,
    marginBottom: 14,
  },
  tabsContent: { paddingHorizontal: spacing[5], gap: 10 },

  resultsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[5],
    marginBottom: 12,
    minHeight: 30,
  },
  resultsText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: colors.ink.mute,
  },
  resultsActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  sortTrigger: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 6 },
  sortLabel: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.ink.mute },
  sortValue: { fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: INK },
  clearButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: radii.full,
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: colors.olive[50],
  },
  clearButtonText: { fontFamily: fontFamilies.sans.semibold, fontSize: 11, color: colors.olive[800] },

  listContent: { paddingBottom: spacing[6] },

  skeletonCard: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 10,
    gap: 12,
  },

  // List card
  productCard: {
    flexDirection: "row",
    gap: 14,
    padding: 10,
    marginHorizontal: spacing[5],
    marginBottom: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "transparent",
    ...CARD_SHADOW,
  },
  productCardSelected: { borderColor: colors.olive[600], backgroundColor: colors.olive[50] },
  productImageWrap: { position: "relative" },
  productImage: { width: 96, height: 124, borderRadius: 16, backgroundColor: colors.paper.warm },
  thumbEmpty: { backgroundColor: colors.paper.warm, justifyContent: "center", alignItems: "center" },
  imageStatus: {
    position: "absolute",
    left: 6,
    bottom: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radii.full,
    backgroundColor: "rgba(250,248,241,0.92)",
  },
  imageStatusDot: { width: 5, height: 5, borderRadius: 3 },
  imageStatusText: { fontFamily: fontFamilies.sans.semibold, fontSize: 10, color: INK, letterSpacing: 0.2 },
  checkbox: {
    position: "absolute",
    top: 6,
    left: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    backgroundColor: "rgba(20,25,10,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: { backgroundColor: colors.olive[800], borderColor: colors.olive[800] },
  productInfo: { flex: 1, minWidth: 0, paddingVertical: 4, paddingRight: 4, gap: 4 },
  productTitleRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  productSku: {
    fontSize: 9.5,
    letterSpacing: 0.8,
    color: colors.ink.mute,
    fontFamily: fontFamilies.mono.regular,
    textTransform: "uppercase",
    marginBottom: 3,
  },
  productName: {
    fontSize: 16,
    lineHeight: 20,
    fontFamily: fontFamilies.sans.semibold,
    color: INK,
    letterSpacing: -0.2,
  },
  moreBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.paper.DEFAULT,
    alignItems: "center",
    justifyContent: "center",
  },
  modChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.full,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  modChipText: { fontSize: 11, fontFamily: fontFamilies.sans.semibold },
  metaPrice: {
    marginTop: "auto",
    paddingTop: 4,
    fontSize: 17,
    fontFamily: fontFamilies.sans.bold,
    color: INK,
    letterSpacing: -0.2,
    fontVariant: ["tabular-nums"],
  },
  cardRule: { height: StyleSheet.hairlineWidth, backgroundColor: "rgba(83,94,44,0.2)", marginTop: 4 },
  productFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingTop: 2 },
  stockInline: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
  stockDot: { width: 6, height: 6, borderRadius: 3 },
  stockInlineText: { fontFamily: fontFamilies.sans.semibold, fontSize: 12 },
  soldInline: { flexDirection: "row", alignItems: "center", gap: 4 },
  soldText: { fontFamily: fontFamilies.sans.medium, fontSize: 12, color: colors.ink.mute, fontVariant: ["tabular-nums"] },

  // Grid card
  gridRow: {
    gap: 12,
    paddingHorizontal: spacing[5],
    marginBottom: 12,
  },
  gridCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 6,
    borderWidth: 1,
    borderColor: "transparent",
    ...CARD_SHADOW,
  },
  gridCardSelected: {
    borderColor: colors.olive[600],
    backgroundColor: colors.olive[50],
  },
  gridImageWrap: { position: "relative" },
  gridImage: {
    width: "100%",
    aspectRatio: 4 / 5,
    borderRadius: 17,
    backgroundColor: colors.paper.warm,
  },
  gridStatusPos: { top: 8, left: 8, bottom: undefined },
  gridCheckboxPos: { top: 8, left: undefined, right: 8 },
  gridBody: { paddingHorizontal: 6, paddingTop: 10, paddingBottom: 6, gap: 2 },
  gridName: {
    fontSize: 14,
    lineHeight: 18,
    fontFamily: fontFamilies.sans.semibold,
    color: INK,
    minHeight: 36,
  },
  gridPrice: {
    marginTop: 6,
    fontSize: 14,
    fontFamily: fontFamilies.sans.bold,
    color: INK,
    fontVariant: ["tabular-nums"],
  },
  gridFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(83,94,44,0.2)",
    gap: 6,
  },
  gridStockText: { fontSize: 11, fontFamily: fontFamilies.sans.semibold },
  gridSales: {
    fontSize: 11,
    color: colors.ink.mute,
    fontFamily: fontFamilies.sans.medium,
    fontVariant: ["tabular-nums"],
  },

  emptyContainer: { alignItems: "center", paddingVertical: 56 },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    ...CARD_SHADOW,
  },
  emptyTitle: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 22,
    color: INK,
    marginTop: 18,
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
    backgroundColor: INK,
    paddingHorizontal: 20,
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
  footerEnd: { paddingVertical: 24, alignItems: "center" },
  footerEndText: {
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: colors.ink.mute,
    fontFamily: fontFamilies.mono.regular,
    opacity: 0.7,
  },
  loadMoreBtn: {
    marginTop: 8,
    marginHorizontal: spacing[5],
    minHeight: 46,
    borderRadius: radii.full,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    ...CARD_SHADOW,
  },
  loadMoreText: {
    fontSize: typography.fontSizes.sm,
    color: INK,
    fontFamily: fontFamilies.sans.semibold,
  },

  // Floating bulk bar
  bulkBar: {
    position: "absolute",
    left: spacing[4],
    right: spacing[4],
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingLeft: 18,
    paddingRight: 8,
    backgroundColor: INK,
    borderRadius: radii.full,
    shadowColor: "#161a0a",
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
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
    paddingHorizontal: 11,
    minHeight: 36,
    borderRadius: radii.full,
  },
  bulkBtnGhost: {
    backgroundColor: "rgba(250,248,241,0.1)",
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
