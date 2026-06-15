import React, { useState, useMemo, useCallback, useEffect } from "react";
import { View, FlatList, StyleSheet, Pressable, TouchableOpacity, Share } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { PaperBackground } from "@/components/layout";
import { useTheme } from "@/lib/hooks/useTheme";
import { useCart, useWishlist } from "@/lib/stores";
import { useAuth } from "@/lib/supabase/auth";
import { Display, Label, Body, Price } from "@/components/ui/Typography";
import { fontFamilies } from "@/lib/theme/fonts";
import { typography, spacing, colors, radii, shadows } from "@/lib/theme/tokens";
import { formatPrice, FREE_SHIPPING_THRESHOLD, TAX_RATE } from "@/lib/utils";
import { useToast } from "@/components/ui";
import { CartItemCard } from "@/components/cart/CartItemCard";
import { getVariantStock } from "@/components/cart/variant-utils";
import { BagEmptyState } from "@/components/cart/BagEmptyState";
import { SavedForLater } from "@/components/cart/SavedForLater";
import { supabase } from "@/lib/supabase/client";
import type { Product } from "@/lib/types";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { getAddresses, getProducts } from "@/lib/api";
import { CouponField } from "@/components/cart/CouponField";
import { ProductCard } from "@/components/product/ProductCard";
import { LinearGradient } from "expo-linear-gradient";

export default function CartScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { user } = useAuth();
  const { toast } = useToast();
  const insets = useSafeAreaInsets();
  const {
    items,
    removeItem,
    updateQuantity,
    subtotal,
    itemCount,
    couponCode,
    setCoupon,
    addItem,
  } = useCart();
  const wishlist = useWishlist();
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [savedForLater, setSavedForLater] = useState<
    Record<string, { product: Product | null }>
  >({});

  const [addressText, setAddressText] = useState("Vit Vellore, Men's Hostel, D block 123");
  const [buyAgainProducts, setBuyAgainProducts] = useState<Product[]>([]);
  const [promoExpanded, setPromoExpanded] = useState(false);

  const [productDetails, setProductDetails] = useState<Record<string, Product>>({});
  const [selectedKeys, setSelectedKeys] = useState<Record<string, boolean>>({});

  const cartItems = Object.entries(items);

  const cartProductIds = useMemo(() => {
    return Array.from(new Set(cartItems.map(([_, it]) => it.productId)));
  }, [cartItems]);

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
      (data as Product[]).forEach((p) => {
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

  // Restore unselected items on cart screen mount
  useEffect(() => {
    const restoreUnselected = async () => {
      try {
        const backupStr = await AsyncStorage.getItem("cart_unselected_backup");
        if (backupStr) {
          const backupItems: Record<string, typeof items[string]> = JSON.parse(backupStr);
          Object.values(backupItems).forEach((item) => {
            addItem(item);
          });
          await AsyncStorage.removeItem("cart_unselected_backup");
        }
      } catch (err) {
        console.error("Failed to restore unselected cart items:", err);
      }
    };
    restoreUnselected();
  }, []);

  // Intercept checkout to move unselected items temporarily out of the cart store
  const handlePlaceOrder = async () => {
    const unselectedItems: Record<string, typeof items[string]> = {};
    const selectedItems: Record<string, typeof items[string]> = {};

    cartItems.forEach(([key, item]) => {
      if (!selectedKeys[key]) {
        unselectedItems[key] = item;
      } else {
        selectedItems[key] = item;
      }
    });

    if (Object.keys(selectedItems).length === 0) {
      toast("Please select at least one item to place order", "error");
      return;
    }

    try {
      if (Object.keys(unselectedItems).length > 0) {
        await AsyncStorage.setItem("cart_unselected_backup", JSON.stringify(unselectedItems));
        Object.keys(unselectedItems).forEach((key) => {
          removeItem(key);
        });
      }
      router.push("/(main)/checkout");
    } catch (err) {
      toast("Something went wrong. Please try again.", "error");
    }
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
  const platformFee = 23;
  const shippingFee = sub === 0 ? 0 : (sub >= FREE_SHIPPING_THRESHOLD ? 0 : 350);
  const tax = Math.round((sub - couponDiscount) * TAX_RATE);
  const totalAmount = Math.max(0, sub - couponDiscount) + platformFee;
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
    if (user?.id) {
      getAddresses(user.id).then((res) => {
        if (res.ok && res.data && res.data.length > 0) {
          const defaultAddr = res.data.find((a) => a.is_default) || res.data[0];
          const text = `${defaultAddr.line1}${defaultAddr.city ? `, ${defaultAddr.city}` : ""}`;
          setAddressText(text);
        }
      });
    }
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
    } else {
      router.push("/(main)/account/addresses");
    }
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
      (data as Product[]).forEach((p) => {
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
            onPress={() => router.back()} 
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
        <BagEmptyState hasWishlistItems={wishlistCount > 0} />
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
          onPress={() => router.back()} 
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
        data={cartItems}
        keyExtractor={([key]) => key}
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

              <View style={styles.selectionBar}>
                <TouchableOpacity onPress={handleToggleSelectAll} style={styles.selectionLeft} activeOpacity={0.7}>
                  <View style={[
                    styles.checkbox,
                    {
                      borderColor: allSelected ? theme.colors.primary : "#d1d5db",
                      backgroundColor: allSelected ? theme.colors.primary : "transparent"
                    }
                  ]}>
                    {allSelected && <Ionicons name="checkmark" size={12} color={theme.colors.primaryForeground} />}
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
        renderItem={({ item: [key, cartItem] }) => (
          <View style={{ marginHorizontal: 20, marginBottom: 12 }}>
            <CartItemCard
              item={cartItem}
              product={productDetails[cartItem.productId]}
              selected={!!selectedKeys[key]}
              onToggleSelect={() => handleToggleSelect(key)}
              onIncrement={() => updateQuantity(key, cartItem.quantity + 1)}
              onDecrement={() => updateQuantity(key, cartItem.quantity - 1)}
              onRemove={() => handleRemove(key, cartItem.name)}
              onUpdateQuantity={(quantity) => updateQuantity(key, quantity)}
              onUpdateVariant={(newVariantId, newVariantLabel) => handleUpdateVariant(key, newVariantId, newVariantLabel)}
            />
          </View>
        )}
        ListFooterComponent={
          <View style={{ paddingBottom: 24 }}>

            {/* Coupon / Promo Code */}
            <View style={[styles.couponSectionCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, marginHorizontal: 16, marginBottom: 12 }]}>
              <Body style={[styles.couponSectionTitle, { color: theme.colors.foreground }]}>Coupons &amp; Bank Offers</Body>
              <CouponField
                userId={user?.id}
                subtotal={sub}
                appliedCode={couponCode}
                onApply={(code, discount) => {
                  setCoupon(code);
                  setCouponDiscount(discount);
                }}
                onClear={() => {
                  setCoupon(null);
                  setCouponDiscount(0);
                }}
              />
            </View>


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
                    <Body style={[styles.priceRowLabel, { color: theme.colors.foreground }]}>Coupon Discount</Body>
                    {couponDiscount > 0 ? (
                      <Body style={[styles.priceRowValue, { color: "#16a34a" }]}>- {formatPrice(couponDiscount)}</Body>
                    ) : (
                      <Body style={[styles.priceRowValue, { color: theme.colors.primary }]}>Apply Coupon</Body>
                    )}
                  </View>

                  <View style={styles.pdRow}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Body style={[styles.priceRowLabel, { color: theme.colors.foreground }]}>Platform Fee</Body>
                      <Body style={{ fontSize: 12, textDecorationLine: "underline", color: theme.colors.mutedForeground }}>Know More</Body>
                    </View>
                    <Body style={[styles.priceRowValue, { color: theme.colors.foreground }]}>{formatPrice(platformFee)}</Body>
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
                    You're saving <Body style={styles.savingsPillBold}>{formatPrice(discountOnMrp + couponDiscount)}</Body> on this order
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
  couponSectionCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  couponSectionTitle: {
    fontFamily: fontFamilies.sans.bold,
    fontWeight: "700",
    fontSize: 15,
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
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
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
