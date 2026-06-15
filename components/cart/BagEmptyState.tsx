import React from "react";
import { View, Pressable, StyleSheet, type ViewStyle } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "@/lib/hooks/useTheme";
import { Display, Body, Label } from "@/components/ui/Typography";
import { fontFamilies } from "@/lib/theme/fonts";
import { typography, spacing, radii } from "@/lib/theme/tokens";

interface BagEmptyStateProps {
  hasWishlistItems?: boolean;
  style?: ViewStyle;
}

export function BagEmptyState({ hasWishlistItems, style }: BagEmptyStateProps) {
  const theme = useTheme();
  const router = useRouter();

  return (
    <View style={[styles.wrap, style]}>
      <View
        style={[
          styles.medallion,
          {
            backgroundColor: `${theme.olive[600]}1A`,
            borderColor: `${theme.olive[600]}44`,
          },
        ]}
      >
        <View
          style={[
            styles.medallionInner,
            {
              backgroundColor: theme.colors.card,
              borderColor: `${theme.olive[600]}55`,
            },
          ]}
        >
          <Ionicons
            name="bag-add-outline"
            size={34}
            color={theme.olive[700]}
          />
        </View>
      </View>

      <Label style={{ color: theme.olive[600], marginTop: 28 }}>
        The Atelier
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
        Your bag awaits
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
        Curate a selection from the atelier — every piece arrives hand‑finished
        and ready to wear.
      </Body>

      <Pressable
        onPress={() => router.push("/(main)/products")}
        style={({ pressed }) => [
          styles.cta,
          { backgroundColor: theme.olive[700] },
          pressed && { opacity: 0.88 },
        ]}
      >
        <Label style={{ color: "#fff", fontSize: 12 }}>Browse the shop</Label>
        <Ionicons name="arrow-forward" size={16} color="#fff" />
      </Pressable>

      {hasWishlistItems ? (
        <Pressable
          onPress={() => router.push("/(main)/wishlist")}
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
            or revisit your saved pieces →
          </Body>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingTop: 60,
    paddingBottom: 100,
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
