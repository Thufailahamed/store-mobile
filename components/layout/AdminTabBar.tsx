import React, { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, type LayoutChangeEvent } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useQuery } from "@tanstack/react-query";
import { Ionicons, type IonIconName } from "@/components/ui/Icon";
import { getAdminOverviewStats } from "@/lib/api";
import { colors } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { C } from "@/components/orders/parcel-track";

const TABS: { name: string; label: string; icon: IonIconName; iconActive: IonIconName }[] = [
  { name: "index", label: "Overview", icon: "grid-outline", iconActive: "grid" },
  { name: "approvals/index", label: "Approvals", icon: "shield-checkmark-outline", iconActive: "shield-checkmark" },
  { name: "orders/index", label: "Orders", icon: "receipt-outline", iconActive: "receipt" },
  { name: "catalogue/index", label: "Catalogue", icon: "cube-outline", iconActive: "cube" },
  { name: "more/index", label: "More", icon: "apps-outline", iconActive: "apps" },
];

const BAR_PADDING = 6;
const SPRING = { damping: 18, stiffness: 180, mass: 0.7 };
const INACTIVE = "rgba(250,248,241,0.6)";

export function AdminTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [barWidth, setBarWidth] = useState(0);
  const tabWidth = barWidth > 0 ? (barWidth - BAR_PADDING * 2) / TABS.length : 0;

  const currentName = state.routes[state.index]?.name;
  const activeIndex = TABS.findIndex((t) => t.name === currentName);

  const statsQ = useQuery({
    queryKey: ["admin-overview", "stats"],
    queryFn: async () => {
      const r = await getAdminOverviewStats();
      return r.ok ? r.data : null;
    },
    refetchInterval: 30_000,
  });
  const s = statsQ.data;
  const pendingTotal = (s?.pendingStores ?? 0) + (s?.pendingBrands ?? 0) + (s?.pendingProducts ?? 0);

  const x = useSharedValue(0);
  const visible = useSharedValue(0);

  useEffect(() => {
    if (!tabWidth) return;
    if (activeIndex >= 0) {
      x.value = visible.value ? withSpring(activeIndex * tabWidth, SPRING) : activeIndex * tabWidth;
      visible.value = withTiming(1, { duration: 180 });
    } else {
      visible.value = withTiming(0, { duration: 180 });
    }
  }, [activeIndex, tabWidth, x, visible]);

  const indicatorStyle = useAnimatedStyle(() => ({
    opacity: visible.value,
    transform: [{ translateX: x.value }, { scale: 0.9 + visible.value * 0.1 }],
  }));

  const onLayout = (e: LayoutChangeEvent) => setBarWidth(e.nativeEvent.layout.width);

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom - 8, 12) }]}>
      <View style={styles.shadow}>
        <View style={styles.bar} onLayout={onLayout}>
          <View pointerEvents="none" style={styles.sheen} />

          {tabWidth > 0 && (
            <Animated.View
              pointerEvents="none"
              style={[styles.indicator, { width: tabWidth }, indicatorStyle]}
            >
              <View style={styles.indicatorFill} />
            </Animated.View>
          )}

          {TABS.map((tab, i) => {
            const route = state.routes.find((r) => r.name === tab.name);
            if (!route) return null;
            const focused = i === activeIndex;
            const tint = focused ? C.ink : INACTIVE;
            const badge = tab.name === "approvals/index" && pendingTotal > 0 ? pendingTotal : 0;

            const onPress = () => {
              const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
            };
            const onLongPress = () => navigation.emit({ type: "tabLongPress", target: route.key });

            return (
              <Pressable
                key={route.key}
                onPress={onPress}
                onLongPress={onLongPress}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={badge ? `${tab.label}, ${badge} pending` : tab.label}
                style={({ pressed }) => [styles.tab, pressed && !focused && styles.tabPressed]}
                hitSlop={4}
              >
                <View>
                  <Ionicons name={focused ? tab.iconActive : tab.icon} size={20} color={tint} />
                  {badge > 0 && (
                    <View style={[styles.badge, focused && styles.badgeOnActive]}>
                      <Text style={styles.badgeText}>{badge > 99 ? "99+" : badge}</Text>
                    </View>
                  )}
                </View>
                <Text
                  numberOfLines={1}
                  style={[styles.label, { color: tint }, focused && styles.labelActive]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 14,
    paddingTop: 8,
    backgroundColor: C.paper,
  },
  shadow: {
    borderRadius: 30,
    shadowColor: C.ink,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 12,
  },
  bar: {
    flexDirection: "row",
    alignItems: "stretch",
    height: 66,
    padding: BAR_PADDING,
    borderRadius: 30,
    backgroundColor: C.ink,
    overflow: "hidden",
  },
  sheen: {
    position: "absolute",
    top: 0,
    left: 24,
    right: 24,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(250,248,241,0.18)",
  },
  indicator: {
    position: "absolute",
    top: BAR_PADDING,
    bottom: BAR_PADDING,
    left: BAR_PADDING,
    borderRadius: 24,
  },
  indicatorFill: {
    flex: 1,
    borderRadius: 24,
    backgroundColor: C.lime,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderRadius: 24,
  },
  tabPressed: {
    backgroundColor: "rgba(250,248,241,0.06)",
  },
  label: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 10,
    letterSpacing: 0.2,
  },
  labelActive: {
    fontFamily: fontFamilies.sans.bold,
  },
  badge: {
    position: "absolute",
    top: -6,
    right: -11,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent2.rust,
    borderWidth: 2,
    borderColor: C.ink,
  },
  badgeOnActive: {
    borderColor: C.lime,
  },
  badgeText: {
    color: colors.paper.cream,
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    lineHeight: 11,
  },
});
