import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Text,
} from "react-native";
import { Modal } from "@/components/ui/Modal";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@/components/ui/Icon";
import { CardHeading, LUX } from "@/components/orders/luxe-order";
import { useCart } from "@/lib/stores/cart-store";
import { useUI } from "@/lib/stores/ui-store";
import { buildCartLineKeyFromItem } from "@/lib/cart-line-key";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";
import { getProductsByIdsBackend } from "@/lib/api/backend";
import { mapProducts } from "@/lib/api/product-mapper";
import type { Product } from "@/lib/types";

const LINE = "rgba(22,23,15,0.08)";
const SOFT = "#f5f3ec";
const IMG_BG = "#f0ede2";

export function CartDrawer() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const open = useUI((s) => s.cartDrawerOpen);
  const setCartDrawer = useUI((s) => s.setCartDrawer);
  const items = useCart((s) => s.items);
  const removeItem = useCart((s) => s.removeItem);
  const updateQuantity = useCart((s) => s.updateQuantity);
  const lines = Object.values(items).filter((i) => !i.is_unavailable);
  const sub = useCart((s) => s.subtotal());

  const close = () => setCartDrawer(false);

  // Server-synced lines carry no image (cart_items has no image column), so
  // resolve missing thumbnails from the catalogue like the full bag page does.
  const [products, setProducts] = useState<Record<string, Product>>({});
  const missingImageIds = useMemo(
    () =>
      [...new Set(lines.filter((i) => !i.image && !products[i.productId]).map((i) => i.productId))]
        .sort()
        .join(","),
    [lines, products],
  );
  useEffect(() => {
    if (!open || !missingImageIds) return;
    let cancelled = false;
    getProductsByIdsBackend(missingImageIds.split(",")).then((res) => {
      if (cancelled || !res.ok || !res.data) return;
      const fetched = mapProducts(res.data.products);
      setProducts((prev) => {
        const next = { ...prev };
        fetched.forEach((p) => (next[p.id] = p));
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [open, missingImageIds]);

  const imageFor = (item: (typeof lines)[number]) => {
    if (item.image) return item.image;
    const product = products[item.productId];
    return (
      product?.variants?.find((v) => v.id === item.variantId)?.image_url ||
      product?.images?.find((i) => i.is_primary)?.url ||
      product?.images?.[0]?.url
    );
  };

  const itemCount = lines.reduce((n, i) => n + i.quantity, 0);

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Dismiss bag" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom + 8, 20) }]}>
          <View style={styles.handle} />

          {/* Header — same editorial heading as the order screens */}
          <CardHeading
            index="01"
            eyebrow="Shopping bag"
            title="Your bag"
            italic={itemCount > 0 ? `(${itemCount})` : undefined}
            trailing={
              <TouchableOpacity
                onPress={close}
                style={styles.closeBtn}
                accessibilityRole="button"
                accessibilityLabel="Close bag"
                hitSlop={8}
              >
                <Ionicons name="close" size={16} color={LUX.ink} />
              </TouchableOpacity>
            }
          />

          {/* Body */}
          {lines.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="bag-outline" size={26} color={LUX.olive} />
              </View>
              <Text style={styles.emptyTitle}>
                Your bag is <Text style={styles.emptyItalic}>empty.</Text>
              </Text>
              <Text style={styles.emptySubtitle}>
                Explore curated pieces and add your favourites to the bag.
              </Text>
              <TouchableOpacity
                style={styles.exploreBtn}
                onPress={() => {
                  close();
                  router.push("/(main)");
                }}
                activeOpacity={0.88}
              >
                <Text style={styles.exploreBtnText}>Discover Collections</Text>
                <View style={styles.exploreArrow}>
                  <Ionicons name="arrow-forward" size={13} color={LUX.ink} />
                </View>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView
              style={styles.list}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
            >
              {lines.map((item) => {
                const key = buildCartLineKeyFromItem(item);
                const imageUrl = imageFor(item);
                return (
                  <View key={key} style={styles.item}>
                    <View style={styles.thumbWrap}>
                      {imageUrl ? (
                        <Image
                          source={{ uri: imageUrl }}
                          style={styles.thumb}
                          contentFit="cover"
                          transition={200}
                        />
                      ) : (
                        <View style={[styles.thumb, styles.thumbPh]}>
                          <Ionicons name="image-outline" size={20} color={LUX.olive} />
                        </View>
                      )}
                    </View>

                    <View style={styles.itemInfo}>
                      <View style={styles.itemTop}>
                        <View style={styles.itemTitleBlock}>
                          <Text style={styles.itemName} numberOfLines={2}>
                            {item.name}
                          </Text>
                          {item.variantLabel ? (
                            <Text style={styles.variantText} numberOfLines={1}>
                              {item.variantLabel}
                            </Text>
                          ) : null}
                        </View>
                        <TouchableOpacity
                          onPress={() => removeItem(key)}
                          style={styles.removeBtn}
                          hitSlop={10}
                          accessibilityRole="button"
                          accessibilityLabel={`Remove ${item.name}`}
                        >
                          <Ionicons name="close" size={13} color={LUX.ink} />
                        </TouchableOpacity>
                      </View>

                      <View style={styles.itemBottom}>
                        <View style={styles.stepper}>
                          <TouchableOpacity
                            onPress={() => {
                              if (item.quantity <= 1) removeItem(key);
                              else updateQuantity(key, item.quantity - 1);
                            }}
                            style={styles.stepperBtn}
                            hitSlop={6}
                            accessibilityRole="button"
                            accessibilityLabel={item.quantity <= 1 ? "Remove item" : "Decrease quantity"}
                          >
                            <Ionicons
                              name={item.quantity <= 1 ? "trash-outline" : "remove"}
                              size={13}
                              color={item.quantity <= 1 ? LUX.rust : LUX.ink}
                            />
                          </TouchableOpacity>
                          <Text style={styles.stepperValue}>{item.quantity}</Text>
                          <TouchableOpacity
                            onPress={() => updateQuantity(key, item.quantity + 1)}
                            style={styles.stepperBtn}
                            hitSlop={6}
                            accessibilityRole="button"
                            accessibilityLabel="Increase quantity"
                          >
                            <Ionicons name="add" size={13} color={LUX.ink} />
                          </TouchableOpacity>
                        </View>

                        <View style={styles.priceBlock}>
                          <Text style={styles.itemPrice}>
                            {formatPrice(item.price * item.quantity)}
                          </Text>
                          {item.quantity > 1 && (
                            <Text style={styles.itemUnitPrice}>
                              {formatPrice(item.price)} each
                            </Text>
                          )}
                        </View>
                      </View>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}

          {/* Footer */}
          {lines.length > 0 && (
            <View style={styles.footer}>
              <View style={styles.summaryRow}>
                <View style={styles.summaryLeft}>
                  <Text style={styles.summaryLabel}>Subtotal</Text>
                  <Text style={styles.summaryNote}>Taxes & shipping calculated at checkout</Text>
                </View>
                <Text style={styles.summaryPrice}>{formatPrice(sub)}</Text>
              </View>

              <TouchableOpacity
                style={styles.checkoutBtn}
                onPress={() => {
                  close();
                  router.push("/(main)/checkout");
                }}
                activeOpacity={0.88}
                accessibilityRole="button"
                accessibilityLabel="Proceed to checkout"
              >
                <LinearGradient
                  colors={[LUX.olive2, LUX.olive, LUX.ink]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <View pointerEvents="none" style={styles.checkoutHairline} />
                <Ionicons name="lock-closed" size={14} color={LUX.lime} />
                <Text style={styles.checkoutBtnText}>Secure checkout</Text>
                <View style={styles.checkoutArrow}>
                  <Ionicons name="arrow-forward" size={15} color={LUX.ink} />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.viewCartBtn}
                onPress={() => {
                  close();
                  router.push("/(main)/cart");
                }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="View full cart"
              >
                <Text style={styles.viewCartBtnText}>View full bag</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(21,22,15,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: LUX.cream,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 10,
    maxHeight: "88%",
    shadowColor: LUX.ink,
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(22,23,15,0.14)",
    alignSelf: "center",
    marginBottom: 18,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: LINE,
  },

  empty: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 12,
    gap: 8,
  },
  emptyIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(200,164,74,0.35)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  emptyTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 26,
    letterSpacing: -0.6,
    color: LUX.ink,
  },
  emptyItalic: {
    fontFamily: fontFamilies.display.italic,
    color: "#535e2c",
  },
  emptySubtitle: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    color: "rgba(22,23,15,0.55)",
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 14,
    maxWidth: 260,
  },
  exploreBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 52,
    paddingLeft: 24,
    paddingRight: 6,
    borderRadius: 999,
    backgroundColor: LUX.olive,
  },
  exploreBtnText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 13.5,
    color: LUX.cream,
  },
  exploreArrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: LUX.lime,
  },

  list: {
    maxHeight: 360,
  },
  listContent: {
    gap: 12,
    paddingBottom: 4,
  },
  item: {
    flexDirection: "row",
    gap: 14,
    padding: 12,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: LINE,
    shadowColor: LUX.ink,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 2,
  },
  thumbWrap: {
    width: 84,
    height: 104,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: IMG_BG,
  },
  thumb: {
    width: "100%",
    height: "100%",
  },
  thumbPh: {
    alignItems: "center",
    justifyContent: "center",
  },
  itemInfo: {
    flex: 1,
    minWidth: 0,
    justifyContent: "space-between",
  },
  itemTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  itemTitleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  itemName: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 14.5,
    lineHeight: 19,
    letterSpacing: -0.2,
    color: LUX.ink,
  },
  variantText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9.5,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: "#535e2c",
  },
  removeBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: SOFT,
  },
  itemBottom: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: 10,
  },
  priceBlock: {
    alignItems: "flex-end",
  },
  itemPrice: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 17,
    letterSpacing: -0.3,
    color: LUX.ink,
    fontVariant: ["tabular-nums"],
  },
  itemUnitPrice: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 10.5,
    color: "rgba(22,23,15,0.5)",
    marginTop: 1,
  },

  stepper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    backgroundColor: SOFT,
    padding: 3,
  },
  stepperBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    shadowColor: LUX.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 1,
  },
  stepperValue: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 12,
    color: LUX.ink,
    minWidth: 26,
    textAlign: "center",
  },

  footer: {
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: LINE,
    gap: 14,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 12,
  },
  summaryLeft: {
    flex: 1,
    gap: 4,
  },
  summaryLabel: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: LUX.goldInk,
  },
  summaryNote: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11.5,
    color: "rgba(22,23,15,0.5)",
  },
  summaryPrice: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 26,
    letterSpacing: -0.6,
    color: LUX.ink,
    fontVariant: ["tabular-nums"],
  },
  checkoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    height: 60,
    paddingLeft: 22,
    paddingRight: 7,
    gap: 10,
    borderRadius: 999,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(200,164,74,0.22)",
    shadowColor: LUX.ink,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
  },
  checkoutHairline: {
    position: "absolute",
    top: 0,
    left: 32,
    right: 32,
    height: 1,
    backgroundColor: "rgba(200,224,138,0.45)",
  },
  checkoutBtnText: {
    flex: 1,
    fontFamily: fontFamilies.sans.bold,
    fontSize: 15,
    color: LUX.cream,
    letterSpacing: 0.2,
  },
  checkoutArrow: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: LUX.lime,
  },
  viewCartBtn: {
    alignSelf: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  viewCartBtnText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: "#535e2c",
  },
});
