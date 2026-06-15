import React from "react";
import { View, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Avatar } from "@/components/ui";
import { Label, Body } from "@/components/ui/Typography";
import { colors, spacing, radii, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import type { Store } from "@/lib/types";

interface ProductStoreCardProps {
  store: Store;
}

export function ProductStoreCard({ store }: ProductStoreCardProps) {
  return (
    <View style={styles.card}>
      <Avatar
        name={store.name}
        uri={store.logo_url}
        size={48}
        style={styles.avatar}
      />
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Body size="sm" style={styles.storeName}>{store.name}</Body>
          <View style={styles.verifiedBadge}>
            <Ionicons name="checkmark-circle" size={11} color={colors.olive[600]} />
            <Label style={styles.verifiedText}>Verified</Label>
          </View>
        </View>
        <View style={styles.statsRow}>
          {store.total_reviews > 0 && (
            <>
              <View style={styles.ratingBadge}>
                <Ionicons name="star" size={10} color={colors.accent2.ochre} />
                <Body size="xs" style={styles.ratingText}>{store.rating?.toFixed(1)}</Body>
              </View>
              <View style={styles.miniDot} />
            </>
          )}
          <Body size="xs" muted>{store.total_products} products</Body>
        </View>
      </View>
      <View style={styles.visitLink}>
        <Body size="xs" style={styles.visitText}>Visit</Body>
        <Ionicons name="arrow-forward" size={12} color={colors.olive[600]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    marginHorizontal: spacing[5],
    padding: spacing[4],
    backgroundColor: colors.light.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: `${colors.olive[600]}18`,
    ...shadows.soft,
  },
  avatar: {
    borderRadius: radii.xl,
  },
  info: {
    flex: 1,
    gap: 4,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    flexWrap: "wrap",
  },
  storeName: {
    fontWeight: "600",
    fontFamily: fontFamilies.sans.semibold,
    color: colors.light.foreground,
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: `${colors.olive[600]}10`,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  verifiedText: {
    color: colors.olive[600],
    fontSize: 9,
    fontFamily: fontFamilies.mono.semibold,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  ratingText: {
    color: colors.accent2.ochre,
    fontWeight: "600",
    fontSize: 11,
  },
  miniDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.light.mutedForeground,
  },
  visitLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: `${colors.olive[600]}08`,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  visitText: {
    color: colors.olive[600],
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9.5,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
});
