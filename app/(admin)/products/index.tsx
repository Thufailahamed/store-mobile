import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import {
  getAdminProducts,
  approveProduct,
  setProductFeatured,
  setProductActive,
} from "@/lib/api";
import { SafeImage, ConfirmDialog, useToast, Skeleton } from "@/components/ui";
import { colors, radii, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";
import type { Product } from "@/lib/types";

const STATUS_TABS = [
  { id: "all", label: "All SKUs" },
  { id: "active", label: "Active" },
  { id: "pending", label: "Pending" },
  { id: "draft", label: "Draft" },
  { id: "archived", label: "Archived" },
] as const;

export default function AdminProducts() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [archiveTarget, setArchiveTarget] = useState<Product | null>(null);

  const productsQuery = useQuery({
    queryKey: ["admin-products", status, search],
    queryFn: async () => {
      const res = await getAdminProducts({ status, search });
      return res.ok ? res.data : { products: [], total: 0 };
    },
    staleTime: 15_000,
  });

  const archiveMutation = useMutation({
    mutationFn: (productId: string) => approveProduct(productId, "archived"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
      toast.success("Product archived successfully");
      setArchiveTarget(null);
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Failed to archive product");
    },
  });

  const featuredMutation = useMutation({
    mutationFn: ({ id, next }: { id: string; next: boolean }) =>
      setProductFeatured(id, next),
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      toast.success(
        vars.next ? "Product featured on storefront" : "Product unfeatured",
      );
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Failed to update featured flag");
    },
  });

  const activeMutation = useMutation({
    mutationFn: ({ id, next }: { id: string; next: boolean }) =>
      setProductActive(id, next),
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      toast.success(
        vars.next ? "Product activated for sales" : "Product deactivated",
      );
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Failed to toggle active status");
    },
  });

  const products = (productsQuery.data?.products ?? []) as Product[];
  const totalCount = productsQuery.data?.total ?? products.length;

  const handleRefresh = () => {
    productsQuery.refetch();
  };

  const getStatusBadgeStyle = (itemStatus?: string) => {
    switch (itemStatus) {
      case "active":
        return { bg: "#eef7ee", text: "#2e5a27", border: "#cde5cb", label: "Active" };
      case "pending":
        return { bg: "#fef9ed", text: "#8a6116", border: "#f7e5b8", label: "Pending" };
      case "draft":
        return { bg: "#f1f4f6", text: "#495a67", border: "#d4dee5", label: "Draft" };
      case "archived":
        return { bg: "#f5f3f0", text: "#716d64", border: "#dfdacd", label: "Archived" };
      default:
        return { bg: "#f5f3f0", text: "#716d64", border: "#dfdacd", label: itemStatus ?? "Unknown" };
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Editorial Header */}
      <View style={styles.header}>
        <View style={styles.headerTextGroup}>
          <View style={styles.eyebrowRow}>
            <View style={styles.eyebrowDot} />
            <Text style={styles.eyebrow}>CATALOGUE GOVERNANCE</Text>
          </View>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Products</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{totalCount} SKUs</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={handleRefresh}
          activeOpacity={0.7}
          accessibilityLabel="Refresh products"
        >
          <Ionicons
            name="refresh-outline"
            size={20}
            color={colors.olive[800]}
          />
        </TouchableOpacity>
      </View>

      {/* Search Input Bar */}
      <View style={styles.searchWrapper}>
        <View style={styles.searchContainer}>
          <Ionicons
            name="search-outline"
            size={18}
            color={colors.olive[700]}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search SKUs, styles, ateliers..."
            placeholderTextColor={colors.light.mutedForeground}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearch("")}
              style={styles.clearBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name="close-circle"
                size={18}
                color={colors.light.mutedForeground}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Horizontal Status Filter Bar */}
      <View style={styles.tabsWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContent}
        >
          {STATUS_TABS.map((tab) => {
            const isActive = status === tab.id;
            return (
              <Pressable
                key={tab.id}
                style={[styles.tab, isActive && styles.tabActive]}
                onPress={() => setStatus(tab.id)}
              >
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Main Product List / Loading / Empty */}
      {productsQuery.isLoading ? (
        <View style={styles.loadingContainer}>
          {[1, 2, 3, 4].map((i) => (
            <View key={i} style={styles.skeletonCard}>
              <Skeleton width={74} height={74} style={{ borderRadius: radii.md }} />
              <View style={styles.skeletonDetails}>
                <Skeleton width="40%" height={12} style={{ marginBottom: 8 }} />
                <Skeleton width="85%" height={16} style={{ marginBottom: 8 }} />
                <Skeleton width="30%" height={14} />
              </View>
            </View>
          ))}
        </View>
      ) : products.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="bag-handle-outline" size={32} color={colors.olive[700]} />
          </View>
          <Text style={styles.emptyTitle}>No SKUs Located</Text>
          <Text style={styles.emptyDescription}>
            {search.length > 0
              ? `No catalogue matches found for "${search}". Try adjusting the keywords or clear filters.`
              : `No products currently found under the "${status}" status tab.`}
          </Text>
          {(search.length > 0 || status !== "all") && (
            <TouchableOpacity
              style={styles.clearFiltersBtn}
              onPress={() => {
                setSearch("");
                setStatus("all");
              }}
            >
              <Text style={styles.clearFiltersBtnText}>Clear All Filters</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={productsQuery.isRefetching}
              onRefresh={handleRefresh}
              tintColor={colors.olive[800]}
              colors={[colors.olive[800]]}
            />
          }
          renderItem={({ item }) => {
            const primaryImageUrl =
              item.images?.find((img) => img.is_primary)?.url ||
              item.images?.[0]?.url ||
              (item as any).image_url ||
              null;

            const badge = getStatusBadgeStyle(item.status);
            const brandOrStore =
              item.brand?.name || item.store?.name || (item.category?.name ?? "Collection");
            const isFeatured = !!item.is_featured;
            const isActive = item.is_active !== false;
            const stockCount: number | null =
              (item as any).stock ??
              (item as any).inventory_quantity ??
              (item.variants && item.variants.length > 0
                ? item.variants.reduce((sum, v) => sum + (v.stock ?? 0), 0)
                : null);
            const isLowStock = stockCount !== null && stockCount <= 5;

            return (
              <Pressable
                style={styles.productCard}
                onPress={() => router.push(`/(admin)/products/${item.id}` as any)}
              >
                {/* Primary Card Content */}
                <View style={styles.cardMain}>
                  {/* Thumbnail */}
                  <View style={styles.thumbnailContainer}>
                    {primaryImageUrl ? (
                      <SafeImage
                        uri={primaryImageUrl}
                        style={styles.thumbnail}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={styles.placeholderThumbnail}>
                        <Ionicons
                          name="image-outline"
                          size={24}
                          color={colors.light.mutedForeground}
                        />
                      </View>
                    )}
                    {isFeatured && (
                      <View style={styles.featuredCornerBadge}>
                        <Ionicons name="star" size={10} color="#ffffff" />
                      </View>
                    )}
                  </View>

                  {/* Details */}
                  <View style={styles.productDetails}>
                    <View style={styles.topMetaRow}>
                      <Text style={styles.brandSubtitle} numberOfLines={1}>
                        {brandOrStore.toUpperCase()}
                      </Text>
                      <View
                        style={[
                          styles.statusBadge,
                          { backgroundColor: badge.bg, borderColor: badge.border },
                        ]}
                      >
                        <Text style={[styles.statusBadgeText, { color: badge.text }]}>
                          {badge.label}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.productName} numberOfLines={2}>
                      {item.name}
                    </Text>

                    <View style={styles.priceRow}>
                      <Text style={styles.productPrice}>
                        {formatPrice(item.price)}
                      </Text>
                      {item.mrp && item.mrp > item.price && (
                        <Text style={styles.mrpPrice}>
                          {formatPrice(item.mrp)}
                        </Text>
                      )}
                    </View>

                    {/* Stock & Sales Info */}
                    <View style={styles.subMetaRow}>
                      {stockCount !== null && (
                        <View
                          style={[
                            styles.stockPill,
                            isLowStock && styles.lowStockPill,
                          ]}
                        >
                          <View
                            style={[
                              styles.stockDot,
                              isLowStock && styles.lowStockDot,
                            ]}
                          />
                          <Text
                            style={[
                              styles.stockText,
                              isLowStock && styles.lowStockText,
                            ]}
                          >
                            {isLowStock
                              ? `Low stock: ${stockCount}`
                              : `In stock: ${stockCount}`}
                          </Text>
                        </View>
                      )}
                      <Text style={styles.salesMetricText}>
                        {item.total_sales ?? 0} sales
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Card Actions Ribbon */}
                <View style={styles.cardActions}>
                  {/* Feature toggle */}
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      isFeatured && styles.actionButtonFeatured,
                    ]}
                    onPress={(e) => {
                      e.stopPropagation();
                      featuredMutation.mutate({ id: item.id, next: !isFeatured });
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={isFeatured ? "star" : "star-outline"}
                      size={14}
                      color={isFeatured ? "#92400e" : colors.olive[800]}
                    />
                    <Text
                      style={[
                        styles.actionButtonText,
                        isFeatured && styles.actionButtonTextFeatured,
                      ]}
                    >
                      {isFeatured ? "Featured" : "Feature"}
                    </Text>
                  </TouchableOpacity>

                  {/* Active / Pause toggle */}
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      !isActive && styles.actionButtonInactive,
                    ]}
                    onPress={(e) => {
                      e.stopPropagation();
                      activeMutation.mutate({ id: item.id, next: !isActive });
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={isActive ? "eye-outline" : "eye-off-outline"}
                      size={14}
                      color={isActive ? colors.olive[800] : colors.light.mutedForeground}
                    />
                    <Text
                      style={[
                        styles.actionButtonText,
                        !isActive && styles.actionButtonTextInactive,
                      ]}
                    >
                      {isActive ? "Active" : "Hidden"}
                    </Text>
                  </TouchableOpacity>

                  {/* Archive button */}
                  <TouchableOpacity
                    style={[styles.actionButton, styles.actionButtonArchive]}
                    onPress={(e) => {
                      e.stopPropagation();
                      setArchiveTarget(item);
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="archive-outline"
                      size={14}
                      color="#991b1b"
                    />
                    <Text style={styles.actionButtonTextArchive}>
                      Archive
                    </Text>
                  </TouchableOpacity>
                </View>
              </Pressable>
            );
          }}
        />
      )}

      {/* Luxury Confirmation Modal */}
      <ConfirmDialog
        visible={archiveTarget !== null}
        title="Archive SKU"
        description={
          archiveTarget
            ? `Archive "${archiveTarget.name}"? This SKU will be retired from public storefront browse and search.`
            : ""
        }
        icon="archive-outline"
        iconTone="destructive"
        confirmText="Archive Product"
        cancelText="Cancel"
        destructive={true}
        onConfirm={() => {
          if (archiveTarget) {
            archiveMutation.mutate(archiveTarget.id);
          }
        }}
        onCancel={() => setArchiveTarget(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.light.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
  },
  headerTextGroup: {
    flex: 1,
  },
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  eyebrowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.olive[700],
  },
  eyebrow: {
    fontSize: 11,
    fontFamily: fontFamilies.sans.bold,
    letterSpacing: 1.2,
    color: colors.olive[700],
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  title: {
    fontSize: 28,
    fontFamily: fontFamilies.display.semibold,
    color: colors.olive[900],
    letterSpacing: -0.5,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: "#ebe7dc",
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "#ded8ca",
  },
  countText: {
    fontSize: 11,
    fontFamily: fontFamilies.sans.bold,
    color: colors.olive[800],
  },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e4dfd3",
    justifyContent: "center",
    alignItems: "center",
    ...shadows.soft,
  },

  /* Search */
  searchWrapper: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "#e4dfd3",
    paddingHorizontal: 14,
    height: 44,
    ...shadows.soft,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: fontFamilies.sans.regular,
    color: colors.light.foreground,
    paddingVertical: 0,
  },
  clearBtn: {
    padding: 4,
  },

  /* Tabs */
  tabsWrapper: {
    marginBottom: 14,
  },
  tabsContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radii.full,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dfdacb",
  },
  tabActive: {
    backgroundColor: colors.olive[900],
    borderColor: colors.olive[900],
  },
  tabText: {
    fontSize: 13,
    fontFamily: fontFamilies.sans.semibold,
    color: colors.olive[900],
  },
  tabTextActive: {
    color: "#ffffff",
    fontFamily: fontFamilies.sans.bold,
  },

  /* List */
  list: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  productCard: {
    backgroundColor: "#ffffff",
    borderRadius: radii.xl,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e8e3d8",
    ...shadows.soft,
  },
  cardMain: {
    flexDirection: "row",
    gap: 12,
  },
  thumbnailContainer: {
    width: 74,
    height: 74,
    borderRadius: radii.md,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#f4f1ea",
    borderWidth: 1,
    borderColor: "#ded8cb",
  },
  thumbnail: {
    width: "100%",
    height: "100%",
  },
  placeholderThumbnail: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f4f1ea",
  },
  featuredCornerBadge: {
    position: "absolute",
    top: 4,
    left: 4,
    backgroundColor: "#d97706",
    borderRadius: radii.full,
    padding: 3,
  },
  productDetails: {
    flex: 1,
    justifyContent: "space-between",
  },
  topMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  brandSubtitle: {
    fontSize: 10,
    fontFamily: fontFamilies.sans.bold,
    color: colors.olive[700],
    letterSpacing: 0.8,
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 10,
    fontFamily: fontFamilies.sans.bold,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  productName: {
    fontSize: 14,
    fontFamily: fontFamilies.sans.semibold,
    color: colors.light.foreground,
    lineHeight: 18,
    marginBottom: 4,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    marginBottom: 6,
  },
  productPrice: {
    fontSize: 16,
    fontFamily: fontFamilies.display.semibold,
    color: colors.olive[900],
  },
  mrpPrice: {
    fontSize: 12,
    fontFamily: fontFamilies.sans.regular,
    color: colors.light.mutedForeground,
    textDecorationLine: "line-through",
  },
  subMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stockPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f4f8f3",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    gap: 5,
  },
  stockDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#16a34a",
  },
  stockText: {
    fontSize: 11,
    fontFamily: fontFamilies.sans.medium,
    color: "#166534",
  },
  lowStockPill: {
    backgroundColor: "#fef3f2",
  },
  lowStockDot: {
    backgroundColor: "#dc2626",
  },
  lowStockText: {
    color: "#991b1b",
  },
  salesMetricText: {
    fontSize: 11,
    fontFamily: fontFamilies.sans.medium,
    color: colors.light.mutedForeground,
  },

  /* Card Actions Ribbon */
  cardActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#f0ece3",
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: radii.md,
    backgroundColor: "#f8f6f0",
    borderWidth: 1,
    borderColor: "#e4dfd4",
  },
  actionButtonText: {
    fontSize: 12,
    fontFamily: fontFamilies.sans.medium,
    color: colors.olive[900],
  },
  actionButtonFeatured: {
    backgroundColor: "#fef3c7",
    borderColor: "#fde68a",
  },
  actionButtonTextFeatured: {
    color: "#92400e",
    fontFamily: fontFamilies.sans.bold,
  },
  actionButtonInactive: {
    opacity: 0.65,
  },
  actionButtonTextInactive: {
    color: colors.light.mutedForeground,
  },
  actionButtonArchive: {
    backgroundColor: "#fef2f2",
    borderColor: "#fee2e2",
  },
  actionButtonTextArchive: {
    color: "#991b1b",
  },

  /* Loading State */
  loadingContainer: {
    paddingHorizontal: 20,
    gap: 12,
  },
  skeletonCard: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderRadius: radii.xl,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e8e3d8",
    gap: 12,
  },
  skeletonDetails: {
    flex: 1,
    justifyContent: "center",
  },

  /* Empty State */
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 36,
    paddingVertical: 60,
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#ebe7dc",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#dfdacd",
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: fontFamilies.display.semibold,
    color: colors.olive[900],
    marginBottom: 8,
    textAlign: "center",
  },
  emptyDescription: {
    fontSize: 14,
    fontFamily: fontFamilies.sans.regular,
    color: colors.light.mutedForeground,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  clearFiltersBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: colors.olive[900],
    borderRadius: radii.full,
  },
  clearFiltersBtnText: {
    fontSize: 13,
    fontFamily: fontFamilies.sans.bold,
    color: "#ffffff",
  },
});
