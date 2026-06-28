import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { BrandScreenHeader } from "@/components/brand/BrandScreenHeader";
import { BrandStatCard } from "@/components/brand/BrandStatCard";
import { FilterChips } from "@/components/brand/FilterChips";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { getBrandAnalytics } from "@/lib/api";
import { colors, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";

type Range = "7d" | "30d" | "90d" | "1y";
const RANGES: ReadonlyArray<{ value: Range; label: string }> = [
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
  { value: "1y", label: "1y" },
];

export default function BrandAnalytics() {
  const [range, setRange] = React.useState<Range>("30d");
  const q = useQuery({
    queryKey: ["brand-analytics", range],
    queryFn: async () => {
      const r = await getBrandAnalytics();
      return r.ok ? r.data : { revenue: 0, orders: 0 };
    },
  });

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <BrandScreenHeader
        eyebrow="Brand HQ"
        title="Analytics"
        subtitle="Revenue and order summary"
        back={{ onPress: () => router.back() }}
        right={<FilterChips value={range} options={RANGES} onChange={setRange} />}
      />
      {q.isLoading ? (
        <View style={styles.grid}>
          <Skeleton style={styles.skelCard} />
          <Skeleton style={styles.skelCard} />
          <Skeleton style={styles.skelCard} />
          <Skeleton style={styles.skelCard} />
        </View>
      ) : q.data ? (
        <View style={styles.grid}>
          <BrandStatCard label="Revenue" value={formatPrice(q.data.revenue, "LKR")} tone="accent" sub={`Last ${range}`} />
          <BrandStatCard label="Orders" value={q.data.orders} sub={`Last ${range}`} />
          <BrandStatCard label="AOV" value={q.data.orders ? formatPrice(Math.round(q.data.revenue / q.data.orders), "LKR") : formatPrice(0, "LKR")} />
          <BrandStatCard label="Top product" value="—" sub="Coming soon" tone="warn" />
        </View>
      ) : (
        <EmptyState icon="analytics-outline" title="No data yet" description="Charts ship in a later release." />
      )}
      <Card style={styles.chart}>
        <Text style={styles.chartTitle}>Trend chart</Text>
        <Text style={styles.chartBody}>
          Revenue and order trend visualisations are not yet available on mobile. View the full chart on web.
        </Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.light.background },
  content: { paddingBottom: 32 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingHorizontal: 20, paddingTop: 8 },
  skelCard: { height: 110, flex: 1, minWidth: "47%" },
  chart: { margin: 20, padding: 16, gap: 6 },
  chartTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.base,
    color: colors.light.foreground,
  },
  chartBody: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
    lineHeight: 18,
  },
});
