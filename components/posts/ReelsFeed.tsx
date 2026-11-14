/**
 * Reels feed: full-screen vertical shoppable reels and posters from every
 * store, ranked Instagram-style (freshness, watch-through, product clicks,
 * follows, seen suppression, store diversity).
 *
 *   - one reel plays at a time; tap = sound on/off (shared across reels),
 *     press-and-hold = pause (the overlay fades away while held)
 *   - bottom-left: store, inline Follow, caption ("more"), "View products" chip
 *   - right rail: Shop (count), Share, store logo
 *   - tagged products open as a strip of white cards (heart = wishlist)
 *   - after the last reel: "Boutiques you might like"
 *
 * Engagement is tracked with surface "discover"; a product tap is credited to
 * the reel for the 30-min add-to-cart window (lib/posts/track.ts).
 *
 * Dev only: /reels?demo=1 fills the feed with sample videos + real catalog
 * products so the layout can be checked before any seller has posted.
 *
 * Android note: every rounded layer carries its own radius — no
 * overflow:hidden on rounded parents (children go unpainted on some devices).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Animated, FlatList, Pressable, Share, StyleSheet, Text, View, useWindowDimensions, type ViewToken,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, type IonIconName } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { fetchJson, getStoreApiUrl } from "@/lib/api/_fetch";
import { isFollowingStore, toggleFollowStore } from "@/lib/api/stores";
import { navigateHome } from "@/lib/navigation";
import { publicPostsApi } from "@/lib/posts/api";
import { notePostProductClick, trackPost } from "@/lib/posts/track";
import type { FeedStore, PublicPost, PublicPostProduct } from "@/lib/posts/types";
import { useWishlistToggle } from "@/lib/hooks/useWishlistToggle";
import { useWishlist } from "@/lib/stores";
import { useAuth } from "@/lib/supabase/auth";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";
import { PostMedia } from "./PostMedia";
import { ReelPlayer } from "./ReelPlayer";
import { QuickShopSheet } from "./QuickShopSheet";

const CARD_W = 268;
const CARD_H = 92;
const STRIP_H = CARD_H + 12;
const ACCENT = "#e9e4cf";
const GREEN = "#2f9e5b";

type Row = { key: string; type: "post"; post: PublicPost } | { key: string; type: "stores"; stores: FeedStore[] };

export function compactCount(n: number | null | undefined): string {
  const v = n ?? 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(v >= 10_000 ? 0 : 1).replace(/\.0$/, "")}k`;
  return String(v);
}

const plural = (n: number, one: string, many: string) => `${compactCount(n)} ${n === 1 ? one : many}`;

/* ───────────────────────── follow ───────────────────────── */

function useFollow(storeId: string, storeName: string, base: number | null | undefined) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [following, setFollowing] = useState(false);
  const [delta, setDelta] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    isFollowingStore(storeId).then((f) => { if (alive) setFollowing(f); }).catch(() => undefined);
    return () => { alive = false; };
  }, [storeId]);

  const toggle = useCallback(async () => {
    if (busy) return;
    if (!user) {
      toast("Sign in to follow boutiques", "info");
      router.push("/(auth)/login");
      return;
    }
    setBusy(true);
    const res = await toggleFollowStore(storeId);
    setBusy(false);
    if (!res.ok) { toast(res.error, "error"); return; }
    if (res.data.following !== following) setDelta((d) => d + (res.data.following ? 1 : -1));
    setFollowing(res.data.following);
    toast(res.data.following ? `Following ${storeName}` : "Unfollowed", "success");
  }, [busy, user, toast, storeId, storeName, following]);

  return { following, toggle, busy, count: Math.max(0, (base ?? 0) + delta) };
}

function FollowButton({ following, onPress, busy, solid }: { following: boolean; onPress: () => void; busy?: boolean; solid?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={busy} hitSlop={6} accessibilityRole="button"
      accessibilityLabel={following ? "Unfollow" : "Follow"}
      style={({ pressed }) => [
        styles.follow, !following && styles.followSolid, following && styles.followOn, pressed && { opacity: 0.8 },
      ]}>
      {following ? <Ionicons name="checkmark" size={13} color="#fff" /> : null}
      <Text style={[styles.followText, !following && { color: "#111114" }, solid && !following && styles.followTextSolid]}>
        {following ? "Following" : "Follow"}
      </Text>
    </Pressable>
  );
}

/* ───────────────────────── product card ───────────────────────── */

function ProductCard({ p, onOpen }: { p: PublicPostProduct; onOpen: () => void }) {
  const saved = useWishlist((s) => !!s.items[p.id]);
  const toggleWish = useWishlistToggle();
  const cur = p.currency ?? "LKR";
  const off = p.mrp && p.mrp > p.price ? Math.round(((p.mrp - p.price) / p.mrp) * 100) : 0;
  return (
    <Pressable onPress={onOpen} style={({ pressed }) => [styles.card, pressed && { transform: [{ scale: 0.98 }] }]}
      accessibilityRole="button" accessibilityHint={p.in_stock ? "Choose a size and add to bag" : "Opens the product page"}
      accessibilityLabel={`${p.name}, ${formatPrice(p.price, cur)}${p.in_stock ? "" : ", sold out"}`}>
      <View style={styles.cardImgWrap}>
        {p.image_url ? <Image source={{ uri: p.image_url }} style={[styles.cardImg, !p.in_stock && { opacity: 0.5 }]} contentFit="cover" transition={150} />
          : <View style={[styles.cardImg, { backgroundColor: "#eeeae0" }]} />}
        <Pressable onPress={() => toggleWish({ id: p.id, name: p.name }, p.image_url)} hitSlop={8} style={styles.heart}
          accessibilityRole="button" accessibilityLabel={saved ? "Remove from wishlist" : "Save to wishlist"}>
          <Ionicons name={saved ? "heart" : "heart-outline"} size={14} color={saved ? "#e0245e" : "#111114"} />
        </Pressable>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Text style={styles.cardName} numberOfLines={2}>{p.name}</Text>
        {p.in_stock ? (
          <View style={styles.priceRow}>
            <Text style={styles.cardPrice}>{formatPrice(p.price, cur)}</Text>
            {off >= 5 ? <Text style={styles.cardMrp} numberOfLines={1}>{formatPrice(p.mrp!, cur)}</Text> : null}
          </View>
        ) : <Text style={styles.soldOut}>Sold out</Text>}
        {off >= 5 && p.in_stock ? (
          <View style={styles.offPill}><Text style={styles.cardOff}>{off}% OFF</Text></View>
        ) : null}
      </View>
      <View style={[styles.cardGo, !p.in_stock && { backgroundColor: "#d4d4d8" }]}>
        <Ionicons name={p.in_stock ? "bag-add-outline" : "arrow-forward"} size={16} color="#fff" />
      </View>
    </Pressable>
  );
}

/* ───────────────────────── one reel ───────────────────────── */

function RailButton({ icon, label, onPress, active }: { icon: IonIconName; label?: string; onPress: () => void; active?: boolean }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={label}
      style={({ pressed }) => [styles.railItem, pressed && { transform: [{ scale: 0.92 }] }]}>
      <View style={[styles.railBtn, active && styles.railBtnOn]}>
        <Ionicons name={icon} size={22} color={active ? "#111114" : "#fff"} />
      </View>
      {label ? <Text style={styles.railLabel}>{label}</Text> : null}
    </Pressable>
  );
}

function ReelItem({
  post, active, width, height, muted, onToggleMute, stripOpen, onStrip,
}: {
  post: PublicPost; active: boolean; width: number; height: number;
  muted: boolean; onToggleMute: () => void; stripOpen: boolean; onStrip: (open: boolean) => void;
}) {
  const insets = useSafeAreaInsets();
  const [held, setHeld] = useState(false);
  const [leftForPage, setLeftForPage] = useState(false);
  const [progress, setProgress] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [shopItem, setShopItem] = useState<PublicPostProduct | null>(null);
  const follow = useFollow(post.store.id, post.store.name, post.store.followers);
  const video = post.kind === "reel" ? post.media.find((m) => m.type === "video") : undefined;
  const hasProducts = post.products.length > 0;
  const showStrip = stripOpen && hasProducts;
  const paused = held || leftForPage || !!shopItem;

  // Sound / pause flash in the centre.
  const flash = useRef(new Animated.Value(0)).current;
  const [flashIcon, setFlashIcon] = useState<IonIconName>("volume-mute");
  const chrome = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.timing(chrome, { toValue: held ? 0 : 1, duration: 180, useNativeDriver: true }).start();
  }, [held, chrome]);

  useEffect(() => { if (!active) { setHeld(false); setLeftForPage(false); setExpanded(false); } }, [active]);
  // Back from a product / store page: resume playback.
  useFocusEffect(useCallback(() => { setLeftForPage(false); }, []));
  useEffect(() => {
    if (!active) return;
    trackPost({ post_id: post.id, type: "impression", surface: "discover" });
    if (post.kind === "reel") return;
    const t = setTimeout(() => trackPost({ post_id: post.id, type: "view", surface: "discover", watch_ms: 2000 }), 2000);
    return () => clearTimeout(t);
  }, [active, post.id, post.kind]);

  const onWatch = useCallback((ms: number, f: number) => {
    setProgress(f);
    if (ms >= 3000) trackPost({ post_id: post.id, type: "view", surface: "discover", watch_ms: ms });
    if (f >= 0.9) trackPost({ post_id: post.id, type: "complete", surface: "discover", watch_ms: ms });
  }, [post.id]);

  const tap = () => {
    if (!video) return;
    setFlashIcon(muted ? "volume-high" : "volume-mute");
    onToggleMute();
    flash.setValue(1);
    Animated.timing(flash, { toValue: 0, duration: 750, delay: 250, useNativeDriver: true }).start();
  };

  // Card tap: quick shop over the video (sold-out pieces go straight to the page).
  const tapProduct = (p: PublicPostProduct) => {
    if (!p.in_stock) { openProduct(p); return; }
    notePostProductClick(post.id, p.id, "discover");
    setShopItem(p);
  };

  const openProduct = (p: PublicPostProduct, alreadyNoted = false) => {
    if (!alreadyNoted) notePostProductClick(post.id, p.id, "discover");
    setLeftForPage(true);
    router.navigate({ pathname: "/(main)/products/[slug]", params: { slug: p.slug || p.id } });
  };

  const share = async () => {
    trackPost({ post_id: post.id, type: "share", surface: "discover" });
    const site = getStoreApiUrl() || "https://synapstore.shop";
    await Share.share({ message: `${post.store.name} on LUXE — ${site}/stores/${post.store.slug}` }).catch(() => undefined);
  };

  const openStore = () => { setLeftForPage(true); router.navigate({ pathname: "/(main)/stores/[slug]", params: { slug: post.store.slug } }); };
  const from = hasProducts ? Math.min(...post.products.map((p) => p.price)) : 0;
  const bottomBase = insets.bottom + 14;
  const blockBottom = bottomBase + (showStrip ? STRIP_H + 10 : 0);

  return (
    <View style={{ width, height, backgroundColor: "#000" }}>
      {video ? (
        <ReelPlayer src={video.url} poster={video.poster_url} active={active} paused={paused} muted={muted}
          onWatch={onWatch} style={{ width, height }} />
      ) : (
        <View style={{ width, height, justifyContent: "center" }}>
          <PostMedia post={post} width={width} height={Math.min(height, width * 1.25)} active={active} />
        </View>
      )}

      {/* tap = sound, hold = pause */}
      <Pressable style={StyleSheet.absoluteFill} onPress={tap} delayLongPress={220}
        onLongPress={() => video && setHeld(true)} onPressOut={() => setHeld(false)}
        accessibilityLabel={muted ? "Turn sound on" : "Turn sound off"} accessible={!!video} />
      <Animated.View pointerEvents="none" style={[styles.flash, { left: width / 2 - 34, top: height / 2 - 34, opacity: flash, transform: [{ scale: flash.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] }]}>
        <Ionicons name={flashIcon} size={28} color="#fff" />
      </Animated.View>

      <Animated.View pointerEvents={held ? "none" : "box-none"} style={[StyleSheet.absoluteFill, { opacity: chrome }]}>
        <LinearGradient pointerEvents="none" colors={["rgba(0,0,0,0.42)", "rgba(0,0,0,0)"]} style={[styles.topWash, { height: insets.top + 90 }]} />
        <LinearGradient pointerEvents="none" colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.25)", "rgba(0,0,0,0.75)"]} locations={[0, 0.35, 1]}
          style={[styles.bottomWash, { height: 340 + blockBottom - bottomBase }]} />

        {/* right rail */}
        <View style={[styles.rail, { bottom: blockBottom + 4 }]}>
          {hasProducts ? (
            <RailButton icon={showStrip ? "bag-handle" : "bag-handle-outline"} label={String(post.products.length)}
              active={showStrip} onPress={() => onStrip(!showStrip)} />
          ) : null}
          <RailButton icon="paper-plane-outline" label="Share" onPress={share} />
          <Pressable onPress={openStore} hitSlop={6} accessibilityRole="link" accessibilityLabel={`Open ${post.store.name}`}>
            {post.store.logo_url ? <Image source={{ uri: post.store.logo_url }} style={styles.railStore} />
              : <View style={[styles.railStore, styles.avatarFallback]}><Text style={styles.avatarText}>{post.store.name.slice(0, 1)}</Text></View>}
            {!follow.following ? (
              <Pressable onPress={follow.toggle} hitSlop={6} style={styles.railPlus} accessibilityRole="button" accessibilityLabel={`Follow ${post.store.name}`}>
                <Ionicons name="add" size={13} color="#fff" />
              </Pressable>
            ) : null}
          </Pressable>
        </View>

        {/* bottom-left: store, caption, products chip */}
        <View style={[styles.block, { bottom: blockBottom }]}>
          <View style={styles.storeRow}>
            <Pressable onPress={openStore} style={styles.storeTap} accessibilityRole="link" accessibilityLabel={`Open ${post.store.name}`}>
              {post.store.logo_url ? <Image source={{ uri: post.store.logo_url }} style={styles.avatar} />
                : <View style={[styles.avatar, styles.avatarFallback]}><Text style={styles.avatarText}>{post.store.name.slice(0, 1)}</Text></View>}
              <View style={{ flexShrink: 1 }}>
                <Text style={styles.storeName} numberOfLines={1}>{post.store.name}</Text>
                {post.store.followers != null ? <Text style={styles.storeMeta}>{plural(follow.count, "follower", "followers")}</Text> : null}
              </View>
            </Pressable>
            <FollowButton following={follow.following} onPress={follow.toggle} busy={follow.busy} />
          </View>

          {post.caption ? (
            <Pressable onPress={() => setExpanded((e) => !e)} hitSlop={4}>
              <Text style={styles.captionText} numberOfLines={expanded ? 8 : 2}>
                {post.caption}
              </Text>
              {!expanded && post.caption.length > 70 ? <Text style={styles.more}>more</Text> : null}
            </Pressable>
          ) : null}

          {hasProducts ? (
            <Pressable onPress={() => onStrip(!showStrip)} accessibilityRole="button"
              accessibilityLabel={showStrip ? "Hide products" : "Shop the look"}
              style={({ pressed }) => [styles.shopChip, showStrip && styles.shopChipOpen, pressed && { opacity: 0.9 }]}>
              <View style={styles.stack}>
                {post.products.slice(0, 3).map((pp, i) => (
                  <View key={pp.id} style={[styles.stackItem, { marginLeft: i ? -10 : 0, zIndex: 3 - i }]}>
                    {pp.image_url ? <Image source={{ uri: pp.image_url }} style={styles.stackImg} contentFit="cover" /> : null}
                  </View>
                ))}
              </View>
              <View style={{ flexShrink: 1 }}>
                <Text style={[styles.shopChipText, showStrip && { color: "#fff" }]} numberOfLines={1}>
                  {showStrip ? "Hide products" : "Shop the look"}
                </Text>
                {!showStrip ? (
                  <Text style={styles.shopChipFrom} numberOfLines={1}>
                    {post.products.length === 1 ? "1 piece" : `${post.products.length} pieces`} · from {formatPrice(from, post.products[0]?.currency ?? "LKR")}
                  </Text>
                ) : null}
              </View>
              <Ionicons name={showStrip ? "chevron-down" : "chevron-up"} size={15} color={showStrip ? "#fff" : "#111114"} />
            </Pressable>
          ) : null}
        </View>

        {/* product strip */}
        {showStrip ? (
          <FlatList
            style={[styles.strip, { bottom: bottomBase }]}
            data={post.products} horizontal keyExtractor={(p) => p.id} showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10, paddingHorizontal: 14 }}
            snapToInterval={CARD_W + 10} decelerationRate="fast"
            renderItem={({ item }) => <ProductCard p={item} onOpen={() => tapProduct(item)} />}
          />
        ) : null}
      </Animated.View>

      <QuickShopSheet
        item={shopItem}
        onClose={() => setShopItem(null)}
        onViewDetails={(p) => { setShopItem(null); openProduct(p, true); }}
        onViewBag={() => { setShopItem(null); setLeftForPage(true); router.navigate("/(main)/cart"); }}
      />

      {/* progress */}
      {video ? (
        <View pointerEvents="none" style={[styles.track, { bottom: Math.max(insets.bottom - 8, 4) }]}>
          <View style={[styles.bar, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
      ) : null}
    </View>
  );
}

/* ───────────────────────── end card: stores ───────────────────────── */

function StoreSuggestion({ s, width }: { s: FeedStore; width: number }) {
  const follow = useFollow(s.id, s.name, s.total_followers);
  const img = s.banner_url ?? s.logo_url;
  return (
    <Pressable onPress={() => router.navigate({ pathname: "/(main)/stores/[slug]", params: { slug: s.slug } })} style={[styles.sCard, { width }]} accessibilityRole="link" accessibilityLabel={s.name}>
      {img ? <Image source={{ uri: img }} style={[styles.sImg, { width }]} contentFit="cover" />
        : <View style={[styles.sImg, { width, backgroundColor: "#2a2c1f" }]} />}
      <LinearGradient pointerEvents="none" colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.88)"]} style={[styles.sShade, { width }]} />
      <View style={styles.sBody}>
        {s.logo_url && s.banner_url ? <Image source={{ uri: s.logo_url }} style={styles.sLogo} /> : null}
        <Text style={styles.sName} numberOfLines={1}>{s.name}</Text>
        <Text style={styles.sMeta}>
          {plural(follow.count, "follower", "followers")} · {s.total_products ?? 0} {s.total_products === 1 ? "piece" : "pieces"}
        </Text>
        <FollowButton following={follow.following} onPress={follow.toggle} busy={follow.busy} solid />
      </View>
    </Pressable>
  );
}

function StoresEnd({ stores, width, height, onReplay }: { stores: FeedStore[]; width: number; height: number; onReplay?: () => void }) {
  const insets = useSafeAreaInsets();
  const cardW = (width - 16 * 2 - 10) / 2;
  return (
    <View style={{ width, height, backgroundColor: "#0d0e0a", paddingTop: insets.top + 64, paddingHorizontal: 16 }}>
      <Text style={styles.endKicker}>{onReplay ? "YOU’RE ALL CAUGHT UP" : "NOTHING ON THE RUNWAY YET"}</Text>
      <Text style={styles.endTitle}>Boutiques you might like</Text>
      <View style={styles.sGrid}>
        {stores.slice(0, 4).map((s) => <StoreSuggestion key={s.id} s={s} width={cardW} />)}
      </View>
      {onReplay ? (
        <Pressable onPress={onReplay} style={styles.replay} accessibilityRole="button">
          <Ionicons name="refresh" size={16} color="#fff" />
          <Text style={styles.replayText}>Watch from the start</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/* ───────────────────────── dev demo ───────────────────────── */

const DEMO_VIDEOS = [
  "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4",
  "https://test-videos.co.uk/vids/sintel/mp4/h264/720/Sintel_720_10s_1MB.mp4",
  "https://test-videos.co.uk/vids/jellyfish/mp4/h264/720/Jellyfish_720_10s_1MB.mp4",
];

type CatalogItem = {
  id: string; slug: string; name: string; price: number; mrp: number | null; currency: string | null;
  images?: { url: string; is_primary?: boolean | null }[]; store?: { id: string; slug: string; name: string; logo_url?: string | null };
};

/** __DEV__ only: sample reels built from real catalog products, to review the layout. */
async function demoFeed(): Promise<PublicPost[]> {
  const res = await fetchJson<{ products: CatalogItem[] }>("/api/catalog/products", { requireAuth: false, query: { limit: 9 } });
  const products = res.ok ? res.data.products : [];
  return DEMO_VIDEOS.map((url, i) => {
    const group = products.slice(i * 3, i * 3 + 3);
    const store = group[0]?.store ?? { id: `demo-${i}`, slug: "demo", name: "Demo boutique", logo_url: null };
    return {
      id: `demo-${i}`, kind: "reel", aspect: "9:16", cta: "shop", pinned: false, published_at: new Date().toISOString(),
      caption: i === 0
        ? "New season, new drape ✨ Our festive edit is here — hand-finished pieces in limited runs. Tap the bag to shop the look before it's gone. #festive #luxe"
        : i === 1 ? "Weekend layers, styled three ways." : null,
      store: { id: store.id, slug: store.slug, name: store.name, logo_url: store.logo_url ?? null, followers: [5400, 820, 12][i] },
      media: [{ id: `m${i}`, type: "video", url, poster_url: null, width: 720, height: 1280, duration_ms: 15000, blurhash: null, alt: null }],
      products: group.map((p, j) => ({
        id: p.id, slug: p.slug, name: p.name, price: p.price, mrp: p.mrp, currency: p.currency,
        image_url: p.images?.find((x) => x.is_primary)?.url ?? p.images?.[0]?.url ?? null, in_stock: j !== 2 || i !== 1,
        media_id: null, x: null, y: null,
      })),
    } satisfies PublicPost;
  });
}

/* ───────────────────────── feed ───────────────────────── */

export function ReelsFeed({ startId, demo }: { startId?: string; demo?: boolean }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [posts, setPosts] = useState<PublicPost[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [stores, setStores] = useState<FeedStore[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [active, setActive] = useState(0);
  const [muted, setMuted] = useState(true);
  const [stripOpen, setStripOpen] = useState(false);
  const listRef = useRef<FlatList<Row>>(null);
  const loadingMore = useRef(false);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const d = await publicPostsApi.feed({ offset: 0, limit: 8, kind: "all" });
      let items = d.items;
      if (__DEV__ && demo) items = [...(await demoFeed()), ...items];
      if (startId && !items.some((p) => p.id === startId)) {
        const first = await publicPostsApi.get(startId).catch(() => null);
        if (first) items = [first, ...items];
      } else if (startId) {
        items = [...items.filter((p) => p.id === startId), ...items.filter((p) => p.id !== startId)];
      }
      setPosts(items);
      setCursor(d.next_offset);
      setStores(d.suggested_stores ?? []);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [startId, demo]);

  useEffect(() => { void load(); }, [load]);

  const loadMore = useCallback(async () => {
    if (cursor === null || loadingMore.current) return;
    loadingMore.current = true;
    const d = await publicPostsApi.feed({ offset: cursor, limit: 8, kind: "all" }).catch(() => null);
    loadingMore.current = false;
    if (!d) return;
    setPosts((p) => [...p, ...d.items.filter((x) => !p.some((y) => y.id === x.id))]);
    setCursor(d.next_offset);
    if (d.suggested_stores?.length) setStores(d.suggested_stores);
  }, [cursor]);

  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems.find((v) => v.isViewable);
    if (first?.index != null) setActive(first.index);
  }).current;

  const rows: Row[] = [
    ...posts.map((p) => ({ key: p.id, type: "post" as const, post: p })),
    ...(cursor === null && stores.length && status === "ready" ? [{ key: "stores", type: "stores" as const, stores }] : []),
  ];

  const goBack = () => (router.canGoBack() ? router.back() : navigateHome(router));
  const onStoresPage = rows[active]?.type === "stores";

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <StatusBar style="light" />
      {status === "ready" && rows.length ? (
        <FlatList
          ref={listRef}
          data={rows}
          keyExtractor={(r) => r.key}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          getItemLayout={(_, i) => ({ length: height, offset: height * i, index: i })}
          onViewableItemsChanged={onViewable}
          viewabilityConfig={{ itemVisiblePercentThreshold: 80 }}
          windowSize={3}
          initialNumToRender={2}
          maxToRenderPerBatch={2}
          removeClippedSubviews
          onEndReached={loadMore}
          onEndReachedThreshold={2}
          renderItem={({ item, index }) =>
            item.type === "post" ? (
              <ReelItem post={item.post} active={index === active} width={width} height={height}
                muted={muted} onToggleMute={() => setMuted((m) => !m)} stripOpen={stripOpen} onStrip={setStripOpen} />
            ) : (
              <StoresEnd stores={item.stores} width={width} height={height}
                onReplay={posts.length ? () => { listRef.current?.scrollToOffset({ offset: 0, animated: false }); setActive(0); } : undefined} />
            )
          }
        />
      ) : (
        <View style={styles.center}>
          {status === "loading" ? <ActivityIndicator color="#fff" /> : (
            <>
              <Ionicons name={status === "error" ? "cloud-offline-outline" : "film-outline"} size={34} color={ACCENT} />
              <Text style={styles.emptyTitle}>{status === "error" ? "Couldn’t load the Runway" : "Nothing on the Runway yet"}</Text>
              <Text style={styles.emptySub}>{status === "error" ? "Check your connection and try again." : "Boutiques haven’t posted anything yet. Check back soon."}</Text>
              <Pressable onPress={status === "error" ? load : goBack} style={styles.emptyBtn} accessibilityRole="button">
                <Text style={styles.emptyBtnText}>{status === "error" ? "Try again" : "Back to shopping"}</Text>
              </Pressable>
            </>
          )}
        </View>
      )}

      {/* top bar */}
      <View pointerEvents="box-none" style={[styles.topBar, { top: insets.top + 6 }]}>
        <Pressable onPress={goBack} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back" style={styles.back}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </Pressable>
        {!onStoresPage ? (
          <View style={styles.titleWrap}>
            <View style={styles.titleDot} />
            <Text style={styles.topTitle} accessibilityRole="header">Runway</Text>
          </View>
        ) : null}
        <View style={{ flex: 1 }} />
        {!onStoresPage && posts.length ? (
          <Pressable onPress={() => setMuted((m) => !m)} hitSlop={10} accessibilityRole="button"
            accessibilityLabel={muted ? "Turn sound on" : "Turn sound off"} style={styles.back}>
            <Ionicons name={muted ? "volume-mute" : "volume-high"} size={19} color="#fff" />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const shadowText = { textShadowColor: "rgba(0,0,0,0.4)", textShadowRadius: 5, textShadowOffset: { width: 0, height: 1 } };

const styles = StyleSheet.create({
  topBar: { position: "absolute", left: 12, right: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  back: {
    width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.32)", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.25)",
  },
  titleWrap: { flexDirection: "row", alignItems: "center", gap: 7 },
  titleDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#ff4d4f" },
  topTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 20, color: "#fff", letterSpacing: -0.3, ...shadowText },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 36, gap: 10 },
  emptyTitle: { fontFamily: fontFamilies.display.semibold, fontSize: 24, color: "#fff", marginTop: 6 },
  emptySub: { fontFamily: fontFamilies.sans.regular, fontSize: 14, lineHeight: 20, color: "rgba(255,255,255,0.65)", textAlign: "center" },
  emptyBtn: { marginTop: 12, borderRadius: 999, backgroundColor: ACCENT, paddingHorizontal: 22, paddingVertical: 12 },
  emptyBtnText: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: "#16170f" },

  flash: { position: "absolute", width: 68, height: 68, borderRadius: 34, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
  topWash: { position: "absolute", left: 0, right: 0, top: 0 },
  bottomWash: { position: "absolute", left: 0, right: 0, bottom: 0 },

  rail: { position: "absolute", right: 10, alignItems: "center", gap: 16, width: 56 },
  railItem: { alignItems: "center", gap: 4 },
  railBtn: {
    width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.32)", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.3)",
  },
  railBtnOn: { backgroundColor: "#fff", borderColor: "#fff" },
  railIcon: { ...shadowText },
  railLabel: { fontFamily: fontFamilies.sans.semibold, fontSize: 11.5, color: "#fff", ...shadowText },
  railStore: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: "#fff" },
  railPlus: {
    position: "absolute", bottom: -7, alignSelf: "center", width: 20, height: 20, borderRadius: 10,
    backgroundColor: "#ff4d4f", alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "#fff",
  },

  block: { position: "absolute", left: 14, right: 80, gap: 10 },
  storeRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  storeTap: { flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1, minWidth: 0 },
  avatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: "#fff" },
  avatarFallback: { backgroundColor: "#353c1f", alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: fontFamilies.display.semibold, fontSize: 16, color: "#fff" },
  storeName: { fontFamily: fontFamilies.sans.bold, fontSize: 15.5, color: "#fff", letterSpacing: -0.2, ...shadowText },
  storeMeta: { fontFamily: fontFamilies.sans.medium, fontSize: 12, color: "rgba(255,255,255,0.8)", ...shadowText },
  follow: {
    flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingHorizontal: 14, height: 32,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.5)",
  },
  followSolid: { backgroundColor: "#fff", borderColor: "#fff" },
  followOn: { borderColor: "rgba(255,255,255,0.35)", backgroundColor: "rgba(0,0,0,0.3)" },
  followText: { fontFamily: fontFamilies.sans.semibold, fontSize: 13, color: "#fff" },
  followTextSolid: { color: "#111114" },
  captionText: { fontFamily: fontFamilies.sans.regular, fontSize: 14.5, lineHeight: 20, color: "#fff", ...shadowText },
  more: { fontFamily: fontFamilies.sans.semibold, fontSize: 13.5, color: "rgba(255,255,255,0.75)", marginTop: 1 },

  shopChip: {
    alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 10, maxWidth: "100%",
    borderRadius: 999, backgroundColor: "#fff", paddingLeft: 6, paddingRight: 14, height: 48,
    shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  shopChipOpen: { backgroundColor: "rgba(0,0,0,0.45)", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.35)", shadowOpacity: 0 },
  stack: { flexDirection: "row", alignItems: "center" },
  stackItem: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: "#fff", backgroundColor: "#eeeae0" },
  stackImg: { width: 32, height: 32, borderRadius: 16 },
  shopChipText: { fontFamily: fontFamilies.sans.bold, fontSize: 14, color: "#111114" },
  shopChipFrom: { fontFamily: fontFamilies.sans.medium, fontSize: 11.5, color: "#6b6b73", marginTop: 1 },

  strip: { position: "absolute", left: 0, right: 0, height: CARD_H, flexGrow: 0 },
  card: {
    width: CARD_W, height: CARD_H, borderRadius: 20, backgroundColor: "#fff", flexDirection: "row", alignItems: "center",
    gap: 12, paddingLeft: 8, paddingRight: 10,
    shadowColor: "#000", shadowOpacity: 0.22, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  cardImgWrap: { width: 66, height: 76 },
  cardImg: { width: 66, height: 76, borderRadius: 14, backgroundColor: "#eeeae0" },
  heart: {
    position: "absolute", top: 4, right: 4, width: 24, height: 24, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.94)",
    alignItems: "center", justifyContent: "center",
  },
  cardName: { fontFamily: fontFamilies.sans.semibold, fontSize: 13.5, lineHeight: 17, color: "#111114" },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  cardPrice: { fontFamily: fontFamilies.sans.bold, fontSize: 14.5, color: "#111114" },
  cardMrp: { flexShrink: 1, fontFamily: fontFamilies.sans.regular, fontSize: 11.5, color: "#8a8a92", textDecorationLine: "line-through" },
  offPill: { alignSelf: "flex-start", borderRadius: 6, backgroundColor: "#e7f6ec", paddingHorizontal: 6, paddingVertical: 2 },
  cardOff: { fontFamily: fontFamilies.sans.bold, fontSize: 10.5, letterSpacing: 0.3, color: GREEN },
  soldOut: { fontFamily: fontFamilies.sans.semibold, fontSize: 12.5, color: "#b85c3a" },
  cardGo: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#111114", alignItems: "center", justifyContent: "center" },

  track: { position: "absolute", left: 14, right: 14, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.25)" },
  bar: { height: 3, borderRadius: 2, backgroundColor: "#fff" },

  endKicker: { fontFamily: fontFamilies.mono.medium, fontSize: 11, letterSpacing: 1.6, color: "rgba(233,228,207,0.7)" },
  endTitle: { fontFamily: fontFamilies.display.semibold, fontSize: 28, color: "#fff", marginTop: 6, marginBottom: 18 },
  sGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  sCard: { height: 230, borderRadius: 18, backgroundColor: "#1c1d16" },
  sImg: { position: "absolute", left: 0, top: 0, height: 230, borderRadius: 18 },
  sShade: { position: "absolute", left: 0, bottom: 0, height: 150, borderBottomLeftRadius: 18, borderBottomRightRadius: 18 },
  sBody: { position: "absolute", left: 10, right: 10, bottom: 12, alignItems: "center", gap: 4 },
  sLogo: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: "#fff", marginBottom: 2 },
  sName: { fontFamily: fontFamilies.sans.bold, fontSize: 14, color: "#fff", textAlign: "center" },
  sMeta: { fontFamily: fontFamilies.sans.regular, fontSize: 11, color: "rgba(255,255,255,0.72)", textAlign: "center", marginBottom: 4 },
  replay: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, alignSelf: "center", marginTop: 22, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" },
  replayText: { fontFamily: fontFamilies.sans.semibold, fontSize: 13.5, color: "#fff" },
});
