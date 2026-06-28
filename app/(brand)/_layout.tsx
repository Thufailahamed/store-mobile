import React, { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { useAuth } from "@/lib/supabase/auth";
import { colors, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

export default function BrandLayout() {
  const { role, roleLoading, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading || roleLoading) return;
    if (role !== "brand_owner" && role !== "admin") {
      router.replace("/(main)");
    }
  }, [role, roleLoading, loading, router]);

  if (loading || roleLoading || (role !== "brand_owner" && role !== "admin")) {
    return (
      <View style={styles.guard}>
        <ActivityIndicator size="large" color={colors.light.primary} />
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
          borderTopWidth: StyleSheet.hairlineWidth,
          height: 84,
          paddingTop: 8,
          paddingBottom: 26,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontFamily: fontFamilies.mono.medium,
          letterSpacing: typography.letterSpacing.wide,
          textTransform: "uppercase",
        },
        tabBarItemStyle: { paddingTop: 4 },
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
        name="products"
        options={{
          title: "Products",
          tabBarIcon: ({ color, size }) => <Ionicons name="cube-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="more/index"
        options={{
          title: "More",
          tabBarIcon: ({ color, size }) => <Ionicons name="menu-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" size={size} color={color} />,
        }}
      />

      {/* Hidden routes — reachable via More menu + deep links */}
      <Tabs.Screen name="more/analytics" options={{ href: null }} />
      <Tabs.Screen name="more/notifications" options={{ href: null }} />
      <Tabs.Screen name="more/orders" options={{ href: null }} />
      <Tabs.Screen name="more/orders/[id]" options={{ href: null }} />
      <Tabs.Screen name="more/returns" options={{ href: null }} />
      <Tabs.Screen name="more/reviews" options={{ href: null }} />
      <Tabs.Screen name="more/inventory" options={{ href: null }} />
      <Tabs.Screen name="more/payouts" options={{ href: null }} />
      <Tabs.Screen name="more/coupons" options={{ href: null }} />
      <Tabs.Screen name="more/followers" options={{ href: null }} />
      <Tabs.Screen name="more/influencers" options={{ href: null }} />
      <Tabs.Screen name="more/campaigns" options={{ href: null }} />
      <Tabs.Screen name="more/collections" options={{ href: null }} />
      <Tabs.Screen name="more/team" options={{ href: null }} />
      <Tabs.Screen name="more/branding" options={{ href: null }} />
      <Tabs.Screen name="more/storefront" options={{ href: null }} />
      <Tabs.Screen name="more/shipping" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  guard: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.light.background,
  },
});
