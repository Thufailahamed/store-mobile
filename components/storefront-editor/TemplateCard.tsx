import React from "react";
import { Pressable, View, Text, StyleSheet } from "react-native";
import { Card } from "@/components/ui/Card";
import { colors, radii, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

interface Props {
  slug: string;
  name: string;
  description?: string;
  onPress: () => void;
}

export function TemplateCard({ slug, name, description, onPress }: Props) {
  return (
    <Pressable onPress={onPress} accessibilityLabel={`Use template ${name}`} accessibilityRole="button">
      <Card style={styles.card}>
        <View style={styles.thumb}>
          <Text style={styles.thumbText}>{name[0]}</Text>
        </View>
        <Text style={styles.name}>{name}</Text>
        {description ? <Text style={styles.desc} numberOfLines={2}>{description}</Text> : null}
        <Text style={styles.slug}>{slug}</Text>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing[3], gap: spacing[2] },
  thumb: {
    height: 96,
    borderRadius: radii.md,
    backgroundColor: colors.light.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  thumbText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes["2xl"],
    color: colors.light.primary,
  },
  name: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.md, color: colors.light.foreground },
  desc: { fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground },
  slug: { fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground },
});
