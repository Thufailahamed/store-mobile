import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { fontFamilies } from "@/lib/theme/fonts";
import { colors, radii, spacing } from "@/lib/theme/tokens";

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

type AiTool = {
  label: string;
  description: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
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

function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
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

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={styles.content}
    >
      {recentSearches.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader
            title="Recent searches"
            action={
              <TouchableOpacity
                onPress={onClearRecent}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Clear recent searches"
              >
                <Text style={styles.clearText}>Clear all</Text>
              </TouchableOpacity>
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
              <TouchableOpacity
                key={term}
                style={styles.chip}
                onPress={() => onSearch(term)}
                activeOpacity={0.78}
                accessibilityRole="button"
                accessibilityLabel={`Search ${term}`}
              >
                <Ionicons name="time-outline" size={14} color={colors.light.mutedForeground} />
                <Text style={styles.chipText} numberOfLines={1}>{term}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionHeader title="Trending now" />
        <View style={styles.chipWrap}>
          {TRENDING.map((term, index) => (
            <TouchableOpacity
              key={term}
              style={[styles.chip, index < 3 && styles.chipHot]}
              onPress={() => onSearch(term)}
              activeOpacity={0.78}
              accessibilityRole="button"
              accessibilityLabel={`Search ${term}`}
            >
              {index < 3 ? (
                <Ionicons name="flame" size={13} color={colors.accent2.rust} />
              ) : (
                <Ionicons name="trending-up" size={14} color={colors.olive[600]} />
              )}
              <Text style={styles.chipText}>{term}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Shop by department" />
        <View style={styles.categoryRow}>
          {QUICK_CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.slug}
              style={styles.categoryTile}
              onPress={() => router.push(`/(main)/products?category=${cat.slug}`)}
              activeOpacity={0.78}
              accessibilityRole="button"
              accessibilityLabel={`Shop ${cat.label}`}
            >
              <View style={styles.categoryIcon}>
                <Ionicons name={cat.icon} size={22} color={colors.olive[800]} />
              </View>
              <Text
                style={styles.categoryText}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
              >
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.aiPanel}>
        <View style={styles.aiHeader}>
          <View style={styles.aiBadge}>
            <Ionicons name="sparkles" size={15} color={colors.accent2.ochre} />
          </View>
          <View style={styles.aiHeaderText}>
            <Text style={styles.aiTitle}>Search smarter with LUXE AI</Text>
            <Text style={styles.aiSubtitle}>Find it faster — by chat, description or photo</Text>
          </View>
        </View>
        <View style={styles.aiList}>
          {aiTools.map((item, index) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.aiRow, index > 0 && styles.aiRowDivider]}
              onPress={() => {
                if (item.action === "visual") onVisualSearch?.();
                else if (item.route) router.push(item.route as never);
              }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`${item.label}. ${item.description}`}
            >
              <View style={styles.aiIcon}>
                <Ionicons name={item.icon} size={17} color={colors.accent2.ochre} />
              </View>
              <View style={styles.aiRowText}>
                <Text style={styles.aiCardTitle}>{item.label}</Text>
                <Text style={styles.aiCardDescription} numberOfLines={1}>{item.description}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={`${colors.paper.cream}66`} />
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
    paddingTop: spacing[5],
    paddingBottom: spacing[16],
    gap: spacing[7],
  },
  section: {
    gap: spacing[3],
  },
  bleed: {
    marginHorizontal: -spacing[4],
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 17,
    color: colors.light.foreground,
  },
  clearText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 13,
    color: colors.olive[700],
  },
  chipRow: {
    gap: spacing[2],
    paddingHorizontal: spacing[4],
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[2],
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    maxWidth: 220,
    paddingHorizontal: 14,
    borderRadius: radii.full,
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  chipHot: {
    backgroundColor: `${colors.accent2.rust}0D`,
    borderColor: `${colors.accent2.rust}33`,
  },
  chipText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 14,
    color: colors.light.foreground,
    flexShrink: 1,
  },
  categoryRow: {
    flexDirection: "row",
    gap: spacing[2],
  },
  categoryTile: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    gap: spacing[2],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[1],
    borderRadius: radii.xl,
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  categoryIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${colors.olive[500]}12`,
  },
  categoryText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    color: colors.light.foreground,
  },
  aiPanel: {
    padding: spacing[4],
    gap: spacing[3],
    borderRadius: radii["2xl"],
    backgroundColor: colors.olive[950],
  },
  aiHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
  },
  aiBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${colors.accent2.ochre}1F`,
  },
  aiHeaderText: {
    flex: 1,
    gap: 2,
  },
  aiTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 16,
    color: colors.paper.cream,
  },
  aiSubtitle: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: `${colors.paper.cream}99`,
  },
  aiList: {
    borderRadius: radii.xl,
    backgroundColor: colors.olive[900],
    borderWidth: 1,
    borderColor: `${colors.paper.cream}14`,
    overflow: "hidden",
  },
  aiRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
  },
  aiRowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: `${colors.paper.cream}1F`,
  },
  aiIcon: {
    width: 32,
    height: 32,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${colors.accent2.ochre}18`,
  },
  aiRowText: {
    flex: 1,
    gap: 1,
  },
  aiCardTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14,
    color: colors.paper.cream,
  },
  aiCardDescription: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: `${colors.paper.cream}99`,
  },
});
