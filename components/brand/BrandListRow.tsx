import React from "react";
import { View, Text, Pressable, StyleSheet, type ViewStyle } from "react-native";
import { colors, typography, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { Badge } from "@/components/ui/Badge";
import type { BadgeVariant } from "@/components/ui/Badge";

export type BrandListStatus =
  | "active"
  | "draft"
  | "pending"
  | "archived"
  | "approved"
  | "rejected"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "paused"
  | "completed"
  | "invited";

interface BrandListRowProps {
  index?: number;
  title: string;
  subtitle?: string;
  meta?: string;
  right?: React.ReactNode;
  status?: BrandListStatus;
  onPress?: () => void;
  style?: ViewStyle;
}

const statusVariant: Record<BrandListStatus, BadgeVariant> = {
  active: "default",
  approved: "default",
  shipped: "default",
  delivered: "default",
  completed: "default",
  draft: "secondary",
  archived: "secondary",
  pending: "outline",
  invited: "outline",
  paused: "outline",
  rejected: "destructive",
  cancelled: "destructive",
};

export function BrandListRow({
  index,
  title,
  subtitle,
  meta,
  right,
  status,
  onPress,
  style,
}: BrandListRowProps) {
  const Container: any = onPress ? Pressable : View;
  return (
    <Container onPress={onPress as any} style={[styles.row, style]}>
      {index !== undefined ? <Text style={styles.index}>{String(index).padStart(2, "0")}</Text> : null}
      <View style={styles.middle}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
        {meta ? <Text style={styles.meta} numberOfLines={1}>{meta}</Text> : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
      {status ? (
        <Badge variant={statusVariant[status]} style={styles.badge}>
          {status}
        </Badge>
      ) : null}
    </Container>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: colors.light.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.light.border,
    borderRadius: 0,
  },
  index: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    width: 24,
    textAlign: "right",
  },
  middle: { flex: 1, gap: 2 },
  title: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.base,
    color: colors.light.foreground,
  },
  subtitle: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
  },
  meta: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    letterSpacing: typography.letterSpacing.wide,
  },
  right: { alignItems: "flex-end" },
  badge: { marginLeft: 6 },
});
