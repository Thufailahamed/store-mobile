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
  reorderSellerProductImages,
  saveSellerVariants,
  getAllCategories,
  getBrands,
  preflightModeration,
  type SellerVariantInput,
} from "@/lib/api";
import { uploadProductImage } from "@/lib/upload";
import { coerceSellerProductStatus } from "@/lib/seller-product-status";
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
import {
  ModerationResultBanner,
  type ModerationResult,
} from "@/components/seller/ModerationResultBanner";
import { colors, typography, radii } from "@/lib/theme/tokens";
import type { Product, ProductImage, ProductVariant, Category, Brand } from "@/lib/types";

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
  const [pattern, setPattern] = useState("");
  const [fit, setFit] = useState("");
  const [sleeve, setSleeve] = useState("");
  const [occasion, setOccasion] = useState("");
  const [season, setSeason] = useState("");
  const [careInstructions, setCareInstructions] = useState("");
  const [mrp, setMrp] = useState("");
  const [price, setPrice] = useState("");
  const [discountPct, setDiscountPct] = useState("0");
  const [taxRate, setTaxRate] = useState("0");
  const [gender, setGender] = useState<string>("unisex");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brandId, setBrandId] = useState<string | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [status, setStatus] = useState<string>("draft");
  const [initialStatus, setInitialStatus] = useState<string>("draft");
  const [tags, setTags] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);

  const [preflight, setPreflight] = useState<{
    auto_approved: boolean;
    flagged: boolean;
    score: number;
    threshold: number;
    reasons: { rule_id: string; message: string; blocking: boolean }[];
  } | null>(null);
  const [preflightBusy, setPreflightBusy] = useState(false);

  const [existingImages, setExistingImages] = useState<ProductImage[]>([]);
  const [pendingImages, setPendingImages] = useState<PendingProductImage[]>([]);
  const [removedImageIds, setRemovedImageIds] = useState<string[]>([]);
  const [moderation, setModeration] = useState<ModerationResult>(null);

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

      const brandsRes = await getBrands({ limit: 100 });
      if (brandsRes.ok) setBrands(brandsRes.data);

      if (!isNew && id) {
        const productRes = await getSellerProductById(id);
        if (productRes.ok && productRes.data) {
          const p = productRes.data;
          setName(p.name);
          setSku(p.sku ?? "");
          setDescription(p.description ?? "");
          setShortDescription(p.short_description ?? "");
          setMaterial(p.material ?? "");
          setPattern((p as Product).pattern ?? "");
          setFit((p as Product).fit ?? "");
          setSleeve((p as Product).sleeve ?? "");
          setOccasion((p as Product).occasion ?? "");
          setSeason((p as Product).season ?? "");
          setCareInstructions((p as Product).care_instructions ?? "");
          setMrp(String(p.mrp));
          setPrice(String(p.price));
          setDiscountPct(String(p.discount_pct));
          setTaxRate(String(p.tax_rate ?? 0));
          setGender(p.gender ?? "unisex");
          setCategoryId(p.category_id ?? null);
          setBrandId((p as Product).brand_id ?? null);
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
                  colorHex: (v as ProductVariant).color_hex ?? "",
                  material: (v as ProductVariant).material ?? "",
                  pattern: (v as ProductVariant).pattern ?? "",
                  fit: (v as ProductVariant).fit ?? "",
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

  const handleMoveExisting = (imageId: string, direction: "left" | "right") => {
    const visible = existingImages.filter((img) => !removedImageIds.includes(img.id));
    const idx = visible.findIndex((img) => img.id === imageId);
    if (idx < 0) return;
    const target = direction === "left" ? idx - 1 : idx + 1;
    if (target < 0 || target >= visible.length) return;
    const reordered = [...visible];
    const [moved] = reordered.splice(idx, 1);
    reordered.splice(target, 0, moved);
    setExistingImages((prev) => {
      const removed = prev.filter((img) => removedImageIds.includes(img.id));
      return [...reordered, ...removed];
    });
  };

  const buildVariantInputs = (): SellerVariantInput[] => {
    const baseMrp = Number(mrp) || Number(price) || 0;
    return variants.map((variant, index) => ({
      id: variant.id,
      sku: variant.sku.trim() || undefined,
      size: variant.size.trim() || undefined,
      color: variant.color.trim() || undefined,
      color_hex: variant.colorHex.trim() || undefined,
      material: variant.material.trim() || undefined,
      pattern: variant.pattern.trim() || undefined,
      fit: variant.fit.trim() || undefined,
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
      const res = await deleteSellerProductImage(productId, imageId);
      if (!res.ok) throw new Error(res.error);
    }

    // Sync reorder of remaining existing images
    if (visibleExistingImages.length > 1) {
      const order = visibleExistingImages.map((img, i) => ({ id: img.id, position: i }));
      const reorderRes = await reorderSellerProductImages(productId, order);
      if (!reorderRes.ok) throw new Error(reorderRes.error);
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
        pattern: pattern.trim() || undefined,
        fit: fit.trim() || undefined,
        sleeve: sleeve.trim() || undefined,
        occasion: occasion.trim() || undefined,
        season: season.trim() || undefined,
        care_instructions: careInstructions.trim() || undefined,
        mrp: Number(mrp) || Number(price),
        price: Number(price),
        discount_pct: Number(discountPct) || 0,
        tax_rate: Number(taxRate) || 0,
        gender: gender as Product["gender"],
        category_id: categoryId ?? undefined,
        brand_id: brandId ?? undefined,
        // M-03 AUDIT: Sellers cannot self-publish. coerceSellerProductStatus
        // downgrades "active" → "pending" unless the product is already live.
        status: coerceSellerProductStatus(
          status as Product["status"],
          initialStatus as Product["status"],
        ),
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
        productId = res.data.product.id;
        setModeration(res.data.moderation);
      } else {
        const res = await updateSellerProduct(id!, productData);
        if (!res.ok) throw new Error(res.error);
        productId = res.data.product.id;
        setModeration(res.data.moderation);
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

      let banner = isNew ? "Product created" : "Product updated";
      if (moderation) {
        if (moderation.auto_approved) banner = `Auto-approved · score ${moderation.score}/${moderation.threshold} — live now`;
        else if (moderation.flagged) banner = `Pending review · score ${moderation.score}/${moderation.threshold}`;
      }
      Alert.alert("Saved", banner, [
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
  const statuses = ["draft", "active", "archived"];
  const isLive = initialStatus === "active";

  // Live moderation preflight (debounced)
  useEffect(() => {
    if (!name.trim() || !price || Number.isNaN(Number(price))) {
      setPreflight(null);
      return;
    }
    const handle = setTimeout(async () => {
      setPreflightBusy(true);
      const res = await preflightModeration({
        name: name.trim(),
        description: description.trim() || null,
        price: Number(price),
        mrp: Number(mrp) || undefined,
        brand_id: brandId,
        category_id: categoryId,
        image_urls: existingImages.filter((i) => !removedImageIds.includes(i.id)).map((i) => i.url),
        variant_count: variants.length,
      });
      setPreflightBusy(false);
      if (res.ok) setPreflight(res.data);
    }, 600);
    return () => clearTimeout(handle);
  }, [name, description, price, mrp, brandId, categoryId, existingImages, removedImageIds, variants.length]);

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
        {moderation ? <ModerationResultBanner result={moderation} isNew={isNew} /> : null}

        <ProductMediaSection
          existing={visibleExistingImages}
          pending={pendingImages}
          uploading={uploadingImages}
          onAddPending={handleAddPending}
          onRemoveExisting={handleRemoveExisting}
          onRemovePending={handleRemovePending}
          onSetPrimaryExisting={handleSetPrimaryExisting}
          onSetPrimaryPending={handleSetPrimaryPending}
          onMoveExisting={!isNew ? handleMoveExisting : undefined}
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

        <View style={styles.row}>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Pattern</Text>
            <TextInput
              style={styles.input}
              value={pattern}
              onChangeText={setPattern}
              placeholder="Solid, striped…"
              placeholderTextColor={colors.light.mutedForeground}
            />
          </View>
          <View style={{ width: 10 }} />
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Fit</Text>
            <TextInput
              style={styles.input}
              value={fit}
              onChangeText={setFit}
              placeholder="Slim, regular…"
              placeholderTextColor={colors.light.mutedForeground}
            />
          </View>
        </View>

        <View style={styles.row}>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Sleeve</Text>
            <TextInput
              style={styles.input}
              value={sleeve}
              onChangeText={setSleeve}
              placeholder="Short, long…"
              placeholderTextColor={colors.light.mutedForeground}
            />
          </View>
          <View style={{ width: 10 }} />
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Season</Text>
            <TextInput
              style={styles.input}
              value={season}
              onChangeText={setSeason}
              placeholder="Summer, all…"
              placeholderTextColor={colors.light.mutedForeground}
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Occasion</Text>
          <TextInput
            style={styles.input}
            value={occasion}
            onChangeText={setOccasion}
            placeholder="Casual, formal…"
            placeholderTextColor={colors.light.mutedForeground}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Care instructions</Text>
          <TextInput
            style={[styles.input, styles.textArea, { minHeight: 70 }]}
            value={careInstructions}
            onChangeText={setCareInstructions}
            placeholder="Machine wash cold, tumble dry low…"
            multiline
            numberOfLines={3}
            placeholderTextColor={colors.light.mutedForeground}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Brand</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            <TouchableOpacity
              style={[styles.chip, !brandId && styles.chipActive]}
              onPress={() => setBrandId(null)}
            >
              <Text style={[styles.chipText, !brandId && styles.chipTextActive]}>None</Text>
            </TouchableOpacity>
            {brands.map((brand) => (
              <TouchableOpacity
                key={brand.id}
                style={[styles.chip, brandId === brand.id && styles.chipActive]}
                onPress={() => setBrandId(brand.id)}
              >
                <Text
                  style={[styles.chipText, brandId === brand.id && styles.chipTextActive]}
                >
                  {brand.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
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
              This product is live. Switching to Active resubmits to moderation. Archived hides from shoppers.
            </Text>
          ) : (
            <Text style={styles.liveStatusNote}>
              Choose Active to submit for review (auto-approves when score is high enough). Archived hides the product.
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
            {isLive && status !== "active" ? (
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

        {/* Live moderation preflight */}
        <View style={[styles.preflightCard, preflight ? (
          preflight.flagged ? styles.preflightFlagged : preflight.auto_approved ? styles.preflightApproved : styles.preflightPending
        ) : styles.preflightIdle]}>
          <View style={styles.preflightHeader}>
            <Text style={styles.preflightTitle}>
              {preflightBusy ? "Scoring…" :
                preflight
                  ? preflight.auto_approved ? "Auto-approval likely"
                    : preflight.flagged ? "Will be flagged"
                    : "Pending review"
                  : "Moderation preflight"}
            </Text>
            {preflight ? (
              <Text style={styles.preflightScore}>
                {preflight.score}/{preflight.threshold}
              </Text>
            ) : null}
          </View>
          {preflight && preflight.reasons.length > 0 ? (
            <View style={{ marginTop: 6 }}>
              {preflight.reasons.slice(0, 3).map((r, i) => (
                <Text key={i} style={styles.preflightReason}>
                  • {r.message}
                </Text>
              ))}
            </View>
          ) : null}
          <Text style={styles.preflightHint}>
            Updates as you type. Final check runs on save.
          </Text>
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

  preflightCard: {
    marginTop: 8,
    marginBottom: 16,
    padding: 12,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  preflightIdle: { backgroundColor: colors.light.muted, borderColor: colors.light.border },
  preflightApproved: { backgroundColor: "#ecfdf5", borderColor: "#a7f3d0" },
  preflightPending: { backgroundColor: "#fffbeb", borderColor: "#fde68a" },
  preflightFlagged: { backgroundColor: "#fff1f2", borderColor: "#fecdd3" },
  preflightHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  preflightTitle: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold as any,
    color: colors.light.foreground,
  },
  preflightScore: {
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    fontFamily: "monospace",
  },
  preflightReason: {
    fontSize: 11,
    color: colors.light.mutedForeground,
    marginTop: 2,
  },
  preflightHint: {
    fontSize: 10,
    color: colors.light.mutedForeground,
    marginTop: 6,
    fontStyle: "italic",
  },
});
