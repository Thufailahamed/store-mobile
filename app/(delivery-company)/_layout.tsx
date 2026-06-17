import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Tabs, useRouter, useSegments } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useAuth } from "@/lib/supabase/auth";
import { resolveDeliveryHomeRoute } from "@/lib/delivery-company-routing";
import { getDeliveryCompanyMe, hasStoreApi } from "@/lib/api/delivery-company-api";
import { colors, typography } from "@/lib/theme/tokens";

const PUBLIC_SEGMENTS = new Set(["onboarding", "accept"]);

export default function DeliveryCompanyLayout() {
  const { user, role, roleLoading, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const [accessChecked, setAccessChecked] = useState(false);
  const [allowed, setAllowed] = useState(false);

  const segmentLeaf = segments[segments.length - 1] ?? "";
  const isPublicRoute = PUBLIC_SEGMENTS.has(segmentLeaf as string);

  useEffect(() => {
    if (loading || roleLoading || !user?.id) return;

    if (role !== "delivery_company" && role !== "admin") {
      router.replace("/(main)");
      return;
    }

    if (isPublicRoute) {
      setAllowed(true);
      setAccessChecked(true);
      return;
    }

    resolveDeliveryHomeRoute(user.id, role).then(async (home) => {
      if (home !== "/(delivery-company)") {
        router.replace(home);
        return;
      }

      if (hasStoreApi()) {
        const me = await getDeliveryCompanyMe();
        if (!me.ok && me.error.toLowerCase().includes("no company")) {
          router.replace("/(delivery-company)/onboarding");
          return;
        }
      }

      setAllowed(true);
      setAccessChecked(true);
    });
  }, [user?.id, role, roleLoading, loading, router, isPublicRoute]);

  if ((loading || roleLoading || !accessChecked) && !isPublicRoute) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: colors.light.background,
        }}
      >
        <ActivityIndicator size="large" color={colors.light.primary} />
      </View>
    );
  }

  if (!allowed && !isPublicRoute) return null;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.light.primary,
        tabBarInactiveTintColor: colors.light.mutedForeground,
        tabBarStyle: isPublicRoute
          ? { display: "none" }
          : {
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
          title: "HQ",
          tabBarIcon: ({ color, size }) => <Ionicons name="business-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="packages/index"
        options={{
          title: "Packages",
          tabBarIcon: ({ color, size }) => <Ionicons name="cube-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="routes/index"
        options={{
          title: "Routes",
          tabBarIcon: ({ color, size }) => <Ionicons name="map-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="assignments/index"
        options={{
          title: "Assign",
          tabBarIcon: ({ color, size }) => <Ionicons name="git-branch-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="more/index"
        options={{
          title: "More",
          tabBarIcon: ({ color, size }) => <Ionicons name="ellipsis-horizontal" size={size} color={color} />,
        }}
      />

      <Tabs.Screen name="drivers/index" options={{ href: null }} />
      <Tabs.Screen name="warehouses/index" options={{ href: null }} />
      <Tabs.Screen name="routes/[id]/index" options={{ href: null }} />
      <Tabs.Screen name="drivers/[id]/index" options={{ href: null }} />
      <Tabs.Screen name="warehouses/[id]/index" options={{ href: null }} />
      <Tabs.Screen name="settings/index" options={{ href: null }} />
      <Tabs.Screen name="team/index" options={{ href: null }} />
      <Tabs.Screen name="returns/index" options={{ href: null }} />
      <Tabs.Screen name="history/index" options={{ href: null }} />
      <Tabs.Screen name="onboarding/index" options={{ href: null }} />
      <Tabs.Screen name="accept/index" options={{ href: null }} />
    </Tabs>
  );
}
