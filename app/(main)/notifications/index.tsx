import React, { useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
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
} from "@/lib/api";
import type { Notification } from "@/lib/types";
import { Skeleton, useToast } from "@/components/ui";
import { useTheme } from "@/lib/hooks/useTheme";
import { fontFamilies } from "@/lib/theme/fonts";
import { spacing, radii, typography } from "@/lib/theme/tokens";
import { PaperBackground } from "@/components/layout";
import { useNotificationsRealtime } from "@/lib/hooks/useNotificationsRealtime";

type NotifFilter = "all" | "messages" | "alerts" | "social" | "saved";

const FILTERS: {
  key: NotifFilter;
  label?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: "all", label: "All" },
  { key: "messages", icon: "chatbubble-outline" },
  { key: "alerts", icon: "flag-outline" },
  { key: "social", icon: "people-outline" },
  { key: "saved", icon: "bookmark-outline" },
];

const FILTER_TYPES: Record<Exclude<NotifFilter, "all">, string[]> = {
  messages: ["review", "system"],
  alerts: ["order", "delivery", "payment", "stock"],
  social: ["review"],
  saved: ["promo"],
};

const TYPE_BADGE: Record<
  string,
  keyof typeof Ionicons.glyphMap
> = {
  order: "receipt-outline",
  delivery: "bicycle-outline",
  promo: "pricetag-outline",
  review: "star-outline",
  payment: "wallet-outline",
  stock: "alert-circle-outline",
  system: "settings-outline",
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

/** In-app relative path only — no scheme/host, no "..", reasonable length. */
function isSafeInAppPath(path: string): boolean {
  if (path.length === 0 || path.length > 200) return false;
  if (!path.startsWith("/")) return false;
  if (path.includes("://") || path.includes("..")) return false;
  return /^\/[a-zA-Z0-9/_\-().[\]%]*$/.test(path);
}

function matchesFilter(notification: Notification, filter: NotifFilter): boolean {
  if (filter === "all") return true;
  return FILTER_TYPES[filter].includes(notification.type);
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
      return res.ok ? res.data : [];
    },
    enabled: !!user,
  });

  const markReadMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: async () => {
      if (user) await markAllNotificationsRead(user.id);
    },
    onSuccess: () => {
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

  const notifications = notificationsQuery.data ?? [];

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
          if (FILTER_TYPES[key].includes(notification.type)) {
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

  const accent = theme.accent2.rust;

  return (
    <PaperBackground style={styles.screen}>
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + spacing[2],
            backgroundColor: theme.colors.card,
            borderBottomColor: theme.colors.border,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => navigateHome(router)}
          style={styles.headerBtn}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={24} color={theme.colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.foreground }]}>
          Notifications
        </Text>
        <TouchableOpacity
          onPress={() => unreadByFilter.all > 0 && markAllMutation.mutate()}
          style={styles.headerBtn}
          disabled={unreadByFilter.all === 0}
          hitSlop={8}
        >
          <Ionicons
            name="checkmark-done-outline"
            size={22}
            color={
              unreadByFilter.all > 0
                ? theme.colors.foreground
                : theme.colors.mutedForeground
            }
          />
        </TouchableOpacity>
      </View>

      <View
        style={[
          styles.filterBar,
          { backgroundColor: theme.colors.secondary },
        ]}
      >
        {FILTERS.map((item, index) => {
          const selected = filter === item.key;
          const unread = unreadByFilter[item.key];

          return (
            <React.Fragment key={item.key}>
              {index > 0 && (
                <View
                  style={[styles.filterDivider, { backgroundColor: theme.colors.border }]}
                />
              )}
              <Pressable
                onPress={() => setFilter(item.key)}
                style={({ pressed }) => [
                  item.label ? styles.filterPill : styles.filterIconBtn,
                  item.label &&
                    selected && {
                      backgroundColor: theme.colors.card,
                      shadowColor: theme.colors.foreground,
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.08,
                      shadowRadius: 2,
                      elevation: 1,
                    },
                  pressed && { opacity: 0.75 },
                ]}
              >
                {item.label ? (
                  <Text
                    style={[
                      styles.filterPillText,
                      {
                        color: selected
                          ? theme.colors.foreground
                          : theme.colors.mutedForeground,
                        fontFamily: selected
                          ? fontFamilies.sans.bold
                          : fontFamilies.sans.medium,
                      },
                    ]}
                  >
                    {item.label}
                  </Text>
                ) : (
                  <View>
                    <Ionicons
                      name={item.icon!}
                      size={18}
                      color={
                        selected
                          ? theme.colors.foreground
                          : theme.colors.mutedForeground
                      }
                    />
                    {unread > 0 && (
                      <View style={[styles.filterDot, { backgroundColor: accent }]} />
                    )}
                  </View>
                )}
              </Pressable>
            </React.Fragment>
          );
        })}
      </View>

      {notificationsQuery.isLoading ? (
        <View style={styles.loadingList}>
          {[1, 2, 3, 4].map((i) => (
            <View
              key={i}
              style={[styles.row, { borderBottomColor: theme.colors.border }]}
            >
              <Skeleton width={44} height={44} borderRadius={22} />
              <View style={{ flex: 1, gap: 8 }}>
                <Skeleton width="85%" height={14} />
                <Skeleton width="30%" height={12} />
              </View>
              <Skeleton width={52} height={52} borderRadius={8} />
            </View>
          ))}
        </View>
      ) : visibleNotifications.length === 0 ? (
        <View style={styles.emptyWrap}>
          <View
            style={[
              styles.emptyIcon,
              { backgroundColor: theme.colors.secondary },
            ]}
          >
            <Ionicons
              name="notifications-off-outline"
              size={32}
              color={theme.colors.mutedForeground}
            />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.colors.foreground }]}>
            No notifications
          </Text>
          <Text style={[styles.emptySub, { color: theme.colors.mutedForeground }]}>
            {filter === "all"
              ? "You're all caught up"
              : "Nothing in this category yet"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={visibleNotifications}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + spacing[6] }}
          refreshControl={
            <RefreshControl
              refreshing={notificationsQuery.isFetching && !notificationsQuery.isLoading}
              onRefresh={() => notificationsQuery.refetch()}
              tintColor={theme.colors.primary}
            />
          }
          renderItem={({ item }) => (
            <NotificationRow
              item={item}
              onPress={() => handlePress(item)}
              accent={accent}
            />
          )}
        />
      )}
    </PaperBackground>
  );
}

function NotificationRow({
  item,
  onPress,
  accent,
}: {
  item: Notification;
  onPress: () => void;
  accent: string;
}) {
  const theme = useTheme();
  const isUnread = !item.read_at;
  const imageUrl = getNotificationImage(item);
  const badgeIcon = TYPE_BADGE[item.type] ?? "bookmark-outline";
  const message = item.body?.trim() ? item.body : item.title;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: theme.colors.card,
          borderBottomColor: theme.colors.border,
        },
        pressed && { opacity: 0.85 },
      ]}
    >
      <View style={styles.rowLeft}>
        {isUnread ? (
          <View style={[styles.unreadDot, { backgroundColor: accent }]} />
        ) : (
          <View style={styles.unreadDotPlaceholder} />
        )}

        <View style={styles.avatarWrap}>
          <View
            style={[
              styles.avatar,
              { backgroundColor: theme.colors.foreground },
            ]}
          >
            <Text style={[styles.avatarText, { color: theme.colors.card }]}>L</Text>
          </View>
          <View
            style={[
              styles.avatarBadge,
              { backgroundColor: accent, borderColor: theme.colors.card },
            ]}
          >
            <Ionicons name={badgeIcon} size={9} color="#fff" />
          </View>
        </View>
      </View>

      <View style={styles.rowBody}>
        <Text
          style={[styles.message, { color: theme.colors.foreground }]}
          numberOfLines={3}
        >
          {message}
        </Text>
        <Text style={[styles.time, { color: theme.colors.mutedForeground }]}>
          {formatRelativeShort(item.created_at)}
        </Text>
      </View>

      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={[styles.thumb, { backgroundColor: theme.colors.muted }]}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <View
          style={[
            styles.thumb,
            styles.thumbPlaceholder,
            { backgroundColor: theme.colors.secondary },
          ]}
        >
          <Ionicons
            name="image-outline"
            size={18}
            color={theme.colors.mutedForeground}
          />
        </View>
      )}
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
    justifyContent: "space-between",
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[3],
    borderBottomWidth: 1,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.bold,
  },
  filterBar: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: spacing[4],
    marginTop: spacing[4],
    marginBottom: spacing[2],
    borderRadius: radii.xl,
    padding: spacing[1],
    minHeight: 48,
  },
  filterPill: {
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[2.5],
    borderRadius: radii.lg,
    marginRight: spacing[1],
  },
  filterPillText: {
    fontSize: typography.fontSizes.sm,
  },
  filterIconBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing[2.5],
    minWidth: 44,
  },
  filterDivider: {
    width: 1,
    height: 22,
  },
  filterDot: {
    position: "absolute",
    top: -2,
    right: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  loadingList: {
    paddingTop: spacing[2],
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing[3],
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  unreadDotPlaceholder: {
    width: 8,
  },
  avatarWrap: {
    width: 44,
    height: 44,
    position: "relative",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 22,
    lineHeight: 26,
  },
  avatarBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
  },
  rowBody: {
    flex: 1,
    gap: spacing[1.5],
    paddingRight: spacing[1],
  },
  message: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.sm,
    lineHeight: 19,
  },
  time: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.xs,
  },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: radii.md,
  },
  thumbPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
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
});
