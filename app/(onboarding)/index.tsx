import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@/components/ui/Icon";
import { completeOnboarding } from "@/lib/onboarding";
import { getOnboardingSlides, type OnboardingSlide } from "@/lib/api";
import { fontFamilies } from "@/lib/theme/fonts";
import { colors, radii, shadows, spacing } from "@/lib/theme/tokens";
import { useTheme } from "@/lib/hooks/useTheme";
import { Display, Body } from "@/components/ui/Typography";

interface SlideData extends OnboardingSlide {
  tag: string;
  localImage?: any;
  fallbackRemote: string;
}

const ONBOARDING_DATA: SlideData[] = [
  {
    title: "Find and shop\nstores you love",
    description:
      "Explore custom pieces and curated boutique collections hand-finished in our ateliers.",
    imageUrl: "",
    tag: "ATELIER CURATION",
    localImage: require("@/assets/onboarding-hero.png"),
    fallbackRemote:
      "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1000&q=80",
  },
  {
    title: "Curate your\npersonal collection",
    description:
      "Save items you adore and build your private wardrobe collection with custom styling options.",
    imageUrl: "",
    tag: "BESPOKE WARDROBE",
    localImage: require("@/assets/onboarding-curate.png"),
    fallbackRemote:
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1000&q=80",
  },
  {
    title: "Enjoy seamless\ncheckout & delivery",
    description:
      "Secure purchase, real-time shipping updates, and premium editorial packaging to your doorstep.",
    imageUrl: "",
    tag: "DIRECT DISPATCH",
    localImage: require("@/assets/onboarding-checkout.png"),
    fallbackRemote:
      "https://images.unsplash.com/photo-1469334031218-e382a71b716b?auto=format&fit=crop&w=1000&q=80",
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [slides, setSlides] = useState<SlideData[]>(ONBOARDING_DATA);

  // Responsive arch sizing
  const archWidth = Math.min(Math.round(SCREEN_WIDTH * 0.68), 260);
  const archHeight = Math.min(Math.max(Math.round(SCREEN_HEIGHT * 0.35), 260), 310);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await getOnboardingSlides();
      if (cancelled) return;
      if (res.ok && res.data.length > 0) {
        setSlides(
          res.data.map((b, i) => ({
            ...b,
            tag: ONBOARDING_DATA[i % ONBOARDING_DATA.length].tag,
            localImage: ONBOARDING_DATA[i % ONBOARDING_DATA.length].localImage,
            fallbackRemote: ONBOARDING_DATA[i % ONBOARDING_DATA.length].fallbackRemote,
          }))
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const finishOnboarding = async (destination: "register" | "login") => {
    await completeOnboarding();
    router.replace(destination === "register" ? "/(auth)/register" : "/(auth)/login");
  };

  const handleScroll = (event: any) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const currentIndex = Math.round(contentOffsetX / SCREEN_WIDTH);
    if (currentIndex !== activeSlide && currentIndex >= 0 && currentIndex < slides.length) {
      setActiveSlide(currentIndex);
    }
  };

  const goToSlide = (index: number) => {
    scrollRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true });
    setActiveSlide(index);
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top, backgroundColor: theme.colors.background }]}>
      {/* ── 1. Top Carousel Progress Indicators ───────────────── */}
      <View style={styles.progressRow}>
        {slides.map((_, index) => {
          const isActive = activeSlide === index;
          return (
            <TouchableOpacity
              key={index}
              onPress={() => goToSlide(index)}
              activeOpacity={0.8}
              hitSlop={8}
              style={[
                styles.progressSegment,
                isActive ? styles.progressSegmentActive : styles.progressSegmentInactive,
                { backgroundColor: isActive ? theme.colors.primary : theme.colors.muted },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Go to slide ${index + 1}`}
            />
          );
        })}
      </View>

      {/* ── 2. Carousel Slides ─────────────────────────────────── */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={styles.slider}
        contentContainerStyle={styles.sliderContent}
      >
        {slides.map((slide, index) => {
          const imageSource =
            slide.imageUrl && slide.imageUrl.trim().length > 0
              ? { uri: slide.imageUrl }
              : slide.localImage ?? { uri: slide.fallbackRemote };

          return (
            <View key={index} style={[styles.slide, { width: SCREEN_WIDTH }]}>
              {/* Slide Title */}
              <Display size="4xl" italic style={[styles.title, { color: theme.colors.foreground }]}>
                {slide.title}
              </Display>

              {/* Editorial Arch Frame */}
              <View style={styles.heroWrap}>
                <View
                  style={[
                    styles.arch,
                    {
                      width: archWidth,
                      height: archHeight,
                      borderTopLeftRadius: archWidth / 2,
                      borderTopRightRadius: archWidth / 2,
                      backgroundColor: theme.colors.card,
                    },
                  ]}
                >
                  <Image
                    source={imageSource}
                    style={StyleSheet.absoluteFillObject}
                    contentFit="cover"
                    contentPosition="center"
                    transition={300}
                    accessibilityLabel={slide.description}
                  />

                  {/* Soft Editorial Base Scrim */}
                  <LinearGradient
                    colors={["transparent", "rgba(22,23,15,0.03)", "rgba(22,23,15,0.3)"]}
                    style={StyleSheet.absoluteFillObject}
                  />

                  {/* Floating Tag Badge */}
                  <View style={styles.archBadge}>
                    <View style={styles.badgeDot} />
                    <Text style={styles.badgeText}>{slide.tag}</Text>
                  </View>
                </View>
              </View>

              {/* Subtitle / Description */}
              <Body size="base" style={[styles.description, { color: theme.colors.mutedForeground }]}>
                {slide.description}
              </Body>
            </View>
          );
        })}
      </ScrollView>

      {/* ── 3. Bottom Actions & Legal Links ───────────────────── */}
      <View style={[styles.bottomContainer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity
          activeOpacity={0.88}
          style={[styles.primaryButton, { backgroundColor: theme.colors.primary }]}
          onPress={() => finishOnboarding("register")}
          accessibilityRole="button"
          accessibilityLabel="Create account"
        >
          <Text style={[styles.primaryButtonText, { color: theme.colors.primaryForeground }]}>
            Create account
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.88}
          style={[styles.secondaryButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.primary }]}
          onPress={() => finishOnboarding("login")}
          accessibilityRole="button"
          accessibilityLabel="Sign in"
        >
          <Text style={[styles.secondaryButtonText, { color: theme.colors.primary }]}>
            Sign in
          </Text>
        </TouchableOpacity>

        <Text style={[styles.disclaimer, { color: theme.colors.mutedForeground }]}>
          Links in the app are sponsored.
        </Text>

        <View style={styles.legalRow}>
          <TouchableOpacity onPress={() => Linking.openURL("https://luxe.marketplace/terms")} hitSlop={8}>
            <Text style={[styles.legalLink, { color: theme.colors.mutedForeground }]}>
              User Terms
            </Text>
          </TouchableOpacity>
          <Text style={[styles.legalBullet, { color: theme.colors.mutedForeground }]}>·</Text>
          <TouchableOpacity onPress={() => Linking.openURL("https://luxe.marketplace/privacy")} hitSlop={8}>
            <Text style={[styles.legalLink, { color: theme.colors.mutedForeground }]}>
              Privacy
            </Text>
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
    alignItems: "center",
    gap: spacing[2],
    marginTop: spacing[3],
    marginBottom: spacing[2],
  },
  progressSegment: {
    height: 4,
    borderRadius: radii.full,
  },
  progressSegmentActive: {
    width: 48,
  },
  progressSegmentInactive: {
    width: 28,
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
    marginBottom: spacing[4],
    letterSpacing: -0.5,
  },
  heroWrap: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing[5],
  },
  arch: {
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#c8c8b8",
    ...shadows.soft,
  },
  archBadge: {
    position: "absolute",
    bottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: "rgba(251, 250, 247, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(200, 200, 184, 0.6)",
  },
  badgeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.olive[600],
  },
  badgeText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    color: colors.olive[900],
    letterSpacing: 0.8,
  },
  description: {
    textAlign: "center",
    paddingHorizontal: spacing[4],
    lineHeight: 22,
    fontSize: 14,
  },
  bottomContainer: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[2],
  },
  primaryButton: {
    borderRadius: radii.full,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing[3],
    ...shadows.soft,
  },
  primaryButtonText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 15,
  },
  secondaryButton: {
    borderRadius: radii.full,
    borderWidth: 1.5,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing[6],
  },
  secondaryButtonText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 15,
  },
  disclaimer: {
    textAlign: "center",
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    marginBottom: spacing[2],
  },
  legalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[2],
  },
  legalLink: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    textDecorationLine: "underline",
  },
  legalBullet: {
    fontSize: 12,
  },
});

