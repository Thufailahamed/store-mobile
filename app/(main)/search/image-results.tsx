import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image as RNImage,
  Text,
  TouchableOpacity,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PaperBackground, ScreenHeader } from "@/components/layout";
import { expandableTabBarInset } from "@/components/layout/ExpandableTabBar";
import { ProductCard } from "@/components/product/ProductCard";
import { Ionicons } from "@/components/ui/Icon";
import { pickImage, takePhoto } from "@/lib/upload";
import * as api from "@/lib/api";
import type { Product } from "@/lib/types";
import { colors, radii, spacing, shadows } from "@/lib/theme/tokens";
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
            {!preview ? (
              /* Hero Dropzone when no image has been selected */
              <View style={styles.heroCard}>
                {/* Viewfinder corner accents */}
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />

                <View style={styles.heroIconWrap}>
                  <Ionicons name="scan-outline" size={26} color={colors.olive[800]} />
                </View>

                <Text style={styles.heroTitle}>Visual Product Search</Text>
                <Text style={styles.heroSubtitle}>
                  Snap a photo or choose an image from your library to discover matching garments, silhouettes, and accessories.
                </Text>

                <View style={styles.heroActionsRow}>
                  <TouchableOpacity
                    style={styles.heroPrimaryBtn}
                    onPress={() => void capture("camera")}
                    disabled={busy}
                    activeOpacity={0.88}
                    accessibilityRole="button"
                    accessibilityLabel="Take a photo with camera"
                  >
                    <Ionicons name="camera" size={17} color={colors.paper.cream} />
                    <Text style={styles.heroPrimaryBtnText}>Take Photo</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.heroSecondaryBtn}
                    onPress={() => void capture("library")}
                    disabled={busy}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel="Choose from photo library"
                  >
                    <Ionicons name="images-outline" size={17} color={colors.light.foreground} />
                    <Text style={styles.heroSecondaryBtnText}>Gallery</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.tipBadge}>
                  <Ionicons name="sparkles" size={12} color={colors.accent2.ochre} />
                  <Text style={styles.tipText}>
                    Clean backgrounds and clear lighting yield the best results
                  </Text>
                </View>
              </View>
            ) : (
              /* Active visual query inspection card */
              <View style={styles.activeQueryCard}>
                <View style={styles.activeThumbWrap}>
                  <RNImage
                    source={{ uri: preview }}
                    style={styles.activeThumb}
                    accessibilityLabel="Search photo"
                  />
                  <View style={styles.activeThumbBadge}>
                    <Ionicons name="scan" size={10} color={colors.paper.cream} />
                    <Text style={styles.activeThumbBadgeText}>SCANNED</Text>
                  </View>
                </View>

                <View style={styles.activeQueryInfo}>
                  <Text style={styles.activeQueryKicker}>VISUAL QUERY</Text>
                  <Text style={styles.activeQueryTitle}>
                    {loading || busy
                      ? "Analyzing visual features…"
                      : products.length > 0
                        ? `${products.length} matching piece${products.length === 1 ? "" : "s"}`
                        : "No close matches"}
                  </Text>

                  {loading || busy ? (
                    <View style={styles.analyzingRow}>
                      <ActivityIndicator size="small" color={colors.olive[800]} />
                      <Text style={styles.analyzingText}>Searching boutique catalogue…</Text>
                    </View>
                  ) : (
                    <View style={styles.retakeRow}>
                      <TouchableOpacity
                        style={styles.retakeBtn}
                        onPress={() => void capture("camera")}
                        disabled={busy}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="camera-outline" size={13} color={colors.olive[800]} />
                        <Text style={styles.retakeBtnText}>Retake</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.retakeBtn}
                        onPress={() => void capture("library")}
                        disabled={busy}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="images-outline" size={13} color={colors.olive[800]} />
                        <Text style={styles.retakeBtnText}>Gallery</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Error Message */}
            {error && (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle-outline" size={16} color={colors.accent2.rust} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Empty state when query ran but 0 items found */}
            {!loading && !busy && imageUrl && products.length === 0 && !error && (
              <View style={styles.emptyCard}>
                <View style={styles.emptyIconWrap}>
                  <Ionicons name="search-outline" size={24} color={colors.olive[800]} />
                </View>
                <Text style={styles.emptyTitle}>No exact visual matches</Text>
                <Text style={styles.emptySubtitle}>
                  We couldn't find close matches for this item. Try cropping closer or shooting with clearer lighting.
                </Text>
                <TouchableOpacity
                  style={styles.emptyRetryBtn}
                  onPress={() => void capture("camera")}
                  activeOpacity={0.88}
                >
                  <Ionicons name="camera" size={15} color={colors.paper.cream} />
                  <Text style={styles.emptyRetryBtnText}>Try Another Photo</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Results Section Title */}
            {!loading && products.length > 0 && (
              <View style={styles.resultsHeader}>
                <View style={styles.resultsHeaderLeft}>
                  <Ionicons name="sparkles-outline" size={14} color={colors.olive[800]} />
                  <Text style={styles.resultsHeaderTitle}>SIMILAR PIECES FOUND</Text>
                </View>
                <View style={styles.resultsCountBadge}>
                  <Text style={styles.resultsCountText}>
                    {products.length} {products.length === 1 ? "item" : "items"}
                  </Text>
                </View>
              </View>
            )}

            {/* How It Works Guide when no image is loaded yet */}
            {!preview && (
              <View style={styles.guideSection}>
                <Text style={styles.guideHeader}>HOW VISUAL SEARCH WORKS</Text>
                <View style={styles.guideStepsRow}>
                  <View style={styles.guideStepCard}>
                    <View style={styles.guideStepBadge}>
                      <Text style={styles.guideStepNumber}>1</Text>
                    </View>
                    <Text style={styles.guideStepTitle}>Capture Item</Text>
                    <Text style={styles.guideStepDesc}>Snap any outfit, garment, or fashion accessory</Text>
                  </View>

                  <View style={styles.guideStepCard}>
                    <View style={styles.guideStepBadge}>
                      <Text style={styles.guideStepNumber}>2</Text>
                    </View>
                    <Text style={styles.guideStepTitle}>Visual Scan</Text>
                    <Text style={styles.guideStepDesc}>AI identifies cut, color, pattern, and texture</Text>
                  </View>

                  <View style={styles.guideStepCard}>
                    <View style={styles.guideStepBadge}>
                      <Text style={styles.guideStepNumber}>3</Text>
                    </View>
                    <Text style={styles.guideStepTitle}>Boutique Match</Text>
                    <Text style={styles.guideStepDesc}>Browse matching and kindred pieces in stock</Text>
                  </View>
                </View>
              </View>
            )}
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
  content: { paddingTop: spacing[2] },
  header: {
    paddingHorizontal: spacing[4],
    gap: spacing[3],
    marginBottom: spacing[3],
  },
  row: {
    paddingHorizontal: spacing[4],
    gap: spacing[3],
    marginBottom: spacing[3],
  },
  cell: { flex: 1 },

  /* Hero Card for uploading */
  heroCard: {
    position: "relative",
    borderRadius: radii["2xl"],
    borderWidth: 1.5,
    borderColor: colors.light.border,
    backgroundColor: colors.paper.DEFAULT,
    padding: spacing[5],
    alignItems: "center",
    ...shadows.soft,
  },
  corner: {
    position: "absolute",
    width: 16,
    height: 16,
    borderColor: colors.olive[600],
  },
  cornerTL: { top: 10, left: 10, borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: 4 },
  cornerTR: { top: 10, right: 10, borderTopWidth: 2, borderRightWidth: 2, borderTopRightRadius: 4 },
  cornerBL: { bottom: 10, left: 10, borderBottomWidth: 2, borderLeftWidth: 2, borderBottomLeftRadius: 4 },
  cornerBR: { bottom: 10, right: 10, borderBottomWidth: 2, borderRightWidth: 2, borderBottomRightRadius: 4 },

  heroIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.olive[100],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing[2],
  },
  heroTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 20,
    color: colors.light.foreground,
    textAlign: "center",
  },
  heroSubtitle: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12.5,
    color: colors.light.mutedForeground,
    textAlign: "center",
    lineHeight: 18,
    marginTop: 4,
    marginBottom: spacing[4],
    paddingHorizontal: spacing[2],
  },
  heroActionsRow: {
    flexDirection: "row",
    gap: spacing[3],
    width: "100%",
    justifyContent: "center",
  },
  heroPrimaryBtn: {
    flex: 1,
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: radii.full,
    backgroundColor: colors.olive[900],
    shadowColor: colors.olive[950],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 5,
    elevation: 3,
  },
  heroPrimaryBtnText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 13.5,
    color: colors.paper.cream,
    letterSpacing: 0.2,
  },
  heroSecondaryBtn: {
    flex: 1,
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: radii.full,
    backgroundColor: colors.paper.warm,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  heroSecondaryBtnText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13.5,
    color: colors.light.foreground,
  },
  tipBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: spacing[4],
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: radii.full,
    backgroundColor: "#FFFDF5",
    borderWidth: 1,
    borderColor: "#F0E4B8",
  },
  tipText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: colors.light.mutedForeground,
  },

  /* Active Query Card */
  activeQueryCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3.5],
    padding: spacing[3.5],
    borderRadius: radii.xl,
    backgroundColor: colors.paper.DEFAULT,
    borderWidth: 1.5,
    borderColor: colors.olive[300],
    ...shadows.soft,
  },
  activeThumbWrap: {
    width: 80,
    height: 96,
    borderRadius: radii.lg,
    overflow: "hidden",
    backgroundColor: colors.paper.warm,
    borderWidth: 1,
    borderColor: colors.light.border,
    position: "relative",
  },
  activeThumb: {
    width: "100%",
    height: "100%",
  },
  activeThumbBadge: {
    position: "absolute",
    bottom: 4,
    left: 4,
    right: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  activeThumbBadgeText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 8,
    color: colors.paper.cream,
    letterSpacing: 0.5,
  },
  activeQueryInfo: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  activeQueryKicker: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 0.8,
    color: colors.olive[700],
    textTransform: "uppercase",
  },
  activeQueryTitle: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 14.5,
    color: colors.light.foreground,
  },
  analyzingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  analyzingText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.olive[800],
  },
  retakeRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
  },
  retakeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radii.full,
    backgroundColor: colors.olive[50],
    borderWidth: 1,
    borderColor: colors.olive[200],
  },
  retakeBtnText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 11,
    color: colors.olive[800],
  },

  /* Results Header */
  resultsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: spacing[2],
    paddingBottom: spacing[1],
  },
  resultsHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  resultsHeaderTitle: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
    letterSpacing: 0.8,
    color: colors.olive[800],
    textTransform: "uppercase",
  },
  resultsCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.full,
    backgroundColor: colors.olive[100],
  },
  resultsCountText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 10.5,
    color: colors.olive[900],
  },

  /* Error Banner */
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: spacing[3],
    borderRadius: radii.xl,
    backgroundColor: "#FDF5F2",
    borderWidth: 1,
    borderColor: "#F4C9B8",
  },
  errorText: {
    flex: 1,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.accent2.rust,
  },

  /* Empty State */
  emptyCard: {
    borderRadius: radii.xl,
    backgroundColor: colors.paper.DEFAULT,
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: spacing[5],
    alignItems: "center",
    gap: 8,
  },
  emptyIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.olive[100],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 15,
    color: colors.light.foreground,
  },
  emptySubtitle: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.light.mutedForeground,
    textAlign: "center",
    lineHeight: 17,
  },
  emptyRetryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    height: 42,
    paddingHorizontal: 18,
    borderRadius: radii.full,
    backgroundColor: colors.olive[900],
  },
  emptyRetryBtnText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 12.5,
    color: colors.paper.cream,
  },

  /* How It Works Guide Section */
  guideSection: {
    marginTop: spacing[3],
    gap: spacing[2],
  },
  guideHeader: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9.5,
    letterSpacing: 0.8,
    color: colors.olive[700],
    textTransform: "uppercase",
    marginBottom: 4,
  },
  guideStepsRow: {
    flexDirection: "row",
    gap: 8,
  },
  guideStepCard: {
    flex: 1,
    padding: spacing[3],
    borderRadius: radii.lg,
    backgroundColor: colors.paper.DEFAULT,
    borderWidth: 1,
    borderColor: colors.light.border,
    gap: 4,
  },
  guideStepBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.olive[100],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  guideStepNumber: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
    color: colors.olive[800],
  },
  guideStepTitle: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 11.5,
    color: colors.light.foreground,
  },
  guideStepDesc: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 10,
    color: colors.light.mutedForeground,
    lineHeight: 14,
  },
});
