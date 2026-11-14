import React from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@/components/ui/Icon";
import { C } from "@/components/orders/parcel-track";
import { fontFamilies } from "@/lib/theme/fonts";
import { radii, spacing } from "@/lib/theme/tokens";

/** Clip is cropped to 21:9 (1280×548). */
const VIDEO_RATIO = 21 / 9;
const VIDEO_SRC = require("@/assets/home-videos/footer-21x9.mp4");

/**
 * Footer promo video, 21:9, muted and looping. "Browse all pieces" sits
 * on top of the video, bottom-centre.
 */
export function FooterVideo({ onPress }: { onPress: () => void }) {
  const { width } = useWindowDimensions();
  const player = useVideoPlayer(VIDEO_SRC, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  const w = width - spacing[5] * 2;

  return (
    <View style={[styles.wrap, { width: w, height: w / VIDEO_RATIO }]}>
      <VideoView
        player={player}
        style={styles.video}
        contentFit="cover"
        nativeControls={false}
        allowsPictureInPicture={false}
      />
      <LinearGradient
        colors={["rgba(13,14,10,0)", "rgba(13,14,10,0.55)"]}
        locations={[0.4, 1]}
        style={styles.scrim}
        pointerEvents="none"
      />
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Browse all pieces"
        style={({ pressed }) => [styles.btn, pressed && { transform: [{ scale: 0.97 }] }]}
      >
        <Text style={styles.btnText}>Browse all pieces</Text>
        <View style={styles.arrow}>
          <Ionicons name="arrow-forward" size={13} color={C.ink} />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "#0d0e0a",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(250,248,241,0.12)",
  },
  video: {
    width: "100%",
    height: "100%",
    borderRadius: 22,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
  },
  btn: {
    position: "absolute",
    bottom: spacing[4],
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingLeft: spacing[5],
    paddingRight: spacing[1.5],
    height: 48,
    borderRadius: radii.full,
    backgroundColor: C.cream,
    shadowColor: "#000000",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  btnText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 14,
    letterSpacing: 0.2,
    color: C.ink,
  },
  arrow: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: C.lime,
    alignItems: "center",
    justifyContent: "center",
  },
});
