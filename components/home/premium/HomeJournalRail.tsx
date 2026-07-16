import React from "react";
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

interface HomeJournalRailProps {
  posts: BlogPost[];
  title?: string;
  kicker?: string;
  seeAllHref?: string;
}

export function HomeJournalRail({
  posts,
  title = "From the journal",
  kicker,
  seeAllHref = "/(main)/blog",
}: HomeJournalRailProps) {
  const router = useRouter();
  const list = posts.slice(0, 6);
  if (!list.length) return null;

  return (
    <View style={styles.wrap}>
      <HomeSectionHeader
        title={title}
        kicker={kicker}
        onPress={() => router.push(seeAllHref as never)}
      />
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
    marginBottom: spacing[6],
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
