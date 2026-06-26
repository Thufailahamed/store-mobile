import React from "react";
import { View, StyleSheet, Text, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@/components/ui/Icon";
import { fontFamilies } from "@/lib/theme/fonts";
import { radii } from "@/lib/theme/tokens";
import type { WardrobeOutfit } from "@/lib/types";

const INK = "#16170f";
const MUTED = "#6b6b6b";
const BORDER = "rgba(22,23,15,0.10)";

interface Props {
  outfit: WardrobeOutfit;
  onPress: () => void;
}

export function OutfitCard({ outfit, onPress }: Props) {
  const links = outfit.items ?? [];
  const thumbs = links
    .slice(0, 5)
    .map((l) => l.item?.image_url)
    .filter(Boolean) as string[];

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>{outfit.name}</Text>
          <Text style={styles.meta} numberOfLines={1}>
            {links.length} item{links.length === 1 ? "" : "s"}
            {outfit.occasion ? ` · ${outfit.occasion}` : ""}
            {outfit.season ? ` · ${outfit.season}` : ""}
          </Text>
        </View>
        {outfit.is_public ? (
          <View style={styles.publicBadge}>
            <Ionicons name="globe-outline" size={11} color={INK} />
            <Text style={styles.publicBadgeText}>Public</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.thumbs}>
        {thumbs.length === 0 ? (
          <View style={styles.thumbPlaceholder}>
            <Ionicons name="shirt-outline" size={20} color={MUTED} />
          </View>
        ) : (
          thumbs.map((uri, idx) => (
            <View
              key={`${uri}-${idx}`}
              style={[styles.thumb, idx > 0 && { marginLeft: -10 }]}
            >
              <Image
                source={{ uri }}
                style={styles.thumbImage}
                contentFit="cover"
                transition={200}
              />
            </View>
          ))
        )}
        {links.length > 5 ? (
          <View style={[styles.thumb, styles.thumbMore, { marginLeft: -10 }]}>
            <Text style={styles.thumbMoreText}>+{links.length - 5}</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles: Record<string, any> = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
    gap: 12,
    marginHorizontal: 16,
    marginVertical: 6,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  name: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 16,
    color: INK,
    fontWeight: "600",
  },
  meta: {
    fontSize: 11,
    color: MUTED,
    fontFamily: fontFamilies.sans.regular,
    marginTop: 2,
  },
  publicBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: "rgba(85,107,47,0.10)",
    borderRadius: radii.full,
  },
  publicBadgeText: {
    fontSize: 10,
    fontFamily: fontFamilies.sans.regular,
    color: INK,
    fontWeight: "600",
  },
  thumbs: {
    flexDirection: "row",
    alignItems: "center",
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#fff",
    overflow: "hidden",
    backgroundColor: "#f3f1e7",
  },
  thumbImage: {
    width: "100%",
    height: "100%",
  },
  thumbPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#f3f1e7",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbMore: {
    backgroundColor: "rgba(85,107,47,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbMoreText: {
    fontSize: 11,
    color: INK,
    fontFamily: fontFamilies.sans.regular,
    fontWeight: "700",
  },
});
