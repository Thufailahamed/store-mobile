/**
 * Store page: the store's posters and reels as a horizontal row of vertical
 * tiles. Only tiles that are on screen play. Renders nothing when the store
 * has no visible posts (or the feature is off).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, StyleSheet, Text, View, type ViewToken } from "react-native";
import { POSTS_ENABLED, publicPostsApi } from "@/lib/posts/api";
import type { PublicPost } from "@/lib/posts/types";
import { fontFamilies } from "@/lib/theme/fonts";
import { PostTile } from "./PostTile";
import { PostViewer } from "./PostViewer";

const TILE_W = 132;
const TILE_H = Math.round((TILE_W * 16) / 9);

export function StorePostsSection({ storeSlug, title = "On the Runway" }: { storeSlug: string; title?: string }) {
  const [posts, setPosts] = useState<PublicPost[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [visible, setVisible] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<number | null>(null);
  const loadingMore = useRef(false);

  useEffect(() => {
    if (!POSTS_ENABLED || !storeSlug) return;
    let alive = true;
    publicPostsApi
      .forStore(storeSlug, { limit: 12 })
      .then((d) => { if (alive) { setPosts(d.items); setCursor(d.next_cursor); } })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [storeSlug]);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore.current) return;
    loadingMore.current = true;
    const d = await publicPostsApi.forStore(storeSlug, { before: cursor, limit: 12 }).catch(() => null);
    loadingMore.current = false;
    if (d) {
      setPosts((p) => [...p, ...d.items.filter((x) => !p.some((y) => y.id === x.id))]);
      setCursor(d.next_cursor);
    }
  }, [cursor, storeSlug]);

  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    setVisible(new Set(viewableItems.filter((v) => v.isViewable).map((v) => (v.item as PublicPost).id)));
  }).current;

  if (!POSTS_ENABLED || posts.length === 0) return null;

  return (
    <View style={styles.root} accessibilityLabel={title}>
      <Text style={styles.title} accessibilityRole="header">{title}</Text>
      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={{ itemVisiblePercentThreshold: 70 }}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        renderItem={({ item, index }) => (
          <PostTile post={item} width={TILE_W} height={TILE_H} visible={open === null && visible.has(item.id)} surface="store" onPress={() => setOpen(index)} />
        )}
      />
      <PostViewer posts={posts} startIndex={open ?? 0} visible={open !== null} onClose={() => setOpen(null)} surface="store" onEndReached={loadMore} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingVertical: 16 },
  title: { fontFamily: fontFamilies.display.semibold, fontSize: 20, color: "#16170f", paddingHorizontal: 16, marginBottom: 10 },
});
