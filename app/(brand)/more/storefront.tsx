import React from "react";
import { View, Text, ScrollView, StyleSheet, Linking } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { BrandScreenHeader } from "@/components/brand/BrandScreenHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Ionicons } from "@/components/ui/Icon";
import { getBrandByOwner } from "@/lib/api";
import { colors, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

export default function BrandStorefront() {
  const q = useQuery({
    queryKey: ["brand-me"],
    queryFn: async () => {
      const r = await getBrandByOwner("ignored");
      return r.ok ? r.data : null;
    },
  });

  const slug = (q.data as { slug?: string } | null)?.slug;
  const url = slug ? `https://luxe.example/brands/${slug}` : null;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <BrandScreenHeader
        eyebrow="Brand HQ"
        title="Storefront"
        subtitle="Your public brand page"
        back={{ onPress: () => router.back() }}
      />
      {q.isLoading ? (
        <Skeleton style={styles.skel} />
      ) : !q.data ? (
        <EmptyState icon="globe-outline" title="Brand not found" />
      ) : (
        <Card style={styles.card}>
          <View style={styles.row}>
            <Ionicons name="globe-outline" size={32} color={colors.light.primary} />
            <View style={styles.cardText}>
              <Text style={styles.title}>{(q.data as { name?: string }).name}</Text>
              <Text style={styles.subtitle}>{url ?? "Set up your slug to share"}</Text>
            </View>
          </View>
          <Button
            variant="default"
            onPress={() => { if (url) Linking.openURL(url); }}
            disabled={!url}
            style={styles.btn}
          >
            {url ? "Open public page" : "Set up slug on web"}
          </Button>
          <Text style={styles.note}>
            Refresh the page on web to see updates. Mobile preview will land in a future release.
          </Text>
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.light.background },
  content: { paddingBottom: 32 },
  skel: { height: 160, margin: 20, borderRadius: 16 },
  card: { margin: 20, padding: 16, gap: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  cardText: { flex: 1 },
  title: { fontFamily: fontFamilies.display.semibold, fontSize: typography.fontSizes.lg, color: colors.light.foreground },
  subtitle: { fontFamily: fontFamilies.mono.regular, fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground, marginTop: 2 },
  btn: { marginTop: 8 },
  note: { fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground, lineHeight: 16 },
});
