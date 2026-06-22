import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity, FlatList, Dimensions, Animated, Share } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PaperBackground } from "@/components/layout";
import { SectionHeader } from "@/components/layout";
import { ProductImageGallery } from "@/components/product/ProductImageGallery";
import { ProductInfo } from "@/components/product/ProductInfo";
import { VariantSelector } from "@/components/product/VariantSelector";
import { TrustHighlights } from "@/components/product/TrustHighlights";
import { ProductStoreCard } from "@/components/product/ProductStoreCard";
import { ProductDetails } from "@/components/product/ProductDetails";
import { ProductCard } from "@/components/product/ProductCard";
import { ReviewForm } from "@/components/product/ReviewForm";
import { buildCartLineKeyFromItem } from "@/lib/cart-line-key";
import { useCart, useWishlist } from "@/lib/stores";
import { useAuth } from "@/lib/supabase/auth";
import { useToast, Button, Skeleton } from "@/components/ui";
import { Display, Body, Price } from "@/components/ui/Typography";
import { colors, spacing, radii, shadows } from "@/lib/theme/tokens";
import { formatPrice } from "@/lib/utils";
import { navigateHome } from "@/lib/navigation";
import { recordRecentlyViewed } from "@/lib/account-local";
import * as api from "@/lib/api";
import {
  useTrackView,
  useTrackEvent,
  getSimilarProducts,
  getYouMayAlsoLike,
  getPairsWellWithRail,
  getRecentlyViewedRail,
} from "@/lib/recommender";
import type { Product, ProductVariant, Review } from "@/lib/types";
import { useInventoryRealtime, getVariantStock } from "@/lib/hooks/useInventoryRealtime";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function ProductDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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

  // Track view + dwell time.
  useTrackView(product);
  const tracker = useTrackEvent();

  const scrollY = useRef(new Animated.Value(0)).current;
  const AnimatedTouchableOpacity = useMemo(() => Animated.createAnimatedComponent(TouchableOpacity), []);

  const fetchProduct = useCallback(async () => {
    if (!slug) return;
    const res = await api.getProductBySlug(slug);
    if (res.ok && res.data) {
      setProduct(res.data);
      const first = res.data.variants?.[0];
      if (first) {
        setSelectedVariant(first);
        setSelectedSize(first.size || null);
        setSelectedColor(first.color || null);
      }
      const r = await api.getReviews(res.data.id);
      if (r.ok) setReviews(r.data);
      // Content-similar products (no profile required).
      const similar = await getSimilarProducts(res.data, 8);
      if (similar.ok) setRelatedProducts(similar.data);
      // Personalized "you may also like" (falls back to similar for new users).
      const ymal = await getYouMayAlsoLike(user?.id ?? null, res.data, 8);
      if (ymal.ok) setYouMayAlsoLike(ymal.data);
      // Co-occurrence / pairs well with.
      const pairs = await getPairsWellWithRail(user?.id ?? null, res.data, 6);
      if (pairs.ok) setPairsWellWith(pairs.data);
      // Recently viewed (excluding current product).
      const recent = await getRecentlyViewedRail(user?.id ?? null, 8, [res.data.id]);
      if (recent.ok) setRecentlyViewed(recent.data);
    }
    setLoading(false);
  }, [slug, user?.id]);

  useEffect(() => { fetchProduct(); }, [fetchProduct]);

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
  const currentStock = liveVariantStock?.available ?? selectedVariant?.stock ?? 0;
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

  const handleAddToCart = () => {
    if (!product) return;
    if (isInCart) {
      router.push("/(main)/cart");
      return;
    }
    if (soldOut) {
      toast("Sold out", "error");
      return;
    }
    if (product.variants && product.variants.length > 0 && !selectedSize) {
      toast("Select a size", "error");
      return;
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
      stock: currentStock,
      quantity,
    });
    tracker.cartAdd(product);
    toast("Added to basket", "success");
  };

  const handleBuyNow = () => {
    handleAddToCart();
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
  const headerBg = scrollY.interpolate({
    inputRange: [100, 200],
    outputRange: ["rgba(245, 244, 239, 0)", "rgba(245, 244, 239, 0.98)"],
    extrapolate: "clamp",
  });

  const headerBorder = scrollY.interpolate({
    inputRange: [100, 200],
    outputRange: ["rgba(83, 94, 44, 0)", "rgba(83, 94, 44, 0.12)"],
    extrapolate: "clamp",
  });

  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [140, 200],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const btnBg = scrollY.interpolate({
    inputRange: [100, 200],
    outputRange: ["rgba(250, 248, 241, 0.92)", "rgba(250, 248, 241, 0)"],
    extrapolate: "clamp",
  });

  const btnBorder = scrollY.interpolate({
    inputRange: [100, 200],
    outputRange: ["rgba(83, 94, 44, 0.15)", "rgba(83, 94, 44, 0)"],
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
      {/* Animated Sticky Header */}
      <Animated.View
        style={[
          styles.topBar,
          {
            paddingTop: insets.top + 8,
            backgroundColor: headerBg,
            borderColor: headerBorder,
          },
        ]}
      >
        <AnimatedTouchableOpacity
          style={[styles.topBtn, { backgroundColor: btnBg, borderColor: btnBorder }]}
          onPress={() => navigateHome(router)}
          activeOpacity={0.8}
        >
          <Ionicons name="chevron-back" size={22} color={colors.light.foreground} />
        </AnimatedTouchableOpacity>

        <Animated.View style={[styles.headerCenter, { opacity: headerTitleOpacity }]}>
          <Display size="xs" style={styles.headerTitleText} numberOfLines={1}>
            {product.name}
          </Display>
          <Price size="xs" style={styles.headerPriceText}>
            {formatPrice(unitPrice)}
          </Price>
        </Animated.View>

        <View style={styles.topRight} />
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
          />
        </View>

        {/* Quantity */}
        <View style={styles.qtySection}>
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
            <SectionHeader
              kicker="You might also love"
              title="Similar Pieces"
              actionLabel="View all"
              onAction={() => router.push("/(main)/products")}
            />
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
            <SectionHeader
              kicker="Picked for you"
              title="You May Also Like"
              actionLabel="View all"
              onAction={() => router.push("/(main)/products?sort=newest")}
            />
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
            <SectionHeader
              kicker="Complete the look"
              title="Pairs Well With"
              actionLabel="View all"
              onAction={() => router.push("/(main)/products")}
            />
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
            <SectionHeader
              kicker="Pick up where you left off"
              title="Recently Viewed"
            />
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

        {/* Bottom spacer for breathing room */}
        <View style={{ height: Math.max(insets.bottom, spacing[6]) }} />
      </ScrollView>
    </PaperBackground>

    <ReviewForm
      visible={showReviewForm}
      onClose={() => setShowReviewForm(false)}
      productId={product.id}
      productName={product.name}
      onSubmitted={() => {
        fetchProduct();
      }}
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
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  headerPriceText: {
    color: colors.olive[600],
    fontSize: 12,
    fontWeight: "500",
  },
  topRight: {
    width: 40,
    height: 40,
  },
  topBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
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
  relatedList: {
    paddingHorizontal: spacing[4],
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
});
