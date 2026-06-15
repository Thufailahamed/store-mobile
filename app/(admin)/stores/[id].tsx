import React from "react";
import { View, Text, ScrollView, StyleSheet, Pressable } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import Ionicons from "@expo/vector-icons/Ionicons";
import { getStoreById, approveBrand } from "@/lib/api";
import { Card, StatTile, EmptyState, Skeleton, Badge, ProgressBar } from "@/components/ui";
import { colors, typography, radii, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";

function rel(s: string) {
  const d = new Date(s).getTime();
  const m = Math.floor((Date.now() - d) / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function AdminStoreDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const q = useQuery({
    queryKey: ["admin-store", id],
    queryFn: async () => {
      const r = await getStoreById(id!);
      return r.ok ? r.data : null;
    },
    enabled: !!id,
  });

  if (q.isLoading) return <View style={styles.container}><Skeleton height={200} /></View>;
  const s: any = q.data;
  if (!s) return <EmptyState icon="storefront-outline" title="Store not found" />;

  const commission = 8.0;
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Ionicons name="chevron-back" size={20} color={colors.light.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>STORE</Text>
          <Text style={styles.title} numberOfLines={2}>{s.name}</Text>
        </View>
      </View>

      <Card style={styles.heroCard}>
        <View style={styles.statusRow}>
          <Badge variant={s.status === "approved" || s.status === "active" ? "default" : s.status === "pending" ? "secondary" : "destructive"}>
            {s.status}
          </Badge>
          <Text style={styles.since}>since {rel(s.created_at)} ago</Text>
        </View>
        <Text style={styles.subtitle}>{s.tagline ?? s.description ?? "—"}</Text>
      </Card>

      <View style={styles.statRow}>
        <StatTile label="GMV" value={formatPrice(s.lifetime_gmv ?? 0)} sub="lifetime" size="md" />
        <StatTile label="Orders" value={String(s.order_count ?? 0)} sub="lifetime" size="md" />
        <StatTile label="Rating" value={s.rating_avg ? s.rating_avg.toFixed(1) : "—"} sub="avg" size="md" />
      </View>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Health</Text>
        <View style={{ marginTop: 12, gap: 12 }}>
          <Health label="Fulfilment" value={`${(s.fulfilment_rate ?? 95).toFixed(0)}%`} progress={s.fulfilment_rate ?? 95} />
          <Health label="On-time delivery" value={`${(s.ontime_rate ?? 88).toFixed(0)}%`} progress={s.ontime_rate ?? 88} />
          <Health label="Returns" value={`${(s.return_rate ?? 3).toFixed(1)}%`} progress={Math.min(100, s.return_rate ?? 3 * 10)} />
        </View>
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Commission</Text>
        <View style={styles.commissionRow}>
          <Text style={styles.commission}>{commission.toFixed(1)}%</Text>
          <Text style={styles.commissionSub}>applied to seller revenue</Text>
        </View>
      </Card>

      {s.contact_email || s.contact_phone ? (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Contact</Text>
          <View style={{ marginTop: 8, gap: 6 }}>
            {s.contact_email ? <Text style={styles.contact}>{s.contact_email}</Text> : null}
            {s.contact_phone ? <Text style={styles.contact}>{s.contact_phone}</Text> : null}
          </View>
        </Card>
      ) : null}
    </ScrollView>
  );
}

function Health({ label, value, progress }: { label: string; value: string; progress: number }) {
  return (
    <View>
      <View style={styles.healthRow}>
        <Text style={styles.healthLabel}>{label}</Text>
        <Text style={styles.healthValue}>{value}</Text>
      </View>
      <ProgressBar value={progress} fillColor={colors.olive[500]} style={{ marginTop: 6 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  content: { paddingBottom: 100 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 20, paddingBottom: 12 },
  back: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.light.card, alignItems: "center", justifyContent: "center", marginTop: 18 },
  eyebrow: { fontFamily: fontFamilies.mono.medium, fontSize: 10, color: colors.light.primary, letterSpacing: 1.4 },
  title: { fontFamily: fontFamilies.display.regular, fontSize: 24, color: colors.light.foreground, marginTop: 4, letterSpacing: -0.4 },
  heroCard: { marginHorizontal: 20, padding: 16, ...shadows.soft },
  statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  since: { fontFamily: fontFamilies.mono.regular, fontSize: 11, color: colors.light.mutedForeground, letterSpacing: 0.5, textTransform: "uppercase" },
  subtitle: { fontFamily: fontFamilies.sans.regular, fontSize: 13, color: colors.light.mutedForeground, marginTop: 8, lineHeight: 18 },
  statRow: { flexDirection: "row", gap: 8, padding: 20, paddingBottom: 0 },
  section: { margin: 20, marginBottom: 0, padding: 16, ...shadows.soft },
  sectionTitle: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: colors.light.foreground, letterSpacing: 0.5 },
  healthRow: { flexDirection: "row", justifyContent: "space-between" },
  healthLabel: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.light.foreground },
  healthValue: { fontFamily: fontFamilies.mono.semibold, fontSize: 12, color: colors.light.foreground },
  commissionRow: { flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 12 },
  commission: { fontFamily: fontFamilies.display.semibold, fontSize: 28, color: colors.olive[500], letterSpacing: -0.5 },
  commissionSub: { fontFamily: fontFamilies.mono.regular, fontSize: 10, color: colors.light.mutedForeground, letterSpacing: 0.5, textTransform: "uppercase" },
  contact: { fontFamily: fontFamilies.sans.regular, fontSize: 13, color: colors.light.foreground },
});
