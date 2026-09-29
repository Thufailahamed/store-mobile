import React from "react";
import { View, StyleSheet, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { fontFamilies } from "@/lib/theme/fonts";
import { colors, radii, spacing } from "@/lib/theme/tokens";

interface Props {
  onSync: () => void;
  syncing: boolean;
  onExplore?: () => void;
}

const GOLD_DEEP = "#85651b";

const FEATURES: { icon: keyof typeof Ionicons.glyphMap; title: string; desc: string }[] = [
  {
    icon: "cube-outline",
    title: "Automatic order intake",
    desc: "Purchases are instantly archived with garment tags, fabrics, and studio imagery upon arrival.",
  },
  {
    icon: "analytics-outline",
    title: "Cost-per-wear analytics",
    desc: "Log wears effortlessly to track closet utility, staple pieces, and wardrobe ROI over time.",
  },
  {
    icon: "albums-outline",
    title: "Outfit curation",
    desc: "Assemble capsule lookbooks and plan outfits ahead with smart weather recommendations.",
  },
];

export function WardrobeEmptyState({ onSync, syncing, onExplore }: Props) {
  const router = useRouter();

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Ionicons name="shirt-outline" size={26} color={colors.olive[700]} />
        </View>

        <Text style={styles.title}>Your closet is empty</Text>
        <Text style={styles.sub}>
          Pieces from delivered orders appear here automatically. Sync to pull in any recent
          deliveries.
        </Text>

        <TouchableOpacity
          style={[styles.ctaPrimary, syncing && styles.ctaDisabled]}
          onPress={onSync}
          activeOpacity={0.88}
          disabled={syncing}
          accessibilityRole="button"
        >
          <Text style={styles.ctaPrimaryText}>
            {syncing ? "Syncing…" : "Sync delivered orders"}
          </Text>
          <View style={styles.ctaIcon}>
            {syncing ? (
              <ActivityIndicator size="small" color={colors.olive[900]} />
            ) : (
              <Ionicons name="sync" size={15} color={colors.olive[900]} />
            )}
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.ctaSecondary}
          onPress={onExplore ?? (() => router.push("/(main)/account/orders" as any))}
          activeOpacity={0.7}
          hitSlop={6}
        >
          <Text style={styles.ctaSecondaryText}>View order history</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.features}>
        <Text style={styles.eyebrow}>What you get</Text>
        {FEATURES.map((f, i) => (
          <View key={f.title} style={[styles.featureRow, i > 0 && styles.featureDivider]}>
            <View style={styles.featureIcon}>
              <Ionicons name={f.icon} size={16} color={GOLD_DEEP} />
            </View>
            <View style={styles.featureBody}>
              <Text style={styles.featureTitle}>{f.title}</Text>
              <Text style={styles.featureDesc}>{f.desc}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const HAIRLINE = "rgba(22, 23, 15, 0.08)";

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingTop: spacing[2],
    gap: spacing[4],
  },
  card: {
    alignItems: "center",
    backgroundColor: colors.paper.cream,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: HAIRLINE,
    paddingVertical: spacing[8],
    paddingHorizontal: spacing[6],
  },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.paper.warm,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing[4],
  },
  title: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 22,
    letterSpacing: -0.3,
    color: colors.light.foreground,
    textAlign: "center",
  },
  sub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.light.mutedForeground,
    textAlign: "center",
    marginTop: 6,
    maxWidth: 280,
  },
  ctaPrimary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    height: 50,
    paddingLeft: 22,
    paddingRight: 6,
    borderRadius: radii.full,
    backgroundColor: colors.olive[900],
    marginTop: spacing[5],
  },
  ctaDisabled: {
    opacity: 0.85,
  },
  ctaPrimaryText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 14,
    color: colors.paper.cream,
  },
  ctaIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.paper.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaSecondary: {
    marginTop: spacing[3],
    paddingVertical: 4,
  },
  ctaSecondaryText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: colors.light.foreground,
    textDecorationLine: "underline",
  },

  features: {
    backgroundColor: colors.paper.cream,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: HAIRLINE,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    paddingBottom: spacing[2],
  },
  eyebrow: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: GOLD_DEEP,
    marginBottom: spacing[1],
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing[3],
    paddingVertical: spacing[3.5],
  },
  featureDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.light.border,
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(200, 164, 74, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  featureBody: {
    flex: 1,
    gap: 3,
  },
  featureTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13.5,
    color: colors.light.foreground,
  },
  featureDesc: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.light.mutedForeground,
  },
});
