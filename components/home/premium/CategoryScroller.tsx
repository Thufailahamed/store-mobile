import React, { useEffect, useRef } from "react";
import { View, ScrollView, Pressable, StyleSheet, Text, Animated, Easing } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { colors, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import type { Category } from "@/lib/types";

const TILE_W = 58;
const TILE_H = TILE_W;
const RING = 3;
const ITEM_W = 76;

interface CategoryScrollerProps {
  categories: Category[];
}

function ArchTile({
  label,
  onPress,
  children,
  dark,
}: {
  label: string;
  onPress: () => void;
  children: React.ReactNode;
  dark?: boolean;
}) {
  const press = useRef(new Animated.Value(0)).current;
  const scale = press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.95] });
  const to = (v: number) =>
    Animated.spring(press, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 6 }).start();

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => to(1)}
      onPressOut={() => to(0)}
      style={styles.item}
      accessibilityRole="button"
      accessibilityLabel={`Shop ${label}`}
    >
      <Animated.View style={[styles.ring, dark && styles.ringDark, { transform: [{ scale }] }]}>
        <View style={[styles.arch, dark && styles.archDark]}>{children}</View>
      </Animated.View>
      <Text style={styles.label} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Home's single category entry point — a horizontal row of arched image
 * tiles with a trailing "All" tile. Replaces the old text strip + the
 * 3×3 CategoryGrid further down, which showed the same categories twice.
 */
export function CategoryScroller({ categories }: CategoryScrollerProps) {
  const router = useRouter();
  const list = categories.slice(0, 12);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!list.length) return;
    Animated.timing(anim, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [anim, list.length]);

  if (!list.length) return null;

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });
  const openAll = () => router.push("/(main)/categories");

  return (
    <Animated.View style={[styles.wrap, { opacity: anim, transform: [{ translateY }] }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        decelerationRate="fast"
        snapToInterval={ITEM_W + spacing[3]}
      >
        {list.map((c) => (
          <ArchTile
            key={c.id}
            label={c.name}
            onPress={() => router.push(`/(main)/products?category=${c.slug}`)}
          >
            {c.image_url ? (
              <>
                <Image source={{ uri: c.image_url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
                <LinearGradient
                  colors={["rgba(13,14,10,0)", "rgba(13,14,10,0.22)"]}
                  locations={[0.55, 1]}
                  style={StyleSheet.absoluteFill}
                />
              </>
            ) : (
              <LinearGradient
                colors={[colors.olive[100], colors.olive[200]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[StyleSheet.absoluteFill, styles.center]}
              >
                <Text style={styles.initial}>{c.name.charAt(0)}</Text>
              </LinearGradient>
            )}
          </ArchTile>
        ))}

        <ArchTile label="All" onPress={openAll} dark>
          <View style={[StyleSheet.absoluteFill, styles.center]}>
            <View style={styles.allIcon}>
              <Ionicons name="grid-outline" size={15} color={colors.accent2.ochre} />
            </View>
          </View>
        </ArchTile>
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing[3],
    marginBottom: spacing[4],
  },
  scroll: {
    paddingHorizontal: spacing[5],
    gap: spacing[3],
  },
  item: {
    width: ITEM_W,
    alignItems: "center",
  },
  ring: {
    padding: RING - 1,
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.14)",
    borderRadius: 999,
    backgroundColor: colors.paper.cream,
    shadowColor: colors.ink.DEFAULT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  ringDark: {
    borderColor: "rgba(200, 164, 74, 0.45)",
  },
  arch: {
    width: TILE_W,
    height: TILE_H,
    borderRadius: TILE_W / 2,
    overflow: "hidden",
    backgroundColor: colors.olive[100],
  },
  archDark: {
    backgroundColor: colors.ink.DEFAULT,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  initial: {
    fontFamily: fontFamilies.display.italic,
    fontSize: 24,
    color: colors.olive[800],
  },
  allIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  label: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12.5,
    lineHeight: 16,
    letterSpacing: 0.1,
    color: colors.ink.DEFAULT,
    textAlign: "center",
    marginTop: spacing[2],
    width: ITEM_W,
  },
});
