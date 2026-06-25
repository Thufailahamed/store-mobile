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
  listCourierProviders,
  testCourierProvider,
  type CourierProvider,
} from "@/lib/api/courier-api";
import { colors, radii, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

export default function AdminCourierIndexScreen() {
  const [providers, setProviders] = useState<CourierProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await listCourierProviders();
    if (r.ok) setProviders(r.data.providers);
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

  const onTest = useCallback(async (id: string) => {
    setTestingId(id);
    const r = await testCourierProvider(id);
    setTestingId(null);
    if (!r.ok) {
      Alert.alert("Test failed", r.error);
      return;
    }
    Alert.alert(
      "Provider OK",
      r.data.reachable ? "Reachable." : "Test ping succeeded.",
    );
  }, []);

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

      <Text style={styles.title}>Courier providers</Text>
      <Text style={styles.subtitle}>
        Third-party delivery management companies that handle fulfilment.
      </Text>

      <Pressable
        style={styles.webhookLink}
        onPress={() => router.push("/(admin)/courier/webhooks" as never)}
      >
        <Ionicons name="pulse-outline" size={18} color={colors.light.primary} />
        <Text style={styles.webhookLinkText}>Webhook event log →</Text>
      </Pressable>

      {providers.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="bicycle-outline" size={40} color={colors.light.mutedForeground} />
          <Text style={styles.emptyTitle}>No providers configured</Text>
          <Text style={styles.emptyBody}>
            Add a provider via the admin web console — configuration is too
            rich for mobile.
          </Text>
        </View>
      ) : (
        providers.map((p) => (
          <View key={p.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{p.name}</Text>
                <Text style={styles.cardMeta}>
                  {p.code} · {p.auth_type}
                </Text>
              </View>
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: p.active ? "#10b9811A" : "#94a3b81A",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    { color: p.active ? "#059669" : "#475569" },
                  ]}
                >
                  {p.active ? "Active" : "Disabled"}
                </Text>
              </View>
            </View>
            <Text style={styles.cardUrl} numberOfLines={1}>
              {p.base_url}
            </Text>
            <View style={styles.cardFooter}>
              <Pressable
                style={styles.actionBtn}
                onPress={() => onTest(p.id)}
                disabled={testingId === p.id}
              >
                {testingId === p.id ? (
                  <ActivityIndicator size="small" color={colors.light.primary} />
                ) : (
                  <Ionicons name="refresh-outline" size={16} color={colors.light.primary} />
                )}
                <Text style={styles.actionText}>Test</Text>
              </Pressable>
              <Pressable
                style={styles.actionBtn}
                onPress={() => router.push(`/(admin)/courier/${p.id}` as never)}
              >
                <Ionicons name="open-outline" size={16} color={colors.light.primary} />
                <Text style={styles.actionText}>Details</Text>
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
  content: { padding: 16, gap: 12, paddingBottom: 48 },
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
  webhookLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
  },
  webhookLinkText: {
    color: colors.light.primary,
    fontFamily: fontFamilies.sans.medium,
    fontSize: typography.fontSizes.sm,
  },
  card: {
    backgroundColor: colors.light.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: 14,
    gap: 8,
  },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  cardTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: typography.fontSizes.md,
    color: colors.light.foreground,
  },
  cardMeta: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    marginTop: 2,
  },
  cardUrl: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
  },
  cardFooter: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  actionText: {
    color: colors.light.primary,
    fontFamily: fontFamilies.sans.medium,
    fontSize: typography.fontSizes.xs,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  badgeText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.xs,
  },
  empty: {
    alignItems: "center",
    paddingVertical: 48,
    gap: 8,
  },
  emptyTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: typography.fontSizes.lg,
    color: colors.light.foreground,
  },
  emptyBody: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
    textAlign: "center",
    paddingHorizontal: 32,
  },
});