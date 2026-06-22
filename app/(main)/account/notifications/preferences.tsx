import React, { useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { ScreenHeader } from "@/components/layout";
import { Button, useToast } from "@/components/ui";
import { Body, Display, Label } from "@/components/ui/Typography";
import { useAuth } from "@/lib/supabase/auth";
import {
  DEFAULT_NOTIFICATION_PREFS,
  getNotificationPrefs,
  saveNotificationPrefs,
  type NotificationPreferenceKey,
  type NotificationPrefs,
} from "@/lib/api";
import { colors, radii, shadows, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

type Channel = "email" | "sms" | "push";
type Category = "orders" | "marketing" | "social" | "security";

const CATEGORIES: {
  key: Category;
  label: string;
  detail: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: "orders", label: "Orders", detail: "Confirmations, shipping, delivery, returns", icon: "cube-outline" },
  { key: "marketing", label: "Marketing", detail: "Drops, promos, sale alerts", icon: "megaphone-outline" },
  { key: "social", label: "Social", detail: "Reviews, replies, mentions, review requests", icon: "people-outline" },
  { key: "security", label: "Security", detail: "Sign-ins, password changes, MFA", icon: "shield-checkmark-outline" },
];

const CHANNELS: { key: Channel; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "email", label: "Email", icon: "mail-outline" },
  { key: "sms", label: "SMS", icon: "chatbox-outline" },
  { key: "push", label: "Push", icon: "phone-portrait-outline" },
];

function channelsFor(category: Category): Channel[] {
  if (category === "social") return ["email", "push"];
  return ["email", "sms", "push"];
}

export default function NotificationPreferencesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_NOTIFICATION_PREFS);

  useEffect(() => {
    if (!user?.id) return;
    const userId = user.id;
    let cancelled = false;
    getNotificationPrefs(userId).then((res) => {
      if (cancelled) return;
      if (res.ok) setPrefs(res.data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const toggle = (key: NotificationPreferenceKey) => {
    setPrefs((current) => ({ ...current, [key]: !current[key] }));
  };

  const enableAll = () => {
    const next = { ...prefs };
    for (const cat of CATEGORIES) {
      for (const ch of channelsFor(cat.key)) {
        (next as any)[`${cat.key}_${ch}`] = true;
      }
    }
    setPrefs(next);
  };

  const disableNonEssential = () => {
    const next = { ...prefs };
    for (const cat of CATEGORIES) {
      for (const ch of channelsFor(cat.key)) {
        if (cat.key === "security") (next as any)[`${cat.key}_${ch}`] = true;
        else (next as any)[`${cat.key}_${ch}`] = false;
      }
    }
    setPrefs(next);
  };

  const save = async () => {
    if (!user?.id) return;
    setSaving(true);
    const res = await saveNotificationPrefs(user.id, prefs);
    setSaving(false);
    if (res.ok) toast("Notification preferences saved", "success");
    else toast(res.error, "error");
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <ScreenHeader title="Notification preferences" />
        <View style={styles.loading}>
          <Body muted>Loading preferences…</Body>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title="Notification preferences" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View>
            <Label style={styles.heroLabel}>Inbox rules</Label>
            <Display size="2xl" style={styles.heroTitle}>
              How LUXE reaches you
            </Display>
            <Body muted>Pick a channel for every kind of update. Toggle off anything noisy.</Body>
          </View>
          <View style={styles.bellBadge}>
            <Ionicons name="notifications-outline" size={20} color={colors.light.primaryForeground} />
          </View>
        </View>

        <View style={styles.quickRow}>
          <TouchableOpacity style={styles.quickBtn} onPress={enableAll}>
            <Ionicons name="notifications" size={14} color={colors.olive[700]} />
            <Label style={styles.quickBtnText}>Enable all</Label>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickBtn} onPress={disableNonEssential}>
            <Ionicons name="shield-checkmark-outline" size={14} color={colors.olive[700]} />
            <Label style={styles.quickBtnText}>Security only</Label>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <View style={styles.tableHeader}>
            <View style={styles.colCategory}><Label style={styles.kicker}>Category</Label></View>
            {CHANNELS.map((ch) => (
              <View key={ch.key} style={styles.colChannel}>
                <Ionicons name={ch.icon} size={12} color={colors.light.mutedForeground} />
                <Label style={[styles.kicker, styles.kickerCenter]}>{ch.label}</Label>
              </View>
            ))}
          </View>

          {CATEGORIES.map((cat) => (
            <View key={cat.key} style={styles.row}>
              <View style={styles.colCategory}>
                <View style={styles.catIcon}>
                  <Ionicons name={cat.icon} size={14} color={colors.light.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Body style={styles.catLabel}>{cat.label}</Body>
                  <Body muted size="xs" numberOfLines={2}>{cat.detail}</Body>
                </View>
              </View>
              {CHANNELS.map((ch) => {
                const isAvailable = channelsFor(cat.key).includes(ch.key);
                if (!isAvailable) {
                  return (
                    <View key={ch.key} style={styles.colChannel}>
                      <View style={styles.cellDash} />
                    </View>
                  );
                }
                const key = `${cat.key}_${ch.key}` as NotificationPreferenceKey;
                const value = prefs[key];
                return (
                  <View key={ch.key} style={styles.colChannel}>
                    <TouchableOpacity
                      onPress={() => toggle(key)}
                      activeOpacity={0.8}
                      style={[styles.cellToggle, value && styles.cellToggleOn]}
                    >
                      <Switch
                        value={value}
                        onValueChange={() => toggle(key)}
                        trackColor={{ false: "transparent", true: "transparent" }}
                        thumbColor={value ? colors.paper.cream : colors.light.mutedForeground}
                        style={styles.switch}
                      />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          ))}
        </View>

        <View style={styles.actions}>
          <Button variant="outline" onPress={() => router.back()}>Cancel</Button>
          <Button loading={saving} onPress={save}>Save preferences</Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: spacing[5], paddingBottom: spacing[8] },
  hero: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    backgroundColor: colors.light.card,
    borderRadius: radii["2xl"],
    padding: 20,
    borderWidth: 1,
    borderColor: colors.light.border,
    ...shadows.soft,
    marginBottom: spacing[4],
  },
  heroLabel: { color: colors.light.mutedForeground },
  heroTitle: { marginTop: spacing[2], marginBottom: spacing[2] },
  bellBadge: {
    width: 40,
    height: 40,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.light.primary,
  },
  quickRow: { flexDirection: "row", gap: 8, marginBottom: spacing[4] },
  quickBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.olive[50],
    borderRadius: radii.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.olive[200],
  },
  quickBtnText: {
    color: colors.olive[700],
    fontFamily: fontFamilies.mono.medium,
    fontSize: typography.fontSizes.xs,
  },
  card: {
    backgroundColor: colors.light.card,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: colors.light.border,
    ...shadows.soft,
    marginBottom: spacing[5],
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.olive[50] + "60",
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  colCategory: { flex: 2, flexDirection: "row", alignItems: "center", gap: 10 },
  colChannel: { width: 56, alignItems: "center" },
  kicker: {
    color: colors.light.mutedForeground,
    fontFamily: fontFamilies.mono.medium,
    fontSize: typography.fontSizes.xs,
  },
  kickerCenter: { textAlign: "center", marginTop: 2 },
  catIcon: {
    width: 32,
    height: 32,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.olive[50],
  },
  catLabel: { fontWeight: typography.fontWeights.semibold, color: colors.light.foreground },
  cellToggle: {
    width: 36,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.light.border,
    padding: 2,
    justifyContent: "center",
  },
  cellToggleOn: { backgroundColor: colors.light.primary },
  cellDash: { width: 16, height: 1, backgroundColor: colors.light.border },
  switch: { transform: [{ scale: 0.65 }] },
  actions: { flexDirection: "row", gap: 10 },
});
