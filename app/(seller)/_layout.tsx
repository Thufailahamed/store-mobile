import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, View, Text, StyleSheet } from "react-native";
import { Tabs, useRouter, useSegments } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { useAuth } from "@/lib/supabase/auth";
import { colors, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { getSellerStore, getSellerPayoutSettings, getSellerComplianceDocuments } from "@/lib/api";
import { getSellerAccessState } from "@/lib/seller-access";
import type { SellerPayoutCompliance, SellerComplianceDocument } from "@/lib/seller-access";
import type { Store } from "@/lib/types";

export default function SellerLayout() {
  const { role, roleLoading, loading, user } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const [store, setStore] = useState<Store | null>(null);
  const [payout, setPayout] = useState<SellerPayoutCompliance | null>(null);
  const [documents, setDocuments] = useState<SellerComplianceDocument[]>([]);
  const [storeLoading, setStoreLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const loadStore = async () => {
      if (!user || role !== "store_owner") {
        if (!cancelled) {
          setStore(null);
          setStoreLoading(false);
        }
        return;
      }
      setStoreLoading(true);
      const res = await getSellerStore(user.id);
      if (!cancelled) {
        const nextStore = res.ok ? res.data : null;
        setStore(nextStore);
        if (nextStore) {
          const [payoutRes, docsRes] = await Promise.all([
            getSellerPayoutSettings(nextStore.id),
            getSellerComplianceDocuments(nextStore.id),
          ]);
          setPayout(payoutRes.ok ? payoutRes.data : null);
          setDocuments(docsRes.ok ? docsRes.data : []);
        } else {
          setPayout(null);
          setDocuments([]);
        }
        setStoreLoading(false);
      }
    };
    void loadStore();
    return () => {
      cancelled = true;
    };
  }, [user, role]);

  const access = useMemo(
    () => getSellerAccessState(store as (Store & Record<string, unknown>) | null, payout, documents),
    [store, payout, documents]
  );

  const isSettingsRoute = (segments as string[]).includes("settings");

  useEffect(() => {
    if (loading || roleLoading || storeLoading) return;
    if (role !== "store_owner") {
      router.replace("/(main)");
    }
  }, [role, roleLoading, loading, storeLoading, router]);

  if (loading || roleLoading || storeLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.light.background }}>
        <ActivityIndicator size="large" color={colors.light.primary} />
      </View>
    );
  }

  if (role !== "store_owner") {
    return null;
  }

  const locked = !access.canAccessSellerTools;

  if (locked && !isSettingsRoute) {
    if (access.isPendingReview || !access.hasStore) {
      return (
        <View style={styles.blockedContainer}>
          <View style={styles.reviewBadge}>
            <Text style={styles.reviewBadgeText}>Under review</Text>
          </View>
          <Text style={styles.blockedTitle}>Store in review</Text>
          <Text style={styles.blockedBody}>
            Thank you for submitting your application. Our admin team is reviewing{" "}
            {store?.name ? `"${store.name}"` : "your store"}. You&apos;ll get full seller access once it&apos;s approved.
          </Text>
          <View style={styles.reviewCard}>
            <Text style={styles.reviewCardLabel}>Application status</Text>
            <View style={styles.reviewCardRow}>
              <Text style={styles.reviewStoreName}>{store?.name ?? "Your store"}</Text>
              <View style={styles.pendingPill}>
                <View style={styles.pendingDot} />
                <Text style={styles.pendingPillText}>Pending review</Text>
              </View>
            </View>
          </View>
        </View>
      );
    }

    if (access.isRejected) {
      return (
        <View style={styles.blockedContainer}>
          <Ionicons name="close-circle-outline" size={44} color={colors.light.destructive} />
          <Text style={styles.blockedTitle}>Application rejected</Text>
          <Text style={styles.blockedBody}>
            {access.lockReason ?? "Your store application was rejected. Contact support if you believe this is an error."}
          </Text>
        </View>
      );
    }

    if (access.isSuspended) {
      return (
        <View style={styles.blockedContainer}>
          <Ionicons name="ban-outline" size={44} color={colors.light.destructive} />
          <Text style={styles.blockedTitle}>Account suspended</Text>
          <Text style={styles.blockedBody}>
            {access.lockReason ?? "Your seller account is suspended. Contact support to reactivate."}
          </Text>
        </View>
      );
    }
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.light.primary,
        tabBarInactiveTintColor: colors.light.mutedForeground,
        tabBarStyle: {
          backgroundColor: colors.light.card,
          borderTopColor: colors.light.border,
          borderTopWidth: 1,
          height: 85,
          paddingTop: 8,
          paddingBottom: 28,
        },
        tabBarLabelStyle: {
          fontSize: typography.fontSizes.xs,
          fontWeight: typography.fontWeights.medium,
          letterSpacing: typography.letterSpacing.wide,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          href: locked ? null : undefined,
          tabBarIcon: ({ color, size }) => <Ionicons name="bar-chart-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="products/index"
        options={{
          title: "Products",
          href: locked ? null : undefined,
          tabBarIcon: ({ color, size }) => <Ionicons name="cube-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="orders/index"
        options={{
          title: "Orders",
          href: locked ? null : undefined,
          tabBarIcon: ({ color, size }) => <Ionicons name="receipt-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="inventory/index"
        options={{
          title: "Inventory",
          href: locked ? null : undefined,
          tabBarIcon: ({ color, size }) => <Ionicons name="list-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings/index"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" size={size} color={color} />,
        }}
      />

      {/* Hidden detail screens — accessed via navigation */}
      <Tabs.Screen name="products/[id]/index" options={{ href: null }} />
      <Tabs.Screen name="orders/[id]/index" options={{ href: null }} />
      <Tabs.Screen name="returns/index" options={{ href: null }} />
      <Tabs.Screen name="returns/[id]/index" options={{ href: null }} />
      <Tabs.Screen name="analytics/index" options={{ href: null }} />
      <Tabs.Screen name="reviews/index" options={{ href: null }} />
      <Tabs.Screen name="coupons/index" options={{ href: null }} />
      <Tabs.Screen name="notifications/index" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  blockedContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: colors.light.background,
    gap: 10,
  },
  blockedTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 24,
    color: colors.light.foreground,
  },
  blockedBody: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.light.mutedForeground,
    textAlign: "center",
  },
  blockedButton: {
    marginTop: 10,
    backgroundColor: colors.light.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  blockedButtonText: {
    color: "#fff",
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.sm,
  },
  reviewBadge: {
    alignSelf: "center",
    backgroundColor: "#FEF3C7",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 4,
  },
  reviewBadgeText: {
    color: "#92400E",
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.xs,
    letterSpacing: typography.letterSpacing.wide,
    textTransform: "uppercase",
  },
  reviewCard: {
    marginTop: 20,
    width: "100%",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.light.card,
    padding: 16,
    gap: 10,
  },
  reviewCardLabel: {
    color: colors.light.mutedForeground,
    fontFamily: fontFamilies.sans.medium,
    fontSize: typography.fontSizes.xs,
    letterSpacing: typography.letterSpacing.wide,
    textTransform: "uppercase",
  },
  reviewCardRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  reviewStoreName: {
    flex: 1,
    color: colors.light.foreground,
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.sm,
  },
  pendingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEF3C7",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pendingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#F59E0B",
  },
  pendingPillText: {
    color: "#92400E",
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 10,
  },
});
