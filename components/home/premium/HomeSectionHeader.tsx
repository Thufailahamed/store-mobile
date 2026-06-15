import React from "react";
import { View, TouchableOpacity, StyleSheet, Text } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

interface HomeSectionHeaderProps {
  title: string;
  onPress?: () => void;
}

export function HomeSectionHeader({ title, onPress }: HomeSectionHeaderProps) {
  const content = (
    <>
      <Text style={styles.title}>{title}</Text>
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
  title: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 18,
    color: colors.light.foreground,
    letterSpacing: -0.3,
  },
});
