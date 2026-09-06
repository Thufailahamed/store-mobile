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
  | { kind: "header"; id: string; title: string }
  | { kind: "item"; id: string; item: Notification };

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
    rows.push({ kind: "header", id: `h-${title}`, title });
    for (const item of list) rows.push({ kind: "item", id: item.id, item });
  }
  return rows;
}

function InboxSkeleton() {
  return (
    <View style={{ paddingHorizontal: spacing[5], gap: 12 }}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={styles.skelCard}>
          <Skeleton width={40} height={40} borderRadius={12} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton width="45%" height={14} />
            <Skeleton width="90%" height={12} />
            <Skeleton width="30%" height={10} />
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

  const headerCount = loadError && notifications.length === 0
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
      return <Text style={styles.sectionLabel}>{row.title}</Text>;
    }
    const item = row.item;
    const bucket = normalizeSellerNotifType(item.type);
    const meta = TYPE_META[bucket];
    const unread = isNotificationUnread(item);
    const parsed = parseOrderAlert(item.body, item.data);
    const facts = formatNotificationBody(item.body, item.data);
    const href = sellerNotifHref(item);
    const actionLabel =
      parsed.orderNumber ? `View ${parsed.orderNumber}` :
      bucket === "inventory" ? "Open inventory" :
      bucket === "review" ? "Open reviews" :
      href ? "Open" : null;

    return (
      <TouchableOpacity
        style={[styles.card, unread && styles.cardUnread]}
        onPress={() => handlePress(item)}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={`${item.title}${unread ? ", unread" : ""}`}
      >
        <View style={[styles.iconWrap, { backgroundColor: meta.bg }]}>
          <Ionicons name={meta.icon} size={18} color={meta.color} />
        </View>
        <View style={styles.cardBody}>
          <View style={styles.topRow}>
            <Text style={styles.title} numberOfLines={2}>{item.title || "Update"}</Text>
            {unread ? <View style={styles.unreadDot} /> : null}
          </View>
          <View style={[styles.typeChip, { backgroundColor: meta.bg }]}>
            <Text style={[styles.typeChipText, { color: meta.color }]}>{meta.label}</Text>
          </View>
          {parsed.orderNumber || parsed.amount != null ? (
            <View style={styles.facts}>
              {parsed.orderNumber ? (
                <Text style={styles.orderRef}>{parsed.orderNumber}</Text>
              ) : null}
              {parsed.amount != null ? (
                <Text style={styles.amount}>{formatPrice(parsed.amount, parsed.currency || "LKR")}</Text>
              ) : null}
              {parsed.storeName ? (
                <Text style={styles.storeName}>{parsed.storeName}</Text>
              ) : null}
            </View>
          ) : facts ? (
            <Text style={styles.body}>{facts}</Text>
          ) : null}
          <View style={styles.footer}>
            <Text style={styles.time}>{formatRelative(item.created_at)}</Text>
            {actionLabel ? <Text style={styles.action}>{actionLabel}</Text> : null}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 8 }]}>
        <SellerBackButton label="Back" fallbackHref="/(seller)/more" style={{ marginBottom: 4 }} />
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>Atelier</Text>
            <Text style={styles.pageTitle}>Notifications</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.count}>{headerCount}</Text>
            {unreadCount > 0 ? (
              <TouchableOpacity
                style={styles.markAllBtn}
                onPress={handleMarkAllRead}
                disabled={markingAll}
                accessibilityRole="button"
                accessibilityLabel="Mark all as read"
              >
                <Ionicons name="checkmark-done" size={16} color={CREAM} />
                <Text style={styles.markAllText}>{markingAll ? "Saving…" : "Mark all read"}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>
      <View style={styles.goldRule} />

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
  header: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[2],
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 12,
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
  kicker: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: typography.letterSpacing.editorial,
    textTransform: "uppercase",
    color: colors.olive[700],
    marginBottom: 2,
  },
  pageTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 28,
    color: INK,
    letterSpacing: -0.4,
  },
  headerRight: { alignItems: "flex-end", gap: 8, paddingBottom: 2 },
  count: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 11,
    letterSpacing: 0.4,
    color: colors.olive[700],
  },
  markAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    paddingHorizontal: 14,
    gap: 6,
    backgroundColor: colors.olive[900],
    borderRadius: radii.full,
  },
  markAllText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.xs,
    color: CREAM,
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
  sectionLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: colors.olive[700],
    marginBottom: 8,
    marginTop: 8,
  },
  card: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: CREAM,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.12)",
    padding: 14,
    marginBottom: 10,
  },
  cardUnread: {
    borderColor: "rgba(83,94,44,0.28)",
    borderLeftWidth: 3,
    borderLeftColor: colors.olive[800],
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: { flex: 1, minWidth: 0 },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  title: {
    flex: 1,
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.sm,
    color: INK,
    lineHeight: 20,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.olive[800],
    marginTop: 6,
  },
  typeChip: {
    alignSelf: "flex-start",
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  typeChipText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  facts: { marginTop: 8, gap: 2 },
  orderRef: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 12,
    color: colors.olive[900],
    letterSpacing: 0.2,
  },
  amount: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 16,
    color: INK,
  },
  storeName: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    color: colors.olive[800],
    lineHeight: 20,
  },
  body: {
    marginTop: 8,
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    color: colors.olive[800],
    lineHeight: 20,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    gap: 8,
  },
  time: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 10,
    color: colors.light.mutedForeground,
  },
  action: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 11,
    color: colors.olive[800],
  },
  emptyWrap: {
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
    flexDirection: "row",
    gap: 12,
    backgroundColor: CREAM,
    borderRadius: radii["2xl"],
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.08)",
  },
});
