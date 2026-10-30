import React from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { fontFamilies } from "@/lib/theme/fonts";
import { C } from "@/components/orders/parcel-track";
import { OutlineButton, PrimaryButton } from "@/components/auth/auth-ui";

const HERO =
  "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1200&q=80";

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const heroH = Math.round(height * 0.5);

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <View style={{ height: heroH }}>
        <Image source={{ uri: HERO }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} />
        <LinearGradient
          pointerEvents="none"
          colors={["rgba(248,247,242,0)", "rgba(248,247,242,0.6)", C.paper]}
          locations={[0.45, 0.78, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <View style={[styles.body, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        <Animated.View entering={FadeInDown.duration(500)} style={styles.brand}>
          <View style={styles.mark}>
            <Text style={styles.markText}>L</Text>
          </View>
          <Text style={styles.word}>LUXE</Text>
          <Text style={styles.tagline}>Curated boutiques, delivered to your door.</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(500).delay(120)} style={styles.actions}>
          <PrimaryButton label="Login" onPress={() => router.push("/(auth)/login")} />
          <OutlineButton label="Register" onPress={() => router.push("/(auth)/register")} />
          <Pressable
            onPress={() => router.replace("/(main)")}
            hitSlop={10}
            style={styles.guest}
            accessibilityRole="button"
            accessibilityLabel="Continue as a guest"
          >
            <Text style={styles.guestText}>Continue as a guest</Text>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  body: { flex: 1, justifyContent: "space-between", paddingHorizontal: 24, marginTop: -40 },
  brand: { alignItems: "center" },
  mark: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: C.ink,
    borderWidth: 2,
    borderColor: C.goldSoft,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 6,
  },
  markText: { fontFamily: fontFamilies.display.italic, fontSize: 38, color: C.goldSoft, marginTop: -2 },
  word: {
    marginTop: 14,
    fontFamily: fontFamilies.display.semibold,
    fontSize: 34,
    letterSpacing: 6,
    color: C.text,
  },
  tagline: { marginTop: 4, fontFamily: fontFamilies.sans.regular, fontSize: 14.5, color: C.muted, textAlign: "center" },
  actions: { gap: 12 },
  guest: { alignSelf: "center", marginTop: 10, paddingVertical: 6 },
  guestText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 15,
    color: C.accent,
    textDecorationLine: "underline",
  },
});
