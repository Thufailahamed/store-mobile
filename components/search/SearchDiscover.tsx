import React from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";
import * as api from "@/lib/api";
import { useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { fontFamilies } from "@/lib/theme/fonts";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import { C } from "@/components/orders/parcel-track";

const CREAM = colors.paper.cream;
const INK = colors.ink.DEFAULT;

const TRENDING = [
  { term: "Linen blazer", delta: "+248%" },
  { term: "Leather loafers", delta: "+182%" },
  { term: "Silk scarf", delta: "+131%" },
  { term: "Resort '26", delta: "+96%" },
  { term: "Vintage denim", delta: "+74%" },
  { term: "Hoodie", delta: "+58%" },
];

type IconName = React.ComponentProps<typeof Ionicons>["name"];

const QUICK_CATEGORIES: {
  label: string;
  slug: string;
  icon: IconName;
  caption: string;
  gradient: [string, string];
  dark: boolean;
}[] = [
  { label: "Women", slug: "women", icon: "woman-outline", caption: "New season", gradient: [colors.olive[700], colors.olive[950]], dark: true },
  { label: "Men", slug: "men", icon: "man-outline", caption: "Tailoring & more", gradient: ["#efe7d6", "#dccfb4"], dark: false },
  { label: "Footwear", slug: "footwear", icon: "footsteps-outline", caption: "Crafted soles", gradient: ["#e9d6c8", "#c99a7e"], dark: false },
  { label: "Accessories", slug: "accessories", icon: "glasses-outline", caption: "Finishing touches", gradient: ["#2a2c1f", "#0f100b"], dark: true },
];

type AiTool = {
  label: string;
  description: string;
  icon: IconName;
  route?: string;
  action?: "visual";
};

const AI_TOOLS: AiTool[] = [
  {
    label: "AI stylist",
    description: "Chat your way to a look",
    route: "/(main)/ai/stylist",
    icon: "chatbubble-ellipses-outline",
  },
  {
    label: "Smart search",
    description: "Describe your perfect find",
    route: "/(main)/ai/search",
    icon: "search-outline",
  },
  {
    label: "Outfit builder",
    description: "Create a complete look",
    route: "/(main)/ai/outfit",
    icon: "shirt-outline",
  },
  {
    label: "Trend forecast",
    description: "Explore what's next",
    route: "/(main)/ai/trends",
    icon: "trending-up",
  },
  {
    label: "Visual match",
    description: "Shop from any photo",
    action: "visual",
    icon: "image-outline",
  },
];

interface SearchDiscoverProps {
  recentSearches: string[];
  onSearch: (term: string) => void;
  onClearRecent: () => void;
  /** Opens the photo picker and runs a visual search. */
  onVisualSearch?: () => void;
}

type QuickCategory = (typeof QUICK_CATEGORIES)[number];

/** Category photos keyed by slug (shared cache with any other category fetch). */
function useDepartmentImages() {
  return useQuery({
    queryKey: ["categories", "all"],
    queryFn: async () => {
      const res = await api.getAllCategories();
      return res.ok ? res.data : [];
    },
    staleTime: 10 * 60_000,
    select: (cats) => {
      const map: Record<string, string> = {};
      for (const c of cats) if (c.slug && c.image_url) map[c.slug] = c.image_url;
      return map;
    },
  });
}

function DeptTile({
  cat,
  index,
  image,
  variant,
  onPress,
}: {
  cat: QuickCategory;
  index: number;
  image?: string;
  variant: "tall" | "square" | "wide";
  onPress: () => void;
}) {
  const wide = variant === "wide";
  return (
    <PressableScale
      style={[styles.deptShadow, variant === "tall" ? styles.deptTall : variant === "wide" ? styles.deptWide : styles.deptSquare]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Shop ${cat.label}`}
    >
      <View style={styles.deptCard}>
        {image ? (
          <Image source={{ uri: image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
        ) : (
          <LinearGradient colors={cat.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill}>
            <View style={styles.deptFallbackIcon}>
              <Ionicons name={cat.icon} size={wide ? 56 : 48} color={cat.dark ? `${CREAM}2E` : `${INK}1F`} />
            </View>
          </LinearGradient>
        )}
        {/* Legibility scrim: bottom-up on tiles, left-to-right on the banner */}
        <LinearGradient
          colors={
            wide
              ? ["rgba(13,14,10,0.86)", "rgba(13,14,10,0.45)", "rgba(13,14,10,0)"]
              : ["rgba(13,14,10,0.18)", "rgba(13,14,10,0)", "rgba(13,14,10,0.78)"]
          }
          locations={wide ? [0, 0.5, 1] : [0, 0.38, 1]}
          start={wide ? { x: 0, y: 0.5 } : { x: 0.5, y: 0 }}
          end={wide ? { x: 1, y: 0.5 } : { x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.deptHairline} pointerEvents="none" />

        <View style={styles.deptTopRow}>
          <Text style={styles.deptIndex}>{String(index + 1).padStart(2, "0")}</Text>
          <View style={styles.deptGlassArrow}>
            <Ionicons name="arrow-forward" size={14} color={C.ink} />
          </View>
        </View>

        <View style={wide ? styles.deptCopyWide : undefined}>
          <Text style={[styles.deptLabel, variant === "tall" && styles.deptLabelTall]} numberOfLines={1}>
            {cat.label}
          </Text>
          <Text style={styles.deptCaption} numberOfLines={1}>
            {cat.caption}
          </Text>
          {variant !== "square" ? (
            <View style={styles.deptCta}>
              <Text style={styles.deptCtaText}>Shop now</Text>
              <View style={styles.deptCtaRule} />
            </View>
          ) : null}
        </View>
      </View>
    </PressableScale>
  );
}

/**
 * Department bento — tall lead tile, two stacked squares, and a wide
 * banner. Photos come from the category records; each tile falls back to
 * its tonal gradient + icon when a category has no image yet.
 */
function DepartmentBento({ onOpen }: { onOpen: (slug: string) => void }) {
  const { data: images = {} } = useDepartmentImages();
  const [lead, a, b, wide] = QUICK_CATEGORIES;
  return (
    <View style={styles.deptBento}>
      <View style={styles.deptRow}>
        <DeptTile cat={lead} index={0} image={images[lead.slug]} variant="tall" onPress={() => onOpen(lead.slug)} />
        <View style={styles.deptCol}>
          <DeptTile cat={a} index={1} image={images[a.slug]} variant="square" onPress={() => onOpen(a.slug)} />
          <DeptTile cat={b} index={2} image={images[b.slug]} variant="square" onPress={() => onOpen(b.slug)} />
        </View>
      </View>
      <DeptTile cat={wide} index={3} image={images[wide.slug]} variant="wide" onPress={() => onOpen(wide.slug)} />
    </View>
  );
}

function PressableScale({
  style,
  children,
  scale = 0.97,
  ...rest
}: React.ComponentProps<typeof Pressable> & { style?: StyleProp<ViewStyle>; scale?: number }) {
  return (
    <Pressable
      {...rest}
      style={({ pressed }) => [style, pressed && { transform: [{ scale }], opacity: 0.92 }]}
    >
      {children}
    </Pressable>
  );
}

function SectionHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderText}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {action}
    </View>
  );
}

export function SearchDiscover({
  recentSearches,
  onSearch,
  onClearRecent,
  onVisualSearch,
}: SearchDiscoverProps) {
  const router = useRouter();
  const aiTools = AI_TOOLS.filter((t) => t.action !== "visual" || onVisualSearch);
  const [featuredTool, ...otherTools] = aiTools;

  const runTool = (item: AiTool) => {
    if (item.action === "visual") onVisualSearch?.();
    else if (item.route) router.push(item.route as never);
  };

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={styles.content}
    >
      <View style={styles.hero}>
        <Text style={styles.heroEyebrow}>THE LUXE EDIT</Text>
        <Text style={styles.heroTitle}>
          What are you <Text style={styles.heroTitleItalic}>looking for</Text> today?
        </Text>
      </View>

      {recentSearches.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader
            eyebrow="Your history"
            title="Recent searches"
            action={
              <Pressable
                onPress={onClearRecent}
                hitSlop={10}
                style={({ pressed }) => [styles.clearBtn, pressed && { opacity: 0.6 }]}
                accessibilityRole="button"
                accessibilityLabel="Clear recent searches"
              >
                <Text style={styles.clearText}>Clear all</Text>
              </Pressable>
            }
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.chipRow}
            style={styles.bleed}
          >
            {recentSearches.slice(0, 8).map((term) => (
              <PressableScale
                key={term}
                style={styles.recentChip}
                onPress={() => onSearch(term)}
                accessibilityRole="button"
                accessibilityLabel={`Search ${term}`}
              >
                <View style={styles.recentChipIcon}>
                  <Ionicons name="time-outline" size={13} color={C.text} />
                </View>
                <Text style={styles.recentChipText} numberOfLines={1}>{term}</Text>
                <Ionicons name="arrow-up-outline" size={13} color={colors.light.mutedForeground} style={styles.recentChipArrow} />
              </PressableScale>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionHeader
          eyebrow="This week"
          title="Trending now"
          action={
            <View style={styles.livePill}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>Live</Text>
            </View>
          }
        />
        <View style={styles.trendCard}>
          {TRENDING.map((item, index) => {
            const hot = index < 3;
            return (
              <PressableScale
                key={item.term}
                scale={0.985}
                style={[styles.trendRow, index > 0 && styles.trendRowDivider]}
                onPress={() => onSearch(item.term)}
                accessibilityRole="button"
                accessibilityLabel={`Search ${item.term}`}
              >
                <View style={[styles.trendRankBadge, hot && styles.trendRankBadgeHot]}>
                  <Text style={[styles.trendRank, hot && styles.trendRankHot]}>
                    {String(index + 1).padStart(2, "0")}
                  </Text>
                </View>
                <View style={styles.trendBody}>
                  <Text style={styles.trendTerm} numberOfLines={1}>{item.term}</Text>
                  {hot ? (
                    <View style={styles.hotPill}>
                      <Ionicons name="flame" size={10} color={C.ink} />
                      <Text style={styles.hotText}>Hot</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.trendDelta}>
                  <Ionicons name="trending-up" size={12} color={C.accent} />
                  <Text style={styles.trendDeltaText}>{item.delta}</Text>
                </View>
              </PressableScale>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader eyebrow="Explore" title="Shop by department" />
        <DepartmentBento onOpen={(slug) => router.push(`/(main)/products?category=${slug}`)} />
      </View>

      <View style={styles.aiShadow}>
        <LinearGradient
          colors={["#22241a", C.ink, "#0b0c07"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.aiPanel}
        >
          <View style={styles.aiGlowA} />
          <View style={styles.aiGlowB} />

          <View style={styles.aiHeader}>
            <View style={styles.aiBrandRow}>
              <View style={styles.aiBadge}>
                <Ionicons name="sparkles" size={14} color={C.ink} />
              </View>
              <Text style={styles.aiBrand}>LUXE AI</Text>
              <View style={styles.aiNewPill}>
                <Text style={styles.aiNewText}>NEW</Text>
              </View>
            </View>
            <Text style={styles.aiTitle}>
              Search <Text style={styles.aiTitleItalic}>smarter</Text>, not harder
            </Text>
            <Text style={styles.aiSubtitle}>Find it faster — by chat, description or photo</Text>
          </View>

          {featuredTool ? (
            <PressableScale
              style={styles.aiFeatured}
              onPress={() => runTool(featuredTool)}
              accessibilityRole="button"
              accessibilityLabel={`${featuredTool.label}. ${featuredTool.description}`}
            >
              <View style={styles.aiFeaturedIcon}>
                <Ionicons name={featuredTool.icon} size={20} color={C.ink} />
              </View>
              <View style={styles.aiRowText}>
                <Text style={styles.aiFeaturedTitle}>{featuredTool.label}</Text>
                <Text style={styles.aiFeaturedDescription} numberOfLines={1}>{featuredTool.description}</Text>
              </View>
              <View style={styles.aiFeaturedCta}>
                <Text style={styles.aiFeaturedCtaText}>Start</Text>
                <Ionicons name="arrow-forward" size={13} color={C.lime} />
              </View>
            </PressableScale>
          ) : null}

          <View style={styles.aiGrid}>
            {otherTools.map((item) => (
              <PressableScale
                key={item.label}
                style={styles.aiTile}
                onPress={() => runTool(item)}
                accessibilityRole="button"
                accessibilityLabel={`${item.label}. ${item.description}`}
              >
                <View style={styles.aiTileTop}>
                  <View style={styles.aiIcon}>
                    <Ionicons name={item.icon} size={17} color={C.lime} />
                  </View>
                  <Ionicons name="arrow-forward" size={14} color={`${CREAM}59`} style={styles.aiTileArrow} />
                </View>
                <Text style={styles.aiCardTitle} numberOfLines={1}>{item.label}</Text>
                <Text style={styles.aiCardDescription} numberOfLines={2}>{item.description}</Text>
              </PressableScale>
            ))}
          </View>
        </LinearGradient>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[6],
    paddingBottom: spacing[20],
    gap: spacing[8],
  },
  hero: {
    gap: spacing[2],
  },
  heroEyebrow: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10.5,
    letterSpacing: 2,
    color: C.accent,
  },
  heroTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 31,
    lineHeight: 37,
    letterSpacing: -0.8,
    color: C.text,
  },
  heroTitleItalic: {
    fontFamily: fontFamilies.display.italic,
    color: C.accent,
  },
  section: {
    gap: spacing[4],
  },
  bleed: {
    marginHorizontal: -spacing[5],
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  sectionHeaderText: {
    gap: 3,
  },
  eyebrow: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: C.accent,
  },
  sectionTitle: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 20,
    letterSpacing: -0.4,
    color: C.text,
  },
  clearBtn: {
    paddingHorizontal: 14,
    height: 32,
    justifyContent: "center",
    borderRadius: radii.full,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: C.line,
  },
  clearText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12.5,
    color: C.accent,
  },
  chipRow: {
    gap: spacing[2],
    paddingHorizontal: spacing[5],
    paddingVertical: 4,
  },
  recentChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 42,
    maxWidth: 230,
    paddingLeft: 6,
    paddingRight: 14,
    borderRadius: radii.full,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: C.line,
  },
  recentChipIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.accentSoft,
  },
  recentChipText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14,
    color: C.text,
    flexShrink: 1,
  },
  recentChipArrow: {
    transform: [{ rotate: "-45deg" }],
  },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 28,
    paddingHorizontal: 11,
    borderRadius: radii.full,
    backgroundColor: C.ink,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.lime,
  },
  liveText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 11.5,
    color: C.cream,
  },
  trendCard: {
    borderRadius: 26,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: C.line,
    paddingHorizontal: 14,
    shadowColor: C.ink,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.07,
    shadowRadius: 20,
    elevation: 3,
  },
  trendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
  },
  trendRowDivider: {
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  trendRank: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 13,
    color: C.text,
    fontVariant: ["tabular-nums"],
  },
  trendRankBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.accentSoft,
  },
  trendRankBadgeHot: {
    backgroundColor: C.ink,
  },
  trendRankHot: {
    color: C.lime,
  },
  trendBody: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
  },
  trendTerm: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 15,
    letterSpacing: -0.2,
    color: C.text,
    flexShrink: 1,
  },
  hotPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    height: 20,
    paddingHorizontal: 7,
    borderRadius: 10,
    backgroundColor: C.lime,
  },
  hotText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 10,
    color: C.ink,
  },
  trendDelta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 26,
    paddingHorizontal: 9,
    borderRadius: 13,
    backgroundColor: C.accentSoft,
  },
  trendDeltaText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 11.5,
    color: C.accent,
  },
  deptBento: {
    gap: spacing[3],
  },
  deptRow: {
    flexDirection: "row",
    gap: spacing[3],
  },
  deptCol: {
    flex: 1,
    gap: spacing[3],
  },
  deptShadow: {
    borderRadius: 26,
    backgroundColor: colors.olive[100],
    shadowColor: INK,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 5,
  },
  deptTall: {
    flex: 1.08,
    height: 296,
  },
  deptSquare: {
    height: 142,
  },
  deptWide: {
    height: 132,
  },
  deptCard: {
    flex: 1,
    borderRadius: 26,
    overflow: "hidden",
    padding: spacing[4],
    justifyContent: "space-between",
  },
  deptHairline: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(250,248,241,0.14)",
  },
  deptFallbackIcon: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  deptTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  deptIndex: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10.5,
    letterSpacing: 1.4,
    color: C.goldSoft,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.full,
    overflow: "hidden",
    backgroundColor: "rgba(22,23,15,0.72)",
  },
  deptGlassArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  deptCopyWide: {
    maxWidth: "62%",
  },
  deptLabel: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.4,
    color: CREAM,
  },
  deptLabelTall: {
    fontSize: 30,
    lineHeight: 34,
  },
  deptCaption: {
    fontFamily: fontFamilies.display.italic,
    fontSize: 13,
    marginTop: 1,
    color: "rgba(250,248,241,0.82)",
  },
  deptCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: spacing[2.5],
  },
  deptCtaText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9.5,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: C.lime,
  },
  deptCtaRule: {
    width: 22,
    height: 1,
    backgroundColor: C.lime,
  },
  aiShadow: {
    borderRadius: 28,
    shadowColor: C.ink,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.22,
    shadowRadius: 28,
    elevation: 10,
  },
  aiPanel: {
    padding: spacing[5],
    gap: spacing[4],
    borderRadius: 28,
    overflow: "hidden",
  },
  aiGlowA: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    top: -110,
    right: -70,
    backgroundColor: "rgba(200,224,138,0.08)",
  },
  aiGlowB: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    bottom: -90,
    left: -60,
    backgroundColor: `${colors.olive[400]}14`,
  },
  aiHeader: {
    gap: spacing[2],
  },
  aiBrandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    marginBottom: spacing[1],
  },
  aiBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.lime,
  },
  aiBrand: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 11,
    letterSpacing: 2,
    color: C.goldSoft,
  },
  aiNewPill: {
    paddingHorizontal: 7,
    height: 18,
    justifyContent: "center",
    borderRadius: 9,
    backgroundColor: C.lime,
  },
  aiNewText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 9,
    letterSpacing: 0.8,
    color: C.ink,
  },
  aiTitle: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 26,
    lineHeight: 31,
    letterSpacing: -0.5,
    color: CREAM,
  },
  aiTitleItalic: {
    fontFamily: fontFamilies.display.italic,
    color: C.lime,
  },
  aiSubtitle: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    color: `${CREAM}99`,
  },
  aiFeatured: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    padding: 12,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
  },
  aiFeaturedIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.lime,
  },
  aiRowText: {
    flex: 1,
    gap: 2,
  },
  aiFeaturedTitle: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 15,
    color: INK,
  },
  aiFeaturedDescription: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.light.mutedForeground,
  },
  aiFeaturedCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 34,
    paddingHorizontal: 14,
    borderRadius: radii.full,
    backgroundColor: C.ink,
  },
  aiFeaturedCtaText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 12.5,
    color: C.cream,
  },
  aiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[2.5],
  },
  aiTile: {
    flexBasis: "47%",
    flexGrow: 1,
    padding: spacing[3.5],
    gap: 4,
    borderRadius: 22,
    backgroundColor: "rgba(250,248,241,0.05)",
    borderWidth: 1,
    borderColor: "rgba(250,248,241,0.09)",
  },
  aiTileTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: spacing[2],
  },
  aiTileArrow: {
    transform: [{ rotate: "-45deg" }],
  },
  aiIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(200,224,138,0.12)",
  },
  aiCardTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14,
    color: CREAM,
  },
  aiCardDescription: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    lineHeight: 16,
    color: `${CREAM}8C`,
  },
});
