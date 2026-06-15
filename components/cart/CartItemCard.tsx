import React from "react";
import { View, Pressable, StyleSheet, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "@/lib/hooks/useTheme";
import { QtyStepper } from "@/components/ui";
import { Display, Label, Body, Price } from "@/components/ui/Typography";
import { fontFamilies } from "@/lib/theme/fonts";
import { typography, spacing } from "@/lib/theme/tokens";
import { formatPrice } from "@/lib/utils";
import { useWishlist } from "@/lib/stores";
import type { CartItem } from "@/lib/stores/cart-store";

interface CartItemCardProps {
  item: CartItem;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemove: () => void;
  onSaveForLater?: () => void;
  /** Show the "save for later" heart toggle (used in cart). */
  showSave?: boolean;
  style?: ViewStyle;
}

export function CartItemCard({
  item,
  onIncrement,
  onDecrement,
  onRemove,
  onSaveForLater,
  showSave = true,
  style,
}: CartItemCardProps) {
  const theme = useTheme();
  const router = useRouter();
  const { has, toggle: toggleWishlist } = useWishlist();
  const saved = has(item.productId);
  const lineTotal = item.price * item.quantity;

  const goToProduct = () => {
    if (item.productId) {
      router.push({
        pathname: "/(main)/products/[slug]",
        params: { slug: item.productId },
      });
    }
  };

  return (
    <View style={[styles.wrap, style]}>
      <Pressable
        onPress={goToProduct}
        style={({ pressed }) => [
          styles.imageWrap,
          { backgroundColor: theme.colors.muted, borderColor: theme.colors.border },
          pressed && { opacity: 0.85 },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Open ${item.name}`}
      >
        {item.image ? (
          <Image
            source={{ uri: item.image }}
            style={styles.image}
            contentFit="cover"
            transition={250}
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons
              name="image-outline"
              size={22}
              color={theme.colors.mutedForeground}
            />
          </View>
        )}
      </Pressable>

      <View style={styles.info}>
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            {item.variantLabel ? (
              <Label
                style={{
                  color: theme.colors.mutedForeground,
                  marginBottom: 4,
                }}
              >
                {item.variantLabel}
              </Label>
            ) : null}
            <Pressable onPress={goToProduct} hitSlop={4}>
              <Display
                size="md"
                numberOfLines={2}
                style={{ color: theme.colors.foreground }}
              >
                {item.name}
              </Display>
            </Pressable>
          </View>
          <Price
            size="md"
            style={{ color: theme.colors.foreground, marginLeft: spacing[2] }}
          >
            {formatPrice(lineTotal)}
          </Price>
        </View>

        <View style={styles.priceLine}>
          <Body
            muted
            size="xs"
            style={{
              fontFamily: fontFamilies.mono.regular,
              letterSpacing: typography.letterSpacing.wide,
            }}
          >
            {formatPrice(item.price)} · each
          </Body>
          {item.stock <= 5 && item.stock > 0 ? (
            <Label style={{ color: theme.accent2.rust }}>
              Only {item.stock} left
            </Label>
          ) : null}
        </View>

        <View style={styles.actionsRow}>
          <QtyStepper
            value={item.quantity}
            onChange={(next) => {
              if (next === item.quantity) return;
              if (next > item.quantity) onIncrement();
              else onDecrement();
            }}
            max={item.stock}
          />

          <View style={styles.actionIcons}>
            {showSave ? (
              <Pressable
                onPress={() => {
                  if (onSaveForLater) onSaveForLater();
                  else toggleWishlist(item.productId);
                }}
                hitSlop={10}
                accessibilityLabel={
                  saved ? "Remove from wishlist" : "Save for later"
                }
                style={({ pressed }) => [
                  styles.iconBtn,
                  {
                    backgroundColor: theme.colors.card,
                    borderColor: theme.colors.border,
                  },
                  pressed && { opacity: 0.6 },
                ]}
              >
                <Ionicons
                  name={saved ? "heart" : "heart-outline"}
                  size={16}
                  color={saved ? theme.accent2.rust : theme.colors.foreground}
                />
              </Pressable>
            ) : null}
            <Pressable
              onPress={onRemove}
              hitSlop={10}
              accessibilityLabel="Remove from bag"
              style={({ pressed }) => [
                styles.iconBtn,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: theme.colors.border,
                },
                pressed && { opacity: 0.6 },
              ]}
            >
              <Ionicons
                name="trash-outline"
                size={16}
                color={theme.colors.mutedForeground}
              />
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    paddingVertical: spacing[4],
    gap: spacing[4],
  },
  imageWrap: {
    width: 96,
    height: 120,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
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
  info: {
    flex: 1,
    justifyContent: "space-between",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing[2],
  },
  headerText: {
    flex: 1,
  },
  priceLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    marginTop: 6,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing[3],
  },
  actionIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
});
