/** One post's media for the viewer: reel, poster, or swipeable carousel with tappable product hotspots. */
import { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import type { PublicPost } from "@/lib/posts/types";
import { formatPrice } from "@/lib/utils";
import { fontFamilies } from "@/lib/theme/fonts";
import { ReelPlayer } from "./ReelPlayer";

export function aspectRatioOf(a: PublicPost["aspect"]): number {
  return a === "1:1" ? 1 : a === "9:16" ? 9 / 16 : 4 / 5;
}

export function PostMedia({
  post,
  width,
  height,
  active,
  onWatch,
  onProductPress,
}: {
  post: PublicPost;
  width: number;
  height: number;
  active: boolean;
  onWatch?: (ms: number, fraction: number) => void;
  onProductPress?: (productId: string, slug: string) => void;
}) {
  const [index, setIndex] = useState(0);
  const [showTags, setShowTags] = useState(false);

  if (post.kind === "reel" && post.media[0]) {
    return (
      <ReelPlayer
        src={post.media[0].url}
        poster={post.media[0].poster_url}
        active={active}
        controls
        onWatch={onWatch}
        style={{ width, height }}
      />
    );
  }

  const hasHotspots = post.products.some((p) => p.x != null);

  return (
    <View style={{ width, height, backgroundColor: "#000" }}>
      <FlatList
        data={post.media}
        keyExtractor={(m) => m.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / Math.max(width, 1)))}
        renderItem={({ item, index: i }) => {
          const spots = post.products.filter((p) => p.media_id === item.id && p.x != null && p.y != null);
          return (
            <Pressable onPress={() => hasHotspots && setShowTags((s) => !s)} style={{ width, height }} accessibilityLabel={item.alt ?? `${post.store.name} post image ${i + 1}`}>
              <Image source={{ uri: item.url }} style={{ width, height }} contentFit="contain" transition={150} recyclingKey={item.id} />
              {showTags &&
                spots.map((p) => (
                  <Pressable
                    key={p.id}
                    onPress={() => onProductPress?.(p.id, p.slug)}
                    style={[styles.tag, { left: Math.min(width - 150, Math.max(8, (p.x ?? 0) * width - 70)), top: Math.max(8, (p.y ?? 0) * height - 36) }]}
                    accessibilityRole="link"
                    accessibilityLabel={`${p.name}, ${formatPrice(p.price, p.currency ?? "LKR")}`}
                  >
                    <Text style={styles.tagName} numberOfLines={1}>{p.name}</Text>
                    <Text style={styles.tagPrice}>{formatPrice(p.price, p.currency ?? "LKR")}</Text>
                  </Pressable>
                ))}
            </Pressable>
          );
        }}
      />
      {post.media.length > 1 ? (
        <View style={styles.dots} pointerEvents="none">
          {post.media.map((m, i) => (
            <View key={m.id} style={[styles.dot, i === index && styles.dotOn]} />
          ))}
        </View>
      ) : null}
      {hasHotspots && !showTags ? (
        <View style={styles.hint} pointerEvents="none">
          <Text style={styles.hintText}>Tap to see products</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tag: { position: "absolute", maxWidth: 150, backgroundColor: "rgba(255,255,255,0.95)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  tagName: { fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: "#16170f" },
  tagPrice: { fontFamily: fontFamilies.sans.regular, fontSize: 11, color: "#2a2c1f" },
  dots: { position: "absolute", bottom: 12, alignSelf: "center", flexDirection: "row", gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.5)" },
  dotOn: { backgroundColor: "#fff" },
  hint: { position: "absolute", left: 12, bottom: 12, backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  hintText: { color: "#fff", fontSize: 11, fontFamily: fontFamilies.sans.medium },
});
