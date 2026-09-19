import React from "react";
import { View, Pressable, StyleSheet, type ViewStyle } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { useTheme } from "@/lib/hooks/useTheme";
import { Display, Body, Label } from "@/components/ui/Typography";
import { fontFamilies } from "@/lib/theme/fonts";
import { colors, spacing, radii, shadows } from "@/lib/theme/tokens";

interface WishlistEmptyStateProps {
  hasBagItems?: boolean;
  style?: ViewStyle;
}

export function WishlistEmptyState({
  hasBagItems,
  style,
}: WishlistEmptyStateProps) {
  const theme = useTheme();
  const router = useRouter();

  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.emptyCard}>
      <View
        style={[
          styles.medallion,
          {
            backgroundColor: `${theme.accent2.rust}1A`,
            borderColor: `${theme.accent2.rust}55`,
          },
        ]}
      >
        <View
          style={[
            styles.medallionInner,
            {
              backgroundColor: theme.colors.card,
              borderColor: `${theme.accent2.rust}66`,
            },
          ]}
        >
          <Ionicons name="heart" size={32} color={theme.accent2.rust} />
        </View>
      </View>

      <Label style={{ color: theme.accent2.rust, marginTop: spacing[7] }}>
        Your Collection
      </Label>
      <Display
        size="3xl"
        italic
        style={{
          textAlign: "center",
          marginTop: 8,
          color: theme.colors.foreground,
        }}
      >
        Nothing saved yet
      </Display>
      <Body
        muted
        size="md"
        style={{
          textAlign: "center",
          marginTop: 10,
          maxWidth: 280,
          lineHeight: 22,
        }}
      >
        Tap the heart on any piece to keep it here — your future self will
        thank you.
      </Body>

      <Pressable
        onPress={() => router.push("/(main)/products")}
        style={({ pressed }) => [
          styles.cta,
          { backgroundColor: theme.olive[700] },
          pressed && { opacity: 0.88 },
        ]}
      >
        <Label style={{ color: "#fff", fontSize: 12 }}>Explore the shop</Label>
        <Ionicons name="arrow-forward" size={16} color="#fff" />
      </Pressable>

      {hasBagItems ? (
        <Pressable
          onPress={() => router.push("/(main)/cart")}
          hitSlop={8}
          style={({ pressed }) => [pressed && { opacity: 0.6 }]}
        >
          <Body
            size="sm"
            style={{
              color: theme.olive[700],
              fontFamily: fontFamilies.display.regular,
              fontStyle: "italic",
              marginTop: 4,
            }}
          >
            or finish what's in your bag →
          </Body>
        </Pressable>
      ) : null}

      <View style={styles.syncNote}>
        <Ionicons name="shield-checkmark-outline" size={14} color={colors.olive[700]} />
        <Body size="xs" style={styles.syncNoteText}>Saved pieces stay with your collection</Body>
      </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[8],
  },
  emptyCard: {
    width: "100%",
    maxWidth: 390,
    alignItems: "center",
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[8],
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: `${colors.olive[700]}18`,
    backgroundColor: colors.paper.cream,
    ...shadows.soft,
  },
  medallion: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  medallionInner: {
    width: 74,
    height: 74,
    borderRadius: 37,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  cta: {
    marginTop: 28,
    minWidth: 236,
    height: 54,
    paddingHorizontal: 28,
    borderRadius: radii.full,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    ...shadows.glow,
  },
  syncNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: spacing[6],
    paddingTop: spacing[4],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.light.border,
    width: "100%",
    justifyContent: "center",
  },
  syncNoteText: {
    color: colors.light.mutedForeground,
    fontFamily: fontFamilies.sans.medium,
  },
});
