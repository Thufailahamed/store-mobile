import React, { useMemo, useState, useCallback } from "react";
import {
  Alert,
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ScrollView,
  RefreshControl,
} from "react-native";
import { navigateHome } from "@/lib/navigation";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@/components/ui/Icon";
import { useAuth } from "@/lib/supabase/auth";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  clearAllNotifications,
} from "@/lib/api";
import type { Notification } from "@/lib/types";
import { Skeleton, useToast } from "@/components/ui";
import { fontFamilies } from "@/lib/theme/fonts";
import { spacing } from "@/lib/theme/tokens";
import { useNotificationsRealtime } from "@/lib/hooks/useNotificationsRealtime";
import {
  HeaderButton,
  UserPageFrame,
  UP as C,
} from "@/components/user/user-page";

type NotifFilter = "all" | "messages" | "alerts" | "social" | "saved";

const FILTERS: {
  key: NotifFilter;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: "all", label: "All", icon: "notifications-outline" },
  { key: "messages", label: "Messages", icon: "chatbubble-outline" },
  { key: "alerts", label: "Alerts", icon: "flag-outline" },
  { key: "social", label: "Social", icon: "people-outline" },
  { key: "saved", label: "Saved", icon: "bookmark-outline" },
];

const FILTER_TYPES: Record<Exclude<NotifFilter, "all">, string[]> = {
  messages: ["system", "welcome", "review"],
  alerts: ["order", "delivery", "payment", "stock", "inventory"],
  social: ["review", "social"],
  saved: ["promo", "promotion", "loyalty", "drop", "rewards"],
};

type TypeTone = "olive" | "rust" | "ochre" | "ink";

const TYPE_META: Record<
  string,
  { icon: keyof typeof Ionicons.glyphMap; tone: TypeTone; label: string }
> = {
  order: { icon: "receipt-outline", tone: "olive", label: "Order" },
  delivery: { icon: "bicycle-outline", tone: "olive", label: "Delivery" },
  payment: { icon: "wallet-outline", tone: "ochre", label: "Payment" },
  promo: { icon: "pricetag-outline", tone: "rust", label: "Offer" },
  promotion: { icon: "pricetag-outline", tone: "rust", label: "Offer" },
  marketing: { icon: "pricetag-outline", tone: "rust", label: "Offer" },
  review: { icon: "star-outline", tone: "ochre", label: "Review" },
  stock: { icon: "alert-circle-outline", tone: "rust", label: "Stock" },
  inventory: { icon: "alert-circle-outline", tone: "rust", label: "Stock" },
  system: { icon: "settings-outline", tone: "ink", label: "System" },
  loyalty: { icon: "gift-outline", tone: "ochre", label: "Rewards" },
  rewards: { icon: "gift-outline", tone: "ochre", label: "Rewards" },
  drop: { icon: "sparkles-outline", tone: "ochre", label: "Drop" },
  welcome: { icon: "sparkles-outline", tone: "ochre", label: "Welcome" },
  social: { icon: "people-outline", tone: "olive", label: "Social" },
};

const DEFAULT_TYPE_META = {
  icon: "bookmark-outline" as keyof typeof Ionicons.glyphMap,
  tone: "ink" as TypeTone,
  label: "Update",
};

function formatRelativeShort(dateStr: string): string {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-LK", {
    month: "short",
    day: "numeric",
  });
}

function dayLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round(
    (startOfDay(today) - startOfDay(date)) / 86400000,
  );
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) {
    return date.toLocaleDateString("en-LK", { weekday: "long" });
  }
  // Older items group by month instead of one catch-all "Earlier" bucket.
  return date.toLocaleDateString("en-LK", {
    month: "long",
    ...(date.getFullYear() !== today.getFullYear() ? { year: "numeric" } : {}),
  });
}

/** In-app relative path only — no scheme/host, no "..", reasonable length. */
function isSafeInAppPath(path: string): boolean {
  if (path.length === 0 || path.length > 200) return false;
  if (!path.startsWith("/")) return false;
  if (path.includes("://") || path.includes("..")) return false;
  return /^\/[a-zA-Z0-9/_\-().[\]%]*$/.test(path);
}

function normalizeType(type: string): string {
  const t = (type ?? "").toLowerCase();
  if (t === "promotion" || t === "marketing") return "promo";
  if (t === "rewards") return "loyalty";
  // Lifecycle types (order_shipped, order.delivered, payment_received, …).
  if (
    t === "order_out_for_delivery" ||
    t === "order.out_for_delivery" ||
    t === "order_failed_attempt" ||
    t === "order.failed_attempt"
  )
    return "delivery";
  if (t.startsWith("payment")) return "payment";
  if (t.startsWith("order") || t.startsWith("return") || t.startsWith("refund"))
    return "order";
  return t;
}

function matchesFilter(
  notification: Notification,
  filter: NotifFilter,
): boolean {
  if (filter === "all") return true;
  const normalized = normalizeType(notification.type);
  return FILTER_TYPES[filter].map(normalizeType).includes(normalized);
}

function getNotificationImage(notification: Notification): string | undefined {
  const data = notification.data;
  if (!data) return undefined;
  const candidates = [
    data.image_url,
    data.product_image,
    data.thumbnail,
    data.image,
  ];
  for (const value of candidates) {
    if (typeof value === "string" && value.length > 0) return value;
  }
  return undefined;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<NotifFilter>("all");

  const notificationsQuery = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const res = await getNotifications(user.id);
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
    enabled: !!user,
  });

  const markReadMutation = useMutation({
    mutationFn: markNotificationRead,
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({
        queryKey: ["notifications", user?.id],
      });
      const previous = queryClient.getQueryData<Notification[]>([
        "notifications",
        user?.id,
      ]);
      queryClient.setQueryData<Notification[]>(
        ["notifications", user?.id],
        (old) =>
          (old ?? []).map((n) =>
            n.id === id ? { ...n, read_at: new Date().toISOString() } : n,
          ),
      );
      return { previous };
    },
    onError: (err, _id, context) => {
      if (context?.previous)
        queryClient.setQueryData(["notifications", user?.id], context.previous);
      toast("Couldn't mark as read. Try again.", "error");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      const res = await markAllNotificationsRead(user.id);
      if (!res.ok) throw new Error(res.error);
    },
    onMutate: async () => {
      await queryClient.cancelQueries({
        queryKey: ["notifications", user?.id],
      });
      const previous = queryClient.getQueryData<Notification[]>([
        "notifications",
        user?.id,
      ]);
      queryClient.setQueryData<Notification[]>(
        ["notifications", user?.id],
        (old) =>
          (old ?? []).map((n) =>
            n.read_at ? n : { ...n, read_at: new Date().toISOString() },
          ),
      );
      return { previous };
    },
    onError: (err, _vars, context) => {
      if (context?.previous)
        queryClient.setQueryData(["notifications", user?.id], context.previous);
      toast("Couldn't mark all as read. Try again.", "error");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteNotification,
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({
        queryKey: ["notifications", user?.id],
      });
      const previous = queryClient.getQueryData<Notification[]>([
        "notifications",
        user?.id,
      ]);
      queryClient.setQueryData<Notification[]>(
        ["notifications", user?.id],
        (old) => (old ?? []).filter((n) => n.id !== id),
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous)
        queryClient.setQueryData(["notifications", user?.id], context.previous);
      toast("Couldn't delete that notification.", "error");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const clearAllMutation = useMutation({
    mutationFn: clearAllNotifications,
    onMutate: async () => {
      await queryClient.cancelQueries({
        queryKey: ["notifications", user?.id],
      });
      const previous = queryClient.getQueryData<Notification[]>([
        "notifications",
        user?.id,
      ]);
      queryClient.setQueryData<Notification[]>(["notifications", user?.id], []);
      return { previous };
    },
    onSuccess: () => {
      toast("Inbox cleared", "success");
    },
    onError: (_err, _vars, context) => {
      if (context?.previous)
        queryClient.setQueryData(["notifications", user?.id], context.previous);
      toast("Couldn't clear notifications.", "error");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  // Live-refresh: a new server-side notification arrives → invalidate
  // the inbox query so the list + unread badge update without waiting
  // for a manual pull-to-refresh.
  useNotificationsRealtime({
    userId: user?.id,
    onChange: () =>
      queryClient.invalidateQueries({ queryKey: ["notifications"] }),
    // Also show a local push so the user is alerted even if their
    // Expo token registration failed upstream. The hook dedupes by
    // (type, order_id) so we don't spam them.
    showLocalPush: true,
  });

  // Newest first, so day/month groups are contiguous and labels never repeat.
  const notifications = useMemo(
    () =>
      [...(notificationsQuery.data ?? [])].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    [notificationsQuery.data],
  );

  const unreadByFilter = useMemo(() => {
    const counts: Record<NotifFilter, number> = {
      all: 0,
      messages: 0,
      alerts: 0,
      social: 0,
      saved: 0,
    };
    notifications.forEach((notification) => {
      if (notification.read_at) return;
      counts.all += 1;
      (Object.keys(FILTER_TYPES) as Exclude<NotifFilter, "all">[]).forEach(
        (key) => {
          if (matchesFilter(notification, key)) {
            counts[key] += 1;
          }
        },
      );
    });
    return counts;
  }, [notifications]);

  const visibleNotifications = useMemo(
    () => notifications.filter((n) => matchesFilter(n, filter)),
    [notifications, filter],
  );

  const handlePress = useCallback(
    (item: Notification) => {
      if (!item.read_at) markReadMutation.mutate(item.id);

      const data = item.data;
      if (data?.screen && typeof data.screen === "string") {
        // The screen path comes from a push-notification payload (server
        // or provider controlled) — only follow it if it looks like a
        // well-formed in-app route, and never let a bad value crash
        // navigation with no feedback.
        if (!isSafeInAppPath(data.screen)) {
          console.warn(
            "[notifications] rejected unsafe screen target:",
            data.screen,
          );
          toast("This notification's link is no longer valid.", "error");
          return;
        }
        try {
          router.push(data.screen as never);
        } catch (err) {
          console.warn("[notifications] navigation failed:", err);
          toast("Couldn't open this notification.", "error");
        }
        return;
      }
      if (data?.order_id && typeof data.order_id === "string") {
        router.push(`/(main)/account/orders/${data.order_id}` as never);
        return;
      }
      if (data?.product_slug && typeof data.product_slug === "string") {
        router.push(`/(main)/products/${data.product_slug}` as never);
      }
    },
    [markReadMutation, router, toast],
  );

  const sections = useMemo(() => {
    const out: { label: string; items: Notification[] }[] = [];
    visibleNotifications.forEach((n) => {
      const label = dayLabel(n.created_at);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(n);
      else out.push({ label, items: [n] });
    });
    return out;
  }, [visibleNotifications]);

  const todayCount = useMemo(
    () =>
      notifications.filter((n) => dayLabel(n.created_at) === "Today").length,
    [notifications],
  );

  const confirmDelete = (id: string) =>
    Alert.alert("Delete notification?", undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteMutation.mutate(id),
      },
    ]);

  const unreadAll = unreadByFilter.all;

  return (
    <UserPageFrame
      title="Notifications"
      onBack={() => navigateHome(router)}
      right={
        <HeaderButton
          icon="trash-outline"
          label="Clear all notifications"
          disabled={notifications.length === 0}
          onPress={() =>
            Alert.alert(
              "Clear all notifications?",
              "This removes every notification from your inbox.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Clear all",
                  style: "destructive",
                  onPress: () => clearAllMutation.mutate(),
                },
              ],
            )
          }
        />
      }
    >
      <View style={styles.summaryWrap}>
        <View style={styles.summaryShadow}>
          <View style={styles.summary}>
            <View style={styles.summaryBell}>
              <Ionicons
                name={unreadAll > 0 ? "notifications" : "checkmark-done"}
                size={22}
                color={C.accent}
              />
              {unreadAll > 0 ? (
                <View style={styles.summaryBadge}>
                  <Text style={styles.summaryBadgeText}>
                    {unreadAll > 99 ? "99+" : unreadAll}
                  </Text>
                </View>
              ) : null}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.summaryValue} numberOfLines={1}>
                {unreadAll > 0 ? `${unreadAll} unread` : "All caught up"}
              </Text>
              <Text style={styles.summarySub} numberOfLines={1}>
                {notifications.length} total · {todayCount} today
              </Text>
            </View>
            <Pressable
              onPress={() => unreadAll > 0 && markAllMutation.mutate()}
              disabled={unreadAll === 0}
              style={({ pressed }) => [
                styles.summaryBtn,
                pressed && styles.pressed,
                unreadAll === 0 && { opacity: 0.4 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Mark all as read"
            >
              <Ionicons name="checkmark-done" size={16} color={C.lime} />
              <Text style={styles.summaryBtnText}>Read all</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* ── Filters ─────────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterRow}
      >
        {FILTERS.map((item) => {
          const selected = filter === item.key;
          const unread = unreadByFilter[item.key];
          return (
            <Pressable
              key={item.key}
              onPress={() => setFilter(item.key)}
              style={({ pressed }) => [
                styles.filterChip,
                selected && styles.filterChipActive,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${item.label}${unread > 0 ? `, ${unread} unread` : ""}`}
            >
              <Ionicons
                name={item.icon}
                size={15}
                color={selected ? C.lime : C.text}
              />
              <Text style={[styles.filterChipText, selected && styles.filterChipTextActive]}>
                {item.label}
              </Text>
              {unread > 0 && (
                <View style={[styles.filterCount, selected && styles.filterCountActive]}>
                  <Text style={[styles.filterCountText, selected && styles.filterCountTextActive]}>
                    {unread}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      {notificationsQuery.isLoading ? (
        <View style={styles.loadingList}>
          <View style={styles.groupCard}>
            {[1, 2, 3, 4].map((i) => (
              <View key={i} style={[styles.row, i > 1 && styles.rowDivider]}>
                <Skeleton width={46} height={46} borderRadius={23} />
                <View style={{ flex: 1, gap: 8 }}>
                  <Skeleton width="85%" height={14} />
                  <Skeleton width="40%" height={11} />
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : notificationsQuery.isError ? (
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn't load notifications"
          sub="Check your connection and try again."
          action={
            <Pressable
              onPress={() => notificationsQuery.refetch()}
              style={({ pressed }) => [
                styles.retryBtn,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
            >
              <Ionicons name="refresh" size={15} color={C.lime} />
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          }
        />
      ) : visibleNotifications.length === 0 ? (
        <EmptyState
          icon={
            filter === "all" ? "notifications-off-outline" : "file-tray-outline"
          }
          title={filter === "all" ? "Nothing new, yet" : "Nothing here yet"}
          sub={
            filter === "all"
              ? "Order updates, offers and alerts will arrive here."
              : "Nothing in this category yet."
          }
        />
      ) : (
        <FlatList
          data={sections}
          keyExtractor={(s, i) => `${i}-${s.label}`}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: insets.bottom + spacing[8],
          }}
          refreshControl={
            <RefreshControl
              refreshing={
                notificationsQuery.isFetching && !notificationsQuery.isLoading
              }
              onRefresh={() => notificationsQuery.refetch()}
              tintColor={C.accent}
            />
          }
          renderItem={({ item: section }) => (
            <View>
              <View style={styles.dayHeader}>
                <Text style={styles.dayLabel}>{section.label}</Text>
                <View style={styles.dayCount}>
                  <Text style={styles.dayCountText}>{section.items.length}</Text>
                </View>
              </View>
              <View style={styles.groupShadow}>
              <View style={styles.groupCard}>
                {section.items.map((n, i) => (
                  <NotificationRow
                    key={n.id}
                    item={n}
                    first={i === 0}
                    onPress={() => handlePress(n)}
                    onDelete={() => confirmDelete(n.id)}
                  />
                ))}
              </View>
              </View>
            </View>
          )}
        />
      )}
    </UserPageFrame>
  );
}

function EmptyState({
  icon,
  title,
  sub,
  action,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  sub: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyCard}>
        <View style={styles.emptyIcon}>
          <Ionicons name={icon} size={30} color={C.accent} />
        </View>
        <Text style={styles.emptyTitle}>{title}</Text>
        <Text style={styles.emptySub}>{sub}</Text>
        {action}
      </View>
    </View>
  );
}

function NotificationRow({
  item,
  first,
  onPress,
  onDelete,
}: {
  item: Notification;
  first: boolean;
  onPress: () => void;
  onDelete: () => void;
}) {
  const isUnread = !item.read_at;
  const imageUrl = getNotificationImage(item);
  const meta = TYPE_META[normalizeType(item.type ?? "")] ?? DEFAULT_TYPE_META;
  const tint =
    meta.tone === "olive"
      ? C.accent
      : meta.tone === "rust"
        ? C.rust
        : meta.tone === "ochre"
          ? "#9a7a26"
          : C.text;
  const tileBg =
    meta.tone === "olive"
      ? C.accentSoft
      : meta.tone === "rust"
        ? "rgba(184,92,58,0.1)"
        : meta.tone === "ochre"
          ? "rgba(200,164,74,0.14)"
          : "#f3f1e8";
  const hasBody = !!item.body?.trim();
  const title = item.title?.trim();
  const message = hasBody ? item.body : item.title;
  const showTitle = hasBody && !!title && title !== item.body?.trim();

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onDelete}
      delayLongPress={350}
      style={({ pressed }) => [
        styles.row,
        !first && styles.rowDivider,
        pressed && { backgroundColor: "rgba(22,23,15,0.03)" },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${isUnread ? "Unread. " : ""}${showTitle ? `${title}. ` : ""}${message ?? ""}`}
      accessibilityHint="Long-press to delete"
    >
      <View style={[styles.iconTile, { backgroundColor: tileBg }]}>
        <Ionicons name={meta.icon} size={20} color={tint} />
      </View>

      <View style={styles.rowBody}>
        <View style={styles.metaRow}>
          <Text style={[styles.typeLabel, { color: tint }]}>{meta.label}</Text>
          <Text style={styles.metaDot}>·</Text>
          <Text style={styles.time}>{formatRelativeShort(item.created_at)}</Text>
          <View style={{ flex: 1 }} />
          {isUnread ? <View style={styles.unreadDot} /> : null}
        </View>
        {showTitle ? (
          <Text
            style={[styles.title, !isUnread && styles.titleRead]}
            numberOfLines={1}
          >
            {title}
          </Text>
        ) : null}
        <Text
          style={[
            styles.message,
            showTitle && styles.messageSecondary,
            !showTitle && !isUnread && styles.titleRead,
          ]}
          numberOfLines={showTitle ? 2 : 3}
        >
          {message}
        </Text>
      </View>

      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={styles.thumb}
          contentFit="cover"
          transition={200}
        />
      ) : null}

      <Pressable
        onPress={onDelete}
        hitSlop={10}
        accessibilityLabel="Delete notification"
        style={({ pressed }) => [styles.deleteBtn, pressed && { backgroundColor: "#f3f1e8" }]}
      >
        <Ionicons name="close" size={15} color={C.faint} />
      </Pressable>
    </Pressable>
  );
}

const SHADOW = {
  shadowColor: "#16170f",
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.06,
  shadowRadius: 20,
  elevation: 3,
} as const;

const styles = StyleSheet.create({
  summaryWrap: { paddingHorizontal: 20, paddingBottom: 4 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },

  /* Summary */
  summaryShadow: { borderRadius: 26, backgroundColor: C.card, ...SHADOW },
  summary: {
    borderRadius: 26,
    borderCurve: "continuous",
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  summaryBell: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.accentSoft,
  },
  summaryBadge: {
    position: "absolute",
    top: -2,
    right: -4,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 5,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.ink,
    borderWidth: 2,
    borderColor: C.card,
  },
  summaryBadgeText: { fontFamily: fontFamilies.sans.bold, fontSize: 10, color: C.lime },
  summaryValue: { fontFamily: fontFamilies.sans.bold, fontSize: 18, letterSpacing: -0.4, color: C.text },
  summarySub: { fontFamily: fontFamilies.sans.regular, fontSize: 13, color: C.muted, marginTop: 1 },
  summaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 42,
    paddingHorizontal: 16,
    borderRadius: 21,
    backgroundColor: C.ink,
  },
  summaryBtnText: { fontFamily: fontFamilies.sans.semibold, fontSize: 13.5, color: C.cream },

  /* Filters */
  filterScroll: { flexGrow: 0 },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    height: 42,
    paddingLeft: 14,
    paddingRight: 16,
    borderRadius: 21,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
  },
  filterChipActive: { backgroundColor: C.ink, borderColor: C.ink },
  filterChipText: { fontFamily: fontFamilies.sans.semibold, fontSize: 13.5, color: C.text },
  filterChipTextActive: { color: C.cream },
  filterCount: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.accentSoft,
    marginRight: -6,
  },
  filterCountActive: { backgroundColor: "rgba(200,224,138,0.18)" },
  filterCountText: { fontFamily: fontFamilies.sans.semibold, fontSize: 11, color: C.muted },
  filterCountTextActive: { color: C.lime },

  /* Day groups */
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 18,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  dayLabel: { fontFamily: fontFamilies.sans.bold, fontSize: 17, letterSpacing: -0.3, color: C.text },
  dayCount: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.accentSoft,
  },
  dayCountText: { fontFamily: fontFamilies.sans.semibold, fontSize: 11, color: C.muted },
  groupShadow: { borderRadius: 26, backgroundColor: C.card, ...SHADOW },
  groupCard: {
    backgroundColor: C.card,
    borderRadius: 26,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: C.line,
    overflow: "hidden",
  },
  loadingList: { paddingHorizontal: 20, paddingTop: 20 },

  /* Row */
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 16,
    paddingLeft: 16,
    paddingRight: 10,
    gap: 12,
  },
  rowDivider: { borderTopWidth: 1, borderTopColor: C.line },
  iconTile: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  rowBody: { flex: 1, minWidth: 0, gap: 3 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5, minHeight: 18 },
  typeLabel: { fontFamily: fontFamilies.sans.semibold, fontSize: 12 },
  metaDot: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: C.faint },
  time: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: C.muted },
  unreadDot: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: C.rust },
  title: { fontFamily: fontFamilies.sans.bold, fontSize: 15, letterSpacing: -0.2, color: C.text },
  titleRead: { fontFamily: fontFamilies.sans.semibold, color: "#3d3d36" },
  message: { fontFamily: fontFamilies.sans.bold, fontSize: 15, lineHeight: 20, color: C.text },
  messageSecondary: { fontFamily: fontFamilies.sans.regular, fontSize: 13.5, lineHeight: 19, color: C.muted },
  thumb: { width: 52, height: 52, borderRadius: 16, backgroundColor: "#f0ede2" },
  deleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginTop: -4,
    alignItems: "center",
    justifyContent: "center",
  },

  /* Empty */
  emptyWrap: { flex: 1, paddingHorizontal: 20, paddingTop: 20 },
  emptyCard: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 28,
    borderRadius: 26,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    gap: 8,
  },
  emptyIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.accentSoft,
    marginBottom: 6,
  },
  emptyTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 19, letterSpacing: -0.4, color: C.text },
  emptySub: { fontFamily: fontFamilies.sans.regular, fontSize: 13.5, lineHeight: 19, color: C.muted, textAlign: "center" },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    height: 46,
    paddingHorizontal: 22,
    borderRadius: 23,
    backgroundColor: C.ink,
  },
  retryText: { fontFamily: fontFamilies.sans.bold, fontSize: 14, color: C.cream },
});
