import React from "react";
import { StyleSheet, View } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";

/** Clip is cropped to 21:9 (1920×822, bottom cut). */
const VIDEO_RATIO = 21 / 9;
const VIDEO_SRC = require("@/assets/home-videos/powered-by.mp4");

/** Full-bleed promo video. Muted, looping, autoplays on mount. */
export function PoweredByVideo() {
  const player = useVideoPlayer(VIDEO_SRC, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  return (
    <View style={styles.wrap}>
      <VideoView
        player={player}
        style={styles.video}
        contentFit="cover"
        nativeControls={false}
        allowsPictureInPicture={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 12,
    width: "100%",
    aspectRatio: VIDEO_RATIO,
    backgroundColor: "#000000",
  },
  video: {
    width: "100%",
    height: "100%",
  },
});
