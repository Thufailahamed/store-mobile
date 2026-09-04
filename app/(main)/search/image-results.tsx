import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image as RNImage,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PaperBackground, ScreenHeader } from "@/components/layout";
import { expandableTabBarInset } from "@/components/layout/ExpandableTabBar";
import { ProductCard } from "@/components/product/ProductCard";
import { Body } from "@/components/ui/Typography";
import { Button } from "@/components/ui";
import { pickImage, takePhoto } from "@/lib/upload";
import * as api from "@/lib/api";
import type { Product } from "@/lib/types";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

export default function ImageSearchResults() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ url?: string; preview?: string }>();
  const [imageUrl, setImageUrl] = useState(params.url ?? "");
  const [preview, setPreview] = useState(params.preview ?? params.url ?? "");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(!!params.url);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runSearch = useCallback(async (url: string) => {
    setLoading(true);
    setError(null);
    const res = await api.reverseImageSearch(url, 12);
    setLoading(false);
    if (!res.ok) {
      setProducts([]);
      setError(res.error);
      return;
    }
    setProducts(res.data);
  }, []);

  useEffect(() => {
    if (params.url) void runSearch(params.url);
  }, [params.url, runSearch]);

  const capture = async (source: "library" | "camera") => {
    if (busy) return;
    setBusy(true);
    try {
      const picker = source === "camera" ? takePhoto : pickImage;
      const result = await picker({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });
      if (!result || result.canceled) return;
      const uri = result.assets?.[0]?.uri;
      if (!uri) return;
      setPreview(uri);
      const upload = await api.uploadScanImage(uri, source);
      if (!upload.ok) {
        Alert.alert("Upload failed", upload.error);
        return;
      }
      setImageUrl(upload.data.url);
      await runSearch(upload.data.url);
    } finally {
      setBusy(false);
    }
  };

  return (
    <PaperBackground>
      <ScreenHeader title="Image search" />
      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: expandableTabBarInset(insets.bottom) + spacing[6] },
        ]}
        ListHeaderComponent={
          <View style={styles.header}>
            {preview ? (
              <RNImage source={{ uri: preview }} style={styles.preview} accessibilityLabel="Search photo" />
            ) : (
              <View style={styles.previewPlaceholder}>
                <Body muted>Upload a photo to find similar products</Body>
              </View>
            )}
            <View style={styles.actions}>
              <Button variant="outline" onPress={() => void capture("library")} disabled={busy} accessibilityLabel="Pick from library">
                Gallery
              </Button>
              <Button onPress={() => void capture("camera")} disabled={busy} accessibilityLabel="Take a photo">
                Camera
              </Button>
            </View>
            {loading || busy ? <ActivityIndicator accessibilityLabel="Searching catalogue" /> : null}
            {error ? <Body style={styles.error}>{error}</Body> : null}
            {!loading && !busy && imageUrl && products.length === 0 && !error ? (
              <Body muted style={styles.empty}>
                No matches — try a clearer shot.
              </Body>
            ) : null}
            {!loading && products.length > 0 ? (
              <Body muted style={styles.count}>
                {products.length} similar {products.length === 1 ? "product" : "products"}
              </Body>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.cell}>
            <ProductCard product={item} />
          </View>
        )}
        ListEmptyComponent={null}
      />
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing[3] },
  header: { paddingHorizontal: spacing[4], gap: spacing[3], marginBottom: spacing[4] },
  preview: { width: 96, height: 96, borderRadius: radii.md, backgroundColor: colors.light.muted },
  previewPlaceholder: {
    minHeight: 96,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.light.border,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing[4],
    backgroundColor: colors.light.card,
  },
  actions: { flexDirection: "row", gap: spacing[2] },
  error: { color: colors.light.destructive, fontFamily: fontFamilies.sans.regular },
  empty: { textAlign: "center", paddingVertical: spacing[4] },
  count: { fontFamily: fontFamilies.sans.medium },
  row: { paddingHorizontal: spacing[4], gap: spacing[3], marginBottom: spacing[3] },
  cell: { flex: 1 },
});
