import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@/components/ui/Icon";
import { Body, Display, Label } from "@/components/ui/Typography";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ProductCard } from "@/components/product/ProductCard";
import { BrandHero } from "@/components/brand/BrandHero";
import { useToast } from "@/components/ui/Toast";
import {
  getBrandBySlug,
  getBrandProducts,
  isFollowingBrand,
  followBrand,
  unfollowBrand,
} from "@/lib/api";
import { useAuth } from "@/lib/supabase/auth";
import { useTrackEvent } from "@/lib/recommender";
import type { Brand, Product } from "@/lib/types";
import { colors, radii, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

export default function BrandDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { slug } = useLocalSearchParams<{ slug?: string }>();
  const slugKey = useMemo(() => (Array.isArray(slug) ? slug[0] : slug) ?? "", [slug]);
  const { user } = useAuth();
  const { toast } = useToast();
  const tracker = useTrackEvent();

  const [brand, setBrand] = useState<Brand | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [following, setFollowing] = useState(false);
  const [pendingFollow, setPendingFollow] = useState(false);

  useEffect(() => {
    tracker.screen("brand_detail", { slug: slugKey });
  }, [tracker, slugKey]);

  const load = useCallback(async () => {
    if (!slugKey) return;
    setLoading(true);
    const r = await getBrandBySlug(slugKey);
    if (r.ok && r.data) {
      setBrand(r.data);
      tracker.action("brand_view", { brandSlug: slugKey, brandId: r.data.id });
      const [prods, follow] = await Promise.all([
        getBrandProducts(r.data.id, { limit: 24 }),
        user ? isFollowingBrand(r.data.id) : Promise.resolve({ ok: true, data: false } as never),
      ]);
      if (prods.ok) setProducts(prods.data.products);
      if (follow.ok) setFollowing(follow.data);
    } else {
      setBrand(null);
    }
    setLoading(false);
    setRefreshing(false);
  }, [slugKey, user, tracker]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const onToggleFollow = useCallback(async () => {
    if (!brand) return;
    if (!user) {
      toast("Sign in required to follow brands");
      return;
    }
    setPendingFollow(true);
    const optimistic = !following;
    setFollowing(optimistic);
    const r = optimistic ? await followBrand(brand.id) : await unfollowBrand(brand.id);
    if (!r.ok) {
      setFollowing(!optimistic);
      toast(`Couldn't update follow: ${r.error}`);
    } else {
      toast(optimistic ? `Following ${brand.name}` : `Unfollowed ${brand.name}`);
    }
    setPendingFollow(false);
  }, [brand, following, user, toast]);

  const onShare = useCallback(async () => {
    if (!brand) return;
    try {
      await Share.share({ message: `Check out ${brand.name} on LUXE` });
    } catch {
      // ignore user-cancel
    }
  }, [brand]);

  if (loading && !brand) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: true, title: "Brand" }} />
        <View style={{ padding: spacing[4] }}>
          <Skeleton height={180} style={{ marginBottom: spacing[3] }} />
          <Skeleton height={24} width="60%" style={{ marginBottom: spacing[2] }} />
          <Skeleton height={14} width="80%" />
        </View>
      </View>
    );
  }

  if (!brand) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: true, title: "Not found" }} />
        <View style={styles.notFound}>
          <Ionicons name="alert-circle-outline" size={32} color={colors.light.mutedForeground} />
          <Display size="md" style={styles.notFoundTitle}>
            Brand not found
          </Display>
          <Body muted size="sm" style={styles.notFoundCopy}>
            This brand may have been removed or is not yet approved.
          </Body>
          <Button onPress={() => router.back()}>
            <Label style={{ color: colors.light.primaryForeground, fontFamily: fontFamilies.sans.semibold }}>
              Go back
            </Label>
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: brand.name,
          headerRight: () => (
            <TouchableOpacity onPress={onShare} hitSlop={8}>
              <Ionicons name="share-outline" size={20} color={colors.light.foreground} />
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <BrandHero brand={brand} />

        <View style={styles.identity}>
          <View style={styles.identityHeader}>
            <Display size="lg" style={styles.name} numberOfLines={2}>
              {brand.name}
            </Display>
            <Button
              variant={following ? "outline" : "default"}
              size="sm"
              onPress={onToggleFollow}
              loading={pendingFollow}
            >
              <Label
                style={{
                  color: following ? colors.light.foreground : colors.light.primaryForeground,
                  fontFamily: fontFamilies.sans.semibold,
                }}
              >
                {following ? "Following" : "Follow"}
              </Label>
            </Button>
          </View>
          {brand.tagline ? (
            <Body size="sm" style={styles.tagline}>
              {brand.tagline}
            </Body>
          ) : null}
          {brand.description ? (
            <Body muted size="sm" style={styles.description}>
              {brand.description}
            </Body>
          ) : null}
          <View style={styles.metaRow}>
            {brand.total_products != null && brand.total_products > 0 ? (
              <Label style={styles.metaItem}>
                <Ionicons name="cube-outline" size={11} color={colors.light.mutedForeground} />{" "}
                {brand.total_products} pieces
              </Label>
            ) : null}
            {brand.total_followers != null && brand.total_followers > 0 ? (
              <Label style={styles.metaItem}>
                <Ionicons name="people-outline" size={11} color={colors.light.mutedForeground} />{" "}
                {brand.total_followers.toLocaleString()} followers
              </Label>
            ) : null}
            {brand.rating && brand.rating > 0 ? (
              <Label style={styles.metaItem}>
                <Ionicons name="star" size={11} color={colors.accent2?.ochre ?? "#b58a3c"} /> {brand.rating.toFixed(1)}
              </Label>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <Display size="md" style={styles.sectionTitle}>
            Pieces
          </Display>
          {products.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Ionicons name="cube-outline" size={28} color={colors.light.mutedForeground} />
              <Display size="md" style={styles.emptyTitle}>
                No products yet
              </Display>
              <Body muted size="sm" style={styles.emptyCopy}>
                This brand has not listed anything yet — check back soon.
              </Body>
            </View>
          ) : (
            <View style={styles.productGrid}>
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  notFound: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing[3], padding: spacing[6] },
  notFoundTitle: { marginTop: spacing[2] },
  notFoundCopy: { textAlign: "center" },
  identity: { padding: spacing[4], gap: spacing[2] },
  identityHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing[3] },
  name: { flex: 1, fontSize: typography.fontSizes.xl },
  tagline: { fontStyle: "italic" },
  description: { marginTop: spacing[1] },
  metaRow: { flexDirection: "row", gap: spacing[3], marginTop: spacing[2], flexWrap: "wrap" },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4, color: colors.light.mutedForeground },
  section: { paddingHorizontal: spacing[4], paddingTop: spacing[4] },
  sectionTitle: { marginBottom: spacing[2], fontSize: typography.fontSizes.lg },
  productGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing[3] },
  emptyWrap: { alignItems: "center", gap: spacing[2], padding: spacing[8] },
  emptyTitle: { fontSize: typography.fontSizes.lg },
  emptyCopy: { textAlign: "center" },
});