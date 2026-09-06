import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  StatusBar,
  ScrollView,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@/components/ui/Icon";
import { useAuth } from "@/lib/supabase/auth";
import { getSellerStore, getSellerReturns, type SellerReturnRequest } from "@/lib/api";
import { colors, typography, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";
import { Skeleton } from "@/components/ui/Skeleton";
import { SellerBackButton } from "@/components/seller/SellerBackButton";
import {
  SellerSearchField,
  SellerFilterTab,
  SellerStateView,
  SellerStatusPill,
} from "@/components/seller/chrome";
import {
  countReturnsByStatus,
  filterSellerReturns,
  formatReturnStatusLabel,
  returnRefundAmount,
} from "@/lib/returns/seller-list";

const RUST = colors.accent2.rust;
const CREAM = colors.paper.cream;
const INK = colors.olive[950];

const STATUS_TABS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "requested", label: "Requested" },
  { key: "approved", label: "Approved" },
  { key: "received", label: "Received" },
  { key: "refunded", label: "Refunded" },
  { key: "rejected", label: "Rejected" },
];

const STATUS_TONE: Record<string, { bg: string; text: string }> = {
  requested: { bg: "rgba(200,164,74,0.18)", text: "#8a6a2a" },
  approved: { bg: "rgba(83,94,44,0.12)", text: colors.olive[800] },
  received: { bg: "rgba(83,94,44,0.16)", text: colors.olive[900] },
  refunded: { bg: "rgba(83,94,44,0.14)", text: colors.olive[800] },
  rejected: { bg: "rgba(184,92,58,0.12)", text: RUST },
};

function formatRelative(dateStr: string) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "—";
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-LK", { day: "numeric", month: "short" });
}

function refundMoney(row: SellerReturnRequest): string {
  const amount = returnRefundAmount(row);
  if (amount == null) return "—";
  return formatPrice(amount, row.currency || "LKR");
}

function ReturnsSkeleton() {
  return (
    <View style={{ paddingHorizontal: spacing[5], gap: 12 }}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.skelCard}>
          <Skeleton width="40%" height={14} />
          <Skeleton width="80%" height={12} />
          <Skeleton width="50%" height={12} />
        </View>
      ))}
    </View>
  );
}

export default function SellerReturns() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [storeId, setStoreId] = useState<string | null>(null);
  const [returns, setReturns] = useState<SellerReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState("all");
  const [loadError, setLoadError] = useState<string | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const fetchReturns = useCallback(async () => {
    if (!user) return;
    let sid = storeId;
    if (!sid) {
      const storeRes = await getSellerStore(user.id);
      if (!storeRes.ok || !storeRes.data) {
        setLoadError(storeRes.ok ? "No store found for this account." : storeRes.error);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      sid = storeRes.data.id;
      setStoreId(sid);
    }
    const res = await getSellerReturns(sid);
    if (res.ok) {
      setReturns(res.data);
      setLoadError(null);
    } else {
      setLoadError(res.error);
    }
    setLoading(false);
    setRefreshing(false);
  }, [user, storeId]);

  useEffect(() => {
    void fetchReturns();
  }, [fetchReturns]);

  useFocusEffect(
    useCallback(() => {
      if (!mountedRef.current) {
        mountedRef.current = true;
        return;
      }
      void fetchReturns();
    }, [fetchReturns]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void fetchReturns();
  }, [fetchReturns]);

  const counts = useMemo(() => countReturnsByStatus(returns), [returns]);
  const visible = useMemo(
    () => filterSellerReturns(returns, { status: statusTab, search }),
    [returns, statusTab, search],
  );

  const headerCount = loadError && returns.length === 0
    ? "Unavailable"
    : search || statusTab !== "all"
      ? `${visible.length} match${visible.length === 1 ? "" : "es"}`
      : returns.length === 0
        ? "None"
        : `${returns.length} total`;

  const renderReturn = ({ item }: { item: SellerReturnRequest }) => {
    const tone = STATUS_TONE[item.status] ?? STATUS_TONE.requested;
    const product = item.product_name ?? item.items[0]?.product_name;
    const variant = item.variant_label ?? item.items[0]?.variant_label;
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/(seller)/returns/${item.id}` as const)}
        accessibilityRole="button"
        accessibilityLabel={`${item.order_number || "Return"}, ${formatReturnStatusLabel(item.status)}`}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.orderNumber} numberOfLines={1}>
            {item.order_number || item.return_number || "—"}
          </Text>
          <SellerStatusPill
            label={formatReturnStatusLabel(item.status)}
            bg={tone.bg}
            color={tone.text}
            dotted={item.status === "requested"}
          />
        </View>
        {product ? (
          <Text style={styles.product} numberOfLines={2}>
            {product}
            {variant ? ` · ${variant}` : ""}
          </Text>
        ) : null}
        <Text style={styles.meta} numberOfLines={2}>
          {[formatRelative(item.created_at), item.buyer_name, item.reason].filter(Boolean).join(" · ") || "—"}
        </Text>
        <View style={styles.footer}>
          <Text style={styles.refund}>{refundMoney(item)}</Text>
          <Text style={styles.action}>Review</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 8 }]}>
        <SellerBackButton label="More" fallbackHref="/(seller)/more" style={{ marginBottom: 4 }} />
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>Atelier</Text>
            <Text style={styles.title}>Returns</Text>
          </View>
          <Text style={styles.count}>{headerCount}</Text>
        </View>
      </View>
      <View style={styles.goldRule} />

      <View style={styles.searchContainer}>
        <SellerSearchField
          value={searchInput}
          onChangeText={setSearchInput}
          placeholder="Search order, piece, buyer…"
          accessibilityLabel="Search returns"
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsContent}
        style={styles.tabsContainer}
      >
        {STATUS_TABS.map((tab) => (
          <SellerFilterTab
            key={tab.key}
            label={tab.label}
            count={counts[tab.key as keyof typeof counts] ?? 0}
            active={statusTab === tab.key}
            onPress={() => setStatusTab(tab.key)}
          />
        ))}
      </ScrollView>

      {loading && returns.length === 0 ? (
        <ReturnsSkeleton />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          renderItem={renderReturn}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.olive[800]} />
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <SellerStateView
              variant={loadError ? "error" : "empty"}
              icon={loadError ? "cloud-offline-outline" : "return-down-back-outline"}
              title={loadError ? "Couldn’t load returns" : search ? "Nothing matches" : "No returns"}
              description={
                loadError ??
                (search
                  ? "Try a different order number or buyer name."
                  : "Buyer return requests for this store will appear here.")
              }
              actionLabel={loadError ? "Try again" : undefined}
              onAction={loadError ? onRefresh : undefined}
              style={{ marginTop: 24 }}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper.DEFAULT },
  header: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[3],
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 12,
  },
  kicker: {
    fontFamily: fontFamilies.mono.medium,
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
    fontFamily: fontFamilies.mono.medium,
    fontSize: 11,
    letterSpacing: 0.4,
    color: colors.olive[700],
    paddingBottom: 6,
  },
  goldRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(200,164,74,0.55)",
    marginHorizontal: spacing[5],
    marginBottom: spacing[3],
  },
  searchContainer: { paddingHorizontal: spacing[5], marginBottom: spacing[3] },
  searchInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    paddingHorizontal: 14,
    gap: 8,
    backgroundColor: CREAM,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.16)",
  },
  searchInput: {
    flex: 1,
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    color: INK,
    paddingVertical: 10,
  },
  tabsContainer: { marginBottom: 8, flexGrow: 0 },
  tabsContent: { paddingHorizontal: spacing[5], gap: 8, paddingBottom: 4 },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 36,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.full,
    backgroundColor: CREAM,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.16)",
    gap: 6,
  },
  tabActive: {
    backgroundColor: colors.olive[900],
    borderColor: colors.olive[900],
  },
  tabText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: typography.fontSizes.xs,
    color: colors.olive[800],
  },
  tabTextActive: { color: CREAM, fontFamily: fontFamilies.sans.semibold },
  tabCount: {
    backgroundColor: "rgba(83,94,44,0.1)",
    borderRadius: radii.full,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 20,
    alignItems: "center",
  },
  tabCountActive: { backgroundColor: "rgba(250,248,241,0.18)" },
  tabCountText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    color: colors.olive[800],
  },
  tabCountTextActive: { color: CREAM },
  listContent: { paddingHorizontal: spacing[5], paddingTop: 8, paddingBottom: 48 },
  card: {
    backgroundColor: CREAM,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.12)",
    padding: 14,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  orderNumber: {
    flex: 1,
    fontFamily: fontFamilies.mono.medium,
    fontSize: 13,
    color: INK,
    letterSpacing: 0.2,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  badgeText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 11,
  },
  product: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 15,
    color: INK,
    marginTop: 8,
  },
  meta: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.olive[800],
    marginTop: 4,
    lineHeight: 18,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
  },
  refund: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 16,
    color: INK,
  },
  action: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 11,
    color: colors.olive[800],
  },
  emptyContainer: {
    alignItems: "center",
    paddingTop: 48,
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: CREAM,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 20,
    color: INK,
    textAlign: "center",
  },
  emptySub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    color: colors.olive[700],
    textAlign: "center",
    lineHeight: 20,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: -6,
    marginBottom: 2,
  },
  retryBtn: {
    marginTop: 14,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: radii.full,
    backgroundColor: colors.olive[700],
  },
  retryLabel: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: typography.fontSizes.sm,
    color: CREAM,
  },
  skelCard: {
    backgroundColor: CREAM,
    borderRadius: radii["2xl"],
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.08)",
    gap: 10,
  },
});
