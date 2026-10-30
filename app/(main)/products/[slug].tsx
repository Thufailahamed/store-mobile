import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity, FlatList, useWindowDimensions, Animated, Share, Platform } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { PaperBackground } from "@/components/layout";
import { C } from "@/components/orders/parcel-track";
import { SectionHeader } from "@/components/layout";
import { ProductImageGallery } from "@/components/product/ProductImageGallery";
import { ProductInfo } from "@/components/product/ProductInfo";
import { VariantSelector } from "@/components/product/VariantSelector";
import { SizeGuideModal } from "@/components/product/SizeGuideModal";
import { TrustHighlights } from "@/components/product/TrustHighlights";
import { ProductStoreCard } from "@/components/product/ProductStoreCard";
import { ProductDetails } from "@/components/product/ProductDetails";
import { ProductQA } from "@/components/product/ProductQA";
import { ProductCard } from "@/components/product/ProductCard";
import { ReviewForm } from "@/components/product/ReviewForm";
import { PriceAlertPill } from "@/components/product/PriceAlertPill";
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
import { useWishlistToggle } from "@/lib/hooks/useWishlistToggle";

export default function ProductDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { addItem, items: cartItems } = useCart();
  const { items: wishlistItems } = useWishlist();
  const toggleWishlist = useWishlistToggle();
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

  const viewedProductId = product?.id;
  useEffect(() => {
    if (!viewedProductId) return;
    recordRecentlyViewed(user?.id, viewedProductId);
  }, [viewedProductId, user?.id]);

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
  const lowStock = !soldOut && Number.isFinite(currentStock) && currentStock <= 5;
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
    toast("Added to basket", "success", { image: img, subtitle: product.name });
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
    <View style={styles.root}>
      <LinearGradient
        pointerEvents="none"
        colors={[C.glow, C.glowSoft, C.paper]}
        locations={[0, 0.5, 1]}
        style={styles.glow}
      />
      {/* Sticky Top Navigation Bar */}
      <Animated.View
        style={[
          styles.topBar,
          {
            paddingTop: insets.top + 8,
            borderBottomColor: headerBorder,
          },
        ]}
      >
        {Platform.OS === "ios" ? (
          <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFill} />
        ) : null}
        <View style={[StyleSheet.absoluteFill, styles.topBarTint]} pointerEvents="none" />
        <TouchableOpacity
          style={styles.topBtn}
          onPress={() => {
            if (router.canGoBack()) router.back();
            else navigateHome(router);
          }}
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
            onPress={handleShare}
            activeOpacity={0.8}
            accessibilityLabel="Share product"
          >
            <Ionicons name="share-outline" size={17} color={colors.light.foreground} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.topBtn}
            onPress={() => {
              if (product) {
                tracker.wishlist(product, isWishlisted ? "remove" : "add");
                toggleWishlist(product);
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
          />
          {!soldOut && (
            <View style={styles.priceAlertWrap}>
              <PriceAlertPill
                productId={product.id}
                variantId={selectedVariant?.id ?? null}
                currency={product.currency || "LKR"}
                currentPrice={unitPrice}
              />
            </View>
          )}
        </View>

        {/* Variant selectors */}
        <View style={styles.purchasePanel}>
          <LinearGradient
            colors={[`${colors.paper.warm}`, "#ffffff00"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.purchaseGlow}
            pointerEvents="none"
          />
          <View style={styles.purchaseHeader}>
            <View style={styles.purchaseTitleWrap}>
              <Label style={styles.purchaseEyebrow}>MAKE IT YOURS</Label>
              <Display size="lg" style={styles.purchaseTitle}>
                Select <Display size="lg" style={styles.purchaseTitleItalic}>options</Display>
              </Display>
            </View>
            <View style={[styles.stockPill, (soldOut || lowStock) && styles.stockPillSoldOut]}>
              <View style={[styles.stockDot, (soldOut || lowStock) && styles.stockDotSoldOut]} />
              <Label style={[styles.stockText, (soldOut || lowStock) && styles.stockTextSoldOut]}>
                {soldOut ? "Sold out" : lowStock ? `Only ${currentStock} left` : "In stock"}
              </Label>
            </View>
          </View>
          <View style={styles.purchaseDivider} />
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

          {/* Quantity */}
          <View style={styles.qtySection}>
          <OverlapWarningBanner
            productId={product.id}
            onOpenWardrobe={() => router.push("/(main)/account/wardrobe" as never)}
          />
          <View style={styles.qtyControlRow}>
            <View style={styles.qtyLabelWrap}>
              <Label style={styles.qtyLabelText}>QUANTITY</Label>
              <Body size="xs" style={styles.qtyHint}>
                {soldOut
                  ? "Currently unavailable"
                  : lowStock
                    ? `Only ${currentStock} left — order soon`
                    : "Ships in 1–3 business days"}
              </Body>
            </View>
            <View style={styles.qtyContainer}>
              <TouchableOpacity
                style={[styles.qtyPillBtn, quantity <= 1 && styles.qtyPillBtnDisabled]}
                disabled={quantity <= 1}
                onPress={() => setQuantity(Math.max(1, quantity - 1))}
                activeOpacity={0.7}
                accessibilityLabel="Decrease quantity"
              >
                <Ionicons name="remove" size={16} color={colors.light.foreground} />
              </TouchableOpacity>
              <Display size="sm" style={styles.qtyValue}>{quantity}</Display>
              <TouchableOpacity
                style={styles.qtyPillBtn}
                onPress={() => setQuantity(Math.min(currentStock || 99, quantity + 1))}
                activeOpacity={0.7}
                accessibilityLabel="Increase quantity"
              >
                <Ionicons name="add" size={16} color={colors.light.foreground} />
              </TouchableOpacity>
            </View>
          </View>
          </View>
        </View>

        {/* Trust & highlights */}
        <View style={styles.section}>
          <TrustHighlights
            acceptsReturns={product.store?.accepts_returns !== false}
            returnWindowDays={product.store?.return_window_days}
          />
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

        {/* Questions & answers */}
        <View style={styles.section}>
          <ProductQA productId={product.id} />
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
              renderItem={({ item }) => (
                <View>
                  <ProductCard product={item} horizontal />
                  {(item as Product & { match_reason?: string | null }).match_reason ? (
                    <Body size="xs" style={styles.matchReason} numberOfLines={1}>{(item as Product & { match_reason?: string | null }).match_reason}</Body>
                  ) : null}
                </View>
              )}
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
        <View style={{ height: Math.max(insets.bottom, 12) + 150 }} />
      </ScrollView>

      {/* Fixed bottom purchase bar */}
      <View style={[styles.stickyBottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {Platform.OS === "ios" ? (
          <BlurView intensity={70} tint="light" style={StyleSheet.absoluteFill} />
        ) : null}
        <View style={[StyleSheet.absoluteFill, styles.stickyTint]} pointerEvents="none" />
        <View style={styles.stickySummary}>
          <View style={styles.stickySummaryLeft}>
            <Label style={styles.stickyEyebrow}>YOUR SELECTION</Label>
            <Body size="xs" numberOfLines={1} style={styles.stickyVariant}>
              {[selectedSize && `Size ${selectedSize}`, selectedColor, quantity > 1 && `Qty ${quantity}`]
                .filter(Boolean)
                .join("  ·  ") || "Select your options"}
            </Body>
          </View>
          <View style={styles.stickySummaryRight}>
            <Label style={styles.stickyEyebrow}>TOTAL</Label>
            <Price size="sm" style={styles.stickyTotal}>
              {formatPrice(unitPrice * quantity, product.currency)}
            </Price>
          </View>
        </View>
        <View style={styles.stickyBottomInner}>
          <TouchableOpacity
            onPress={handleAddToCart}
            disabled={!isInCart && soldOut}
            style={[styles.stickyBtn, styles.stickyAddBtn, !isInCart && soldOut && styles.stickyBtnDisabled]}
            activeOpacity={0.8}
            accessibilityRole="button"
          >
            <View style={styles.stickyAddIcon}>
              <Ionicons
                name={isInCart ? "bag-check-outline" : "bag-add-outline"}
                size={16}
                color={C.text}
              />
            </View>
            <Body style={styles.stickyAddText}>
              {isInCart ? "Go to basket" : soldOut ? "Sold out" : "Add to basket"}
            </Body>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleBuyNow}
            disabled={soldOut}
            style={[styles.stickyBtn, styles.stickyBuyBtn, soldOut && styles.stickyBtnDisabled]}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <Body style={styles.stickyBuyText}>Buy now</Body>
            <View style={styles.stickyBuyArrow}>
              <Ionicons name="arrow-forward" size={15} color={C.ink} />
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </View>

    <ReviewForm
      visible={showReviewForm}
      onClose={() => setShowReviewForm(false)}
      productId={product.id}
      productName={product.name}
      productImage={images.find((i) => i.is_primary)?.url || images[0]?.url}
      brandName={product.brand?.name}
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
  root: {
    flex: 1,
    backgroundColor: C.paper,
  },
  glow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 560,
  },
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  topBarTint: {
    backgroundColor: Platform.OS === "ios" ? "rgba(235,229,204,0.82)" : C.glow,
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
    color: C.accent,
    fontSize: 12,
    fontFamily: fontFamilies.sans.bold,
  },
  topRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
  },
  topBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: C.ink,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  cartBtn: {
    position: "relative",
  },
  headerBadge: {
    position: "absolute",
    top: -3,
    right: -3,
    backgroundColor: C.ink,
    borderRadius: 10,
    minWidth: 19,
    height: 19,
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: C.glow,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBadgeText: {
    color: C.lime,
    fontSize: 9,
    fontFamily: fontFamilies.sans.bold,
  },
  section: {
    marginTop: spacing[5],
  },
  priceAlertWrap: {
    paddingHorizontal: spacing[5],
  },
  purchasePanel: {
    marginTop: spacing[6],
    marginHorizontal: spacing[5],
    paddingTop: 18,
    paddingBottom: 18,
    backgroundColor: "#ffffff",
    borderRadius: 26,
    borderWidth: 1,
    borderColor: C.line,
    shadowColor: C.ink,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.07,
    shadowRadius: 20,
    elevation: 3,
  },
  purchaseGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 110,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  purchaseHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[3],
    paddingHorizontal: spacing[5],
  },
  purchaseTitleWrap: {
    gap: 2,
    flexShrink: 1,
  },
  purchaseEyebrow: {
    color: C.accent,
    fontSize: 10,
    letterSpacing: 1.8,
    fontFamily: fontFamilies.mono.semibold,
  },
  purchaseTitle: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.4,
    color: C.text,
  },
  purchaseTitleItalic: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 20,
    lineHeight: 26,
    color: C.accent,
  },
  stockPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 11,
    height: 28,
    borderRadius: radii.full,
    backgroundColor: C.ink,
  },
  stockPillSoldOut: {
    backgroundColor: C.rust,
  },
  stockDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.lime,
  },
  stockDotSoldOut: {
    backgroundColor: C.cream,
  },
  stockText: {
    color: C.cream,
    fontSize: 10.5,
    letterSpacing: 0.6,
    fontFamily: fontFamilies.sans.bold,
  },
  stockTextSoldOut: {
    color: C.cream,
  },
  purchaseDivider: {
    height: 1,
    backgroundColor: C.line,
    marginVertical: 18,
    marginHorizontal: 18,
  },
  qtySection: {
    paddingHorizontal: spacing[5],
    marginTop: spacing[6],
    gap: spacing[4],
  },
  qtyControlRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[3],
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  qtyLabelWrap: {
    flexShrink: 1,
    gap: 3,
  },
  qtyLabelText: {
    color: C.accent,
    fontSize: 10,
    letterSpacing: 1.8,
    fontFamily: fontFamilies.mono.semibold,
  },
  qtyHint: {
    color: colors.light.mutedForeground,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
  },
  qtyContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.accentSoft,
    borderRadius: radii.full,
    padding: 4,
  },
  qtyPillBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  qtyPillBtnDisabled: {
    opacity: 0.4,
  },
  qtyValue: {
    minWidth: 44,
    textAlign: "center",
    fontFamily: fontFamilies.sans.bold,
    fontSize: 17,
    color: C.text,
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
  matchReason: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 10,
    color: colors.olive[700],
    marginTop: 2,
    maxWidth: 160,
  },
  /* Fixed bottom purchase bar */
  stickyBottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: 16,
    paddingHorizontal: spacing[4],
    gap: spacing[3],
    overflow: "hidden",
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  stickyTint: {
    backgroundColor: Platform.OS === "ios" ? "rgba(255,255,255,0.9)" : "#ffffff",
  },
  stickySummary: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: spacing[3],
    paddingHorizontal: spacing[1],
  },
  stickySummaryLeft: {
    flex: 1,
    gap: 2,
  },
  stickySummaryRight: {
    alignItems: "flex-end",
    gap: 2,
  },
  stickyEyebrow: {
    color: C.accent,
    fontSize: 9.5,
    letterSpacing: 1.6,
    fontFamily: fontFamilies.mono.semibold,
  },
  stickyVariant: {
    fontSize: 13.5,
    color: C.text,
    fontFamily: fontFamilies.sans.semibold,
  },
  stickyTotal: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 21,
    letterSpacing: -0.5,
    color: C.text,
  },
  stickyBottomInner: {
    flexDirection: "row",
    gap: spacing[2.5],
  },
  stickyBtn: {
    flex: 1,
    height: 54,
    borderRadius: radii.full,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    overflow: "hidden",
  },
  stickyBtnDisabled: {
    opacity: 0.45,
  },
  stickyAddBtn: {
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.paper,
    paddingLeft: 6,
  },
  stickyAddIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  stickyBuyBtn: {
    backgroundColor: C.ink,
    paddingRight: 6,
  },
  stickyBuyArrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.lime,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: "auto",
  },
  stickyAddText: {
    color: C.text,
    fontFamily: fontFamilies.sans.bold,
    fontSize: 14,
    flexShrink: 1,
  },
  stickyBuyText: {
    color: C.cream,
    fontFamily: fontFamilies.sans.bold,
    fontSize: 14,
    marginLeft: "auto",
  },
});
