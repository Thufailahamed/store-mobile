import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { BrandMark, BRAND_PINK } from "@/components/brand/BrandMark";
import { fontFamilies } from "@/lib/theme/fonts";
import { goBack } from "@/lib/navigation";

const INK = "#1b1c1c";

/**
 * White product-page header: back · "Search in Vestara" pill · wishlist ·
 * bag (with count badge).
 */
export function ProductTopBar({
  topInset,
  cartCount,
  onBack,
  wholesale = false,
}: {
  topInset: number;
  cartCount: number;
  onBack?: () => void;
  wholesale?: boolean;
}) {
  const router = useRouter();
  return (
    <View style={[styles.wrap, { paddingTop: topInset + 4 }]}>
      <View style={styles.bar}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={onBack ?? (() => goBack(router))}
          hitSlop={8}
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color={INK} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.search}
          activeOpacity={0.8}
          onPress={() => router.push((wholesale ? "/(main)/wholesale" : "/(main)/search") as never)}
          accessibilityRole="search"
          accessibilityLabel={wholesale ? "Search Vestara Wholesale" : "Search in Vestara"}
        >
          <BrandMark size={24} />
          <Text style={styles.searchText} numberOfLines={1}>
            {wholesale ? "Search Vestara Wholesale" : "Search in Vestara"}
          </Text>
          <Ionicons name="search-outline" size={20} color={INK} />
        </TouchableOpacity>

        {!wholesale ? (
          <>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => router.push("/(main)/wishlist" as never)}
          hitSlop={6}
          accessibilityLabel="Wishlist"
        >
          <Ionicons name="heart-outline" size={25} color={INK} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => router.push("/(main)/cart" as never)}
          hitSlop={6}
          accessibilityLabel={`Bag${cartCount ? `, ${cartCount} items` : ""}`}
        >
          <Ionicons name="bag-outline" size={24} color={INK} />
          {cartCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{cartCount > 9 ? "9+" : cartCount}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 8,
    paddingBottom: 8,
    zIndex: 10,
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  bar: { flexDirection: "row", alignItems: "center", gap: 4, height: 52 },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  search: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e3e1db",
    backgroundColor: "#ffffff",
    marginHorizontal: 4,
  },
  searchText: { flex: 1, fontFamily: fontFamilies.sans.regular, fontSize: 14.5, color: "#9a9893" },
  badge: {
    position: "absolute",
    top: 3,
    right: 2,
    minWidth: 19,
    height: 19,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: BRAND_PINK,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  badgeText: { fontFamily: fontFamilies.sans.bold, fontSize: 10, color: "#fff" },
});
