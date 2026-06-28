import React from "react";
import { ScrollView, View, Text, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, router } from "expo-router";
import { BrandScreenHeader } from "@/components/brand/BrandScreenHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { getBrandOrderById } from "@/lib/api";
import { colors, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";

export default function BrandOrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useQuery({
    queryKey: ["brand-order", id],
    enabled: !!id,
    queryFn: async () => {
      const r = await getBrandOrderById(id!);
      return r.ok ? r.data : null;
    },
  });

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <BrandScreenHeader
        eyebrow="Brand HQ"
        title="Order detail"
        back={{ onPress: () => router.back() }}
      />
      {q.isLoading ? (
        <View style={styles.skelWrap}>
          <Skeleton style={styles.skel} />
          <Skeleton style={styles.skel} />
        </View>
      ) : !q.data ? (
        <EmptyState icon="alert-circle-outline" title="Order not found" />
      ) : (
        <>
          <Card style={styles.card}>
            <View style={styles.headerRow}>
              <Text style={styles.orderId}>#{(q.data as { order_number?: string }).order_number ?? q.data.id.slice(0, 8)}</Text>
              <Badge variant="secondary">{q.data.status}</Badge>
            </View>
            <Text style={styles.subLine}>{(q.data as { store?: { name?: string } }).store?.name ?? "—"}</Text>
            <Text style={styles.totalLine}>{formatPrice(q.data.total ?? 0, q.data.currency ?? "LKR")}</Text>
          </Card>

          <Text style={styles.sectionTitle}>Items</Text>
          {(() => {
            const items = (q.data as unknown as { items?: Array<{ id: string; product_id: string; quantity: number; price: number }> }).items ?? [];
            if (items.length === 0) return <Text style={styles.empty}>No items on this order.</Text>;
            const currency = q.data.currency ?? "LKR";
            return items.map((it) => (
              <Card key={it.id} style={styles.itemCard}>
                <Text style={styles.itemName}>Product {it.product_id.slice(0, 8)}</Text>
                <Text style={styles.itemMeta}>Qty {it.quantity} × {formatPrice(it.price, currency)}</Text>
              </Card>
            ));
          })()}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.light.background },
  content: { paddingBottom: 32 },
  card: { marginHorizontal: 20, padding: 16, gap: 8 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  orderId: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.lg, color: colors.light.foreground },
  subLine: { fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground },
  totalLine: { fontFamily: fontFamilies.display.semibold, fontSize: typography.fontSizes.xl, color: colors.light.primary },
  sectionTitle: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    letterSpacing: typography.letterSpacing.editorial,
    textTransform: "uppercase",
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 8,
  },
  empty: { fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground, paddingHorizontal: 20 },
  itemCard: { marginHorizontal: 20, marginBottom: 8, padding: 12, gap: 4 },
  itemName: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.sm, color: colors.light.foreground },
  itemMeta: { fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground },
  skelWrap: { padding: 20, gap: 12 },
  skel: { height: 120, borderRadius: 8 },
});
