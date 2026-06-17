import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useAuth } from "@/lib/supabase/auth";
import { getNotifications, markNotificationRead, markAllNotificationsRead } from "@/lib/api";
import { colors, typography, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import type { Notification } from "@/lib/types";

const TYPE_ICONS: Record<string, { name: "receipt-outline" | "pricetag-outline" | "settings-outline" | "star-outline" | "bicycle-outline" | "wallet-outline" | "alert-circle-outline" | "notifications-outline" | "return-down-back-outline"; color: string }> = {
  order: { name: "receipt-outline", color: colors.olive[600] },
  return: { name: "return-down-back-outline", color: colors.accent2.rust },
  promo: { name: "pricetag-outline", color: colors.accent2.ochre },
  system: { name: "settings-outline", color: colors.light.mutedForeground },
  review: { name: "star-outline", color: "#f59e0b" },
  delivery: { name: "bicycle-outline", color: colors.accent2.rust },
  payment: { name: "wallet-outline", color: colors.olive[400] },
  stock: { name: "alert-circle-outline", color: "#f59e0b" },
};

function formatRelative(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-LK", { month: "short", day: "numeric" });
}

export default function SellerNotifications() {
  const router = useRouter();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) return;
    const res = await getNotifications(user.id);
    if (res.ok) setNotifications(res.data);
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const handleMarkRead = async (id: string) => {
    await markNotificationRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
    );
  };

  const handleMarkAllRead = async () => {
    if (!user) return;
    await markAllNotificationsRead(user.id);
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() }))
    );
  };

  const handlePress = async (item: Notification) => {
    if (!item.read_at) await handleMarkRead(item.id);
    const groupId = item.data?.return_group_id as string | undefined;
    if (item.type === "return" && groupId) {
      router.push(`/(seller)/returns/${groupId}` as any);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  if (loading) {
    return (
      <View style={s.loadingWrap}>
        <Ionicons name="notifications-outline" size={32} color={colors.light.mutedForeground} />
        <Text style={s.loadingText}>Loading notifications...</Text>
      </View>
    );
  }

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.headerBg}>
        <View style={s.headerContent}>
          <View>
            <Text style={s.kicker}>NOTIFICATIONS</Text>
            <Text style={s.headerTitle}>Updates</Text>
            {unreadCount > 0 && <Text style={s.unreadLabel}>{unreadCount} unread</Text>}
          </View>
          {unreadCount > 0 && (
            <TouchableOpacity style={s.markAllBtn} onPress={handleMarkAllRead}>
              <Ionicons name="checkmark-done" size={16} color={colors.olive[600]} />
              <Text style={s.markAllText}>Mark all read</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {notifications.length === 0 ? (
        <View style={s.emptyWrap}>
          <View style={s.emptyIconWrap}>
            <Ionicons name="notifications-off-outline" size={40} color={colors.light.mutedForeground} />
          </View>
          <Text style={s.emptyTitle}>No notifications</Text>
          <Text style={s.emptySub}>You{"'"}re all caught up</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.light.primary} />}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const icon = TYPE_ICONS[item.type] ?? { name: "notifications-outline" as const, color: colors.light.mutedForeground };
            const isUnread = !item.read_at;
            return (
              <TouchableOpacity
                style={[s.notifCard, isUnread && s.notifCardUnread]}
                onPress={() => handlePress(item)}
                activeOpacity={0.7}
              >
                <View style={[s.notifIconWrap, { backgroundColor: `${icon.color}15` }]}>
                  <Ionicons name={icon.name} size={20} color={icon.color} />
                </View>
                <View style={s.notifBody}>
                  <View style={s.notifTopRow}>
                    <Text style={s.notifTitle} numberOfLines={1}>{item.title}</Text>
                    {isUnread && <View style={s.unreadDot} />}
                  </View>
                  <Text style={s.notifText} numberOfLines={2}>{item.body}</Text>
                  <Text style={s.notifTime}>{formatRelative(item.created_at)}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  loadingWrap: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, backgroundColor: colors.light.background },
  loadingText: { fontSize: typography.fontSizes.base, color: colors.light.mutedForeground },

  headerBg: {
    backgroundColor: colors.olive[800],
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
    paddingTop: 56, paddingBottom: 20, paddingHorizontal: 24,
  },
  headerContent: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end",
  },
  kicker: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10, letterSpacing: 3, textTransform: "uppercase",
    color: colors.olive[300], marginBottom: 4,
  },
  headerTitle: {
    fontFamily: fontFamilies.display.regular,
    fontSize: typography.fontSizes["2xl"],
    fontWeight: typography.fontWeights.bold as any,
    color: "#fff",
  },
  unreadLabel: {
    fontSize: typography.fontSizes.sm,
    color: colors.olive[200], marginTop: 4,
  },
  markAllBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.full,
  },
  markAllText: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.medium as any,
    color: "#fff",
  },

  listContent: { padding: 24 },
  emptyWrap: {
    flex: 1, justifyContent: "center", alignItems: "center", gap: 8, paddingBottom: 80,
  },
  emptyIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.light.muted, justifyContent: "center", alignItems: "center",
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.semibold as any,
    color: colors.light.foreground,
  },
  emptySub: { fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground },

  notifCard: {
    flexDirection: "row", gap: 14,
    backgroundColor: colors.light.card, borderRadius: radii.xl,
    borderWidth: 1, borderColor: colors.light.border,
    padding: 16, marginBottom: 10,
  },
  notifCardUnread: {
    borderLeftWidth: 3, borderLeftColor: colors.olive[600],
    backgroundColor: colors.olive[50],
  },
  notifIconWrap: {
    width: 40, height: 40, borderRadius: radii.lg,
    justifyContent: "center", alignItems: "center",
  },
  notifBody: { flex: 1 },
  notifTopRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginBottom: 4,
  },
  notifTitle: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold as any,
    color: colors.light.foreground, flex: 1,
  },
  unreadDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: colors.olive[600], marginLeft: 8,
  },
  notifText: {
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground, lineHeight: 18,
  },
  notifTime: {
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground, marginTop: 6,
  },
});
