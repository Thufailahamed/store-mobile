import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui";
import { Label, Body } from "@/components/ui/Typography";
import { spacing, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import type { Store } from "@/lib/types";

const INK = "#141414";
const MUTED = "#6b6b6b";

interface ProductStoreCardProps {
  store: Store;
}

export function ProductStoreCard({ store }: ProductStoreCardProps) {
  const router = useRouter();
  const handlePress = () => {
    if (!store.slug) return;
    router.push({
      pathname: "/(main)/stores/[slug]",
      params: { slug: store.slug, id: store.id },
    });
  };
  const hasRating = store.total_reviews > 0;
  const hasProducts = store.total_products > 0;

  return (
    <Pressable
      style={({ pressed }) => [styles.shadow, pressed && { transform: [{ scale: 0.985 }], opacity: 0.95 }]}
      onPress={handlePress}
      disabled={!store.slug}
      accessibilityRole="button"
      accessibilityLabel={`Visit ${store.name}`}
    >
      <View style={styles.card}>
        <View style={styles.topRow}>
          <View style={styles.avatarRing}>
            <Avatar name={store.name} uri={store.logo_url} size={52} style={styles.avatar} />
          </View>
          <View style={styles.info}>
            <Label style={styles.soldBy}>SOLD BY</Label>
            <View style={styles.nameRow}>
              <Body style={styles.storeName} numberOfLines={1}>{store.name}</Body>
              <Ionicons name="checkmark-circle" size={15} color={INK} />
            </View>
            <Body size="xs" style={styles.verifiedText}>Verified seller</Body>
          </View>
          <View style={styles.visitBtn}>
            <Body size="xs" style={styles.visitText}>Visit</Body>
            <Ionicons name="arrow-forward" size={13} color="#ffffff" />
          </View>
        </View>

        {(hasRating || hasProducts) && (
          <View style={styles.statsRow}>
            {hasRating && (
              <View style={styles.stat}>
                <View style={styles.statValueRow}>
                  <Ionicons name="star" size={12} color={INK} />
                  <Body style={styles.statValue}>{store.rating?.toFixed(1)}</Body>
                </View>
                <Body size="xs" style={styles.statLabel}>{store.total_reviews} reviews</Body>
              </View>
            )}
            {hasRating && hasProducts && <View style={styles.statDivider} />}
            {hasProducts && (
              <View style={styles.stat}>
                <Body style={styles.statValue}>{store.total_products}</Body>
                <Body size="xs" style={styles.statLabel}>
                  {store.total_products === 1 ? "Product" : "Products"}
                </Body>
              </View>
            )}
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shadow: {
    marginHorizontal: spacing[4],
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 22,
    elevation: 3,
  },
  card: {
    padding: spacing[4],
    gap: spacing[4],
    backgroundColor: "#ffffff",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
  },
  avatarRing: {
    padding: 2,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
  },
  avatar: {
    borderRadius: 16,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  soldBy: {
    color: MUTED,
    fontSize: 9.5,
    letterSpacing: 1.8,
    fontFamily: fontFamilies.sans.bold,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  storeName: {
    flexShrink: 1,
    fontFamily: fontFamilies.display.semibold,
    fontSize: 18,
    letterSpacing: -0.2,
    color: INK,
  },
  verifiedText: {
    color: MUTED,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11.5,
  },
  visitBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: INK,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radii.full,
  },
  visitText: {
    color: "#ffffff",
    fontFamily: fontFamilies.sans.bold,
    fontSize: 12,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing[3],
    borderRadius: 16,
    backgroundColor: "#f6f6f4",
  },
  stat: {
    flex: 1,
    alignItems: "center",
    gap: 1,
  },
  statValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statValue: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 15,
    color: INK,
  },
  statLabel: {
    color: MUTED,
    fontSize: 11,
    fontFamily: fontFamilies.sans.regular,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
    backgroundColor: "rgba(0,0,0,0.12)",
  },
});
