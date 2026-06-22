import React from "react";
import { View, StyleSheet } from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { Label } from "@/components/ui/Typography";
import { colors } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

interface TabBarIconProps {
  name: keyof typeof Ionicons.glyphMap;
  nameFocused: keyof typeof Ionicons.glyphMap;
  focused: boolean;
  color: string;
  badge?: number;
}

export function TabBarIcon({ name, nameFocused, focused, color, badge }: TabBarIconProps) {
  return (
    <View style={styles.wrap}>
      <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
        <Ionicons
          name={focused ? nameFocused : name}
          size={20}
          color={focused ? colors.light.primary : color}
          style={focused ? styles.iconActive : undefined}
        />
        {!!badge && badge > 0 && (
          <View style={styles.badge}>
            <Label style={styles.badgeText}>{badge > 99 ? "99+" : String(badge)}</Label>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    height: 32,
  },
  iconWrap: {
    position: "relative",
    width: 48,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapActive: {
    backgroundColor: "rgba(83, 94, 44, 0.08)",
  },
  iconActive: {
    transform: [{ scale: 1.05 }],
  },
  badge: {
    position: "absolute",
    top: -3,
    right: 4,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.accent2.rust,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2.5,
  },
  badgeText: {
    color: "#fff",
    fontSize: 8,
    fontFamily: fontFamilies.mono.medium,
  },
});
