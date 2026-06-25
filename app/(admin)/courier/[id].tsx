import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { router, useLocalSearchParams } from "expo-router";
import { getCourierProvider } from "@/lib/api/courier-api";
import { colors, radii, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

export default function AdminCourierDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<
    | { id: string; name: string; code: string; base_url: string; auth_type: string; active: boolean; env_vars: Record<string, string>; created_at: string; updated_at: string; last_webhook: { at: string; ok: boolean; type: string | null } | null }
    | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      const r = await getCourierProvider(id);
      if (!r.ok) setError(r.error);
      else setData(r.data);
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.light.primary} />
      </View>
    );
  }
  if (error || !data) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error ?? "Failed to load"}</Text>
        <Pressable onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const webhookUrl = `${data.base_url.replace(/\/$/, "")}/api/courier/webhook/${data.code}`;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Pressable style={styles.backBtn} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={20} color={colors.light.foreground} />
        <Text style={styles.backText}>Back</Text>
      </Pressable>

      <Text style={styles.title}>{data.name}</Text>
      <View style={styles.metaRow}>
        <Text style={styles.metaText}>{data.code}</Text>
        <View
          style={[
            styles.badge,
            { backgroundColor: data.active ? "#10b9811A" : "#94a3b81A" },
          ]}
        >
          <Text
            style={[styles.badgeText, { color: data.active ? "#059669" : "#475569" }]}
          >
            {data.active ? "Active" : "Disabled"}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Connection</Text>
        <Row label="Base URL" value={data.base_url} />
        <Row label="Auth" value={data.auth_type} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Webhook URL</Text>
        <Text style={styles.note}>
          Configure this URL in the provider's dashboard. They sign requests
          with the HMAC secret.
        </Text>
        <View style={styles.codeBlock}>
          <Text style={styles.codeText} selectable>
            {webhookUrl}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Configuration</Text>
        <View style={styles.codeBlock}>
          <Text style={styles.codeText} selectable>
            {JSON.stringify(data.env_vars ?? {}, null, 2)}
          </Text>
        </View>
      </View>

      <Text style={styles.note}>
        Edit this provider from the web admin for full configuration support.
      </Text>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.kv}>
      <Text style={styles.kvLabel}>{label}</Text>
      <Text style={styles.kvValue} selectable>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.light.background },
  content: { padding: 16, gap: 14, paddingBottom: 48 },
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
  backLink: { marginTop: 12 },
  backLinkText: {
    color: colors.light.primary,
    fontFamily: fontFamilies.sans.medium,
    fontSize: typography.fontSizes.sm,
  },
  title: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: typography.fontSizes["2xl"],
    color: colors.light.foreground,
  },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  metaText: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
  },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  badgeText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.xs,
  },
  section: {
    backgroundColor: colors.light.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: 14,
    gap: 8,
  },
  sectionTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: typography.fontSizes.md,
    color: colors.light.foreground,
  },
  kv: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  kvLabel: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
  },
  kvValue: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: typography.fontSizes.sm,
    color: colors.light.foreground,
    flexShrink: 1,
    textAlign: "right",
  },
  codeBlock: {
    backgroundColor: colors.light.muted,
    borderRadius: radii.md,
    padding: 10,
  },
  codeText: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: typography.fontSizes.xs,
    color: colors.light.foreground,
  },
  note: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
  },
  errorText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: typography.fontSizes.sm,
    color: "#dc2626",
  },
});