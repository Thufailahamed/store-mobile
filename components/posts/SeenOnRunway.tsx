/**
 * "Seen on Runway" rail for search results and category pages: videos and
 * looks that tag any of the products on screen. Tapping one opens the
 * full-screen Runway feed on it. Renders nothing when the feature is off,
 * there are no product ids, or nothing on screen has been featured.
 */
import { memo, useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { POSTS_ENABLED, publicPostsApi } from "@/lib/posts/api";
import type { PublicPost } from "@/lib/posts/types";
import { trackPost } from "@/lib/posts/track";
import { fontFamilies } from "@/lib/theme/fonts";

const W = 116;
const H = Math.round((W * 16) / 9);
const sans = fontFamilies.sans;

export const SeenOnRunway = memo(function SeenOnRunway({ productIds, title = "Seen on Runway", inset = 16 }: {
  productIds: string[]; title?: string; inset?: number;
}) {
  const [posts, setPosts] = useState<PublicPost[]>([]);
  // Stable key so a re-render with the same products doesn't refetch.
  const key = productIds.slice(0, 40).join(",");

  useEffect(() => {
    if (!POSTS_ENABLED || !key) { setPosts([]); return; }
    let alive = true;
    const t = setTimeout(() => {
      publicPostsApi.forProducts(key.split(","), 10)
        .then((items) => { if (alive) setPosts(items); })
        .catch(() => { if (alive) setPosts([]); });
    }, 200);
    return () => { alive = false; clearTimeout(t); };
  }, [key]);

  if (!POSTS_ENABLED || posts.length === 0) return null;

  const open = (p: PublicPost) => router.navigate({ pathname: "/(main)/reels", params: { start: p.id } });

  return (
    <View style={styles.root}>
      <View style={[styles.head, { paddingHorizontal: inset }]}>
        <View style={styles.titleRow}>
          <View style={styles.dot} />
          <Text style={styles.title}>{title}</Text>
        </View>
        <Pressable onPress={() => open(posts[0])} hitSlop={8} accessibilityRole="button" style={styles.watch}>
          <Text style={styles.watchText}>Watch</Text>
          <Ionicons name="chevron-forward" size={14} color="#111114" />
        </Pressable>
      </View>
      <FlatList
        data={posts}
        horizontal
        keyExtractor={(p) => p.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: inset, gap: 10 }}
        onViewableItemsChanged={({ viewableItems }) =>
          viewableItems.forEach((v) => v.isViewable && trackPost({ post_id: (v.item as PublicPost).id, type: "impression", surface: "discover" }))}
        viewabilityConfig={{ itemVisiblePercentThreshold: 70, minimumViewTime: 800 }}
        renderItem={({ item }) => {
          const m = item.media[0];
          const cover = m?.type === "video" ? m.poster_url : m?.url;
          const isVideo = m?.type === "video";
          return (
            <Pressable onPress={() => open(item)} accessibilityRole="button"
              accessibilityLabel={`${isVideo ? "Video" : "Look"} from ${item.store.name}`}
              style={({ pressed }) => [styles.tile, pressed && { transform: [{ scale: 0.97 }] }]}>
              {cover ? <Image source={{ uri: cover }} style={styles.img} contentFit="cover" transition={200} />
                : <View style={[styles.img, { backgroundColor: "#2a2c1f" }]} />}
              <LinearGradient pointerEvents="none" colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.75)"]} style={styles.shade} />
              <View style={styles.play}>
                <Ionicons name={isVideo ? "play" : "images"} size={12} color="#fff" style={isVideo ? { marginLeft: 2 } : undefined} />
              </View>
              {item.products.length ? (
                <View style={styles.count}>
                  <Ionicons name="bag-handle-outline" size={11} color="#111114" />
                  <Text style={styles.countText}>{item.products.length}</Text>
                </View>
              ) : null}
              <View style={styles.store}>
                {item.store.logo_url ? <Image source={{ uri: item.store.logo_url }} style={styles.logo} /> : null}
                <Text style={styles.storeName} numberOfLines={1}>{item.store.name}</Text>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  root: { paddingVertical: 12, gap: 10 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#ff4d4f" },
  title: { fontFamily: sans.bold, fontSize: 17, letterSpacing: -0.3, color: "#111114" },
  watch: { flexDirection: "row", alignItems: "center", gap: 2 },
  watchText: { fontFamily: sans.semibold, fontSize: 13.5, color: "#111114" },
  tile: { width: W, height: H, borderRadius: 16, backgroundColor: "#2a2c1f" },
  img: { position: "absolute", left: 0, top: 0, width: W, height: H, borderRadius: 16 },
  shade: { position: "absolute", left: 0, bottom: 0, width: W, height: 86, borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
  play: {
    position: "absolute", left: 8, top: 8, width: 26, height: 26, borderRadius: 13,
    backgroundColor: "rgba(0,0,0,0.42)", alignItems: "center", justifyContent: "center",
  },
  count: {
    position: "absolute", right: 8, top: 8, flexDirection: "row", alignItems: "center", gap: 3, borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.94)", paddingHorizontal: 7, paddingVertical: 3,
  },
  countText: { fontFamily: sans.bold, fontSize: 10.5, color: "#111114" },
  store: { position: "absolute", left: 8, right: 8, bottom: 9, flexDirection: "row", alignItems: "center", gap: 6 },
  logo: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: "#fff" },
  storeName: { flex: 1, fontFamily: sans.semibold, fontSize: 12, color: "#fff" },
});
