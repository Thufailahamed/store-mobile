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
import { colors, shadows, typography, radii, spacing } from "@/lib/theme/tokens";
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
          <Skeleton width={50} height={50} borderRadius={16} />
          <View style={{ flex: 1, gap: 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Skeleton width="45%" height={14} />
              <Skeleton width={60} height={14} borderRadius={8} />
            </View>
            <Skeleton width="70%" height={12} />
            <Skeleton width="35%" height={12} />
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
              <Skeleton width={50} height={10} />
              <Skeleton width={90} height={22} borderRadius={12} />
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
          <View style={styles.sectionLine} />
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
    const actionLabel =
      parsed.orderNumber ? `View ${parsed.orderNumber}` :
      bucket === "inventory" ? "Open inventory" :
      bucket === "review" ? "Open reviews" :
      href ? "Open" : null;

    return (
      <TouchableOpacity
        style={[styles.card, unread && styles.cardUnread]}
        onPress={() => handlePress(item)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${item.title}${unread ? ", unread" : ""}`}
      >
        <View style={[styles.iconWrap, { backgroundColor: meta.bg }]}>
          <Ionicons name={meta.icon} size={20} color={meta.color} />
        </View>
        <View style={styles.cardBody}>
          <View style={styles.cardTop}>
            <View style={styles.titleRow}>
              <Text style={[styles.title, unread && styles.titleUnread]} numberOfLines={1}>{item.title || "Update"}</Text>
              {unread ? <View style={styles.unreadDot} /> : null}
            </View>
            <View style={[styles.typeChip, { backgroundColor: meta.bg }]}>
              <Text style={[styles.typeChipText, { color: meta.color }]}>{meta.label}</Text>
            </View>
          </View>

          {parsed.orderNumber || parsed.amount != null || parsed.storeName ? (
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
            {actionLabel ? (
              <View style={styles.actionPill}>
                <Text style={styles.action}>{actionLabel}</Text>
                <Ionicons name="arrow-forward" size={12} color={colors.olive[700]} />
              </View>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 10 }]}>
        <SellerBackButton label="Back" fallbackHref="/(seller)/more" style={{ marginBottom: 8 }} />
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>Atelier</Text>
            <Text style={styles.pageTitle}>Notifications</Text>
            <Text style={styles.subtitle}>{headerSubtitle}</Text>
          </View>
          {unreadCount > 0 ? (
            <TouchableOpacity
              style={styles.markAllBtn}
              onPress={handleMarkAllRead}
              disabled={markingAll}
              accessibilityRole="button"
              accessibilityLabel="Mark all as read"
            >
              <Ionicons name="checkmark-done-outline" size={18} color={CREAM} />
              <Text style={styles.markAllText}>{markingAll ? "Saving…" : "Mark all"}</Text>
            </TouchableOpacity>
          ) : null}
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
  header: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[4],
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 12,
  },
  kicker: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: colors.olive[700],
    marginBottom: 4,
  },
  pageTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 32,
    lineHeight: 38,
    color: INK,
    letterSpacing: -0.6,
  },
  subtitle: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    color: colors.olive[700],
    marginTop: 4,
  },
  markAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 40,
    paddingHorizontal: 14,
    gap: 6,
    backgroundColor: colors.olive[900],
    borderRadius: 18,
    ...shadows.soft,
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
  tabsContainer: { marginBottom: 6, flexGrow: 0 },
  tabsContent: { paddingHorizontal: spacing[5], gap: 8, paddingBottom: 6 },
  resultsBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[5],
    paddingVertical: 10,
    marginBottom: 2,
  },
  resultsText: {
    flex: 1,
    fontFamily: fontFamilies.sans.medium,
    fontSize: typography.fontSizes.sm,
    color: colors.olive[700],
  },
  resultsClear: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.sm,
    color: colors.olive[900],
  },
  listContent: { paddingHorizontal: spacing[5], paddingTop: 4, paddingBottom: 48 },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 16,
    marginBottom: 10,
  },
  sectionLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(83,94,44,0.14)",
  },
  sectionLabel: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: colors.olive[700],
  },
  card: {
    flexDirection: "row",
    gap: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.10)",
    padding: 16,
    marginBottom: 12,
    ...shadows.soft,
  },
  cardUnread: {
    borderLeftWidth: 5,
    borderLeftColor: colors.olive[800],
    backgroundColor: "#FCFBF6",
  },
  iconWrap: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  cardBody: { flex: 1, minWidth: 0, gap: 8 },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  titleRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
  },
  title: {
    flex: 1,
    fontFamily: fontFamilies.sans.medium,
    fontSize: 15,
    color: colors.olive[800],
    lineHeight: 20,
  },
  titleUnread: {
    fontFamily: fontFamilies.sans.semibold,
    color: INK,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.olive[800],
    flexShrink: 0,
  },
  typeChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  typeChipText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  facts: { gap: 3 },
  orderRef: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 12,
    color: colors.olive[900],
    letterSpacing: 0.2,
  },
  amount: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 18,
    color: INK,
    marginTop: 1,
  },
  storeName: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    color: colors.olive[700],
    lineHeight: 20,
  },
  body: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    color: colors.olive[800],
    lineHeight: 20,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
    gap: 8,
  },
  time: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 11,
    color: colors.light.mutedForeground,
  },
  actionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: radii.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.olive[50],
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.10)",
  },
  action: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 10,
    color: colors.olive[700],
  },
  skelCard: {
    flexDirection: "row",
    gap: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.08)",
    marginBottom: 12,
    ...shadows.soft,
  },
});
