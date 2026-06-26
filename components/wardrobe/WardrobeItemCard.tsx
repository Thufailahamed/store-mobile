import React, { useState } from "react";
import { View, Pressable, StyleSheet, Text, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { fontFamilies } from "@/lib/theme/fonts";
import { spacing, radii } from "@/lib/theme/tokens";
import { formatPrice } from "@/lib/utils";
import type { GarmentType, WardrobeItem } from "@/lib/types";

const INK = "#16170f";
const MUTED = "#6b6b6b";
const PAPER = "#fbfaf3";
const BORDER = "rgba(22,23,15,0.08)";

const GARMENT_LABEL: Record<GarmentType, string> = {
  top: "Top",
  bottom: "Bottom",
  dress: "Dress",
  footwear: "Footwear",
  bag: "Bag",
  accessory: "Accessory",
  jewelry: "Jewelry",
  watch: "Watch",
  beauty: "Beauty",
  other: "Other",
};

export const WARDROBE_CARD_GAP = 12;
export const WARDROBE_H_PAD = 16;

export function getWardrobeCardWidth(screenWidth: number): number {
  return (screenWidth - WARDROBE_H_PAD * 2 - WARDROBE_CARD_GAP) / 2;
}

interface Props {
  item: WardrobeItem;
  cardWidth: number;
  onLogWear: () => void;
  onArchive: () => void;
  onDelete: () => void;
}

export function WardrobeItemCard({
  item,
  cardWidth,
  onLogWear,
  onArchive,
  onDelete,
}: Props) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const imageHeight = Math.round(cardWidth * 1.33);
  const cpw =
    item.purchase_price && item.wear_count > 0
      ? item.purchase_price / item.wear_count
      : null;

  const isActive = item.status === "active";

  const open = () => {
    router.push({
      pathname: "/(main)/wardrobe/[id]" as never,
      params: { id: item.id },
    });
  };

  return (
    <Pressable
      onPress={open}
      style={({ pressed }) => [
        styles.card,
        { width: cardWidth, opacity: isActive ? 1 : 0.55 },
        pressed ? { transform: [{ scale: 0.985 }] } : null,
      ]}
    >
      <View style={[styles.imageWrap, { height: imageHeight }]}>
        {item.image_url ? (
          <Image
            source={{ uri: item.image_url }}
            style={styles.image}
            contentFit="cover"
            transition={250}
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="shirt-outline" size={32} color={MUTED} />
          </View>
        )}

        <View style={styles.garmentBadge}>
          <Text style={styles.garmentBadgeText}>
            {GARMENT_LABEL[item.garment_type] ?? item.garment_type}
          </Text>
        </View>

        {item.color ? (
          <View style={styles.colorBadge}>
            <Text style={styles.colorBadgeText}>{item.color}</Text>
          </View>
        ) : null}

        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.logBtn}
            onPress={(e) => {
              e.stopPropagation();
              onLogWear();
            }}
            activeOpacity={0.85}
          >
            <Ionicons name="checkmark-circle" size={14} color="#fff" />
            <Text style={styles.logBtnText}>Log wear</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuBtn}
            onPress={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
            hitSlop={8}
          >
            <Ionicons name="ellipsis-horizontal" size={14} color={INK} />
          </TouchableOpacity>
        </View>

        {menuOpen ? (
          <View style={styles.menu}>
            {item.product_id ? (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setMenuOpen(false);
                  // No slug known from wardrobe view; product_id resolves via /(main)/products.
                  router.push(`/(main)/products/${item.product_id}` as never);
                }}
              >
                <Ionicons name="open-outline" size={13} color={INK} />
                <Text style={styles.menuItemText}>View product</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuOpen(false);
                onArchive();
              }}
            >
              <Ionicons name="archive-outline" size={13} color={INK} />
              <Text style={styles.menuItemText}>
                {item.status === "active" ? "Archive" : "Restore"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuItem, styles.menuItemDanger]}
              onPress={() => {
                setMenuOpen(false);
                onDelete();
              }}
            >
              <Ionicons name="trash-outline" size={13} color="#a8311f" />
              <Text style={[styles.menuItemText, styles.menuItemTextDanger]}>
                Delete
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        {item.brand_name ? (
          <Text style={styles.brand} numberOfLines={1}>
            {item.brand_name.toUpperCase()}
          </Text>
        ) : null}
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>

        <View style={styles.priceRow}>
          {item.purchase_price != null ? (
            <Text style={styles.price}>
              {formatPrice(item.purchase_price, item.currency)}
            </Text>
          ) : null}
          {item.size ? (
            <Text style={styles.size}>· {item.size}</Text>
          ) : null}
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.meta}>
            {item.wear_count}× worn
          </Text>
          {cpw !== null ? (
            <Text style={styles.meta}>
              {formatPrice(cpw, item.currency)} / wear
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles: Record<string, any> = StyleSheet.create({
  card: {
    backgroundColor: PAPER,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: "hidden",
  },
  imageWrap: {
    position: "relative",
    backgroundColor: "#f1efe6",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imagePlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  garmentBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "#16170f",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  garmentBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontFamily: fontFamilies.sans.regular,
    letterSpacing: 0.5,
    fontWeight: "700",
  },
  colorBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  colorBadgeText: {
    color: INK,
    fontSize: 9,
    fontFamily: fontFamilies.sans.regular,
    letterSpacing: 0.4,
  },
  bottomBar: {
    position: "absolute",
    left: 8,
    right: 8,
    bottom: 8,
    flexDirection: "row",
    gap: 6,
  },
  logBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 7,
    backgroundColor: "#556b2f",
    borderRadius: radii.md,
  },
  logBtnText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: fontFamilies.sans.regular,
    fontWeight: "700",
  },
  menuBtn: {
    width: 30,
    height: 30,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  menu: {
    position: "absolute",
    right: 8,
    bottom: 46,
    backgroundColor: "#fff",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: BORDER,
    minWidth: 140,
    paddingVertical: 4,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  menuItemDanger: {
    backgroundColor: "rgba(168,49,31,0.06)",
  },
  menuItemText: {
    fontSize: 12,
    color: INK,
    fontFamily: fontFamilies.sans.regular,
  },
  menuItemTextDanger: {
    color: "#a8311f",
  },
  body: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 4,
  },
  brand: {
    fontSize: 9,
    letterSpacing: 0.8,
    color: MUTED,
    fontFamily: fontFamilies.sans.regular,
    fontWeight: "600",
  },
  name: {
    fontSize: 13,
    color: INK,
    fontFamily: fontFamilies.display.regular,
    fontWeight: "500",
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  price: {
    fontSize: 14,
    color: INK,
    fontFamily: fontFamilies.display.regular,
    fontWeight: "600",
  },
  size: {
    fontSize: 10,
    color: MUTED,
    fontFamily: fontFamilies.sans.regular,
  },
  metaRow: {
    marginTop: 2,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  meta: {
    fontSize: 10,
    color: MUTED,
    fontFamily: fontFamilies.sans.regular,
  },
});
