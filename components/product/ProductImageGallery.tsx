import React, { useState, useRef } from "react";
import { View, StyleSheet, TouchableOpacity, useWindowDimensions, FlatList } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@/components/ui/Icon";
import { Label } from "@/components/ui/Typography";
import { colors, radii, spacing, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { discountPct } from "@/lib/utils";
import type { ProductImage } from "@/lib/types";
import { ImageZoomModal } from "./ImageZoomModal";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const CARD_GAP = 12;

interface ProductImageGalleryProps {
  images: ProductImage[];
  mrp: number;
  price: number;
}

export function ProductImageGallery({ images, mrp, price }: ProductImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [zoomVisible, setZoomVisible] = useState(false);
  const mainRef = useRef<FlatList>(null);
  const thumbRef = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();
  const headerHeight = insets.top + 52; // Header vertical offset
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const CARD_WIDTH = SCREEN_WIDTH - 32; // 16px margin on each side
  const CARD_HEIGHT = CARD_WIDTH * (4 / 3); // 3:4 portrait aspect ratio
  const SNAP_INTERVAL = CARD_WIDTH + CARD_GAP;

  const sorted = [...images].sort((a, b) => a.position - b.position);
  const displayImages = sorted.length ? sorted : [
    { id: "placeholder", url: "", product_id: "", position: 0, is_primary: true, media_type: "image" as const },
  ];

  const imageKey = (item: ProductImage, index: number) =>
    item.id?.trim() ? `${item.id}-${item.position}` : `image-${item.position}-${index}`;
  const pct = discountPct(mrp, price);

  const onMomentumScroll = (e: any) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SNAP_INTERVAL);
    setActiveIndex(idx);
    thumbRef.current?.scrollToOffset({ offset: idx * 68, animated: true });
  };

  const handleThumbPress = (index: number) => {
    setActiveIndex(index);
    mainRef.current?.scrollToOffset({
      offset: index * SNAP_INTERVAL,
      animated: true,
    });
    thumbRef.current?.scrollToOffset({
      offset: index * 68,
      animated: true,
    });
  };

  return (
    <View style={[styles.root, { marginTop: headerHeight + 8 }]}>
      <View style={[styles.galleryWrapper, { width: SCREEN_WIDTH, height: CARD_HEIGHT }]}>
        <FlatList
          ref={mainRef}
          data={displayImages}
          keyExtractor={imageKey}
          horizontal
          decelerationRate="fast"
          snapToInterval={SNAP_INTERVAL}
          snapToAlignment="center"
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onMomentumScroll}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.95}
              onPress={() => item.url && setZoomVisible(true)}
              style={[styles.cardWrapper, { width: CARD_WIDTH }]}
            >
              <View style={[styles.imageContainer, { width: CARD_WIDTH, height: CARD_HEIGHT }]}>
                <Image
                  source={{ uri: item.url || undefined }}
                  style={styles.mainImage}
                  contentFit="cover"
                  transition={200}
                />
                {!item.url && (
                  <View style={styles.placeholder}>
                    <Ionicons name="image-outline" size={48} color={colors.light.mutedForeground} />
                  </View>
                )}
              </View>
            </TouchableOpacity>
          )}
        />

        {/* Floating Overlays */}
        {pct > 0 && (
          <View style={styles.stamp}>
            <Label style={styles.stampText}>{pct}% OFF</Label>
          </View>
        )}

        {/* Image counter */}
        {displayImages.length > 1 && (
          <View style={styles.counter}>
            <Label style={styles.counterText}>
              {activeIndex + 1} / {displayImages.length}
            </Label>
          </View>
        )}

        {/* Pagination dots overlay inside the image */}
        {displayImages.length > 1 && (
          <View style={styles.dotsOverlay}>
            <View style={styles.dotsCapsule}>
              {displayImages.map((img, i) => (
                <View
                  key={imageKey(img, i)}
                  style={[styles.dot, i === activeIndex && styles.dotActive]}
                />
              ))}
            </View>
          </View>
        )}
      </View>

      {/* Thumbnails list below the main image */}
      {displayImages.length > 1 && (
        <FlatList
          ref={thumbRef}
          data={displayImages}
          keyExtractor={(item, index) => `thumb-${imageKey(item, index)}`}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.thumbContainer}
          renderItem={({ item, index }) => (
            <TouchableOpacity
              onPress={() => handleThumbPress(index)}
              activeOpacity={0.8}
            >
              <Image
                source={{ uri: item.url || undefined }}
                style={[styles.thumb, index === activeIndex && styles.thumbActive]}
                contentFit="cover"
              />
            </TouchableOpacity>
          )}
        />
      )}

      <ImageZoomModal
        visible={zoomVisible}
        uri={displayImages[activeIndex]?.url || ""}
        onClose={() => setZoomVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: "100%",
  },
  galleryWrapper: {
    position: "relative",
  },
  listContent: {
    paddingLeft: 16,
    paddingRight: 16 - CARD_GAP,
  },
  cardWrapper: {
    marginRight: CARD_GAP,
  },
  imageContainer: {
    backgroundColor: colors.light.muted,
    borderRadius: radii["3xl"],
    overflow: "hidden",
  },
  mainImage: {
    width: "100%",
    height: "100%",
  },
  placeholder: {
    position: "absolute",
    inset: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  stamp: {
    position: "absolute",
    bottom: 16,
    left: 32,
    backgroundColor: colors.accent2.rust,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.sm,
    ...shadows.soft,
  },
  stampText: {
    color: "#ffffff",
    fontSize: 9.5,
    fontFamily: fontFamilies.mono.semibold,
    letterSpacing: 1,
  },
  counter: {
    position: "absolute",
    bottom: 16,
    right: 32,
    backgroundColor: "rgba(22, 23, 15, 0.45)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  counterText: {
    fontSize: 10,
    color: "#ffffff",
    fontFamily: fontFamilies.mono.medium,
    letterSpacing: 0.5,
  },
  dotsOverlay: {
    position: "absolute",
    bottom: 16,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  dotsCapsule: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(22, 23, 15, 0.25)",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radii.full,
    gap: 5,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "rgba(255, 255, 255, 0.4)",
  },
  dotActive: {
    width: 12,
    backgroundColor: "#ffffff",
  },
  thumbContainer: {
    paddingHorizontal: spacing[4],
    gap: spacing[2.5],
    paddingTop: spacing[4],
    paddingBottom: spacing[2],
    flexGrow: 1,
    justifyContent: "center",
  },
  thumb: {
    width: 56,
    height: 72,
    borderRadius: radii.xl,
    borderWidth: 1.5,
    borderColor: "transparent",
    backgroundColor: colors.light.muted,
  },
  thumbActive: {
    borderColor: colors.olive[600],
    transform: [{ scale: 1.05 }],
  },
});
