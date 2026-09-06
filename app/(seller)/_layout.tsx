import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Tabs, useRouter, useSegments } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@/components/ui/Icon";
import { useAuth } from "@/lib/supabase/auth";
import { colors, typography, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { getSellerStore, getSellerPayoutSettings, getSellerComplianceDocuments } from "@/lib/api";
import { getSellerAccessState } from "@/lib/seller-access";
import type { SellerPayoutCompliance, SellerComplianceDocument } from "@/lib/seller-access";
import type { Store } from "@/lib/types";

export default function SellerLayout() {
  const { role, roleLoading, loading, user } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
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
    [store, payout, documents],
  );

  const isSettingsRoute =
    (segments as string[]).includes("settings") || (segments as string[]).includes("more");

  useEffect(() => {
    if (loading || roleLoading || storeLoading) return;
    if (role !== "store_owner") {
      router.replace("/(main)");
    }
  }, [role, roleLoading, loading, storeLoading, router]);

  if (loading || roleLoading || storeLoading) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator size="large" color={colors.light.primary} />
      </View>
    );
  }

  if (role !== "store_owner") {
    return null;
  }

  const locked = !access.canAccessSellerTools;

  if (locked && !isSettingsRoute) {
    const goSettings = () => router.push("/(seller)/settings" as any);
    if (access.isPendingReview) {
      return (
        <View style={styles.blockedContainer}>
          <View style={styles.reviewBadge}>
            <Text style={styles.reviewBadgeText}>Under review</Text>
          </View>
          <Text style={styles.blockedTitle}>Store in review</Text>
          <Text style={styles.blockedBody}>
            Thank you for submitting your application. Our admin team is reviewing{" "}
            {store?.name ? `"${store.name}"` : "your store"}. You&apos;ll get full seller access once
            it&apos;s approved.
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
          <TouchableOpacity style={styles.blockedCta} onPress={goSettings} accessibilityRole="button">
            <Text style={styles.blockedCtaText}>View store settings</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (access.isRejected) {
      return (
        <View style={styles.blockedContainer}>
          <Ionicons name="close-circle-outline" size={44} color={colors.light.destructive} />
          <Text style={styles.blockedTitle}>Application rejected</Text>
          <Text style={styles.blockedBody}>
            {access.lockReason ??
              "Your store application was rejected. Contact support if you believe this is an error."}
          </Text>
          <TouchableOpacity style={styles.blockedCta} onPress={goSettings} accessibilityRole="button">
            <Text style={styles.blockedCtaText}>Open settings</Text>
          </TouchableOpacity>
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
          <TouchableOpacity style={styles.blockedCta} onPress={goSettings} accessibilityRole="button">
            <Text style={styles.blockedCtaText}>Open settings</Text>
          </TouchableOpacity>
        </View>
      );
    }
  }

  const tabBarHeight = 62 + Math.max(insets.bottom, 10);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.olive[900],
        tabBarInactiveTintColor: colors.ink.mute,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: colors.paper.cream,
          borderTopColor: "rgba(83,94,44,0.12)",
          borderTopWidth: StyleSheet.hairlineWidth,
          height: tabBarHeight,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 10),
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontFamily: fontFamilies.sans.semibold,
          letterSpacing: 0.35,
          marginTop: 3,
        },
        tabBarItemStyle: {
          paddingTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          href: locked ? null : undefined,
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.tabIconWrap, focused && styles.tabIconWrapActive]}>
              <Ionicons name={focused ? "home" : "home-outline"} size={22} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="orders/index"
        options={{
          title: "Orders",
          href: locked ? null : undefined,
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.tabIconWrap, focused && styles.tabIconWrapActive]}>
              <Ionicons name={focused ? "receipt" : "receipt-outline"} size={22} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="products/index"
        options={{
          title: "Products",
          href: locked ? null : undefined,
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.tabIconWrap, focused && styles.tabIconWrapActive]}>
              <Ionicons name={focused ? "cube" : "cube-outline"} size={22} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="inventory/index"
        options={{
          title: "Stock",
          href: locked ? null : undefined,
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.tabIconWrap, focused && styles.tabIconWrapActive]}>
              <Ionicons name={focused ? "layers" : "layers-outline"} size={22} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="more/index"
        options={{
          title: "More",
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.tabIconWrap, focused && styles.tabIconWrapActive]}>
              <Ionicons
                name={focused ? "grid" : "grid-outline"}
                size={22}
                color={color}
              />
            </View>
          ),
        }}
      />

      <Tabs.Screen name="analytics" options={{ href: null }} />
      <Tabs.Screen name="settings/index" options={{ href: null }} />
      <Tabs.Screen name="products/[id]/index" options={{ href: null }} />
      <Tabs.Screen name="orders/[id]/index" options={{ href: null }} />
      <Tabs.Screen name="returns/index" options={{ href: null }} />
      <Tabs.Screen name="returns/[id]/index" options={{ href: null }} />
      <Tabs.Screen name="reviews/index" options={{ href: null }} />
      <Tabs.Screen name="coupons/index" options={{ href: null }} />
      <Tabs.Screen name="notifications/index" options={{ href: null }} />
      <Tabs.Screen name="payouts/index" options={{ href: null }} />
      <Tabs.Screen name="payouts/settings" options={{ href: null }} />
      <Tabs.Screen name="payouts/withdraw" options={{ href: null }} />
      <Tabs.Screen name="payouts/connect-return" options={{ href: null }} />
      <Tabs.Screen name="payouts/stripe-return" options={{ href: null }} />
      <Tabs.Screen name="payouts/[payoutId]" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.light.background,
  },
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
  blockedCta: {
    marginTop: 16,
    backgroundColor: colors.olive[800],
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: radii.full,
    minHeight: 44,
    justifyContent: "center",
  },
  blockedCtaText: {
    color: colors.paper.cream,
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
  tabIconWrap: {
    width: 44,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  tabIconWrapActive: {
    backgroundColor: "rgba(83,94,44,0.1)",
  },
});
