import React from "react";
import { View, Pressable, StyleSheet, type ViewStyle } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "@/lib/hooks/useTheme";
import { Display, Body, Label } from "@/components/ui/Typography";
import { fontFamilies } from "@/lib/theme/fonts";
import { typography, spacing, radii } from "@/lib/theme/tokens";

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
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[10],
  },
  medallion: {
    width: 132,
    height: 132,
    borderRadius: 66,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  medallionInner: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  cta: {
    marginTop: 32,
    height: 56,
    paddingHorizontal: 28,
    borderRadius: radii.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
});
