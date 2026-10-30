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
import { LinearGradient } from "expo-linear-gradient";
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
import { colors, spacing, radii, typography } from "@/lib/theme/tokens";
import { PaperBackground } from "@/components/layout";
import { useNotificationsRealtime } from "@/lib/hooks/useNotificationsRealtime";
import {
  HeaderButton,
  UserPageFrame,
  withUserTheme,
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
    (startOfDay(today) - startOfDay(date)) / 86400000,
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

  const notifications = useMemo(
    () => notificationsQuery.data ?? [],
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
        {/* Summary card */}
        <LinearGradient
          colors={["#22241a", "#15160f"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.summary}
        >
          <View style={styles.summaryGlow} pointerEvents="none" />
          <View style={styles.summaryHairline} pointerEvents="none" />
          <View style={styles.summaryLeft}>
            <View style={styles.summaryBell}>
              <Ionicons
                name={unreadAll > 0 ? "notifications" : "checkmark-done"}
                size={18}
                color={GOLD_LIGHT}
              />
              {unreadAll > 0 ? <View style={styles.summaryBellDot} /> : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryValue}>
                {unreadAll > 0 ? unreadAll : "All clear"}
                {unreadAll > 0 ? (
                  <Text style={styles.summaryValueUnit}> unread</Text>
                ) : null}
              </Text>
              <Text style={styles.summarySub} numberOfLines={1}>
                {notifications.length} total · {todayCount} today
              </Text>
            </View>
          </View>
          <Pressable
            onPress={() => unreadAll > 0 && markAllMutation.mutate()}
            disabled={unreadAll === 0}
            style={({ pressed }) => [
              pressed && styles.pressed,
              unreadAll === 0 && { opacity: 0.5 },
            ]}
            accessibilityLabel="Mark all as read"
          >
            <LinearGradient
              colors={[GOLD_LIGHT, theme.accent2.ochre]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.summaryBtn}
            >
              <Ionicons
                name="checkmark-done"
                size={14}
                color={theme.olive[900]}
              />
              <Text style={styles.summaryBtnText}>Read all</Text>
            </LinearGradient>
          </Pressable>
        </LinearGradient>
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
            >
              <Ionicons
                name={item.icon}
                size={14}
                color={selected ? GOLD_LIGHT : theme.ink.mute}
              />
              <Text
                style={[
                  styles.filterChipText,
                  selected && { color: theme.paper.cream },
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
                        ? GOLD_LIGHT
                        : theme.accent2.rust,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.filterCountText,
                      { color: selected ? theme.olive[900] : "#fff" },
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
          <View style={styles.groupCard}>
            {[1, 2, 3, 4].map((i) => (
              <View key={i} style={[styles.row, i > 1 && styles.rowDivider]}>
                <Skeleton width={46} height={46} borderRadius={15} />
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
              <Ionicons name="refresh" size={15} color={theme.paper.cream} />
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
          keyExtractor={(s) => s.label}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: spacing[4],
            paddingBottom: insets.bottom + spacing[8],
          }}
          refreshControl={
            <RefreshControl
              refreshing={
                notificationsQuery.isFetching && !notificationsQuery.isLoading
              }
              onRefresh={() => notificationsQuery.refetch()}
              tintColor={theme.colors.primary}
            />
          }
          renderItem={({ item: section }) => (
            <View>
              <View style={styles.dayHeader}>
                <Text style={styles.dayLabel}>{section.label}</Text>
                <View style={styles.dayLine} />
                <Text style={styles.dayCount}>{section.items.length}</Text>
              </View>
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
          )}
        />
      )}
    </UserPageFrame>
  );
}

const GOLD_LIGHT = "#e8d496";

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
  const theme = useTheme();
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyRingOuter}>
        <View style={styles.emptyRingInner}>
          <LinearGradient
            colors={["#22241a", "#15160f"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.emptyIcon}
          >
            <Ionicons name={icon} size={26} color={GOLD_LIGHT} />
          </LinearGradient>
        </View>
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySub}>{sub}</Text>
      {action}
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
  const theme = useTheme();
  const isUnread = !item.read_at;
  const imageUrl = getNotificationImage(item);
  const meta = TYPE_META[normalizeType(item.type ?? "")] ?? DEFAULT_TYPE_META;
  const tint =
    meta.tone === "olive"
      ? theme.olive[600]
      : meta.tone === "rust"
        ? theme.accent2.rust
        : meta.tone === "ochre"
          ? theme.accent2.ochre
          : theme.ink.soft;
  const hasBody = !!item.body?.trim();
  const title = item.title?.trim();
  const message = hasBody ? item.body : item.title;
  const showTitle = hasBody && !!title && title !== item.body?.trim();
  const data = item.data;
  const actionable =
    (typeof data?.screen === "string" && data.screen.length > 0) ||
    typeof data?.order_id === "string" ||
    typeof data?.product_slug === "string";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        !first && styles.rowDivider,
        isUnread && styles.rowUnread,
        pressed && { backgroundColor: theme.olive[50] },
      ]}
      accessibilityRole="button"
    >
      {isUnread ? <View style={styles.unreadBar} /> : null}

      <View
        style={[
          styles.iconTile,
          { backgroundColor: `${tint}14`, borderColor: `${tint}30` },
        ]}
      >
        <Ionicons name={meta.icon} size={19} color={tint} />
        {isUnread && <View style={styles.unreadDot} />}
      </View>

      <View style={styles.rowBody}>
        <View style={styles.metaRow}>
          <View style={[styles.typeChip, { backgroundColor: `${tint}14` }]}>
            <Text style={[styles.typeLabel, { color: tint }]}>
              {meta.label.toUpperCase()}
            </Text>
          </View>
          <Text style={styles.time}>
            {formatRelativeShort(item.created_at)}
          </Text>
          {isUnread ? <Text style={styles.newTag}>NEW</Text> : null}
        </View>
        {showTitle ? (
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        ) : null}
        <Text
          style={[
            styles.message,
            showTitle && styles.messageSecondary,
            !showTitle && isUnread && { fontFamily: fontFamilies.sans.bold },
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

      <View style={styles.rowSide}>
        <Pressable
          onPress={onDelete}
          hitSlop={10}
          accessibilityLabel="Delete notification"
          style={({ pressed }) => [
            styles.deleteBtn,
            pressed && { backgroundColor: theme.colors.muted },
          ]}
        >
          <Ionicons name="close" size={14} color={theme.ink.mute} />
        </Pressable>
        {actionable ? (
          <Ionicons
            name="chevron-forward"
            size={15}
            color={theme.colors.border}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

const cardShadow = {
  shadowColor: "#2c3119",
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.07,
  shadowRadius: 22,
  elevation: 4,
} as const;

const styles = withUserTheme(
  StyleSheet.create({
    screen: { flex: 1 },
    summaryWrap: { paddingHorizontal: 20, paddingBottom: 4 },
    pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },

    /* Header */
    header: {
      paddingHorizontal: spacing[4],
      paddingBottom: spacing[2],
    },
    headerTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    headerBtn: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: colors.paper.cream,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.light.border,
      alignItems: "center",
      justifyContent: "center",
      ...cardShadow,
      shadowOpacity: 0.06,
      shadowRadius: 10,
    },
    titleBlock: { marginTop: spacing[4], paddingHorizontal: 4 },
    eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    eyebrowBar: {
      width: 18,
      height: 2,
      borderRadius: 1,
      backgroundColor: colors.accent2.ochre,
    },
    headerEyebrow: {
      fontFamily: fontFamilies.mono.semibold,
      fontSize: 9.5,
      letterSpacing: 1.8,
      color: colors.accent2.rust,
    },
    headerTitle: {
      fontFamily: fontFamilies.sans.bold,
      fontSize: 40,
      lineHeight: 46,
      letterSpacing: -1.2,
      color: colors.ink.DEFAULT,
      marginTop: 4,
    },
    headerTitleAccent: {
      fontFamily: fontFamilies.sans.medium,
      color: colors.olive[600],
    },

    /* Summary */
    summary: {
      marginTop: spacing[4],
      borderRadius: 22,
      padding: 14,
      paddingLeft: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: "rgba(232,212,150,0.16)",
      shadowColor: "#161a0a",
      shadowOffset: { width: 0, height: 14 },
      shadowOpacity: 0.25,
      shadowRadius: 22,
      elevation: 10,
    },
    summaryGlow: {
      position: "absolute",
      top: -60,
      right: -40,
      width: 160,
      height: 160,
      borderRadius: 80,
      backgroundColor: "rgba(200,164,74,0.16)",
    },
    summaryHairline: {
      position: "absolute",
      top: 0,
      left: 30,
      right: 30,
      height: 1,
      backgroundColor: "rgba(232,212,150,0.45)",
    },
    summaryLeft: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    summaryBell: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor: "rgba(232,212,150,0.1)",
      borderWidth: 1,
      borderColor: "rgba(232,212,150,0.22)",
      alignItems: "center",
      justifyContent: "center",
    },
    summaryBellDot: {
      position: "absolute",
      top: 9,
      right: 10,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.accent2.rust,
      borderWidth: 1.5,
      borderColor: colors.olive[900],
    },
    summaryValue: {
      fontFamily: fontFamilies.sans.bold,
      fontSize: 22,
      color: colors.paper.cream,
      letterSpacing: -0.4,
    },
    summaryValueUnit: {
      fontFamily: fontFamilies.sans.medium,
      fontSize: 13,
      color: "rgba(244,242,234,0.65)",
      letterSpacing: 0,
    },
    summarySub: {
      fontFamily: fontFamilies.mono.regular,
      fontSize: 10,
      color: "rgba(244,242,234,0.5)",
      letterSpacing: 0.4,
      marginTop: 2,
    },
    summaryBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 13,
      height: 36,
      borderRadius: 18,
    },
    summaryBtnText: {
      fontFamily: fontFamilies.sans.bold,
      fontSize: 12,
      color: colors.olive[900],
    },

    /* Filters */
    filterScroll: { flexGrow: 0 },
    filterRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing[2],
      paddingHorizontal: spacing[4],
      paddingTop: spacing[2],
      paddingBottom: spacing[2],
    },
    filterChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      height: 38,
      paddingHorizontal: 15,
      borderRadius: radii.full,
      backgroundColor: colors.paper.cream,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.light.border,
    },
    filterChipActive: {
      backgroundColor: "#15160f",
      borderColor: colors.olive[900],
      ...cardShadow,
      shadowOpacity: 0.2,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 5 },
    },
    filterChipText: {
      fontFamily: fontFamilies.sans.semibold,
      fontSize: 12.5,
      color: colors.ink.soft,
    },
    filterCount: {
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 5,
    },
    filterCountText: { fontFamily: fontFamilies.sans.bold, fontSize: 10 },

    /* Day groups */
    dayHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginTop: spacing[5],
      marginBottom: spacing[2.5],
      paddingHorizontal: 4,
    },
    dayLabel: {
      fontFamily: fontFamilies.sans.medium,
      fontSize: 17,
      color: colors.ink.DEFAULT,
    },
    dayLine: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.light.border,
    },
    dayCount: {
      fontFamily: fontFamilies.mono.medium,
      fontSize: 10,
      color: colors.ink.mute,
      letterSpacing: 0.6,
    },
    groupCard: {
      backgroundColor: "#FFFFFF",
      borderRadius: 24,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.light.border,
      overflow: "hidden",
      ...cardShadow,
    },
    loadingList: { paddingHorizontal: spacing[4], paddingTop: spacing[4] },

    /* Row */
    row: {
      flexDirection: "row",
      alignItems: "flex-start",
      paddingVertical: 15,
      paddingLeft: 16,
      paddingRight: 12,
      gap: 12,
    },
    rowDivider: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.light.border,
    },
    rowUnread: { backgroundColor: "#fbf8ec" },
    unreadBar: {
      position: "absolute",
      left: 0,
      top: 14,
      bottom: 14,
      width: 3,
      borderTopRightRadius: 3,
      borderBottomRightRadius: 3,
      backgroundColor: colors.accent2.ochre,
    },
    iconTile: {
      width: 46,
      height: 46,
      borderRadius: 15,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    unreadDot: {
      position: "absolute",
      top: -3,
      right: -3,
      width: 11,
      height: 11,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: "#fbf8ec",
      backgroundColor: colors.accent2.rust,
    },
    rowBody: { flex: 1, minWidth: 0, gap: 5 },
    metaRow: { flexDirection: "row", alignItems: "center", gap: 7 },
    typeChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
    typeLabel: {
      fontFamily: fontFamilies.mono.semibold,
      fontSize: 8.5,
      letterSpacing: 0.9,
    },
    time: {
      fontFamily: fontFamilies.mono.regular,
      fontSize: 10,
      color: colors.ink.mute,
    },
    newTag: {
      fontFamily: fontFamilies.mono.semibold,
      fontSize: 8.5,
      letterSpacing: 0.9,
      color: colors.accent2.rust,
    },
    title: {
      fontFamily: fontFamilies.sans.bold,
      fontSize: 14,
      color: colors.ink.DEFAULT,
    },
    message: {
      fontFamily: fontFamilies.sans.semibold,
      fontSize: 14,
      lineHeight: 20,
      color: colors.ink.DEFAULT,
    },
    messageSecondary: {
      fontFamily: fontFamilies.sans.regular,
      fontSize: 13,
      lineHeight: 18,
      color: colors.ink.mute,
    },
    thumb: {
      width: 52,
      height: 52,
      borderRadius: 14,
      backgroundColor: colors.light.muted,
    },
    rowSide: {
      alignSelf: "stretch",
      alignItems: "center",
      justifyContent: "space-between",
    },
    deleteBtn: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
    },

    /* Empty */
    emptyWrap: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing[8],
      paddingBottom: spacing[16],
      gap: spacing[2],
    },
    emptyRingOuter: {
      width: 132,
      height: 132,
      borderRadius: 66,
      borderWidth: 1,
      borderColor: "rgba(200,164,74,0.25)",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing[3],
    },
    emptyRingInner: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: colors.paper.cream,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.light.border,
      alignItems: "center",
      justifyContent: "center",
      ...cardShadow,
    },
    emptyIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: "center",
      justifyContent: "center",
    },
    emptyTitle: {
      fontFamily: fontFamilies.sans.bold,
      fontSize: 24,
      letterSpacing: -0.5,
      color: colors.ink.DEFAULT,
    },
    emptySub: {
      fontFamily: fontFamilies.sans.regular,
      fontSize: 14,
      lineHeight: 20,
      color: colors.ink.mute,
      textAlign: "center",
    },
    retryBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: spacing[3],
      paddingHorizontal: spacing[5],
      height: 42,
      borderRadius: radii.full,
      backgroundColor: "#15160f",
    },
    retryText: {
      fontFamily: fontFamilies.sans.semibold,
      fontSize: typography.fontSizes.sm,
      color: colors.paper.cream,
    },
  }),
);
