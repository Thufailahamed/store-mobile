// =============================================================================
// Mobile storefront section components (React Native).
// Each section imports its section-shape type from @luxe/store-storefront
// and renders via existing mobile primitives (ProductCard, ProductGrid, etc.).
// =============================================================================

import React from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@/components/ui/Icon";
import { Display, Body } from "@/components/ui/Typography";
import { ProductGrid } from "@/components/product/ProductGrid";
import { Button } from "@/components/ui/Button";
import { colors, spacing, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import type {
  AppHeaderSection as AppHeaderSectionT,
  AppHeroSection as AppHeroSectionT,
  BrandStoryAppSection as BrandStoryAppSectionT,
  PromoBannerSection as PromoBannerSectionT,
  ProductCarouselSection as ProductCarouselSectionT,
  ProductGridSection as ProductGridSectionT,
  CtaTarget,
  ProductSource,
} from "@luxe/store-storefront";

/**
 * Resolve product ids from a section's source descriptor.
 * Only `kind:'manual'` carries explicit ids. For other kinds we fall back
 * to whatever products the route has already fetched (best-effort).
 */
function resolveProductIds(
  source: ProductSource | undefined,
  fallback: { id: string }[],
  limit?: number,
): string[] {
  if (!source) return [];
  if (source.kind === "manual") {
    return limit ? source.productIds.slice(0, limit) : source.productIds;
  }
  return fallback.slice(0, limit ?? fallback.length).map((p) => p.id);
}

function ctaHref(cta: CtaTarget | undefined): string | undefined {
  if (!cta) return undefined;
  if (cta.kind === "product") return `/(main)/products/${cta.productId}`;
  if (cta.kind === "collection") return `/(main)/collections/${cta.collectionId}`;
  if (cta.kind === "href") return cta.href;
  return undefined;
}

interface SectionCtx {
  productsById: Map<string, { id: string }>;
  storeId: string | null;
  storeName: string;
  allProducts: { id: string }[];
}

export function makeSectionRenderer(ctx: SectionCtx) {
  function AppHeader({ section }: { section: AppHeaderSectionT }) {
    return (
      <View style={[styles.header, section.backgroundColor ? { backgroundColor: section.backgroundColor } : null]}>
        <View style={styles.headerLeft}>
          <Ionicons name="storefront-outline" size={20} color={colors.olive[700]} />
          <Display size="md" style={styles.headerTitle}>
            {ctx.storeName || "Store"}
          </Display>
        </View>
        <View style={styles.headerRight}>
          {section.showSearch ? (
            <TouchableOpacity accessibilityLabel="Search" style={styles.headerIcon}>
              <Ionicons name="search-outline" size={22} color={colors.light.foreground} />
            </TouchableOpacity>
          ) : null}
          {section.showWishlist ? (
            <TouchableOpacity accessibilityLabel="Wishlist" style={styles.headerIcon}>
              <Ionicons name="heart-outline" size={22} color={colors.light.foreground} />
            </TouchableOpacity>
          ) : null}
          {section.showCart ? (
            <TouchableOpacity accessibilityLabel="Cart" style={styles.headerIcon}>
              <Ionicons name="bag-outline" size={22} color={colors.light.foreground} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  }

  function AppHero({ section }: { section: AppHeroSectionT }) {
    const router = useRouter();
    const target = ctaHref(section.ctaTarget);
    const heightMap = { small: 240, medium: 320, large: 420 } as const;
    const h = heightMap[section.height];
    const posMap = { top: "flex-start", center: "center", bottom: "flex-end" } as const;
    return (
      <View style={[styles.hero, { height: h }]}>
        {section.imageUrl ? (
          <Image
            source={{ uri: section.imageUrl }}
            style={styles.heroImage}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={[styles.heroImage, styles.heroImagePlaceholder]}>
            <Ionicons name="image-outline" size={48} color={colors.light.mutedForeground} />
          </View>
        )}
        <View
          style={[
            styles.heroOverlay,
            { opacity: section.overlayOpacity, justifyContent: posMap[section.contentPosition] },
          ]}
        >
          {section.heading ? (
            <Display size="2xl" style={styles.heroTitle}>{section.heading}</Display>
          ) : null}
          {section.subtitle ? (
            <Body size="md" style={styles.heroSubtitle}>{section.subtitle}</Body>
          ) : null}
          {section.ctaText ? (
            <Button
              variant="brand"
              style={styles.heroCta}
              onPress={() => {
                if (target) router.push(target as never);
              }}
            >
              {section.ctaText}
            </Button>
          ) : null}
        </View>
      </View>
    );
  }

  function BrandStory({ section }: { section: BrandStoryAppSectionT }) {
    const router = useRouter();
    return (
      <View style={styles.story}>
        {section.imageUrl ? (
          <Image
            source={{ uri: section.imageUrl }}
            style={styles.storyImage}
            contentFit="cover"
            transition={200}
          />
        ) : null}
        {section.title ? (
          <Display size="xl" style={styles.storyTitle}>{section.title}</Display>
        ) : null}
        {section.body ? (
          <Body size="md" style={styles.storySubtitle}>{section.body}</Body>
        ) : null}
        {section.ctaText ? (
          <Button
            variant="outline"
            style={styles.storyCta}
            onPress={() => {
              if (section.ctaHref) router.push(section.ctaHref as never);
            }}
          >
            {section.ctaText}
          </Button>
        ) : null}
      </View>
    );
  }

  function PromoBanner({ section }: { section: PromoBannerSectionT }) {
    const router = useRouter();
    const target = ctaHref(section.ctaTarget);
    return (
      <TouchableOpacity
        activeOpacity={0.9}
        style={[styles.banner, section.backgroundColor ? { backgroundColor: section.backgroundColor } : null]}
        onPress={() => target && router.push(target as never)}
      >
        {section.imageUrl ? (
          <Image source={{ uri: section.imageUrl }} style={styles.bannerImage} contentFit="cover" />
        ) : (
          <View style={[styles.bannerImage, styles.heroImagePlaceholder]} />
        )}
        <View style={styles.bannerOverlay}>
          {section.headline ? (
            <Display size="lg" style={styles.bannerTitle}>{section.headline}</Display>
          ) : null}
          {section.ctaText ? (
            <Body size="sm" style={styles.bannerCta}>{section.ctaText} →</Body>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  }

  function ProductCarousel({ section }: { section: ProductCarouselSectionT }) {
    const ids = resolveProductIds(section.source, ctx.allProducts, section.limit);
    const items = ids
      .map((id) => ctx.productsById.get(id))
      .filter((p): p is { id: string } => !!p);
    if (items.length === 0) return null;
    return (
      <View style={styles.carouselWrap}>
        {section.title ? (
          <Display size="md" style={styles.sectionTitle}>{section.title}</Display>
        ) : null}
        <ProductGrid products={items as never} horizontal />
      </View>
    );
  }

  function ProductGridSection_({ section }: { section: ProductGridSectionT }) {
    const ids = resolveProductIds(section.source, ctx.allProducts, section.limit);
    const items = ids
      .map((id) => ctx.productsById.get(id))
      .filter((p): p is { id: string } => !!p);
    if (items.length === 0) return null;
    return (
      <View style={styles.gridWrap}>
        {section.title ? (
          <Display size="md" style={styles.sectionTitle}>{section.title}</Display>
        ) : null}
        <ProductGrid products={items as never} />
      </View>
    );
  }

  return {
    AppHeader,
    AppHero,
    BrandStory,
    PromoBanner,
    ProductCarousel,
    ProductGrid: ProductGridSection_,
  };
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
    backgroundColor: colors.light.background,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: spacing[2], flex: 1 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: spacing[3] },
  headerIcon: { padding: spacing[1] },
  headerTitle: { fontFamily: fontFamilies.display.semibold },
  hero: { position: "relative", marginBottom: spacing[4] },
  heroImage: { width: "100%", height: "100%" },
  heroImagePlaceholder: {
    backgroundColor: colors.olive[100],
    alignItems: "center",
    justifyContent: "center",
  },
  heroOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing[5],
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  heroTitle: { color: "#FFF", marginBottom: spacing[2] },
  heroSubtitle: { color: "#F5F5F4", marginBottom: spacing[3] },
  heroCta: { alignSelf: "flex-start" },
  story: { paddingHorizontal: spacing[5], paddingVertical: spacing[6], gap: spacing[2] },
  storyImage: { width: "100%", height: 220, borderRadius: radii.lg, marginBottom: spacing[3] },
  storyTitle: {},
  storySubtitle: { color: colors.light.mutedForeground },
  storyCta: { alignSelf: "flex-start", marginTop: spacing[2] },
  banner: { marginHorizontal: spacing[5], marginVertical: spacing[3], borderRadius: radii.lg, overflow: "hidden" },
  bannerImage: { width: "100%", height: 180 },
  bannerOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing[4],
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  bannerTitle: { color: "#FFF" },
  bannerCta: { color: "#FFF", marginTop: spacing[1] },
  carouselWrap: { marginVertical: spacing[4] },
  gridWrap: { marginHorizontal: spacing[5], marginVertical: spacing[4] },
  sectionTitle: { paddingHorizontal: spacing[5], marginBottom: spacing[2] },
});