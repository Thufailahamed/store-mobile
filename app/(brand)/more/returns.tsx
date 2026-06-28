import React from "react";
import { View, FlatList, RefreshControl, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { BrandScreenHeader } from "@/components/brand/BrandScreenHeader";
import { BrandListRow, type BrandListStatus } from "@/components/brand/BrandListRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { getBrandReturns } from "@/lib/api";
import type { BrandReturn } from "@/lib/api/backend";
import { colors } from "@/lib/theme/tokens";

const STATUS_MAP: Record<string, BrandListStatus> = {
  requested: "pending",
  approved: "active",
  received: "active",
  rejected: "rejected",
  refunded: "completed",
};

export default function BrandReturns() {
  const q = useQuery({
    queryKey: ["brand-returns"],
    queryFn: async () => {
      const r = await getBrandReturns();
      return r.ok ? r.data : [];
    },
  });

  return (
    <View style={styles.root}>
      <BrandScreenHeader
        eyebrow="Brand HQ"
        title="Returns"
        subtitle={`${q.data?.length ?? 0} total`}
        back={{ onPress: () => router.back() }}
      />
      {q.isLoading ? (
        <View style={styles.list}>
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} style={styles.skel} />)}
        </View>
      ) : !q.data || q.data.length === 0 ? (
        <EmptyState icon="return-down-back-outline" title="No returns" description="Returns will appear here when customers initiate them." />
      ) : (
        <FlatList
          data={q.data}
          keyExtractor={(r) => r.id}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} />}
          contentContainerStyle={styles.listContent}
          renderItem={({ item, index }) => <ReturnRow item={item} index={index + 1} />}
        />
      )}
    </View>
  );
}

function ReturnRow({ item, index }: { item: BrandReturn; index: number }) {
  const status = (item.status ?? "requested") as keyof typeof STATUS_MAP;
  return (
    <BrandListRow
      index={index}
      title={`#${(item.order?.order_number ?? item.id).slice(0, 12)}`}
      subtitle={item.reason ?? "—"}
      status={STATUS_MAP[status] ?? "pending"}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.light.background },
  list: { padding: 20, gap: 8 },
  listContent: { paddingBottom: 32 },
  skel: { height: 56, borderRadius: 8 },
});
