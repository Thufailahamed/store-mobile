import React, { useState } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { Display, Label, Body, Price } from "@/components/ui/Typography";
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
      title: slice[0]?.name ?? "Curated look",
      subtitle: slice.map((p) => p.category?.name ?? p.name).slice(0, 2).join(" · "),
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
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Label style={styles.kicker}>THE ATELIER LOOKBOOK</Label>
          <Display size="2xl" style={styles.title}>Shop the Look</Display>
        </View>
        <TouchableOpacity
          onPress={() => router.push("/(main)/products?sort=newest")}
          activeOpacity={0.7}
        >
          <Label style={styles.viewAll}>VIEW EDIT →</Label>
        </TouchableOpacity>
      </View>

      {/* Look Selector Tabs */}
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

      {/* Main Look Card */}
      <View style={[styles.card, { width: CARD_WIDTH }]}>
        <View style={styles.heroWrap}>
          <Image
            source={{ uri: activeLook.heroImage }}
            style={styles.heroImage}
            contentFit="cover"
            transition={300}
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
                  <Price size="xs" style={styles.itemPrice}>{formatPrice(item.price)}</Price>
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
    marginVertical: spacing[6],
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: spacing[5],
    marginBottom: spacing[3],
  },
  kicker: {
    color: colors.olive[600],
    fontSize: 10,
    letterSpacing: 2,
    marginBottom: 2,
  },
  title: {
    color: colors.light.foreground,
  },
  viewAll: {
    fontSize: 10.5,
    letterSpacing: 1.5,
    color: colors.olive[600],
    fontFamily: fontFamilies.mono.semibold,
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
    backgroundColor: "rgba(22, 23, 15, 0.65)",
    gap: 2,
  },
  heroKicker: {
    color: colors.accent2.rust,
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
