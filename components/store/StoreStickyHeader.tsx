import React from "react";
import { Animated, StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { Body, MonoLabel } from "@/components/ui/Typography";
import { colors, spacing, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

interface StoreStickyHeaderProps {
  storeName: string;
  scrollY: Animated.Value;
  showAt?: number;
  onBack: () => void;
  following: boolean;
  onToggleFollow: () => void;
}

export function StoreStickyHeader({
  storeName,
  scrollY,
  showAt = 220,
  onBack,
  following,
  onToggleFollow,
}: StoreStickyHeaderProps) {
  const bg = scrollY.interpolate({
    inputRange: [showAt, showAt + 40],
    outputRange: ["rgba(245,244,239,0)", "rgba(245,244,239,0.96)"],
    extrapolate: "clamp",
  });
  const border = scrollY.interpolate({
    inputRange: [showAt, showAt + 40],
    outputRange: ["rgba(83,94,44,0)", "rgba(83,94,44,0.12)"],
    extrapolate: "clamp",
  });
  const contentOpacity = scrollY.interpolate({
    inputRange: [showAt, showAt + 30],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        { backgroundColor: bg, borderBottomColor: border },
      ]}
    >
      <View style={styles.row}>
        <TouchableOpacity style={styles.iconBtn} onPress={onBack} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={18} color={colors.light.foreground} />
        </TouchableOpacity>
        <Animated.View style={[styles.titleWrap, { opacity: contentOpacity }]}>
          <MonoLabel style={styles.label}>BOUTIQUE</MonoLabel>
          <Body numberOfLines={1} style={styles.title}>
            {storeName}
          </Body>
        </Animated.View>
        <TouchableOpacity
          style={[styles.followChip, following && styles.followChipActive]}
          onPress={onToggleFollow}
          activeOpacity={0.85}
        >
          <Animated.View style={{ opacity: contentOpacity, flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Ionicons
              name={following ? "heart" : "add"}
              size={13}
              color={following ? colors.olive[700] : "#fff"}
            />
            <Body
              size="xs"
              style={{
                color: following ? colors.olive[700] : "#fff",
                fontFamily: fontFamilies.sans.semibold,
                fontSize: 11,
                letterSpacing: 0.4,
              }}
            >
              {following ? "Following" : "Follow"}
            </Body>
          </Animated.View>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 48,
    paddingBottom: 10,
    paddingHorizontal: spacing[4],
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 50,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    backgroundColor: colors.light.card,
    alignItems: "center",
    justifyContent: "center",
  },
  titleWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 8.5,
    letterSpacing: 1.4,
    color: colors.olive[600],
  },
  title: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: colors.light.foreground,
  },
  followChip: {
    paddingHorizontal: 12,
    height: 32,
    borderRadius: radii.full,
    backgroundColor: colors.olive[700],
    alignItems: "center",
    justifyContent: "center",
  },
  followChipActive: {
    backgroundColor: `${colors.olive[600]}15`,
    borderWidth: 1,
    borderColor: `${colors.olive[600]}30`,
  },
});
