import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons, type IonIconName } from "@/components/ui/Icon";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice, discountPct } from "@/lib/utils";
import type { Product } from "@/lib/types";

const INK = "#1b1c1c";
const MUTED = "#6b6a66";
const OFF = "#d9822b";

/**
 * Three quick actions (similar · wishlist · share), then "**Brand** name" and
 * the price line — price, struck MRP and % OFF, or "MRP" alone when there is
 * no discount.
 */
export function ProductTitleBlock({
  product,
  unitPrice,
  isWishlisted,
  onToggleWishlist,
  onShare,
}: {
  product: Product;
  unitPrice: number;
  isWishlisted: boolean;
  onToggleWishlist: () => void;
  onShare: () => void;
}) {
  const router = useRouter();
  const pct = discountPct(product.mrp, unitPrice);
  // Brand when there is one, else the selling store — on its own line so a
  // long store name never runs into the product name.
  const maker = product.brand?.name
    ? { name: product.brand.name, href: product.brand.slug ? `/(main)/brands/${product.brand.slug}` : null }
    : product.store?.name
      ? { name: product.store.name, href: product.store.slug ? `/(main)/stores/${product.store.slug}` : null }
      : null;
  const currency = product.currency;

  const actions: { key: string; icon: IonIconName; label: string; on?: boolean; onPress: () => void }[] = [
    {
      key: "similar",
      icon: "copy-outline",
      label: "View similar",
      onPress: () =>
        router.push(
          (product.category?.slug ? `/(main)/products?category=${product.category.slug}` : "/(main)/products") as never,
        ),
    },
    {
      key: "wish",
      icon: isWishlisted ? "heart" : "heart-outline",
      label: isWishlisted ? "Remove from wishlist" : "Add to wishlist",
      on: isWishlisted,
      onPress: onToggleWishlist,
    },
    { key: "share", icon: "share-social-outline", label: "Share", onPress: onShare },
  ];

  return (
    <View style={styles.wrap}>
      <View style={styles.actions}>
        {actions.map((a) => (
          <TouchableOpacity
            key={a.key}
            style={styles.action}
            activeOpacity={0.7}
            onPress={a.onPress}
            accessibilityRole="button"
            accessibilityLabel={a.label}
          >
            <Ionicons name={a.icon} size={20} color={a.on ? "#ff2e85" : INK} />
          </TouchableOpacity>
        ))}
      </View>

      {maker ? (
        <TouchableOpacity
          style={styles.makerRow}
          activeOpacity={0.7}
          disabled={!maker.href}
          onPress={() => maker.href && router.push(maker.href as never)}
          accessibilityRole={maker.href ? "link" : "text"}
          accessibilityLabel={`More from ${maker.name}`}
        >
          <Text style={styles.maker} numberOfLines={1}>
            {maker.name}
          </Text>
          {maker.href ? <Ionicons name="chevron-forward" size={14} color={MUTED} /> : null}
        </TouchableOpacity>
      ) : null}
      <Text style={[styles.title, !maker && { marginTop: 14 }]} numberOfLines={3}>
        {product.name}
      </Text>

      {pct > 0 ? (
        <View style={styles.priceRow}>
          <Text style={styles.price}>{formatPrice(unitPrice, currency)}</Text>
          <Text style={styles.mrpLabel}>
            MRP <Text style={styles.mrpStruck}>{formatPrice(product.mrp, currency)}</Text>
          </Text>
          <Text style={styles.off}>({pct}% OFF)</Text>
        </View>
      ) : (
        <View style={styles.priceRow}>
          <Text style={styles.mrpPlain}>
            MRP <Text style={styles.price}>{formatPrice(unitPrice, currency)}</Text>
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 10 },
  actions: { flexDirection: "row", gap: 10 },
  action: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    backgroundColor: "#f2f1ee",
    alignItems: "center",
    justifyContent: "center",
  },
  makerRow: { flexDirection: "row", alignItems: "center", gap: 2, marginTop: 14, alignSelf: "flex-start", maxWidth: "100%" },
  maker: { fontFamily: fontFamilies.sans.bold, fontSize: 16.5, color: INK, flexShrink: 1 },
  title: { marginTop: 3, fontFamily: fontFamilies.sans.regular, fontSize: 15, lineHeight: 21, color: "#55544f" },
  priceRow: { flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", columnGap: 8, marginTop: 10 },
  price: { fontFamily: fontFamilies.sans.bold, fontSize: 17, color: INK },
  mrpLabel: { fontFamily: fontFamilies.sans.regular, fontSize: 13.5, color: MUTED },
  mrpStruck: { textDecorationLine: "line-through" },
  mrpPlain: { fontFamily: fontFamilies.sans.medium, fontSize: 14, color: MUTED },
  off: { fontFamily: fontFamilies.sans.bold, fontSize: 14, color: OFF },
});
