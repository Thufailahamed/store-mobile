import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { BrandScreenHeader } from "@/components/brand/BrandScreenHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { getBrandCoupons } from "@/lib/api";
import type { BrandCoupon } from "@/lib/api/backend";
import { colors, typography, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

export default function BrandCoupons() {
  const q = useQuery({
    queryKey: ["brand-coupons"],
    queryFn: async () => {
      const r = await getBrandCoupons();
      return r.ok ? r.data : [];
    },
  });

  return (
    <View style={styles.root}>
      <BrandScreenHeader
        eyebrow="Brand HQ"
        title="Coupons"
        subtitle={`${q.data?.length ?? 0} total`}
        back={{ onPress: () => router.back() }}
      />
      {q.isLoading ? (
        <View style={styles.list}>
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} style={styles.skel} />)}
        </View>
      ) : !q.data || q.data.length === 0 ? (
        <EmptyState icon="pricetag-outline" title="No coupons" description="Brand-level coupon creation is on the roadmap." />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {q.data.map((c) => <CouponCard key={c.id} coupon={c} />)}
        </ScrollView>
      )}
    </View>
  );
}

function CouponCard({ coupon }: { coupon: BrandCoupon }) {
  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <View style={styles.codePill}>
          <Text style={styles.codeText}>{coupon.code}</Text>
        </View>
        <Badge variant={coupon.is_active ? "default" : "secondary"}>{coupon.is_active ? "Active" : "Inactive"}</Badge>
      </View>
      <Text style={styles.detail}>{formatDiscount(coupon)}</Text>
      {coupon.min_order ? <Text style={styles.meta}>Min order: LKR {coupon.min_order.toLocaleString()}</Text> : null}
      {coupon.expires_at ? <Text style={styles.meta}>Expires: {new Date(coupon.expires_at).toLocaleDateString()}</Text> : null}
    </Card>
  );
}

function formatDiscount(c: BrandCoupon): string {
  if (c.discount_type === "percent") return `${c.discount_value}% off`;
  if (c.discount_type === "fixed") return `LKR ${c.discount_value.toLocaleString()} off`;
  return "Free shipping";
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.light.background },
  list: { padding: 20, gap: 12 },
  skel: { height: 80, borderRadius: radii.xl },
  card: { padding: 16, gap: 6 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  codePill: {
    backgroundColor: colors.light.muted,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  codeText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: typography.fontSizes.sm,
    color: colors.light.foreground,
    letterSpacing: 2,
  },
  detail: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.base,
    color: colors.light.foreground,
    marginTop: 4,
  },
  meta: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
  },
});
