import React from "react";
import { View, StyleSheet, Text, TouchableOpacity } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import type { Store } from "@/lib/types";

interface StoreIdentityCardProps {
  store: Store;
  following: boolean;
  followerCount: number;
  avgRating: number;
  onToggleFollow: () => void;
}

export function StoreIdentityCard({
  store,
  following,
  followerCount,
  avgRating,
  onToggleFollow,
}: StoreIdentityCardProps) {
  const pieces = store.total_products ?? 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.verifiedPill}>
        <Ionicons name="checkmark-circle" size={13} color={colors.olive[600]} />
        <Text style={styles.verifiedText}>VERIFIED BOUTIQUE</Text>
      </View>

      <Text style={styles.name}>{store.name}</Text>

      {store.description ? (
        <Text style={styles.tagline} numberOfLines={2}>
          {store.description}
        </Text>
      ) : null}

      <View style={styles.statsCard}>
        <StatColumn
          icon="people-outline"
          value={String(followerCount)}
          label={followerCount === 1 ? "FOLLOWER" : "FOLLOWERS"}
        />
        <View style={styles.statDivider} />
        <StatColumn icon="cube-outline" value={String(pieces)} label="PIECES" />
        <View style={styles.statDivider} />
        <StatColumn icon="star" value={avgRating.toFixed(1)} label="REVIEWS" />
      </View>

      <TouchableOpacity
        style={[styles.followBtn, following && styles.followBtnActive]}
        onPress={onToggleFollow}
        activeOpacity={0.85}
      >
        <Ionicons
          name={following ? "heart" : "heart-outline"}
          size={17}
          color={following ? colors.olive[700] : "#fff"}
        />
        <Text style={[styles.followText, following && styles.followTextActive]}>
          {following ? "Following" : "Follow boutique"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function StatColumn({
  icon,
  value,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
}) {
  return (
    <View style={styles.statCol}>
      <View style={styles.statValueRow}>
        <Ionicons name={icon} size={15} color={colors.olive[600]} />
        <Text style={styles.statValue}>{value}</Text>
      </View>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    paddingHorizontal: spacing[5],
    paddingTop: spacing[6],
    paddingBottom: spacing[4],
    gap: spacing[3],
  },
  verifiedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: `${colors.light.border}80`,
  },
  verifiedText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 1.2,
    color: colors.light.mutedForeground,
    textTransform: "uppercase",
  },
  name: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.5,
    color: colors.light.foreground,
    textAlign: "center",
  },
  tagline: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.light.mutedForeground,
    textAlign: "center",
    marginTop: -4,
  },
  statsCard: {
    flexDirection: "row",
    alignItems: "stretch",
    width: "100%",
    backgroundColor: colors.light.card,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: `${colors.light.border}90`,
    paddingVertical: spacing[4],
    marginTop: spacing[1],
  },
  statCol: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  statValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  statValue: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 17,
    color: colors.light.foreground,
  },
  statLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9.5,
    letterSpacing: 1,
    color: colors.light.mutedForeground,
    textTransform: "uppercase",
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.light.border,
    marginVertical: 6,
  },
  followBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    height: 50,
    borderRadius: radii.full,
    backgroundColor: colors.olive[700],
    marginTop: spacing[1],
  },
  followBtnActive: {
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: `${colors.olive[600]}40`,
  },
  followText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 15,
    color: "#fff",
    letterSpacing: 0.2,
  },
  followTextActive: {
    color: colors.olive[700],
  },
});
