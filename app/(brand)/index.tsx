import React from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/supabase/auth";
import { getBrandByOwner, getBrandKPIs } from "@/lib/api";
import { Card, Button, Badge, Skeleton } from "@/components/ui";
import { colors, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

export default function BrandDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const brandQuery = useQuery({
    queryKey: ["brand-owner", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const res = await getBrandByOwner(user.id);
      return res.ok ? res.data : null;
    },
    enabled: !!user,
  });

  const brand = brandQuery.data;

  const kpiQuery = useQuery({
    queryKey: ["brand-kpis", brand?.id],
    queryFn: async () => {
      if (!brand) return null;
      const res = await getBrandKPIs(brand.id);
      return res.ok ? res.data : null;
    },
    enabled: !!brand,
  });

  const kpis = kpiQuery.data;
  const loading = brandQuery.isLoading || kpiQuery.isLoading;

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <Skeleton width={180} height={28} />
        </View>
        <View style={styles.kpiGrid}>
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} style={styles.kpiCard}>
              <Skeleton width={60} height={20} />
              <Skeleton width={100} height={14} style={{ marginTop: 8 }} />
            </Card>
          ))}
        </View>
      </View>
    );
  }

  if (!brand) {
    return (
      <View style={styles.container}>
        <View style={[styles.center, { paddingTop: insets.top }]}>
          <Text style={styles.emptyTitle}>No Brand Found</Text>
          <Text style={styles.emptyText}>
            Your brand account is pending approval or hasn&apos;t been set up yet.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 24 }]}
      refreshControl={
        <RefreshControl
          refreshing={brandQuery.isFetching || kpiQuery.isFetching}
          onRefresh={() => {
            brandQuery.refetch();
            kpiQuery.refetch();
          }}
          tintColor={colors.light.primary}
        />
      }
    >
      <View style={styles.hero}>
        <Text style={styles.greeting}>Brand Dashboard</Text>
        <Text style={styles.brandName}>{brand.name}</Text>
        <Badge
          variant={brand.status === "approved" ? "default" : "secondary"}
        >
          {brand.status}
        </Badge>
      </View>

      <View style={styles.kpiGrid}>
        <Card style={styles.kpiCard}>
          <Text style={styles.kpiValue}>{kpis?.totalProducts ?? 0}</Text>
          <Text style={styles.kpiLabel}>Products</Text>
        </Card>
        <Card style={styles.kpiCard}>
          <Text style={styles.kpiValue}>{kpis?.activeProducts ?? 0}</Text>
          <Text style={styles.kpiLabel}>Active</Text>
        </Card>
        <Card style={styles.kpiCard}>
          <Text style={styles.kpiValue}>{kpis?.totalOrders ?? 0}</Text>
          <Text style={styles.kpiLabel}>Orders</Text>
        </Card>
        <Card style={styles.kpiCard}>
          <Text style={styles.kpiValue}>
            LKR {(kpis?.totalRevenue ?? 0).toLocaleString()}
          </Text>
          <Text style={styles.kpiLabel}>Revenue</Text>
        </Card>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <Button
          onPress={() => router.push("/(brand)/products")}
          variant="outline"
          style={styles.actionBtn}
        >
          Manage Products
        </Button>
        <Button
          onPress={() => router.push("/(brand)/settings")}
          variant="outline"
          style={styles.actionBtn}
        >
          Brand Settings
        </Button>
      </View>

      {brand.description ? (
        <Card style={styles.aboutCard}>
          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.aboutText}>{brand.description}</Text>
        </Card>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  content: { padding: 24 },
  header: { paddingTop: 32, paddingBottom: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  hero: { marginBottom: 24 },
  greeting: { fontFamily: fontFamilies.mono.medium, fontSize: typography.fontSizes.sm, color: colors.light.muted, textTransform: "uppercase", letterSpacing: 1 },
  brandName: { fontFamily: fontFamilies.display.semibold, fontSize: typography.fontSizes["3xl"], color: colors.light.foreground, marginTop: 4 },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 16, marginBottom: 24 },
  kpiCard: { width: "47%", padding: 24 },
  kpiValue: { fontFamily: fontFamilies.display.semibold, fontSize: typography.fontSizes["2xl"], color: colors.light.foreground },
  kpiLabel: { fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.sm, color: colors.light.muted, marginTop: 4 },
  section: { marginBottom: 24 },
  sectionTitle: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.xl, color: colors.light.foreground, marginBottom: 16 },
  actionBtn: { marginBottom: 8 },
  aboutCard: { padding: 24 },
  aboutText: { fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.base, color: colors.light.foreground, lineHeight: 22 },
  emptyTitle: { fontFamily: fontFamilies.display.semibold, fontSize: typography.fontSizes["2xl"], color: colors.light.foreground, marginBottom: 8 },
  emptyText: { fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.base, color: colors.light.muted, textAlign: "center" },
});
