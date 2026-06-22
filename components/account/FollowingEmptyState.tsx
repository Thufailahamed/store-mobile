import React from "react";
import { View, Pressable, StyleSheet, type ViewStyle } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { Display, Body, Label } from "@/components/ui/Typography";
import { colors, spacing, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { navigateHome } from "@/lib/navigation";

interface FollowingEmptyStateProps {
  style?: ViewStyle;
}

export function FollowingEmptyState({ style }: FollowingEmptyStateProps) {
  const router = useRouter();

  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.medallion}>
        <View style={styles.medallionInner}>
          <Ionicons name="storefront-outline" size={34} color={colors.olive[600]} />
        </View>
      </View>

      <Label style={styles.eyebrow}>YOUR BOUTIQUES</Label>
      <Display size="3xl" italic style={styles.title}>
        No stores yet
      </Display>
      <Body muted size="md" style={styles.body}>
        Follow boutiques you love to see their latest drops here and never miss a
        new collection.
      </Body>

      <Pressable
        onPress={() => navigateHome(router)}
        style={({ pressed }) => [styles.cta, pressed && { opacity: 0.88 }]}
      >
        <Body style={styles.ctaText}>Discover boutiques</Body>
        <Ionicons name="arrow-forward" size={16} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[12],
  },
  medallion: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: `${colors.olive[600]}14`,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: `${colors.olive[600]}30`,
  },
  medallionInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.light.card,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: `${colors.olive[600]}25`,
  },
  eyebrow: {
    color: colors.olive[600],
    marginTop: spacing[7],
    letterSpacing: 1.2,
  },
  title: {
    textAlign: "center",
    marginTop: 8,
    color: colors.light.foreground,
  },
  body: {
    textAlign: "center",
    marginTop: 10,
    maxWidth: 300,
    lineHeight: 22,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: spacing[8],
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[4],
    borderRadius: radii.full,
    backgroundColor: colors.olive[700],
  },
  ctaText: {
    color: "#fff",
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 15,
  },
});
