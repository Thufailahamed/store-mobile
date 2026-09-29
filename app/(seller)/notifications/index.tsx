import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  StatusBar,
  Alert,
  ScrollView,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@/components/ui/Icon";
import { useAuth } from "@/lib/supabase/auth";
import { getSellerNotifications, markSellerNotificationRead, markAllSellerNotificationsRead } from "@/lib/api";
import { colors, typography, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";
import { Skeleton } from "@/components/ui/Skeleton";
import { SellerBackButton } from "@/components/seller/SellerBackButton";
import { SellerStateView, SellerSearchField, SellerFilterTab } from "@/components/seller/chrome";
import {
  filterSellerInbox,
  formatNotificationBody,
  isNotificationUnread,
  markInboxItemRead,
  normalizeSellerNotifType,
  parseOrderAlert,
  sellerNotifHref,
  type SellerNotifBucket,
} from "@/lib/notifications/seller-inbox";
import type { Notification } from "@/lib/types";

const RUST = colors.accent2.rust;
const CREAM = colors.paper.cream;
const INK = colors.olive[950];

type TabKey = "all" | "unread" | SellerNotifBucket;

const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "order", label: "Orders" },
  { key: "inventory", label: "Inventory" },
  { key: "review", label: "Reviews" },
  { key: "system", label: "System" },
];

const TYPE_META: Record<
  SellerNotifBucket,
  { label: string; icon: "receipt-outline" | "layers-outline" | "star-outline" | "settings-outline"; color: string; bg: string }
> = {
  order: { label: "Order", icon: "receipt-outline", color: colors.olive[800], bg: "rgba(83,94,44,0.12)" },
  inventory: { label: "Inventory", icon: "layers-outline", color: "#8a6a2a", bg: "rgba(200,164,74,0.18)" },
  review: { label: "Review", icon: "star-outline", color: RUST, bg: "rgba(184,92,58,0.12)" },
  system: { label: "System", icon: "settings-outline", color: colors.olive[700], bg: colors.olive[50] },
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

function groupByKey(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "Earlier";
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startThat = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.round((startToday - startThat) / 86_400_000);
  if (dayDiff <= 0) return "Today";
  if (dayDiff === 1) return "Yesterday";
  if (dayDiff < 7) return "This week";
  return "Earlier";
}

type ListRow =
  | { kind: "header"; id: string; title: string; count: number }
  | { kind: "item"; id: string; item: Notification; first: boolean; last: boolean };

function toRows(items: Notification[]): ListRow[] {
  const groups: Record<string, Notification[]> = {};
  const order = ["Today", "Yesterday", "This week", "Earlier"];
  for (const n of items) {
    const key = groupByKey(n.created_at);
    (groups[key] ??= []).push(n);
  }
  const rows: ListRow[] = [];
  for (const title of order) {
    const list = groups[title];
    if (!list?.length) continue;
    rows.push({ kind: "header", id: `h-${title}`, title, count: list.length });
    list.forEach((item, i) =>
      rows.push({ kind: "item", id: item.id, item, first: i === 0, last: i === list.length - 1 }),
    );
  }
  return rows;
}

function InboxSkeleton() {
  return (
    <View style={[styles.group, { marginHorizontal: spacing[5], marginTop: 12 }]}>
      {[0, 1, 2, 3, 4].map((i) => (
        <View key={i} style={[styles.row, i > 0 && styles.rowDivider]}>
          <Skeleton width={40} height={40} borderRadius={12} />
          <View style={{ flex: 1, gap: 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Skeleton width="50%" height={13} />
              <Skeleton width={36} height={10} />
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Skeleton width="40%" height={11} />
              <Skeleton width={70} height={13} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

export default function SellerNotifications() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<TabKey>("all");
  const [markingAll, setMarkingAll] = useState(false);
  const mountedRef = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    const res = await getSellerNotifications(50);
    if (res.ok) {
      setNotifications(res.data);
      setLoadError(null);
    } else {
      setLoadError(res.error);
    }
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useFocusEffect(
    useCallback(() => {
      if (!mountedRef.current) {
        mountedRef.current = true;
        return;
      }
      fetchData();
    }, [fetchData]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const unreadCount = useMemo(
    () => notifications.filter(isNotificationUnread).length,
    [notifications],
  );

  const tabCounts = useMemo(() => {
    const counts: Record<TabKey, number> = {
      all: notifications.length,
      unread: unreadCount,
      order: 0,
      inventory: 0,
      review: 0,
      system: 0,
    };
    for (const n of notifications) {
      counts[normalizeSellerNotifType(n.type)] += 1;
    }
    return counts;
  }, [notifications, unreadCount]);

  const visible = useMemo(
    () => filterSellerInbox(notifications, { tab, search }),
    [notifications, tab, search],
  );

  const rows = useMemo(() => toRows(visible), [visible]);

  const headerSubtitle = loadError && notifications.length === 0
    ? "Unavailable"
    : unreadCount > 0
      ? `${unreadCount} unread`
      : "Caught up";

  const handleMarkRead = async (id: string) => {
    const res = await markSellerNotificationRead(id);
    if (!res.ok) {
      Alert.alert("Couldn’t mark as read", res.error);
      return;
    }
    setNotifications((prev) => prev.map((n) => (n.id === id ? markInboxItemRead(n) : n)));
  };

  const handleMarkAllRead = async () => {
    if (unreadCount === 0 || markingAll) return;
    setMarkingAll(true);
    const res = await markAllSellerNotificationsRead();
    setMarkingAll(false);
    if (!res.ok) {
      Alert.alert("Couldn’t mark all as read", res.error);
      return;
    }
    setNotifications((prev) => prev.map((n) => markInboxItemRead(n)));
  };

  const handlePress = async (item: Notification) => {
    if (isNotificationUnread(item)) await handleMarkRead(item.id);
    const href = sellerNotifHref(item);
    if (href) router.push(href as never);
  };

  const renderRow = ({ item: row }: { item: ListRow }) => {
    if (row.kind === "header") {
      return (
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>{row.title}</Text>
          <Text style={styles.sectionCount}>{row.count}</Text>
        </View>
      );
    }
    const item = row.item;
    const bucket = normalizeSellerNotifType(item.type);
    const meta = TYPE_META[bucket];
    const unread = isNotificationUnread(item);
    const parsed = parseOrderAlert(item.body, item.data);
    const facts = formatNotificationBody(item.body, item.data);
    const href = sellerNotifHref(item);
    const isOrderAlert = !!parsed.orderNumber || parsed.amount != null;

    return (
      <TouchableOpacity
        style={[
          styles.row,
          styles.rowInGroup,
          row.first && styles.rowFirst,
          row.last && styles.rowLast,
          !row.first && styles.rowDivider,
          unread && styles.rowUnread,
        ]}
        onPress={() => handlePress(item)}
        activeOpacity={0.6}
        accessibilityRole="button"
        accessibilityLabel={`${meta.label}: ${item.title}${parsed.orderNumber ? `, ${parsed.orderNumber}` : ""}${unread ? ", unread" : ""}`}
      >
        <View style={[styles.iconWrap, { backgroundColor: meta.bg }]}>
          <Ionicons name={meta.icon} size={18} color={meta.color} />
          {unread ? <View style={styles.unreadDot} /> : null}
        </View>
        <View style={styles.rowBody}>
          <View style={styles.rowLine}>
            <Text style={[styles.title, unread && styles.titleUnread]} numberOfLines={1}>
              {item.title || "Update"}
            </Text>
            <Text style={[styles.time, unread && styles.timeUnread]}>{formatRelative(item.created_at)}</Text>
          </View>
          {isOrderAlert ? (
            <View style={styles.rowLine}>
              <Text style={styles.orderRef} numberOfLines={1}>
                {parsed.orderNumber ?? parsed.storeName ?? meta.label}
              </Text>
              {parsed.amount != null ? (
                <Text style={[styles.amount, !unread && styles.amountRead]}>
                  {formatPrice(parsed.amount, parsed.currency || "LKR")}
                </Text>
              ) : null}
            </View>
          ) : facts ? (
            <Text style={styles.body} numberOfLines={2}>{facts}</Text>
          ) : null}
        </View>
        {href ? <Ionicons name="chevron-forward" size={14} color={colors.olive[400]} /> : null}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 6 }]}>
        <View style={styles.topBar}>
          <SellerBackButton label="Back" fallbackHref="/(seller)/more" />
          {unreadCount > 0 ? (
            <TouchableOpacity
              style={[styles.markAllBtn, markingAll && { opacity: 0.6 }]}
              onPress={handleMarkAllRead}
              disabled={markingAll}
              accessibilityRole="button"
              accessibilityLabel="Mark all as read"
            >
              <Ionicons name="checkmark-done-outline" size={16} color={colors.olive[900]} />
              <Text style={styles.markAllText}>{markingAll ? "Saving…" : "Mark all read"}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <Text style={styles.kicker}>Atelier</Text>
        <View style={styles.titleLine}>
          <Text style={styles.pageTitle}>Notifications</Text>
          {unreadCount > 0 ? (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unreadCount > 99 ? "99+" : unreadCount}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.subtitle}>
          {unreadCount > 0 ? `${unreadCount} unread of ${notifications.length}` : headerSubtitle}
        </Text>
      </View>

      <View style={styles.searchContainer}>
        <SellerSearchField
          value={searchInput}
          onChangeText={setSearchInput}
          placeholder="Search order, title…"
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsContent}
        style={styles.tabsContainer}
      >
        {TABS.map((t) => (
          <SellerFilterTab
            key={t.key}
            label={t.label}
            count={tabCounts[t.key]}
            active={tab === t.key}
            onPress={() => setTab(t.key)}
          />
        ))}
      </ScrollView>

      {!loading && (search || tab !== "all") ? (
        <View style={styles.resultsBar}>
          <Text style={styles.resultsText}>
            {visible.length} result{visible.length === 1 ? "" : "s"}
            {tab !== "all" ? ` · ${TABS.find((t) => t.key === tab)?.label}` : ""}
            {search ? ` for “${search}”` : ""}
          </Text>
          {(search || tab !== "all") && (
            <TouchableOpacity
              onPress={() => {
                setSearchInput("");
                setSearch("");
                setTab("all");
              }}
              accessibilityRole="button"
              accessibilityLabel="Clear filters"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.resultsClear}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : null}

      {loading ? (
        <InboxSkeleton />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(row) => row.id}
          renderItem={renderRow}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.olive[800]} />
          }
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <SellerStateView
              variant={loadError ? "error" : "empty"}
              icon={loadError ? "cloud-offline-outline" : "notifications-off-outline"}
              title={
                loadError
                  ? "Couldn’t load notifications"
                  : search
                    ? "Nothing matches"
                    : "No notifications"
              }
              description={
                loadError ??
                (search
                  ? "Try a different search."
                  : "New orders and stock alerts will appear here.")
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
  header: { paddingHorizontal: spacing[5], paddingBottom: spacing[4] },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  kicker: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: colors.olive[700],
    marginBottom: 4,
  },
  titleLine: { flexDirection: "row", alignItems: "center", gap: 10 },
  pageTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 32,
    lineHeight: 38,
    color: INK,
    letterSpacing: -0.6,
  },
  unreadBadge: {
    minWidth: 26,
    height: 26,
    paddingHorizontal: 8,
    borderRadius: 13,
    backgroundColor: RUST,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  unreadBadgeText: { fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: CREAM, fontVariant: ["tabular-nums"] },
  subtitle: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
    marginTop: 4,
  },
  markAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 40,
    paddingHorizontal: 14,
    gap: 6,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.16)",
    borderRadius: radii.full,
  },
  markAllText: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.xs, color: colors.olive[900] },
  searchContainer: { paddingHorizontal: spacing[5], marginBottom: spacing[3] },
  tabsContainer: { flexGrow: 0, flexShrink: 0 },
  tabsContent: { paddingHorizontal: spacing[5], paddingVertical: 2, gap: 8, alignItems: "center" },
  resultsBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[5],
    paddingTop: 12,
  },
  resultsText: { flex: 1, fontFamily: fontFamilies.sans.medium, fontSize: typography.fontSizes.xs, color: colors.olive[700] },
  resultsClear: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.xs, color: colors.olive[900] },
  listContent: { paddingHorizontal: spacing[5], paddingBottom: 48 },
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 20, marginBottom: 8, paddingHorizontal: 4 },
  sectionLabel: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: colors.olive[700],
  },
  sectionCount: { fontFamily: fontFamilies.mono.regular, fontSize: 9, color: colors.light.mutedForeground },
  group: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.10)",
    overflow: "hidden",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
  rowInGroup: {
    backgroundColor: "#FFFFFF",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "rgba(83,94,44,0.10)",
  },
  rowFirst: { borderTopWidth: 1, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  rowLast: { borderBottomWidth: 1, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(83,94,44,0.12)" },
  rowUnread: { backgroundColor: "#FBFAF2" },
  iconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  unreadDot: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: RUST,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  rowBody: { flex: 1, minWidth: 0, gap: 4 },
  rowLine: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 10 },
  title: { flex: 1, fontFamily: fontFamilies.sans.regular, fontSize: 14, lineHeight: 19, color: colors.olive[800] },
  titleUnread: { fontFamily: fontFamilies.sans.semibold, color: INK },
  time: { fontFamily: fontFamilies.sans.regular, fontSize: 11, color: colors.light.mutedForeground },
  timeUnread: { color: RUST, fontFamily: fontFamilies.sans.medium },
  orderRef: { flex: 1, fontFamily: fontFamilies.mono.regular, fontSize: 11, letterSpacing: 0.2, color: colors.light.mutedForeground },
  amount: { fontFamily: fontFamilies.display.semibold, fontSize: 15, color: INK, fontVariant: ["tabular-nums"] },
  amountRead: { color: colors.olive[800] },
  body: { fontFamily: fontFamilies.sans.regular, fontSize: 12, lineHeight: 17, color: colors.olive[700] },
});
