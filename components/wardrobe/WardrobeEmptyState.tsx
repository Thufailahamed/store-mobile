import React from "react";
import { View, StyleSheet, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { fontFamilies } from "@/lib/theme/fonts";
import { radii, shadows, spacing } from "@/lib/theme/tokens";

interface Props {
  onSync: () => void;
  syncing: boolean;
  onExplore?: () => void;
}

export function WardrobeEmptyState({ onSync, syncing, onExplore }: Props) {
  const router = useRouter();

  return (
    <View style={styles.wrap}>
      {/* Luxury Medallion */}
      <View style={styles.medallionWrap}>
        <View style={styles.medallionGlow} />
        <View style={styles.medallionOuter}>
          <View style={styles.medallionInner}>
            <Ionicons name="shirt-outline" size={32} color="#C8A44A" />
          </View>
        </View>
      </View>

      <Text style={styles.title}>Your Closet is Empty</Text>
      <Text style={styles.sub}>
        Items from delivered orders populate automatically. You can also sync newly completed deliveries with a single tap.
      </Text>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.ctaPrimary}
          onPress={onSync}
          activeOpacity={0.88}
          disabled={syncing}
        >
          {syncing ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              <Ionicons name="sync-outline" size={15} color="#ffffff" />
              <Text style={styles.ctaPrimaryText}>SYNC DELIVERED ORDERS</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.ctaSecondary}
          onPress={onExplore ?? (() => router.push("/(main)/account/orders" as any))}
          activeOpacity={0.8}
        >
          <Text style={styles.ctaSecondaryText}>View Order History</Text>
          <Ionicons name="arrow-forward" size={13} color="#85651b" />
        </TouchableOpacity>
      </View>

      {/* 3 Value Intelligence Cards */}
      <View style={styles.featuresCard}>
        <View style={styles.featuresHeader}>
          <Ionicons name="sparkles" size={12} color="#85651b" />
          <Text style={styles.featuresEyebrow}>WARDROBE INTELLIGENCE</Text>
        </View>

        <View style={styles.featureItem}>
          <View style={styles.featureIconBox}>
            <Ionicons name="cube-outline" size={15} color="#85651b" />
          </View>
          <View style={styles.featureContent}>
            <Text style={styles.featureHeading}>Automatic Order Intake</Text>
            <Text style={styles.featureDesc}>
              Purchases are instantly archived with garment tags, fabrics, and studio imagery upon arrival.
            </Text>
          </View>
        </View>

        <View style={styles.featureItem}>
          <View style={styles.featureIconBox}>
            <Ionicons name="analytics-outline" size={15} color="#85651b" />
          </View>
          <View style={styles.featureContent}>
            <Text style={styles.featureHeading}>Cost-Per-Wear Analytics</Text>
            <Text style={styles.featureDesc}>
              Log wears effortlessly to track closet utility, staple pieces, and wardrobe ROI over time.
            </Text>
          </View>
        </View>

        <View style={styles.featureItem}>
          <View style={styles.featureIconBox}>
            <Ionicons name="albums-outline" size={15} color="#85651b" />
          </View>
          <View style={styles.featureContent}>
            <Text style={styles.featureHeading}>Runway Outfit Curation</Text>
            <Text style={styles.featureDesc}>
              Assemble capsule lookbooks and plan outfits ahead with smart weather recommendations.
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing[5],
    paddingVertical: 24,
    alignItems: "center",
    gap: 16,
  },
  medallionWrap: {
    width: 80,
    height: 80,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    marginBottom: 4,
  },
  medallionGlow: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(200, 164, 74, 0.12)",
  },
  medallionOuter: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.35)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    ...shadows.soft,
  },
  medallionInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(200, 164, 74, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 22,
    color: "#181b12",
    textAlign: "center",
    letterSpacing: -0.2,
  },
  sub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    color: "#6b6b6b",
    textAlign: "center",
    lineHeight: 19,
    maxWidth: 300,
    marginTop: -8,
  },
  actions: {
    width: "100%",
    maxWidth: 320,
    gap: 10,
    marginTop: 4,
  },
  ctaPrimary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#181b12",
    paddingVertical: 13,
    borderRadius: radii.full,
    ...shadows.soft,
  },
  ctaPrimaryText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 11,
    color: "#ffffff",
    letterSpacing: 1.2,
  },
  ctaSecondary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 8,
  },
  ctaSecondaryText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 11.5,
    color: "#85651b",
    letterSpacing: 0.5,
  },

  /* Features Box */
  featuresCard: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: spacing[5],
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.08)",
    ...shadows.soft,
    gap: 14,
    marginTop: 8,
  },
  featuresHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: -4,
  },
  featuresEyebrow: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9.5,
    color: "#85651b",
    letterSpacing: 1.2,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  featureIconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(200, 164, 74, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.25)",
  },
  featureContent: {
    flex: 1,
    gap: 2,
  },
  featureHeading: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: "#181b12",
  },
  featureDesc: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11.5,
    color: "#6b6b6b",
    lineHeight: 16,
  },
});
