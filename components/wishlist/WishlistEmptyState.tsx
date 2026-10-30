import React, { useEffect, useState } from "react";
import {
  View,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  type ViewStyle,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { Ionicons } from "@/components/ui/Icon";
import { ProductRail } from "@/components/home/premium";
import { useAuth } from "@/lib/supabase/auth";
import { getForYouRail } from "@/lib/recommender";
import { fontFamilies } from "@/lib/theme/fonts";
import { colors, spacing, radii, shadows } from "@/lib/theme/tokens";
import type { Product } from "@/lib/types";

interface WishlistEmptyStateProps {
  hasBagItems?: boolean;
  style?: ViewStyle;
}

const GOLD = "#E8CF8F";
const CREAM = colors.paper.cream;

const STEPS: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
}[] = [
  { icon: "heart-outline", title: "Save", body: "Tap the heart on any piece" },
  {
    icon: "notifications-outline",
    title: "Watch",
    body: "We'll flag price drops",
  },
  {
    icon: "bag-handle-outline",
    title: "Claim",
    body: "Move to bag in one tap",
  },
];

export function WishlistEmptyState({
  hasBagItems,
  style,
}: WishlistEmptyStateProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [picks, setPicks] = useState<Product[]>([]);

  useEffect(() => {
    let cancelled = false;
    getForYouRail(user?.id ?? null, 10)
      .then((res) => {
        if (!cancelled && res.ok) setPicks(res.data.products);
      })
      .catch(() => {
        /* soft-fail: the rail simply doesn't render */
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return (
    <ScrollView
      style={[styles.scroll, style]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero */}
      <Animated.View
        entering={FadeInDown.duration(520)}
        style={styles.heroShadow}
      >
        <LinearGradient
          colors={["#2a2c1f", "#16170f", "#0f100b"]}
          locations={[0, 0.55, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View pointerEvents="none" style={styles.ringLg} />
          <View pointerEvents="none" style={styles.ringSm} />

          <View style={styles.kickerRow}>
            <View style={styles.kickerRule} />
            <Text style={styles.kicker}>YOUR COLLECTION</Text>
          </View>

          <HeartMedallion />

          <Text style={styles.title}>
            Nothing saved <Text style={styles.titleItalic}>yet</Text>
          </Text>
          <Text style={styles.copy}>
            Your edit begins with a single heart. Keep the pieces you love in
            one place — we'll watch them for you.
          </Text>

          <View style={styles.stats}>
            {[
              ["0", "PIECES"],
              ["—", "ON SALE"],
              ["—", "VALUE"],
            ].map(([v, l], i) => (
              <View key={l} style={[styles.stat, i > 0 && styles.statDivider]}>
                <Text style={styles.statValue}>{v}</Text>
                <Text style={styles.statLabel}>{l}</Text>
              </View>
            ))}
          </View>

          <Pressable
            onPress={() => router.push("/(main)/products")}
            accessibilityRole="button"
            style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
          >
            <Text style={styles.ctaText}>Explore the shop</Text>
            <View style={styles.ctaArrow}>
              <Ionicons name="arrow-forward" size={15} color={GOLD} />
            </View>
          </Pressable>

          {hasBagItems ? (
            <Pressable
              onPress={() => router.push("/(main)/cart")}
              hitSlop={8}
              style={({ pressed }) => [
                styles.secondary,
                pressed && { opacity: 0.6 },
              ]}
            >
              <Text style={styles.secondaryText}>
                or finish what's in your bag
              </Text>
              <Ionicons name="arrow-forward" size={12} color={GOLD} />
            </Pressable>
          ) : null}
        </LinearGradient>
      </Animated.View>

      {/* How it works */}
      <Animated.View
        entering={FadeInDown.duration(520).delay(120)}
        style={styles.stepsCard}
      >
        <Text style={styles.stepsKicker}>HOW YOUR COLLECTION WORKS</Text>
        <View style={styles.steps}>
          {STEPS.map((s, i) => (
            <React.Fragment key={s.title}>
              {i > 0 && <View style={styles.stepConnector} />}
              <View style={styles.step}>
                <View style={styles.stepIcon}>
                  <Ionicons name={s.icon} size={17} color={colors.olive[700]} />
                  <View style={styles.stepNum}>
                    <Text style={styles.stepNumText}>{i + 1}</Text>
                  </View>
                </View>
                <Text style={styles.stepTitle}>{s.title}</Text>
                <Text style={styles.stepBody}>{s.body}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>
        <View style={styles.syncNote}>
          <Ionicons
            name="shield-checkmark-outline"
            size={13}
            color={colors.olive[600]}
          />
          <Text style={styles.syncNoteText}>Synced across the app and web</Text>
        </View>
      </Animated.View>

      {/* Suggestions */}
      {picks.length >= 2 && (
        <Animated.View
          entering={FadeInDown.duration(520).delay(200)}
          style={styles.rail}
        >
          <ProductRail
            kicker="Worth a heart"
            title="Pieces to start with"
            products={picks}
            variant="feature"
            showSaleBadge
            onSeeAll={() => router.push("/(main)/products")}
          />
        </Animated.View>
      )}
    </ScrollView>
  );
}

/** Gold-ringed heart with a slow "breathing" pulse. */
function HeartMedallion() {
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
    );
  }, [pulse]);
  const halo = useAnimatedStyle(() => ({
    opacity: 0.35 + pulse.value * 0.4,
    transform: [{ scale: 1 + pulse.value * 0.08 }],
  }));
  const heart = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.06 }],
  }));

  return (
    <View style={styles.medallionWrap}>
      <Animated.View style={[styles.medallionHalo, halo]} />
      <View style={styles.medallion}>
        <Animated.View style={heart}>
          <Ionicons name="heart" size={30} color={colors.accent2.rust} />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[5],
    paddingBottom: spacing[10],
    gap: spacing[5],
  },
  pressed: { opacity: 0.88, transform: [{ scale: 0.985 }] },

  // Hero
  heroShadow: {
    borderRadius: 30,
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.26,
    shadowRadius: 28,
    elevation: 12,
  },
  hero: {
    borderRadius: 30,
    paddingHorizontal: spacing[6],
    paddingTop: spacing[6],
    paddingBottom: spacing[6],
    alignItems: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(232,207,143,0.18)",
  },
  ringLg: {
    position: "absolute",
    width: 360,
    height: 360,
    borderRadius: 180,
    top: -150,
    right: -170,
    borderWidth: 1,
    borderColor: "rgba(232,207,143,0.12)",
  },
  ringSm: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    top: -80,
    right: -100,
    backgroundColor: "rgba(232,207,143,0.04)",
  },
  kickerRow: {
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  kickerRule: { width: 20, height: 1, backgroundColor: GOLD },
  kicker: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
    letterSpacing: 2.4,
    color: GOLD,
  },

  medallionWrap: {
    marginTop: spacing[7],
    width: 112,
    height: 112,
    alignItems: "center",
    justifyContent: "center",
  },
  medallionHalo: {
    position: "absolute",
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 1,
    borderColor: GOLD,
    backgroundColor: "rgba(232,207,143,0.06)",
  },
  medallion: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: CREAM,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.editorial,
  },

  title: {
    marginTop: spacing[6],
    fontFamily: fontFamilies.sans.medium,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -1,
    color: CREAM,
    textAlign: "center",
  },
  titleItalic: { fontFamily: fontFamilies.sans.medium, color: GOLD },
  copy: {
    marginTop: 10,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 14,
    lineHeight: 21,
    color: "rgba(250,248,241,0.64)",
    textAlign: "center",
    maxWidth: 300,
  },

  stats: {
    alignSelf: "stretch",
    flexDirection: "row",
    marginTop: spacing[6],
    paddingVertical: spacing[4],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(232,207,143,0.22)",
  },
  stat: { flex: 1, alignItems: "center", gap: 4 },
  statDivider: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: "rgba(232,207,143,0.22)",
  },
  statValue: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 22,
    color: "rgba(250,248,241,0.9)",
  },
  statLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 8.5,
    letterSpacing: 1.6,
    color: "rgba(250,248,241,0.45)",
  },

  cta: {
    marginTop: spacing[6],
    alignSelf: "stretch",
    height: 56,
    borderRadius: radii.full,
    backgroundColor: GOLD,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 24,
    paddingRight: 6,
  },
  ctaText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 15,
    letterSpacing: 0.2,
    color: "#16170f",
  },
  ctaArrow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#16170f",
    alignItems: "center",
    justifyContent: "center",
  },
  secondary: {
    marginTop: spacing[4],
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  secondaryText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 15,
    color: GOLD,
  },

  // Steps
  stepsCard: {
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(22,23,15,0.08)",
    backgroundColor: "rgba(255,255,255,0.72)",
    paddingHorizontal: spacing[4],
    paddingTop: spacing[5],
    paddingBottom: spacing[4],
    ...shadows.soft,
  },
  stepsKicker: {
    textAlign: "center",
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9.5,
    letterSpacing: 2,
    color: colors.olive[600],
  },
  steps: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: spacing[5],
  },
  stepConnector: {
    width: 18,
    height: 1,
    marginTop: 22,
    backgroundColor: "rgba(22,23,15,0.15)",
  },
  step: { flex: 1, alignItems: "center" },
  stepIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.olive[50],
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  stepNum: {
    position: "absolute",
    top: -3,
    right: -3,
    width: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: "#16170f",
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    color: GOLD,
  },
  stepTitle: {
    marginTop: 10,
    fontFamily: fontFamilies.sans.medium,
    fontSize: 17,
    color: colors.ink.DEFAULT,
  },
  stepBody: {
    marginTop: 3,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11.5,
    lineHeight: 15,
    color: colors.ink.mute,
    textAlign: "center",
  },
  syncNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: spacing[5],
    paddingTop: spacing[4],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.light.border,
  },
  syncNoteText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 11.5,
    color: colors.ink.mute,
  },

  rail: { marginHorizontal: -spacing[4] },
});
