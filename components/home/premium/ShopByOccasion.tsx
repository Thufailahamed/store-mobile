import React from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { HomeSectionHeader } from "./HomeSectionHeader";
import { OccasionVideoTile } from "./OccasionVideoTile";
import { spacing } from "@/lib/theme/tokens";

const TILE_W = 196;
/** Artwork is 864×1152 (3:4). */
const TILE_H = Math.round((TILE_W * 4) / 3);
/** Video tile is 9:14. Clip is 9:16, so `cover` trims its top and bottom. */
const VIDEO_TILE_H = Math.round((TILE_W * 14) / 9);

/**
 * Occasion tiles. Each artwork carries its own copy (name, tagline, CTA),
 * so the tile is image-only. `occasion` is the value passed to the grid
 * filter (backend resolves known keys, and falls back to a plain term).
 */
type Occasion = {
  key: string;
  label: string;
  occasion: string;
  art: number;
  /** When set, the tile plays this clip with overlay copy instead of `art`. */
  video?: { src: number; tagline: string };
};

const OCCASIONS: Occasion[] = [
  {
    key: "wedding",
    label: "Wedding",
    occasion: "wedding",
    art: require("@/assets/shop-by-occasion/wedding.webp"),
    video: { src: require("@/assets/shop-by-occasion/videos/wedding.mp4"), tagline: "Guest-ready & festive" },
  },
  {
    key: "office",
    label: "Office",
    occasion: "office",
    art: require("@/assets/shop-by-occasion/office.webp"),
    video: { src: require("@/assets/shop-by-occasion/videos/office.mp4"), tagline: "Polished for the 9 to 5" },
  },
  {
    key: "casual",
    label: "Casual",
    occasion: "casual",
    art: require("@/assets/shop-by-occasion/casual.webp"),
    video: { src: require("@/assets/shop-by-occasion/videos/casual.mp4"), tagline: "Effortless style, every day" },
  },
  {
    key: "party",
    label: "Party",
    occasion: "party",
    art: require("@/assets/shop-by-occasion/party.webp"),
    video: { src: require("@/assets/shop-by-occasion/videos/party.mp4"), tagline: "Made for unforgettable nights" },
  },
  {
    key: "summer",
    label: "Summer",
    occasion: "summer",
    art: require("@/assets/shop-by-occasion/summer.webp"),
    video: { src: require("@/assets/shop-by-occasion/videos/summer.mp4"), tagline: "Light looks, brighter days" },
  },
  {
    key: "travel",
    label: "Travel",
    occasion: "vacation",
    art: require("@/assets/shop-by-occasion/travel.webp"),
    video: { src: require("@/assets/shop-by-occasion/videos/travel.mp4"), tagline: "Adventure looks good on you" },
  },
  {
    key: "festive",
    label: "Festive",
    occasion: "festive",
    art: require("@/assets/shop-by-occasion/festive.webp"),
    video: { src: require("@/assets/shop-by-occasion/videos/festive.mp4"), tagline: "Celebrate in every colour" },
  },
];

/**
 * Shop by occasion — tall editorial tiles that deep-link to the grid
 * scoped to that occasion.
 */
export function ShopByOccasion() {
  const router = useRouter();

  return (
    <View style={styles.wrap}>
      <HomeSectionHeader kicker="Dress for the moment" title="Shop by occasion" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
        decelerationRate="fast"
        snapToInterval={TILE_W + spacing[3]}
        snapToAlignment="start"
      >
        {OCCASIONS.map((o, i) => {
          const onPress = () =>
            router.push(
              `/(main)/products?occasion=${encodeURIComponent(o.occasion)}&title=${encodeURIComponent(`${o.label} edit`)}` as never,
            );
          if (o.video) {
            return (
              <TouchableOpacity
                key={o.key}
                activeOpacity={0.9}
                onPress={onPress}
                accessibilityRole="button"
                accessibilityLabel={`Shop ${o.label}, ${o.video.tagline}`}
              >
                <OccasionVideoTile
                  src={o.video.src}
                  index={String(i + 1).padStart(2, "0")}
                  label={o.label}
                  tagline={o.video.tagline}
                  width={TILE_W}
                  height={VIDEO_TILE_H}
                />
              </TouchableOpacity>
            );
          }
          return (
            <TouchableOpacity
              key={o.key}
              activeOpacity={0.9}
              style={styles.tile}
              onPress={onPress}
              accessibilityRole="button"
              accessibilityLabel={`Shop ${o.label}`}
            >
              <Image source={o.art} style={styles.img} contentFit="cover" transition={250} />
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing[8],
  },
  rail: {
    paddingHorizontal: spacing[5],
    gap: spacing[3],
    paddingBottom: spacing[2],
  },
  tile: {
    width: TILE_W,
    height: TILE_H,
    overflow: "hidden",
  },
  img: {
    width: "100%",
    height: "100%",
  },
});
