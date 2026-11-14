import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useVideoPlayer, VideoView } from "expo-video";
import { Ionicons } from "@/components/ui/Icon";
import { colors, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

/** Corner radius on every layer (video + scrims) so Android clips cleanly. */
const RADIUS = 26;

/**
 * Occasion tile with a looping, muted video behind overlay copy. The text
 * sits above the video: a top scrim for the index, a bottom scrim for the
 * title block and CTA. Rounded corners are applied to each layer.
 */
export function OccasionVideoTile({
  src,
  index,
  label,
  tagline,
  width,
  height,
}: {
  src: number;
  index: string;
  label: string;
  tagline: string;
  width: number;
  height: number;
}) {
  const player = useVideoPlayer(src, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  return (
    <View style={[styles.root, { width, height }]}>
      <VideoView
        player={player}
        style={[StyleSheet.absoluteFill, { borderRadius: RADIUS }]}
        contentFit="cover"
        nativeControls={false}
        allowsPictureInPicture={false}
      />

      <LinearGradient
        colors={["rgba(13,14,10,0.55)", "rgba(13,14,10,0)"]}
        locations={[0, 1]}
        style={styles.topScrim}
        pointerEvents="none"
      />
      <LinearGradient
        colors={["rgba(13,14,10,0)", "rgba(13,14,10,0.35)", "rgba(13,14,10,0.92)"]}
        locations={[0.3, 0.6, 1]}
        style={[StyleSheet.absoluteFill, { borderRadius: RADIUS }]}
        pointerEvents="none"
      />

      <View style={styles.top} pointerEvents="none">
        <Text style={styles.index}>{index}</Text>
        <View style={styles.dot} />
      </View>

      <View style={styles.bottom} pointerEvents="none">
        <Text style={styles.kicker}>THE OCCASION</Text>
        <Text style={styles.title}>{label}</Text>
        <Text style={styles.tagline} numberOfLines={1}>
          {tagline}
        </Text>
        <View style={styles.ctaRow}>
          <Text style={styles.cta}>Explore the edit</Text>
          <View style={styles.arrow}>
            <Ionicons name="arrow-forward" size={12} color={colors.olive[950]} />
          </View>
        </View>
      </View>
    </View>
  );
}

const shadow = {
  textShadowColor: "rgba(0,0,0,0.45)",
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 6,
} as const;

const styles = StyleSheet.create({
  root: {
    overflow: "hidden",
    borderRadius: RADIUS,
    backgroundColor: colors.olive[950],
  },
  topScrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 90,
    borderTopLeftRadius: RADIUS,
    borderTopRightRadius: RADIUS,
  },
  top: {
    position: "absolute",
    top: spacing[4],
    left: spacing[4],
    right: spacing[4],
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  index: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.paper.cream,
    ...shadow,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent2.ochre,
  },
  bottom: {
    position: "absolute",
    left: spacing[4],
    right: spacing[4],
    bottom: spacing[4],
    gap: 3,
  },
  kicker: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 2,
    color: colors.accent2.ochre,
    ...shadow,
  },
  title: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -0.6,
    color: colors.paper.cream,
    ...shadow,
  },
  tagline: {
    fontFamily: fontFamilies.display.italic,
    fontSize: 14,
    color: "rgba(250,248,241,0.88)",
    ...shadow,
  },
  ctaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing[2],
    paddingTop: spacing[2],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(250,248,241,0.35)",
  },
  cta: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    letterSpacing: 0.3,
    color: colors.paper.cream,
  },
  arrow: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.accent2.ochre,
    alignItems: "center",
    justifyContent: "center",
  },
});
