import React, { useMemo } from "react";
import { ScrollView, RefreshControl, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppHeader, PaperBackground } from "@/components/layout";
import {
  CategoryScroller,
  PromoCarousel,
  ProductRail,
  FeaturedStoresRow,
  FeaturedBrandsRow,
  HomeJournalRail,
  ForYouRail,
} from "@/components/home/premium";
import { useAuth } from "@/lib/supabase/auth";
import { useWishlist } from "@/lib/stores";
import { useHomeScreenData } from "@/lib/hooks/useHomeScreen";

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const wishlistIdsKey = useWishlist((s) => Object.keys(s.items).sort().join(","));

  const {
    catalog,
    catalogExtended,
    forYou,
    recentlyViewed,
    wishlistRail,
    isRefreshing,
    refreshAll,
    refreshForYou,
  } = useHomeScreenData(user?.id, wishlistIdsKey);

  const catalogData = catalog.data;
  const wishlistRailData = wishlistRail.data ?? { wishlist: [], companions: [] };

  const showForYouRail = useMemo(
    () => (forYou.data?.products?.length ?? 0) > 0 || forYou.isLoading,
    [forYou.data?.products?.length, forYou.isLoading],
  );

  return (
    <PaperBackground>
      <AppHeader showSearch />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing && !catalog.isLoading} onRefresh={refreshAll} />
        }
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 24 },
        ]}
      >
        <CategoryScroller categories={catalogData?.categories ?? []} />
        <PromoCarousel banners={catalogData?.banners ?? []} />

        {showForYouRail ? (
          <ForYouRail
            title={forYou.data?.hasSignal ? "Recommended for you" : "Trending in the Edit"}
            products={forYou.data?.products ?? []}
            hasSignal={forYou.data?.hasSignal ?? false}
            loading={forYou.isLoading}
            onRefresh={() => refreshForYou(user?.id)}
            onSeeAll={() => router.push("/(main)/products?sort=newest")}
          />
        ) : null}

        {wishlistRailData.wishlist.length > 0 ? (
          <>
            <ProductRail
              kicker="From your wishlist"
              title="Saved for you"
              products={wishlistRailData.wishlist}
              showSaleBadge
              onSeeAll={() => router.push("/(main)/wishlist")}
            />
            {wishlistRailData.companions.length > 0 ? (
              <ProductRail
                kicker="Pairs with your saves"
                title="You might also like these"
                products={wishlistRailData.companions}
                showSaleBadge
                onSeeAll={() => router.push("/(main)/products?sort=newest")}
              />
            ) : null}
          </>
        ) : null}

        <ProductRail
          title="On sale"
          products={catalogData?.saleProducts ?? []}
          showSaleBadge
          onSeeAll={() => router.push("/(main)/products?sort=sale")}
        />
        <ProductRail
          title="New arrivals"
          products={catalogData?.newArrivals ?? []}
          showSaleBadge={false}
          onSeeAll={() => router.push("/(main)/products?sort=newest")}
        />
        {(recentlyViewed.data?.length ?? 0) > 0 ? (
          <ProductRail
            kicker="Pick up where you left off"
            title="Recently viewed"
            products={recentlyViewed.data ?? []}
            showSaleBadge={false}
            onSeeAll={() => router.push("/(main)/products?sort=newest")}
          />
        ) : null}
        {catalogExtended.isSuccess || catalogExtended.isFetching ? (
          <>
            <FeaturedStoresRow stores={catalogData?.stores ?? []} />
            <ProductRail
              title="Trending now"
              products={catalogData?.trending ?? []}
              showSaleBadge={false}
              onSeeAll={() => router.push("/(main)/products?sort=rating")}
            />
            <ProductRail
              title="Editor's picks"
              products={catalogData?.editorsPicks ?? []}
              showSaleBadge={false}
              onSeeAll={() => router.push("/(main)/products?sort=price_desc")}
            />
            <ProductRail
              title="Today's edit"
              products={catalogData?.todaysEdit ?? []}
              showSaleBadge={false}
              onSeeAll={() => router.push("/(main)/products?sort=newest")}
            />
            <FeaturedBrandsRow brands={catalogData?.brands ?? []} />
            <HomeJournalRail posts={catalogData?.journalPosts ?? []} />
          </>
        ) : null}
      </ScrollView>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingTop: 4,
  },
});
