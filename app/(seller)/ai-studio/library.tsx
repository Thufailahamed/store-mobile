import React from "react";
import { View, Text, FlatList, Image, StyleSheet, Dimensions } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { getAiLibraryBackend } from "@/lib/api/backend";
import { colors, radii, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

const COLS = 2;
const GAP = spacing[2];
const SCREEN = Dimensions.get("window").width;
const TILE = (SCREEN - GAP * (COLS + 1)) / COLS;

export default function LibraryScreen() {
  const { data, isLoading } = useQuery({
    queryKey: ["ai-library", { limit: 60 }],
    queryFn: () => getAiLibraryBackend({ limit: 60 }),
  });

  return (
    <View style={styles.container}>
      {isLoading ? <Text style={styles.empty}>Loading…</Text> : null}
      <FlatList
        data={data?.ok ? data.data.items : []}
        keyExtractor={(it) => it.id}
        numColumns={COLS}
        columnWrapperStyle={{ gap: GAP, paddingHorizontal: GAP }}
        contentContainerStyle={{ gap: GAP, paddingVertical: GAP }}
        renderItem={({ item }) => (
          <View style={[styles.tile, { width: TILE, height: TILE }]}>
            <Image source={{ uri: item.thumbnailUrl ?? item.url }} style={styles.image} accessibilityLabel={item.prompt} />
          </View>
        )}
        ListEmptyComponent={!isLoading ? <Text style={styles.empty}>No saved images.</Text> : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  tile: { borderRadius: radii.md, overflow: "hidden", backgroundColor: colors.light.muted },
  image: { width: "100%", height: "100%" },
  empty: { fontFamily: fontFamilies.sans.regular, fontSize: typography.fontSizes.sm, color: colors.light.mutedForeground, textAlign: "center", padding: spacing[8] },
});
