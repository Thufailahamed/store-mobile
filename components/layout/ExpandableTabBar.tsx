import React from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@/components/ui/Icon";
import { useCart, useWishlist } from "@/lib/stores";
import { colors, radii, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

type IonIcon = keyof typeof Ionicons.glyphMap;

interface TabConfig {
  label: string;
  icon: IonIcon;
  iconFocused: IonIcon;
}

const TAB_CONFIG: Record<string, TabConfig> = {
  index: { label: "Home", icon: "home-outline", iconFocused: "home" },
  "products/index": { label: "Shop", icon: "bag-outline", iconFocused: "bag" },
  "search/index": { label: "Search", icon: "search-outline", iconFocused: "search" },
  "wishlist/index": { label: "Wishlist", icon: "heart-outline", iconFocused: "heart" },
  account: { label: "Account", icon: "person-outline", iconFocused: "person" },
};

function TabItem({
  focused,
  label,
  icon,
  iconFocused,
  badge,
  onPress,
  onLongPress,
}: {
  focused: boolean;
  label: string;
  icon: IonIcon;
  iconFocused: IonIcon;
  badge?: number;
  onPress: () => void;
  onLongPress: () => void;
}) {
  return (
    <Pressable
      style={styles.tab}
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityState={focused ? { selected: true } : {}}
      accessibilityLabel={label}
    >
      <View style={[styles.iconPill, focused && styles.iconPillActive]}>
        <Ionicons
          name={focused ? iconFocused : icon}
          size={22}
          color={focused ? colors.light.foreground : colors.light.mutedForeground}
        />
        {!!badge && badge > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText} allowFontScaling={false}>
              {badge > 99 ? "99+" : String(badge)}
            </Text>
          </View>
        ) : null}
      </View>
      <Text
        style={[styles.label, focused && styles.labelActive]}
        numberOfLines={1}
        allowFontScaling={false}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function ExpandableTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const cartCount = useCart((s) => s.itemCount());
  const wishlistCount = useWishlist((s) => s.count());

  const focusedRoute = state.routes[state.index];
  const focusedOptions = descriptors[focusedRoute.key]?.options;
  if (focusedOptions?.tabBarStyle && "display" in focusedOptions.tabBarStyle) {
    if (focusedOptions.tabBarStyle.display === "none") return null;
  }

  const badges: Record<string, number> = {
    "products/index": cartCount,
    "wishlist/index": wishlistCount,
  };

  const visibleRoutes = state.routes.filter((route) => TAB_CONFIG[route.name]);

  return (
    <View
      style={[styles.shell, { bottom: Math.max(insets.bottom, 10) }]}
      pointerEvents="box-none"
    >
      <View style={styles.pill}>
        {visibleRoutes.map((route) => {
          const index = state.routes.indexOf(route);
          const focused = state.index === index;
          const config = TAB_CONFIG[route.name]!;

          return (
            <TabItem
              key={route.key}
              focused={focused}
              label={config.label}
              icon={config.icon}
              iconFocused={config.iconFocused}
              badge={badges[route.name]}
              onPress={() => {
                const event = navigation.emit({
                  type: "tabPress",
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              }}
              onLongPress={() => {
                navigation.emit({ type: "tabLongPress", target: route.key });
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

/** Bottom padding for scroll content to clear the floating tab bar. */
export function expandableTabBarInset(safeBottom: number) {
  // Tab bar bottom position + Tab bar height (64) + extra visual spacing (16)
  return Math.max(safeBottom, 10) + 64 + 16;
}

const styles = StyleSheet.create({
  shell: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 50,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.light.card,
    borderRadius: 9999,
    borderWidth: 1.5,
    borderColor: "rgba(200, 200, 184, 0.9)",
    paddingHorizontal: 6,
    paddingVertical: 6,
    minHeight: 64,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
      },
      android: { elevation: 10 },
    }),
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    gap: 3,
  },
  iconPill: {
    position: "relative",
    minWidth: 52,
    height: 32,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  iconPillActive: {
    backgroundColor: colors.olive[100],
  },
  badge: {
    position: "absolute",
    top: -2,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.light.primary,
    borderWidth: 1.5,
    borderColor: colors.light.card,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: {
    color: colors.light.primaryForeground,
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 9,
    lineHeight: 11,
  },
  label: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 10,
    color: colors.light.mutedForeground,
    letterSpacing: 0.1,
  },
  labelActive: {
    color: colors.light.foreground,
    fontFamily: fontFamilies.sans.semibold,
  },
});
