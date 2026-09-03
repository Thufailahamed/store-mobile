import React, { useMemo, useState } from "react";
import { View, Text, FlatList, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { getSellerAuditLogBackend, type SellerAuditEntry } from "@/lib/api/backend";
import { colors, radii, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

const TABS = [
  { key: "all", label: "All" },
  { key: "approvals", label: "Approvals" },
  { key: "status", label: "Status" },
  { key: "products", label: "Catalog" },
  { key: "compliance", label: "Compliance" },
] as const;
type Tab = (typeof TABS)[number]["key"];

function categorize(action: string): Exclude<Tab, "all"> {
  const a = (action || "").toLowerCase();
  if (a.includes("approve") || a.includes("reject")) return "approvals";
  if (a.includes("status") || a.includes("suspend") || a.includes("reactivate")) return "status";
  if (a.includes("product") || a.includes("inventory") || a.includes("variant")) return "products";
  return "compliance";
}

export default function SellerAuditLogScreen() {
  const [tab, setTab] = useState<Tab>("all");

  const q = useQuery({
    queryKey: ["sellerAudit"],
    queryFn: async () => {
      const res = await getSellerAuditLogBackend({ limit: 200 });
      if (!res.ok) throw new Error(res.error);
      return res.data.entries;
    },
  });

  const filtered = useMemo(() => {
    if (!q.data) return [];
    if (tab === "all") return q.data;
    return q.data.filter((e) => categorize(e.action) === tab);
  }, [q.data, tab]);

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <Stack.Screen options={{ title: "Audit Log" }} />
      <View style={styles.tabsRow}>
        {TABS.map((t) => (
          <Pressable
            key={t.key}
            onPress={() => setTab(t.key)}
            style={[styles.chip, tab === t.key && styles.chipActive]}
          >
            <Text style={[styles.chipText, tab === t.key && styles.chipTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      {q.isLoading ? (
        <View style={styles.center}><ActivityIndicator /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(e) => e.id}
          renderItem={({ item }: { item: SellerAuditEntry }) => (
            <View style={styles.row}>
              <Text style={styles.action}>{item.action}</Text>
              <Text style={styles.meta}>
                {item.actor?.full_name ?? item.actor?.email ?? item.actor_id ?? "system"} · {new Date(item.created_at).toLocaleString()}
              </Text>
              {item.target_type ? (
                <Text style={styles.meta}>
                  {item.target_type}{item.target_id ? ` · ${item.target_id.slice(0, 8)}` : ""}
                </Text>
              ) : null}
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No events in this category.</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  tabsRow: { flexDirection: "row", flexWrap: "wrap", padding: spacing[3], gap: spacing[2] },
  chip: { paddingVertical: spacing[2], paddingHorizontal: spacing[3], borderRadius: radii.full, backgroundColor: colors.light.muted },
  chipActive: { backgroundColor: colors.light.primary },
  chipText: { fontFamily: fontFamilies.sans.medium, fontSize: typography.fontSizes.sm, color: colors.light.foreground },
  chipTextActive: { color: colors.light.primaryForeground },
  row: { paddingVertical: spacing[3], paddingHorizontal: spacing[4], borderBottomWidth: 1, borderColor: colors.light.border, gap: 2 },
  action: { fontFamily: fontFamilies.sans.medium, color: colors.light.foreground },
  meta: { fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground },
  empty: { fontFamily: fontFamilies.sans.regular, color: colors.light.mutedForeground, padding: spacing[5], textAlign: "center" },
});
