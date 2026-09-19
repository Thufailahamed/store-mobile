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
import { formatPrice, pluralize } from "@/lib/utils";
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
      <View style={styles.skelSummary}>
        <Skeleton width="45%" height={12} />
        <Skeleton width="60%" height={26} />
        <Skeleton width="80%" height={12} />
      </View>
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
        <View style={[styles.cardAccent, { backgroundColor: tone.accent }]} />
        <View style={styles.cardBody}>
          <View style={styles.cardHeader}>
            <SellerStatusPill
              label={formatReturnStatusLabel(item.status)}
              bg={tone.bg}
              color={tone.text}
              dotted={urgent}
            />
            <View style={styles.timeWrap}>
              <Ionicons name="time-outline" size={12} color={colors.ink.mute} />
              <Text style={styles.time}>{formatRelative(item.created_at)}</Text>
            </View>
          </View>

          <Text style={styles.product} numberOfLines={2}>
            {product ?? "Return request"}
            {variant ? ` · ${variant}` : ""}
            {extraItems > 0 ? `  +${extraItems} more` : ""}
          </Text>

          <View style={styles.metaRow}>
            <Ionicons name="person-outline" size={13} color={colors.ink.mute} />
            <Text style={styles.meta} numberOfLines={1}>
              {item.buyer_name || "Buyer"}
            </Text>
            {item.order_number ? (
              <>
                <Text style={styles.metaDot}>·</Text>
                <Ionicons name="receipt-outline" size={13} color={colors.ink.mute} />
                <Text style={styles.metaMono} numberOfLines={1}>
                  {item.order_number}
                </Text>
              </>
            ) : null}
          </View>

          {item.reason ? (
            <View style={styles.reasonRow}>
              <Ionicons name="chatbox-ellipses-outline" size={13} color={colors.ink.mute} />
              <Text style={styles.reason} numberOfLines={1}>
                {item.reason}
              </Text>
            </View>
          ) : null}

          <View style={styles.footer}>
            <View>
              <Text style={styles.refundLabel}>Refund</Text>
              <Text style={styles.refund}>{refundMoney(item)}</Text>
            </View>
            <View style={[styles.actionPill, urgent && styles.actionPillUrgent]}>
              <Text style={[styles.action, urgent && styles.actionUrgent]}>{action}</Text>
              <Ionicons
                name="arrow-forward"
                size={12}
                color={urgent ? CREAM : colors.olive[700]}
              />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 8 }]}>
        <SellerBackButton label="More" fallbackHref="/(seller)/more" style={{ marginBottom: 6 }} />
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>Atelier</Text>
            <Text style={styles.title}>Returns</Text>
            <Text style={styles.subtitle}>{headerSubtitle}</Text>
          </View>
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

      {!loading && isFiltered ? (
        <View style={styles.resultsBar}>
          <Text style={styles.resultsText}>
            {visible.length} result{visible.length === 1 ? "" : "s"}
            {statusTab !== "all"
              ? ` · ${STATUS_TABS.find((t) => t.key === statusTab)?.label}`
              : ""}
            {search ? ` for “${search}”` : ""}
          </Text>
          <TouchableOpacity
            onPress={clearFilters}
            accessibilityRole="button"
            accessibilityLabel="Clear filters"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.resultsClear}>Clear</Text>
          </TouchableOpacity>
        </View>
      ) : null}

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
          ListHeaderComponent={
            returns.length > 0 && !isFiltered ? (
              <View style={styles.summaryCard}>
                <View style={styles.summaryTop}>
                  <View style={styles.summaryIconWrap}>
                    <Ionicons name="return-down-back-outline" size={16} color={GOLD} />
                  </View>
                  <Text style={styles.summaryEyebrow}>Return queue</Text>
                </View>
                <View style={styles.summaryStats}>
                  <View style={styles.summaryStat}>
                    <Text style={styles.summaryValue}>{counts.requested}</Text>
                    <Text style={styles.summaryLabel}>To review</Text>
                  </View>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryStat}>
                    <Text style={styles.summaryValue}>{inFlight}</Text>
                    <Text style={styles.summaryLabel}>In progress</Text>
                  </View>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryStat}>
                    <Text style={styles.summaryValue} numberOfLines={1}>
                      {refundExposure > 0 ? formatPrice(refundExposure, exposureCurrency) : "—"}
                    </Text>
                    <Text style={styles.summaryLabel}>Refund exposure</Text>
                  </View>
                </View>
                {counts.requested > 0 ? (
                  <TouchableOpacity
                    style={styles.summaryCta}
                    onPress={() => setStatusTab("requested")}
                    accessibilityRole="button"
                    accessibilityLabel="Show requested returns"
                  >
                    <Text style={styles.summaryCtaText}>
                      Review {pluralize(counts.requested, "request")}
                    </Text>
                    <Ionicons name="arrow-forward" size={13} color={CREAM} />
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null
          }
          ListEmptyComponent={
            <SellerStateView
              variant={loadError ? "error" : "empty"}
              icon={loadError ? "cloud-offline-outline" : "return-down-back-outline"}
              title={loadError ? "Couldn’t load returns" : search || statusTab !== "all" ? "Nothing matches" : "No returns"}
              description={
                loadError ??
                (search || statusTab !== "all"
                  ? "Try a different order number, buyer name, or status filter."
                  : "Buyer return requests for this store will appear here.")
              }
              actionLabel={loadError ? "Try again" : isFiltered ? "Clear filters" : undefined}
              onAction={loadError ? onRefresh : isFiltered ? clearFilters : undefined}
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
  subtitle: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    color: colors.ink.mute,
    marginTop: 3,
  },
  goldRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(200,164,74,0.55)",
    marginHorizontal: spacing[5],
    marginBottom: spacing[3],
  },
  searchContainer: { paddingHorizontal: spacing[5], marginBottom: spacing[3] },
  tabsContainer: { marginBottom: 8, flexGrow: 0 },
  tabsContent: { paddingHorizontal: spacing[5], gap: 8, paddingBottom: 4 },
  resultsBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[5],
    marginBottom: 4,
    gap: 12,
  },
  resultsText: {
    flex: 1,
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.xs,
    color: colors.ink.mute,
  },
  resultsClear: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.xs,
    color: colors.olive[700],
  },
  listContent: { paddingHorizontal: spacing[5], paddingTop: 4, paddingBottom: 48 },

  summaryCard: {
    backgroundColor: colors.olive[900],
    borderRadius: radii["2xl"],
    padding: 18,
    marginTop: 4,
    marginBottom: 14,
    shadowColor: colors.olive[950],
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  summaryTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  summaryIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(200,164,74,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  summaryEyebrow: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: typography.letterSpacing.editorial,
    textTransform: "uppercase",
    color: "rgba(250,248,241,0.65)",
  },
  summaryStats: {
    flexDirection: "row",
    alignItems: "center",
  },
  summaryStat: { flex: 1, gap: 3 },
  summaryValue: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 20,
    color: CREAM,
    letterSpacing: -0.3,
  },
  summaryLabel: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: "rgba(250,248,241,0.6)",
  },
  summaryDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
    backgroundColor: "rgba(250,248,241,0.16)",
    marginHorizontal: 14,
  },
  summaryCta: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: radii.full,
    backgroundColor: "rgba(200,164,74,0.22)",
    borderWidth: 1,
    borderColor: "rgba(200,164,74,0.4)",
  },
  summaryCtaText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.xs,
    color: CREAM,
  },

  card: {
    flexDirection: "row",
    backgroundColor: CREAM,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.12)",
    marginBottom: 12,
    overflow: "hidden",
    shadowColor: colors.olive[950],
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  cardUrgent: {
    borderColor: "rgba(200,164,74,0.45)",
    shadowOpacity: 0.1,
  },
  cardAccent: { width: 4 },
  cardBody: { flex: 1, padding: 14, paddingLeft: 12 },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  timeWrap: { flexDirection: "row", alignItems: "center", gap: 4 },
  time: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: colors.ink.mute,
  },
  product: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 16,
    color: INK,
    marginTop: 10,
    letterSpacing: -0.2,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 7,
  },
  meta: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.ink.soft,
    flexShrink: 1,
  },
  metaDot: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.ink.mute,
  },
  metaMono: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 11,
    color: colors.ink.mute,
    flexShrink: 1,
  },
  reasonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 5,
  },
  reason: {
    flex: 1,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.ink.mute,
    fontStyle: "italic",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(83,94,44,0.12)",
  },
  refundLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.ink.mute,
    marginBottom: 2,
  },
  refund: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 17,
    color: INK,
    letterSpacing: -0.2,
  },
  actionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.22)",
    backgroundColor: colors.paper.DEFAULT,
  },
  actionPillUrgent: {
    backgroundColor: colors.olive[800],
    borderColor: colors.olive[800],
  },
  action: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 11,
    color: colors.olive[800],
  },
  actionUrgent: { color: CREAM },

  skelSummary: {
    backgroundColor: colors.olive[900],
    borderRadius: radii["2xl"],
    padding: 18,
    gap: 10,
    opacity: 0.9,
  },
  skelCard: {
    backgroundColor: CREAM,
    borderRadius: radii["2xl"],
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.08)",
    gap: 10,
  },
});
