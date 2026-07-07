import React from "react";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ExpandableTabBar, expandableTabBarInset } from "@/components/layout/ExpandableTabBar";

const HIDDEN_TAB_BAR = { display: "none" as const };

export default function MainLayout() {
  const insets = useSafeAreaInsets();
  const scenePadding = expandableTabBarInset(insets.bottom);

  return (
    <Tabs
      tabBar={(props) => <ExpandableTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: "transparent" },
        tabBarStyle: {
          position: "absolute",
          backgroundColor: "transparent",
          borderTopWidth: 0,
          elevation: 0,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="products/index" options={{ title: "Shop" }} />
      <Tabs.Screen name="search/index" options={{ title: "Search" }} />
      <Tabs.Screen name="wishlist/index" options={{ title: "Wishlist" }} />
      <Tabs.Screen name="account" options={{ title: "Account", headerShown: false }} />

      <Tabs.Screen name="cart/index" options={{ href: null, tabBarStyle: HIDDEN_TAB_BAR, sceneStyle: { paddingBottom: 0 } }} />
      <Tabs.Screen name="checkout/index" options={{ href: null, tabBarStyle: HIDDEN_TAB_BAR, sceneStyle: { paddingBottom: 0 } }} />
      <Tabs.Screen name="checkout/success" options={{ href: null, tabBarStyle: HIDDEN_TAB_BAR, sceneStyle: { paddingBottom: 0 } }} />
      <Tabs.Screen name="notifications/index" options={{ href: null, tabBarStyle: HIDDEN_TAB_BAR, sceneStyle: { paddingBottom: 0 } }} />
      <Tabs.Screen name="blog/index" options={{ href: null, tabBarStyle: HIDDEN_TAB_BAR, sceneStyle: { paddingBottom: 0 } }} />
      <Tabs.Screen name="blog/[slug]" options={{ href: null, tabBarStyle: HIDDEN_TAB_BAR, sceneStyle: { paddingBottom: 0 } }} />
      <Tabs.Screen name="products/[slug]" options={{ href: null, tabBarStyle: HIDDEN_TAB_BAR, sceneStyle: { paddingBottom: 0 } }} />
      <Tabs.Screen name="account/orders/index" options={{ href: null, tabBarStyle: HIDDEN_TAB_BAR, sceneStyle: { paddingBottom: 0 } }} />
      <Tabs.Screen name="account/orders/[id]" options={{ href: null, tabBarStyle: HIDDEN_TAB_BAR, sceneStyle: { paddingBottom: 0 } }} />
      <Tabs.Screen name="account/orders/[id]/track" options={{ href: null, tabBarStyle: HIDDEN_TAB_BAR, sceneStyle: { paddingBottom: 0 } }} />
      <Tabs.Screen name="account/addresses/index" options={{ href: null, tabBarStyle: HIDDEN_TAB_BAR, sceneStyle: { paddingBottom: 0 } }} />
      <Tabs.Screen name="account/payments/index" options={{ href: null, tabBarStyle: HIDDEN_TAB_BAR, sceneStyle: { paddingBottom: 0 } }} />
      <Tabs.Screen name="account/reviews/index" options={{ href: null, tabBarStyle: HIDDEN_TAB_BAR, sceneStyle: { paddingBottom: 0 } }} />
      <Tabs.Screen name="account/security/index" options={{ href: null, tabBarStyle: HIDDEN_TAB_BAR, sceneStyle: { paddingBottom: 0 } }} />
      <Tabs.Screen name="account/settings/index" options={{ href: null, tabBarStyle: HIDDEN_TAB_BAR, sceneStyle: { paddingBottom: 0 } }} />
      <Tabs.Screen name="account/returns/index" options={{ href: null, tabBarStyle: HIDDEN_TAB_BAR, sceneStyle: { paddingBottom: 0 } }} />
      <Tabs.Screen name="account/returns/[id]" options={{ href: null, tabBarStyle: HIDDEN_TAB_BAR, sceneStyle: { paddingBottom: 0 } }} />
      <Tabs.Screen name="account/notifications/preferences" options={{ href: null, tabBarStyle: HIDDEN_TAB_BAR, sceneStyle: { paddingBottom: 0 } }} />
      <Tabs.Screen name="account/loyalty" options={{ href: null, tabBarStyle: HIDDEN_TAB_BAR, sceneStyle: { paddingBottom: 0 } }} />
    </Tabs>
  );
}
