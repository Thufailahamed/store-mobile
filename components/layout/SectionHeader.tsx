import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Display, Label, Body } from "@/components/ui/Typography";
import { colors, spacing } from "@/lib/theme/tokens";

interface SectionHeaderProps {
  kicker?: string;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function SectionHeader({
  kicker,
  title,
  subtitle,
  actionLabel,
  onAction,
}: SectionHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.titles}>
          {kicker ? <Label style={styles.kicker}>{kicker}</Label> : null}
          <Display size="2xl">{title}</Display>
          {subtitle ? <Body muted size="sm" style={styles.subtitle}>{subtitle}</Body> : null}
        </View>
        {actionLabel && onAction ? (
          <TouchableOpacity onPress={onAction} activeOpacity={0.7}>
            <Label style={styles.action}>{actionLabel}</Label>
          </TouchableOpacity>
        ) : null}
      </View>
      <View style={styles.rule} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing[4],
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: spacing[3],
    marginBottom: spacing[3],
  },
  titles: {
    flex: 1,
    gap: spacing[1],
  },
  kicker: {
    color: colors.light.primary,
    marginBottom: spacing[1],
  },
  subtitle: {
    marginTop: spacing[1],
  },
  action: {
    color: colors.light.primary,
    marginBottom: spacing[1],
  },
  rule: {
    height: 1,
    backgroundColor: colors.light.border,
  },
});
