import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  View,
  ScrollView,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Text,
} from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@/components/ui/Icon";
import { useCart } from "@/lib/stores/cart-store";
import { useUI } from "@/lib/stores/ui-store";
import { buildCartLineKeyFromItem } from "@/lib/cart-line-key";
import { colors, radii, spacing, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";
import { getProductsByIdsBackend } from "@/lib/api/backend";
import { mapProducts } from "@/lib/api/product-mapper";
import type { Product } from "@/lib/types";

const FREE_DELIVERY_THRESHOLD = 15000;

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
  const remainingForFree = Math.max(0, FREE_DELIVERY_THRESHOLD - sub);
  const freeProgress = Math.min(1, sub / FREE_DELIVERY_THRESHOLD);

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.overlay} onPress={close}>
        <Pressable
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom + 8, 20) }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.eyebrow}>Shopping bag</Text>
              <View style={styles.headerTitleRow}>
                <Text style={styles.headerTitle}>Your bag</Text>
                {itemCount > 0 && <Text style={styles.headerCount}>({itemCount})</Text>}
              </View>
            </View>
            <TouchableOpacity
              onPress={close}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Close bag"
              hitSlop={8}
            >
              <Ionicons name="close" size={18} color={colors.light.foreground} />
            </TouchableOpacity>
          </View>

          {/* Free delivery bar */}
          {lines.length > 0 && (
            <View style={styles.delivery}>
              <View style={styles.deliveryRow}>
                <View
                  style={[
                    styles.deliveryIcon,
                    remainingForFree === 0 && styles.deliveryIconDone,
                  ]}
                >
                  <Ionicons
                    name={remainingForFree === 0 ? "checkmark" : "car-outline"}
                    size={13}
                    color={remainingForFree === 0 ? colors.paper.cream : colors.olive[800]}
                  />
                </View>
                <Text style={styles.deliveryText} numberOfLines={1}>
                  {remainingForFree === 0 ? (
                    <Text style={styles.deliveryStrong}>Complimentary delivery unlocked</Text>
                  ) : (
                    <>
                      Add <Text style={styles.deliveryStrong}>{formatPrice(remainingForFree)}</Text>{" "}
                      for free delivery
                    </>
                  )}
                </Text>
                <Text style={styles.deliveryPct}>{Math.round(freeProgress * 100)}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    remainingForFree === 0 && styles.progressFillDone,
                    { width: `${Math.round(freeProgress * 100)}%` },
                  ]}
                />
              </View>
            </View>
          )}

          {/* Body */}
          {lines.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="bag-outline" size={28} color={colors.olive[800]} />
              </View>
              <Text style={styles.emptyTitle}>Your bag is empty</Text>
              <Text style={styles.emptySubtitle}>
                Explore curated pieces and add your favorites to the bag.
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
                <Ionicons name="arrow-forward" size={14} color={colors.paper.cream} />
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView
              style={styles.list}
              showsVerticalScrollIndicator={false}
            >
              {lines.map((item, index) => {
                const key = buildCartLineKeyFromItem(item);
                const imageUrl = imageFor(item);
                return (
                  <View
                    key={key}
                    style={[styles.itemRow, index > 0 && styles.itemRowDivider]}
                  >
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
                          <Ionicons name="image-outline" size={20} color={colors.olive[300]} />
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
                          hitSlop={10}
                          accessibilityRole="button"
                          accessibilityLabel={`Remove ${item.name}`}
                        >
                          <Ionicons name="close" size={16} color={colors.light.mutedForeground} />
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
                              color={item.quantity <= 1 ? colors.accent2.rust : colors.light.foreground}
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
                            <Ionicons name="add" size={13} color={colors.light.foreground} />
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
              <View style={styles.summary}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Subtotal</Text>
                  <Text style={styles.summaryPrice}>{formatPrice(sub)}</Text>
                </View>
                <Text style={styles.summaryNote}>Taxes & shipping calculated at checkout</Text>
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
                <Ionicons name="lock-closed" size={14} color={colors.olive[200]} />
                <Text style={styles.checkoutBtnText}>Secure checkout</Text>
                <View style={styles.checkoutArrow}>
                  <Ionicons name="arrow-forward" size={15} color={colors.olive[900]} />
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
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(22, 23, 15, 0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.paper.cream,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2.5],
    maxHeight: "85%",
    ...shadows.editorial,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.olive[200],
    alignSelf: "center",
    marginBottom: spacing[4],
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: spacing[4],
  },
  eyebrow: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: colors.olive[600],
    marginBottom: 2,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  headerTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 28,
    letterSpacing: -0.5,
    color: colors.light.foreground,
  },
  headerCount: {
    fontFamily: fontFamilies.display.italic,
    fontSize: 20,
    color: colors.olive[500],
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.paper.warm,
  },

  delivery: {
    backgroundColor: colors.paper.warm,
    borderRadius: radii["2xl"],
    padding: spacing[3],
    marginBottom: spacing[2],
    gap: spacing[2.5],
  },
  deliveryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
  },
  deliveryIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.paper.cream,
  },
  deliveryIconDone: {
    backgroundColor: colors.olive[600],
  },
  deliveryText: {
    flex: 1,
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12.5,
    color: colors.ink.mute,
  },
  deliveryStrong: {
    fontFamily: fontFamilies.sans.bold,
    color: colors.light.foreground,
  },
  deliveryPct: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10.5,
    color: colors.olive[600],
  },
  progressTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(22, 23, 15, 0.08)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.accent2.ochre,
    borderRadius: 2,
  },
  progressFillDone: {
    backgroundColor: colors.olive[600],
  },

  empty: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 20,
    gap: 8,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.paper.warm,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  emptyTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 20,
    color: colors.light.foreground,
  },
  emptySubtitle: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    color: colors.light.mutedForeground,
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 12,
    maxWidth: 260,
  },
  exploreBtn: {
    flexDirection: "row",
    gap: 8,
    height: 48,
    paddingHorizontal: 24,
    borderRadius: radii.full,
    backgroundColor: colors.olive[900],
    alignItems: "center",
    justifyContent: "center",
  },
  exploreBtnText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 13.5,
    color: colors.paper.cream,
  },

  list: {
    maxHeight: 320,
  },
  itemRow: {
    flexDirection: "row",
    gap: spacing[3.5],
    paddingVertical: spacing[4],
  },
  itemRowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.light.border,
  },
  thumbWrap: {
    width: 76,
    height: 96,
    borderRadius: radii.xl,
    overflow: "hidden",
    backgroundColor: colors.paper.warm,
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
    gap: spacing[2],
  },
  itemTitleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  itemName: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14.5,
    lineHeight: 19,
    color: colors.light.foreground,
  },
  variantText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.ink.mute,
  },
  itemBottom: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: spacing[2.5],
  },
  priceBlock: {
    alignItems: "flex-end",
  },
  itemPrice: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 15,
    color: colors.light.foreground,
  },
  itemUnitPrice: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 10.5,
    color: colors.light.mutedForeground,
    marginTop: 1,
  },

  stepper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: 2,
  },
  stepperBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperValue: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 12,
    color: colors.light.foreground,
    minWidth: 22,
    textAlign: "center",
  },

  footer: {
    paddingTop: spacing[4],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.light.border,
    gap: spacing[3],
  },
  summary: {
    gap: 2,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  summaryLabel: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10.5,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: colors.olive[700],
  },
  summaryPrice: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 24,
    letterSpacing: -0.3,
    color: colors.light.foreground,
  },
  summaryNote: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11.5,
    color: colors.light.mutedForeground,
  },
  checkoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    height: 56,
    paddingLeft: spacing[5],
    paddingRight: 6,
    gap: spacing[2],
    borderRadius: radii.full,
    backgroundColor: colors.olive[900],
    shadowColor: colors.olive[950],
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 5,
  },
  checkoutBtnText: {
    flex: 1,
    fontFamily: fontFamilies.sans.bold,
    fontSize: 15,
    color: colors.paper.cream,
    letterSpacing: 0.2,
  },
  checkoutArrow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.paper.cream,
  },
  viewCartBtn: {
    alignSelf: "center",
    paddingVertical: spacing[1.5],
    paddingHorizontal: spacing[3],
  },
  viewCartBtnText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: colors.light.foreground,
    textDecorationLine: "underline",
  },
});
