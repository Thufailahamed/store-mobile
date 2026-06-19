import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "@/lib/supabase/auth";
import {
  getSellerStore,
  getSellerProductById,
  createSellerProduct,
  updateSellerProduct,
  deleteSellerProduct,
  deleteSellerProductImage,
  setSellerProductImagePrimary,
  saveSellerVariants,
  getAllCategories,
  type SellerVariantInput,
} from "@/lib/api";
import { uploadProductImage } from "@/lib/upload";
import { validateStoreSkus } from "@/lib/product-sku";
import {
  ProductMediaSection,
  type PendingProductImage,
} from "@/components/seller/ProductMediaSection";
import {
  ProductVariantsSection,
  createEmptyVariant,
  type VariantDraft,
} from "@/components/seller/ProductVariantsSection";
import { colors, typography, radii } from "@/lib/theme/tokens";
import type { Product, ProductImage, Category } from "@/lib/types";

export default function SellerProductEdit() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const isNew = id === "new";

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [storeId, setStoreId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [description, setDescription] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [material, setMaterial] = useState("");
  const [mrp, setMrp] = useState("");
  const [price, setPrice] = useState("");
  const [discountPct, setDiscountPct] = useState("0");
  const [taxRate, setTaxRate] = useState("0");
  const [gender, setGender] = useState<string>("unisex");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [status, setStatus] = useState<string>("draft");
  const [initialStatus, setInitialStatus] = useState<string>("draft");
  const [tags, setTags] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);

  const [existingImages, setExistingImages] = useState<ProductImage[]>([]);
  const [pendingImages, setPendingImages] = useState<PendingProductImage[]>([]);
  const [removedImageIds, setRemovedImageIds] = useState<string[]>([]);

  const [variants, setVariants] = useState<VariantDraft[]>([createEmptyVariant()]);
  const [removedVariantIds, setRemovedVariantIds] = useState<string[]>([]);
  const [initialVariantIds, setInitialVariantIds] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const storeRes = await getSellerStore(user.id);
      if (storeRes.ok && storeRes.data) {
        setStoreId(storeRes.data.id);
      }

      const categoriesRes = await getAllCategories();
      if (categoriesRes.ok) {
        setCategories(categoriesRes.data);
      }

      if (!isNew && id) {
        const productRes = await getSellerProductById(id);
        if (productRes.ok && productRes.data) {
          const p = productRes.data;
          setName(p.name);
          setSku(p.sku ?? "");
          setDescription(p.description ?? "");
          setShortDescription(p.short_description ?? "");
          setMaterial(p.material ?? "");
          setMrp(String(p.mrp));
          setPrice(String(p.price));
          setDiscountPct(String(p.discount_pct));
          setTaxRate(String(p.tax_rate ?? 0));
          setGender(p.gender ?? "unisex");
          setCategoryId(p.category_id ?? null);
          setStatus(p.status);
          setInitialStatus(p.status);
          setTags(p.tags?.join(", ") ?? "");
          setIsActive(p.is_active !== false);
          setIsFeatured(Boolean(p.is_featured));
          setExistingImages(p.images ?? []);

          const loadedVariants =
            p.variants && p.variants.length > 0
              ? p.variants.map((v) => ({
                  key: v.id,
                  id: v.id,
                  sku: v.sku ?? "",
                  size: v.size ?? "",
                  color: v.color ?? "",
                  price: v.price != null ? String(v.price) : "",
                  stock: String(v.stock ?? 0),
                }))
              : [createEmptyVariant()];
          setVariants(loadedVariants);
          setInitialVariantIds(loadedVariants.map((v) => v.id).filter(Boolean) as string[]);
        }
      }
      setLoading(false);
    })();
  }, [user, isNew, id]);

  const visibleExistingImages = useMemo(
    () => existingImages.filter((img) => !removedImageIds.includes(img.id)),
    [existingImages, removedImageIds],
  );

  const handleAddPending = (image: PendingProductImage) => {
    setPendingImages((prev) => [...prev, image]);
  };

  const handleRemoveExisting = (imageId: string) => {
    setRemovedImageIds((prev) => [...prev, imageId]);
    setExistingImages((prev) =>
      prev.map((img) =>
        img.id === imageId ? { ...img, is_primary: false } : img,
      ),
    );
  };

  const handleRemovePending = (key: string) => {
    setPendingImages((prev) => {
      const next = prev.filter((img) => img.key !== key);
      if (next.length > 0 && !next.some((img) => img.isPrimary)) {
        next[0] = { ...next[0], isPrimary: true };
      }
      return next;
    });
  };

  const handleSetPrimaryExisting = async (imageId: string) => {
    setExistingImages((prev) =>
      prev.map((img) => ({ ...img, is_primary: img.id === imageId })),
    );
    setPendingImages((prev) => prev.map((img) => ({ ...img, isPrimary: false })));
    if (!isNew && id) {
      await setSellerProductImagePrimary(id, imageId);
    }
  };

  const handleSetPrimaryPending = (key: string) => {
    setPendingImages((prev) =>
      prev.map((img) => ({ ...img, isPrimary: img.key === key })),
    );
    setExistingImages((prev) =>
      prev.map((img) => ({ ...img, is_primary: false })),
    );
  };

  const buildVariantInputs = (): SellerVariantInput[] => {
    const baseMrp = Number(mrp) || Number(price) || 0;
    const basePrice = Number(price) || 0;
    return variants.map((variant, index) => ({
      id: variant.id,
      sku: variant.sku.trim() || undefined,
      size: variant.size.trim() || undefined,
      color: variant.color.trim() || undefined,
      price: variant.price.trim() ? Number(variant.price) : undefined,
      mrp: baseMrp,
      stock: Math.max(0, Number(variant.stock) || 0),
      position: index,
      is_active: true,
    }));
  };

  const syncImages = async (productId: string) => {
    if (!storeId) throw new Error("Store not found");

    for (const imageId of removedImageIds) {
      const res = await deleteSellerProductImage(imageId);
      if (!res.ok) throw new Error(res.error);
    }

    if (pendingImages.length === 0) return;

    setUploadingImages(true);
    const startPosition = visibleExistingImages.length;
    for (let i = 0; i < pendingImages.length; i++) {
      const img = pendingImages[i];
      const res = await uploadProductImage(
        storeId,
        productId,
        img.uri,
        startPosition + i,
        img.isPrimary,
        { mimeType: img.mimeType, fileName: img.fileName },
      );
      if (res.error) throw new Error(res.error);
    }
    setUploadingImages(false);

    const primaryExisting = visibleExistingImages.find((img) => img.is_primary);
    if (primaryExisting) {
      await setSellerProductImagePrimary(productId, primaryExisting.id);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Error", "Product name is required");
      return;
    }
    if (!price || Number.isNaN(Number(price))) {
      Alert.alert("Error", "Valid price is required");
      return;
    }
    // price ≤ mrp — same gate as the web form
    const mrpNum = Number(mrp);
    const priceNum = Number(price);
    if (mrpNum > 0 && priceNum > mrpNum) {
      Alert.alert("Error", "Price must be less than or equal to MRP");
      return;
    }
    if (!storeId) {
      Alert.alert("Error", "Store not found");
      return;
    }
    if (variants.length === 0) {
      Alert.alert("Error", "Add at least one variant with stock");
      return;
    }

    const totalImages = visibleExistingImages.length + pendingImages.length;
    if (totalImages === 0) {
      Alert.alert("Error", "Add at least one product photo");
      return;
    }

    const skuCheck = await validateStoreSkus({
      storeId,
      productId: isNew ? undefined : id,
      productSku: sku.trim() || undefined,
      variants: variants.map((variant) => ({ id: variant.id, sku: variant.sku })),
    });
    if (!skuCheck.ok) {
      Alert.alert("Duplicate SKU", skuCheck.error);
      return;
    }

    setSaving(true);
    try {
      const productData: Partial<Product> = {
        name: name.trim(),
        sku: sku.trim() || undefined,
        description: description.trim() || undefined,
        short_description: shortDescription.trim() || undefined,
        material: material.trim() || undefined,
        mrp: Number(mrp) || Number(price),
        price: Number(price),
        discount_pct: Number(discountPct) || 0,
        tax_rate: Number(taxRate) || 0,
        gender: gender as Product["gender"],
        category_id: categoryId ?? undefined,
        status: status as Product["status"],
        is_active: isActive,
        is_featured: isFeatured,
        tags: tags
          ? tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
        store_id: storeId,
        currency: "LKR",
      };

      let productId = isNew ? undefined : id;
      if (isNew) {
        const res = await createSellerProduct(productData);
        if (!res.ok) throw new Error(res.error);
        productId = res.data.id;
      } else {
        const res = await updateSellerProduct(id!, productData);
        if (!res.ok) throw new Error(res.error);
      }

      if (!productId) throw new Error("Product could not be saved");

      await syncImages(productId);

      const removedIds = [
        ...removedVariantIds,
        ...initialVariantIds.filter(
          (variantId) => !variants.some((v) => v.id === variantId),
        ),
      ];
      const variantRes = await saveSellerVariants(
        productId,
        storeId,
        buildVariantInputs(),
        removedIds,
      );
      if (!variantRes.ok) throw new Error(variantRes.error);

      Alert.alert("Success", isNew ? "Product created" : "Product updated", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to save product");
    } finally {
      setSaving(false);
      setUploadingImages(false);
    }
  };

  const trackRemovedVariant = (next: VariantDraft[]) => {
    const removed = variants
      .filter((v) => v.id && !next.some((n) => n.id === v.id))
      .map((v) => v.id!);
    if (removed.length > 0) {
      setRemovedVariantIds((prev) => [...new Set([...prev, ...removed])]);
    }
    setVariants(next);
  };

  const genders = ["men", "women", "kids", "unisex"];
  const statuses = ["draft", "pending"];
  const isLive = initialStatus === "active";

  const handleDeleteProduct = () => {
    if (isNew || !id) return;
    Alert.alert("Delete product?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setSaving(true);
          const res = await deleteSellerProduct(id);
          setSaving(false);
          if (res.ok) {
            router.back();
          } else {
            Alert.alert("Error", res.error);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{isNew ? "New Product" : "Edit Product"}</Text>
          <Text style={styles.subtitle}>Photos, variants, and listing details</Text>
        </View>

        <ProductMediaSection
          existing={visibleExistingImages}
          pending={pendingImages}
          uploading={uploadingImages}
          onAddPending={handleAddPending}
          onRemoveExisting={handleRemoveExisting}
          onRemovePending={handleRemovePending}
          onSetPrimaryExisting={handleSetPrimaryExisting}
          onSetPrimaryPending={handleSetPrimaryPending}
        />

        <View style={styles.field}>
          <Text style={styles.label}>Product Name *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Classic Cotton T-Shirt"
            placeholderTextColor={colors.light.mutedForeground}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>SKU</Text>
          <TextInput
            style={styles.input}
            value={sku}
            onChangeText={setSku}
            placeholder="e.g. LUXE-TS-001"
            placeholderTextColor={colors.light.mutedForeground}
            autoCapitalize="characters"
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>MRP (Rs.)</Text>
            <TextInput
              style={styles.input}
              value={mrp}
              onChangeText={setMrp}
              placeholder="0"
              keyboardType="numeric"
              placeholderTextColor={colors.light.mutedForeground}
            />
          </View>
          <View style={{ width: 12 }} />
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Selling Price (Rs.) *</Text>
            <TextInput
              style={styles.input}
              value={price}
              onChangeText={setPrice}
              placeholder="0"
              keyboardType="numeric"
              placeholderTextColor={colors.light.mutedForeground}
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Discount %</Text>
          <TextInput
            style={styles.input}
            value={discountPct}
            onChangeText={setDiscountPct}
            placeholder="0"
            keyboardType="numeric"
            placeholderTextColor={colors.light.mutedForeground}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Tax rate (0-1)</Text>
          <TextInput
            style={styles.input}
            value={taxRate}
            onChangeText={setTaxRate}
            placeholder="0"
            keyboardType="numeric"
            placeholderTextColor={colors.light.mutedForeground}
          />
        </View>

        <View style={styles.row}>
          <TouchableOpacity
            style={[styles.toggleRow, isActive && styles.toggleRowActive]}
            onPress={() => setIsActive((v) => !v)}
          >
            <Text style={[styles.toggleText, isActive && styles.toggleTextActive]}>
              {isActive ? "✓ Active" : "Inactive"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleRow, isFeatured && styles.toggleRowActive]}
            onPress={() => setIsFeatured((v) => !v)}
          >
            <Text style={[styles.toggleText, isFeatured && styles.toggleTextActive]}>
              {isFeatured ? "★ Featured" : "Not featured"}
            </Text>
          </TouchableOpacity>
        </View>

        <ProductVariantsSection
          variants={variants}
          basePrice={price}
          onChange={trackRemovedVariant}
        />

        <View style={styles.field}>
          <Text style={styles.label}>Short description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={shortDescription}
            onChangeText={setShortDescription}
            placeholder="One-line pitch (max 400 chars)"
            multiline
            numberOfLines={2}
            maxLength={400}
            placeholderTextColor={colors.light.mutedForeground}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Product description..."
            multiline
            numberOfLines={4}
            placeholderTextColor={colors.light.mutedForeground}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Material</Text>
          <TextInput
            style={styles.input}
            value={material}
            onChangeText={setMaterial}
            placeholder="e.g. 100% organic cotton"
            placeholderTextColor={colors.light.mutedForeground}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            <TouchableOpacity
              style={[styles.chip, !categoryId && styles.chipActive]}
              onPress={() => setCategoryId(null)}
            >
              <Text style={[styles.chipText, !categoryId && styles.chipTextActive]}>None</Text>
            </TouchableOpacity>
            {categories.map((category) => (
              <TouchableOpacity
                key={category.id}
                style={[styles.chip, categoryId === category.id && styles.chipActive]}
                onPress={() => setCategoryId(category.id)}
              >
                <Text
                  style={[
                    styles.chipText,
                    categoryId === category.id && styles.chipTextActive,
                  ]}
                >
                  {category.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Gender</Text>
          <View style={styles.chipRow}>
            {genders.map((g) => (
              <TouchableOpacity
                key={g}
                style={[styles.chip, gender === g && styles.chipActive]}
                onPress={() => setGender(g)}
              >
                <Text style={[styles.chipText, gender === g && styles.chipTextActive]}>
                  {g.charAt(0).toUpperCase() + g.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Listing status</Text>
          {isLive ? (
            <Text style={styles.liveStatusNote}>
              This product is live. Updates stay published; major changes may require re-approval.
            </Text>
          ) : (
            <Text style={styles.liveStatusNote}>
              Choose draft to keep private or pending to submit for admin review.
            </Text>
          )}
          <View style={styles.chipRow}>
            {statuses.map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.chip, status === s && styles.chipActive]}
                onPress={() => setStatus(s)}
              >
                <Text style={[styles.chipText, status === s && styles.chipTextActive]}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
            {isLive ? (
              <View style={[styles.chip, styles.chipLive]}>
                <Text style={[styles.chipText, styles.chipTextActive]}>Active</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Tags (comma separated)</Text>
          <TextInput
            style={styles.input}
            value={tags}
            onChangeText={setTags}
            placeholder="e.g. cotton, casual, summer"
            placeholderTextColor={colors.light.mutedForeground}
          />
        </View>

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>
            {saving
              ? uploadingImages
                ? "Uploading photos..."
                : "Saving..."
              : isNew
                ? "Create Product"
                : "Save Changes"}
          </Text>
        </TouchableOpacity>

        {!isNew ? (
          <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteProduct}>
            <Text style={styles.deleteButtonText}>Delete product</Text>
          </TouchableOpacity>
        ) : null}

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  content: { padding: 16 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { color: colors.light.mutedForeground },

  header: { marginBottom: 20 },
  backButton: {
    fontSize: typography.fontSizes.sm,
    color: colors.light.primary,
    fontWeight: typography.fontWeights.medium as any,
    marginBottom: 8,
  },
  title: {
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.bold as any,
    color: colors.light.foreground,
  },
  subtitle: {
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    marginTop: 4,
  },

  field: { marginBottom: 16 },
  label: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.medium as any,
    color: colors.light.foreground,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.lg,
    padding: 12,
    fontSize: typography.fontSizes.sm,
    color: colors.light.foreground,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: "top",
  },

  row: { flexDirection: "row", gap: 8, marginBottom: 16 },

  toggleRow: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.light.border,
    alignItems: "center",
    backgroundColor: colors.light.card,
  },
  toggleRowActive: {
    backgroundColor: colors.light.primary,
    borderColor: colors.light.primary,
  },
  toggleText: {
    fontSize: typography.fontSizes.sm,
    color: colors.light.foreground,
    fontWeight: "500",
  },
  toggleTextActive: {
    color: colors.light.primaryForeground,
  },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.full,
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  chipActive: {
    backgroundColor: colors.light.primary,
    borderColor: colors.light.primary,
  },
  chipText: {
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
  },
  chipTextActive: { color: colors.light.card },
  chipLive: {
    backgroundColor: "#dcfce7",
    borderColor: "#166534",
  },
  liveStatusNote: {
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    marginBottom: 8,
    lineHeight: 18,
  },

  saveButton: {
    backgroundColor: colors.light.primary,
    padding: 16,
    borderRadius: radii.lg,
    alignItems: "center",
    marginTop: 8,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: {
    color: colors.light.card,
    fontSize: typography.fontSizes.base,
    fontWeight: typography.fontWeights.bold as any,
  },
  deleteButton: {
    marginTop: 12,
    padding: 14,
    borderRadius: radii.lg,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
  },
  deleteButtonText: {
    color: "#dc2626",
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold as any,
  },
});
