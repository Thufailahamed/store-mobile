import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Tabs, useRouter, useSegments } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@/components/ui/Icon";
import { useAuth } from "@/lib/supabase/auth";
import { colors, typography, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import {
  getSellerStore,
  getSellerPayoutSettings,
  getSellerComplianceDocuments,
  getSellerKPIs,
  getSellerNotifications,
  getSellerOrders,
  getSellerProducts,
  getSellerInventory,
  peekSellerSnapshot,
  SELLER_CACHE_KEYS,
} from "@/lib/api";
import { getSellerAccessState } from "@/lib/seller-access";
import {
  hasCompletedSellerOnboarding,
  seedStoreContactFromAccount,
  storeLooksSetUp,
} from "@/lib/seller-onboarding";
import type { SellerPayoutCompliance, SellerComplianceDocument } from "@/lib/seller-access";
import type { Store } from "@/lib/types";
import { PendingReviewScreen } from "@/components/seller/PendingReviewScreen";
import { PICKUP_ADDRESS_ROUTE } from "@/lib/seller-pickup-address";

export default function SellerLayout() {
  const { role, roleLoading, loading, user } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const [store, setStore] = useState<Store | null>(null);
  const [payout, setPayout] = useState<SellerPayoutCompliance | null>(null);
  const [documents, setDocuments] = useState<SellerComplianceDocument[]>([]);
  const [storeLoading, setStoreLoading] = useState(true);
  const [pendingOrdersCount, setPendingOrdersCount] = useState<number | null>(null);
  // New sellers (fresh store, onboarding not finished/skipped) go through
  // onboarding once. null = flag not read yet.
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  const onboardingRedirected = useRef(false);

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
      // 1. Paint instantly from the last-known snapshot (disk, no network).
      const [snapStore, snapPayout, snapDocs] = await Promise.all([
        peekSellerSnapshot<Store | null>(SELLER_CACHE_KEYS.store),
        peekSellerSnapshot<SellerPayoutCompliance | null>(SELLER_CACHE_KEYS.payout),
        peekSellerSnapshot<SellerComplianceDocument[]>(SELLER_CACHE_KEYS.docs),
      ]);
      if (cancelled) return;
      if (snapStore) {
        setStore(snapStore);
        setPayout(snapPayout ?? null);
        setDocuments(snapDocs ?? []);
        setStoreLoading(false);
        // Warm the dashboard's own reads in parallel with ours.
        void getSellerKPIs(snapStore.id).then((kpiRes) => {
          if (!cancelled && kpiRes.ok && kpiRes.data) {
            setPendingOrdersCount(kpiRes.data.pendingOrders ?? 0);
          }
        });
        void getSellerNotifications(20);
      } else {
        setStoreLoading(true);
      }

      // 2. Revalidate: store, payout and docs in one parallel round-trip
      //    (none of them needs the store id server-side).
      const [res, payoutRes, docsRes] = await Promise.all([
        getSellerStore(user.id),
        getSellerPayoutSettings(""),
        getSellerComplianceDocuments(""),
      ]);
      if (cancelled) return;
      const nextStore = res.ok ? res.data : null;
      if (nextStore) {
        void getSellerKPIs(nextStore.id).then((kpiRes) => {
          if (!cancelled && kpiRes.ok && kpiRes.data) {
            setPendingOrdersCount(kpiRes.data.pendingOrders ?? 0);
          }
        });
        void getSellerNotifications(20);
      }
      setStore(nextStore);
      setPayout(nextStore && payoutRes.ok ? payoutRes.data : null);
      setDocuments(nextStore && docsRes.ok ? docsRes.data : []);
      setStoreLoading(false);

      // Warm the other tabs' first page once the dashboard has had its turn,
      // so opening Orders / Products / Inventory paints from cache. Options
      // must match each screen's own call (they form the cache key).
      if (
        nextStore &&
        getSellerAccessState(
          nextStore as Store & Record<string, unknown>,
          payoutRes.ok ? payoutRes.data : null,
          docsRes.ok ? docsRes.data : [],
        ).canAccessSellerTools
      ) {
        const id = nextStore.id;
        prefetchTimer = setTimeout(() => {
          void getSellerOrders(id, { limit: 200 });
          void getSellerProducts(id, { sort: "newest", limit: 20, offset: 0 });
          void getSellerInventory(id);
          void getSellerProducts(id, { limit: 100 });
        }, 1200);
      }

      // 3. Backfill the store's contact from the sign-up phone/email —
      //    off the critical path.
      void seedStoreContactFromAccount(nextStore, user).then((seeded) => {
        if (!seeded || cancelled) return;
        setStore((cur) =>
          cur
            ? {
                ...cur,
                contact_phone: cur.contact_phone || seeded.phone || null,
                contact_email: cur.contact_email || seeded.email || null,
              }
            : cur,
        );
      });
    };
    let prefetchTimer: ReturnType<typeof setTimeout> | undefined;
    void loadStore();
    return () => {
      cancelled = true;
      if (prefetchTimer) clearTimeout(prefetchTimer);
    };
  }, [user, role]);

  const access = useMemo(
    () => getSellerAccessState(store as (Store & Record<string, unknown>) | null, payout, documents),
    [store, payout, documents],
  );

  const isOnboardingRoute = (segments as string[]).includes("onboarding");
  const isSettingsRoute =
    (segments as string[]).includes("settings") ||
    (segments as string[]).includes("more") ||
    isOnboardingRoute;

  // Re-read the done flag whenever the seller is outside onboarding, so
  // finishing or skipping it is picked up without reloading the layout.
  useEffect(() => {
    if (!user || role !== "store_owner" || isOnboardingRoute) {
      if (isOnboardingRoute) onboardingRedirected.current = true;
      return;
    }
    let cancelled = false;
    void hasCompletedSellerOnboarding(user.id).then((done) => {
      if (!cancelled) setOnboardingDone(done);
    });
    return () => {
      cancelled = true;
    };
  }, [user, role, isOnboardingRoute]);

  // Non-sellers leave the seller area. Deps stay minimal: re-firing this on
  // every route change while the layout is still mounted ping-pongs the
  // navigator ("Maximum update depth exceeded").
  useEffect(() => {
    if (loading || roleLoading || storeLoading) return;
    if (role !== "store_owner") router.replace("/(main)");
  }, [role, roleLoading, loading, storeLoading, router]);

  useEffect(() => {
    if (loading || roleLoading || storeLoading || role !== "store_owner") return;
    // At most one automatic redirect per session — never loop back after
    // the seller finishes or skips.
    if (
      onboardingDone === false &&
      !storeLooksSetUp(store) &&
      !isOnboardingRoute &&
      !onboardingRedirected.current
    ) {
      onboardingRedirected.current = true;
      router.replace("/(seller)/onboarding" as any);
    }
  }, [role, roleLoading, loading, storeLoading, router, onboardingDone, store, isOnboardingRoute]);

  const awaitingOnboardingFlag =
    role === "store_owner" && onboardingDone === null && !isOnboardingRoute;
  if (loading || roleLoading || storeLoading || awaitingOnboardingFlag) {
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

  // Locked stores see a status screen on top of the navigator. The <Tabs>
  // navigator stays mounted underneath: swapping it out for this view while
  // a back/tab navigation is in flight loops the native stack
  // ("Maximum update depth exceeded").
  const blockedView = (() => {
    if (!locked || isSettingsRoute) return null;
    const goSettings = () => router.push("/(seller)/settings" as any);
    if (access.isPendingReview) {
      return (
        <PendingReviewScreen
          store={store}
          onOpenSettings={goSettings}
          onOpenSetup={() => router.push("/(seller)/onboarding" as any)}
          onOpenPickup={() => router.push(PICKUP_ADDRESS_ROUTE as any)}
        />
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
    return null;
  })();

  const tabBarHeight = 50 + Math.max(insets.bottom, 12);
  const showOrdersBadge = pendingOrdersCount === null || pendingOrdersCount > 0;

  return (
    <View style={styles.root}>
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#111114",
        tabBarInactiveTintColor: "#8e8a86",
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: "#FAF7F2",
          borderTopColor: "rgba(22,23,15,0.08)",
          borderTopWidth: StyleSheet.hairlineWidth,
          height: tabBarHeight,
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 8),
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontFamily: fontFamilies.sans.regular,
          letterSpacing: 0.15,
          marginTop: 2,
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
            <View style={styles.tabIconWrap}>
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
            <View style={styles.tabIconWrap}>
              <Ionicons name={focused ? "bag-handle" : "bag-handle-outline"} size={22} color={color} />
              {showOrdersBadge ? <View style={styles.orderBadgeDot} /> : null}
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
            <View style={styles.tabIconWrap}>
              <Ionicons name={focused ? "grid" : "grid-outline"} size={21} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="posts/index"
        options={{
          title: "Studio",
          href: locked ? null : undefined,
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.tabIconWrap}>
              <Ionicons name={focused ? "play" : "play-outline"} size={19} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="more/index"
        options={{
          title: "More",
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.tabIconWrap}>
              <Ionicons
                name={focused ? "ellipsis-horizontal" : "ellipsis-horizontal-outline"}
                size={22}
                color={color}
              />
            </View>
          ),
        }}
      />

      <Tabs.Screen name="inventory/index" options={{ href: null }} />
      <Tabs.Screen name="onboarding" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="analytics" options={{ href: null }} />
      <Tabs.Screen name="settings/index" options={{ href: null }} />
      <Tabs.Screen name="settings/pickup-address" options={{ href: null }} />
      <Tabs.Screen name="products/[id]/index" options={{ href: null }} />
      <Tabs.Screen name="products/new" options={{ href: null }} />
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
      <Tabs.Screen name="payouts/verify" options={{ href: null }} />
      <Tabs.Screen name="orders/[id]/invoice" options={{ href: null }} />
      <Tabs.Screen name="posts/new" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="posts/[id]" options={{ href: null, tabBarStyle: { display: "none" } }} />
    </Tabs>
      {blockedView ? <View style={styles.blockedOverlay}>{blockedView}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  blockedOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 10 },
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
    fontFamily: fontFamilies.sans.bold,
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
  tabIconWrap: {
    width: 28,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  orderBadgeDot: {
    position: "absolute",
    top: 0,
    right: 1,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#b85c3a",
  },
});
