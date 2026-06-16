import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { fontFamilies } from "@/lib/theme/fonts";
import { radii, shadows, spacing } from "@/lib/theme/tokens";
import * as api from "@/lib/api";
import type { Category } from "@/lib/types";

const INK = "#1b1c1c";
const MUTED = "#5e5e5d";
const GUTTER = spacing[5];
const GRID_GAP = spacing[3];
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const COL_WIDTH = (SCREEN_WIDTH - GUTTER * 2 - GRID_GAP) / 2;

const DEFAULT_CATEGORIES = [
  {
    title: "Womenswear",
    slug: "women",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBgzu5rtwO-sis2a7r2G9RfwD-HXWurbahmygg_7RjrFSHQzuVR9sxsnueOhUC3-tSioUZjTwb8JlYxF3TEaV7qqHWf6PNk3x0j7Vr4EpQIKHt4ahIGO-egIdpHKJ3TMb82lGRYLjsTxL4hpPmQSqx_2UC1wTxIzReWGEHoSupTbRC7HiuKz2EtGS6nkeiu-NmXXg2kk7s2HiGKk12mbFZ3eKwcbghwC19IJa74mClVbhfaPvYgShYNZpotVk-BkrDKIbpVerxwybLL",
    radius: 36,
    tall: true,
  },
  {
    title: "Menswear",
    slug: "men",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBw0z-IimIJr2XzJaCJj918ImcsFpC6rNXWzoRG8YwZsPky6rpFtak2bpR9zJfJt8YyJBD75nOLN-GifcYt6j2Yvn34CK8dcIPoruJJedMJ44kTZZS3vuDXmuocQPUFYtkNMZ7Y5e8TsX30zzkeGlPPk73HNazh_YNyCTCgwTePoWohy7lMX_z6KiMZmIqJwbVLlQAxtNn5nXBso6FzCKMe7vRbppWcAcdXeVI8VLLBkFf6cW8P1RGJ3sgL11fROWGbJmWEPeAs6yPv",
    radius: 28,
    tall: false,
  },
  {
    title: "Accessories",
    slug: "accessories",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBzoHmupqBeJQO3i1yBCuxCycvlQDV5bUQlpBwJ-2QgI8oRFgEmEoY51zqHw3QVjn3NDTrq3_e6QyElYRpa8nkPLy2q5TIzq964ifF1QwDQg7WuI5CoB7zugnX6iDtr2-xLXy0ZCUxneeS_3uEkNQX2EXWljHQBCAnJCybMPkM25UUhp_brSsVnVa1iy0D_HcPYYrXnhi29xC8b7Wphtz3JAPApQPwU3qHhZnAe__3z2_3VWpWcIlMTT1VqhDPMh0u7AKUW-kLIUJxj",
    radius: 999,
    tall: false,
  },
  {
    title: "Footwear",
    slug: "footwear",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuC_ZEOpSUZdRdxnxy7DmSoRotyd83XjkG4SdZEddbxvDjCn6BbJyPBzPhfnpOn1Aro95dSf9EobnhJo_GQ4meXBA6iAl_Au_qlnSbcpDwvyuotdtCYaVvAtp-yrnSYCN0E7hKFClNtNS2aFdH_YrjexP5MQjshIE0Rurenh2s_Zf-ezMso_tnuUCNFwPzkdmB0uJpy8D61Hp4OhC1d0buPML5Kru9aFqwgmD3aouXIUBcm6dbrYcfKkV3PcGSi86miRJleKMn3Ia9Tr",
    radius: 32,
    tall: true,
  },
];

const CURATIONS = [
  {
    title: "Summer Noir",
    subtitle: "A moody, high-contrast exploration of avant-garde summer silhouettes.",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCGzkKWtfUVHtZiFNaOR7r53JK7PrJ1PbLiR_s7cpkeKNetduT5hDeIrOm1CJ5m-Yf9uJ0Czv-LtnidaQO5Kiuwc8kCiFDWphEO_G06vXI5kJc-FWuy1dwYX7UO-D2Va5OMMj_sz7wuvONCavMJFszrRTTHFqn38pMoQs75DD80Kvuap5D-kkSYgBHMQeyG8fNXDIpKCt9R5PQsKhHoGeuXf3SycBSQSU3er-jGxWW7hWjfSBc4_eQR0tdDVc9pP2GQuIpSE67yaaO1",
    query: "Summer Noir",
    aspect: 16 / 10,
    radius: 40,
  },
  {
    title: "Minimalist Workwear",
    subtitle: "Structured, high-end professional attire.",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuC6OuRkMcM1sC8Nuo0c1eipT-BKbIEd-dAJ48yzHkQrQCzgeviOdcqMNsBOzhvcoqAKjyCZtCSV3zBPawL2Q2iEAZrPoiWHLevOlltq4Bas839Iy1iG6_jHRCEBr_x6h54odTPLLwsz_B6NNgisH0nFRVd7YEBcgaxjqfrdE5pKxiQrMjKbhP-Cc9ZFKj03m56nV2ZI2Tnr307V4a1WPr7nf2tCR5m62sHSk7-0s48PdprbL9adL2wkxlA6jo66JRWQI2Lp49_FjRlo",
    query: "Minimalist Workwear",
    aspect: 4 / 3,
    radius: 28,
  },
];

const TRENDING = [
  { label: "Silk Slips", delta: 124 },
  { label: "Oversized Blazers", delta: 89 },
  { label: "Chunky Loafers", delta: 65 },
  { label: "Linen Sets", delta: 52 },
];

type CategoryItem = (typeof DEFAULT_CATEGORIES)[number] & { index: number };

interface SearchOrbitDiscoveryProps {
  onSearch: (term: string) => void;
}

function TrendingSection({ onSearch }: { onSearch: (term: string) => void }) {
  return (
    <View style={styles.trendingPanel}>
      <Text style={styles.trendingWatermark}>TRENDING</Text>
      <View style={styles.trendingHeader}>
        <View>
          <Text style={styles.trendingKicker}>ON THE RADAR</Text>
          <Text style={styles.trendingTitle}>What's rising now</Text>
        </View>
        <View style={styles.trendingPulse}>
          <View style={styles.trendingDot} />
          <Text style={styles.trendingLive}>LIVE</Text>
        </View>
      </View>

      {TRENDING.map((item, i) => (
        <TouchableOpacity
          key={item.label}
          style={[styles.trendingRow, i === TRENDING.length - 1 && styles.trendingRowLast]}
          activeOpacity={0.8}
          onPress={() => onSearch(item.label)}
        >
          <Text style={styles.trendingRank}>{String(i + 1).padStart(2, "0")}</Text>
          <Text style={styles.trendingLabel}>{item.label}</Text>
          <View style={styles.trendingMeta}>
            <Ionicons name="trending-up" size={13} color={INK} />
            <Text style={styles.trendingDelta}>+{item.delta}%</Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function CategoryCard({
  item,
  onPress,
}: {
  item: CategoryItem;
  onPress: () => void;
}) {
  const innerRadius = Math.max(item.radius - 6, 16);
  const height = item.tall ? COL_WIDTH * 1.42 : COL_WIDTH * 1.05;

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={onPress}
      style={[
        styles.categoryCard,
        {
          width: COL_WIDTH,
          height,
          borderRadius: item.radius,
        },
      ]}
    >
      <Image
        source={{ uri: item.image }}
        style={[styles.categoryImage, { borderRadius: innerRadius }]}
        contentFit="cover"
      />
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.15)", "rgba(0,0,0,0.72)"]}
        locations={[0, 0.45, 1]}
        style={[styles.categoryGradient, { borderRadius: innerRadius }]}
      />
      <View style={styles.categoryIndex}>
        <Text style={styles.categoryIndexText}>{String(item.index).padStart(2, "0")}</Text>
      </View>
      <View style={styles.categoryFooter}>
        <Text style={styles.categoryTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <View style={styles.categoryArrow}>
          <Ionicons name="arrow-forward" size={14} color={INK} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

function CategoriesSection({
  items,
  onOpen,
}: {
  items: CategoryItem[];
  onOpen: (slug: string) => void;
}) {
  const leftCol = items.filter((_, i) => i % 2 === 0);
  const rightCol = items.filter((_, i) => i % 2 === 1);

  return (
    <View style={styles.categoriesSection}>
      <View style={styles.categoriesHeader}>
        <View>
          <Text style={styles.categoriesKicker}>THE ORBIT</Text>
          <Text style={styles.categoriesTitle}>Categories</Text>
        </View>
        <Text style={styles.categoriesCount}>{String(items.length).padStart(2, "0")} edits</Text>
      </View>

      <View style={styles.categoryGrid}>
        <View style={styles.categoryColumn}>
          {leftCol.map((item) => (
            <CategoryCard key={item.slug} item={item} onPress={() => onOpen(item.slug)} />
          ))}
        </View>
        <View style={[styles.categoryColumn, styles.categoryColumnOffset]}>
          {rightCol.map((item) => (
            <CategoryCard key={item.slug} item={item} onPress={() => onOpen(item.slug)} />
          ))}
        </View>
      </View>
    </View>
  );
}

export function SearchOrbitDiscovery({ onSearch }: SearchOrbitDiscoveryProps) {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    api.getCategories(8).then((res) => {
      if (res.ok) setCategories(res.data);
    });
  }, []);

  const categoryItems = useMemo<CategoryItem[]>(() => {
    const source = categories.length
      ? categories.slice(0, 4).map((cat, index) => {
          const fallback = DEFAULT_CATEGORIES[index % DEFAULT_CATEGORIES.length];
          return {
            ...fallback,
            title: cat.name,
            slug: cat.slug,
            image: cat.image_url || fallback.image,
          };
        })
      : DEFAULT_CATEGORIES;

    return source.map((item, index) => ({ ...item, index: index + 1 }));
  }, [categories]);

  const openCategory = (slug: string) => {
    router.push(`/(main)/products?category=${slug}`);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.content}>
        <TrendingSection onSearch={onSearch} />
        <CategoriesSection items={categoryItems} onOpen={openCategory} />

        <View style={styles.curationsCol}>
          <View style={styles.curationsHeader}>
            <Text style={styles.curationsTitle}>Curations</Text>
            <Text style={styles.curationsVol}>Vol. IV</Text>
          </View>

          {CURATIONS.map((item) => (
            <TouchableOpacity
              key={item.title}
              style={styles.curationCard}
              activeOpacity={0.9}
              onPress={() => onSearch(item.query)}
            >
              <View style={[styles.curationImageWrap, { aspectRatio: item.aspect, borderRadius: item.radius }]}>
                <Image source={{ uri: item.image }} style={styles.curationImage} contentFit="cover" />
              </View>
              <View style={styles.curationCopy}>
                <View style={styles.curationText}>
                  <Text style={styles.curationName}>{item.title}</Text>
                  <Text style={styles.curationSub}>{item.subtitle}</Text>
                </View>
                <View style={styles.curationArrow}>
                  <Ionicons name="arrow-forward" size={16} color={INK} style={{ transform: [{ rotate: "-45deg" }] }} />
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

const glass = {
  backgroundColor: "rgba(255, 255, 255, 0.42)",
  borderWidth: 1,
  borderColor: "rgba(255, 255, 255, 0.55)",
  ...shadows.editorial,
};

const styles = StyleSheet.create({
  wrap: {
    paddingBottom: spacing[12],
  },
  content: {
    paddingHorizontal: GUTTER,
    gap: spacing[8],
  },

  /* Trending */
  trendingPanel: {
    ...glass,
    borderRadius: 36,
    padding: spacing[5],
    overflow: "hidden",
  },
  trendingWatermark: {
    position: "absolute",
    right: -6,
    top: 28,
    fontFamily: fontFamilies.display.semibold,
    fontSize: 48,
    color: "rgba(27, 28, 28, 0.06)",
    letterSpacing: 3,
    transform: [{ rotate: "90deg" }],
  },
  trendingHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: spacing[5],
  },
  trendingKicker: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 10,
    color: MUTED,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  trendingTitle: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 24,
    color: INK,
    letterSpacing: -0.3,
  },
  trendingPulse: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(27, 28, 28, 0.06)",
    borderRadius: radii.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  trendingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: INK,
  },
  trendingLive: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 9,
    color: INK,
    letterSpacing: 1.2,
  },
  trendingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: "rgba(27, 28, 28, 0.08)",
    paddingBottom: spacing[3],
    marginBottom: spacing[3],
  },
  trendingRowLast: {
    borderBottomWidth: 0,
    marginBottom: 0,
    paddingBottom: 0,
  },
  trendingRank: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 14,
    color: "rgba(27, 28, 28, 0.2)",
    width: 24,
  },
  trendingLabel: {
    flex: 1,
    fontFamily: fontFamilies.display.regular,
    fontSize: 20,
    color: INK,
  },
  trendingMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.55)",
    borderRadius: radii.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
  },
  trendingDelta: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 10,
    color: INK,
    letterSpacing: 0.4,
  },

  /* Categories */
  categoriesSection: {
    gap: spacing[4],
  },
  categoriesHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  categoriesKicker: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 10,
    color: MUTED,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  categoriesTitle: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 32,
    color: INK,
    letterSpacing: -0.5,
    lineHeight: 34,
  },
  categoriesCount: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 10,
    color: MUTED,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    paddingBottom: 4,
  },
  categoryGrid: {
    flexDirection: "row",
    gap: GRID_GAP,
  },
  categoryColumn: {
    flex: 1,
    gap: GRID_GAP,
  },
  categoryColumnOffset: {
    marginTop: spacing[6],
  },
  categoryCard: {
    overflow: "hidden",
    padding: 6,
    ...glass,
  },
  categoryImage: {
    ...StyleSheet.absoluteFillObject,
    top: 6,
    left: 6,
    right: 6,
    bottom: 6,
  },
  categoryGradient: {
    position: "absolute",
    top: 6,
    left: 6,
    right: 6,
    bottom: 6,
  },
  categoryIndex: {
    position: "absolute",
    top: 18,
    left: 18,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    borderRadius: radii.full,
    minWidth: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  categoryIndexText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 10,
    color: "#ffffff",
    letterSpacing: 0.8,
  },
  categoryFooter: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 14,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 8,
  },
  categoryTitle: {
    flex: 1,
    fontFamily: fontFamilies.display.regular,
    fontSize: 20,
    color: "#ffffff",
    fontStyle: "italic",
    lineHeight: 24,
  },
  categoryArrow: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.88)",
    alignItems: "center",
    justifyContent: "center",
  },

  /* Curations */
  curationsCol: {
    gap: spacing[5],
  },
  curationsHeader: {
    ...glass,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing[3],
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
    borderRadius: radii.full,
  },
  curationsTitle: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 32,
    color: INK,
    lineHeight: 34,
  },
  curationsVol: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 10,
    color: MUTED,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(94, 94, 93, 0.3)",
    paddingBottom: 2,
  },
  curationCard: {
    ...glass,
    borderRadius: 44,
    padding: spacing[4],
  },
  curationImageWrap: {
    width: "100%",
    overflow: "hidden",
    marginBottom: spacing[4],
  },
  curationImage: {
    width: "100%",
    height: "100%",
  },
  curationCopy: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing[3],
    paddingHorizontal: spacing[1],
  },
  curationText: {
    flex: 1,
    gap: 4,
  },
  curationName: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 26,
    color: INK,
  },
  curationSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 14,
    color: MUTED,
    lineHeight: 20,
  },
  curationArrow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(27, 28, 28, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
});
