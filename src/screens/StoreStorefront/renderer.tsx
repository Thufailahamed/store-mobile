import React, { useEffect } from "react";
import { ScrollView, StyleSheet, View, Text } from "react-native";
import type { StorefrontConfig, StorefrontSection } from "@luxe/store-storefront";
import { emitStorefrontView } from "@luxe/store-storefront";
import { makeSectionRenderer } from "./sections/_shared";

interface Props {
  config: StorefrontConfig;
  slug: string;
  sessionId: string;
  products: { id: string }[];
  storeId?: string | null;
  storeName: string;
}

export function MobileRenderer({ config, slug, sessionId, products, storeId, storeName }: Props) {
  useEffect(() => {
    void emitStorefrontView({
      slug,
      channel: "app",
      sessionId,
      storeId: storeId ?? undefined,
    });
  }, [slug, sessionId, storeId]);

  const productsById = new Map(products.map((p) => [p.id, p]));
  const sections = makeSectionRenderer({
    productsById,
    storeId: storeId ?? null,
    storeName,
    allProducts: products,
  });
  const sorted = [...config.sections].sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0),
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: config.theme.backgroundColor }]}
      contentContainerStyle={styles.content}
    >
      {sorted.map((section) => (
        <SectionDispatch key={section.id} section={section} sections={sections} />
      ))}
      <View style={{ height: 80 }} />
    </ScrollView>
  );
}

type SectionMap = ReturnType<typeof makeSectionRenderer>;

function SectionDispatch({
  section,
  sections,
}: {
  section: StorefrontSection;
  sections: SectionMap;
}) {
  switch (section.type) {
    case "app_header":
      return <sections.AppHeader section={section as never} />;
    case "app_hero":
      return <sections.AppHero section={section as never} />;
    case "brand_story":
      return <sections.BrandStory section={section as never} />;
    case "promo_banner":
      return <sections.PromoBanner section={section as never} />;
    case "product_carousel":
      return <sections.ProductCarousel section={section as never} />;
    case "product_grid":
      return <sections.ProductGrid section={section as never} />;
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: 24 },
});

export const __rendererScaffold = ({ config, slug }: { config: StorefrontConfig; slug: string }) => (
  <View style={{ padding: 16 }}>
    <Text>Mobile storefront for {slug}</Text>
    <Text>{config.sections.length} sections</Text>
  </View>
);