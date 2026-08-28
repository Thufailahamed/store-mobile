import React from "react";
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { TemplateCard } from "@/components/storefront-editor/TemplateCard";
import { getStorefrontTemplatesBackend } from "@/lib/api/backend";
import { colors, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

export default function StorefrontIndex() {
  const router = useRouter();
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["storefront-templates"],
    queryFn: getStorefrontTemplatesBackend,
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator accessibilityLabel="Loading templates" />
      </View>
    );
  }

  if (error || !data?.ok) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Failed to load templates.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Choose a template</Text>
      <FlatList
        data={data.data.templates}
        keyExtractor={(t) => t.slug}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
        renderItem={({ item }) => (
          <TemplateCard
            slug={item.slug}
            name={item.name}
            description={item.description}
            onPress={() => router.push(`/(seller)/storefront/${item.slug}/edit?channel=web` as any)}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing[4] },
  heading: { fontFamily: fontFamilies.sans.semibold, fontSize: typography.fontSizes.lg, color: colors.light.foreground, paddingHorizontal: spacing[4], paddingTop: spacing[4] },
  list: { padding: spacing[4] },
  error: { fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.sm, color: colors.light.destructive },
});
