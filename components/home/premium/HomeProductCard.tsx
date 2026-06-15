import React from "react";
import { View, TouchableOpacity, StyleSheet, Text } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useWishlist } from "@/lib/stores";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";
import type { Product } from "@/lib/types";

export const HOME_PRODUCT_CARD_WIDTH = 148;

interface HomeProductCardProps {
  product: Product;
  showSaleBadge?: boolean;
}

export function HomeProductCard({ product, showSaleBadge = true }: HomeProductCardProps) {
  const router = useRouter();
  const { toggle, items: wishlistItems } = useWishlist();
  const isWishlisted = !!wishlistItems[product.id];
  const primaryImage = product.images?.find((i) => i.is_primary)?.url || product.images?.[0]?.url;
  const onSale = product.mrp > product.price;
  const storeName = product.store?.name;

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => router.push(`/(main)/products/${product.slug}`)}
    >
      <View style={styles.imageWrap}>
        {primaryImage ? (
          <Image source={{ uri: primaryImage }} style={styles.image} contentFit="cover" transition={250} />
        ) : (
          <View style={styles.placeholder}>
            <Ionicons name="shirt-outline" size={24} color={colors.light.mutedForeground} />
          </View>
        )}
        <TouchableOpacity
          style={styles.heartBtn}
          onPress={() => toggle(product.id)}
          activeOpacity={0.75}
          hitSlop={8}
        >
          <Ionicons
            name={isWishlisted ? "heart" : "heart-outline"}
            size={16}
            color={isWishlisted ? colors.light.destructive : colors.light.foreground}
          />
        </TouchableOpacity>
        {showSaleBadge && onSale ? (
          <View style={styles.saleBadge}>
            <Text style={styles.saleText}>Sale</Text>
          </View>
        ) : null}
      </View>

      {storeName ? (
        <View style={styles.storeRow}>
          {product.store?.logo_url ? (
            <Image source={{ uri: product.store.logo_url }} style={styles.storeLogo} contentFit="cover" />
          ) : (
            <View style={styles.storeLogoFallback}>
              <Text style={styles.storeInitial}>{storeName.charAt(0)}</Text>
            </View>
          )}
          <Text style={styles.storeName} numberOfLines={1}>
            {storeName}
          </Text>
        </View>
      ) : (
        <Text style={styles.productName} numberOfLines={2}>
          {product.name}
        </Text>
      )}

      <Text style={styles.price}>
        {product.price ? formatPrice(product.price) : "Price on request"}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: HOME_PRODUCT_CARD_WIDTH,
  },
  imageWrap: {
    width: HOME_PRODUCT_CARD_WIDTH,
    height: HOME_PRODUCT_CARD_WIDTH,
    borderRadius: radii.xl,
    overflow: "hidden",
    backgroundColor: colors.olive[50],
    marginBottom: spacing[2],
  },
  image: {
    width: "100%",
    height: "100%",
  },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  heartBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(250, 248, 241, 0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  saleBadge: {
    position: "absolute",
    left: 8,
    bottom: 8,
    backgroundColor: colors.light.card,
    borderRadius: radii.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  saleText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 11,
    color: colors.light.destructive,
  },
  storeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  storeLogo: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  storeLogoFallback: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.olive[100],
    alignItems: "center",
    justifyContent: "center",
  },
  storeInitial: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 9,
    color: colors.light.primary,
  },
  storeName: {
    flex: 1,
    fontFamily: fontFamilies.sans.bold,
    fontSize: 13,
    color: colors.light.foreground,
  },
  productName: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: colors.light.foreground,
    marginBottom: 2,
    lineHeight: 17,
  },
  price: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 13,
    color: colors.light.mutedForeground,
  },
});
