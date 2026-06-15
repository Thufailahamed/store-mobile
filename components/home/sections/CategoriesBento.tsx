import React, { useEffect, useRef } from "react";
import { View, TouchableOpacity, StyleSheet, Animated } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Display, Label, Body } from "@/components/ui/Typography";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import type { Category } from "@/lib/types";

// Bento layout: 1 big feature + 3 small (top row) + 3 squares (mid row) + 1 wide footer
// Each cell uses flex-basis + aspect ratio to compose without explicit grid.
const SHAPES: { flex: number; aspect?: number; height?: number }[] = [
  { flex: 1, height: 280 }, // big feature (left)
  { flex: 1, height: 136 }, // top-right
  { flex: 1, height: 136 }, // top-right
  { flex: 1, height: 132 }, // square
  { flex: 1, height: 132 }, // square
  { flex: 1, height: 132 }, // square
  { flex: 1, height: 110 }, // wide footer
];

interface CategoriesBentoProps {
  categories: Category[];
}

export function CategoriesBento({ categories }: CategoriesBentoProps) {
  const router = useRouter();
  const list = categories.slice(0, 7);
  if (!list.length) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View>
          <View style={styles.kickerRow}>
            <View style={styles.kickerRule} />
            <Label style={styles.kickerText}>Browse · 02</Label>
          </View>
          <Display size="3xl" style={styles.title}>
            Walk the{" "}
            <Display italic size="3xl" style={styles.titleAccent}>
              aisles.
            </Display>
          </Display>
        </View>
        <Body muted size="sm" style={styles.subtitle}>
          A small, considered catalogue. Pieces grouped not by trend, but by the
          rooms in your life.
        </Body>
      </View>

      <View style={styles.bento}>
        {list.map((c, i) => (
          <CategoryTile
            key={c.id}
            category={c}
            index={i}
            shape={SHAPES[i] ?? { flex: 1, height: 120 }}
            isFeature={i === 0}
            onPress={() => router.push(`/(main)/products?category=${c.slug}`)}
          />
        ))}
      </View>
    </View>
  );
}

function CategoryTile({
  category,
  index,
  shape,
  isFeature,
  onPress,
}: {
  category: Category;
  index: number;
  shape: { flex: number; height?: number };
  isFeature: boolean;
  onPress: () => void;
}) {
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 500,
      delay: index * 70,
      useNativeDriver: true,
    }).start();
  }, [fade, index]);

  return (
    <Animated.View style={[styles.tile, { flex: shape.flex, height: shape.height }, { opacity: fade }]}>
      <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={styles.tileInner}>
        {category.image_url ? (
          <Image source={{ uri: category.image_url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={400} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.olive[100], alignItems: "center", justifyContent: "center" }]}>
            <Label style={{ color: colors.olive[600], fontSize: 22 }}>
              {category.icon ?? category.name.slice(0, 2).toUpperCase()}
            </Label>
          </View>
        )}
        <View style={styles.tileGradient} />
        <Label style={styles.tileIndex}>{String(index + 1).padStart(2, "0")}</Label>
        <View style={styles.tileBottom}>
          <Display
            size={isFeature ? "2xl" : "xl"}
            style={styles.tileName}
            numberOfLines={1}
          >
            {category.name}
          </Display>
          <View style={styles.tileArrow}>
            <Ionicons name="arrow-up" size={12} color={colors.light.foreground} />
          </View>
        </View>
        <View style={styles.tileScribble} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 20,
    paddingTop: spacing[10],
    paddingBottom: spacing[8],
  },
  header: { marginBottom: spacing[6] },
  kickerRow: { flexDirection: "row", alignItems: "center", gap: spacing[2], marginBottom: 6 },
  kickerRule: { width: 24, height: 1, backgroundColor: colors.light.primary },
  kickerText: { color: colors.light.primary },
  title: { color: colors.light.foreground },
  titleAccent: { color: colors.light.primary },
  subtitle: { marginTop: spacing[2] },
  // Bento
  bento: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[3],
  },
  tile: {
    borderRadius: radii.xl,
    overflow: "hidden",
    backgroundColor: colors.olive[100],
    minWidth: "30%",
  },
  tileInner: { flex: 1, position: "relative" },
  tileGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(22, 26, 10, 0.45)",
  },
  tileIndex: {
    position: "absolute",
    top: spacing[3],
    left: spacing[3],
    color: "rgba(245, 244, 239, 0.85)",
  },
  tileBottom: {
    position: "absolute",
    left: spacing[3],
    right: spacing[3],
    bottom: spacing[3],
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: spacing[2],
  },
  tileName: { color: colors.paper.cream, flex: 1 },
  tileArrow: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.paper.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  tileScribble: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 0,
    height: 1,
    backgroundColor: colors.paper.cream,
    opacity: 0.4,
  },
});
