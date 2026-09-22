import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { fontFamilies } from "@/lib/theme/fonts";
import { colors, radii, shadows, spacing } from "@/lib/theme/tokens";

const TRENDING = [
  "Linen blazer",
  "Leather loafers",
  "Silk scarf",
  "Resort '26",
  "Vintage denim",
  "Hoodie",
];

const QUICK_CATEGORIES = [
  { label: "Women", slug: "women", icon: "woman-outline" as const },
  { label: "Men", slug: "men", icon: "man-outline" as const },
  { label: "Footwear", slug: "footwear", icon: "footsteps-outline" as const },
  { label: "Accessories", slug: "accessories", icon: "glasses-outline" as const },
];

const AI_TOOLS = [
  {
    label: "AI stylist",
    description: "Chat your way to a look",
    route: "/(main)/ai/stylist",
    icon: "chatbubble-ellipses-outline" as const,
  },
  {
    label: "Smart search",
    description: "Describe your perfect find",
    route: "/(main)/ai/search",
    icon: "search-outline" as const,
  },
  {
    label: "Outfit builder",
    description: "Create a complete look",
    route: "/(main)/ai/outfit",
    icon: "shirt-outline" as const,
  },
  {
    label: "Trend forecast",
    description: "Explore what is next",
    route: "/(main)/ai/trends",
    icon: "trending-up" as const,
  },
  {
    label: "Visual match",
    description: "Shop from any image",
    route: "/(main)/search/image-results",
    icon: "image-outline" as const,
  },
];

interface SearchDiscoverProps {
  recentSearches: string[];
  onSearch: (term: string) => void;
  onClearRecent: () => void;
}

function SectionHeader({
  title,
  eyebrow,
  action,
}: {
  title: string;
  eyebrow: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View>
        <Text style={styles.sectionEyebrow}>{eyebrow}</Text>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {action}
    </View>
  );
}

export function SearchDiscover({ recentSearches, onSearch, onClearRecent }: SearchDiscoverProps) {
  const router = useRouter();

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.content}
    >
      {recentSearches.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader
            eyebrow="History"
            title="Pick up where you left off"
            action={
              <TouchableOpacity onPress={onClearRecent} hitSlop={8} style={styles.clearButton}>
                <Text style={styles.clearText}>Clear</Text>
              </TouchableOpacity>
            }
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.recentRow}
          >
            {recentSearches.slice(0, 8).map((term) => (
              <TouchableOpacity
                key={term}
                style={styles.recentChip}
                onPress={() => onSearch(term)}
                activeOpacity={0.78}
              >
                <View style={styles.recentIcon}>
                  <Ionicons name="time-outline" size={14} color={colors.olive[700]} />
                </View>
                <Text style={styles.recentText} numberOfLines={1}>{term}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionHeader eyebrow="Now" title="Trending searches" />
        <View style={styles.trendingCard}>
          {TRENDING.map((term, index) => (
            <TouchableOpacity
              key={term}
              style={[styles.trendRow, index === TRENDING.length - 1 && styles.trendRowLast]}
              onPress={() => onSearch(term)}
              activeOpacity={0.76}
            >
              <View style={[styles.trendRank, index < 3 && styles.trendRankHot]}>
                <Text style={[styles.trendRankText, index < 3 && styles.trendRankTextHot]}>
                  {String(index + 1).padStart(2, "0")}
                </Text>
              </View>
              <Text style={styles.trendLabel}>{term}</Text>
              <View style={styles.trendArrow}>
                <Ionicons name="arrow-up" size={14} color={colors.olive[700]} style={styles.arrowTilt} />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader eyebrow="Departments" title="Browse the catalogue" />
        <View style={styles.categoryGrid}>
          {QUICK_CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.slug}
              style={styles.categoryCard}
              onPress={() => router.push(`/(main)/products?category=${cat.slug}`)}
              activeOpacity={0.78}
            >
              <View style={styles.categoryIcon}>
                <Ionicons name={cat.icon} size={19} color={colors.olive[800]} />
              </View>
              <Text style={styles.categoryText}>{cat.label}</Text>
              <Ionicons name="arrow-forward" size={15} color={colors.light.mutedForeground} />
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.aiHeader}>
          <View style={styles.aiSpark}>
            <Ionicons name="sparkles" size={17} color={colors.accent2.ochre} />
          </View>
          <View style={styles.aiHeaderText}>
            <Text style={styles.aiEyebrow}>LUXE AI</Text>
            <Text style={styles.aiTitle}>Your personal style studio</Text>
            <Text style={styles.aiSubtitle}>Search, style and discover with intelligent tools.</Text>
          </View>
        </View>
        <View style={styles.aiGrid}>
          {AI_TOOLS.map((item) => (
            <TouchableOpacity
              key={item.route}
              style={styles.aiCard}
              onPress={() => router.push(item.route as never)}
              activeOpacity={0.8}
            >
              <View style={styles.aiIcon}>
                <Ionicons name={item.icon} size={17} color={colors.accent2.ochre} />
              </View>
              <Text style={styles.aiCardTitle}>{item.label}</Text>
              <Text style={styles.aiCardDescription} numberOfLines={2}>{item.description}</Text>
              <Ionicons name="arrow-forward" size={14} color={`${colors.paper.cream}99`} />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
    paddingBottom: spacing[16],
    gap: spacing[7],
  },
  section: {
    gap: spacing[3],
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  sectionEyebrow: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    letterSpacing: 1.3,
    textTransform: "uppercase",
    color: colors.olive[600],
    marginBottom: 3,
  },
  sectionTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 18,
    color: colors.light.foreground,
  },
  clearButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: `${colors.accent2.rust}10`,
  },
  clearText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    color: colors.accent2.rust,
  },
  recentRow: {
    gap: spacing[2],
    paddingRight: spacing[4],
  },
  recentChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    minHeight: 42,
    maxWidth: 190,
    paddingLeft: 6,
    paddingRight: 14,
    borderRadius: radii.full,
    backgroundColor: colors.paper.cream,
    borderWidth: 1,
    borderColor: colors.light.border,
    ...shadows.soft,
  },
  recentIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${colors.olive[500]}12`,
  },
  recentText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 14,
    color: colors.light.foreground,
    flexShrink: 1,
  },
  trendingCard: {
    overflow: "hidden",
    borderRadius: radii["2xl"],
    backgroundColor: colors.paper.cream,
    borderWidth: 1,
    borderColor: colors.light.border,
    ...shadows.soft,
  },
  trendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    minHeight: 56,
    paddingHorizontal: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: `${colors.olive[900]}12`,
  },
  trendRowLast: {
    borderBottomWidth: 0,
  },
  trendRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.paper.warm,
  },
  trendRankHot: {
    backgroundColor: colors.olive[900],
  },
  trendRankText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
    color: colors.light.mutedForeground,
  },
  trendRankTextHot: {
    color: colors.paper.cream,
  },
  trendLabel: {
    flex: 1,
    fontFamily: fontFamilies.sans.medium,
    fontSize: 15,
    color: colors.light.foreground,
  },
  trendArrow: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${colors.olive[500]}10`,
  },
  arrowTilt: {
    transform: [{ rotate: "45deg" }],
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[2],
  },
  categoryCard: {
    width: "48.8%",
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    padding: spacing[2],
    borderRadius: radii.xl,
    backgroundColor: colors.paper.cream,
    borderWidth: 1,
    borderColor: colors.light.border,
    ...shadows.soft,
  },
  categoryIcon: {
    width: 38,
    height: 38,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${colors.olive[500]}12`,
  },
  categoryText: {
    flex: 1,
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: colors.light.foreground,
  },
  aiHeader: {
    flexDirection: "row",
    gap: spacing[3],
    padding: spacing[4],
    paddingBottom: spacing[3],
    borderTopLeftRadius: radii["2xl"],
    borderTopRightRadius: radii["2xl"],
    backgroundColor: colors.olive[950],
  },
  aiSpark: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${colors.accent2.ochre}20`,
    borderWidth: 1,
    borderColor: `${colors.accent2.ochre}55`,
  },
  aiHeaderText: {
    flex: 1,
  },
  aiEyebrow: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 1.4,
    color: colors.accent2.ochre,
    marginBottom: 3,
  },
  aiTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 17,
    color: colors.paper.cream,
  },
  aiSubtitle: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    lineHeight: 16,
    color: `${colors.paper.cream}99`,
    marginTop: 3,
  },
  aiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 1,
    overflow: "hidden",
    borderBottomLeftRadius: radii["2xl"],
    borderBottomRightRadius: radii["2xl"],
    backgroundColor: `${colors.paper.cream}22`,
  },
  aiCard: {
    width: "49.8%",
    minHeight: 132,
    padding: spacing[3],
    backgroundColor: colors.olive[900],
  },
  aiIcon: {
    width: 32,
    height: 32,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${colors.accent2.ochre}18`,
    marginBottom: spacing[2],
  },
  aiCardTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: colors.paper.cream,
    marginBottom: 3,
  },
  aiCardDescription: {
    flex: 1,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 10,
    lineHeight: 14,
    color: `${colors.paper.cream}88`,
  },
});
