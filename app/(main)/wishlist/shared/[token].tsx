import React, { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenHeader } from "@/components/layout";
import { Body, Display, Label } from "@/components/ui/Typography";
import { getSharedWishlistBackend } from "@/lib/api/backend";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import { formatPrice } from "@/lib/utils";

type SharedItem = {
  product_id: string;
  product?: {
    id: string;
    name: string;
    slug: string;
    price: number;
    images?: Array<{ url: string; is_primary?: boolean }>;
  } | null;
};

export default function SharedWishlistScreen() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("Shared wishlist");
  const [items, setItems] = useState<SharedItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) {
        setError("Missing share token");
        setLoading(false);
        return;
      }
      const res = await getSharedWishlistBackend(token);
      if (cancelled) return;
      setLoading(false);
      if (!res.ok) {
        setError(res.error ?? "This wishlist is unavailable");
        return;
      }
      setTitle(res.data.link.title || "A LUXE wishlist");
      setItems(res.data.items ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title="Shared collection" />
      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <Body muted>Loading…</Body>
        ) : error ? (
          <Body muted>{error}</Body>
        ) : (
          <>
            <Label>Shared wishlist</Label>
            <Display size="2xl">{title}</Display>
            <Body muted>
              {items.length} piece{items.length === 1 ? "" : "s"} · read only
            </Body>
            {items.length === 0 ? (
              <Body muted>Nothing saved here yet.</Body>
            ) : (
              items.map((row) => {
                const p = row.product;
                if (!p) return null;
                const img = p.images?.find((i) => i.is_primary)?.url ?? p.images?.[0]?.url;
                return (
                  <Pressable
                    key={p.id}
                    style={styles.card}
                    onPress={() => router.push(`/(main)/products/${p.slug}`)}
                  >
                    {img ? <Image source={{ uri: img }} style={styles.thumb} /> : <View style={styles.thumb} />}
                    <View style={{ flex: 1, gap: 4 }}>
                      <Body numberOfLines={2}>{p.name}</Body>
                      <Label>{formatPrice(p.price)}</Label>
                    </View>
                  </Pressable>
                );
              })
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  content: { padding: spacing[5], gap: spacing[3] },
  card: {
    flexDirection: "row",
    gap: spacing[3],
    padding: spacing[3],
    borderRadius: radii.lg,
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.border,
    alignItems: "center",
  },
  thumb: {
    width: 72,
    height: 88,
    borderRadius: radii.md,
    backgroundColor: colors.light.muted,
  },
});
