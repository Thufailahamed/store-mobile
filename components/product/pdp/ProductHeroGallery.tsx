import React, { useRef, useState } from "react";
import { FlatList, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@/components/ui/Icon";
import { ImageZoomModal } from "@/components/product/ImageZoomModal";
import { fontFamilies } from "@/lib/theme/fonts";
import type { ProductImage } from "@/lib/types";

const STAR = "#1f8a5b";

function compactCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1).replace(/\.0$/, "")}k`;
  return String(n);
}

/**
 * Edge-to-edge swipeable product photos with a rating chip on the image and
 * a slim pager underneath. Tap a photo to zoom.
 */
export function ProductHeroGallery({
  images,
  rating,
  reviewCount,
  maxHeight,
}: {
  images: ProductImage[];
  rating: number;
  reviewCount: number;
  /** Cap so the title + price stay above the fold on shorter phones. */
  maxHeight?: number;
}) {
  const { width } = useWindowDimensions();
  const natural = Math.round(width * 1.3);
  const height = maxHeight ? Math.max(Math.round(width * 0.9), Math.min(natural, Math.round(maxHeight))) : natural;
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(false);
  const listRef = useRef<FlatList<ProductImage>>(null);

  const sorted = [...images].sort((a, b) => a.position - b.position);
  const shots = sorted.length ? sorted : [{ id: "placeholder", url: "", position: 0 } as ProductImage];

  return (
    <View>
      <View style={{ width, height }}>
        <FlatList
          ref={listRef}
          data={shots}
          keyExtractor={(img, i) => `${img.id || "img"}-${i}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          // Track the page while swiping, not only when the fling settles.
          scrollEventThrottle={32}
          onScroll={(e) => {
            const i = Math.round(e.nativeEvent.contentOffset.x / width);
            if (i !== index && i >= 0 && i < shots.length) setIndex(i);
          }}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          renderItem={({ item }) => (
            <TouchableOpacity activeOpacity={0.95} onPress={() => item.url && setZoom(true)}>
              <View style={[styles.slide, { width, height }]}>
                {item.url ? (
                  <Image
                    source={{ uri: item.url }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    contentPosition="top"
                    transition={200}
                  />
                ) : (
                  <Ionicons name="image-outline" size={44} color="#a3a19b" />
                )}
              </View>
            </TouchableOpacity>
          )}
        />
        {rating > 0 ? (
          <View style={styles.rating}>
            <Text style={styles.ratingNum}>{rating.toFixed(1)}</Text>
            <Ionicons name="star" size={12} color={STAR} />
            {reviewCount > 0 ? (
              <>
                <View style={styles.ratingDivider} />
                <Text style={styles.ratingCount}>{compactCount(reviewCount)}</Text>
              </>
            ) : null}
          </View>
        ) : null}
      </View>

      {shots.length > 1 ? (
        <View style={styles.pager} accessibilityRole="adjustable" accessibilityLabel={`Photo ${index + 1} of ${shots.length}`}>
          {shots.map((s, i) => (
            <TouchableOpacity
              key={`${s.id}-${i}`}
              hitSlop={{ top: 10, bottom: 10, left: 3, right: 3 }}
              onPress={() => {
                setIndex(i);
                listRef.current?.scrollToIndex({ index: i, animated: true });
              }}
              accessibilityLabel={`Show photo ${i + 1}`}
            >
              <View style={[styles.pagerDot, i === index && styles.pagerDotOn]} />
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      <ImageZoomModal visible={zoom} uri={shots[index]?.url || ""} onClose={() => setZoom(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  slide: { backgroundColor: "#f1f0ec", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  rating: {
    position: "absolute",
    right: 12,
    bottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.94)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  ratingNum: { fontFamily: fontFamilies.sans.bold, fontSize: 13, color: "#1b1c1c" },
  ratingDivider: { width: 1, height: 13, backgroundColor: "#cfcdc6", marginHorizontal: 4 },
  ratingCount: { fontFamily: fontFamilies.sans.medium, fontSize: 13, color: "#6b6a66" },
  pager: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, paddingTop: 10 },
  pagerDot: { width: 8, height: 4, borderRadius: 2, backgroundColor: "#dcdad3" },
  pagerDotOn: { width: 24, backgroundColor: "#ff2e85" },
});
