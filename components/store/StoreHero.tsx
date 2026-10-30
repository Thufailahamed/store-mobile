import React from "react";
import { View, StyleSheet, Dimensions, Animated, Text, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

// Fallback for any external consumer that needs a static height before the
// component mounts. The component itself recomputes this reactively via
// useWindowDimensions() below.
const { width: INITIAL_SCREEN_WIDTH } = Dimensions.get("window");
export const STORE_HERO_HEIGHT = Math.round(INITIAL_SCREEN_WIDTH * 0.72);

interface StoreHeroProps {
  bannerUrl?: string;
  storeName: string;
  scrollY: Animated.Value;
}

/**
 * Parallax banner for the boutique page. Purely visual — the logo, name and
 * navigation controls are rendered by the page so they're never clipped by
 * the banner's overflow.
 */
export function StoreHero({ bannerUrl, storeName, scrollY }: StoreHeroProps) {
  const { width: screenWidth } = useWindowDimensions();
  const heroHeight = Math.round(screenWidth * 0.72);

  const translateY = scrollY.interpolate({
    inputRange: [-heroHeight, 0, heroHeight],
    outputRange: [-heroHeight / 2, 0, heroHeight / 3],
    extrapolate: "clamp",
  });
  const scale = scrollY.interpolate({
    inputRange: [-heroHeight, 0],
    outputRange: [2, 1],
    extrapolate: "clamp",
  });

  return (
    <View style={[styles.wrap, { height: heroHeight }]}>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY }, { scale }] }]}>
        {bannerUrl ? (
          <Image source={{ uri: bannerUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} />
        ) : (
          <Placeholder name={storeName} />
        )}
      </Animated.View>
      {/* Top scrim keeps the floating controls legible; bottom fade melts into the paper. */}
      <LinearGradient
        colors={["rgba(22,23,15,0.32)", "rgba(22,23,15,0)"]}
        style={[StyleSheet.absoluteFill, { bottom: "60%" }]}
        pointerEvents="none"
      />
      <LinearGradient
        colors={["rgba(245,244,239,0)", "rgba(245,244,239,0.55)", colors.light.background]}
        locations={[0, 0.55, 1]}
        style={[StyleSheet.absoluteFill, { top: "45%" }]}
        pointerEvents="none"
      />
    </View>
  );
}

/** Editorial fallback when the seller hasn't uploaded a banner. */
function Placeholder({ name }: { name: string }) {
  const initial = (name.trim().charAt(0) || "L").toUpperCase();
  return (
    <LinearGradient
      colors={[colors.olive[900], colors.olive[700], colors.olive[500]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[StyleSheet.absoluteFill, styles.placeholder]}
    >
      <Text style={styles.monogram} numberOfLines={1}>{initial}</Text>
      <View style={styles.ring} />
      <View style={[styles.ring, styles.ringInner]} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    overflow: "hidden",
    backgroundColor: colors.olive[900],
  },
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  monogram: {
    fontFamily: fontFamilies.display.italic,
    fontSize: 220,
    lineHeight: 240,
    color: "rgba(250,248,241,0.08)",
    position: "absolute",
    right: -10,
    bottom: -40,
  },
  ring: {
    position: "absolute",
    width: 360,
    height: 360,
    borderRadius: 180,
    borderWidth: 1,
    borderColor: "rgba(250,248,241,0.08)",
    left: -120,
    top: -140,
  },
  ringInner: {
    width: 240,
    height: 240,
    borderRadius: 120,
    left: -60,
    top: -80,
  },
});
