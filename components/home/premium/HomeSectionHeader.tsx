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
  /**
   * "feature" swaps the header into the editorial grammar (serif display
   * title + rule line) used for curated/spotlight rails, so they read as
   * a different kind of section than plain catalog listing rails.
   */
  variant?: "default" | "feature";
}

export function HomeSectionHeader({
  title,
  onPress,
  kicker,
  accent,
  variant = "default",
}: HomeSectionHeaderProps) {
  const isFeature = variant === "feature";

  const content = (
    <>
      <View style={styles.left}>
        {kicker ? (
          <Text style={[styles.kicker, isFeature && styles.kickerFeature]}>{kicker}</Text>
        ) : null}
        <Text
          style={[
            styles.title,
            isFeature && styles.titleFeature,
            accent && styles.titleAccent,
          ]}
        >
          {title}
        </Text>
      </View>
      {onPress ? (
        <Ionicons name="chevron-forward" size={18} color={colors.light.foreground} />
      ) : null}
    </>
  );

  return (
    <View style={isFeature && styles.featureWrap}>
      {onPress ? (
        <TouchableOpacity
          style={[styles.row, isFeature && styles.rowFeature]}
          onPress={onPress}
          activeOpacity={0.7}
        >
          {content}
        </TouchableOpacity>
      ) : (
        <View style={[styles.row, isFeature && styles.rowFeature]}>{content}</View>
      )}
      {isFeature ? <View style={styles.rule} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  featureWrap: {
    paddingHorizontal: spacing[5],
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[5],
    marginBottom: spacing[3],
  },
  rowFeature: {
    paddingHorizontal: 0,
    marginBottom: spacing[2],
    alignItems: "flex-end",
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
  kickerFeature: {
    color: colors.light.primary,
    letterSpacing: 1.8,
    marginBottom: 1,
  },
  title: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 18,
    color: colors.light.foreground,
    letterSpacing: -0.3,
  },
  titleFeature: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 25,
    letterSpacing: -0.2,
  },
  titleAccent: {
    color: colors.light.primary,
  },
  rule: {
    height: 1,
    backgroundColor: colors.light.border,
    marginTop: spacing[1],
    marginBottom: spacing[4],
  },
});
