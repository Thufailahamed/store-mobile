/**
 * Home: floating mini Runway player, bottom-right.
 *
 * Plays the newest reel muted on a loop when the home screen opens. Tapping it
 * grows the card smoothly to full screen, then hands over to the Runway feed
 * on that reel; the ✕ hides it until the app
 * is restarted. Pauses while home isn't focused. Renders nothing when the
 * feature is off or no reel is ready.
 */
import { useEffect, useRef, useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing, FadeOut, ZoomIn, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withTiming,
} from "react-native-reanimated";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { Ionicons } from "@/components/ui/Icon";
import { ReelPlayer } from "@/components/posts/ReelPlayer";
import { POSTS_ENABLED, publicPostsApi } from "@/lib/posts/api";
import type { PublicPost } from "@/lib/posts/types";
import { trackPost } from "@/lib/posts/track";
import { fontFamilies } from "@/lib/theme/fonts";

const W = 112;
const H = Math.round((W * 16) / 9);
const R = 18;

// Module scope: once dismissed, stays hidden for this app session (survives tab switches).
let dismissed = false;

export function HomeReelPip({ bottom }: { bottom: number }) {
  const focused = useIsFocused();
  const [reel, setReel] = useState<PublicPost | null>(null);
  const [hidden, setHidden] = useState(dismissed);
  const { width: SW, height: SH } = useWindowDimensions();
  const cardRef = useRef<View>(null);
  const [from, setFrom] = useState<{ x: number; y: number } | null>(null);
  const grow = useSharedValue(0);
  const fade = useSharedValue(1);

  useEffect(() => {
    if (!POSTS_ENABLED || dismissed) return;
    let alive = true;
    publicPostsApi.feed({ limit: 10, kind: "reel" })
      .then((d) => {
        if (!alive) return;
        const first = d.items.find((p) => p.media[0]?.type === "video" && !!p.media[0]?.url) ?? null;
        setReel(first);
        if (first) trackPost({ post_id: first.id, type: "impression", surface: "home" });
      })
      .catch(() => undefined);
    return () => { alive = false; };
  }, []);

  const expandStyle = useAnimatedStyle(() => {
    const x0 = from?.x ?? SW - W - 14;
    const y0 = from?.y ?? SH - H - 120;
    return {
      left: interpolate(grow.value, [0, 1], [x0, 0]),
      top: interpolate(grow.value, [0, 1], [y0, 0]),
      width: interpolate(grow.value, [0, 1], [W, SW]),
      height: interpolate(grow.value, [0, 1], [H, SH]),
      // Android: no clip+radius (children can go unpainted), so square corners there.
      borderRadius: Platform.OS === "ios" ? interpolate(grow.value, [0, 1], [R, 0]) : 0,
      opacity: fade.value,
    };
  });

  if (!POSTS_ENABLED || hidden || !reel) return null;
  const m = reel.media[0];
  const id = reel.id;

  const close = () => { dismissed = true; setHidden(true); };

  // Feed is a tab screen (instant switch), so it lands under the full-screen
  // card; hold a beat for it to paint, then fade the card away.
  const handOff = () => {
    router.push({ pathname: "/reels", params: { start: id } });
    fade.value = withTiming(0, { duration: 260 }, (done) => { if (done) runOnJS(setFrom)(null); });
  };
  const open = () => {
    if (from) return;
    cardRef.current?.measureInWindow((x, y) => {
      grow.value = 0;
      fade.value = 1;
      setFrom({ x, y });
      grow.value = withTiming(1, { duration: 420, easing: Easing.bezier(0.2, 0.9, 0.1, 1) }, (done) => {
        if (done) runOnJS(handOff)();
      });
    });
  };

  return (
    <Animated.View entering={ZoomIn.delay(600).duration(320)} exiting={FadeOut.duration(160)}
      style={[styles.wrap, { bottom }]} pointerEvents="box-none">
      <Pressable ref={cardRef} onPress={open} accessibilityRole="button" accessibilityLabel={`Watch Runway video from ${reel.store.name}`}
        style={({ pressed }) => [styles.card, pressed && { transform: [{ scale: 0.96 }] }]}>
        <ReelPlayer src={m.url} poster={m.poster_url} active={focused && !from} radius={R} style={styles.video} />
        <LinearGradient pointerEvents="none" colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.7)"]} style={styles.shade} />
        <View pointerEvents="none" style={styles.live}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>Runway</Text>
        </View>
        <View pointerEvents="none" style={styles.store}>
          {reel.store.logo_url ? <Image source={{ uri: reel.store.logo_url }} style={styles.logo} /> : null}
          <Text style={styles.storeName} numberOfLines={1}>{reel.store.name}</Text>
        </View>
      </Pressable>
      <Pressable onPress={close} hitSlop={10} accessibilityRole="button" accessibilityLabel="Hide Runway video"
        style={styles.close}>
        <Ionicons name="close" size={14} color="#fff" />
      </Pressable>

      <Modal visible={!!from} transparent animationType="none" statusBarTranslucent onRequestClose={() => undefined}>
        <Animated.View style={[styles.expand, expandStyle]}>
          {m.poster_url ? <Image source={{ uri: m.poster_url }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
          <ReelPlayer src={m.url} poster={m.poster_url} active={!!from} style={StyleSheet.absoluteFill} />
        </Animated.View>
      </Modal>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", right: 14, width: W, height: H, zIndex: 50 },
  card: {
    width: W, height: H, borderRadius: R, backgroundColor: "#1c1c1f",
    borderWidth: 2, borderColor: "#fff",
    shadowColor: "#000", shadowOpacity: 0.28, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 10,
  },
  video: { position: "absolute", left: 0, top: 0, width: W - 4, height: H - 4 },
  shade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 64, borderBottomLeftRadius: R, borderBottomRightRadius: R },
  live: {
    position: "absolute", left: 7, top: 7, flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 7, height: 20, borderRadius: 10, backgroundColor: "rgba(0,0,0,0.45)",
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#ff4d4f" },
  liveText: { fontFamily: fontFamilies.sans.semibold, fontSize: 10, color: "#fff" },
  store: { position: "absolute", left: 7, right: 7, bottom: 8, flexDirection: "row", alignItems: "center", gap: 5 },
  logo: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: "#fff" },
  storeName: { flex: 1, fontFamily: fontFamilies.sans.semibold, fontSize: 11, color: "#fff" },
  expand: { position: "absolute", overflow: Platform.OS === "ios" ? "hidden" : "visible", backgroundColor: "#000" },
  close: {
    position: "absolute", top: -8, right: -8, width: 26, height: 26, borderRadius: 13, backgroundColor: "#111114",
    alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#fff",
  },
});
