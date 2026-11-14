/**
 * Reel player (expo-video, Cloudflare Stream HLS). Muted loop while `active`,
 * paused otherwise and when the app backgrounds. Poster shows until the first
 * frame is ready. Only the item marked `active` by the parent ever plays.
 *
 * Android note: round each layer (poster, video) instead of clipping a
 * rounded parent with overflow:hidden — that combination leaves children
 * unpainted on some devices.
 */
import { useEffect, useRef, useState } from "react";
import { AppState, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEventListener } from "expo";
import { Ionicons } from "@/components/ui/Icon";

export interface ReelPlayerProps {
  src: string;
  poster?: string | null;
  active: boolean;
  /** Show mute toggle + progress bar (full-screen viewer). */
  controls?: boolean;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  onWatch?: (watchedMs: number, fraction: number) => void;
  /** Controlled mute (reels feed keeps one setting across reels). Omit to let the player own it. */
  muted?: boolean;
  /** Hold the reel paused while `active` (tap-to-pause). */
  paused?: boolean;
}

export function ReelPlayer({
  src, poster, active, controls = false, radius = 0, style, onWatch, muted: mutedProp, paused = false,
}: ReelPlayerProps) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [mutedState, setMuted] = useState(true);
  const muted = mutedProp ?? mutedState;
  const [progress, setProgress] = useState(0);
  const [userPaused, setUserPaused] = useState(false);
  const isPaused = paused || userPaused;
  const appActive = useRef(AppState.currentState === "active");

  const player = useVideoPlayer({ uri: src, useCaching: true }, (p) => {
    p.loop = true;
    p.muted = true;
    p.timeUpdateEventInterval = 0.5;
  });

  useEventListener(player, "statusChange", ({ status }) => {
    if (status === "readyToPlay") { setReady(true); setFailed(false); }
    if (status === "error") setFailed(true);
  });
  useEventListener(player, "timeUpdate", ({ currentTime }) => {
    const dur = player.duration;
    if (!dur) return;
    const f = Math.min(1, currentTime / dur);
    setProgress(f);
    onWatch?.(Math.round(currentTime * 1000), f);
  });

  useEffect(() => {
    if (active && !isPaused && appActive.current) player.play();
    else player.pause();
  }, [active, isPaused, player]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      appActive.current = s === "active";
      if (s !== "active") player.pause();
      else if (active && !isPaused) player.play();
    });
    return () => sub.remove();
  }, [active, isPaused, player]);

  useEffect(() => {
    player.muted = muted;
  }, [muted, player]);

  return (
    <View style={[styles.root, { borderRadius: radius }, style]}>
      <VideoView
        player={player}
        style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
        contentFit="cover"
        nativeControls={false}
        allowsPictureInPicture={false}
      />
      {!ready && poster ? (
        <Image source={{ uri: poster }} style={[StyleSheet.absoluteFill, { borderRadius: radius }]} contentFit="cover" transition={0} />
      ) : null}
      {failed ? (
        <View style={styles.failed} pointerEvents="none">
          <Ionicons name="videocam-off-outline" size={26} color="rgba(255,255,255,0.85)" />
          <Text style={styles.failedText}>This video can’t play right now</Text>
        </View>
      ) : null}
      {controls ? (
        <>
          <Pressable
            onPress={() => setUserPaused((v) => !v)}
            style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
            accessibilityRole="button"
            accessibilityLabel={isPaused ? "Play" : "Pause"}
          >
            {isPaused ? (
              <View style={styles.centerPlay} pointerEvents="none">
                <Ionicons name="play" size={24} color="#fff" style={{ marginLeft: 3 }} />
              </View>
            ) : null}
          </Pressable>
          <Pressable
            onPress={() => setUserPaused((v) => !v)}
            style={[styles.playBtn]}
            accessibilityRole="button"
            accessibilityLabel={isPaused ? "Play" : "Pause"}
            hitSlop={10}
          >
            <Ionicons name={isPaused ? "play" : "pause"} size={15} color="#fff" style={isPaused ? { marginLeft: 2 } : undefined} />
          </Pressable>
          <Pressable
            onPress={() => setMuted((m) => !m)}
            style={styles.mute}
            accessibilityRole="button"
            accessibilityLabel={muted ? "Unmute" : "Mute"}
            hitSlop={10}
          >
            <Ionicons name={muted ? "volume-mute" : "volume-high"} size={16} color="#fff" />
          </Pressable>
          <View style={styles.track} pointerEvents="none">
            <View style={[styles.bar, { width: `${progress * 100}%` }]} />
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: "#000" },
  failed: { ...StyleSheet.absoluteFillObject, backgroundColor: "#0d0e0a", alignItems: "center", justifyContent: "center", gap: 8 },
  failedText: { color: "rgba(255,255,255,0.85)", fontSize: 13 },
  centerPlay: {
    position: "absolute", left: "50%", top: "50%", width: 58, height: 58, marginLeft: -29, marginTop: -29,
    borderRadius: 29, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center",
  },
  playBtn: {
    position: "absolute", left: 14, bottom: 18, width: 34, height: 34, borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center",
  },
  mute: {
    position: "absolute",
    right: 14,
    bottom: 18,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  track: { position: "absolute", left: 0, right: 0, bottom: 0, height: 2, backgroundColor: "rgba(255,255,255,0.25)" },
  bar: { height: 2, backgroundColor: "#fff" },
});
