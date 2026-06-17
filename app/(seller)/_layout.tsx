import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, View, Text, Pressable, StyleSheet } from "react-native";
import { Tabs, useRouter, useSegments } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
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

  const isSettingsRoute = segments.includes("settings");

  useEffect(() => {
    if (loading || roleLoading || storeLoading) return;
    if (role !== "store_owner") {
      router.replace("/(main)");
      return;
    }
    if (!access.canAccessSellerTools && !isSettingsRoute) {
      router.replace("/(seller)/settings");
    }
  }, [role, roleLoading, loading, storeLoading, access.canAccessSellerTools, isSettingsRoute, router]);

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

  if (!access.canAccessSellerTools && !isSettingsRoute) {
    return (
      <View style={styles.blockedContainer}>
        <Ionicons name="shield-checkmark-outline" size={44} color={colors.light.primary} />
        <Text style={styles.blockedTitle}>Seller access limited</Text>
        <Text style={styles.blockedBody}>
          {access.lockReason ?? "Complete seller verification to continue."}
        </Text>
        <Pressable style={styles.blockedButton} onPress={() => router.replace("/(seller)/settings")}>
          <Text style={styles.blockedButtonText}>Open Seller Settings</Text>
        </Pressable>
      </View>
    );
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
          tabBarIcon: ({ color, size }) => <Ionicons name="bar-chart-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="products/index"
        options={{
          title: "Products",
          tabBarIcon: ({ color, size }) => <Ionicons name="cube-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="orders/index"
        options={{
          title: "Orders",
          tabBarIcon: ({ color, size }) => <Ionicons name="receipt-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="inventory/index"
        options={{
          title: "Inventory",
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
});
