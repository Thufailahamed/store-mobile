import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Alert,
} from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { router } from "expo-router";
import {
  listCourierWebhooks,
  replayCourierWebhook,
  type CourierWebhookEvent,
} from "@/lib/api/courier-api";
import { colors, radii, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

export default function AdminCourierWebhooksScreen() {
  const [events, setEvents] = useState<CourierWebhookEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [replayingId, setReplayingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    const r = await listCourierWebhooks();
    if (r.ok) setEvents(r.data.events);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const onReplay = useCallback(async (eventId: number) => {
    setReplayingId(eventId);
    const r = await replayCourierWebhook(eventId, false);
    setReplayingId(null);
    if (!r.ok) {
      Alert.alert("Replay failed", r.error);
      return;
    }
    Alert.alert(
      r.data.replayed ? "Replayed" : "Skipped",
      r.data.mapped ?? r.data.reason,
    );
    await load();
  }, [load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.light.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Pressable style={styles.backBtn} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={20} color={colors.light.foreground} />
        <Text style={styles.backText}>Back</Text>
      </Pressable>

      <Text style={styles.title}>Webhook events</Text>
      <Text style={styles.subtitle}>
        {events.length} events. Replay any failed callbacks.
      </Text>

      {events.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No events yet.</Text>
        </View>
      ) : (
        events.map((e) => (
          <View key={e.id} style={styles.card}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.eventTitle}>{e.event_type ?? "—"}</Text>
                <Text style={styles.eventId} selectable>
                  {e.provider_event_id}
                </Text>
                <Text style={styles.ts}>
                  {new Date(e.received_at).toLocaleString()}
                </Text>
              </View>
              <View
                style={[
                  styles.badge,
                  { backgroundColor: e.signature_ok ? "#10b9811A" : "#dc26261A" },
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    { color: e.signature_ok ? "#059669" : "#dc2626" },
                  ]}
                >
                  {e.signature_ok ? "OK" : "Bad"}
                </Text>
              </View>
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>
                {e.error
                  ? `Error: ${e.error}`
                  : e.processed_at
                    ? "Processed"
                    : "Pending"}
              </Text>
              <Pressable
                style={styles.replayBtn}
                onPress={() => onReplay(e.id)}
                disabled={replayingId === e.id}
              >
                {replayingId === e.id ? (
                  <ActivityIndicator size="small" color={colors.light.primary} />
                ) : (
                  <Ionicons name="refresh-outline" size={14} color={colors.light.primary} />
                )}
                <Text style={styles.replayText}>Replay</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.light.background },
  content: { padding: 16, gap: 10, paddingBottom: 48 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.light.background,
  },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4 },
  backText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: typography.fontSizes.sm,
    color: colors.light.foreground,
  },
  title: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: typography.fontSizes["2xl"],
    color: colors.light.foreground,
  },
  subtitle: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
    marginTop: -4,
  },
  card: {
    backgroundColor: colors.light.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: 12,
    gap: 8,
  },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  eventTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.sm,
    color: colors.light.foreground,
  },
  eventId: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    marginTop: 2,
  },
  ts: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    marginTop: 4,
  },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  badgeText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.xs,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
    paddingTop: 8,
  },
  statusLabel: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    flexShrink: 1,
  },
  replayBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  replayText: {
    color: colors.light.primary,
    fontFamily: fontFamilies.sans.medium,
    fontSize: typography.fontSizes.xs,
  },
  empty: {
    alignItems: "center",
    paddingVertical: 48,
  },
  emptyText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
  },
});