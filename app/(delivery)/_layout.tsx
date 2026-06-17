import React, { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { Tabs, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useAuth } from "@/lib/supabase/auth";
import { resolveDeliveryHomeRoute } from "@/lib/delivery-company-routing";
import { colors, typography } from "@/lib/theme/tokens";

export default function DeliveryLayout() {
  const { user, role, roleLoading, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading || roleLoading || !user?.id) return;
    if (role !== "delivery_company") return;
    resolveDeliveryHomeRoute(user.id, role).then((home) => {
      if (home === "/(delivery-company)") {
        router.replace(home);
      }
    });
  }, [user?.id, role, roleLoading, loading, router]);

  if (role === "delivery_company" && (loading || roleLoading)) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.light.background }}>
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
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="orders/index"
        options={{
          title: "Deliveries",
          tabBarIcon: ({ color, size }) => <Ionicons name="bicycle-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="pickups/index"
        options={{
          title: "Pickups",
          tabBarIcon: ({ color, size }) => <Ionicons name="return-down-back-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="scan/index"
        options={{
          title: "Scan",
          tabBarIcon: ({ color, size }) => <Ionicons name="qr-code-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="history/index"
        options={{
          title: "History",
          tabBarIcon: ({ color, size }) => <Ionicons name="time-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          title: "Earnings",
          tabBarIcon: ({ color, size }) => <Ionicons name="wallet-outline" size={size} color={color} />,
        }}
      />

      <Tabs.Screen name="orders/[id]/index" options={{ href: null }} />
      <Tabs.Screen name="pickups/[id]/index" options={{ href: null }} />
      <Tabs.Screen name="route-map" options={{ href: null }} />
    </Tabs>
  );
}
