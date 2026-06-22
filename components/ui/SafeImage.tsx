import React, { useState } from "react";
import { View, StyleSheet, type ViewStyle, type StyleProp } from "react-native";
import { Image, type ImageContentFit } from "expo-image";
import { Ionicons } from "@/components/ui/Icon";
import { colors, radii } from "@/lib/theme/tokens";
import { resolveImageUrl } from "@/lib/utils/resolve-image-url";

export type SafeImageVariant =
  | "product"
  | "store"
  | "avatar"
  | "banner"
  | "category"
  | "blog"
  | "review";

interface SafeImageProps {
  /** Raw or absolute URL — `resolveImageUrl` is applied internally. */
  uri?: string | null;
  /** Fallback variant decides the placeholder icon + tint. */
  variant?: SafeImageVariant;
  /** expo-image content fit. Defaults to "cover". */
  contentFit?: ImageContentFit;
  /** Optional override for the placeholder icon. */
  fallbackIcon?: keyof typeof Ionicons.glyphMap;
  /** Optional override for the placeholder background color. */
  fallbackColor?: string;
  /** Optional override for the placeholder icon color. */
  fallbackIconColor?: string;
  /** Style passed to the outer view AND the underlying image. */
  style?: StyleProp<ViewStyle>;
  /** When true, the image fills its container (default true). */
  fill?: boolean;
  /** Transition duration in ms for expo-image. */
  transition?: number;
  /** Forwarded to expo-image priority. */
  priority?: "low" | "normal" | "high";
  /** Accessible label. */
  accessibilityLabel?: string;
}

const VARIANT_META: Record<
  SafeImageVariant,
  {
    icon: keyof typeof Ionicons.glyphMap;
    bg: string;
    fg: string;
  }
> = {
  product: { icon: "shirt-outline", bg: colors.olive[50] ?? "#f3f1e7", fg: colors.olive[700] },
  store: { icon: "storefront-outline", bg: colors.olive[50] ?? "#f3f1e7", fg: colors.olive[700] },
  avatar: { icon: "person-outline", bg: colors.olive[200] ?? "#d6d3b8", fg: colors.olive[800] },
  banner: { icon: "image-outline", bg: colors.olive[100] ?? "#e8e5d2", fg: colors.olive[700] },
  category: { icon: "grid-outline", bg: colors.olive[50] ?? "#f3f1e7", fg: colors.olive[700] },
  blog: { icon: "newspaper-outline", bg: colors.olive[50] ?? "#f3f1e7", fg: colors.olive[700] },
  review: { icon: "camera-outline", bg: colors.olive[100] ?? "#e8e5d2", fg: colors.olive[700] },
};

/**
 * Image with a built-in placeholder and error fallback. Falls back to
 * a typed icon + tinted background when the URI is missing or the load
 * fails. Uses expo-image under the hood for caching + transitions.
 *
 * Replaces the ad-hoc fallback <View>+<Ionicons> blocks scattered across
 * the app (product cards, store rows, avatars, etc.).
 */
export function SafeImage({
  uri,
  variant = "product",
  contentFit = "cover",
  fallbackIcon,
  fallbackColor,
  fallbackIconColor,
  style,
  fill = true,
  transition = 200,
  priority = "normal",
  accessibilityLabel,
}: SafeImageProps) {
  const resolved = resolveImageUrl(uri);
  const [errored, setErrored] = useState(false);
  const showImage = !!resolved && !errored;

  const meta = VARIANT_META[variant];
  const bg = fallbackColor ?? meta.bg;
  const fg = fallbackIconColor ?? meta.fg;
  const iconName = fallbackIcon ?? meta.icon;

  // Fallback is always rendered behind the image so the layout never shifts
  // on load or error.
  return (
    <View style={[styles.wrap, fill && styles.fill, style]}>
      <View style={[styles.fallback, { backgroundColor: bg }]}>
        <Ionicons name={iconName} size={28} color={fg} />
      </View>
      {showImage ? (
        <Image
          source={{ uri: resolved }}
          style={StyleSheet.absoluteFill}
          contentFit={contentFit}
          transition={transition}
          priority={priority}
          cachePolicy="memory-disk"
          onError={() => setErrored(true)}
          accessibilityLabel={accessibilityLabel}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: "hidden",
    borderRadius: radii.md,
  },
  fill: { width: "100%", height: "100%" },
  fallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
});
