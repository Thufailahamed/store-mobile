/** Product page: posts / reels that tag this product. Renders nothing when there are none. */
import { useEffect, useRef, useState } from "react";
import { FlatList, StyleSheet, Text, View, type ViewToken } from "react-native";
import { POSTS_ENABLED, publicPostsApi } from "@/lib/posts/api";
import type { PublicPost } from "@/lib/posts/types";
import { fontFamilies } from "@/lib/theme/fonts";
import { PostTile } from "./PostTile";
import { PostViewer } from "./PostViewer";

const TILE_W = 112;
const TILE_H = Math.round((TILE_W * 16) / 9);

export function StyledInRail({ productId }: { productId: string }) {
  const [posts, setPosts] = useState<PublicPost[]>([]);
  const [visible, setVisible] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    if (!POSTS_ENABLED || !productId) return;
    let alive = true;
    publicPostsApi.forProduct(productId).then((p) => alive && setPosts(p)).catch(() => undefined);
    return () => { alive = false; };
  }, [productId]);

  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    setVisible(new Set(viewableItems.filter((v) => v.isViewable).map((v) => (v.item as PublicPost).id)));
  }).current;

  if (!POSTS_ENABLED || posts.length === 0) return null;
  return (
    <View style={styles.root}>
      <Text style={styles.title} accessibilityRole="header">Styled in</Text>
      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={{ itemVisiblePercentThreshold: 70 }}
        renderItem={({ item, index }) => (
          <PostTile post={item} width={TILE_W} height={TILE_H} visible={open === null && visible.has(item.id)} surface="pdp" onPress={() => setOpen(index)} />
        )}
      />
      <PostViewer posts={posts} startIndex={open ?? 0} visible={open !== null} onClose={() => setOpen(null)} surface="pdp" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingVertical: 12 },
  title: { fontFamily: fontFamilies.display.semibold, fontSize: 18, color: "#16170f", paddingHorizontal: 16, marginBottom: 10 },
});
