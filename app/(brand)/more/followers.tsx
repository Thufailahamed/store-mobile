import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { BrandScreenHeader } from "@/components/brand/BrandScreenHeader";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { getBrandFollowers } from "@/lib/api";
import type { BrandFollower } from "@/lib/api/backend";
import { colors, typography, radii } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

export default function BrandFollowers() {
  const q = useQuery({
    queryKey: ["brand-followers"],
    queryFn: async () => {
      const r = await getBrandFollowers();
      return r.ok ? r.data : [];
    },
  });

  return (
    <View style={styles.root}>
      <BrandScreenHeader
        eyebrow="Brand HQ"
        title="Followers"
        subtitle={`${q.data?.length ?? 0} total`}
        back={{ onPress: () => router.back() }}
      />
      {q.isLoading ? (
        <View style={styles.grid}>
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} style={styles.skel} />)}
        </View>
      ) : !q.data || q.data.length === 0 ? (
        <EmptyState icon="people-outline" title="No followers yet" />
      ) : (
        <ScrollView contentContainerStyle={styles.grid}>
          {q.data.map((f) => <FollowerCard key={f.id} follower={f} />)}
        </ScrollView>
      )}
    </View>
  );
}

function FollowerCard({ follower }: { follower: BrandFollower }) {
  const name = follower.user?.full_name ?? follower.user?.email ?? "Anonymous";
  const initial = name.charAt(0).toUpperCase();
  return (
    <Card style={styles.card}>
      <View style={styles.cardRow}>
        <Avatar name={name} size={40} />
        <View style={styles.cardText}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          <Text style={styles.date}>Joined {new Date(follower.created_at).toLocaleDateString()}</Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.light.background },
  grid: { padding: 12, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  skel: { height: 90, width: "47%", borderRadius: radii.xl },
  card: { width: "47%", padding: 12, gap: 8 },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  cardText: { flex: 1 },
  name: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.sm, color: colors.light.foreground },
  date: { fontFamily: fontFamilies.mono.regular, fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground },
});
