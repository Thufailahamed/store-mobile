import React from "react";
import { View, Text, FlatList, RefreshControl, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { BrandScreenHeader } from "@/components/brand/BrandScreenHeader";
import { BrandListRow, type BrandListStatus } from "@/components/brand/BrandListRow";
import { FilterChips } from "@/components/brand/FilterChips";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { getBrandOrders } from "@/lib/api";
import type { Order } from "@/lib/types";
import { colors, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";

type Filter = "all" | "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";
const FILTERS: ReadonlyArray<{ value: Filter; label: string }> = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

const STATUS_MAP: Record<string, BrandListStatus> = {
  pending: "pending",
  confirmed: "active",
  processing: "active",
  shipped: "shipped",
  delivered: "delivered",
  cancelled: "cancelled",
};

export default function BrandOrders() {
  const [filter, setFilter] = React.useState<Filter>("all");
  const q = useQuery({
    queryKey: ["brand-orders", filter],
    queryFn: async () => {
      const r = await getBrandOrders("brand", { status: filter === "all" ? undefined : filter });
      return r.ok ? r.data : [];
    },
  });

  return (
    <View style={styles.root}>
      <BrandScreenHeader
        eyebrow="Brand HQ"
        title="Orders"
        subtitle={`${q.data?.length ?? 0} total`}
        back={{ onPress: () => router.back() }}
      />
      <FilterChips value={filter} options={FILTERS} onChange={setFilter} />
      {q.isLoading ? (
        <View style={styles.list}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} style={styles.skelRow} />
          ))}
        </View>
      ) : !q.data || q.data.length === 0 ? (
        <EmptyState icon="receipt-outline" title="No orders yet" description="Orders will appear here once customers buy your products." />
      ) : (
        <FlatList
          data={q.data}
          keyExtractor={(o) => o.id}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} />}
          contentContainerStyle={styles.listContent}
          renderItem={({ item, index }) => <OrderRow order={item} index={index + 1} />}
        />
      )}
    </View>
  );
}

function OrderRow({ order, index }: { order: Order & { store?: { name?: string } }; index: number }) {
  const status = (order.status ?? "pending") as keyof typeof STATUS_MAP;
  return (
    <BrandListRow
      index={index}
      title={`#${(order as { order_number?: string }).order_number ?? order.id.slice(0, 8)}`}
      subtitle={order.store?.name ?? "Store"}
      meta={formatPrice(order.total ?? 0, order.currency ?? "LKR")}
      status={STATUS_MAP[status] ?? "pending"}
      onPress={() => router.push({ pathname: "/(brand)/more/orders/[id]", params: { id: order.id } } as never)}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.light.background },
  list: { padding: 20, gap: 8 },
  listContent: { paddingBottom: 32 },
  skelRow: { height: 64, borderRadius: 8 },
});
