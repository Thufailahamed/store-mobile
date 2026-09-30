import React, { useState } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { Display, Label, Body } from "@/components/ui/Typography";
import { HomeSectionHeader } from "./HomeSectionHeader";
import { colors, spacing, radii, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";

interface LookItem {
  id: string;
  name: string;
  price: number;
  category: string;
  imageUrl: string;
  slug?: string;
}

interface CuratedLook {
  id: string;
  lookNumber: string;
  title: string;
  subtitle: string;
  heroImage: string;
  items: LookItem[];
}

const CURATED_LOOKS: CuratedLook[] = [
  {
    id: "look-1",
    lookNumber: "LOOK 01",
    title: "Liquid Silk & Tailored Drape",
    subtitle: "Fluid silhouettes paired with artisan leather accessories",
    heroImage: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1000&q=80",
    items: [
      {
        id: "item-1-1",
        name: "Emerald Silk Slip Dress",
        price: 8500,
        category: "Dresses",
        imageUrl: "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=400&q=80",
        slug: "emerald-silk-slip-dress",
      },
      {
        id: "item-1-2",
        name: "Woven Calfskin Clutch",
        price: 6200,
        category: "Accessories",
        imageUrl: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=400&q=80",
      },
      {
        id: "item-1-3",
        name: "Minimalist Nappa Mules",
        price: 7400,
        category: "Footwear",
        imageUrl: "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=400&q=80",
      },
    ],
  },
  {
    id: "look-2",
    lookNumber: "LOOK 02",
    title: "Mediterranean Linen & Earth",
    subtitle: "Breathable pure linen tailored for warm evening breezes",
    heroImage: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1000&q=80",
    items: [
      {
        id: "item-2-1",
        name: "Olive Utility Shirt Dress",
        price: 6900,
        category: "Dresses",
        imageUrl: "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=400&q=80",
        slug: "olive-utility-shirt-dress",
      },
      {
        id: "item-2-2",
        name: "Raw Linen Tote",
        price: 4500,
        category: "Bags",
        imageUrl: "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=400&q=80",
      },
    ],
  },
];

function chunkProductsIntoLooks(products: import("@/lib/types").Product[]): CuratedLook[] {
  const looks: CuratedLook[] = [];
  for (let i = 0; i < products.length && looks.length < 3; i += 3) {
    const slice = products.slice(i, i + 3);
    if (slice.length < 3) break;
    const hero =
      slice[0]?.images?.find((img) => img.is_primary)?.url ??
      slice[0]?.images?.[0]?.url ??
      "";
    looks.push({
      id: `look-${i / 3 + 1}`,
      lookNumber: `LOOK ${String(i / 3 + 1).padStart(2, "0")}`,
      // Title the look by what's in it rather than repeating the first
      // piece's name (which is already listed in "Pieces in this look").
      title: lookTitle(slice),
      subtitle: `${slice.length} pieces, styled together`,
      heroImage: hero,
      items: slice.map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        category: p.category?.name ?? "Piece",
        imageUrl: p.images?.find((img) => img.is_primary)?.url ?? p.images?.[0]?.url ?? hero,
        slug: p.slug,
      })),
    });
  }
  return looks.length > 0 ? looks : CURATED_LOOKS;
}

function lookTitle(slice: import("@/lib/types").Product[]): string {
  const cats = Array.from(
    new Set(slice.map((p) => p.category?.name).filter((c): c is string => Boolean(c)))
  );
  if (cats.length >= 2) return `${cats[0]} & ${cats[1]}`;
  if (cats.length === 1) return `The ${cats[0].toLowerCase()} edit`;
  return "A curated ensemble";
}

export function ShopTheLookSection({ products = [] }: { products?: import("@/lib/types").Product[] }) {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const [activeLookIndex, setActiveLookIndex] = useState(0);

  const looks: CuratedLook[] =
    products.length >= 3
      ? chunkProductsIntoLooks(products)
      : CURATED_LOOKS;

  const activeLook = looks[Math.min(activeLookIndex, looks.length - 1)] ?? looks[0];
  const CARD_WIDTH = screenWidth - spacing[5] * 2;

  return (
    <View style={styles.container}>
      <HomeSectionHeader
        kicker="The atelier lookbook"
        title="Shop the look"
        onPress={() => router.push("/(main)/products?sort=newest")}
      />

      {/* Look Selector Tabs — only worth showing when there's a choice */}
      {looks.length > 1 ? (
        <View style={styles.lookTabs}>
          {looks.map((look, i) => (
            <TouchableOpacity
              key={look.id}
              style={[styles.lookTab, i === activeLookIndex && styles.lookTabActive]}
              onPress={() => setActiveLookIndex(i)}
              activeOpacity={0.8}
            >
              <Label style={[styles.lookTabText, i === activeLookIndex && styles.lookTabTextActive]}>
                {look.lookNumber}
              </Label>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {/* Main Look Card */}
      <View style={[styles.card, { width: CARD_WIDTH }]}>
        <View style={styles.heroWrap}>
          <Image
            source={{ uri: activeLook.heroImage }}
            style={styles.heroImage}
            contentFit="cover"
            transition={300}
          />
          <LinearGradient
            colors={["transparent", "rgba(16,17,10,0.35)", "rgba(16,17,10,0.85)"]}
            locations={[0.4, 0.65, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.heroOverlay}>
            <Label style={styles.heroKicker}>{activeLook.lookNumber}</Label>
            <Display size="lg" style={styles.heroTitle}>{activeLook.title}</Display>
            <Body size="xs" style={styles.heroSubtitle}>{activeLook.subtitle}</Body>
          </View>
        </View>

        {/* Ensemble Item Pills */}
        <View style={styles.itemsSection}>
          <Label style={styles.itemsLabel}>PIECES IN THIS LOOK ({activeLook.items.length})</Label>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.itemsList}>
            {activeLook.items.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.itemCard}
                activeOpacity={0.85}
                onPress={() => {
                  if (item.slug) {
                    router.push(`/(main)/products/${item.slug}`);
                  } else {
                    router.push("/(main)/products");
                  }
                }}
              >
                <Image source={{ uri: item.imageUrl }} style={styles.itemThumb} contentFit="cover" />
                <View style={styles.itemInfo}>
                  <Label style={styles.itemCategory}>{item.category}</Label>
                  <Body size="xs" numberOfLines={1} style={styles.itemName}>{item.name}</Body>
                  <Body size="xs" style={styles.itemPrice}>{formatPrice(item.price)}</Body>
                </View>
                <View style={styles.arrowIcon}>
                  <Ionicons name="arrow-forward" size={12} color={colors.olive[600]} />
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing[8],
  },
  lookTabs: {
    flexDirection: "row",
    gap: spacing[2],
    paddingHorizontal: spacing[5],
    marginBottom: spacing[3.5],
  },
  lookTab: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radii.full,
    backgroundColor: `${colors.light.primary}08`,
    borderWidth: 1,
    borderColor: `${colors.light.primary}12`,
  },
  lookTabActive: {
    backgroundColor: colors.light.primary,
    borderColor: colors.light.primary,
  },
  lookTabText: {
    fontSize: 10,
    fontFamily: fontFamilies.mono.medium,
    color: colors.light.mutedForeground,
  },
  lookTabTextActive: {
    color: colors.light.primaryForeground,
    fontFamily: fontFamilies.mono.semibold,
  },
  card: {
    marginHorizontal: spacing[5],
    backgroundColor: colors.light.card,
    borderRadius: radii["2xl"],
    overflow: "hidden",
    borderWidth: 1,
    borderColor: `${colors.light.primary}15`,
    ...shadows.soft,
  },
  heroWrap: {
    height: 320,
    position: "relative",
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  heroOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing[4],
    gap: 4,
  },
  heroKicker: {
    color: colors.accent2.ochre,
    fontSize: 9.5,
    letterSpacing: 1.5,
  },
  heroTitle: {
    color: "#ffffff",
  },
  heroSubtitle: {
    color: "rgba(255, 255, 255, 0.8)",
  },
  itemsSection: {
    padding: spacing[4],
    gap: spacing[2.5],
    backgroundColor: colors.paper.warm,
  },
  itemsLabel: {
    fontSize: 9.5,
    letterSpacing: 1.5,
    color: colors.olive[700],
  },
  itemsList: {
    gap: spacing[2.5],
  },
  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.light.card,
    borderRadius: radii.xl,
    padding: spacing[2],
    paddingRight: spacing[3],
    borderWidth: 1,
    borderColor: `${colors.light.primary}12`,
    gap: spacing[2.5],
    width: 210,
  },
  itemThumb: {
    width: 44,
    height: 52,
    borderRadius: radii.md,
    backgroundColor: colors.light.muted,
  },
  itemInfo: {
    flex: 1,
    gap: 1,
  },
  itemCategory: {
    fontSize: 8.5,
    letterSpacing: 1,
    color: colors.olive[600],
  },
  itemName: {
    color: colors.light.foreground,
    fontFamily: fontFamilies.sans.semibold,
  },
  itemPrice: {
    color: colors.light.foreground,
    fontFamily: fontFamilies.sans.bold,
  },
  arrowIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: `${colors.olive[600]}10`,
    alignItems: "center",
    justifyContent: "center",
  },
});
