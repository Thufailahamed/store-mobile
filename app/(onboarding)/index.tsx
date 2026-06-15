import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { completeOnboarding } from "@/lib/onboarding";
import { fontFamilies } from "@/lib/theme/fonts";
import { radii, spacing } from "@/lib/theme/tokens";
import { useTheme } from "@/lib/hooks/useTheme";
import { Display, Body } from "@/components/ui/Typography";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const SLIDES = [
  {
    title: "Find and shop\nstores you love",
    description: "Explore custom pieces and curated boutique collections hand-finished in our ateliers.",
    image: require("@/assets/onboarding-hero.png"),
  },
  {
    title: "Curate your\npersonal collection",
    description: "Save items you adore and build your private wardrobe collection with custom styling options.",
    image: require("@/assets/onboarding-curate.png"),
  },
  {
    title: "Enjoy seamless\ncheckout & delivery",
    description: "Secure purchase, real-time shipping updates, and premium editorial packaging to your doorstep.",
    image: require("@/assets/onboarding-checkout.png"),
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const [activeSlide, setActiveSlide] = useState(0);

  const finishOnboarding = async (destination: "register" | "login") => {
    await completeOnboarding();
    router.replace(destination === "register" ? "/(auth)/register" : "/(auth)/login");
  };

  const handleScroll = (event: any) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const currentIndex = Math.round(contentOffsetX / SCREEN_WIDTH);
    if (currentIndex !== activeSlide) {
      setActiveSlide(currentIndex);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top, backgroundColor: theme.colors.background }]}>
      {/* Progress Tracker (Fixed at top) */}
      <View style={styles.progressRow}>
        <View style={[styles.progressSegment, { backgroundColor: activeSlide === 0 ? theme.colors.primary : theme.colors.muted }]} />
        <View style={[styles.progressSegment, { backgroundColor: activeSlide === 1 ? theme.colors.primary : theme.colors.muted }]} />
        <View style={[styles.progressSegment, { backgroundColor: activeSlide === 2 ? theme.colors.primary : theme.colors.muted }]} />
      </View>

      {/* Horizontal Slider (Center) */}
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={styles.slider}
        contentContainerStyle={styles.sliderContent}
      >
        {SLIDES.map((slide, index) => (
          <View key={index} style={[styles.slide, { width: SCREEN_WIDTH }]}>
            {/* Title */}
            <Display size="4xl" italic style={[styles.title, { color: theme.colors.foreground }]}>
              {slide.title}
            </Display>

            {/* Hero Arch Image */}
            <View style={styles.heroWrap}>
              <View style={[styles.arch, { backgroundColor: theme.colors.accent }]}>
                <Image
                  source={slide.image}
                  style={styles.heroImage}
                  contentFit="cover"
                  contentPosition="top center"
                  accessibilityLabel={slide.description}
                />
              </View>
            </View>

            {/* Description */}
            <Body size="base" style={[styles.description, { color: theme.colors.mutedForeground }]}>
              {slide.description}
            </Body>
          </View>
        ))}
      </ScrollView>

      {/* Fixed Actions & Footer (Bottom) */}
      <View style={[styles.bottomContainer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity
          activeOpacity={0.85}
          style={[styles.primaryButton, { backgroundColor: theme.colors.primary }]}
          onPress={() => finishOnboarding("register")}
          accessibilityRole="button"
        >
          <Body size="base" style={[styles.primaryButtonText, { color: theme.colors.primaryForeground }]}>
            Create account
          </Body>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          style={[styles.secondaryButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.primary }]}
          onPress={() => finishOnboarding("login")}
          accessibilityRole="button"
        >
          <Body size="base" style={[styles.secondaryButtonText, { color: theme.colors.primary }]}>
            Sign in
          </Body>
        </TouchableOpacity>

        <Body size="xs" style={[styles.disclaimer, { color: theme.colors.mutedForeground }]}>
          Links in the app are sponsored.
        </Body>

        <View style={styles.legalRow}>
          <TouchableOpacity
            onPress={() => Linking.openURL("https://luxe.marketplace/terms")}
            hitSlop={8}
          >
            <Body size="xs" style={[styles.legalLink, { color: theme.colors.mutedForeground }]}>
              User Terms
            </Body>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => Linking.openURL("https://luxe.marketplace/privacy")}
            hitSlop={8}
          >
            <Body size="xs" style={[styles.legalLink, { color: theme.colors.mutedForeground }]}>
              Privacy
            </Body>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  progressRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing[2],
    marginTop: spacing[3],
    marginBottom: spacing[4],
  },
  progressSegment: {
    width: 56,
    height: 4,
    borderRadius: radii.full,
  },
  slider: {
    flex: 1,
  },
  sliderContent: {
    alignItems: "center",
  },
  slide: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[6],
  },
  title: {
    textAlign: "center",
    marginBottom: spacing[6],
  },
  heroWrap: {
    alignItems: "center",
    marginBottom: spacing[6],
  },
  arch: {
    width: "100%",
    maxWidth: 280,
    height: 220,
    borderTopLeftRadius: 140,
    borderTopRightRadius: 140,
    borderBottomLeftRadius: radii["2xl"],
    borderBottomRightRadius: radii["2xl"],
    overflow: "hidden",
    alignItems: "center",
  },
  heroImage: {
    width: "118%",
    height: 480,
    marginTop: -190,
  },
  description: {
    textAlign: "center",
    paddingHorizontal: spacing[4],
    lineHeight: 20,
  },
  bottomContainer: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[4],
  },
  primaryButton: {
    borderRadius: radii.full,
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing[3],
  },
  primaryButtonText: {
    fontFamily: fontFamilies.sans.semibold,
    fontWeight: "600",
  },
  secondaryButton: {
    borderRadius: radii.full,
    borderWidth: 1.5,
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing[8],
  },
  secondaryButtonText: {
    fontFamily: fontFamilies.sans.semibold,
    fontWeight: "600",
  },
  disclaimer: {
    textAlign: "center",
    marginBottom: spacing[3],
  },
  legalRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing[8],
  },
  legalLink: {
    textDecorationLine: "underline",
  },
});
