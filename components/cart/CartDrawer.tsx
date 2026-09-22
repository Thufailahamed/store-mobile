import React from "react";
import {
  Modal,
  View,
  ScrollView,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Image,
  Text,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@/components/ui/Icon";
import { useCart } from "@/lib/stores/cart-store";
import { useUI } from "@/lib/stores/ui-store";
import { buildCartLineKeyFromItem } from "@/lib/cart-line-key";
import { colors, radii, spacing, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";

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
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerTitle}>Your bag</Text>
              {lines.length > 0 && (
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>
                    {lines.length} {lines.length === 1 ? "item" : "items"}
                  </Text>
                </View>
              )}
            </View>
            <TouchableOpacity
              onPress={close}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Close bag"
              hitSlop={8}
            >
              <Ionicons name="close" size={17} color={colors.light.foreground} />
            </TouchableOpacity>
          </View>

          {/* Free delivery bar */}
          {lines.length > 0 && (
            remainingForFree === 0 ? (
              <View style={[styles.freeDeliveryBanner, styles.freeDeliveryUnlocked]}>
                <Ionicons name="checkmark-circle" size={13} color={colors.olive[800]} />
                <Text style={styles.freeDeliveryUnlockedText}>
                  Complimentary delivery unlocked!
                </Text>
              </View>
            ) : (
              <View style={styles.freeDeliveryBanner}>
                <View style={styles.freeDeliveryTop}>
                  <Ionicons name="sparkles" size={12} color={colors.accent2.ochre} />
                  <Text style={styles.freeDeliveryText}>
                    Add <Text style={styles.freeDeliveryHighlight}>{formatPrice(remainingForFree)}</Text> more for free delivery
                  </Text>
                </View>
                <View style={styles.progressBarTrack}>
                  <View
                    style={[styles.progressBarFill, { width: `${Math.round(freeProgress * 100)}%` }]}
                  />
                </View>
              </View>
            )
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
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView
              style={styles.list}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            >
              {lines.map((item) => {
                const key = buildCartLineKeyFromItem(item);
                return (
                  <View key={key} style={styles.itemCard}>
                    <View style={styles.thumbWrap}>
                      {item.image ? (
                        <Image source={{ uri: item.image }} style={styles.thumb} />
                      ) : (
                        <View style={[styles.thumb, styles.thumbPh]}>
                          <Ionicons name="image-outline" size={18} color={colors.light.mutedForeground} />
                        </View>
                      )}
                    </View>

                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName} numberOfLines={2}>
                        {item.name}
                      </Text>

                      {item.variantLabel ? (
                        <View style={styles.variantPill}>
                          <Text style={styles.variantText}>{item.variantLabel}</Text>
                        </View>
                      ) : null}

                      <View style={styles.priceRow}>
                        <Text style={styles.itemPrice}>
                          {formatPrice(item.price * item.quantity)}
                        </Text>
                        {item.quantity > 1 && (
                          <Text style={styles.itemUnitPrice}>
                            ({formatPrice(item.price)} each)
                          </Text>
                        )}
                      </View>
                    </View>

                    {/* Quantity Stepper */}
                    <View style={styles.stepperWrap}>
                      <TouchableOpacity
                        onPress={() => {
                          if (item.quantity <= 1) {
                            removeItem(key);
                          } else {
                            updateQuantity(key, item.quantity - 1);
                          }
                        }}
                        style={styles.stepperBtn}
                        hitSlop={6}
                        accessibilityRole="button"
                        accessibilityLabel={item.quantity <= 1 ? "Remove item" : "Decrease quantity"}
                      >
                        <Ionicons
                          name={item.quantity <= 1 ? "trash-outline" : "remove"}
                          size={12}
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
                        <Ionicons name="add" size={12} color={colors.light.foreground} />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}

          {/* Footer */}
          {lines.length > 0 && (
            <View style={styles.footer}>
              <View style={styles.subtotalCard}>
                <View>
                  <Text style={styles.subtotalLabel}>SUBTOTAL</Text>
                  <Text style={styles.subtotalSub}>Taxes & shipping calculated next</Text>
                </View>
                <Text style={styles.subtotalPrice}>{formatPrice(sub)}</Text>
              </View>

              <View style={styles.actionButtons}>
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
                  <Text style={styles.checkoutBtnText}>Checkout</Text>
                  <Ionicons name="arrow-forward" size={16} color={colors.paper.cream} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.viewCartBtn}
                  onPress={() => {
                    close();
                    router.push("/(main)/cart");
                  }}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="View full cart"
                >
                  <Text style={styles.viewCartBtnText}>View Full Bag</Text>
                </TouchableOpacity>
              </View>
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
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.paper.DEFAULT,
    borderTopLeftRadius: radii["3xl"],
    borderTopRightRadius: radii["3xl"],
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    maxHeight: "82%",
    ...shadows.editorial,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.light.border,
    alignSelf: "center",
    marginBottom: spacing[3],
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing[3],
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 22,
    color: colors.light.foreground,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.full,
    backgroundColor: colors.olive[100],
  },
  countBadgeText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 11,
    color: colors.olive[900],
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.paper.warm,
    borderWidth: 1,
    borderColor: colors.light.border,
  },

  freeDeliveryBanner: {
    backgroundColor: "#FFFDF5",
    borderWidth: 1,
    borderColor: "#F0E4B8",
    borderRadius: radii.xl,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    marginBottom: spacing[3],
    gap: 6,
  },
  freeDeliveryUnlocked: {
    backgroundColor: "#F3F8F2",
    borderColor: "#C8E2C6",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  freeDeliveryUnlockedText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 11.5,
    color: colors.olive[800],
  },
  freeDeliveryTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  freeDeliveryText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11.5,
    color: colors.light.mutedForeground,
  },
  freeDeliveryHighlight: {
    fontFamily: fontFamilies.sans.bold,
    color: colors.olive[900],
  },
  progressBarTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(0, 0, 0, 0.06)",
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: colors.accent2.ochre,
    borderRadius: 2,
  },

  empty: {
    alignItems: "center",
    paddingVertical: 36,
    paddingHorizontal: 20,
    gap: 8,
  },
  emptyIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.olive[50],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 16,
    color: colors.light.foreground,
  },
  emptySubtitle: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12.5,
    color: colors.light.mutedForeground,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 12,
  },
  exploreBtn: {
    height: 44,
    paddingHorizontal: 20,
    borderRadius: radii.full,
    backgroundColor: colors.olive[900],
    alignItems: "center",
    justifyContent: "center",
  },
  exploreBtnText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 13,
    color: colors.paper.cream,
  },

  list: {
    maxHeight: 280,
    marginBottom: spacing[2],
  },
  listContent: {
    gap: 8,
    paddingBottom: 4,
  },
  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    padding: spacing[2.5],
    borderRadius: radii.xl,
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  thumbWrap: {
    width: 60,
    height: 72,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: colors.paper.warm,
    borderWidth: 1,
    borderColor: colors.light.border,
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
    gap: 2,
  },
  itemName: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 13,
    color: colors.light.foreground,
    lineHeight: 17,
  },
  variantPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: colors.paper.warm,
    borderWidth: 1,
    borderColor: colors.light.border,
    marginTop: 1,
  },
  variantText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9.5,
    color: colors.olive[800],
    letterSpacing: 0.2,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 2,
  },
  itemPrice: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 13.5,
    color: colors.olive[900],
  },
  itemUnitPrice: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 10.5,
    color: colors.light.mutedForeground,
  },

  stepperWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.paper.warm,
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  stepperBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperValue: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 11,
    color: colors.light.foreground,
    minWidth: 18,
    textAlign: "center",
  },

  footer: {
    gap: spacing[2.5],
    paddingTop: spacing[2],
  },
  subtotalCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing[2],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.light.border,
  },
  subtotalLabel: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 0.8,
    color: colors.olive[700],
    textTransform: "uppercase",
  },
  subtotalSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 10.5,
    color: colors.light.mutedForeground,
    marginTop: 1,
  },
  subtotalPrice: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 18,
    color: colors.light.foreground,
  },

  actionButtons: {
    gap: 8,
  },
  checkoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 50,
    borderRadius: radii.full,
    backgroundColor: colors.olive[900],
    shadowColor: colors.olive[950],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 5,
    elevation: 3,
  },
  checkoutBtnText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 14,
    color: colors.paper.cream,
    letterSpacing: 0.3,
  },
  viewCartBtn: {
    alignItems: "center",
    justifyContent: "center",
    height: 46,
    borderRadius: radii.full,
    backgroundColor: colors.paper.warm,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  viewCartBtnText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: colors.light.foreground,
  },
});
