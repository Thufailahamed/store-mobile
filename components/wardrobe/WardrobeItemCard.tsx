import React, { useState } from "react";
import {
  View,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
} from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { fontFamilies } from "@/lib/theme/fonts";
import { colors, radii, shadows } from "@/lib/theme/tokens";
import { formatPrice } from "@/lib/utils";
import type { GarmentType, WardrobeItem } from "@/lib/types";

const INK = "#16170f";
const MUTED = "#65684d";
const PAPER = "#faf8f1";
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
export const WARDROBE_H_PAD = 20;

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
            <Ionicons name="add" size={13} color="#c8e08a" />
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
          {item.size ? <Text style={styles.size}>{item.size}</Text> : null}
        </View>

        <View style={styles.metaRow}>
          <View style={styles.wearPill}>
            <Ionicons name="repeat" size={10} color={colors.olive[700]} />
            <Text style={styles.wearText}>{item.wear_count}× worn</Text>
          </View>
          {cpw !== null ? (
            <Text style={styles.meta}>
              {formatPrice(cpw, item.currency)}/wear
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles: Record<string, any> = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(22,23,15,0.07)",
    shadowColor: INK,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 3,
  },
  imageWrap: {
    position: "relative",
    backgroundColor: "#f0ede2",
    overflow: "hidden",
    margin: 6,
    marginBottom: 0,
    borderRadius: 18,
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
    backgroundColor: "rgba(250,248,241,0.94)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  garmentBadgeText: {
    color: INK,
    fontSize: 8.5,
    fontFamily: fontFamilies.mono.semibold,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  colorBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(22,23,15,0.55)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  colorBadgeText: {
    color: PAPER,
    fontSize: 8.5,
    fontFamily: fontFamilies.mono.medium,
    letterSpacing: 1,
    textTransform: "uppercase",
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
    height: 32,
    backgroundColor: "rgba(22,23,15,0.88)",
    borderRadius: radii.full,
  },
  logBtnText: {
    color: PAPER,
    fontSize: 11,
    fontFamily: fontFamilies.sans.bold,
  },
  menuBtn: {
    width: 32,
    height: 32,
    backgroundColor: "rgba(250,248,241,0.94)",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  menu: {
    position: "absolute",
    right: 8,
    bottom: 46,
    backgroundColor: PAPER,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.light.border,
    minWidth: 150,
    paddingVertical: 4,
    ...shadows.editorial,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  menuItemDanger: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.light.border,
  },
  menuItemText: {
    fontSize: 12.5,
    color: INK,
    fontFamily: fontFamilies.sans.medium,
  },
  menuItemTextDanger: {
    color: "#a8311f",
  },
  body: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 3,
  },
  brand: {
    fontSize: 8.5,
    letterSpacing: 1.4,
    color: colors.olive[600],
    fontFamily: fontFamilies.mono.semibold,
  },
  name: {
    fontSize: 15,
    color: INK,
    fontFamily: fontFamilies.sans.bold,
    letterSpacing: -0.2,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
  },
  price: {
    fontSize: 13,
    color: INK,
    fontFamily: fontFamilies.sans.semibold,
  },
  size: {
    fontSize: 9.5,
    color: MUTED,
    fontFamily: fontFamilies.mono.medium,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.light.border,
  },
  metaRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  wearPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    backgroundColor: colors.olive[50],
  },
  wearText: {
    fontSize: 9.5,
    color: colors.olive[700],
    fontFamily: fontFamilies.mono.semibold,
    letterSpacing: 0.4,
  },
  meta: {
    fontSize: 9.5,
    color: MUTED,
    fontFamily: fontFamilies.mono.regular,
  },
});
