import React, { useEffect, useState, useCallback } from "react";
import { ScrollView, RefreshControl, StyleSheet } from "react-native";
import { AppHeader, PaperBackground } from "@/components/layout";
import { HomeSectionRenderer, type HomeData } from "@/components/home/HomeSectionRenderer";
import { spacing } from "@/lib/theme/tokens";
import * as api from "@/lib/api";
import type { HomepageSection } from "@/lib/types";

const EMPTY_DATA: HomeData = {
  banners: [],
  secondaryBanners: [],
  categories: [],
  brands: [],
  stores: [],
  todaysEdit: [],
  trending: [],
  newArrivals: [],
  editorsPicks: [],
  parallaxGrid: [],
  flashSaleProducts: [],
  blogPosts: [],
  promises: [],
  testimonials: [],
  tenets: [],
  heroMeta: null,
  flashEndsAt: new Date(Date.now() + 6 * 3600_000).toISOString(),
};

const FALLBACK_SECTIONS: HomepageSection[] = [
  { slug: "hero", enabled: true, position: 0, label: "Hero" },
  { slug: "marquee", enabled: true, position: 1, label: "Marquee" },
  { slug: "todays_edit", enabled: true, position: 2, label: "Today's Edit" },
  { slug: "pinned_drop", enabled: true, position: 3, label: "The Drop" },
  { slug: "categories", enabled: true, position: 4, label: "Categories" },
  { slug: "trending_rail", enabled: true, position: 5, label: "Trending" },
  { slug: "pinned_ateliers", enabled: true, position: 6, label: "Ateliers" },
  { slug: "parallax_grid", enabled: true, position: 7, label: "Lookbook" },
  { slug: "now_live", enabled: true, position: 8, label: "Now Live" },
  { slug: "featured_stores", enabled: true, position: 9, label: "Stores" },
  { slug: "letters", enabled: true, position: 10, label: "Letters" },
  { slug: "new_arrivals_rail", enabled: true, position: 11, label: "New Arrivals" },
  { slug: "manifesto", enabled: true, position: 12, label: "Manifesto" },
  { slug: "editors_picks_rail", enabled: true, position: 13, label: "Editor's Picks" },
  { slug: "home_secondary", enabled: true, position: 14, label: "Spotlight" },
  { slug: "journal", enabled: true, position: 15, label: "Journal" },
  { slug: "newsletter", enabled: true, position: 16, label: "Newsletter" },
  { slug: "promises", enabled: true, position: 17, label: "House Rules" },
];

export default function HomeScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [sections, setSections] = useState<HomepageSection[]>([]);
  const [data, setData] = useState<HomeData>(EMPTY_DATA);

  const fetchData = useCallback(async () => {
    const [
      layout,
      banners,
      secondaryBanners,
      categories,
      brands,
      stores,
      todaysEdit,
      trending,
      newArrivals,
      editorsPicks,
      parallaxGrid,
      blogPosts,
      promises,
      flashProducts,
      flashEndsAt,
      testimonials,
      tenets,
      heroMeta,
    ] = await Promise.all([
      api.getHomepageSections(),
      api.getBanners("home_hero"),
      api.getBanners("home_secondary"),
      api.getCategories(10),
      api.getFeaturedBrands(6),
      api.getFeaturedStores(6),
      api.getHomepageProductPicks("todays_edit"),
      api.getHomepageProductPicks("trending_rail"),
      api.getHomepageProductPicks("new_arrivals_rail"),
      api.getHomepageProductPicks("editors_picks_rail"),
      api.getHomepageProductPicks("parallax_grid"),
      api.getFeaturedBlogPosts(3),
      api.getHomepagePromises(),
      api.getFlashSaleProducts(5),
      api.getFlashSaleEndsAt(),
      api.getTestimonials(6),
      api.getTenets(6),
      api.getHeroMeta(),
    ]);

    setSections(layout.ok ? layout.data : FALLBACK_SECTIONS);
    setData({
      banners: banners.ok ? banners.data : [],
      secondaryBanners: secondaryBanners.ok ? secondaryBanners.data : [],
      categories: categories.ok ? categories.data : [],
      brands: brands.ok ? brands.data : [],
      stores: stores.ok ? stores.data : [],
      todaysEdit: todaysEdit.ok ? todaysEdit.data : [],
      trending: trending.ok ? trending.data : [],
      newArrivals: newArrivals.ok ? newArrivals.data : [],
      editorsPicks: editorsPicks.ok ? editorsPicks.data : [],
      parallaxGrid: parallaxGrid.ok ? parallaxGrid.data : [],
      blogPosts: blogPosts.ok ? blogPosts.data : [],
      promises: promises.ok ? promises.data : [],
      flashSaleProducts: flashProducts.ok ? flashProducts.data : [],
      flashEndsAt,
      testimonials: testimonials.ok ? testimonials.data : [],
      tenets: tenets.ok ? tenets.data : [],
      heroMeta: heroMeta.ok ? heroMeta.data : null,
    });
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const visibleSections: HomepageSection[] = sections.length
    ? sections.filter((s) => s.enabled).sort((a, b) => a.position - b.position)
    : FALLBACK_SECTIONS;

  return (
    <PaperBackground>
      <AppHeader />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.scroll}
      >
        {visibleSections.map((section) => (
          <HomeSectionRenderer key={section.slug} section={section} data={data} />
        ))}
      </ScrollView>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing[24] },
});
