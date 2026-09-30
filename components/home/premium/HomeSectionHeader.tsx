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
  /** Extra control rendered before the chevron (e.g. a refresh button). */
  right?: React.ReactNode;
}

/**
 * The one section header used by every Home section: mono kicker, serif
 * display title, optional chevron. Keep all Home headers on this so the
 * page reads as one publication instead of a mix of type styles.
 */
export function HomeSectionHeader({ title, onPress, kicker, accent, right }: HomeSectionHeaderProps) {
  const titleBlock = (
    <View style={styles.left}>
      {kicker ? <Text style={styles.kicker}>{kicker}</Text> : null}
      <Text style={[styles.title, accent && styles.titleAccent]} numberOfLines={1}>
        {title}
      </Text>
    </View>
  );

  return (
    <View style={styles.row}>
      {onPress ? (
        <TouchableOpacity style={styles.pressable} onPress={onPress} activeOpacity={0.7}>
          {titleBlock}
          {right}
          <View style={styles.chevron}>
            <Ionicons name="chevron-forward" size={16} color={colors.light.foreground} />
          </View>
        </TouchableOpacity>
      ) : (
        <View style={styles.pressable}>
          {titleBlock}
          {right}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: spacing[5],
    marginBottom: spacing[3.5],
  },
  pressable: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing[2],
  },
  left: {
    flex: 1,
    gap: 3,
  },
  kicker: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    color: colors.light.primary,
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  title: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 23,
    lineHeight: 28,
    color: colors.light.foreground,
    letterSpacing: -0.2,
  },
  titleAccent: {
    color: colors.light.primary,
  },
  chevron: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.light.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 1,
  },
});
