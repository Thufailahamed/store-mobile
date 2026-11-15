import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { C } from "@/components/orders/parcel-track";
import { fontFamilies } from "@/lib/theme/fonts";
import { colors, radii, shadows, spacing } from "@/lib/theme/tokens";
import { useCart } from "@/lib/stores/cart-store";
import { useWishlist } from "@/lib/stores/wishlist-store";
import { BrandMark, BRAND_OLIVE } from "@/components/brand/BrandMark";

const INK = "#1b1c1c";
const MUTED = "#5e5e5d";

interface SearchOrbitChromeProps {
  topInset: number;
  draft: string;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
  onClear: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  searched: boolean;
  query?: string;
  totalCount?: number;
  onImageSearch?: () => void;
  onCameraSearch?: () => void;
  /** Overrides the default router.back() (e.g. return to the search page). */
  onBack?: () => void;
  style?: StyleProp<ViewStyle>;
}

/** Legacy export — background removed for flat app search. */
export function SearchOrbitBackground() {
  return null;
}

export function SearchOrbitChrome({
  topInset,
  draft,
  onDraftChange,
  onSubmit,
  onClear,
  onFocus,
  onBlur,
  searched,
  query,
  totalCount,
  onImageSearch,
  onCameraSearch,
  onBack,
  style,
}: SearchOrbitChromeProps) {
  const router = useRouter();
  const handleBack = onBack ?? (() => router.back());
  const isTyping = draft.trim().length > 0 && !searched;
  const cartCount = useCart((s) => s.itemCount());
  const wishlistCount = useWishlist((s) => s.count());
  // On a results page the field collapses into a title bar; tapping the
  // title or the search icon brings the input back.
  const [editing, setEditing] = useState(false);
  const showingResults =
    searched && !!query && draft.trim().toLowerCase() === query.trim().toLowerCase();
  useEffect(() => {
    setEditing(false);
  }, [query]);

  if (showingResults && !editing) {
    return (
      <View style={[styles.barWrap, { paddingTop: topInset + spacing[1] }, style]}>
        <View style={styles.bar}>
          <TouchableOpacity
            style={styles.barCircle}
            onPress={handleBack}
            hitSlop={8}
            activeOpacity={0.7}
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={22} color={INK} />
          </TouchableOpacity>

          {/* Brand mark + query — tap to edit the search */}
          <TouchableOpacity
            style={styles.barTitleWrap}
            onPress={() => setEditing(true)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Edit search ${query}`}
          >
            <View style={styles.barMarkTile}>
              <BrandMark size={26} />
            </View>
            <View style={styles.barTitleCol}>
              <Text style={styles.barKicker} numberOfLines={1}>
                Results for
              </Text>
              <Text style={styles.barTitle} numberOfLines={1}>
                {query!.toUpperCase()}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Action cluster */}
          <View style={styles.barCluster}>
            <TouchableOpacity
              style={styles.clusterBtn}
              onPress={() => setEditing(true)}
              hitSlop={4}
              activeOpacity={0.6}
              accessibilityLabel="Search"
            >
              <Ionicons name="search-outline" size={21} color={INK} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.clusterBtn}
              onPress={() => router.push("/(main)/wishlist")}
              hitSlop={4}
              activeOpacity={0.6}
              accessibilityLabel={`Wishlist${wishlistCount ? `, ${wishlistCount} items` : ""}`}
            >
              <Ionicons name="heart-outline" size={21} color={INK} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.clusterBtn}
              onPress={() => router.push("/(main)/cart")}
              hitSlop={4}
              activeOpacity={0.6}
              accessibilityLabel={`Bag${cartCount ? `, ${cartCount} items` : ""}`}
            >
              <Ionicons name="bag-outline" size={21} color={INK} />
              {cartCount > 0 ? (
                <View style={styles.barBadge}>
                  <Text style={styles.barBadgeText}>{cartCount > 9 ? "9+" : cartCount}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, { paddingTop: topInset + spacing[2] }, style]}>
      <View style={styles.topRow}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={handleBack}
          activeOpacity={0.7}
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={22} color={INK} />
        </TouchableOpacity>

        <View style={styles.searchField}>
          <Ionicons name="search" size={18} color={MUTED} />
          <TextInput
            style={styles.searchInput}
            value={draft}
            onChangeText={onDraftChange}
            onSubmitEditing={() => {
              setEditing(false);
              onSubmit();
            }}
            onFocus={onFocus}
            onBlur={onBlur}
            returnKeyType="search"
            placeholder="Search products & brands"
            placeholderTextColor={colors.light.mutedForeground}
            autoFocus
            autoCorrect={false}
            autoCapitalize="none"
          />
          {draft.length > 0 ? (
            <TouchableOpacity onPress={onClear} hitSlop={8} accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={18} color={MUTED} />
            </TouchableOpacity>
          ) : (
            <View style={styles.fieldActions}>
              <View style={styles.fieldDivider} />
              {onImageSearch ? (
                <TouchableOpacity
                  onPress={onImageSearch}
                  hitSlop={6}
                  style={styles.fieldActionBtn}
                  accessibilityLabel="Search with a photo"
                >
                  <Ionicons name="image-outline" size={19} color={INK} />
                </TouchableOpacity>
              ) : null}
              {onCameraSearch ? (
                <TouchableOpacity
                  onPress={onCameraSearch}
                  hitSlop={6}
                  style={[styles.fieldActionBtn, styles.fieldActionInk]}
                  accessibilityLabel="Scan an item with the camera"
                >
                  <Ionicons name="camera-outline" size={18} color={C.lime} />
                </TouchableOpacity>
              ) : null}
            </View>
          )}
        </View>
      </View>

      {searched && !isTyping && typeof totalCount === "number" && totalCount > 0 ? (
        <View style={styles.resultsMetaRow}>
          <View style={styles.resultsMetaDot} />
          <Text style={styles.resultsMeta}>
            Showing <Text style={styles.resultsMetaBold}>{totalCount}</Text> {totalCount === 1 ? "result" : "results"} for{" "}
            <Text style={styles.resultsMetaQuery}>“{query}”</Text>
          </Text>
        </View>
      ) : null}

    </View>
  );
}

const styles = StyleSheet.create({
  barWrap: {
    paddingHorizontal: spacing[3],
    paddingBottom: spacing[2],
    backgroundColor: "#ffffff",
    zIndex: 10,
    // Soft lift instead of a hard rule — reads as a floating glass bar.
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 4,
  },
  bar: { flexDirection: "row", alignItems: "center", gap: 10, height: 56 },
  barCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f5f4f1",
    alignItems: "center",
    justifyContent: "center",
  },
  barTitleWrap: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, minWidth: 0 },
  barMarkTile: {
    width: 40,
    height: 40,
    borderRadius: 13,
    // Light olive tile to frame the olive stitched-V mark.
    backgroundColor: "#f3f3ea",
    borderWidth: 1,
    borderColor: "#e6e6d0",
    alignItems: "center",
    justifyContent: "center",
  },
  barTitleCol: { flex: 1, minWidth: 0 },
  barKicker: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9.5,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: "#9a9893",
  },
  barTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 15.5, letterSpacing: 0.8, color: INK, marginTop: 1 },
  barCluster: {
    flexDirection: "row",
    alignItems: "center",
    height: 44,
    paddingHorizontal: 4,
    borderRadius: 22,
    backgroundColor: "#f5f4f1",
  },
  clusterBtn: { width: 38, height: 40, alignItems: "center", justifyContent: "center" },
  barBadge: {
    position: "absolute",
    top: 3,
    right: 0,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: BRAND_OLIVE,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  barBadgeText: { fontFamily: fontFamilies.sans.bold, fontSize: 9.5, color: "#fff" },
  wrap: {
    paddingHorizontal: spacing[4],
    backgroundColor: C.glow,
    zIndex: 10,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    paddingBottom: spacing[3],
    paddingTop: spacing[1],
  },
  iconBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    shadowColor: C.ink,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  searchField: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    height: 50,
    paddingLeft: spacing[4],
    paddingRight: 6,
    borderRadius: radii.full,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: C.line,
    shadowColor: C.ink,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 3,
  },
  fieldActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  fieldDivider: {
    width: StyleSheet.hairlineWidth,
    height: 20,
    marginRight: 4,
    backgroundColor: `${colors.ink.DEFAULT}26`,
  },
  fieldActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.accentSoft,
  },
  fieldActionInk: {
    backgroundColor: C.ink,
  },
  searchInput: {
    flex: 1,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 16,
    color: INK,
    paddingVertical: 0,
  },
  resultsMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    paddingBottom: spacing[3],
    paddingHorizontal: spacing[1],
  },
  resultsMetaDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.lime,
  },
  resultsMeta: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    color: MUTED,
  },
  resultsMetaBold: {
    fontFamily: fontFamilies.sans.semibold,
    color: INK,
  },
  resultsMetaQuery: {
    fontFamily: fontFamilies.sans.medium,
    color: INK,
  },
});
