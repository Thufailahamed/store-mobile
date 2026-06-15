import React from "react";
import { View, Text, StyleSheet, FlatList, Pressable } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/supabase/auth";
import { getNotifications, markNotificationRead, markAllNotificationsRead } from "@/lib/api";
import type { Notification } from "@/lib/types";
import { Card, Button, Skeleton } from "@/components/ui";
import { colors, typography } from "@/lib/theme/tokens";

const TYPE_ICONS: Record<string, string> = {
  order: "📦",
  promo: "🏷️",
  system: "⚙️",
  review: "⭐",
  delivery: "🚚",
  payment: "💳",
};

export default function NotificationsScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

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
    mutationFn: async () => { if (user) await markAllNotificationsRead(user.id); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const notifications = notificationsQuery.data ?? [];
  const unreadCount = notifications.filter(n => !n.read_at).length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Notifications</Text>
          {unreadCount > 0 && <Text style={styles.unread}>{unreadCount} unread</Text>}
        </View>
        {unreadCount > 0 && (
          <Button
            onPress={() => markAllMutation.mutate()}
            variant="ghost"
            size="sm"
          >
            Mark all read
          </Button>
        )}
      </View>

      {notificationsQuery.isLoading ? (
        <View style={styles.list}>
          {[1, 2, 3].map((i) => (
            <Card key={i} style={styles.notifCard}>
              <Skeleton width="80%" height={14} />
              <Skeleton width="60%" height={12} style={{ marginTop: 8 }} />
            </Card>
          ))}
        </View>
      ) : notifications.length === 0 ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 40 }}>
          <Text style={{ fontSize: typography.fontSizes.lg, fontWeight: typography.fontWeights.semibold, color: colors.light.foreground, marginBottom: 8 }}>No notifications</Text>
          <Text style={{ fontSize: typography.fontSizes.base, color: colors.light.muted, textAlign: "center" }}>You're all caught up!</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                if (!item.read_at) markReadMutation.mutate(item.id);
              }}
            >
              <Card style={!item.read_at ? { ...styles.notifCard, ...styles.unreadCard } : styles.notifCard}>
                <View style={styles.notifRow}>
                  <Text style={styles.notifIcon}>{TYPE_ICONS[item.type] ?? "🔔"}</Text>
                  <View style={styles.notifInfo}>
                    <Text style={styles.notifTitle}>{item.title}</Text>
                    <Text style={styles.notifBody} numberOfLines={2}>{item.body}</Text>
                    <Text style={styles.notifTime}>
                      {new Date(item.created_at).toLocaleDateString("en-LK", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </Text>
                  </View>
                  {!item.read_at && <View style={styles.unreadDot} />}
                </View>
              </Card>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 24, paddingBottom: 0 },
  title: { fontSize: typography.fontSizes["2xl"], fontWeight: typography.fontWeights.bold, color: colors.light.foreground },
  unread: { fontSize: typography.fontSizes.sm, color: colors.light.primary, marginTop: 4 },
  list: { padding: 24 },
  notifCard: { marginBottom: 16, padding: 24 },
  unreadCard: { borderLeftWidth: 3, borderLeftColor: colors.light.primary },
  notifRow: { flexDirection: "row", alignItems: "flex-start" },
  notifIcon: { fontSize: 20, marginRight: 16, marginTop: 2 },
  notifInfo: { flex: 1 },
  notifTitle: { fontSize: typography.fontSizes.base, fontWeight: typography.fontWeights.semibold, color: colors.light.foreground, marginBottom: 4 },
  notifBody: { fontSize: typography.fontSizes.sm, color: colors.light.muted, lineHeight: 18 },
  notifTime: { fontSize: typography.fontSizes.xs, color: colors.light.muted, marginTop: 8 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.light.primary, marginTop: 4 },
});
