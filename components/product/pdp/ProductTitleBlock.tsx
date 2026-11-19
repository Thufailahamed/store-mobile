import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons, type IonIconName } from "@/components/ui/Icon";
import { fontFamilies } from "@/lib/theme/fonts";
import { setDesignsLabel } from "@/lib/set-designs";
import { formatPrice, discountPct } from "@/lib/utils";
import type { Product } from "@/lib/types";

const INK = "#1b1c1c";

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
  showWishlist = true,
}: {
  product: Product;
  unitPrice: number;
  isWishlisted: boolean;
  onToggleWishlist: () => void;
  onShare: () => void;
  showWishlist?: boolean;
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

  const actionList: { key: string; icon: IonIconName; label: string; on?: boolean; onPress: () => void }[] = [
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
  const actions = showWishlist ? actionList : actionList.filter((a) => a.key !== "wish");

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
          {maker.href ? <Ionicons name="chevron-forward" size={15} color="rgba(20,20,20,0.62)" /> : null}
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
      {setDesignsLabel(product.set_design_count) ? (
        <Text style={styles.setNote}>{setDesignsLabel(product.set_design_count)}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  setNote: { marginTop: 8, fontSize: 14, letterSpacing: 0.3, color: "#2b2b22" },
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
  maker: { fontFamily: fontFamilies.sans.semibold, fontSize: 12, letterSpacing: 2, textTransform: "uppercase", color: "rgba(20,20,20,0.62)", flexShrink: 1 },
  title: { fontFamily: fontFamilies.sans.medium, fontSize: 17, lineHeight: 24, letterSpacing: 1.4, textTransform: "uppercase", color: "#141414", marginTop: 6 },
  priceRow: { flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", columnGap: 10, rowGap: 4, marginTop: 12 },
  price: { fontFamily: fontFamilies.sans.semibold, fontSize: 20, letterSpacing: 0.8, color: "#141414" },
  mrpLabel: { fontFamily: fontFamilies.sans.regular, fontSize: 13, letterSpacing: 1, color: "rgba(20,20,20,0.5)" },
  mrpStruck: { textDecorationLine: "line-through" },
  mrpPlain: { fontFamily: fontFamilies.sans.regular, fontSize: 13, letterSpacing: 1, color: "rgba(20,20,20,0.5)" },
  off: { fontFamily: fontFamilies.sans.semibold, fontSize: 13, letterSpacing: 0.6, color: "#d40000" },
});
