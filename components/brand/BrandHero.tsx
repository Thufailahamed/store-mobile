import React from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@/components/ui/Icon";
import { Body, Label } from "@/components/ui/Typography";
import type { Brand } from "@/lib/types";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { resolveImageUrl } from "@/lib/utils/resolve-image-url";

interface BrandHeroProps {
  brand: Brand;
}

export function BrandHero({ brand }: BrandHeroProps) {
  return (
    <View style={styles.wrap}>
      {brand.banner_url ? (
        <Image
          source={{ uri: resolveImageUrl(brand.banner_url) ?? brand.banner_url }}
          style={styles.banner}
          contentFit="cover"
        />
      ) : (
        <View style={[styles.banner, styles.bannerFallback]}>
          <Ionicons name="ribbon" size={32} color={colors.light.mutedForeground} />
        </View>
      )}
      <View style={styles.overlay}>
        {brand.logo_url ? (
          <Image
            source={{ uri: resolveImageUrl(brand.logo_url) ?? brand.logo_url }}
            style={styles.logo}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.logo, styles.logoFallback]}>
            <Ionicons name="ribbon" size={26} color={colors.light.foreground} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Body size="md" style={styles.country}>
            {brand.name}
          </Body>
          <Label style={styles.since}>FEATURED BRAND</Label>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", height: 220, backgroundColor: colors.light.card },
  banner: { ...StyleSheet.absoluteFillObject },
  bannerFallback: { alignItems: "center", justifyContent: "center" },
  overlay: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    padding: spacing[4],
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: radii.lg,
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  logoFallback: { alignItems: "center", justifyContent: "center" },
  country: { fontFamily: fontFamilies.sans.semibold },
  since: {
    marginTop: 2,
    color: colors.light.mutedForeground,
    letterSpacing: 1.2,
  },
});