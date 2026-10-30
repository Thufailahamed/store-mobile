import React, { useState, useMemo, useCallback, useEffect } from "react";
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { C } from "@/components/orders/parcel-track";
import { navigateHome } from "@/lib/navigation";
import { useRouter, useFocusEffect } from "expo-router";
import { useCart, useWishlist } from "@/lib/stores";
import { useAuth } from "@/lib/supabase/auth";
import { fontFamilies } from "@/lib/theme/fonts";
import { spacing, colors, radii, shadows } from "@/lib/theme/tokens";
import { computeCartTotals } from "@/lib/cart-pricing";
import { useCheckoutPricing } from "@/lib/hooks/useCheckoutPricing";
import { formatPrice } from "@/lib/utils";
import { useToast } from "@/components/ui";
import { CartItemCard } from "@/components/cart/CartItemCard";
import { getVariantStock } from "@/components/cart/variant-utils";
import { BagEmptyState } from "@/components/cart/BagEmptyState";
import { BagDiscovery } from "@/components/cart/BagDiscovery";
import { mapProducts } from "@/lib/api/product-mapper";
import type { Product } from "@/lib/types";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@/components/ui/Icon";
import { getAddresses, getProducts } from "@/lib/api";
import { getProductsByIdsBackend } from "@/lib/api/backend";
import { getCatalogVisibleStoreIds } from "@/lib/catalog-visibility";
import { useCartRealtime } from "@/lib/hooks/useCartRealtime";
import {
  refreshCartFromCatalog,
  assessCartItemIssue,
} from "@/lib/cart-validation";
import {
  prepareCartForCheckout,
  restoreUnselectedCartItems,
} from "@/lib/cart-checkout-session";
import { ProductCard } from "@/components/product/ProductCard";
import { ProductRail } from "@/components/home/premium";
import { fetchRecentlyViewed, fetchColdStartProducts } from "@/lib/recommender";
import { useTrackEvent } from "@/lib/recommender";
import { LinearGradient } from "expo-linear-gradient";

export default function CartScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const insets = useSafeAreaInsets();
  const {
    items: cartRecord,
    removeItem,
    updateQuantity,
    addItem,
  } = useCart();
  const items = useMemo(() => cartRecord ?? {}, [cartRecord]);
  const wishlist = useWishlist();
  const tracker = useTrackEvent();

  const [addressText, setAddressText] = useState("Add delivery address");
  const [hasSavedAddress, setHasSavedAddress] = useState(false);
  const [buyAgainProducts, setBuyAgainProducts] = useState<Product[]>([]);

  const [productDetails, setProductDetails] = useState<Record<string, Product>>({});
  const [catalogVisibleStoreIds, setCatalogVisibleStoreIds] = useState<Set<string>>(new Set());
  const [selectedKeys, setSelectedKeys] = useState<Record<string, boolean>>({});

  const cartItems = useMemo(() => Object.entries(items), [items]);

  const cartProductIds = useMemo(() => {
    return Array.from(new Set(cartItems.map(([_, it]) => it.productId)));
  }, [cartItems]);

  /**
   * Group the cart by storeId for multi-vendor UI. Items stay in the same
   * `selectedKeys` map; we just add a small visual structure so buyers can
   * see "this store's items, that store's items" without losing the existing
   * selection/coupon/shipping math.
   */
  type CartRow =
    | { type: "header"; storeId: string; storeName: string; itemCount: number; subtotal: number }
    | { type: "item"; key: string; item: typeof items[string] };

  const cartRows = useMemo<CartRow[]>(() => {
    const sorted = [...cartItems].sort((a, b) => {
      if (a[1].storeId === b[1].storeId) return 0;
      return a[1].storeId.localeCompare(b[1].storeId);
    });
    const groups = new Map<string, { storeName: string; subtotal: number; itemCount: number; rows: CartRow[] }>();
    for (const [key, item] of sorted) {
      const group = groups.get(item.storeId) ?? {
        storeName: productDetails[item.productId]?.store?.name ?? "Store",
        subtotal: 0,
        itemCount: 0,
        rows: [],
      };
      group.subtotal += item.price * item.quantity;
      group.itemCount += item.quantity;
      group.rows.push({ type: "item", key, item });
      groups.set(item.storeId, group);
    }
    const out: CartRow[] = [];
    for (const [storeId, group] of groups) {
      out.push({
        type: "header",
        storeId,
        storeName: group.storeName,
        itemCount: group.itemCount,
        subtotal: group.subtotal,
      });
      for (const row of group.rows) out.push(row);
    }
    return out;
    // productDetails is part of the dep so the store name refreshes when products hydrate
  }, [cartItems, productDetails]);

  // Load detailed product rows via the backend so prices/stock match the
  // public catalogue and RLS doesn't leak rows the buyer shouldn't see.
  useEffect(() => {
    if (cartProductIds.length === 0) return;
    let cancelled = false;
    (async () => {
      const res = await getProductsByIdsBackend(cartProductIds);
      if (cancelled || !res.ok || !res.data) return;
      const byId: Record<string, Product> = {};
      mapProducts(res.data.products).forEach((p) => {
        byId[p.id] = p;
      });
      if (!cancelled) {
        setProductDetails(byId);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cartProductIds]);

  useEffect(() => {
    getCatalogVisibleStoreIds().then(setCatalogVisibleStoreIds);
  }, []);

  // Realtime reconciliation — when a product / variant / inventory row
  // changes inside a store the user has in their cart, re-run the
  // reconciliation so removed / out-of-stock / price-changed lines are
  // patched in place without waiting for the user to navigate.
  useCartRealtime();

  useFocusEffect(
    useCallback(() => {
      void refreshCartFromCatalog().then((result) => {
        if (!result.ok) {
          toast(result.error, "error");
          return;
        }
        const { reconciliation } = result;
        const oosCount = reconciliation.outOfStock?.length ?? 0;
        const removedCount = reconciliation.remove.length;
        if (oosCount > 0) {
          toast(
            `${oosCount} item${oosCount === 1 ? " is" : "s are"} out of stock — please remove them to proceed.`,
            "error",
          );
        } else if (removedCount > 0) {
          toast(
            `${removedCount} unavailable item${removedCount === 1 ? "" : "s"} removed from your bag`,
            "info",
          );
        } else if (reconciliation.update.some((patch) => patch.price !== undefined)) {
          toast("Bag prices updated to match current listings", "info");
        }
      });
    }, [toast]),
  );

  // Keep selectedKeys in sync with cartItems
  useEffect(() => {
    setSelectedKeys((prev) => {
      const next = { ...prev };
      let changed = false;
      cartItems.forEach(([key]) => {
        if (next[key] === undefined) {
          next[key] = true;
          changed = true;
        }
      });
      Object.keys(next).forEach((key) => {
        if (!items[key]) {
          delete next[key];
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [cartItems, items]);

  const selectedCartItems = useMemo(() => {
    return cartItems.filter(([key]) => selectedKeys[key]);
  }, [cartItems, selectedKeys]);

  const selectedCount = useMemo(() => {
    return Object.keys(selectedKeys).filter((k) => selectedKeys[k]).length;
  }, [selectedKeys]);

  const allSelected = cartItems.length > 0 && selectedCount === cartItems.length;
  const hasUnavailableItems = Object.values(items).some((i) => i.is_unavailable);

  const handleToggleSelect = useCallback((key: string) => {
    setSelectedKeys((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }, []);

  const handleToggleSelectAll = useCallback(() => {
    setSelectedKeys((prev) => {
      const next = { ...prev };
      const targetState = !allSelected;
      cartItems.forEach(([key]) => {
        next[key] = targetState;
      });
      return next;
    });
  }, [cartItems, allSelected]);

  // Update product variant inside cart store
  const handleUpdateVariant = useCallback(
    (oldKey: string, newVariantId: string, newVariantLabel: string) => {
      const oldItem = items[oldKey];
      if (!oldItem) return;

      const product = productDetails[oldItem.productId];
      const newVariant = product?.variants?.find((v) => v.id === newVariantId);
      if (!newVariant) return;

      removeItem(oldKey);

      addItem({
        productId: oldItem.productId,
        variantId: newVariantId,
        storeId: oldItem.storeId,
        name: oldItem.name,
        variantLabel: newVariantLabel,
        price: newVariant.price || oldItem.price,
        image: newVariant.image_url || oldItem.image,
        stock: getVariantStock(newVariant, newVariant.stock ?? 99),
        quantity: oldItem.quantity,
      });
    },
    [items, productDetails, removeItem, addItem]
  );

  // Restore unselected items if checkout was abandoned (e.g. app restart).
  useEffect(() => {
    void restoreUnselectedCartItems(addItem);
  }, [addItem]);

  const navigateToCheckout = useCallback(
    async (openAddress: boolean) => {
      if (!user) {
        toast("Sign in to place your order", "info");
        router.push("/(auth)/login");
        return;
      }

      const prep = await prepareCartForCheckout({
        items,
        selectedKeys,
        removeItem,
      });
      if (!prep.ok) {
        toast(prep.error, "error");
        return;
      }

      const addressRes = await getAddresses(user.id);
      const hasAddress = addressRes.ok && (addressRes.data?.length ?? 0) > 0;
      router.push(
        hasAddress && !openAddress
          ? "/(main)/checkout"
          : "/(main)/checkout?openAddress=1",
      );
    },
    [items, selectedKeys, removeItem, router, toast, user],
  );

  const handlePlaceOrder = async () => {
    if (!user) {
      toast("Sign in to place your order", "info");
      router.push("/(auth)/login");
      return;
    }

    await navigateToCheckout(false);
  };

  const sub = useMemo(() => {
    return selectedCartItems.reduce((sum, [_, item]) => sum + item.price * item.quantity, 0);
  }, [selectedCartItems]);

  // Total MRP = sum of the real catalogue MRP, falling back to the sale price.
  const totalMrp = useMemo(() => {
    return selectedCartItems.reduce((sum, [_, item]) => {
      const product = productDetails[item.productId];
      const variant = product?.variants?.find((entry) => entry.id === item.variantId);
      const mrp = variant?.mrp || product?.mrp || item.price;
      return sum + mrp * item.quantity;
    }, 0);
  }, [selectedCartItems, productDetails]);

  const discountOnMrp = Math.max(0, totalMrp - sub);
  const selectedPricingLines = useMemo(
    () =>
      selectedCartItems.map(([_, item]) => ({
        storeId: item.storeId,
        quantity: item.quantity,
        unitPrice: item.price,
      })),
    [selectedCartItems],
  );
  const pricing = useCheckoutPricing();
  const cartTotals = useMemo(
    () =>
      computeCartTotals({
        lines: selectedPricingLines,
        pricing,
      }),
    [selectedPricingLines, selectedCartItems, pricing],
  );
  const shippingFee = cartTotals.shipping;
  const tax = cartTotals.tax;
  const totalAmount = cartTotals.total;
  const wishlistCount = wishlist.count();

  const handleRemove = useCallback(
    (key: string, name: string) => {
      const product = productDetails[items[key]?.productId ?? ""];
      removeItem(key);
      if (product) tracker.removeFromCart(product);
      toast(`${name} removed from bag`, "info");
    },
    [removeItem, toast, productDetails, items, tracker]
  );

  // Load address
  useEffect(() => {
    if (!user?.id) {
      setAddressText("Sign in to add delivery address");
      setHasSavedAddress(false);
      return;
    }
    let cancelled = false;
    getAddresses(user.id)
      .then((res) => {
        if (cancelled) return;
        if (res.ok && res.data && res.data.length > 0) {
          const defaultAddr = res.data.find((a) => a.is_default) || res.data[0];
          const text = `${defaultAddr.line1}${defaultAddr.city ? `, ${defaultAddr.city}` : ""}`;
          setAddressText(text);
          setHasSavedAddress(true);
        } else {
          setAddressText("Add delivery address");
          setHasSavedAddress(false);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setAddressText("Add delivery address");
        setHasSavedAddress(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Load "Buy It Again" items
  useEffect(() => {
    let cancelled = false;
    getProducts({ limit: 6 })
      .then((res) => {
        if (cancelled) return;
        if (res.ok && res.data) {
          setBuyAgainProducts(res.data.products);
        }
      })
      .catch(() => {
        /* Buy-It-Again is a soft-fail section; leave it empty on error. */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const wishlistIds = useMemo(
    () => Object.keys(wishlist.items ?? {}).filter((id) => wishlist.items[id]),
    [wishlist.items],
  );
  const discoveryCartProducts = useMemo(
    () =>
      cartItems
        .map(([, item]) => productDetails[item.productId])
        .filter((p): p is Product => Boolean(p)),
    [cartItems, productDetails],
  );
  const buyAgainIds = useMemo(() => buyAgainProducts.map((p) => p.id), [buyAgainProducts]);
  const handleDiscoverySeeAll = useCallback(
    (path: string) => router.push(path as never),
    [router],
  );

  const handleAddressPress = () => {
    if (!user) {
      router.push("/(auth)/login");
      return;
    }
    if (selectedCartItems.length === 0) {
      toast("Please select at least one item to checkout", "error");
      return;
    }
    void navigateToCheckout(true);
  };

  const disabledCheckout = selectedCount === 0 || hasUnavailableItems;

  const header = (
    <BagHeader
      topInset={insets.top}
      onClose={() => navigateHome(router)}
      onWishlist={() => router.push("/(main)/wishlist")}
      wishlistCount={wishlistCount}
    />
  );

  if (cartItems.length === 0) {
    return (
      <View style={bs.root}>
        <LinearGradient pointerEvents="none" colors={[C.glow, C.glowSoft, C.paper]} locations={[0, 0.55, 1]} style={bs.glow} />
        <ScrollView
          style={styles.emptyWrap}
          contentContainerStyle={[styles.emptyScrollContent, { paddingTop: 0 }]}
          showsVerticalScrollIndicator={false}
        >
          {header}
          <BagEmptyState hasWishlistItems={wishlistCount > 0} />
          <EmptyCartSuggestions userId={user?.id ?? null} onSeeAll={() => router.push("/(main)/products?sort=newest")} />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={bs.root}>
      <LinearGradient pointerEvents="none" colors={[C.glow, C.glowSoft, C.paper]} locations={[0, 0.55, 1]} style={bs.glow} />

      <FlatList
        data={cartRows}
        keyExtractor={(row) =>
          row.type === "header" ? `__hdr__${row.storeId}` : row.key
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            {header}

            {/* Delivery */}
            <SectionHead kicker="DELIVER TO" title="Delivery" />
            <TouchableOpacity style={[bs.deliveryCard, bs.gutter]} activeOpacity={0.85} onPress={handleAddressPress}>
              <View style={bs.deliveryIcon}>
                <Ionicons name="location" size={18} color={C.accent} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={bs.deliveryTitle} numberOfLines={1}>
                  {addressText}
                </Text>
                <Text style={bs.deliverySub} numberOfLines={1}>
                  {hasSavedAddress ? "Tap to change the delivery address" : "Add an address for delivery estimates"}
                </Text>
              </View>
              <View style={bs.chevCircle}>
                <Ionicons name="chevron-forward" size={15} color={C.text} />
              </View>
            </TouchableOpacity>

            <SectionHead
              kicker={`${selectedCount} OF ${cartItems.length} SELECTED`}
              title="Your pieces"
              action={allSelected ? "Deselect all" : "Select all"}
              onAction={handleToggleSelectAll}
            />
          </View>
        }
        renderItem={({ item: row }) => {
          if (row.type === "header") {
            return (
              <View style={bs.storeHead}>
                <View style={bs.storeIcon}>
                  <Ionicons name="storefront" size={13} color={C.accent} />
                </View>
                <Text style={bs.storeName} numberOfLines={1}>
                  {row.storeName}
                </Text>
                <Text style={bs.storeCount}>
                  · {row.itemCount} {row.itemCount === 1 ? "item" : "items"}
                </Text>
                <View style={{ flex: 1 }} />
                <Text style={bs.storeSubtotal}>{formatPrice(row.subtotal)}</Text>
              </View>
            );
          }
          const { key, item: cartItem } = row;
          const issue = assessCartItemIssue(
            cartItem,
            productDetails[cartItem.productId],
            catalogVisibleStoreIds,
          );
          return (
          <CartItemCard
            item={cartItem}
            product={productDetails[cartItem.productId]}
            unavailableMessage={issue?.message}
            selected={!!selectedKeys[key]}
            onToggleSelect={() => handleToggleSelect(key)}
            onIncrement={() => updateQuantity(key, (useCart.getState().items[key]?.quantity ?? cartItem.quantity) + 1)}
            onDecrement={() => updateQuantity(key, (useCart.getState().items[key]?.quantity ?? cartItem.quantity) - 1)}
            onRemove={() => handleRemove(key, cartItem.name)}
            onUpdateQuantity={(quantity) => updateQuantity(key, quantity)}
            onUpdateVariant={(newVariantId, newVariantLabel) => handleUpdateVariant(key, newVariantId, newVariantLabel)}
          />
          );
        }}
        ListFooterComponent={
          <View style={{ paddingBottom: 24 }}>
            <SectionHead kicker="ORDER SUMMARY" title="Price details" />
            <View style={[bs.cardShadow, bs.gutter]}>
              <View style={bs.priceCard}>
                <PriceRow label="Total MRP" value={formatPrice(selectedCount === 0 ? 0 : totalMrp)} />
                {selectedCount > 0 && (
                  <>
                    <PriceRow label="Discount on MRP" value={`– ${formatPrice(discountOnMrp)}`} accent />
                    <PriceRow label="Delivery" value={shippingFee === 0 ? "Complimentary" : formatPrice(shippingFee)} />
                    <PriceRow label={`Platform fee · ${pricing.platform_fee_pct}%`} value={formatPrice(tax)} />
                  </>
                )}
                <View style={bs.priceDivider} />
                <View style={bs.priceTotalRow}>
                  <Text style={bs.priceTotalLabel}>Total amount</Text>
                  <Text style={bs.priceTotalValue}>{formatPrice(selectedCount === 0 ? 0 : totalAmount)}</Text>
                </View>

                {selectedCount > 0 && discountOnMrp > 0 && (
                  <View style={bs.saveStrip}>
                    <View style={bs.saveIcon}>
                      <Ionicons name="sparkles" size={14} color={C.ink} />
                    </View>
                    <Text style={bs.saveText}>
                      You're saving <Text style={bs.saveBold}>{formatPrice(discountOnMrp)}</Text> on this order
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Trust tiles */}
            <View style={[bs.quickRow, bs.gutter, { marginTop: 12 }]}>
              {[
                { icon: "shield-checkmark-outline" as const, label: "Genuine pieces" },
                { icon: "cube-outline" as const, label: "Contactless" },
                { icon: "lock-closed-outline" as const, label: "Secure pay" },
              ].map((b) => (
                <View key={b.label} style={[bs.quick, { paddingVertical: 12 }]}>
                  <View style={[bs.quickIcon, { width: 36, height: 36, borderRadius: 18 }]}>
                    <Ionicons name={b.icon} size={16} color={C.accent} />
                  </View>
                  <Text style={[bs.quickLabel, { fontSize: 11.5 }]}>{b.label}</Text>
                </View>
              ))}
            </View>

            <Text style={bs.terms}>
              By placing the order, you agree to Luxe's <Text style={bs.termsLink}>Terms of Use</Text> and{" "}
              <Text style={bs.termsLink}>Privacy Policy</Text>
            </Text>

            {/* Discovery rails: complete the look, for you, wishlist, recent */}
            <View style={styles.buyAgainSection}>
              <BagDiscovery
                userId={user?.id ?? null}
                cartProducts={discoveryCartProducts}
                wishlistIds={wishlistIds}
                excludeIds={buyAgainIds}
                onSeeAll={handleDiscoverySeeAll}
              />

              {/* Buy It Again Section */}
              <ProductRail
                kicker="Back in rotation"
                title="Buy it again"
                products={buyAgainProducts}
                showSaleBadge
                onSeeAll={() => router.push("/(main)/products")}
              />
            </View>

            <View style={{ height: 120 }} />
          </View>
        }
      />

      {/* Fades scrolled content out under the status bar, as on Account. */}
      <LinearGradient
        pointerEvents="none"
        colors={[C.glow, "rgba(235,229,204,0)"]}
        locations={[0.7, 1]}
        style={[bs.statusMask, { height: insets.top + 14 }]}
      />

      {/* Pinned checkout bar */}
      <View style={[bs.footer, { paddingBottom: Math.max(insets.bottom, 14) + 4 }]}>
        <View style={bs.footerTop}>
          <View>
            <Text style={bs.footerKicker}>ORDER TOTAL</Text>
            <Text style={bs.footerTotal}>{formatPrice(selectedCount === 0 ? 0 : totalAmount)}</Text>
          </View>
          <View style={bs.footerPill}>
            <Ionicons name="checkmark-circle" size={13} color={C.accent} />
            <Text style={bs.footerPillText}>
              {selectedCount} of {cartItems.length} selected
            </Text>
          </View>
        </View>

        {selectedCount === 0 && (
          <Text style={bs.footerWarn}>No items selected — pick at least one to place your order.</Text>
        )}

        <TouchableOpacity
          style={[bs.checkoutBtn, disabledCheckout && bs.checkoutBtnOff]}
          disabled={disabledCheckout}
          onPress={handlePlaceOrder}
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityState={{ disabled: disabledCheckout }}
        >
          <Text style={[bs.checkoutText, disabledCheckout && { color: C.muted }]}>
            {hasUnavailableItems ? "Remove out of stock items" : "Continue to checkout"}
          </Text>
          {!disabledCheckout && (
            <View style={bs.checkoutArrow}>
              <Ionicons name="arrow-forward" size={18} color={C.ink} />
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ---------------------------------------------------------------- pieces */

function BagHeader({
  topInset,
  onClose,
  onWishlist,
  wishlistCount,
}: {
  topInset: number;
  onClose: () => void;
  onWishlist: () => void;
  wishlistCount: number;
}) {
  return (
    <View style={[bs.header, bs.gutter, { paddingTop: topInset + 8 }]}>
      <TouchableOpacity style={bs.circleBtn} onPress={onClose} activeOpacity={0.8} accessibilityLabel="Close bag">
        <Ionicons name="close" size={20} color={C.text} />
      </TouchableOpacity>
      <Text style={bs.title} accessibilityRole="header">
        My Bag
      </Text>
      <TouchableOpacity style={bs.circleBtn} onPress={onWishlist} activeOpacity={0.8} accessibilityLabel="Wishlist">
        <Ionicons name="heart-outline" size={19} color={C.text} />
        {wishlistCount > 0 ? (
          <View style={bs.badge}>
            <Text style={bs.badgeText}>{wishlistCount > 9 ? "9+" : wishlistCount}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    </View>
  );
}

function SectionHead({
  kicker,
  title,
  action,
  onAction,
}: {
  kicker: string;
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={[bs.sectionHead, bs.gutter]}>
      <View style={{ flex: 1 }}>
        <Text style={bs.sectionKicker}>{kicker}</Text>
        <Text style={bs.sectionTitle}>{title}</Text>
      </View>
      {action && onAction ? (
        <TouchableOpacity onPress={onAction} hitSlop={8} activeOpacity={0.75} style={bs.sectionAction}>
          <Text style={bs.sectionActionText}>{action}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function PriceRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={bs.priceRow}>
      <Text style={bs.priceLabel}>{label}</Text>
      <Text style={[bs.priceValue, accent && { color: C.accent }]}>{value}</Text>
    </View>
  );
}

const bs = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  glow: { position: "absolute", top: 0, left: 0, right: 0, height: 380 },
  gutter: { marginHorizontal: 20 },
  statusMask: { position: "absolute", top: 0, left: 0, right: 0 },

  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: 16 },
  title: {
    flex: 1,
    fontFamily: fontFamilies.display.semibold,
    fontSize: 31,
    letterSpacing: -0.8,
    color: C.text,
  },
  circleBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: C.ink,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  badgeText: { fontFamily: fontFamilies.sans.bold, fontSize: 9.5, color: C.lime },

  cardShadow: {
    borderRadius: 26,
    backgroundColor: "#FFFFFF",
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.07,
    shadowRadius: 20,
    elevation: 3,
  },
  quickRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  quick: {
    flex: 1,
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: C.line,
  },
  quickIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  quickLabel: { fontFamily: fontFamilies.sans.semibold, fontSize: 12.5, color: C.text },

  sectionHead: { flexDirection: "row", alignItems: "flex-end", marginTop: 28, marginBottom: 12, paddingHorizontal: 2 },
  sectionAction: { paddingBottom: 2 },
  sectionActionText: { fontFamily: fontFamilies.sans.semibold, fontSize: 13.5, color: C.accent },
  sectionKicker: { fontFamily: fontFamilies.mono.semibold, fontSize: 10, letterSpacing: 1.8, color: C.accent },
  sectionTitle: { marginTop: 3, fontFamily: fontFamilies.sans.bold, fontSize: 19, letterSpacing: -0.4, color: C.text },

  deliveryCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: C.line,
  },
  deliveryIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  deliveryTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 15, letterSpacing: -0.2, color: C.text },
  deliverySub: { fontFamily: fontFamilies.sans.regular, fontSize: 12.5, color: C.muted, marginTop: 2 },
  chevCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f5f3ec",
    alignItems: "center",
    justifyContent: "center",
  },

  storeHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 22,
    marginTop: 6,
    marginBottom: 10,
  },
  storeIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: C.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  storeName: { fontFamily: fontFamilies.sans.bold, fontSize: 13.5, letterSpacing: 0.2, color: C.text, flexShrink: 1 },
  storeCount: { fontFamily: fontFamilies.sans.regular, fontSize: 12.5, color: C.muted },
  storeSubtotal: { fontFamily: fontFamilies.sans.bold, fontSize: 13.5, color: C.text, fontVariant: ["tabular-nums"] },

  priceCard: { borderRadius: 26, overflow: "hidden", borderWidth: 1, borderColor: C.line, padding: 18, gap: 12 },
  priceRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  priceLabel: { fontFamily: fontFamilies.sans.regular, fontSize: 14, color: C.muted },
  priceValue: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: C.text, fontVariant: ["tabular-nums"] },
  priceDivider: { height: 1, backgroundColor: C.line, marginVertical: 2 },
  priceTotalRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  priceTotalLabel: { fontFamily: fontFamilies.sans.bold, fontSize: 16, color: C.text },
  priceTotalValue: { fontFamily: fontFamilies.sans.bold, fontSize: 20, letterSpacing: -0.4, color: C.text, fontVariant: ["tabular-nums"] },
  saveStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
    padding: 12,
    borderRadius: 18,
    backgroundColor: C.ink,
  },
  saveIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: C.lime,
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: { flex: 1, fontFamily: fontFamilies.sans.regular, fontSize: 13, color: "rgba(250,248,241,0.75)" },
  saveBold: { fontFamily: fontFamilies.sans.bold, color: C.lime },

  terms: {
    marginTop: 16,
    marginHorizontal: 28,
    textAlign: "center",
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11.5,
    lineHeight: 17,
    color: C.muted,
  },
  termsLink: { fontFamily: fontFamilies.sans.semibold, color: C.accent },

  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 14,
    paddingHorizontal: 20,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: C.line,
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 12,
    gap: 12,
  },
  footerTop: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  footerKicker: { fontFamily: fontFamilies.mono.semibold, fontSize: 10, letterSpacing: 1.8, color: C.accent },
  footerTotal: {
    marginTop: 2,
    fontFamily: fontFamilies.display.semibold,
    fontSize: 26,
    letterSpacing: -0.6,
    color: C.text,
    fontVariant: ["tabular-nums"],
  },
  footerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 11,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.accentSoft,
    marginBottom: 4,
  },
  footerPillText: { fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: colors.olive[800] },
  footerWarn: { fontFamily: fontFamilies.sans.medium, fontSize: 12.5, color: C.accent },
  checkoutBtn: {
    height: 60,
    borderRadius: 30,
    backgroundColor: C.ink,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: 24,
    paddingRight: 8,
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 6,
  },
  checkoutBtnOff: { backgroundColor: "#ecebe3", shadowOpacity: 0 },
  checkoutText: { flex: 1, fontFamily: fontFamilies.sans.bold, fontSize: 16.5, color: C.cream, letterSpacing: 0.1 },
  checkoutArrow: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: C.lime,
    alignItems: "center",
    justifyContent: "center",
  },
});

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: spacing[6],
  },
  customHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    borderBottomWidth: 1,
  },
  emptyWrap: {
    flex: 1,
  },
  emptyScrollContent: {
    flexGrow: 1,
    paddingTop: spacing[4],
    paddingBottom: spacing[10],
  },
  headerLeftBtn: {
    position: "absolute",
    left: 20,
    bottom: 9,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  headerRightBtn: {
    position: "absolute",
    right: 20,
    bottom: 9,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
  },
  headerTitle: {
    fontFamily: fontFamilies.sans.bold,
    fontWeight: "800",
    fontSize: 20,
    textAlign: "center",
  },
  storeGroupHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radii.xl,
    backgroundColor: `${colors.olive[500]}0D`,
  },
  storeGroupHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
  },
  storeGroupName: {
    fontFamily: fontFamilies.sans.bold,
    fontWeight: "700",
  },
  storeGroupCount: {
    marginLeft: 6,
  },
  storeGroupSubtotal: {
    fontFamily: fontFamilies.sans.bold,
    fontWeight: "700",
  },
  deliveryBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginTop: 14,
    padding: 14,
    borderWidth: 1,
    borderRadius: radii["2xl"],
    backgroundColor: colors.paper.cream,
    ...shadows.soft,
  },
  deliveryLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  deliveryIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  deliveryTextWrap: {
    flex: 1,
    gap: 2,
  },
  deliveryEyebrow: {
    color: colors.olive[600],
    fontSize: 8,
    letterSpacing: 1.2,
  },
  deliveryTitle: {
    fontFamily: fontFamilies.sans.bold,
    fontWeight: "700",
    fontSize: 14,
  },
  deliveryArrow: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${colors.olive[500]}10`,
  },
  optionsList: {
    marginTop: spacing[4],
  },
  optionItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  optionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  optionText: {
    fontFamily: fontFamilies.sans.bold,
    fontWeight: "700",
    fontSize: 15,
  },
  feeBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 20,
    marginTop: 16,
    gap: 12,
  },
  feeText: {
    flex: 1,
    fontFamily: fontFamilies.sans.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  surpriseBtn: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  surpriseBtnText: {
    fontFamily: fontFamilies.sans.bold,
    fontWeight: "700",
    fontSize: 12,
  },
  savingsBanner: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 20,
    marginTop: 12,
  },
  savingsText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13.5,
  },
  savingsTextBold: {
    fontFamily: fontFamilies.sans.bold,
    fontWeight: "700",
  },
  subtotalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 20,
    marginTop: 24,
    marginBottom: 8,
  },
  subtotalLabel: {
    fontFamily: fontFamilies.sans.bold,
    fontWeight: "800",
    fontSize: 20,
  },
  subtotalValue: {
    fontFamily: fontFamilies.sans.bold,
    fontWeight: "800",
    fontSize: 20,
  },
  buyAgainSection: {
    marginTop: 24,
  },
  buyAgainHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  buyAgainTitle: {
    fontFamily: fontFamilies.sans.bold,
    fontWeight: "800",
    fontSize: 18,
  },
  moreItemsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  moreItemsText: {
    fontFamily: fontFamilies.sans.bold,
    fontWeight: "700",
    fontSize: 13,
  },
  buyAgainList: {
    paddingHorizontal: 20,
  },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    paddingHorizontal: 4,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    position: "relative",
  },
  tabItemActive: {},
  tabLabel: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12,
    textAlign: "center",
  },
  tabLabelActive: {
    fontFamily: fontFamilies.sans.bold,
    fontWeight: "700",
  },
  tabUnderline: {
    position: "absolute",
    bottom: 0,
    left: 4,
    right: 4,
    height: 2,
    borderRadius: 1,
  },
  priceDetailsContent: {
    padding: 16,
    gap: 12,
  },
  gstCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  gstCardTitle: {
    fontFamily: fontFamilies.sans.bold,
    fontWeight: "700",
    fontSize: 15,
    marginBottom: 4,
  },
  gstRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  gstIconBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  gstLabel: {
    fontFamily: fontFamilies.sans.bold,
    fontWeight: "700",
    fontSize: 14,
  },
  gstSubLabel: {
    fontSize: 12,
    lineHeight: 16,
  },
  newBadge: {
    backgroundColor: "#e11d48",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  newBadgeText: {
    color: "#ffffff",
    fontSize: 9,
    fontFamily: fontFamilies.sans.bold,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  priceCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    padding: 16,
    gap: 13,
    ...shadows.soft,
  },
  priceCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    marginBottom: spacing[1],
  },
  priceCardIcon: {
    width: 38,
    height: 38,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${colors.olive[500]}12`,
  },
  priceCardHeaderText: {
    flex: 1,
  },
  priceCardEyebrow: {
    color: colors.olive[600],
    fontSize: 8,
    letterSpacing: 1.2,
  },
  priceCardTitle: {
    fontFamily: fontFamilies.sans.bold,
    fontWeight: "700",
    fontSize: 16,
    marginTop: 2,
  },
  priceItemPill: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radii.full,
    backgroundColor: colors.paper.warm,
  },
  priceItemPillText: {
    color: colors.light.mutedForeground,
    fontSize: 9,
  },
  pdRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  priceRowLabel: {
    fontSize: 14,
    fontFamily: fontFamilies.sans.regular,
  },
  priceRowValue: {
    fontSize: 14,
    fontFamily: fontFamilies.sans.medium,
  },
  priceDivider: {
    height: 1,
    marginVertical: 4,
  },
  totalAmountLabel: {
    fontFamily: fontFamilies.sans.bold,
    fontWeight: "700",
    fontSize: 15,
  },
  totalAmountValue: {
    fontFamily: fontFamilies.sans.bold,
    fontWeight: "700",
    fontSize: 16,
  },
  savingsPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: `${colors.olive[500]}10`,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: `${colors.olive[500]}20`,
    paddingVertical: 10,
    paddingHorizontal: 10,
    gap: 8,
    marginTop: 4,
  },
  savingsIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${colors.olive[500]}16`,
  },
  savingsPillText: {
    flex: 1,
    fontSize: 13,
    color: colors.olive[700],
    fontFamily: fontFamilies.sans.regular,
  },
  savingsPillBold: {
    fontFamily: fontFamilies.sans.bold,
    fontWeight: "700",
    color: colors.olive[700],
  },

  trustRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 0,
    marginTop: 4,
  },
  trustBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
    justifyContent: "center",
  },
  trustDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginRight: 4,
  },
  trustLabel: {
    fontSize: 11,
    textAlign: "center",
    lineHeight: 15,
  },
  termsRow: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  termsText: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  termsLink: {
    fontFamily: fontFamilies.sans.bold,
    fontWeight: "700",
  },
  checkoutContainer: {
    borderTopWidth: 1,
    ...shadows.editorial,
  },
  checkoutSummary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
  },
  checkoutSummaryLabel: {
    color: colors.olive[600],
    fontSize: 8,
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  checkoutSummaryPrice: {
    fontFamily: fontFamilies.display.semibold,
  },
  checkoutSelectionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: `${colors.olive[500]}10`,
  },
  checkoutSelectionText: {
    fontFamily: fontFamilies.sans.semibold,
  },
  checkoutAction: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
  },
  checkoutBtn: {
    width: "100%",
    minHeight: 54,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.glow,
  },
  checkoutBtnDisabled: {
    opacity: 0.42,
    shadowOpacity: 0,
    elevation: 0,
  },
  checkoutBtnText: {
    fontFamily: fontFamilies.sans.bold,
    fontWeight: "700",
    fontSize: 16,
    letterSpacing: 0.3,
  },
  yourBagContainer: {
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 10,
    gap: 8,
  },
  yourBagTitle: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 18,
    fontWeight: "700",
  },
  guestStockNote: {
    marginBottom: 4,
  },
  selectionBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  selectionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxSelected: {
    backgroundColor: colors.olive[900],
    borderColor: colors.olive[900],
  },
  checkboxUnselected: {
    backgroundColor: "transparent",
    borderColor: "#C4C4C4",
  },
  selectedCountText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 14,
  },
  selectionActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  actionIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.paper.warm,
  },
  warningBanner: {
    paddingVertical: spacing[2.5],
    paddingHorizontal: spacing[4],
    borderRadius: radii.lg,
    borderWidth: 1,
    marginHorizontal: spacing[5],
    marginTop: spacing[2],
    alignItems: "center",
    justifyContent: "center",
  },
  warningText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 12,
    textAlign: "center",
  },
});

/**
 * Empty-cart "you may also like" rail.
 *
 * Pulls from the recommender when the user has prior views
 * (recently-viewed rail); otherwise falls back to a curated cold-start
 * mix. Surfaces a single horizontal ProductRail below the empty state.
 */
function EmptyCartSuggestions({
  userId,
  onSeeAll,
}: {
  userId: string | null;
  onSeeAll: () => void;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Try recently-viewed first — best signal we have for "what were
      // they looking at before they bounced with an empty bag".
      const recent = await fetchRecentlyViewed(userId, 10);
      let picks: Product[] = [];
      if (recent.ok && recent.data.length >= 3) {
        picks = recent.data;
      } else {
        const cold = await fetchColdStartProducts(10);
        if (cold.ok) picks = cold.data;
      }
      if (!cancelled) {
        setProducts(picks);
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!loaded || products.length === 0) return null;

  return (
    <View style={{ marginTop: spacing[6], paddingBottom: spacing[4] }}>
      <ProductRail
        kicker="Just for you"
        title="You may also like"
        products={products}
        showSaleBadge
        onSeeAll={onSeeAll}
      />
    </View>
  );
}
