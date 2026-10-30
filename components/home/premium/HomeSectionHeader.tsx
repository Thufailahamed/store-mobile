import React from "react";
import { View, TouchableOpacity, StyleSheet, Text } from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { C } from "@/components/orders/parcel-track";

interface HomeSectionHeaderProps {
  title: string;
  onPress?: () => void;
  kicker?: string;
  accent?: boolean;
  /** Extra control rendered before the action link (e.g. a refresh button). */
  right?: React.ReactNode;
  /** Text of the trailing action link. */
  actionLabel?: string;
}

/**
 * The one section header used by every Home section — same language as the
 * Account screen: spaced mono kicker, bold sans title, olive "See all ›"
 * link. Keep all Home headers on this so the page reads as one system.
 */
export function HomeSectionHeader({ title, onPress, kicker, accent, right, actionLabel = "See all" }: HomeSectionHeaderProps) {
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        {kicker ? <Text style={styles.kicker}>{kicker.toUpperCase()}</Text> : null}
        <Text style={[styles.title, accent && styles.titleAccent]} numberOfLines={1}>
          {title}
        </Text>
      </View>
      {right}
      {onPress ? (
        <TouchableOpacity onPress={onPress} hitSlop={8} style={styles.action} activeOpacity={0.75}>
          <Text style={styles.actionText}>{actionLabel}</Text>
          <Ionicons name="chevron-forward" size={13} color={C.accent} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing[2],
    paddingHorizontal: spacing[5] + 2,
    marginBottom: 12,
  },
  left: {
    flex: 1,
    minWidth: 0,
  },
  kicker: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
    letterSpacing: 1.8,
    color: C.accent,
  },
  title: {
    marginTop: 3,
    fontFamily: fontFamilies.sans.bold,
    fontSize: 20,
    letterSpacing: -0.4,
    color: C.text,
  },
  titleAccent: {
    color: C.accent,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingBottom: 3,
  },
  actionText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13.5,
    color: C.accent,
  },
});
