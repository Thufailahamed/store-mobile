import React, { useEffect } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { Ionicons, type IonIconName } from "@/components/ui/Icon";
import { BrandMark, BRAND_OLIVE } from "@/components/brand/BrandMark";
import { LUX } from "@/components/orders/luxe-order";
import { fontFamilies } from "@/lib/theme/fonts";
import { completeOnboarding } from "@/lib/onboarding";

/* Same editorial looks the launch animation plays, so the hand-off from
   the intro to this screen feels like one continuous scene. */
const LOOKS = [
  require("@/assets/launch/look-01.jpg"),
  require("@/assets/launch/look-02.jpg"),
  require("@/assets/launch/look-03.jpg"),
  require("@/assets/launch/look-04.jpg"),
  require("@/assets/launch/look-05.jpg"),
  require("@/assets/launch/look-06.jpg"),
  require("@/assets/launch/look-07.jpg"),
  require("@/assets/launch/look-08.jpg"),
  require("@/assets/launch/look-09.jpg"),
  require("@/assets/launch/look-10.jpg"),
  require("@/assets/launch/look-11.jpg"),
  require("@/assets/launch/look-12.jpg"),
  require("@/assets/launch/look-13.jpg"),
  require("@/assets/launch/look-14.jpg"),
  require("@/assets/launch/look-15.jpg"),
];
const COLUMNS = [LOOKS.slice(0, 5), LOOKS.slice(5, 10), LOOKS.slice(10, 15)];

const PAPER = LUX.cream; // #faf8f1
const INK = LUX.ink;
const OLIVE = BRAND_OLIVE;
const GOLD = LUX.gold;
const MUTED = "#6b6d5c";
const TILE_GAP = 10;

const PROMISES: { icon: IonIconName; label: string }[] = [
  { icon: "storefront-outline", label: "Curated boutiques" },
  { icon: "cube-outline", label: "Doorstep delivery" },
  { icon: "refresh-outline", label: "Easy returns" },
];

/** One endlessly drifting column of looks. The list is doubled so the loop is seamless. */
function DriftColumn({
  images,
  width,
  reverse,
  duration,
}: {
  images: number[];
  width: number;
  reverse: boolean;
  duration: number;
}) {
  const tileH = Math.round(width * 1.42);
  const loopH = images.length * (tileH + TILE_GAP);
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false);
  }, [duration, progress]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: reverse ? -loopH * (1 - progress.value) : -loopH * progress.value }],
  }));

  return (
    <Animated.View style={[{ width, gap: TILE_GAP }, style]}>
      {[...images, ...images].map((src, i) => (
        <Image
          key={i}
          source={src}
          style={{ width, height: tileH, borderRadius: 18 }}
          contentFit="cover"
          transition={250}
        />
      ))}
    </Animated.View>
  );
}

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const colW = Math.round(width * 0.4);
  const mosaicH = Math.round(height * 0.6);

  const continueAsGuest = () => {
    // Remember the choice so later launches open the catalogue directly.
    void completeOnboarding();
    router.replace("/(main)");
  };

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      {/* Drifting look-book behind the brand */}
      <Animated.View entering={FadeIn.duration(900)} style={[styles.mosaicWrap, { height: mosaicH }]}>
        <View style={[styles.mosaic, { width: width * 1.5, left: -width * 0.25 }]}>
          {COLUMNS.map((imgs, i) => (
            <DriftColumn key={i} images={imgs} width={colW} reverse={i % 2 === 1} duration={42000 + i * 9000} />
          ))}
        </View>
        <LinearGradient
          pointerEvents="none"
          colors={[
            "rgba(250,248,241,0.85)",
            "rgba(250,248,241,0)",
            "rgba(250,248,241,0)",
            "rgba(250,248,241,0.88)",
            PAPER,
          ]}
          locations={[0, 0.14, 0.4, 0.68, 0.86]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <View style={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) + 6 }]}>
        {/* Brand */}
        <View style={styles.brand}>
          <Animated.View entering={ZoomIn.duration(600).delay(150)} style={styles.markHalo}>
            <View style={styles.markRing}>
              <BrandMark size={52} color={OLIVE} stitchColor="#ffffff" />
            </View>
          </Animated.View>
          <Animated.Text entering={FadeInDown.duration(600).delay(260)} style={styles.word}>
            VESTARA
          </Animated.Text>
          <Animated.View entering={FadeInDown.duration(600).delay(360)} style={styles.ruleRow}>
            <View style={styles.rule} />
            <Text style={styles.eyebrow}>THE BOUTIQUE EDIT</Text>
            <View style={styles.rule} />
          </Animated.View>
          <Animated.Text entering={FadeInDown.duration(600).delay(440)} style={styles.tagline}>
            Curated boutiques, delivered to your door.
          </Animated.Text>
        </View>

        {/* Promises */}
        <Animated.View entering={FadeInDown.duration(600).delay(540)} style={styles.promises}>
          {PROMISES.map((p, i) => (
            <React.Fragment key={p.label}>
              {i > 0 ? <View style={styles.promiseDivider} /> : null}
              <View style={styles.promise}>
                <View style={styles.promiseIcon}>
                  <Ionicons name={p.icon} size={16} color={OLIVE} />
                </View>
                <Text style={styles.promiseText}>{p.label}</Text>
              </View>
            </React.Fragment>
          ))}
        </Animated.View>

        {/* Actions */}
        <Animated.View entering={FadeInDown.duration(600).delay(640)} style={styles.actions}>
          <Pressable
            onPress={() => router.push("/(auth)/login")}
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Log in"
          >
            <Text style={styles.primaryText}>Log in</Text>
            <Ionicons name="arrow-forward" size={18} color={PAPER} />
          </Pressable>

          <Pressable
            onPress={() => router.push("/(auth)/register")}
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Create an account"
          >
            <Text style={styles.secondaryText}>Create an account</Text>
          </Pressable>

          <Pressable
            onPress={continueAsGuest}
            hitSlop={10}
            style={({ pressed }) => [styles.guest, pressed && { opacity: 0.6 }]}
            accessibilityRole="button"
            accessibilityLabel="Continue as a guest"
          >
            <Text style={styles.guestText}>Continue as a guest</Text>
            <Ionicons name="chevron-forward" size={15} color={OLIVE} />
          </Pressable>
        </Animated.View>

        <Animated.Text entering={FadeIn.duration(600).delay(800)} style={styles.legal}>
          By continuing you agree to our{" "}
          <Text style={styles.legalLink} onPress={() => router.push("/legal/terms" as never)}>
            Terms
          </Text>{" "}
          and{" "}
          <Text style={styles.legalLink} onPress={() => router.push("/legal/privacy" as never)}>
            Privacy Policy
          </Text>
          .
        </Animated.Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PAPER },
  mosaicWrap: { position: "absolute", top: 0, left: 0, right: 0, overflow: "hidden" },
  mosaic: {
    position: "absolute",
    top: -60,
    flexDirection: "row",
    justifyContent: "center",
    gap: TILE_GAP,
    transform: [{ rotate: "-8deg" }],
  },
  content: { flex: 1, justifyContent: "flex-end", paddingHorizontal: 24 },

  brand: { alignItems: "center" },
  markHalo: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    shadowColor: "#2c3119",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 22,
    elevation: 8,
  },
  markRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(200,164,74,0.55)",
    paddingTop: 4,
  },
  word: {
    marginTop: 18,
    fontFamily: fontFamilies.display.semibold,
    fontSize: 40,
    letterSpacing: 11,
    marginRight: -11, // letterSpacing pads the last glyph; keep the word optically centred
    color: INK,
  },
  ruleRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 },
  rule: { width: 28, height: StyleSheet.hairlineWidth * 2, backgroundColor: GOLD },
  eyebrow: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10.5,
    letterSpacing: 3,
    color: OLIVE,
  },
  tagline: {
    marginTop: 10,
    fontFamily: fontFamilies.display.italic,
    fontSize: 17,
    lineHeight: 24,
    color: MUTED,
    textAlign: "center",
  },

  promises: {
    marginTop: 24,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(65,74,35,0.14)",
    shadowColor: "#2c3119",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
  },
  promise: { flex: 1, alignItems: "center", gap: 6 },
  promiseIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(65,74,35,0.08)",
  },
  promiseText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 11.5,
    color: INK,
    textAlign: "center",
  },
  promiseDivider: { width: StyleSheet.hairlineWidth, height: 34, backgroundColor: "rgba(65,74,35,0.16)" },

  actions: { marginTop: 22, gap: 12 },
  primary: {
    height: 56,
    borderRadius: 18,
    backgroundColor: OLIVE,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: OLIVE,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 6,
  },
  primaryText: { fontFamily: fontFamilies.sans.bold, fontSize: 16.5, color: PAPER, letterSpacing: 0.2 },
  secondary: {
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.2,
    borderColor: INK,
    backgroundColor: "#ffffff",
  },
  secondaryText: { fontFamily: fontFamilies.sans.semibold, fontSize: 16, color: INK },
  pressed: { opacity: 0.88, transform: [{ scale: 0.985 }] },
  guest: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
    paddingVertical: 8,
  },
  guestText: { fontFamily: fontFamilies.sans.semibold, fontSize: 15, color: OLIVE },

  legal: {
    marginTop: 8,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11.5,
    lineHeight: 16,
    color: MUTED,
    textAlign: "center",
  },
  legalLink: { color: INK, textDecorationLine: "underline" },
});
