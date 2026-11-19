import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@/components/ui/Icon";
import { useWishlist } from "@/lib/stores";
import { useWishlistToggle } from "@/lib/hooks/useWishlistToggle";
import { C } from "@/components/orders/parcel-track";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";
import type { Product } from "@/lib/types";

/** Inner padding of the white card frame around the image (matches HomeProductCard). */
const CARD_PAD = 7;
const GOLD = "#c9b27a";

/**
 * B2B product card in the same framed language as the Home rails: white
 * card, inset rounded image, seller line, name, piece price — plus the
 * wholesale facts (MOQ, pack size, pack price, lead time).
 */
export function WholesaleProductTile({
  product,
  width,
  onPress,
  index = 99,
}: {
  product: Product;
  width: number;
  onPress: () => void;
  index?: number;
}) {
  const isWishlisted = useWishlist((s) => !!s.items[product.id]);
  const toggleWishlist = useWishlistToggle();
  const image = product.images?.find((i) => i.is_primary)?.url ?? product.images?.[0]?.url;
  const moq = Math.max(1, Number(product.wholesale_moq ?? 1) || 1);
  const pack = Math.max(1, Number(product.wholesale_pack_size ?? 1) || 1);
  const store = product.store;
  const brand = product.brand;
  const seller = store?.name || brand?.name || "Vestara Wholesale";
  const logo = store?.logo_url || brand?.logo_url;
  const imageWidth = width - CARD_PAD * 2;
  const price = Number(product.price) || 0;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, { width }, pressed && { opacity: 0.88, transform: [{ scale: 0.985 }] }]}
    >
      <View style={[styles.imageWrap, { width: imageWidth, height: Math.round(imageWidth * 1.22) }]}>
        {image ? (
          <Image
            source={{ uri: image }}
            style={styles.image}
            contentFit="cover"
            transition={200}
            priority={index < 4 ? "high" : "normal"}
            cachePolicy="memory-disk"
            recyclingKey={product.id}
          />
        ) : (
          <View style={styles.placeholder}>
            <Ionicons name="shirt-outline" size={26} color={C.muted} />
          </View>
        )}
        <View style={styles.moqChip}>
          <Text style={styles.moqText}>MOQ {moq}</Text>
        </View>
        <Pressable
          style={styles.heartBtn}
          onPress={() => toggleWishlist(product)}
          hitSlop={8}
          accessibilityLabel={isWishlisted ? "Remove from wishlist" : "Save to wishlist"}
        >
          <Ionicons
            name={isWishlisted ? "heart" : "heart-outline"}
            size={15}
            color={isWishlisted ? "#c0392b" : C.ink}
          />
        </Pressable>
        {pack > 1 ? (
          <View style={styles.packChip}>
            <Ionicons name="cube-outline" size={10} color={C.ink} />
            <Text style={styles.packText}>PACK OF {pack}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.sellerRow}>
        {logo ? (
          <Image source={{ uri: logo }} style={styles.sellerLogo} contentFit="cover" cachePolicy="memory-disk" />
        ) : (
          <View style={styles.sellerLogoFallback}>
            <Text style={styles.sellerInitial}>{seller.charAt(0)}</Text>
          </View>
        )}
        <Text style={styles.sellerName} numberOfLines={1}>
          {seller}
        </Text>
      </View>

      <Text style={styles.name} numberOfLines={2}>
        {product.name || "Untitled piece"}
      </Text>

      <View style={styles.priceRow}>
        <Text style={styles.price}>{price ? formatPrice(price, product.currency) : "On request"}</Text>
        {price ? <Text style={styles.per}>/ PC</Text> : null}
      </View>

      <View style={styles.factRow}>
        {pack > 1 && price ? (
          <View style={styles.fact}>
            <Text style={styles.factText} numberOfLines={1}>
              {formatPrice(price * pack, product.currency)} / pack
            </Text>
          </View>
        ) : (
          <View style={styles.fact}>
            <Text style={styles.factText} numberOfLines={1}>
              Min {moq} pcs
            </Text>
          </View>
        )}
        {product.wholesale_lead_time ? (
          <View style={styles.leadRow}>
            <Ionicons name="time-outline" size={10} color={C.muted} />
            <Text style={styles.lead} numberOfLines={1}>
              {product.wholesale_lead_time}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: CARD_PAD,
    paddingBottom: 11,
    borderRadius: 22,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
  },
  imageWrap: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#f0ede2",
    marginBottom: 9,
  },
  // Rounded on the image itself too — Android drops children under
  // overflow:hidden + radius on some devices.
  image: { width: "100%", height: "100%", borderRadius: 16 },
  placeholder: { flex: 1, alignItems: "center", justifyContent: "center" },
  moqChip: {
    position: "absolute",
    left: 7,
    top: 7,
    height: 22,
    justifyContent: "center",
    borderRadius: 11,
    backgroundColor: C.ink,
    paddingHorizontal: 8,
  },
  moqText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 10,
    letterSpacing: 0.3,
    color: C.lime,
  },
  heartBtn: {
    position: "absolute",
    top: 7,
    right: 7,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  packChip: {
    position: "absolute",
    left: 7,
    bottom: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 11,
    backgroundColor: GOLD,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  packText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 8.5,
    letterSpacing: 0.8,
    color: C.ink,
  },
  sellerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 3,
    paddingHorizontal: 3,
  },
  sellerLogo: { width: 14, height: 14, borderRadius: 7 },
  sellerLogoFallback: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: C.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  sellerInitial: { fontFamily: fontFamilies.sans.bold, fontSize: 8, color: C.accent },
  sellerName: {
    flex: 1,
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9.5,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: C.accent,
  },
  name: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 13.5,
    lineHeight: 18,
    color: C.text,
    marginBottom: 3,
    paddingHorizontal: 3,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
    paddingHorizontal: 3,
  },
  price: { fontFamily: fontFamilies.sans.semibold, fontSize: 13.5, color: C.text },
  per: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 8.5,
    letterSpacing: 0.6,
    color: C.muted,
  },
  factRow: {
    marginTop: 7,
    paddingHorizontal: 3,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  fact: {
    borderRadius: 9,
    backgroundColor: C.accentSoft,
    paddingHorizontal: 7,
    paddingVertical: 3,
    maxWidth: "100%",
  },
  factText: { fontFamily: fontFamilies.sans.semibold, fontSize: 10, color: C.accent },
  leadRow: { flexDirection: "row", alignItems: "center", gap: 3, flexShrink: 1 },
  lead: {
    flexShrink: 1,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 10,
    color: C.muted,
  },
});
