import React, { useEffect, useState } from "react";
import { ActivityIndicator, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { useAuth } from "@/lib/supabase/auth";
import { resolveDeliveryHomeRoute } from "@/lib/delivery-company-routing";
import { useRiderRealtime } from "@/lib/hooks/useRiderRealtime";
import { supabase } from "@/lib/supabase/client";
import { useTheme } from "@/lib/theme/provider";
import { typography, radii } from "@/lib/theme/tokens";

export default function DeliveryLayout() {
  const { user, role, roleLoading, loading } = useAuth();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const router = useRouter();
  const [memberActive, setMemberActive] = useState<boolean | null>(null);

  useEffect(() => {
    if (loading || roleLoading || !user?.id) return;
    if (role !== "delivery_company") return;
    resolveDeliveryHomeRoute(user.id, role).then((home) => {
      if (home === "/(delivery-company)") {
        router.replace(home);
      }
    });
  }, [user?.id, role, roleLoading, loading, router]);

  // Initial fetch + realtime refresh of the rider's membership status.
  // When the company deactivates the driver, the realtime channel added
  // in useRiderRealtime.ts fires onUpdate() which re-pulls this row.
  const refreshMember = React.useCallback(() => {
    if (!user?.id) return;
    supabase
      .from("delivery_company_members")
      .select("is_active")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data && typeof (data as { is_active?: boolean }).is_active === "boolean") {
          setMemberActive((data as { is_active: boolean }).is_active);
        }
      });
  }, [user?.id]);

  useEffect(() => {
    refreshMember();
  }, [refreshMember]);

  useRiderRealtime(user?.id, refreshMember);

  if (role === "delivery_company" && (loading || roleLoading)) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (memberActive === false) {
    return (
      <View style={styles.suspendedContainer}>
        <View style={styles.suspendedCard}>
          <Ionicons name="lock-closed-outline" size={48} color="#dc2626" />
          <Text style={styles.suspendedTitle}>Account paused</Text>
          <Text style={styles.suspendedBody}>
            Your delivery company has paused your account. New orders are paused and any open routes have been released back to the queue. Contact your dispatcher to resume deliveries.
          </Text>
          <TouchableOpacity style={styles.suspendedBtn} onPress={refreshMember}>
            <Ionicons name="refresh-outline" size={18} color="#fff" />
            <Text style={styles.suspendedBtnText}>Refresh status</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
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
          href: null,
        }}
      />
      <Tabs.Screen
        name="scan/index"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          title: "Earnings",
          tabBarIcon: ({ color, size }) => <Ionicons name="wallet-outline" size={size} color={color} />,
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

      <Tabs.Screen name="orders/[id]/index" options={{ href: null }} />
      <Tabs.Screen name="pickups/[id]/index" options={{ href: null }} />
      <Tabs.Screen name="store-pickups/index" options={{ href: null }} />
      <Tabs.Screen name="route-map" options={{ href: null }} />
    </Tabs>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    suspendedContainer: {
      flex: 1,
      backgroundColor: colors.background,
      justifyContent: "center",
      paddingHorizontal: 24,
    },
    suspendedCard: {
      backgroundColor: colors.card,
      borderRadius: radii.xl,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 24,
      alignItems: "center",
      gap: 12,
    },
    suspendedTitle: {
      fontSize: typography.fontSizes.xl,
      fontWeight: typography.fontWeights.bold,
      color: colors.foreground,
    },
    suspendedBody: {
      fontSize: typography.fontSizes.sm,
      color: colors.mutedForeground,
      textAlign: "center",
      lineHeight: 20,
    },
    suspendedBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.primary,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: radii.lg,
      marginTop: 8,
    },
    suspendedBtnText: {
      color: "#fff",
      fontWeight: typography.fontWeights.semibold,
    },
  });
}
