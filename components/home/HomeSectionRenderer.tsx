import React from "react";
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Display, Label, Body } from "@/components/ui/Typography";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import { HeroCarousel } from "./sections/HeroCarousel";
import { MarqueeStrip } from "./sections/MarqueeStrip";
import { PinnedDrop } from "./sections/PinnedDrop";
import { TodaysEdit } from "./sections/TodaysEdit";
import { CategoriesBento } from "./sections/CategoriesBento";
import { EditorialRail } from "./sections/EditorialRail";
import { ParallaxGrid } from "./sections/ParallaxGrid";
import { PinnedAteliers } from "./sections/PinnedAteliers";
import { FeaturedStores } from "./sections/FeaturedStores";
import { NowLive } from "./sections/NowLive";
import { Letters } from "./sections/Letters";
import { Manifesto } from "./sections/Manifesto";
import { JournalPreview } from "./sections/JournalPreview";
import { NewsletterBand } from "./sections/NewsletterBand";
import { PromisesStrip } from "./sections/PromisesStrip";
import type {
  HomepageSection,
  Product,
  Category,
  Brand,
  Store,
  Banner,
  BlogPost,
  HomepagePromise,
  Testimonial,
  Tenet,
  HeroMeta,
} from "@/lib/types";

export interface HomeData {
  banners: Banner[];
  secondaryBanners: Banner[];
  categories: Category[];
  brands: Brand[];
  stores: Store[];
  todaysEdit: Product[];
  trending: Product[];
  newArrivals: Product[];
  editorsPicks: Product[];
  parallaxGrid: Product[];
  flashSaleProducts: Product[];
  blogPosts: BlogPost[];
  promises: HomepagePromise[];
  testimonials: Testimonial[];
  tenets: Tenet[];
  heroMeta: HeroMeta | null;
  flashEndsAt: string;
}

interface HomeSectionRendererProps {
  section: HomepageSection;
  data: HomeData;
}

export function HomeSectionRenderer({ section, data }: HomeSectionRendererProps) {
  const { kicker, title, subtitle } = section;
  const router = useRouter();

  switch (section.slug) {
    case "hero":
      return <HeroCarousel banners={data.banners} />;
    case "home_secondary":
      return data.secondaryBanners.length ? (
        <SecondaryBannerStrip banners={data.secondaryBanners} kicker={kicker} title={title} />
      ) : null;
    case "marquee":
      return <MarqueeStrip />;
    case "pinned_drop":
      return data.flashSaleProducts.length ? (
        <PinnedDrop products={data.flashSaleProducts} endsAt={data.flashEndsAt} />
      ) : null;
    case "todays_edit":
      return data.todaysEdit.length ? (
        <TodaysEdit
          products={data.todaysEdit}
          kicker={kicker ?? undefined}
          title={title ?? undefined}
          subtitle={subtitle ?? undefined}
          onSeeAll={() => router.push("/(main)/products")}
        />
      ) : null;
    case "categories":
      return data.categories.length ? <CategoriesBento categories={data.categories} /> : null;
    case "trending_rail":
      return data.trending.length ? (
        <EditorialRail
          products={data.trending}
          number="04"
          kicker={kicker ?? "What's moving"}
          title={title ?? "Trending this week"}
          subtitle={subtitle ?? "The five pieces our community has been opening twice a day."}
          href="/(main)/products?sort=rating"
        />
      ) : null;
    case "pinned_ateliers":
      return data.brands.length ? (
        <PinnedAteliers
          brands={data.brands}
          kicker={kicker ?? undefined}
          subtitle={subtitle ?? undefined}
          onSeeAll={() => router.push("/(main)/products")}
        />
      ) : null;
    case "parallax_grid":
      return data.parallaxGrid.length ? (
        <ParallaxGrid
          products={data.parallaxGrid}
          kicker={kicker ?? undefined}
          title={title ?? undefined}
          subtitle={subtitle ?? undefined}
        />
      ) : null;
    case "now_live":
      return <NowLive />;
    case "featured_stores":
      return data.stores.length ? (
        <FeaturedStores stores={data.stores} kicker={kicker ?? undefined} title={title ?? undefined} subtitle={subtitle ?? undefined} />
      ) : null;
    case "letters":
      return (
        <Letters
          letters={data.testimonials}
          kicker={kicker ?? undefined}
          title={title ?? undefined}
          subtitle={subtitle ?? undefined}
        />
      );
    case "manifesto":
      return (
        <Manifesto
          tenets={data.tenets}
          kicker={kicker ?? undefined}
          title={title ?? undefined}
          subtitle={subtitle ?? undefined}
        />
      );
    case "new_arrivals_rail":
      return data.newArrivals.length ? (
        <EditorialRail
          products={data.newArrivals}
          number="08"
          kicker={kicker ?? "Fresh on shelf"}
          title={title ?? "New arrivals"}
          subtitle={subtitle ?? "Pieces that landed in the last seven days. Most won't outlast the month."}
          href="/(main)/products?sort=newest"
        />
      ) : null;
    case "editors_picks_rail":
      return data.editorsPicks.length ? (
        <EditorialRail
          products={data.editorsPicks}
          number="09"
          kicker={kicker ?? "Editor's hand"}
          title={title ?? "The picks"}
          subtitle={subtitle ?? "A short list, chosen the way you'd choose a gift — slowly, and with a person in mind."}
          href="/(main)/products"
        />
      ) : null;
    case "journal":
      return data.blogPosts.length ? (
        <JournalPreview
          posts={data.blogPosts}
          kicker={kicker ?? undefined}
          title={title ?? undefined}
          onSeeAll={() => router.push("/(main)/blog")}
        />
      ) : null;
    case "newsletter":
      return <NewsletterBand />;
    case "promises":
      return data.promises.length ? (
        <PromisesStrip items={data.promises} kicker={kicker ?? undefined} subtitle={subtitle ?? undefined} />
      ) : null;
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/* Secondary banner strip — admin-curated row of campaign banners.   */
/* ------------------------------------------------------------------ */

function SecondaryBannerStrip({
  banners,
  kicker,
  title,
}: {
  banners: Banner[];
  kicker?: string;
  title?: string;
}) {
  const router = useRouter();
  if (!banners?.length) return null;
  return (
    <View style={styles.secondaryWrap}>
      <View style={styles.secondaryHeader}>
        <View style={styles.secondaryHeaderLeft}>
          {kicker ? (
            <View style={styles.secondaryKickerRow}>
              <View style={styles.secondaryRule} />
              <Label style={styles.secondaryKickerText}>{kicker}</Label>
            </View>
          ) : null}
          {title ? (
            <Display size="2xl" style={styles.secondaryTitle} numberOfLines={2}>
              {title}
            </Display>
          ) : null}
        </View>
      </View>
      <FlatList
        data={banners}
        horizontal
        keyExtractor={(b) => b.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.secondaryScroll}
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => item.link && router.push(item.link as never)}
            style={[
              styles.secondaryCard,
              item.bg_color ? { backgroundColor: item.bg_color } : null,
            ]}
          >
            {item.image_url ? (
              <Image source={{ uri: item.image_url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={400} />
            ) : null}
            <View style={styles.secondaryGradient} />
            {item.cta_text ? (
              <View style={styles.secondaryCorner}>
                <Label style={styles.secondaryCornerText}>{item.position}</Label>
              </View>
            ) : null}
            <View style={styles.secondaryBottom}>
              <Display size="lg" style={styles.secondaryCardTitle} numberOfLines={2}>
                {item.title}
              </Display>
              {item.subtitle ? (
                <Body size="xs" style={styles.secondaryCardSub} numberOfLines={2}>
                  {item.subtitle}
                </Body>
              ) : null}
              {item.cta_text ? (
                <View
                  style={[
                    styles.secondaryCta,
                    item.accent_color ? { backgroundColor: item.accent_color } : null,
                  ]}
                >
                  <Label style={styles.secondaryCtaText}>{item.cta_text}</Label>
                  <Ionicons name="arrow-up" size={11} color={colors.olive[950]} />
                </View>
              ) : null}
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Secondary banner
  secondaryWrap: { paddingTop: spacing[8], paddingBottom: spacing[6] },
  secondaryHeader: { paddingHorizontal: 20, marginBottom: spacing[4] },
  secondaryHeaderLeft: { gap: 4 },
  secondaryKickerRow: { flexDirection: "row", alignItems: "center", gap: spacing[2] },
  secondaryRule: { width: 24, height: 1, backgroundColor: colors.light.primary },
  secondaryKickerText: { color: colors.light.primary },
  secondaryTitle: { color: colors.light.foreground, lineHeight: 28 },
  secondaryScroll: { paddingHorizontal: 20, gap: spacing[3] },
  secondaryCard: {
    width: 280,
    height: 180,
    borderRadius: radii.xl,
    overflow: "hidden",
    backgroundColor: colors.olive[100],
    position: "relative",
  },
  secondaryGradient: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.30)" },
  secondaryCorner: {
    position: "absolute",
    top: spacing[3],
    right: spacing[3],
    backgroundColor: "rgba(22, 26, 10, 0.45)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  secondaryCornerText: { color: "rgba(245, 244, 239, 0.9)", fontSize: 9 },
  secondaryBottom: { position: "absolute", left: spacing[4], right: spacing[4], bottom: spacing[3], gap: 4 },
  secondaryCardTitle: { color: colors.paper.cream, fontSize: 18, lineHeight: 22 },
  secondaryCardSub: { color: "rgba(245, 244, 239, 0.85)" },
  secondaryCta: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(250, 248, 241, 0.95)",
    marginTop: 4,
  },
  secondaryCtaText: { color: colors.olive[950], fontSize: 10 },
});
