import React from "react";
import { View, TouchableOpacity, StyleSheet, Text } from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { colors, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

interface HomeSectionHeaderProps {
  title: string;
  onPress?: () => void;
  kicker?: string;
  accent?: boolean;
}

export function HomeSectionHeader({ title, onPress, kicker, accent }: HomeSectionHeaderProps) {
  const content = (
    <>
      <View style={styles.left}>
        {kicker ? <Text style={styles.kicker}>{kicker}</Text> : null}
        <Text style={[styles.title, accent && styles.titleAccent]}>{title}</Text>
      </View>
      {onPress ? (
        <Ionicons name="chevron-forward" size={18} color={colors.light.foreground} />
      ) : null}
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return <View style={styles.row}>{content}</View>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[5],
    marginBottom: spacing[3],
  },
  left: {
    flex: 1,
    gap: 2,
  },
  kicker: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    color: colors.light.mutedForeground,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  title: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 18,
    color: colors.light.foreground,
    letterSpacing: -0.3,
  },
  titleAccent: {
    color: colors.light.primary,
  },
});
