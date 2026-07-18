import React from "react";
import { View, StyleSheet, TouchableOpacity, Dimensions, Animated, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@/components/ui/Icon";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

// Fallback for any external consumer that needs a static height before the
// component mounts. The component itself recomputes this reactively via
// useWindowDimensions() below.
const { width: INITIAL_SCREEN_WIDTH } = Dimensions.get("window");
export const STORE_HERO_HEIGHT = Math.round(INITIAL_SCREEN_WIDTH * (10 / 16));

interface StoreHeroProps {
  bannerUrl?: string;
  logoUrl?: string;
  storeName: string;
  scrollY: Animated.Value;
  onBack: () => void;
  onShare: () => void;
  onMessage?: () => void;
}

export function StoreHero({
  bannerUrl,
  logoUrl,
  storeName,
  scrollY,
  onBack,
  onShare,
  onMessage,
}: StoreHeroProps) {
  const { width: screenWidth } = useWindowDimensions();
  const heroHeight = Math.round(screenWidth * (10 / 16));

  const translateY = scrollY.interpolate({
    inputRange: [-heroHeight, 0, heroHeight],
    outputRange: [heroHeight / 2, 0, -heroHeight / 3],
    extrapolate: "clamp",
  });
  const scale = scrollY.interpolate({
    inputRange: [-heroHeight, 0],
    outputRange: [1.4, 1],
    extrapolate: "clamp",
  });
  const overlayOpacity = scrollY.interpolate({
    inputRange: [0, heroHeight * 0.6],
    outputRange: [0.55, 0.85],
    extrapolate: "clamp",
  });

  return (
    <View style={[styles.wrap, { height: heroHeight }]}>
      <Animated.View style={[styles.imageWrap, { transform: [{ translateY }, { scale }] }]}>
        {bannerUrl ? (
          <Image
            source={{ uri: bannerUrl }}
            style={styles.image}
            contentFit="cover"
            transition={300}
          />
        ) : (
          <View style={[styles.image, styles.placeholder]}>
            <Ionicons name="image-outline" size={32} color={colors.olive[200]} />
          </View>
        )}
        <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]} />
      </Animated.View>
      <LinearGradient
        colors={["transparent", "rgba(22,23,15,0.35)", "rgba(22,23,15,0.7)"]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={styles.topRow} pointerEvents="box-none">
        <TouchableOpacity style={styles.iconBtn} onPress={onBack} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={20} color={colors.light.foreground} />
        </TouchableOpacity>
        <View style={styles.rightCluster}>
          {onMessage ? (
            <TouchableOpacity style={styles.iconBtn} onPress={onMessage} activeOpacity={0.8}>
              <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.light.foreground} />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={styles.iconBtn} onPress={onShare} activeOpacity={0.8}>
            <Ionicons name="share-outline" size={18} color={colors.light.foreground} />
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.logoAnchor} pointerEvents="none">
        <View style={styles.logoRing}>
          {logoUrl ? (
            <Image source={{ uri: logoUrl }} style={styles.logo} contentFit="cover" transition={200} />
          ) : (
            <View style={[styles.logo, styles.logoFallback]}>
              <Ionicons name="storefront" size={28} color={colors.olive[600]} />
            </View>
          )}
        </View>
        <View style={styles.logoAccent} />
      </View>
      <View style={styles.namePlaque} pointerEvents="none">
        <Animated.Text style={styles.boutiqueLabel} numberOfLines={1}>
          {`BOUTIQUE · ${storeName.toUpperCase()}`}
        </Animated.Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    overflow: "hidden",
    backgroundColor: colors.olive[900],
  },
  imageWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  placeholder: {
    backgroundColor: colors.olive[800],
    alignItems: "center",
    justifyContent: "center",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
  },
  topRow: {
    position: "absolute",
    top: spacing[12],
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[5],
  },
  rightCluster: {
    flexDirection: "row",
    gap: spacing[2],
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: radii.full,
    backgroundColor: "rgba(250,248,241,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  logoAnchor: {
    position: "absolute",
    bottom: -spacing[8],
    left: spacing[5],
  },
  logoRing: {
    width: 76,
    height: 76,
    borderRadius: 20,
    padding: 3,
    backgroundColor: colors.light.card,
    ...{
      shadowColor: "#16170f",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.18,
      shadowRadius: 14,
    },
    elevation: 8,
  },
  logo: {
    width: "100%",
    height: "100%",
    borderRadius: 17,
  },
  logoFallback: {
    backgroundColor: colors.olive[50],
    alignItems: "center",
    justifyContent: "center",
  },
  logoAccent: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.olive[600],
    borderWidth: 3,
    borderColor: colors.light.card,
    alignItems: "center",
    justifyContent: "center",
  },
  namePlaque: {
    position: "absolute",
    bottom: spacing[4],
    right: spacing[5],
  },
  boutiqueLabel: {
    color: "rgba(250,248,241,0.85)",
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
    letterSpacing: 1.6,
  },
});
