/** Grid / rail tile for a post. Reels play muted while `visible` (parent decides via viewability). */
import { useEffect, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import type { PublicPost } from "@/lib/posts/types";
import { trackPost, type PostSurface } from "@/lib/posts/track";
import { Ionicons } from "@/components/ui/Icon";
import { fontFamilies } from "@/lib/theme/fonts";
import { ReelPlayer } from "./ReelPlayer";

const RADIUS = 12;

export function PostTile({
  post,
  width,
  height,
  visible,
  surface,
  onPress,
}: {
  post: PublicPost;
  width: number;
  height: number;
  visible: boolean;
  surface: PostSurface;
  onPress: () => void;
}) {
  const impressed = useRef(false);
  useEffect(() => {
    if (!visible || impressed.current) return;
    const t = setTimeout(() => {
      impressed.current = true;
      trackPost({ post_id: post.id, type: "impression", surface });
    }, 1000);
    return () => clearTimeout(t);
  }, [visible, post.id, surface]);

  const cover = post.media[0];
  if (!cover) return null;
  const label = post.caption?.split("\n")[0]?.slice(0, 80) || `${post.store.name} ${post.kind}`;

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Open ${post.kind}: ${label}`} style={{ width, height }}>
      {post.kind === "reel" ? (
        <ReelPlayer src={cover.url} poster={cover.poster_url} active={visible} radius={RADIUS} style={{ width, height, borderRadius: RADIUS }} />
      ) : (
        <Image source={{ uri: cover.url }} style={{ width, height, borderRadius: RADIUS }} contentFit="cover" transition={150} recyclingKey={cover.id} />
      )}
      <View style={styles.badge} pointerEvents="none">
        {post.kind === "reel" ? <Ionicons name="play" size={14} color="#fff" /> : post.kind === "carousel" ? <Ionicons name="copy-outline" size={14} color="#fff" /> : null}
      </View>
      {post.products.length > 0 ? (
        <View style={styles.shop} pointerEvents="none">
          <Text style={styles.shopText}>Shop {post.products.length}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: { position: "absolute", right: 8, top: 8, textShadowColor: "rgba(0,0,0,0.4)" },
  shop: { position: "absolute", left: 8, bottom: 8, backgroundColor: "rgba(255,255,255,0.92)", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  shopText: { fontFamily: fontFamilies.sans.semibold, fontSize: 11, color: "#16170f" },
});
