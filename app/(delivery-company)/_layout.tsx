import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, View, Text, Pressable, StyleSheet } from "react-native";
import { Tabs, useRouter, useSegments, useFocusEffect } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { useAuth } from "@/lib/supabase/auth";
import { resolveDeliveryHomeRoute } from "@/lib/delivery-company-routing";
import { getDeliveryCompanyMe, hasStoreApi } from "@/lib/api/delivery-company-api";
import {
  getDeliveryCompanyAccessState,
  isDeliveryCompanyAccessibleRoute,
  type DeliveryCompanyAccessState,
} from "@/lib/delivery-company-access";
import { normalizeDeliveryCompanyAccess } from "@/lib/delivery-company-api-guard";
import type { DeliveryCompany } from "@/lib/api/delivery-company-api";
import { colors, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

const PUBLIC_SEGMENTS = new Set(["onboarding", "accept"]);

export default function DeliveryCompanyLayout() {
  const { user, role, roleLoading, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const [accessChecked, setAccessChecked] = useState(false);
  const [companyLoaded, setCompanyLoaded] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [company, setCompany] = useState<DeliveryCompany | null>(null);
  const [serverAccess, setServerAccess] = useState<DeliveryCompanyAccessState | null>(null);

  const access = useMemo(
    () => serverAccess ?? getDeliveryCompanyAccessState(company),
    [serverAccess, company]
  );
  const locked = role !== "admin" && companyLoaded && !access.canUseCompanyTools;
  const isAccessibleRoute = isDeliveryCompanyAccessibleRoute(segments as string[], access);

  const segmentLeaf = segments[segments.length - 1] ?? "";
  const isPublicRoute = PUBLIC_SEGMENTS.has(segmentLeaf as string);

  const refreshCompany = useCallback(async () => {
    if (!hasStoreApi() || isPublicRoute || !user?.id) return;
    const me = await getDeliveryCompanyMe();
    if (me.ok) {
      setCompany(me.data.company);
      setServerAccess(normalizeDeliveryCompanyAccess(me.data.access, me.data.company));
    }
    setCompanyLoaded(true);
  }, [user?.id, isPublicRoute]);

  useFocusEffect(
    useCallback(() => {
      if (!accessChecked || isPublicRoute) return;
      void refreshCompany();
    }, [accessChecked, isPublicRoute, refreshCompany])
  );

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
        if (me.ok) {
          setCompany(me.data.company);
          setServerAccess(normalizeDeliveryCompanyAccess(me.data.access, me.data.company));
        }
        setCompanyLoaded(true);
      } else {
        setCompanyLoaded(true);
      }

      setAllowed(true);
      setAccessChecked(true);
    });
  }, [user?.id, role, roleLoading, loading, router, isPublicRoute]);

  useEffect(() => {
    if (!accessChecked || isPublicRoute || !locked || isAccessibleRoute) return;
    router.replace("/(delivery-company)/settings");
  }, [accessChecked, isPublicRoute, locked, isAccessibleRoute, router]);

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

  if (accessChecked && !companyLoaded && hasStoreApi() && !isPublicRoute) {
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

  if (locked && !isPublicRoute && !isAccessibleRoute) {
    return (
      <View style={styles.blockedContainer}>
        <Ionicons name="business-outline" size={44} color={colors.light.primary} />
        <Text style={styles.blockedTitle}>Logistics access limited</Text>
        <Text style={styles.blockedBody}>
          {access.lockReason ?? "Your delivery company is not active yet."}
        </Text>
        <Pressable
          style={styles.blockedButton}
          onPress={() => router.replace("/(delivery-company)/settings")}
        >
          <Text style={styles.blockedButtonText}>Open Company Settings</Text>
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
          href: locked ? null : undefined,
          tabBarIcon: ({ color, size }) => <Ionicons name="business-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="packages/index"
        options={{
          title: "Packages",
          href: locked ? null : undefined,
          tabBarIcon: ({ color, size }) => <Ionicons name="cube-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="routes/index"
        options={{
          title: "Routes",
          href: locked ? null : undefined,
          tabBarIcon: ({ color, size }) => <Ionicons name="map-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="assignments/index"
        options={{
          title: "Assign",
          href: locked ? null : undefined,
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
      <Tabs.Screen name="warehouses/receive" options={{ href: null }} />
      <Tabs.Screen name="settings/index" options={{ href: null }} />
      <Tabs.Screen name="team/index" options={{ href: null }} />
      <Tabs.Screen name="returns/index" options={{ href: null }} />
      <Tabs.Screen name="history/index" options={{ href: null }} />
      <Tabs.Screen name="onboarding/index" options={{ href: null }} />
      <Tabs.Screen name="accept/index" options={{ href: null }} />
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
