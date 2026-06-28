import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { BrandScreenHeader } from "@/components/brand/BrandScreenHeader";
import { BrandListRow, type BrandListStatus } from "@/components/brand/BrandListRow";
import { FilterChips } from "@/components/brand/FilterChips";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { getBrandInfluencers } from "@/lib/api";
import type { BrandInfluencer } from "@/lib/api/backend";
import { colors, typography, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

type Filter = "all" | "active" | "pending" | "paused";
const FILTERS: ReadonlyArray<{ value: Filter; label: string }> = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "pending", label: "Pending" },
  { value: "paused", label: "Paused" },
];

const STATUS_MAP: Record<string, BrandListStatus> = {
  active: "active",
  pending: "pending",
  invited: "invited",
  paused: "paused",
  ended: "completed",
};

export default function BrandInfluencers() {
  const [filter, setFilter] = React.useState<Filter>("all");
  const q = useQuery({
    queryKey: ["brand-influencers"],
    queryFn: async () => {
      const r = await getBrandInfluencers();
      return r.ok ? r.data : [];
    },
  });

  const filtered = (q.data ?? []).filter((i) => filter === "all" || i.status === filter);
  const totalCommission = filtered.reduce((acc, i) => acc + (i.commission ?? 0), 0);

  return (
    <View style={styles.root}>
      <BrandScreenHeader
        eyebrow="Brand HQ"
        title="Influencers"
        subtitle={`${filtered.length} partners`}
        back={{ onPress: () => router.back() }}
      />
      {q.isLoading ? (
        <View style={styles.list}>
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} style={styles.skel} />)}
        </View>
      ) : (
        <>
          <Card style={styles.summary}>
            <View style={styles.summaryRow}>
              <SummaryStat label="Total" value={String(filtered.length)} />
              <SummaryStat label="Commission" value={`LKR ${totalCommission.toLocaleString()}`} />
            </View>
          </Card>
          <FilterChips value={filter} options={FILTERS} onChange={setFilter} />
          {filtered.length === 0 ? (
            <EmptyState icon="megaphone-outline" title="No partners match" />
          ) : (
            <ScrollView contentContainerStyle={styles.list}>
              {filtered.map((i) => <InfluencerCard key={i.id} item={i} />)}
            </ScrollView>
          )}
        </>
      )}
    </View>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function InfluencerCard({ item }: { item: BrandInfluencer }) {
  const name = item.influencer?.name ?? item.influencer?.handle ?? "Partner";
  return (
    <Card style={styles.card}>
      <View style={styles.cardHead}>
        <View>
          <Text style={styles.name}>{name}</Text>
          {item.influencer?.handle ? <Text style={styles.handle}>@{item.influencer.handle}</Text> : null}
        </View>
        <BrandListRowBadge status={STATUS_MAP[item.status ?? "pending"] ?? "pending"} />
      </View>
      <View style={styles.statRow}>
        <MiniStat label="Followers" value={(item.followers_count ?? 0).toLocaleString()} />
        <MiniStat label="Sales" value={`LKR ${(item.sales ?? 0).toLocaleString()}`} />
        <MiniStat label="Rating" value={(item.rating ?? 0).toFixed(1)} />
        <MiniStat label="Commission" value={`${item.commission ?? 0}%`} />
      </View>
    </Card>
  );
}

function BrandListRowBadge({ status }: { status: BrandListStatus }) {
  const { Badge } = require("@/components/ui/Badge") as typeof import("@/components/ui/Badge");
  return <Badge variant={status === "active" ? "default" : status === "pending" ? "outline" : status === "paused" ? "secondary" : "destructive"}>{status}</Badge>;
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.mini}>
      <Text style={styles.miniValue}>{value}</Text>
      <Text style={styles.miniLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.light.background },
  list: { padding: 20, gap: 12 },
  skel: { height: 110, borderRadius: radii.xl },
  summary: { marginHorizontal: 20, padding: 16 },
  summaryRow: { flexDirection: "row", justifyContent: "space-around" },
  stat: { alignItems: "center" },
  statLabel: { fontFamily: fontFamilies.mono.medium, fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground, textTransform: "uppercase", letterSpacing: typography.letterSpacing.editorial },
  statValue: { fontFamily: fontFamilies.display.semibold, fontSize: typography.fontSizes.xl, color: colors.light.foreground, marginTop: 4 },
  card: { padding: 14, gap: 10 },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.base, color: colors.light.foreground },
  handle: { fontFamily: fontFamilies.mono.regular, fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground, marginTop: 2 },
  statRow: { flexDirection: "row", justifyContent: "space-between" },
  mini: { alignItems: "center" },
  miniValue: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.sm, color: colors.light.foreground },
  miniLabel: { fontFamily: fontFamilies.mono.regular, fontSize: 10, color: colors.light.mutedForeground, marginTop: 2 },
});
