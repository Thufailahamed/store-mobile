import React, { useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAdminCommissions, updateCommissionTier } from "@/lib/api";
import { Card, EmptyState, Skeleton, Input, Button } from "@/components/ui";
import { colors, typography, radii, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

export default function AdminCommissions() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin-commissions"],
    queryFn: async () => {
      const r = await getAdminCommissions();
      return r.ok ? r.data : [];
    },
  });
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>TIERS</Text>
          <Text style={styles.title}>Commissions</Text>
        </View>
        <Text style={styles.count}>{(q.data ?? []).length}</Text>
      </View>
      <Text style={styles.sub}>Tiered commission rates applied to seller revenue. Editable inline.</Text>
      <FlatList
        data={q.data ?? []}
        keyExtractor={(t: any) => t.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} />}
        ListEmptyComponent={q.isLoading ? <Skeleton height={80} /> : <EmptyState icon="wallet-outline" title="No tiers" />}
        renderItem={({ item, index }: any) => <TierRow tier={item} index={index} onSave={(patch) => updateCommissionTier(item.id, patch).then(() => qc.invalidateQueries({ queryKey: ["admin-commissions"] }))} />}
      />
    </View>
  );
}

function TierRow({ tier, index, onSave }: { tier: any; index: number; onSave: (patch: any) => Promise<any> }) {
  const [rate, setRate] = useState(String(tier.rate_pct));
  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.index}>{String(index + 1).padStart(2, "0")}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{tier.name}</Text>
          <Text style={styles.range}>
            LKR {Number(tier.min_gmv ?? 0).toLocaleString()}{tier.max_gmv ? ` – ${Number(tier.max_gmv).toLocaleString()}` : "+"}
          </Text>
        </View>
        <View style={styles.editRow}>
          <Input value={rate} onChangeText={setRate} keyboardType="numeric" containerStyle={{ width: 80 }} />
          <Text style={styles.pct}>%</Text>
          <Pressable onPress={() => onSave({ rate_pct: Number(rate) })} style={styles.saveBtn}>
            <Text style={styles.saveText}>Save</Text>
          </Pressable>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  header: { padding: 20, paddingBottom: 4 },
  eyebrow: { fontFamily: fontFamilies.mono.medium, fontSize: 10, color: colors.light.primary, letterSpacing: 1.4 },
  title: { fontFamily: fontFamilies.display.regular, fontSize: 28, color: colors.light.foreground, marginTop: 4, letterSpacing: -0.5 },
  sub: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.light.mutedForeground, paddingHorizontal: 20, marginBottom: 8 },
  count: { fontFamily: fontFamilies.mono.regular, fontSize: 12, color: colors.light.mutedForeground, position: "absolute", right: 20, top: 32 },
  list: { padding: 20, paddingTop: 0, paddingBottom: 100, gap: 10 },
  card: { padding: 14, ...shadows.soft },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  index: { fontFamily: fontFamilies.mono.regular, fontSize: 11, color: colors.light.mutedForeground, width: 24 },
  name: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: colors.light.foreground },
  range: { fontFamily: fontFamilies.mono.regular, fontSize: 11, color: colors.light.mutedForeground, marginTop: 2 },
  editRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  pct: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: colors.light.foreground },
  saveBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.md, backgroundColor: colors.light.primary },
  saveText: { fontFamily: fontFamilies.sans.semibold, fontSize: 11, color: "#fff", letterSpacing: 0.5, textTransform: "uppercase" },
});
