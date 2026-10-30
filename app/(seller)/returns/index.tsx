import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  StatusBar,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@/components/ui/Icon";
import { useAuth } from "@/lib/supabase/auth";
import { getSellerStore, getSellerReturns, type SellerReturnRequest } from "@/lib/api";
import { colors, typography, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice, pluralize } from "@/lib/utils";
import { Skeleton } from "@/components/ui/Skeleton";
import { SellerBackButton } from "@/components/seller/SellerBackButton";
import {
  SellerSearchField,
  SellerStateView,
  SellerStatusPill,
  SellerFilterTab,
  SellerGlow,
} from "@/components/seller/chrome";
import {
  countReturnsByStatus,
  filterSellerReturns,
  formatReturnStatusLabel,
  returnRefundAmount,
} from "@/lib/returns/seller-list";

const RUST = colors.accent2.rust;
const GOLD = colors.accent2.ochre;
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

const STATUS_TONE: Record<string, { bg: string; text: string; accent: string }> = {
  requested: { bg: "rgba(200,164,74,0.18)", text: "#8a6a2a", accent: GOLD },
  approved: { bg: "rgba(83,94,44,0.12)", text: colors.olive[800], accent: colors.olive[400] },
  received: { bg: "rgba(83,94,44,0.16)", text: colors.olive[900], accent: colors.olive[600] },
  refunded: { bg: "rgba(83,94,44,0.14)", text: colors.olive[800], accent: colors.olive[700] },
  rejected: { bg: "rgba(184,92,58,0.12)", text: RUST, accent: RUST },
};

const STATUS_ACTION: Record<string, string> = {
  requested: "Review request",
  approved: "Awaiting item",
  received: "Issue refund",
  refunded: "Completed",
  rejected: "Closed",
};

const RETURN_STEPS: { icon: keyof typeof Ionicons.glyphMap; label: string; desc: string }[] = [
  { icon: "mail-unread-outline", label: "Buyer requests", desc: "A return arrives with the buyer’s reason." },
  { icon: "checkmark-circle-outline", label: "You approve", desc: "Review the request, then approve or decline." },
  { icon: "cube-outline", label: "Item returns", desc: "Mark the piece received once it’s back." },
  { icon: "cash-outline", label: "Refund sent", desc: "Issue the refund to close the return." },
];

const CARD_SHADOW = {
  shadowColor: "#161a0a",
  shadowOpacity: 0.06,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 6 },
  elevation: 2,
} as const;

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

function EmptyReturnsState() {
  return (
    <View style={styles.emptyCard}>
      <View style={styles.emptyIconHalo}>
        <View style={styles.emptyIconCore}>
          <Ionicons name="return-down-back-outline" size={22} color={CREAM} />
        </View>
      </View>
      <Text style={styles.emptyTitle}>
        Nothing to return<Text style={styles.emptyTitleItalic}> — yet</Text>
      </Text>
      <Text style={styles.emptyDesc}>
        When a buyer requests a return, it lands here for your review.
      </Text>

      <View style={styles.emptyEyebrowRow}>
        <View style={styles.emptyRule} />
        <Text style={styles.emptyEyebrow}>How it works</Text>
        <View style={styles.emptyRule} />
      </View>

      <View style={styles.steps}>
        {RETURN_STEPS.map((step, i) => {
          const last = i === RETURN_STEPS.length - 1;
          return (
            <View key={step.label} style={styles.stepRow}>
              <View style={styles.stepRail}>
                <View style={styles.stepIconWrap}>
                  <Ionicons name={step.icon} size={15} color={colors.olive[800]} />
                </View>
                {!last ? <View style={styles.stepLine} /> : null}
              </View>
              <View style={[styles.stepCopy, !last && { paddingBottom: 16 }]}>
                <Text style={styles.stepNum}>{String(i + 1).padStart(2, "0")}</Text>
                <Text style={styles.stepLabel}>{step.label}</Text>
                <Text style={styles.stepDesc}>{step.desc}</Text>
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.emptyNote}>
        <Ionicons name="shield-checkmark-outline" size={14} color={GOLD} />
        <Text style={styles.emptyNoteText}>
          Buyers can return within <Text style={styles.emptyNoteStrong}>14 days</Text> of delivery
        </Text>
      </View>
    </View>
  );
}

function ReturnsSkeleton() {
  return (
    <View style={{ gap: 12 }}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.skelCard}>
          <Skeleton width="40%" height={14} />
          <Skeleton width="80%" height={16} />
          <Skeleton width="55%" height={12} />
          <Skeleton width="35%" height={12} />
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

  const clearFilters = useCallback(() => {
    setSearchInput("");
    setSearch("");
    setStatusTab("all");
  }, []);

  const counts = useMemo(() => countReturnsByStatus(returns), [returns]);
  const visible = useMemo(
    () => filterSellerReturns(returns, { status: statusTab, search }),
    [returns, statusTab, search],
  );

  const inFlight = counts.approved + counts.received;
  const refundExposure = useMemo(
    () =>
      returns
        .filter((r) => r.status === "requested" || r.status === "approved" || r.status === "received")
        .reduce((sum, r) => sum + (returnRefundAmount(r) ?? 0), 0),
    [returns],
  );
  const exposureCurrency = returns.find((r) => r.currency)?.currency ?? "LKR";

  const isFiltered = Boolean(search) || statusTab !== "all";
  const headerSubtitle = loadError && returns.length === 0
    ? "Return data unavailable"
    : returns.length === 0
      ? "No buyer returns yet"
      : counts.requested > 0
        ? `${pluralize(counts.requested, "request")} waiting on you`
        : `${returns.length} ${returns.length === 1 ? "return" : "returns"} · all handled`;

  const renderReturn = ({ item }: { item: SellerReturnRequest }) => {
    const tone = STATUS_TONE[item.status] ?? STATUS_TONE.requested;
    const product = item.product_name ?? item.items[0]?.product_name;
    const variant = item.variant_label ?? item.items[0]?.variant_label;
    const extraItems = Math.max(0, item.items.length - 1);
    const action = STATUS_ACTION[item.status] ?? "View";
    const urgent = item.status === "requested";

    return (
      <TouchableOpacity
        style={[styles.card, urgent && styles.cardUrgent]}
        onPress={() => router.push(`/(seller)/returns/${item.id}` as const)}
        accessibilityRole="button"
        accessibilityLabel={`${item.order_number || "Return"}, ${formatReturnStatusLabel(item.status)}`}
        activeOpacity={0.85}
      >
        <View style={styles.cardHeader}>
          <SellerStatusPill
            label={formatReturnStatusLabel(item.status)}
            bg={tone.bg}
            color={tone.text}
            dotted
          />
          <Text style={styles.time}>{formatRelative(item.created_at)}</Text>
        </View>

        {item.order_number ? (
          <Text style={styles.orderNo} numberOfLines={1}>{item.order_number}</Text>
        ) : null}
        <Text style={styles.product} numberOfLines={2}>
          {product ?? "Return request"}
        </Text>
        {variant || extraItems > 0 ? (
          <Text style={styles.variant} numberOfLines={1}>
            {variant ?? ""}
            {variant && extraItems > 0 ? "  ·  " : ""}
            {extraItems > 0 ? `+${extraItems} more` : ""}
          </Text>
        ) : null}

        <View style={styles.buyerRow}>
          <View style={styles.buyerAvatar}>
            <Text style={styles.buyerInitial}>
              {(item.buyer_name || "B").trim().charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.buyerName} numberOfLines={1}>{item.buyer_name || "Buyer"}</Text>
        </View>

        {item.reason ? (
          <View style={styles.reasonBox}>
            <View style={[styles.reasonBar, { backgroundColor: tone.accent }]} />
            <Text style={styles.reason} numberOfLines={2}>“{item.reason}”</Text>
          </View>
        ) : null}

        <View style={styles.footer}>
          <View>
            <Text style={styles.refundLabel}>Refund</Text>
            <Text style={styles.refund}>{refundMoney(item)}</Text>
          </View>
          <View style={[styles.actionPill, urgent && styles.actionPillUrgent]}>
            <Text style={[styles.action, urgent && styles.actionUrgent]}>{action}</Text>
            <Ionicons name="arrow-forward" size={12} color={urgent ? INK : colors.olive[800]} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const overview = [
    {
      key: "requested",
      label: "To review",
      value: String(counts.requested),
      icon: "mail-unread-outline" as const,
      warn: counts.requested > 0,
    },
    {
      key: "approved",
      label: "In progress",
      value: String(inFlight),
      icon: "sync-outline" as const,
      warn: false,
    },
    {
      key: null,
      label: "Exposure",
      value: refundExposure > 0 ? formatPrice(refundExposure, exposureCurrency) : "—",
      icon: "wallet-outline" as const,
      warn: false,
    },
  ];

  const listHeader = (
    <View>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 6 }]}>
        <SellerGlow />
        <View style={styles.headerRow}>
          <SellerBackButton label="More" fallbackHref="/(seller)/more" />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.title} accessibilityRole="header">Returns</Text>
          </View>
          {!loading && !loadError ? (
            <View style={[styles.queuePill, counts.requested > 0 && styles.queuePillWarn]}>
              <View style={[styles.queueDot, counts.requested > 0 && styles.queueDotWarn]} />
              <Text style={[styles.queuePillText, counts.requested > 0 && styles.queuePillTextWarn]}>
                {counts.requested > 0 ? `${counts.requested} to review` : "All clear"}
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.subtitle}>{headerSubtitle}</Text>
      </View>

      {!loadError && !isFiltered && !loading ? (
        <View style={styles.overview}>
          <View style={styles.overviewTop}>
            <Text style={styles.overviewKicker}>Return queue</Text>
            <Text style={styles.overviewTotal}>
              {returns.length}
              <Text style={styles.overviewTotalUnit}> {returns.length === 1 ? "return" : "returns"}</Text>
            </Text>
          </View>
          <View style={styles.overviewRow}>
            {overview.map((m, i) => {
              const Cell = m.key ? TouchableOpacity : View;
              return (
                <Cell
                  key={m.label}
                  style={[styles.overviewCell, i > 0 && styles.overviewCellDivider]}
                  {...(m.key
                    ? {
                        onPress: () => setStatusTab(m.key!),
                        activeOpacity: 0.7,
                        accessibilityRole: "button" as const,
                        accessibilityLabel: `${m.value} ${m.label}. Filter`,
                      }
                    : {})}
                >
                  <View style={styles.overviewLabelRow}>
                    <Ionicons name={m.icon} size={12} color={m.warn ? GOLD : colors.light.mutedForeground} />
                    <Text style={styles.overviewLabel}>{m.label}</Text>
                  </View>
                  <Text
                    style={[
                      styles.overviewValue,
                      m.key === null && styles.overviewValueSmall,
                      m.warn && { color: GOLD },
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {m.value}
                  </Text>
                </Cell>
              );
            })}
          </View>
          {counts.requested > 0 ? (
            <TouchableOpacity
              style={styles.overviewCta}
              onPress={() => setStatusTab("requested")}
              accessibilityRole="button"
              accessibilityLabel="Show requested returns"
            >
              <Text style={styles.overviewCtaText}>Review {pluralize(counts.requested, "request")}</Text>
              <Ionicons name="arrow-forward" size={13} color="#c8e08a" />
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      <View style={styles.searchContainer}>
        <SellerSearchField
          value={searchInput}
          onChangeText={setSearchInput}
          placeholder="Search order, piece, buyer…"
          accessibilityLabel="Search returns"
        />
      </View>

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={STATUS_TABS}
        keyExtractor={(t) => t.key}
        style={styles.tabsContainer}
        contentContainerStyle={styles.tabsContent}
        renderItem={({ item: tab }) => (
          <SellerFilterTab
            label={tab.label}
            count={counts[tab.key as keyof typeof counts] ?? 0}
            active={statusTab === tab.key}
            onPress={() => setStatusTab(tab.key)}
          />
        )}
      />

      {!loading && isFiltered ? (
        <View style={styles.resultsBar}>
          <Text style={styles.resultsText} numberOfLines={1}>
            {visible.length} result{visible.length === 1 ? "" : "s"}
            {statusTab !== "all" ? ` · ${STATUS_TABS.find((t) => t.key === statusTab)?.label}` : ""}
            {search ? ` · “${search}”` : ""}
          </Text>
          <TouchableOpacity
            style={styles.clearButton}
            onPress={clearFilters}
            accessibilityRole="button"
            accessibilityLabel="Clear filters"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={12} color={colors.olive[800]} />
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <FlatList
        data={loading && returns.length === 0 ? [] : visible}
        keyExtractor={(item) => item.id}
        renderItem={renderReturn}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.olive[800]} />
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          <View style={styles.listInset}>
            {loading && returns.length === 0 ? (
              <ReturnsSkeleton />
            ) : loadError || isFiltered ? (
              <SellerStateView
                variant={loadError ? "error" : "empty"}
                icon={loadError ? "cloud-offline-outline" : "return-down-back-outline"}
                title={loadError ? "Couldn’t load returns" : "Nothing matches"}
                description={loadError ?? "Try a different order number, buyer name, or status filter."}
                actionLabel={loadError ? "Try again" : "Clear filters"}
                onAction={loadError ? onRefresh : clearFilters}
                style={{ marginTop: 24 }}
              />
            ) : (
              <EmptyReturnsState />
            )}
          </View>
        }
      />
      <View pointerEvents="none" style={[styles.statusScrim, { height: insets.top }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f7f2" },
  statusScrim: { position: "absolute", top: 0, left: 0, right: 0, backgroundColor: "#ebe5cc" },
  listContent: { paddingBottom: 48 },
  listInset: { paddingHorizontal: spacing[5] },

  // Header
  header: { paddingHorizontal: spacing[5], paddingBottom: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
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
    flex: 1,
    fontFamily: fontFamilies.display.semibold,
    fontSize: 31,
    color: INK,
    letterSpacing: -0.8,
  },
  subtitle: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 13,
    color: colors.light.mutedForeground,
    marginTop: 8,
  },
  queuePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.full,
    backgroundColor: "#FFFFFF",
    marginBottom: 4,
    ...CARD_SHADOW,
  },
  queuePillWarn: { backgroundColor: "#fbf4e2" },
  queueDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#5f9a4a" },
  queueDotWarn: { backgroundColor: GOLD },
  queuePillText: { fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: INK },
  queuePillTextWarn: { color: "#8a6a2a" },

  // Overview
  overview: {
    marginHorizontal: spacing[5],
    marginBottom: spacing[4],
    backgroundColor: "#FFFFFF",
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(22,23,15,0.07)",
    paddingTop: 18,
    paddingBottom: 16,
    shadowColor: "#16170f",
    shadowOpacity: 0.07,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  overviewTop: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    marginBottom: 14,
  },
  overviewKicker: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: colors.olive[600],
  },
  overviewTotal: { fontFamily: fontFamilies.display.semibold, fontSize: 22, color: INK, letterSpacing: -0.4 },
  overviewTotalUnit: { fontFamily: fontFamilies.display.italic, fontSize: 15, color: colors.light.mutedForeground },
  overviewRow: { flexDirection: "row" },
  overviewCell: { flex: 1, paddingHorizontal: 18, paddingVertical: 2, minWidth: 0 },
  overviewCellDivider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: "rgba(22,23,15,0.08)" },
  overviewLabelRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  overviewLabel: { fontFamily: fontFamilies.sans.medium, fontSize: 12, color: colors.light.mutedForeground },
  overviewValue: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 26,
    lineHeight: 32,
    color: INK,
    marginTop: 2,
    fontVariant: ["tabular-nums"],
  },
  overviewValueSmall: { fontSize: 18 },
  overviewCta: {
    marginTop: 16,
    marginHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 46,
    borderRadius: radii.full,
    backgroundColor: INK,
  },
  overviewCtaText: { fontFamily: fontFamilies.sans.bold, fontSize: 14, color: CREAM },

  // Search + tabs
  searchContainer: { paddingHorizontal: spacing[5], marginBottom: 6 },
  tabsContainer: {
    flexGrow: 0,
    flexShrink: 0,
    marginTop: 12,
    marginBottom: 14,
  },
  tabsContent: { paddingHorizontal: spacing[5], gap: 10 },

  resultsBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[5],
    marginBottom: 12,
    gap: 12,
  },
  resultsText: {
    flex: 1,
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.ink.mute,
  },
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

  // Return card
  card: {
    marginHorizontal: spacing[5],
    marginBottom: 12,
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "transparent",
    ...CARD_SHADOW,
  },
  cardUrgent: { borderColor: "rgba(200,164,74,0.55)" },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  time: { fontFamily: fontFamilies.sans.medium, fontSize: 11, color: colors.ink.mute },
  orderNo: {
    marginTop: 12,
    fontFamily: fontFamilies.mono.regular,
    fontSize: 9.5,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.ink.mute,
  },
  product: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 17,
    lineHeight: 22,
    color: INK,
    marginTop: 3,
    letterSpacing: -0.2,
  },
  variant: { fontFamily: fontFamilies.sans.medium, fontSize: 12, color: colors.ink.mute, marginTop: 2 },
  buyerRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 },
  buyerAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.olive[100],
    alignItems: "center",
    justifyContent: "center",
  },
  buyerInitial: { fontFamily: fontFamilies.sans.bold, fontSize: 11, color: colors.olive[800] },
  buyerName: { flexShrink: 1, fontFamily: fontFamilies.sans.semibold, fontSize: 13, color: colors.ink.soft },
  reasonBox: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
    paddingVertical: 8,
    paddingRight: 12,
    borderRadius: 12,
    backgroundColor: colors.paper.DEFAULT,
    overflow: "hidden",
  },
  reasonBar: { width: 3, borderRadius: 2 },
  reason: {
    flex: 1,
    fontFamily: fontFamilies.display.italic,
    fontSize: 13,
    lineHeight: 18,
    color: colors.ink.soft,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(83,94,44,0.2)",
  },
  refundLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.ink.mute,
    marginBottom: 2,
  },
  refund: { fontFamily: fontFamilies.sans.bold, fontSize: 17, color: INK, fontVariant: ["tabular-nums"] },
  actionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 13,
    height: 34,
    borderRadius: radii.full,
    backgroundColor: colors.paper.DEFAULT,
  },
  actionPillUrgent: { backgroundColor: GOLD },
  action: { fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: colors.olive[800] },
  actionUrgent: { color: INK, fontFamily: fontFamilies.sans.bold },

  // Empty state
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    marginTop: 4,
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 22,
    alignItems: "center",
    ...CARD_SHADOW,
  },
  emptyIconHalo: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "rgba(200,164,74,0.16)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyIconCore: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.olive[900],
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 22,
    letterSpacing: -0.4,
    color: INK,
    textAlign: "center",
  },
  emptyTitleItalic: { fontFamily: fontFamilies.display.italic, color: colors.olive[600] },
  emptyDesc: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    lineHeight: 20,
    color: colors.ink.mute,
    textAlign: "center",
    maxWidth: 260,
    marginTop: 6,
  },
  emptyEyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    alignSelf: "stretch",
    marginTop: 24,
    marginBottom: 18,
  },
  emptyRule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: "rgba(83,94,44,0.2)" },
  emptyEyebrow: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: colors.ink.mute,
  },
  steps: { alignSelf: "stretch" },
  stepRow: { flexDirection: "row", gap: 14 },
  stepRail: { alignItems: "center", width: 34 },
  stepIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.olive[50],
    alignItems: "center",
    justifyContent: "center",
  },
  stepLine: { flex: 1, width: 1, marginVertical: 4, backgroundColor: "rgba(83,94,44,0.22)" },
  stepCopy: { flex: 1, minWidth: 0, paddingTop: 1 },
  stepNum: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    letterSpacing: 1.2,
    color: GOLD,
  },
  stepLabel: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: INK, marginTop: 1 },
  stepDesc: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.ink.mute,
    marginTop: 2,
  },
  emptyNote: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "stretch",
    justifyContent: "center",
    gap: 7,
    marginTop: 22,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 14,
    backgroundColor: colors.paper.DEFAULT,
  },
  emptyNoteText: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.ink.soft },
  emptyNoteStrong: { fontFamily: fontFamilies.sans.bold, color: INK },

  skelCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 16,
    gap: 10,
  },
});
