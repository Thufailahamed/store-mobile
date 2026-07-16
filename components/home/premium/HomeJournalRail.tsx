import React, { useMemo, useState } from "react";
import { View, ScrollView, TouchableOpacity, StyleSheet, Text } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { HomeSectionHeader } from "./HomeSectionHeader";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import type { BlogPost } from "@/lib/types";

const CARD_WIDTH = 260;

function formatDate(value?: string) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface JournalTab {
  label: string;
  posts: BlogPost[];
}

interface HomeJournalRailProps {
  posts: BlogPost[];
  title?: string;
  kicker?: string;
  seeAllHref?: string;
  /**
   * When provided, renders a segmented tab control instead of a single
   * list — used to fold "From the journal" and "Top stories this week"
   * into one section instead of two stacked, visually identical rails.
   */
  tabs?: JournalTab[];
}

export function HomeJournalRail({
  posts,
  title = "From the journal",
  kicker,
  seeAllHref = "/(main)/blog",
  tabs,
}: HomeJournalRailProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(0);
  const hasTabs = Boolean(tabs && tabs.length > 1);
  const activePosts = hasTabs ? tabs![activeTab]?.posts ?? [] : posts;
  const list = useMemo(() => activePosts.slice(0, 6), [activePosts]);
  if (!list.length) return null;

  return (
    <View style={styles.wrap}>
      <HomeSectionHeader
        title={title}
        kicker={kicker}
        onPress={() => router.push(seeAllHref as never)}
      />
      {hasTabs ? (
        <View style={styles.tabRow}>
          {tabs!.map((tab, i) => (
            <TouchableOpacity
              key={tab.label}
              style={[styles.tabBtn, i === activeTab && styles.tabBtnActive]}
              onPress={() => setActiveTab(i)}
              activeOpacity={0.75}
            >
              <Text style={[styles.tabText, i === activeTab && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {list.map((post) => (
          <TouchableOpacity
            key={post.id}
            style={styles.card}
            activeOpacity={0.88}
            onPress={() => router.push(`/(main)/blog/${post.slug}`)}
          >
            <View style={styles.imageWrap}>
              {post.cover_image ? (
                <Image source={{ uri: post.cover_image }} style={styles.image} contentFit="cover" />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Text style={styles.placeholderText}>LUXE</Text>
                </View>
              )}
            </View>
            <Text style={styles.date}>{formatDate(post.published_at)}</Text>
            <Text style={styles.title} numberOfLines={2}>
              {post.title}
            </Text>
            {post.excerpt ? (
              <Text style={styles.excerpt} numberOfLines={2}>
                {post.excerpt}
              </Text>
            ) : null}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing[8],
  },
  tabRow: {
    flexDirection: "row",
    gap: spacing[2],
    paddingHorizontal: spacing[5],
    marginBottom: spacing[4],
  },
  tabBtn: {
    paddingHorizontal: spacing[3],
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: colors.light.muted,
  },
  tabBtnActive: {
    backgroundColor: colors.light.foreground,
  },
  tabText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    color: colors.light.mutedForeground,
  },
  tabTextActive: {
    color: colors.light.card,
  },
  scroll: {
    paddingHorizontal: spacing[5],
    gap: spacing[3],
  },
  card: {
    width: CARD_WIDTH,
    gap: spacing[2],
  },
  imageWrap: {
    width: CARD_WIDTH,
    height: 160,
    borderRadius: radii["2xl"],
    overflow: "hidden",
    backgroundColor: colors.olive[50],
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.olive[100],
  },
  placeholderText: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 22,
    color: colors.light.primary,
    letterSpacing: 2,
  },
  date: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 11,
    color: colors.light.mutedForeground,
    letterSpacing: 0.3,
  },
  title: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 16,
    color: colors.light.foreground,
    lineHeight: 21,
    letterSpacing: -0.2,
  },
  excerpt: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    color: colors.light.mutedForeground,
    lineHeight: 18,
  },
});
