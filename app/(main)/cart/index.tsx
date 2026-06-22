import React, { useState, useMemo, useCallback, useEffect } from "react";
import { View, FlatList, StyleSheet, Pressable, TouchableOpacity, Share } from "react-native";
import { navigateHome } from "@/lib/navigation";
import { useRouter, useFocusEffect } from "expo-router";
import { PaperBackground } from "@/components/layout";
import { useTheme } from "@/lib/hooks/useTheme";
import { useCart, useWishlist } from "@/lib/stores";
import { useAuth } from "@/lib/supabase/auth";
import { Display, Label, Body, Price } from "@/components/ui/Typography";
import { fontFamilies } from "@/lib/theme/fonts";
import { typography, spacing, colors, radii, shadows } from "@/lib/theme/tokens";
import { computeCartTotals } from "@/lib/cart-pricing";
import { formatPrice } from "@/lib/utils";
import { useToast } from "@/components/ui";
import { CartItemCard } from "@/components/cart/CartItemCard";
import { getVariantStock } from "@/components/cart/variant-utils";
import { BagEmptyState } from "@/components/cart/BagEmptyState";
import { SavedForLater } from "@/components/cart/SavedForLater";
import { supabase } from "@/lib/supabase/client";
import { mapProducts } from "@/lib/api/product-mapper";
import type { Product } from "@/lib/types";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@/components/ui/Icon";
import { getAddresses, getProducts } from "@/lib/api";
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
import { LinearGradient } from "expo-linear-gradient";

export default function CartScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { user } = useAuth();
  const { toast } = useToast();
  const insets = useSafeAreaInsets();
  const {
    items: cartRecord,
    removeItem,
    updateQuantity,
    subtotal,
    itemCount,
    addItem,
  } = useCart();
  const items = cartRecord ?? {};
  const wishlist = useWishlist();
  const [savedForLater, setSavedForLater] = useState<
    Record<string, { product: Product | null }>
  >({});

  const [addressText, setAddressText] = useState("Add delivery address");
  const [hasSavedAddress, setHasSavedAddress] = useState(false);
  const [buyAgainProducts, setBuyAgainProducts] = useState<Product[]>([]);

  const [productDetails, setProductDetails] = useState<Record<string, Product>>({});
  const [catalogVisibleStoreIds, setCatalogVisibleStoreIds] = useState<Set<string>>(new Set());
  const [selectedKeys, setSelectedKeys] = useState<Record<string, boolean>>({});

  const cartItems = Object.entries(items);

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

  // Load detailed product rows from supabase for MRP & Brand name
  useEffect(() => {
    if (cartProductIds.length === 0) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("products")
        .select(
          "*, images:product_images(*), variants:product_variants(*, inventory(*)), brand:brands(*), store:stores!products_store_id_fkey(*), category:categories(*)"
        )
        .in("id", cartProductIds);
      if (cancelled || error || !data) return;
      const byId: Record<string, Product> = {};
      mapProducts(data as Product[]).forEach((p) => {
        byId[p.id] = p;
      });
      if (!cancelled) {
        setProductDetails(byId);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cartProductIds.join(",")]);

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
        if (reconciliation.remove.length > 0) {
          toast(
            `${reconciliation.remove.length} unavailable item${reconciliation.remove.length === 1 ? "" : "s"} removed from your bag`,
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
  }, [cartItems]);

  const selectedCartItems = useMemo(() => {
    return cartItems.filter(([key]) => selectedKeys[key]);
  }, [cartItems, selectedKeys]);

  const selectedCount = useMemo(() => {
    return Object.keys(selectedKeys).filter((k) => selectedKeys[k]).length;
  }, [selectedKeys]);

  const allSelected = cartItems.length > 0 && selectedCount === cartItems.length;

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

  // Share selection
  const handleShareBag = useCallback(async () => {
    if (selectedCartItems.length === 0) {
      toast("Please select at least one item to share", "info");
      return;
    }
    const message = `Check out my bag on Luxe Boutique:\n` +
      selectedCartItems.map(([_, it]) => `- ${it.name} (${formatPrice(it.price)})`).join("\n");
    try {
      await Share.share({ message });
    } catch (error) {
      console.log(error);
    }
  }, [selectedCartItems, toast]);

  // Remove selected items
  const handleRemoveSelected = useCallback(() => {
    if (selectedCartItems.length === 0) {
      toast("No items selected to remove", "info");
      return;
    }
    selectedCartItems.forEach(([key]) => {
      removeItem(key);
    });
    toast(`${selectedCartItems.length} items removed from bag`, "info");
  }, [selectedCartItems, removeItem, toast]);

  // Save selected to wishlist
  const handleWishlistSelected = useCallback(() => {
    if (selectedCartItems.length === 0) {
      toast("No items selected to save", "info");
      return;
    }
    selectedCartItems.forEach(([key, item]) => {
      if (!wishlist.has(item.productId)) {
        wishlist.toggle(item.productId);
      }
      removeItem(key);
    });
    toast(`Moved ${selectedCartItems.length} items to wishlist`, "success");
  }, [selectedCartItems, wishlist, removeItem, toast]);

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
      const prep = await prepareCartForCheckout({
        items,
        selectedKeys,
        removeItem,
      });
      if (!prep.ok) {
        toast(prep.error, "error");
        return;
      }

      const addressRes = await getAddresses(user!.id);
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

  // Total MRP = sum of item.mrp * qty for selected items (fallback: price * 1.5)
  const totalMrp = useMemo(() => {
    return selectedCartItems.reduce((sum, [_, item]) => {
      const product = productDetails[item.productId];
      const mrp = product?.mrp || (item.price * 1.5);
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
  const cartTotals = useMemo(
    () => computeCartTotals({ lines: selectedPricingLines }),
    [selectedPricingLines],
  );
  const shippingFee = cartTotals.shipping;
  const tax = cartTotals.tax;
  const totalAmount = cartTotals.total;
  const total = totalAmount;
  const count = useMemo(() => {
    return selectedCartItems.reduce((sum, [_, item]) => sum + item.quantity, 0);
  }, [selectedCartItems]);

  const wishlistCount = wishlist.count();

  const handleRemove = useCallback(
    (key: string, name: string) => {
      removeItem(key);
      toast(`${name} removed from bag`, "info");
    },
    [removeItem, toast]
  );

  const handleSaveForLater = useCallback(
    (key: string, productId: string) => {
      const item = items[key];
      if (!item) return;
      setSavedForLater((prev) => ({
        ...prev,
        [key]: { product: prev[key]?.product ?? null },
      }));
      if (!wishlist.has(productId)) wishlist.toggle(productId);
      removeItem(key);
      toast(`Saved for later`, "success");
    },
    [items, removeItem, wishlist, toast]
  );

  // Load address
  useEffect(() => {
    if (!user?.id) {
      setAddressText("Sign in to add delivery address");
      setHasSavedAddress(false);
      return;
    }
    getAddresses(user.id).then((res) => {
      if (res.ok && res.data && res.data.length > 0) {
        const defaultAddr = res.data.find((a) => a.is_default) || res.data[0];
        const text = `${defaultAddr.line1}${defaultAddr.city ? `, ${defaultAddr.city}` : ""}`;
        setAddressText(text);
        setHasSavedAddress(true);
      } else {
        setAddressText("Add delivery address");
        setHasSavedAddress(false);
      }
    });
  }, [user?.id]);

  // Load "Buy It Again" items
  useEffect(() => {
    getProducts({ limit: 6 }).then((res) => {
      if (res.ok && res.data) {
        setBuyAgainProducts(res.data.products);
      }
    });
  }, []);

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

  // Lazily fetch products for the saved-for-later rail.
  const savedKeys = Object.keys(savedForLater);
  const savedProductIds = useMemo(() => {
    const ids = new Set<string>();
    savedKeys.forEach((k) => {
      const it = items[k];
      if (it) ids.add(it.productId);
    });
    return Array.from(ids);
  }, [savedKeys, items]);
  useEffect(() => {
    if (savedProductIds.length === 0) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("products")
        .select(
          "*, images:product_images(*), variants:product_variants(*, inventory(*)), brand:brands(*), store:stores!products_store_id_fkey(*), category:categories(*)"
        )
        .in("id", savedProductIds);
      if (cancelled || error || !data) return;
      const byId: Record<string, Product> = {};
      mapProducts(data as Product[]).forEach((p) => {
        byId[p.id] = p;
      });
      setSavedForLater((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((k) => {
          const it = items[k];
          if (it && byId[it.productId]) {
            next[k] = { product: byId[it.productId] };
          }
        });
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [savedProductIds.join(",")]);

  if (cartItems.length === 0) {
    return (
      <PaperBackground style={{ flex: 1 }}>
        {/* Custom Header for Empty state */}
        <View style={[styles.customHeader, { 
          height: 56 + insets.top, 
          paddingTop: insets.top,
          backgroundColor: theme.colors.card, 
          borderColor: theme.colors.border 
        }]}>
          <TouchableOpacity 
            onPress={() => navigateHome(router)} 
            style={[styles.headerLeftBtn, { backgroundColor: theme.isDark ? "rgba(240, 237, 223, 0.08)" : "rgba(22, 23, 15, 0.06)" }]}
          >
            <Ionicons name="close" size={20} color={theme.colors.foreground} />
          </TouchableOpacity>
          <Display size="xl" style={[styles.headerTitle, { color: theme.colors.foreground }]}>My Bag</Display>
          <TouchableOpacity 
            onPress={() => router.push("/(main)/wishlist")} 
            style={[styles.headerRightBtn, { backgroundColor: theme.isDark ? "rgba(240, 237, 223, 0.08)" : "rgba(22, 23, 15, 0.06)" }]}
          >
            <Ionicons name="heart-outline" size={20} color={theme.colors.foreground} />
          </TouchableOpacity>
        </View>
        <View style={styles.emptyWrap}>
          <BagEmptyState hasWishlistItems={wishlistCount > 0} />
        </View>
      </PaperBackground>
    );
  }

  return (
    <PaperBackground style={{ flex: 1 }}>
      {/* Custom Header */}
      <View style={[styles.customHeader, { 
        height: 56 + insets.top, 
        paddingTop: insets.top,
        backgroundColor: theme.colors.card, 
        borderColor: theme.colors.border 
      }]}>
        <TouchableOpacity 
          onPress={() => navigateHome(router)} 
          style={[styles.headerLeftBtn, { backgroundColor: theme.isDark ? "rgba(240, 237, 223, 0.08)" : "rgba(22, 23, 15, 0.06)" }]}
        >
          <Ionicons name="close" size={20} color={theme.colors.foreground} />
        </TouchableOpacity>
        <Display size="xl" style={[styles.headerTitle, { color: theme.colors.foreground }]}>My Bag</Display>
        <TouchableOpacity 
          onPress={() => router.push("/(main)/wishlist")} 
          style={[styles.headerRightBtn, { backgroundColor: theme.isDark ? "rgba(240, 237, 223, 0.08)" : "rgba(22, 23, 15, 0.06)" }]}
        >
          <Ionicons name="heart-outline" size={20} color={theme.colors.foreground} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={cartRows}
        keyExtractor={(row) =>
          row.type === "header" ? `__hdr__${row.storeId}` : row.key
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            {/* Delivery address banner */}
            <TouchableOpacity
              style={[styles.deliveryBanner, { borderColor: theme.colors.border }]}
              activeOpacity={0.7}
              onPress={handleAddressPress}
            >
              <View style={styles.deliveryLeft}>
                <View style={[styles.deliveryIconBg, { backgroundColor: theme.colors.secondary }]}>
                  <Ionicons name="location-outline" size={20} color={theme.colors.primary} />
                </View>
                <View style={styles.deliveryTextWrap}>
                  <Body style={[styles.deliveryTitle, { color: theme.colors.foreground }]}>{addressText}</Body>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.foreground} />
            </TouchableOpacity>

            {/* Your Bag Title & Selection Bar */}
            <View style={styles.yourBagContainer}>
              <Display size="xl" style={[styles.yourBagTitle, { color: theme.colors.foreground }]}>
                Your Bag
              </Display>
              {!user ? (
                <Body size="sm" muted style={styles.guestStockNote}>
                  Sign in to reserve stock while you shop. Guest bags are not held at checkout.
                </Body>
              ) : null}

              <View style={styles.selectionBar}>
                <TouchableOpacity onPress={handleToggleSelectAll} style={styles.selectionLeft} activeOpacity={0.7}>
                  <View style={[
                    styles.checkbox,
                    allSelected ? styles.checkboxSelected : styles.checkboxUnselected,
                  ]}>
                    {allSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                  <Body style={[styles.selectedCountText, { color: theme.colors.foreground }]}>
                    {selectedCount}/{cartItems.length} Items Selected
                  </Body>
                </TouchableOpacity>

                <View style={styles.selectionActions}>
                  <TouchableOpacity onPress={handleShareBag} style={styles.actionIconBtn} activeOpacity={0.7}>
                    <Ionicons name="share-social-outline" size={20} color={theme.colors.foreground} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleRemoveSelected} style={styles.actionIconBtn} activeOpacity={0.7}>
                    <Ionicons name="trash-outline" size={20} color={theme.colors.foreground} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleWishlistSelected} style={styles.actionIconBtn} activeOpacity={0.7}>
                    <Ionicons name="heart-outline" size={20} color={theme.colors.foreground} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        }
        renderItem={({ item: row }) => {
          if (row.type === "header") {
            return (
              <View style={styles.storeGroupHeader}>
                <View style={styles.storeGroupHeaderLeft}>
                  <Ionicons name="storefront-outline" size={16} color={theme.colors.primary} />
                  <Label style={[styles.storeGroupName, { color: theme.colors.foreground }]}>
                    {row.storeName}
                  </Label>
                  <Body size="sm" muted style={styles.storeGroupCount}>
                    {row.itemCount} {row.itemCount === 1 ? "item" : "items"}
                  </Body>
                </View>
                <Body size="sm" style={[styles.storeGroupSubtotal, { color: theme.colors.foreground }]}>
                  {formatPrice(row.subtotal)}
                </Body>
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
            onIncrement={() => updateQuantity(key, cartItem.quantity + 1)}
            onDecrement={() => updateQuantity(key, cartItem.quantity - 1)}
            onRemove={() => handleRemove(key, cartItem.name)}
            onUpdateQuantity={(quantity) => updateQuantity(key, quantity)}
            onUpdateVariant={(newVariantId, newVariantLabel) => handleUpdateVariant(key, newVariantId, newVariantLabel)}
          />
          );
        }}
        ListFooterComponent={
          <View style={{ paddingBottom: 24 }}>

            {/* Price Details Card */}
            <View style={[styles.priceCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, marginHorizontal: 16, marginBottom: 12 }]}>
              <Body style={[styles.priceCardTitle, { color: theme.colors.foreground }]}>Price Details</Body>

              <View style={styles.pdRow}>
                <Body style={[styles.priceRowLabel, { color: theme.colors.foreground }]}>Total MRP</Body>
                <Body style={[styles.priceRowValue, { color: theme.colors.foreground }]}>{formatPrice(selectedCount === 0 ? 0 : totalMrp)}</Body>
              </View>

              {selectedCount > 0 && (
                <>
                  <View style={styles.pdRow}>
                    <Body style={[styles.priceRowLabel, { color: theme.colors.foreground }]}>Discount on MRP</Body>
                    <Body style={[styles.priceRowValue, { color: "#16a34a" }]}>- {formatPrice(discountOnMrp)}</Body>
                  </View>

                  <View style={styles.pdRow}>
                    <Body style={[styles.priceRowLabel, { color: theme.colors.foreground }]}>Shipping</Body>
                    <Body style={[styles.priceRowValue, { color: theme.colors.foreground }]}>
                      {shippingFee === 0 ? "Complimentary" : formatPrice(shippingFee)}
                    </Body>
                  </View>

                  <View style={styles.pdRow}>
                    <Body style={[styles.priceRowLabel, { color: theme.colors.foreground }]}>Tax</Body>
                    <Body style={[styles.priceRowValue, { color: theme.colors.foreground }]}>{formatPrice(tax)}</Body>
                  </View>
                </>
              )}

              <View style={[styles.priceDivider, { backgroundColor: theme.colors.border }]} />

              <View style={styles.pdRow}>
                <Body style={[styles.totalAmountLabel, { color: theme.colors.foreground }]}>Total Amount</Body>
                <Body style={[styles.totalAmountValue, { color: theme.colors.foreground }]}>{formatPrice(selectedCount === 0 ? 0 : totalAmount)}</Body>
              </View>

              {/* Savings pill */}
              {selectedCount > 0 && (
                <View style={styles.savingsPill}>
                  <Body style={styles.savingsPillEmoji}>🎉</Body>
                  <Body style={styles.savingsPillText}>
                    You're saving <Body style={styles.savingsPillBold}>{formatPrice(discountOnMrp)}</Body> on this order
                  </Body>
                </View>
              )}
            </View>

            {/* Trust Badges */}
            <View style={[styles.trustRow, { marginBottom: 12 }]}>
              {[
                { icon: "shield-checkmark-outline" as const, label: "Genuine\nProducts" },
                { icon: "people-outline" as const, label: "Contactless\nDelivery" },
                { icon: "lock-closed-outline" as const, label: "Secure\nPayments" },
              ].map((badge, i) => (
                <View key={badge.label} style={styles.trustBadge}>
                  {i > 0 && <View style={[styles.trustDot, { backgroundColor: theme.colors.mutedForeground }]} />}
                  <Ionicons name={badge.icon} size={22} color={theme.colors.mutedForeground} />
                  <Body style={[styles.trustLabel, { color: theme.colors.mutedForeground }]}>{badge.label}</Body>
                </View>
              ))}
            </View>

            {/* Terms */}
            <View style={[styles.termsRow, { marginHorizontal: 16 }]}>
              <Body style={[styles.termsText, { color: theme.colors.mutedForeground }]}>
                By placing the order, you agree to Luxe's{" "}
                <Body style={[styles.termsLink, { color: theme.colors.primary }]}>Terms of Use</Body>
                {" "}and{" "}
                <Body style={[styles.termsLink, { color: theme.colors.primary }]}>Privacy Policy</Body>
              </Body>
            </View>

            {/* Buy It Again Section */}
            {buyAgainProducts.length > 0 && (
              <View style={styles.buyAgainSection}>
                <View style={styles.buyAgainHeader}>
                  <Display style={[styles.buyAgainTitle, { color: theme.colors.foreground }]}>Buy It Again</Display>
                  <TouchableOpacity onPress={() => router.push("/(main)/products")} style={styles.moreItemsBtn}>
                    <Body style={[styles.moreItemsText, { color: theme.colors.primary }]}>More items</Body>
                    <Ionicons name="chevron-forward" size={12} color={theme.colors.primary} style={{ marginTop: 1 }} />
                  </TouchableOpacity>
                </View>
                <FlatList
                  data={buyAgainProducts}
                  keyExtractor={(item) => item.id}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.buyAgainList}
                  renderItem={({ item }) => <ProductCard product={item} horizontal />}
                />
              </View>
            )}

            <View style={{ height: 100 }} />
          </View>
        }
      />

      {/* Pinned Checkout Footer */}
      <View
        style={[
          styles.checkoutContainer,
          {
            paddingBottom: Math.max(insets.bottom, spacing[4]),
            backgroundColor: theme.colors.card,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <LinearGradient
          colors={
            theme.isDark
              ? ["rgba(151, 168, 94, 0.16)", "rgba(151, 168, 94, 0.03)"]
              : ["rgba(83, 94, 44, 0.1)", "rgba(83, 94, 44, 0.02)"]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.selectionBand}
        >
          <Body style={[styles.selectionBandText, { color: theme.colors.foreground }]}>
            {selectedCount} Item{selectedCount !== 1 ? "s" : ""} selected for order
          </Body>
        </LinearGradient>

        {selectedCount === 0 && (
          <View
            style={[
              styles.warningBanner,
              {
                backgroundColor: theme.isDark
                  ? "rgba(151, 168, 94, 0.1)"
                  : "rgba(83, 94, 44, 0.08)",
                borderColor: theme.isDark
                  ? "rgba(151, 168, 94, 0.25)"
                  : "rgba(83, 94, 44, 0.2)",
              },
            ]}
          >
            <Body style={[styles.warningText, { color: theme.colors.primary }]}>
              No items selected — pick at least one to place your order.
            </Body>
          </View>
        )}

        <View style={styles.checkoutAction}>
          <TouchableOpacity
            style={[
              styles.checkoutBtn,
              {
                shadowColor: theme.colors.primary,
                overflow: "hidden",
              },
              selectedCount === 0 && styles.checkoutBtnDisabled,
            ]}
            disabled={selectedCount === 0}
            onPress={handlePlaceOrder}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityState={{ disabled: selectedCount === 0 }}
          >
            {selectedCount > 0 ? (
              <LinearGradient
                colors={
                  theme.isDark
                    ? [theme.olive[400], theme.olive[600]]
                    : [theme.olive[500], theme.olive[700]]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFillObject}
              />
            ) : (
              <View style={[StyleSheet.absoluteFillObject, { backgroundColor: theme.colors.muted, opacity: 0.5 }]} />
            )}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Body style={[styles.checkoutBtnText, { color: selectedCount === 0 ? theme.colors.mutedForeground : "#FFFFFF" }]}>
                Place Order
              </Body>
              {selectedCount > 0 && <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />}
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </PaperBackground>
  );
}

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
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  deliveryLeft: {
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
    gap: 2,
  },
  deliveryTitle: {
    fontFamily: fontFamilies.sans.bold,
    fontWeight: "700",
    fontSize: 15,
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
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  priceCardTitle: {
    fontFamily: fontFamilies.sans.bold,
    fontWeight: "700",
    fontSize: 15,
    marginBottom: 4,
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
    backgroundColor: "#dcfce7",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 8,
    marginTop: 4,
  },
  savingsPillEmoji: {
    fontSize: 16,
  },
  savingsPillText: {
    flex: 1,
    fontSize: 13,
    color: "#15803d",
    fontFamily: fontFamilies.sans.regular,
  },
  savingsPillBold: {
    fontFamily: fontFamilies.sans.bold,
    fontWeight: "700",
    color: "#15803d",
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
  },
  selectionBand: {
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[5],
    alignItems: "center",
    justifyContent: "center",
  },
  selectionBandText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 13,
    textAlign: "center",
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
    backgroundColor: "#E02020",
    borderColor: "#E02020",
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
    gap: 16,
  },
  actionIconBtn: {
    padding: 4,
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
