import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity, FlatList, useWindowDimensions, Animated, Share } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PaperBackground } from "@/components/layout";
import { SectionHeader } from "@/components/layout";
import { ProductImageGallery } from "@/components/product/ProductImageGallery";
import { ProductInfo } from "@/components/product/ProductInfo";
import { VariantSelector } from "@/components/product/VariantSelector";
import { SizeGuideModal } from "@/components/product/SizeGuideModal";
import { TrustHighlights } from "@/components/product/TrustHighlights";
import { ProductStoreCard } from "@/components/product/ProductStoreCard";
import { ProductDetails } from "@/components/product/ProductDetails";
import { ProductCard } from "@/components/product/ProductCard";
import { ReviewForm } from "@/components/product/ReviewForm";
import { PriceAlertPill } from "@/components/product/PriceAlertPill";
import { PincodeChecker } from "@/components/delivery/PincodeChecker";
import { OverlapWarningBanner } from "@/components/wardrobe/OverlapWarningBanner";
import { buildCartLineKeyFromItem } from "@/lib/cart-line-key";
import { useCart, useWishlist, useUI } from "@/lib/stores";
import { useAuth } from "@/lib/supabase/auth";
import { useToast, Button, Skeleton } from "@/components/ui";
import { Display, Body, Price, Label } from "@/components/ui/Typography";
import { colors, spacing, radii, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";
import { navigateHome } from "@/lib/navigation";
import { recordRecentlyViewed } from "@/lib/account-local";
import * as api from "@/lib/api";
import {
  useTrackView,
  useTrackEvent,
  useTrackImpression,
  getSimilarProducts,
  getYouMayAlsoLike,
  getPairsWellWithRail,
  getRecentlyViewedRail,
} from "@/lib/recommender";
import type { Product, ProductVariant, Review } from "@/lib/types";
import { useInventoryRealtime, getVariantStock } from "@/lib/hooks/useInventoryRealtime";

export default function ProductDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { addItem, items: cartItems } = useCart();
  const { toggle, items: wishlistItems } = useWishlist();
  const { user } = useAuth();
  const { toast } = useToast();

  const [product, setProduct] = useState<Product | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [youMayAlsoLike, setYouMayAlsoLike] = useState<Product[]>([]);
  const [pairsWellWith, setPairsWellWith] = useState<Product[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<Product[]>([]);

  // Track view + impression.
  useTrackView(product);
  useTrackImpression(product, "pdp");
  const tracker = useTrackEvent();

  const scrollY = useRef(new Animated.Value(0)).current;
  const AnimatedTouchableOpacity = useMemo(() => Animated.createAnimatedComponent(TouchableOpacity), []);

  const fetchProduct = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    const res = await api.getProductBySlug(slug);
    if (res.ok && res.data) {
      const productData = res.data;
      setProduct(productData);
      const first = productData.variants?.[0];
      if (first) {
        setSelectedVariant(first);
        setSelectedSize(first.size || null);
        setSelectedColor(first.color || null);
      }
      setLoading(false);

      // Fetch auxiliary data (reviews, recommendations) in parallel in the background
      Promise.all([
        api.getReviews(productData.id).then((r) => {
          if (r.ok) setReviews(r.data);
        }),
        getSimilarProducts(productData, 8).then((similar) => {
          if (similar.ok) setRelatedProducts(similar.data);
        }),
        getYouMayAlsoLike(user?.id ?? null, productData, 8).then((ymal) => {
          if (ymal.ok) setYouMayAlsoLike(ymal.data);
        }),
        getPairsWellWithRail(user?.id ?? null, productData, 6).then((pairs) => {
          if (pairs.ok) setPairsWellWith(pairs.data);
        }),
        getRecentlyViewedRail(user?.id ?? null, 8, [productData.id]).then((recent) => {
          if (recent.ok) setRecentlyViewed(recent.data);
        })
      ]).catch((err) => {
        console.error("Failed to load auxiliary product details:", err);
      });
    } else {
      setLoading(false);
    }
  }, [slug, user?.id]);

  useEffect(() => { fetchProduct(); }, [fetchProduct]);

  const fetchReviews = useCallback(async () => {
    if (!product) return;
    const r = await api.getReviews(product.id);
    if (r.ok) setReviews(r.data);
  }, [product]);

  useEffect(() => {
    if (!product) return;
    recordRecentlyViewed(user?.id, product.id);
  }, [product?.id, user?.id]);

  const images = useMemo(
    () => product?.images?.sort((a, b) => a.position - b.position) || [],
    [product]
  );

  const inventory = useInventoryRealtime(product);
  const liveVariantStock = getVariantStock(inventory, selectedVariant?.id);
  const unitPrice = selectedVariant?.price ?? product?.price ?? 0;
  const hasVariants = (product?.variants?.length ?? 0) > 0;
  // Products with no size/color variants have nothing for `selectedVariant`
  // to resolve to — treat them as always available instead of defaulting to
  // 0, matching ProductCard's "no variants → always available" assumption.
  const currentStock =
    liveVariantStock?.available ?? selectedVariant?.stock ?? (hasVariants ? 0 : Infinity);
  const isWishlisted = product ? !!wishlistItems[product.id] : false;
  const soldOut = currentStock <= 0;
  const cartItemKey = product
    ? buildCartLineKeyFromItem({
        storeId: product.store_id,
        productId: product.id,
        variantId: selectedVariant?.id ?? null,
      })
    : "";
  const isInCart = product ? !!cartItems[cartItemKey] : false;

  const handleAddToCart = (): boolean => {
    if (!product) return false;
    if (isInCart) {
      router.push("/(main)/cart");
      return true;
    }
    if (soldOut) {
      toast("Sold out", "error");
      return false;
    }
    // Only require a size when the product actually has a size dimension to
    // pick from (mirrors VariantSelector, which only renders a size picker
    // when some variant carries a `size`). Color-only products would
    // otherwise never be able to satisfy `!selectedSize`.
    const hasSizeDimension = !!product.variants?.some((v) => v.size && v.is_active);
    if (hasSizeDimension && !selectedSize) {
      toast("Select a size", "error");
      return false;
    }
    const img = images.find((i) => i.is_primary)?.url || images[0]?.url;
    addItem({
      productId: product.id,
      variantId: selectedVariant?.id || null,
      storeId: product.store_id,
      name: product.name,
      variantLabel: selectedVariant
        ? [selectedVariant.size, selectedVariant.color].filter(Boolean).join(" / ")
        : undefined,
      price: unitPrice,
      image: img,
      stock: hasVariants ? currentStock : null,
      quantity,
    });
    tracker.cartAdd(product);
    toast("Added to basket", "success");
    useUI.getState().setCartDrawer(true);
    return true;
  };

  const handleBuyNow = () => {
    if (!handleAddToCart()) return;
    router.push("/(main)/cart");
  };

  const handleShare = async () => {
    if (!product) return;
    try {
      await Share.share({
        message: `Check out ${product.name} on LUXE! Only ${formatPrice(unitPrice, product.currency || "LKR")}.`,
        url: `luxe://product/${product.slug}`,
      });
    } catch (error) {
      console.log("Error sharing:", error);
    }
  };

  const handleWriteReview = () => {
    setShowReviewForm(true);
  };

  const [showReviewForm, setShowReviewForm] = useState(false);
  const [showSizeGuide, setShowSizeGuide] = useState(false);

  const totalCartCount = useMemo(
    () => Object.values(cartItems).reduce((sum, item) => sum + (item.is_unavailable ? 0 : item.quantity), 0),
    [cartItems]
  );

  const headerBorder = scrollY.interpolate({
    inputRange: [50, 150],
    outputRange: ["transparent", "rgba(83, 94, 44, 0.15)"],
    extrapolate: "clamp",
  });

  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [140, 200],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const stickyBottomTranslate = scrollY.interpolate({
    inputRange: [380, 480],
    outputRange: [100, 0],
    extrapolate: "clamp",
  });

  const stickyBottomOpacity = scrollY.interpolate({
    inputRange: [380, 460],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  if (loading) {
    return (
      <PaperBackground>
        <Skeleton height={SCREEN_WIDTH * (4 / 3)} borderRadius={0} />
        <View style={{ padding: spacing[5], gap: spacing[3] }}>
          <Skeleton width="40%" height={14} />
          <Skeleton width="80%" height={28} />
          <Skeleton width="30%" height={20} />
          <Skeleton width="60%" height={16} />
        </View>
      </PaperBackground>
    );
  }

  if (!product) {
    return (
      <PaperBackground>
        <View style={styles.empty}>
          <Display size="2xl">Not found</Display>
          <Button variant="brand" onPress={() => navigateHome(router)}>Go home</Button>
        </View>
      </PaperBackground>
    );
  }

  return (
    <>
    <PaperBackground style={{ flex: 1 }}>
      {/* Sticky Top Navigation Bar */}
      <Animated.View
        style={[
          styles.topBar,
          {
            paddingTop: insets.top + 8,
            backgroundColor: colors.light.background,
            borderBottomColor: headerBorder,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.topBtn}
          onPress={() => navigateHome(router)}
          activeOpacity={0.8}
        >
          <Ionicons name="chevron-back" size={22} color={colors.light.foreground} />
        </TouchableOpacity>

        <Animated.View style={[styles.headerCenter, { opacity: headerTitleOpacity }]}>
          <Display size="xs" style={styles.headerTitleText} numberOfLines={1} ellipsizeMode="tail">
            {product.name}
          </Display>
          <Price size="xs" style={styles.headerPriceText}>
            {formatPrice(unitPrice, product.currency)}
          </Price>
        </Animated.View>

        <View style={styles.topRight}>
          <TouchableOpacity
            style={styles.topBtn}
            onPress={() => {
              if (product) {
                tracker.wishlist(product, isWishlisted ? "remove" : "add");
                toggle(product.id);
              }
            }}
            activeOpacity={0.8}
            accessibilityLabel="Wishlist"
          >
            <Ionicons
              name={isWishlisted ? "heart" : "heart-outline"}
              size={18}
              color={isWishlisted ? colors.light.destructive : colors.light.foreground}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.topBtn, styles.cartBtn]}
            onPress={() => router.push("/(main)/cart" as never)}
            activeOpacity={0.8}
            accessibilityLabel="Bag"
          >
            <Ionicons name="bag-outline" size={18} color={colors.light.foreground} />
            {totalCartCount > 0 && (
              <View style={styles.headerBadge}>
                <Label style={styles.headerBadgeText}>
                  {totalCartCount > 9 ? "9+" : totalCartCount}
                </Label>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </Animated.View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      >
        {/* Spacer for background header overlap */}
        <View style={{ height: 0 }} />

        {/* Image gallery */}
        <ProductImageGallery
          images={images}
          mrp={product.mrp}
          price={unitPrice}
        />

        {/* Product info */}
        <View style={styles.section}>
          <ProductInfo
            product={product}
            unitPrice={unitPrice}
            isWishlisted={isWishlisted}
            onWishlistToggle={() => {
              tracker.wishlist(product, isWishlisted ? "remove" : "add");
              toggle(product.id);
            }}
            onShare={handleShare}
          />
        </View>

        {/* Variant selectors */}
        <View style={styles.section}>
          <VariantSelector
            variants={product.variants || []}
            selectedColor={selectedColor}
            selectedSize={selectedSize}
            onColorChange={(c) => {
              setSelectedColor(c);
              const v = product.variants?.find(
                (v) => v.color === c && (!selectedSize || v.size === selectedSize)
              );
              if (v) setSelectedVariant(v);
            }}
            onSizeChange={(s) => {
              setSelectedSize(s);
              const v = product.variants?.find(
                (v) => v.size === s && (!selectedColor || v.color === selectedColor)
              );
              if (v) setSelectedVariant(v);
            }}
            stockForSize={(size) => {
              const v = product.variants?.find(
                (variant) =>
                  variant.size === size &&
                  variant.is_active &&
                  (!selectedColor || variant.color === selectedColor),
              );
              const live = v ? getVariantStock(inventory, v.id)?.available : undefined;
              return live ?? v?.stock ?? 0;
            }}
            onOpenSizeGuide={() => setShowSizeGuide(true)}
          />
        </View>

        {/* Quantity */}
        <View style={styles.qtySection}>
          {product?.id ? (
            <View style={{ marginBottom: spacing[3] }}>
              <OverlapWarningBanner
                productId={product.id}
                onOpenWardrobe={() => router.push("/(main)/account/wardrobe" as never)}
              />
            </View>
          ) : null}
          <View style={styles.qtyLabel}>
            <View style={styles.qtyDot} />
            <Display size="sm" style={styles.qtyLabelText}>QUANTITY</Display>
          </View>
          <View style={styles.qtyContainer}>
            <TouchableOpacity
              style={styles.qtyPillBtn}
              onPress={() => setQuantity(Math.max(1, quantity - 1))}
              activeOpacity={0.7}
            >
              <Ionicons name="remove" size={16} color={colors.light.foreground} />
            </TouchableOpacity>
            <Display size="sm" style={styles.qtyValue}>{quantity}</Display>
            <TouchableOpacity
              style={styles.qtyPillBtn}
              onPress={() => setQuantity(Math.min(currentStock || 99, quantity + 1))}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={16} color={colors.light.foreground} />
            </TouchableOpacity>
          </View>

          {/* Action buttons directly below quantity selection */}
          <PincodeChecker />
          <View style={styles.actionRow}>
            <Button
              variant="outline"
              onPress={handleAddToCart}
              disabled={!isInCart && soldOut}
              style={styles.addBtn}
              textStyle={{ color: colors.light.primary, fontSize: 13, letterSpacing: 1 }}
              size="lg"
            >
              {isInCart ? "Go to basket" : (soldOut ? "Sold out" : "Add to basket")}
            </Button>
            <Button
              variant="brand"
              onPress={handleBuyNow}
              disabled={soldOut}
              style={styles.buyNowBtn}
              textStyle={{ fontSize: 13, letterSpacing: 1 }}
              size="lg"
            >
              Buy Now
            </Button>
          </View>
          {!soldOut && (
            <PriceAlertPill
              productId={product.id}
              variantId={selectedVariant?.id ?? null}
              currency={product.currency || "LKR"}
              currentPrice={unitPrice}
            />
          )}
        </View>

        {/* Trust & highlights */}
        <View style={styles.section}>
          <TrustHighlights />
        </View>

        {/* Store card */}
        {product.store && (
          <View style={styles.section}>
            <ProductStoreCard store={product.store} />
          </View>
        )}

        {/* Details tabs */}
        <View style={styles.section}>
          <ProductDetails
            product={product}
            reviews={reviews}
            onWriteReview={handleWriteReview}
          />
        </View>

        {/* Related products — content-similar (always shown) */}
        {relatedProducts.length > 0 && (
          <View style={styles.relatedSection}>
            <View style={styles.sectionHeaderWrap}>
              <SectionHeader
                kicker="You might also love"
                title="Similar Pieces"
                actionLabel="View all"
                onAction={() => router.push("/(main)/products")}
              />
            </View>
            <FlatList
              data={relatedProducts}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.relatedList}
              renderItem={({ item }) => <ProductCard product={item} horizontal />}
            />
          </View>
        )}

        {/* Personalized "You may also like" — only when we have a non-empty
            recommendation set distinct from the content-similar rail. */}
        {youMayAlsoLike.length > 0 && (
          <View style={styles.relatedSection}>
            <View style={styles.sectionHeaderWrap}>
              <SectionHeader
                kicker="Picked for you"
                title="You May Also Like"
                actionLabel="View all"
                onAction={() => router.push("/(main)/products?sort=newest")}
              />
            </View>
            <FlatList
              data={youMayAlsoLike}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.relatedList}
              renderItem={({ item }) => <ProductCard product={item} horizontal />}
            />
          </View>
        )}

        {/* Pairs well with — co-occurrence / complementary. */}
        {pairsWellWith.length > 0 && (
          <View style={styles.relatedSection}>
            <View style={styles.sectionHeaderWrap}>
              <SectionHeader
                kicker="Complete the look"
                title="Pairs Well With"
                actionLabel="View all"
                onAction={() => router.push("/(main)/products")}
              />
            </View>
            <FlatList
              data={pairsWellWith}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.relatedList}
              renderItem={({ item }) => <ProductCard product={item} horizontal />}
            />
          </View>
        )}

        {/* Recently viewed. */}
        {recentlyViewed.length > 0 && (
          <View style={styles.relatedSection}>
            <View style={styles.sectionHeaderWrap}>
              <SectionHeader
                kicker="Pick up where you left off"
                title="Recently Viewed"
              />
            </View>
            <FlatList
              data={recentlyViewed}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.relatedList}
              renderItem={({ item }) => <ProductCard product={item} horizontal />}
            />
          </View>
        )}

        {/* Bottom spacer for sticky bar & insets */}
        <View style={{ height: insets.bottom + 84 }} />
      </ScrollView>

      {/* Floating Sticky Bottom Bar */}
      <Animated.View
        style={[
          styles.stickyBottomBar,
          {
            paddingBottom: Math.max(insets.bottom, 12),
            transform: [{ translateY: stickyBottomTranslate }],
            opacity: stickyBottomOpacity,
          },
        ]}
      >
        <View style={styles.stickyBottomInner}>
          <View style={styles.stickyPriceCol}>
            <Price size="md" style={styles.stickyPrice}>
              {formatPrice(unitPrice, product.currency)}
            </Price>
            <Body size="xs" muted numberOfLines={1} style={styles.stickyVariant}>
              {selectedSize ? `Size ${selectedSize}` : "Select size"}
              {selectedColor ? ` · ${selectedColor}` : ""}
            </Body>
          </View>

          <View style={styles.stickyBtnWrapper}>
            <Button
              variant={isInCart ? "outline" : "brand"}
              onPress={handleAddToCart}
              disabled={!isInCart && soldOut}
              style={styles.stickyAddBtn}
              textStyle={{ fontSize: 13, letterSpacing: 0.5 }}
              size="md"
            >
              {isInCart ? "Go to basket" : (soldOut ? "Sold out" : "Add to basket")}
            </Button>
          </View>
        </View>
      </Animated.View>
    </PaperBackground>

    <ReviewForm
      visible={showReviewForm}
      onClose={() => setShowReviewForm(false)}
      productId={product.id}
      productName={product.name}
      onSubmitted={() => {
        fetchReviews();
      }}
    />

    <SizeGuideModal
      visible={showSizeGuide}
      onClose={() => setShowSizeGuide(false)}
      category={product.category?.name}
      brandId={product.brand_id}
      categoryId={product.category_id}
    />
    </>
  );
}

const styles = StyleSheet.create({
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[4],
    padding: 32,
  },
  topBar: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    zIndex: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[3],
    borderBottomWidth: 1,
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[2],
    gap: 1,
  },
  headerTitleText: {
    color: colors.light.foreground,
    fontSize: 13,
    lineHeight: 17,
    fontFamily: fontFamilies.sans.semibold,
    textAlign: "center",
    letterSpacing: 0.2,
  },
  headerPriceText: {
    color: colors.olive[600],
    fontSize: 12,
    fontFamily: fontFamilies.mono.medium,
  },
  topRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
  },
  topBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: `${colors.light.primary}18`,
    backgroundColor: colors.light.card,
    alignItems: "center",
    justifyContent: "center",
  },
  cartBtn: {
    position: "relative",
  },
  headerBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: colors.accent2.rust,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBadgeText: {
    color: "#ffffff",
    fontSize: 9,
    fontFamily: fontFamilies.mono.semibold,
  },
  section: {
    marginTop: spacing[4],
  },
  qtySection: {
    marginTop: spacing[5],
    paddingHorizontal: spacing[5],
    gap: spacing[3],
  },
  qtyLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
  },
  qtyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.olive[600],
  },
  qtyLabelText: {
    color: colors.light.foreground,
  },
  qtyContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: `${colors.light.primary}08`,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: `${colors.light.primary}15`,
    alignSelf: "flex-start",
    paddingHorizontal: spacing[1],
    paddingVertical: spacing[1],
  },
  qtyPillBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.light.card,
  },
  qtyValue: {
    paddingHorizontal: spacing[4],
    fontWeight: "600",
    color: colors.light.foreground,
  },
  relatedSection: {
    marginTop: spacing[6],
  },
  sectionHeaderWrap: {
    paddingHorizontal: spacing[5],
  },
  relatedList: {
    paddingHorizontal: spacing[5],
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: spacing[3],
    width: "100%",
  },
  addBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.light.primary,
    backgroundColor: colors.light.card,
  },
  buyNowBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
  },
  /* Floating Sticky Bottom Bar */
  stickyBottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.light.background,
    borderTopWidth: 1,
    borderTopColor: `${colors.light.primary}18`,
    paddingTop: spacing[3],
    paddingHorizontal: spacing[5],
    ...shadows.editorial,
  },
  stickyBottomInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[4],
  },
  stickyPriceCol: {
    flex: 1,
    gap: 1,
  },
  stickyPrice: {
    color: colors.light.foreground,
  },
  stickyVariant: {
    fontSize: 11,
    fontFamily: fontFamilies.sans.medium,
  },
  stickyBtnWrapper: {
    flex: 1.2,
  },
  stickyAddBtn: {
    height: 44,
    borderRadius: 10,
  },
});
