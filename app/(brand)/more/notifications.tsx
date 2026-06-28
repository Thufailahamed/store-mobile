import React from "react";
import { View, Text, FlatList, RefreshControl, StyleSheet, Pressable } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { BrandScreenHeader } from "@/components/brand/BrandScreenHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { getBrandNotifications, markBrandNotifications } from "@/lib/api";
import type { BrandNotification } from "@/lib/api/backend";
import { colors, typography, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

const TYPE_TONE: Record<string, { bg: string; fg: string }> = {
  order: { bg: colors.olive[100] ?? "#e6efd9", fg: colors.olive[800] ?? "#3a4a1c" },
  review: { bg: "#fdf3d7", fg: "#7a5b1a" },
  return: { bg: "#fbe5dc", fg: "#7a2f1a" },
  inventory: { bg: "#dde7f3", fg: "#1a3a7a" },
  system: { bg: colors.light.muted, fg: colors.light.foreground },
};

export default function BrandNotifications() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["brand-notifications"],
    queryFn: async () => {
      const r = await getBrandNotifications();
      return r.ok ? r.data : [];
    },
  });

  const markAll = useMutation({
    mutationFn: () => markBrandNotifications({ mark_all: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["brand-notifications"] }),
  });

  const markOne = useMutation({
    mutationFn: (id: string) => markBrandNotifications({ ids: [id] }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["brand-notifications"] }),
  });

  const unreadCount = (q.data ?? []).filter((n) => !n.read_at).length;

  return (
    <View style={styles.root}>
      <BrandScreenHeader
        eyebrow="Brand HQ"
        title="Notifications"
        subtitle={`${unreadCount} unread`}
        back={{ onPress: () => router.back() }}
        right={unreadCount > 0 ? (
          <Button variant="ghost" onPress={() => markAll.mutate()} loading={markAll.isPending}>
            Mark all
          </Button>
        ) : undefined}
      />
      {q.isLoading ? (
        <View style={styles.list}>
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} style={styles.skelRow} />)}
        </View>
      ) : !q.data || q.data.length === 0 ? (
        <EmptyState icon="notifications-off-outline" title="No notifications" />
      ) : (
        <FlatList
          data={q.data}
          keyExtractor={(n) => n.id}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} />}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => <NotificationRow item={item} onPress={() => !item.read_at && markOne.mutate(item.id)} />}
        />
      )}
    </View>
  );
}

function NotificationRow({ item, onPress }: { item: BrandNotification; onPress: () => void }) {
  const tone = TYPE_TONE[item.type ?? "system"] ?? TYPE_TONE.system;
  return (
    <Pressable onPress={onPress} android_ripple={{ color: colors.light.muted }}>
      <Card style={!item.read_at ? styles.unreadCard : styles.notifCard}>
        <View style={styles.row}>
          <View style={[styles.iconWrap, { backgroundColor: tone.bg }]}>
            <Text style={[styles.iconText, { color: tone.fg }]}>{(item.type ?? "s").charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.body}>
            <Text style={styles.title}>{item.title ?? "Notification"}</Text>
            {item.body ? <Text style={styles.body2} numberOfLines={2}>{item.body}</Text> : null}
            <Text style={styles.meta}>{new Date(item.created_at).toLocaleString()}</Text>
          </View>
          {!item.read_at ? <Badge variant="default" style={styles.dot}><View /></Badge> : null}
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.light.background },
  list: { padding: 20, gap: 8 },
  listContent: { paddingBottom: 32, paddingHorizontal: 12, gap: 8 },
  skelRow: { height: 64, borderRadius: radii.lg },
  notifCard: { padding: 12, margin: 0 },
  unreadCard: { backgroundColor: "#f6f6e9", borderColor: colors.olive[200] ?? "#d6dfba" },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  iconText: { fontFamily: fontFamilies.mono.medium, fontSize: typography.fontSizes.sm },
  body: { flex: 1, gap: 2 },
  title: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.sm, color: colors.light.foreground },
  body2: { fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground, lineHeight: 16 },
  meta: { fontFamily: fontFamilies.mono.regular, fontSize: 10, color: colors.light.mutedForeground, marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4, padding: 0 },
});
