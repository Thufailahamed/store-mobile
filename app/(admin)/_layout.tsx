import React, { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { useAuth } from "@/lib/supabase/auth";
import { AdminTopBar } from "@/components/layout";
import { colors, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

export default function AdminLayout() {
  const { role, roleLoading, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading || roleLoading) return;
    if (role !== "admin") {
      router.replace("/(main)");
    }
  }, [role, roleLoading, loading, router]);

  if (loading || roleLoading || role !== "admin") {
    return (
      <View style={styles.guard}>
        <ActivityIndicator size="large" color={colors.light.primary} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <AdminTopBar />
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
          tabBarItemStyle: {
            paddingTop: 4,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Overview",
            tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="approvals/index"
          options={{
            title: "Approvals",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="checkmark-done-circle-outline" size={size} color={color} />
            ),
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
          name="catalogue/index"
          options={{
            title: "Catalogue",
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
        <Tabs.Screen name="users/index" options={{ href: null }} />
        <Tabs.Screen name="stores/index" options={{ href: null }} />
        <Tabs.Screen name="settings/index" options={{ href: null }} />
        <Tabs.Screen name="products/index" options={{ href: null }} />
        <Tabs.Screen name="orders/[id]/index" options={{ href: null }} />
        <Tabs.Screen name="analytics/index" options={{ href: null }} />
        <Tabs.Screen name="audit-log/index" options={{ href: null }} />
        <Tabs.Screen name="banners/index" options={{ href: null }} />
        <Tabs.Screen name="blog/index" options={{ href: null }} />
        <Tabs.Screen name="brands/index" options={{ href: null }} />
        <Tabs.Screen name="brands/[id]" options={{ href: null }} />
        <Tabs.Screen name="campaigns/index" options={{ href: null }} />
        <Tabs.Screen name="categories/index" options={{ href: null }} />
        <Tabs.Screen name="commissions/index" options={{ href: null }} />
        <Tabs.Screen name="contact/index" options={{ href: null }} />
        <Tabs.Screen name="content/index" options={{ href: null }} />
        <Tabs.Screen name="coupons/index" options={{ href: null }} />
        <Tabs.Screen name="delivery/index" options={{ href: null }} />
        <Tabs.Screen name="delivery/[id]/index" options={{ href: null }} />
        <Tabs.Screen name="gift-cards/index" options={{ href: null }} />
        <Tabs.Screen name="homepage/index" options={{ href: null }} />
        <Tabs.Screen name="notifications/index" options={{ href: null }} />
        <Tabs.Screen name="products/[id]" options={{ href: null }} />
        <Tabs.Screen name="reports/index" options={{ href: null }} />
        <Tabs.Screen name="stores/[id]" options={{ href: null }} />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.light.background,
  },
  guard: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.light.background,
  },
});
