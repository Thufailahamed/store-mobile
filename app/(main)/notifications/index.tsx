import React, { useMemo, useState, useCallback } from "react";
import {
  Alert,
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ScrollView,
  TouchableOpacity,
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
import { useTheme } from "@/lib/hooks/useTheme";
import { fontFamilies } from "@/lib/theme/fonts";
import { spacing, radii, shadows, typography } from "@/lib/theme/tokens";
import { PaperBackground } from "@/components/layout";
import { useNotificationsRealtime } from "@/lib/hooks/useNotificationsRealtime";

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
  const mins = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 60000
  );
  if (mins < 1) return "now";
  if (mins < 60) return `${mins} mn`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} d`;
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
    (startOfDay(today) - startOfDay(date)) / 86400000
  );
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) {
    return date.toLocaleDateString("en-LK", { weekday: "long" });
  }
  return "Earlier";
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
  return t;
}

function matchesFilter(notification: Notification, filter: NotifFilter): boolean {
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
  const theme = useTheme();
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
      await queryClient.cancelQueries({ queryKey: ["notifications", user?.id] });
      const previous = queryClient.getQueryData<Notification[]>(["notifications", user?.id]);
      queryClient.setQueryData<Notification[]>(["notifications", user?.id], (old) =>
        (old ?? []).map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
      );
      return { previous };
    },
    onError: (err, _id, context) => {
      if (context?.previous) queryClient.setQueryData(["notifications", user?.id], context.previous);
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
      await queryClient.cancelQueries({ queryKey: ["notifications", user?.id] });
      const previous = queryClient.getQueryData<Notification[]>(["notifications", user?.id]);
      queryClient.setQueryData<Notification[]>(["notifications", user?.id], (old) =>
        (old ?? []).map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })),
      );
      return { previous };
    },
    onError: (err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(["notifications", user?.id], context.previous);
      toast("Couldn't mark all as read. Try again.", "error");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteNotification,
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ["notifications", user?.id] });
      const previous = queryClient.getQueryData<Notification[]>(["notifications", user?.id]);
      queryClient.setQueryData<Notification[]>(["notifications", user?.id], (old) =>
        (old ?? []).filter((n) => n.id !== id),
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) queryClient.setQueryData(["notifications", user?.id], context.previous);
      toast("Couldn't delete that notification.", "error");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const clearAllMutation = useMutation({
    mutationFn: clearAllNotifications,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["notifications", user?.id] });
      const previous = queryClient.getQueryData<Notification[]>(["notifications", user?.id]);
      queryClient.setQueryData<Notification[]>(["notifications", user?.id], []);
      return { previous };
    },
    onSuccess: () => {
      toast("Inbox cleared", "success");
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(["notifications", user?.id], context.previous);
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
    onChange: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
    // Also show a local push so the user is alerted even if their
    // Expo token registration failed upstream. The hook dedupes by
    // (type, order_id) so we don't spam them.
    showLocalPush: true,
  });

  const notifications = useMemo(
    () => notificationsQuery.data ?? [],
    [notificationsQuery.data]
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
        }
      );
    });
    return counts;
  }, [notifications]);

  const visibleNotifications = useMemo(
    () => notifications.filter((n) => matchesFilter(n, filter)),
    [notifications, filter]
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
          console.warn("[notifications] rejected unsafe screen target:", data.screen);
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
    [markReadMutation, router, toast]
  );

  return (
    <PaperBackground style={styles.screen}>
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + spacing[2],
            borderBottomColor: theme.colors.border,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => navigateHome(router)}
          style={[
            styles.headerBtn,
            { borderColor: theme.colors.border, backgroundColor: theme.colors.card },
          ]}
          hitSlop={8}
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={20} color={theme.colors.foreground} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={[styles.headerEyebrow, { color: theme.accent2.rust }]}>
            INBOX
          </Text>
          <Text style={[styles.headerTitle, { color: theme.colors.foreground }]}>
            Notifications
          </Text>
          <Text
            style={[styles.headerSub, { color: theme.colors.mutedForeground }]}
          >
            {unreadByFilter.all > 0
              ? `${unreadByFilter.all} unread`
              : "You're all caught up"}
          </Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => unreadByFilter.all > 0 && markAllMutation.mutate()}
            style={[
              styles.headerBtn,
              { borderColor: theme.colors.border, backgroundColor: theme.colors.card },
            ]}
            disabled={unreadByFilter.all === 0}
            hitSlop={8}
            accessibilityLabel="Mark all as read"
          >
            <Ionicons
              name="checkmark-done-outline"
              size={18}
              color={
                unreadByFilter.all > 0
                  ? theme.olive[700]
                  : theme.colors.mutedForeground
              }
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() =>
              Alert.alert("Clear all notifications?", "This removes every notification from your inbox.", [
                { text: "Cancel", style: "cancel" },
                { text: "Clear all", style: "destructive", onPress: () => clearAllMutation.mutate() },
              ])
            }
            style={[
              styles.headerBtn,
              { borderColor: theme.colors.border, backgroundColor: theme.colors.card },
            ]}
            disabled={notifications.length === 0}
            hitSlop={8}
            accessibilityLabel="Clear all notifications"
          >
            <Ionicons
              name="trash-outline"
              size={17}
              color={
                notifications.length > 0
                  ? theme.accent2.rust
                  : theme.colors.mutedForeground
              }
            />
          </TouchableOpacity>
        </View>
      </View>

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
                {
                  backgroundColor: selected
                    ? theme.olive[800]
                    : theme.colors.card,
                  borderColor: selected
                    ? theme.olive[800]
                    : theme.colors.border,
                },
                pressed && { opacity: 0.8 },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Ionicons
                name={item.icon}
                size={14}
                color={
                  selected ? theme.paper.cream : theme.colors.mutedForeground
                }
              />
              <Text
                style={[
                  styles.filterChipText,
                  {
                    color: selected
                      ? theme.paper.cream
                      : theme.colors.foreground,
                  },
                ]}
              >
                {item.label}
              </Text>
              {unread > 0 && (
                <View
                  style={[
                    styles.filterCount,
                    {
                      backgroundColor: selected
                        ? theme.paper.cream
                        : theme.accent2.rust,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.filterCountText,
                      { color: selected ? theme.olive[800] : "#fff" },
                    ]}
                  >
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
          {[1, 2, 3, 4].map((i) => (
            <View
              key={i}
              style={[
                styles.card,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Skeleton width={42} height={42} borderRadius={12} />
              <View style={{ flex: 1, gap: 8 }}>
                <Skeleton width="85%" height={14} />
                <Skeleton width="40%" height={11} />
              </View>
            </View>
          ))}
        </View>
      ) : notificationsQuery.isError ? (
        <View style={styles.emptyWrap}>
          <View
            style={[styles.emptyIcon, { backgroundColor: theme.olive[50] }]}
          >
            <Ionicons
              name="cloud-offline-outline"
              size={30}
              color={theme.olive[600]}
            />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.colors.foreground }]}>
            Couldn't load notifications
          </Text>
          <Text style={[styles.emptySub, { color: theme.colors.mutedForeground }]}>
            Check your connection and try again.
          </Text>
          <TouchableOpacity
            onPress={() => notificationsQuery.refetch()}
            style={[styles.retryBtn, { backgroundColor: theme.olive[800] }]}
            accessibilityRole="button"
          >
            <Ionicons name="refresh" size={15} color={theme.paper.cream} />
            <Text style={[styles.retryText, { color: theme.paper.cream }]}>
              Retry
            </Text>
          </TouchableOpacity>
        </View>
      ) : visibleNotifications.length === 0 ? (
        <View style={styles.emptyWrap}>
          <View
            style={[styles.emptyIcon, { backgroundColor: theme.olive[50] }]}
          >
            <Ionicons
              name="notifications-off-outline"
              size={30}
              color={theme.olive[600]}
            />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.colors.foreground }]}>
            {filter === "all" ? "No notifications" : "Nothing here yet"}
          </Text>
          <Text style={[styles.emptySub, { color: theme.colors.mutedForeground }]}>
            {filter === "all"
              ? "Order updates, offers and alerts will show up here."
              : "Nothing in this category yet."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={visibleNotifications}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: spacing[4],
            paddingBottom: insets.bottom + spacing[6],
          }}
          refreshControl={
            <RefreshControl
              refreshing={notificationsQuery.isFetching && !notificationsQuery.isLoading}
              onRefresh={() => notificationsQuery.refetch()}
              tintColor={theme.colors.primary}
            />
          }
          renderItem={({ item, index }) => {
            const label = dayLabel(item.created_at);
            const showLabel =
              index === 0 ||
              dayLabel(visibleNotifications[index - 1].created_at) !== label;
            return (
              <View>
                {showLabel && (
                  <Text
                    style={[
                      styles.dayLabel,
                      { color: theme.colors.mutedForeground },
                    ]}
                  >
                    {label}
                  </Text>
                )}
                <NotificationRow
                  item={item}
                  onPress={() => handlePress(item)}
                  onDelete={() =>
                    Alert.alert("Delete notification?", undefined, [
                      { text: "Cancel", style: "cancel" },
                      { text: "Delete", style: "destructive", onPress: () => deleteMutation.mutate(item.id) },
                    ])
                  }
                />
              </View>
            );
          }}
        />
      )}
    </PaperBackground>
  );
}

function NotificationRow({
  item,
  onPress,
  onDelete,
}: {
  item: Notification;
  onPress: () => void;
  onDelete: () => void;
}) {
  const theme = useTheme();
  const isUnread = !item.read_at;
  const imageUrl = getNotificationImage(item);
  const meta =
    TYPE_META[(item.type ?? "").toLowerCase()] ?? DEFAULT_TYPE_META;
  const tint =
    meta.tone === "olive"
      ? theme.olive[600]
      : meta.tone === "rust"
        ? theme.accent2.rust
        : meta.tone === "ochre"
          ? theme.accent2.ochre
          : theme.ink.soft;
  const message = item.body?.trim() ? item.body : item.title;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: isUnread ? theme.olive[50] : theme.colors.card,
          borderColor: isUnread ? theme.olive[200] : theme.colors.border,
        },
        pressed && { opacity: 0.88 },
      ]}
      accessibilityRole="button"
    >
      <View
        style={[
          styles.iconTile,
          { backgroundColor: `${tint}1A` },
        ]}
      >
        <Ionicons name={meta.icon} size={19} color={tint} />
        {isUnread && (
          <View
            style={[
              styles.unreadDot,
              {
                backgroundColor: theme.accent2.rust,
                borderColor: isUnread ? theme.olive[50] : theme.colors.card,
              },
            ]}
          />
        )}
      </View>

      <View style={styles.rowBody}>
        <Text
          style={[
            styles.message,
            {
              color: theme.colors.foreground,
              fontFamily: isUnread
                ? fontFamilies.sans.bold
                : fontFamilies.sans.semibold,
            },
          ]}
          numberOfLines={3}
        >
          {message}
        </Text>
        <View style={styles.metaRow}>
          <Text style={[styles.typeLabel, { color: tint }]}>
            {meta.label.toUpperCase()}
          </Text>
          <View
            style={[
              styles.metaDot,
              { backgroundColor: theme.colors.mutedForeground },
            ]}
          />
          <Text style={[styles.time, { color: theme.colors.mutedForeground }]}>
            {formatRelativeShort(item.created_at)}
          </Text>
        </View>
      </View>

      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={[styles.thumb, { backgroundColor: theme.colors.muted }]}
          contentFit="cover"
          transition={200}
        />
      ) : null}

      <TouchableOpacity
        onPress={onDelete}
        hitSlop={10}
        accessibilityLabel="Delete notification"
        style={[
          styles.deleteBtn,
          {
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.card,
          },
        ]}
      >
        <Ionicons name="close" size={13} color={theme.colors.mutedForeground} />
      </TouchableOpacity>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing[3],
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: radii.full,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
  },
  headerEyebrow: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
    letterSpacing: typography.letterSpacing.editorial,
  },
  headerTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: typography.fontSizes["2xl"],
    lineHeight: 28,
  },
  headerSub: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: typography.fontSizes.xs,
    marginTop: 1,
  },
  headerActions: {
    flexDirection: "row",
    gap: spacing[2],
  },
  filterScroll: {
    flexGrow: 0,
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    paddingBottom: spacing[1],
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 34,
    paddingHorizontal: spacing[3.5],
    borderRadius: radii.full,
    borderWidth: 1,
  },
  filterChipText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
  },
  filterCount: {
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  filterCountText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 10,
  },
  dayLabel: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
    letterSpacing: typography.letterSpacing.widest,
    textTransform: "uppercase",
    marginTop: spacing[4],
    marginBottom: spacing[2],
    marginLeft: spacing[1],
  },
  loadingList: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
    gap: spacing[2.5],
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radii["2xl"],
    borderWidth: 1,
    paddingVertical: spacing[3],
    paddingLeft: spacing[3],
    paddingRight: spacing[4],
    gap: spacing[3],
    marginBottom: spacing[2.5],
    ...shadows.soft,
  },
  iconTile: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadDot: {
    position: "absolute",
    top: -3,
    right: -3,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
  rowBody: {
    flex: 1,
    gap: 4,
  },
  message: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.sm,
    lineHeight: 19,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  typeLabel: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: typography.letterSpacing.wider,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    opacity: 0.5,
  },
  time: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.xs,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: radii.lg,
  },
  deleteBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
    marginTop: 2,
  },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[8],
    gap: spacing[2],
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing[2],
  },
  emptyTitle: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: typography.fontSizes.lg,
  },
  emptySub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.base,
    textAlign: "center",
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: spacing[3],
    paddingHorizontal: spacing[5],
    height: 40,
    borderRadius: radii.full,
  },
  retryText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.sm,
  },
});
