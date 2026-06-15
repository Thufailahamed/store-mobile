import React, { useState } from "react";
import { View, Pressable, StyleSheet, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "@/lib/hooks/useTheme";
import { Display, Label, Body, Price } from "@/components/ui/Typography";
import { fontFamilies } from "@/lib/theme/fonts";
import { typography, spacing, radii, shadows } from "@/lib/theme/tokens";
import { formatPrice, discountPct } from "@/lib/utils";
import { useCart, useWishlist } from "@/lib/stores";
import { useToast } from "@/components/ui/Toast";
import type { Product } from "@/lib/types";
import { WISHLIST_IMAGE_HEIGHT } from "@/components/wishlist/layout";

interface WishlistItemCardProps {
  product: Product;
  selected?: boolean;
  onToggleSelect?: () => void;
  style?: ViewStyle;
}

export function WishlistItemCard({
  product,
  selected = false,
  onToggleSelect,
  style,
}: WishlistItemCardProps) {
  const theme = useTheme();
  const router = useRouter();
  const { addItem, items: cartItems } = useCart();
  const { toggle } = useWishlist();
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);

  const primary =
    product.images?.find((i) => i.is_primary)?.url || product.images?.[0]?.url;
  const discount = discountPct(product.mrp, product.price);
  const variant = product.variants?.[0];
  const cartKey = `${product.id}-${variant?.id ?? "default"}`;
  const inCart = !!cartItems[cartKey];

  const open = () =>
    router.push({
      pathname: "/(main)/products/[slug]",
      params: { slug: product.slug || product.id },
    });

  const addToBag = async () => {
    if (adding) return;
    setAdding(true);
    try {
      addItem({
        productId: product.id,
        variantId: variant?.id ?? null,
        storeId: product.store_id,
        name: product.name,
        variantLabel: variant
          ? `${variant.color ?? ""} ${variant.size ?? ""}`.trim()
          : undefined,
        price: product.price,
        image: primary,
        stock: variant?.stock ?? 99,
        quantity: 1,
      });
      toast(`${product.name} added to bag`, "success");
    } finally {
      setAdding(false);
    }
  };

  const colorSwatches = Array.from(
    new Map(
      (product.variants ?? [])
        .filter((v) => v.color_hex)
        .map((v) => [v.color_hex as string, v.color as string])
    ).keys()
  ).slice(0, 4);

  const lowStock =
    variant?.stock !== undefined && variant.stock > 0 && variant.stock <= 5;

  return (
    <Pressable
      onPress={open}
      style={({ pressed }) => [
        styles.card,
        selected && styles.cardSelected,
        pressed && { opacity: 0.92 },
        style,
      ]}
    >
      <View
        style={[
          styles.imageWrap,
          {
            backgroundColor: theme.colors.card,
            borderColor: selected ? theme.colors.primary : "rgba(200, 200, 184, 0.4)",
          },
        ]}
      >
        {primary ? (
          <Image
            source={{ uri: primary }}
            style={styles.image}
            contentFit="cover"
            transition={250}
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons
              name="image-outline"
              size={24}
              color={theme.colors.mutedForeground}
            />
          </View>
        )}

        {discount > 0 ? (
          <View
            style={[
              styles.discountBadge,
              { backgroundColor: theme.accent2.rust },
            ]}
          >
            <Label style={{ color: "#fff", fontSize: 9 }}>
              {discount}% OFF
            </Label>
          </View>
        ) : null}

        {onToggleSelect ? (
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              onToggleSelect();
            }}
            hitSlop={8}
            accessibilityLabel={selected ? "Deselect item" : "Select item"}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected }}
            style={({ pressed }) => [
              styles.selectBtn,
              {
                borderColor: selected ? theme.colors.primary : theme.colors.border,
                backgroundColor: selected
                  ? theme.colors.primary
                  : "rgba(255, 255, 255, 0.92)",
              },
              pressed && { opacity: 0.7 },
            ]}
          >
            {selected ? (
              <Ionicons
                name="checkmark"
                size={12}
                color={theme.colors.primaryForeground}
              />
            ) : null}
          </Pressable>
        ) : null}

        <Pressable
          onPress={(e) => {
            e.stopPropagation?.();
            toggle(product.id);
          }}
          hitSlop={6}
          accessibilityLabel="Remove from wishlist"
          style={({ pressed }) => [
            styles.heart,
            {
              backgroundColor: "rgba(255, 255, 255, 0.88)",
              borderColor: "rgba(200, 200, 184, 0.4)",
            },
            pressed && { opacity: 0.6 },
          ]}
        >
          <Ionicons name="heart" size={14} color={theme.accent2.rust} />
        </Pressable>

        {lowStock ? (
          <View
            style={[
              styles.lowStockBadge,
              { backgroundColor: `${theme.colors.card}F2` },
            ]}
          >
            <Ionicons name="flame-outline" size={10} color={theme.accent2.rust} />
            <Label
              style={{ color: theme.accent2.rust, fontSize: 8, marginLeft: 3 }}
            >
              {variant?.stock} LEFT
            </Label>
          </View>
        ) : null}
      </View>

      <View style={styles.info}>
        {product.brand ? (
          <Label
            style={{
              color: theme.olive[600],
              fontSize: 9,
            }}
            numberOfLines={1}
          >
            {product.brand.name}
          </Label>
        ) : null}
        <Display
          size="sm"
          numberOfLines={2}
          style={[styles.productName, { color: theme.colors.foreground }]}
        >
          {product.name}
        </Display>

        {colorSwatches.length > 0 ? (
          <View style={styles.swatches}>
            {colorSwatches.map((hex) => (
              <View
                key={hex}
                style={[
                  styles.swatch,
                  {
                    backgroundColor: hex,
                    borderColor: theme.colors.border,
                  },
                ]}
              />
            ))}
            {product.variants && product.variants.length > colorSwatches.length ? (
              <Label
                style={{
                  color: theme.colors.mutedForeground,
                  fontSize: 9,
                  marginLeft: 4,
                }}
              >
                +{product.variants.length - colorSwatches.length}
              </Label>
            ) : null}
          </View>
        ) : null}

        <View style={styles.priceRow}>
          <View style={styles.priceCol}>
            <Price size="base" style={{ color: theme.colors.foreground }}>
              {formatPrice(product.price)}
            </Price>
            {discount > 0 ? (
              <Body
                size="xs"
                muted
                style={{
                  textDecorationLine: "line-through",
                  marginTop: 2,
                }}
              >
                {formatPrice(product.mrp)}
              </Body>
            ) : null}
          </View>
          <Pressable
            onPress={inCart ? open : addToBag}
            hitSlop={6}
            accessibilityLabel={inCart ? "View in bag" : "Add to bag"}
            style={({ pressed }) => [
              styles.addBtn,
              {
                backgroundColor: inCart ? theme.colors.muted : theme.olive[700],
              },
              pressed && { opacity: 0.75 },
            ]}
          >
            <Ionicons
              name={inCart ? "checkmark" : "add"}
              size={16}
              color={inCart ? theme.colors.foreground : "#fff"}
            />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
  },
  cardSelected: {
    opacity: 1,
  },
  imageWrap: {
    width: "100%",
    height: WISHLIST_IMAGE_HEIGHT,
    borderRadius: radii.xl,
    borderWidth: 1.5,
    overflow: "hidden",
    position: "relative",
    ...shadows.soft,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  discountBadge: {
    position: "absolute",
    bottom: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.full,
    zIndex: 1,
  },
  selectBtn: {
    position: "absolute",
    top: 8,
    left: 8,
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    zIndex: 2,
  },
  heart: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    zIndex: 2,
  },
  lowStockBadge: {
    position: "absolute",
    bottom: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  info: {
    paddingTop: spacing[2],
    gap: spacing[1],
  },
  productName: {
    marginTop: spacing[1],
    minHeight: 36,
    lineHeight: 18,
  },
  swatches: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing[1.5],
  },
  swatch: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 4,
    borderWidth: 1,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: spacing[2],
    gap: spacing[2],
  },
  priceCol: {
    flex: 1,
  },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.glow,
  },
});
