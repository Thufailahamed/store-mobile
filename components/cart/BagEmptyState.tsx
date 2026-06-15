import React from "react";
import { View, Pressable, StyleSheet, type ViewStyle } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/lib/hooks/useTheme";
import { Body, Label } from "@/components/ui/Typography";
import { fontFamilies } from "@/lib/theme/fonts";
import { spacing, radii, shadows } from "@/lib/theme/tokens";

interface BagEmptyStateProps {
  hasWishlistItems?: boolean;
  style?: ViewStyle;
}

const PERKS = [
  { icon: "car-outline" as const, label: "Free shipping" },
  { icon: "refresh-outline" as const, label: "Easy returns" },
  { icon: "shield-checkmark-outline" as const, label: "Secure checkout" },
];

export function BagEmptyState({ hasWishlistItems, style }: BagEmptyStateProps) {
  const theme = useTheme();
  const router = useRouter();

  return (
    <View style={[styles.wrap, style]}>
      <View style={[styles.heroCard, shadows.soft]}>
        <LinearGradient
          colors={[theme.colors.card, theme.olive[50], `${theme.olive[100]}88`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroGradient}
        >
          <View style={[styles.decorA, { backgroundColor: `${theme.olive[300]}44` }]} />
          <View style={[styles.decorB, { backgroundColor: `${theme.olive[200]}66` }]} />

          <View
            style={[
              styles.iconRing,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <View style={[styles.iconCore, { backgroundColor: theme.olive[50] }]}>
              <Ionicons name="bag-outline" size={36} color={theme.olive[700]} />
            </View>
          </View>

          <Label style={[styles.kicker, { color: theme.olive[600] }]}>My bag</Label>
          <Label style={[styles.title, { color: theme.colors.foreground }]}>
            Nothing here yet
          </Label>
          <Body
            muted
            size="sm"
            style={[styles.subtitle, { color: theme.colors.mutedForeground }]}
          >
            Discover pieces you love and add them here. Your selections stay saved until
            you are ready to checkout.
          </Body>

          <Pressable
            onPress={() => router.push("/(main)/products")}
            style={({ pressed }) => [
              styles.primaryBtn,
              { backgroundColor: theme.colors.foreground },
              pressed && styles.pressed,
            ]}
          >
            <Label style={styles.primaryBtnText}>Start shopping</Label>
            <Ionicons name="arrow-forward" size={16} color={theme.colors.card} />
          </Pressable>

          {hasWishlistItems ? (
            <Pressable
              onPress={() => router.push("/(main)/wishlist")}
              style={({ pressed }) => [
                styles.secondaryBtn,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: theme.colors.border,
                },
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name="heart-outline" size={16} color={theme.olive[700]} />
              <Label style={[styles.secondaryBtnText, { color: theme.colors.foreground }]}>
                View saved items
              </Label>
            </Pressable>
          ) : null}
        </LinearGradient>
      </View>

      <View style={styles.perks}>
        {PERKS.map((perk) => (
          <View key={perk.label} style={styles.perkItem}>
            <View style={[styles.perkIcon, { backgroundColor: theme.olive[50] }]}>
              <Ionicons name={perk.icon} size={14} color={theme.olive[600]} />
            </View>
            <Label style={[styles.perkLabel, { color: theme.colors.mutedForeground }]}>
              {perk.label}
            </Label>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[8],
  },
  heroCard: {
    borderRadius: radii["3xl"],
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(200, 200, 184, 0.5)",
  },
  heroGradient: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[8],
    paddingBottom: spacing[6],
    alignItems: "center",
    overflow: "hidden",
  },
  decorA: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    top: -40,
    right: -30,
  },
  decorB: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    bottom: -20,
    left: -20,
  },
  iconRing: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing[5],
    ...shadows.soft,
  },
  iconCore: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  kicker: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: spacing[2],
  },
  title: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 26,
    letterSpacing: -0.5,
    textAlign: "center",
    marginBottom: spacing[2],
  },
  subtitle: {
    textAlign: "center",
    lineHeight: 21,
    maxWidth: 300,
    marginBottom: spacing[6],
  },
  primaryBtn: {
    alignSelf: "stretch",
    height: 52,
    borderRadius: radii.full,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[2],
    marginBottom: spacing[3],
  },
  primaryBtnText: {
    color: "#faf8f1",
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 15,
  },
  secondaryBtn: {
    alignSelf: "stretch",
    height: 48,
    borderRadius: radii.full,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[2],
  },
  secondaryBtnText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  perks: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing[6],
    paddingHorizontal: spacing[1],
    gap: spacing[2],
  },
  perkItem: {
    flex: 1,
    alignItems: "center",
    gap: spacing[2],
  },
  perkIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  perkLabel: {
    fontSize: 10,
    textAlign: "center",
    lineHeight: 13,
  },
});
