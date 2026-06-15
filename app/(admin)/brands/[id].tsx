import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Card, Button, Badge, Skeleton, EmptyState } from "@/components/ui";
import { colors, typography, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { supabase } from "@/lib/supabase/client";

export default function BrandDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const q = useQuery({
    queryKey: ["admin-brand", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brands")
        .select("*, products:products(id, name, status, total_sales)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  if (q.isLoading) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Skeleton height={32} width="60%" />
        <Skeleton height={20} width="40%" style={{ marginTop: 12 }} />
        <Skeleton height={120} style={{ marginTop: 24 }} />
        <Skeleton height={200} style={{ marginTop: 16 }} />
      </ScrollView>
    );
  }

  if (!q.data) return <EmptyState title="Brand not found" />;

  const b = q.data;
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Button onPress={() => router.back()} variant="ghost" style={{ alignSelf: "flex-start" }}>← Back</Button>

      <Text style={styles.eyebrow}>BRAND</Text>
      <Text style={styles.name}>{b.name}</Text>
      <Text style={styles.slug}>@{b.slug}</Text>
      <View style={{ marginTop: 8 }}>
        <Badge variant={b.status === "approved" ? "default" : b.status === "pending" ? "secondary" : "destructive"}>
          {b.status}
        </Badge>
      </View>

      {b.tagline ? <Text style={styles.tagline}>{b.tagline}</Text> : null}
      {b.description ? <Text style={styles.desc}>{b.description}</Text> : null}

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Metrics</Text>
        <View style={styles.metricRow}>
          <Metric label="Products" value={String(b.total_products ?? 0)} />
          <Metric label="Followers" value={String(b.total_followers ?? 0)} />
          <Metric label="Rating" value={Number(b.rating ?? 0).toFixed(1)} />
        </View>
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Catalogue ({b.products?.length ?? 0})</Text>
        {(b.products ?? []).slice(0, 12).map((p: any) => (
          <View key={p.id} style={styles.productRow}>
            <Text style={styles.productName} numberOfLines={1}>{p.name}</Text>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
              <Text style={styles.productSales}>{p.total_sales ?? 0} sold</Text>
              <Badge variant={p.status === "active" ? "default" : "outline"}>{p.status}</Badge>
            </View>
          </View>
        ))}
        {(!b.products || b.products.length === 0) && (
          <Text style={styles.empty}>No products yet.</Text>
        )}
      </Card>
    </ScrollView>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  content: { padding: 20, paddingBottom: 100 },
  eyebrow: { fontFamily: fontFamilies.mono.medium, fontSize: 10, color: colors.light.primary, letterSpacing: 1.4, marginTop: 12 },
  name: { fontFamily: fontFamilies.display.regular, fontSize: 32, color: colors.light.foreground, letterSpacing: -0.5, marginTop: 4 },
  slug: { fontFamily: fontFamilies.mono.regular, fontSize: 12, color: colors.light.mutedForeground, marginTop: 4 },
  tagline: { fontFamily: fontFamilies.sans.regular, fontSize: 14, color: colors.light.foreground, fontStyle: "italic", marginTop: 16 },
  desc: { fontFamily: fontFamilies.sans.regular, fontSize: 13, color: colors.light.foreground, lineHeight: 20, marginTop: 8 },
  section: { padding: 16, marginTop: 16 },
  sectionTitle: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: colors.light.foreground, marginBottom: 12 },
  metricRow: { flexDirection: "row", gap: 12 },
  metric: { flex: 1, padding: 12, backgroundColor: colors.light.background, borderRadius: radii.md, alignItems: "center" },
  metricLabel: { fontFamily: fontFamilies.mono.medium, fontSize: 9, color: colors.light.mutedForeground, letterSpacing: 1.2, textTransform: "uppercase" },
  metricValue: { fontFamily: fontFamilies.display.semibold, fontSize: 18, color: colors.light.foreground, marginTop: 4 },
  productRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.light.border },
  productName: { fontFamily: fontFamilies.sans.regular, fontSize: 13, color: colors.light.foreground, flex: 1, marginRight: 8 },
  productSales: { fontFamily: fontFamilies.mono.regular, fontSize: 10, color: colors.light.mutedForeground },
  empty: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.light.mutedForeground, textAlign: "center", paddingVertical: 12 },
});
