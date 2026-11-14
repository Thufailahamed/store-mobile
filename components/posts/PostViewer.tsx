/**
 * Full-screen post viewer: vertical paging between posts (one plays at a
 * time), caption, store link, share, and a "Shop this look" product strip.
 * Tapping a product closes the viewer and opens the product page; the tap is
 * credited to the post (see lib/posts/track.ts).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList, Pressable, Share, StyleSheet, Text, useWindowDimensions, View, type ViewToken,
} from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Modal } from "@/components/ui/Modal";
import { Ionicons } from "@/components/ui/Icon";
import { getStoreApiUrl } from "@/lib/api/_fetch";
import type { PublicPost } from "@/lib/posts/types";
import { notePostProductClick, trackPost, type PostSurface } from "@/lib/posts/track";
import { formatPrice } from "@/lib/utils";
import { fontFamilies } from "@/lib/theme/fonts";
import { PostMedia } from "./PostMedia";

const PANEL_H = 168;

function ViewerItem({
  post, active, width, height, surface, onClose,
}: { post: PublicPost; active: boolean; width: number; height: number; surface: PostSurface; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [expanded, setExpanded] = useState(false);
  // Images: a view after 2 s on screen. Reels: after 3 s of playback (onWatch).
  useEffect(() => {
    if (!active || post.kind === "reel") return;
    const t = setTimeout(() => trackPost({ post_id: post.id, type: "view", surface: "viewer", watch_ms: 2000 }), 2000);
    return () => clearTimeout(t);
  }, [active, post.id, post.kind]);

  const onWatch = useCallback((ms: number, f: number) => {
    if (ms >= 3000) trackPost({ post_id: post.id, type: "view", surface: "viewer", watch_ms: ms });
    if (f >= 0.9) trackPost({ post_id: post.id, type: "complete", surface: "viewer", watch_ms: ms });
  }, [post.id]);

  const openProduct = (productId: string, slug: string) => {
    notePostProductClick(post.id, productId, surface);
    onClose();
    router.push(`/products/${slug}`);
  };

  const share = async () => {
    trackPost({ post_id: post.id, type: "share", surface: "viewer" });
    const site = getStoreApiUrl() || "https://synapstore.shop";
    await Share.share({ message: `${post.store.name} on LUXE — ${site}/stores/${post.store.slug}` }).catch(() => undefined);
  };

  const mediaH = height - (post.products.length ? PANEL_H : 0) - insets.bottom;

  return (
    <View style={{ width, height, backgroundColor: "#000" }}>
      <View style={{ paddingTop: 0 }}>
        <PostMedia post={post} width={width} height={mediaH} active={active} onWatch={onWatch} onProductPress={openProduct} />
      </View>

      {/* header overlay */}
      <View style={[styles.header, { top: insets.top + 8 }]}>
        <Pressable style={styles.store} onPress={() => { onClose(); router.push(`/stores/${post.store.slug}`); }} accessibilityRole="link">
          {post.store.logo_url ? (
            <Image source={{ uri: post.store.logo_url }} style={styles.logo} />
          ) : (
            <View style={[styles.logo, styles.logoFallback]}><Text style={styles.logoText}>{post.store.name.slice(0, 1)}</Text></View>
          )}
          <Text style={styles.storeName} numberOfLines={1}>{post.store.name}</Text>
        </Pressable>
        <Pressable onPress={share} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Share" hitSlop={8}>
          <Ionicons name="share-outline" size={20} color="#fff" />
        </Pressable>
      </View>

      {post.caption ? (
        <Pressable style={[styles.caption, { bottom: (post.products.length ? PANEL_H : 0) + insets.bottom + 12 }]} onPress={() => setExpanded((e) => !e)}>
          <Text style={styles.captionText} numberOfLines={expanded ? 12 : 2}>{post.caption}</Text>
        </Pressable>
      ) : null}

      {post.products.length > 0 ? (
        <View style={[styles.panel, { height: PANEL_H + insets.bottom, paddingBottom: insets.bottom }]}>
          <Text style={styles.panelTitle}>Shop this look</Text>
          <FlatList
            data={post.products}
            keyExtractor={(p) => p.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
            renderItem={({ item: p }) => (
              <Pressable style={styles.card} onPress={() => openProduct(p.id, p.slug)} accessibilityRole="link"
                accessibilityLabel={`${p.name}, ${formatPrice(p.price, p.currency ?? "LKR")}${p.in_stock ? "" : ", sold out"}`}>
                {p.image_url ? <Image source={{ uri: p.image_url }} style={styles.cardImg} contentFit="cover" /> : <View style={[styles.cardImg, { backgroundColor: "#eee" }]} />}
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardName} numberOfLines={2}>{p.name}</Text>
                  <Text style={styles.cardPrice}>{formatPrice(p.price, p.currency ?? "LKR")}</Text>
                  {!p.in_stock ? <Text style={styles.soldOut}>Sold out</Text> : <Text style={styles.cta}>Shop ›</Text>}
                </View>
              </Pressable>
            )}
          />
        </View>
      ) : null}
    </View>
  );
}

export function PostViewer({
  posts, startIndex, visible, onClose, surface, onEndReached,
}: {
  posts: PublicPost[];
  startIndex: number;
  visible: boolean;
  onClose: () => void;
  surface: PostSurface;
  onEndReached?: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [active, setActive] = useState(startIndex);

  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems.find((v) => v.isViewable);
    if (first?.index != null) setActive(first.index);
  }).current;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen" statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        {visible ? (
          <FlatList
            data={posts}
            keyExtractor={(p) => p.id}
            pagingEnabled
            initialScrollIndex={Math.min(startIndex, Math.max(posts.length - 1, 0))}
            getItemLayout={(_, i) => ({ length: height, offset: height * i, index: i })}
            showsVerticalScrollIndicator={false}
            onViewableItemsChanged={onViewable}
            viewabilityConfig={{ itemVisiblePercentThreshold: 80 }}
            windowSize={3}
            initialNumToRender={2}
            maxToRenderPerBatch={2}
            onEndReached={onEndReached}
            onEndReachedThreshold={1.5}
            renderItem={({ item, index }) => (
              <ViewerItem post={item} active={index === active} width={width} height={height} surface={surface} onClose={onClose} />
            )}
          />
        ) : null}
        <Pressable onPress={onClose} style={[styles.close, { top: insets.top + 8 }]} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10}>
          <Ionicons name="close" size={22} color="#fff" />
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: { position: "absolute", left: 16, right: 60, flexDirection: "row", alignItems: "center", gap: 8 },
  store: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  logo: { width: 32, height: 32, borderRadius: 16 },
  logoFallback: { backgroundColor: "#16170f", alignItems: "center", justifyContent: "center" },
  logoText: { color: "#fff", fontFamily: fontFamilies.sans.bold },
  storeName: { color: "#fff", fontFamily: fontFamilies.sans.semibold, fontSize: 14, flexShrink: 1, textShadowColor: "rgba(0,0,0,0.5)", textShadowRadius: 4 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" },
  close: { position: "absolute", right: 14, width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
  caption: { position: "absolute", left: 16, right: 16, backgroundColor: "rgba(0,0,0,0.45)", borderRadius: 10, padding: 10 },
  captionText: { color: "#fff", fontFamily: fontFamilies.sans.regular, fontSize: 13, lineHeight: 18 },
  panel: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "#faf8f1", borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingTop: 12 },
  panelTitle: { fontFamily: fontFamilies.sans.semibold, fontSize: 12, letterSpacing: 0.6, textTransform: "uppercase", color: "#65684d", paddingHorizontal: 16, marginBottom: 8 },
  card: { width: 240, flexDirection: "row", gap: 10, backgroundColor: "#fff", borderRadius: 12, padding: 8, borderWidth: 1, borderColor: "rgba(83,94,44,0.12)" },
  cardImg: { width: 64, height: 80, borderRadius: 8 },
  cardName: { fontFamily: fontFamilies.sans.medium, fontSize: 13, color: "#16170f" },
  cardPrice: { fontFamily: fontFamilies.sans.semibold, fontSize: 13, color: "#16170f", marginTop: 2 },
  cta: { fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: "#535e2c", marginTop: 6 },
  soldOut: { fontFamily: fontFamilies.sans.medium, fontSize: 12, color: "#b85c3a", marginTop: 6 },
});
