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
  StatusBar,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
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
import { coerceSellerProductStatus, statusToIsActive } from "@/lib/seller-product-status";
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
import { colors, typography, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { discountPct as computeDiscountPct, percentToTaxRate, taxRateToPercent } from "@/lib/utils";
import { Skeleton } from "@/components/ui/Skeleton";
import type { Product, ProductImage, ProductVariant, Category, Brand } from "@/lib/types";

const GOLD = colors.accent2.ochre;
const RUST = colors.accent2.rust;
const CREAM = colors.paper.cream;
const INK = colors.olive[950];

// Carries how far the pending-image upload loop got before failing, so the
// caller can report a specific "product created but incomplete" message
// instead of a generic error (see syncImages).
class ImageSyncError extends Error {
  uploadedCount: number;
  totalPending: number;
  constructor(message: string, uploadedCount: number, totalPending: number) {
    super(message);
    this.uploadedCount = uploadedCount;
    this.totalPending = totalPending;
  }
}

export default function SellerProductEdit() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const isNew = id === "new";

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
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
  const [taxRate, setTaxRate] = useState("0");
  const [gender, setGender] = useState<string>("unisex");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brandId, setBrandId] = useState<string | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [status, setStatus] = useState<string>("draft");
  const [initialStatus, setInitialStatus] = useState<string>("draft");
  const [tags, setTags] = useState("");
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
    // Reset per-product edit-session state so leftover removals from a
    // previously edited product can never be applied to this one if the
    // screen instance is ever reused for a different id.
    setPendingImages([]);
    setRemovedImageIds([]);
    setRemovedVariantIds([]);
    setLoadError(null);

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
        if (!productRes.ok || !productRes.data) {
          setLoadError(!productRes.ok ? productRes.error : "This piece could not be found.");
          setLoading(false);
          return;
        }
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
        setMrp(p.mrp != null ? String(p.mrp) : "");
        setPrice(p.price != null ? String(p.price) : "");
        setTaxRate(String(taxRateToPercent(Number(p.tax_rate ?? 0))));
        setGender(p.gender ?? "unisex");
        setCategoryId(p.category_id ?? null);
        setBrandId((p as Product).brand_id ?? null);
        setStatus(p.status);
        setInitialStatus(p.status);
        setTags(p.tags?.join(", ") ?? "");
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
                stock: v.stock != null ? String(v.stock) : "",
              }))
            : [createEmptyVariant()];
        setVariants(loadedVariants);
        setInitialVariantIds(loadedVariants.map((v) => v.id).filter(Boolean) as string[]);
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
      if (res.error) {
        // The product record already exists at this point (created/updated before
        // syncImages runs), and everything after this call — including variants —
        // never gets saved. Throw a typed error so handleSave can tell the seller
        // the product now exists in a half-configured state, instead of a generic
        // failure message that hides that.
        throw new ImageSyncError(res.error, i, pendingImages.length);
      }
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
      Alert.alert("Check prices", "Selling price must be less than or equal to list price");
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
    let productId: string | undefined = isNew ? undefined : id;
    let nextModeration: ModerationResult = null;
    try {
      const mrpValue = Number(mrp) || priceNum;
      const nextStatus = coerceSellerProductStatus(
        status as Product["status"],
        initialStatus as Product["status"],
      );
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
        mrp: mrpValue,
        price: priceNum,
        discount_pct: computeDiscountPct(mrpValue, priceNum),
        tax_rate: percentToTaxRate(Number(taxRate) || 0),
        gender: gender as Product["gender"],
        category_id: categoryId ?? undefined,
        brand_id: brandId ?? undefined,
        // Sellers cannot self-publish. coerceSellerProductStatus
        // downgrades "active" → "pending" unless the product is already live.
        status: nextStatus,
        is_active: statusToIsActive(nextStatus),
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

      if (isNew) {
        const res = await createSellerProduct(productData);
        if (!res.ok) throw new Error(res.error);
        productId = res.data.product.id;
        nextModeration = res.data.moderation;
        setModeration(nextModeration);
      } else {
        const res = await updateSellerProduct(id!, productData);
        if (!res.ok) throw new Error(res.error);
        productId = res.data.product.id;
        nextModeration = res.data.moderation;
        setModeration(nextModeration);
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

      let banner = isNew ? "Piece saved" : "Piece updated";
      if (nextModeration) {
        if (nextModeration.auto_approved) {
          banner = `Auto-approved · score ${nextModeration.score}/${nextModeration.threshold} — live now`;
        } else if (nextModeration.flagged) {
          banner = `Pending review · score ${nextModeration.score}/${nextModeration.threshold}`;
        }
      }
      Alert.alert("Saved", banner, [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e: any) {
      if (e instanceof ImageSyncError && productId) {
        const failedCount = e.totalPending - e.uploadedCount;
        Alert.alert(
          "Product incomplete",
          `Product ${isNew ? "created" : "updated"}, but ${failedCount} of ${e.totalPending} image${e.totalPending === 1 ? "" : "s"} failed to upload and variants weren't saved. Please edit this product to finish setting it up.`,
          [
            {
              text: "Edit now",
              onPress: () => {
                if (isNew) router.replace(`/(seller)/products/${productId}` as any);
              },
            },
          ],
        );
      } else {
        Alert.alert("Error", e?.message ?? "Failed to save product");
      }
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

  const genders = ["men", "women", "kids", "unisex"] as const;
  const isLive = initialStatus === "active";
  const statuses = [
    { key: "draft", label: "Draft" },
    { key: "active", label: isLive ? "Live" : "Submit" },
    { key: "archived", label: "Archive" },
  ] as const;
  const computedDiscount = computeDiscountPct(Number(mrp) || 0, Number(price) || 0);
  const priceAheadOfMrp = Number(mrp) > 0 && Number(price) > Number(mrp);

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
      <SafeAreaView style={styles.loadingContainer} edges={["top"]}>
        <StatusBar barStyle="dark-content" />
        <View style={{ width: "100%", padding: spacing[5], gap: 14 }}>
          <Skeleton width={72} height={10} />
          <Skeleton width="55%" height={28} />
          <Skeleton height={120} borderRadius={radii.xl} style={{ marginTop: 8 }} />
          <Skeleton height={48} borderRadius={radii.lg} />
          <Skeleton height={48} borderRadius={radii.lg} />
          <Skeleton height={48} borderRadius={radii.lg} />
        </View>
      </SafeAreaView>
    );
  }

  if (loadError) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={["top"]}>
        <StatusBar barStyle="dark-content" />
        <Ionicons name="cloud-offline-outline" size={40} color={colors.olive[700]} />
        <Text style={styles.errorTitle}>Couldn’t open this piece</Text>
        <Text style={styles.errorSub}>{loadError}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => router.back()}>
          <Text style={styles.retryBtnText}>Back to collection</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
    <StatusBar barStyle="dark-content" />
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            accessibilityLabel="Back"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={20} color={colors.olive[800]} />
            <Text style={styles.backButton}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.kicker}>Atelier</Text>
          <Text style={styles.title}>{isNew ? "New piece" : "Edit piece"}</Text>
          <Text style={styles.subtitle}>Lookbook, stock, and listing details</Text>
        </View>
        <View style={styles.goldRule} />
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
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Classic cotton tee"
            placeholderTextColor={colors.light.mutedForeground}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>SKU</Text>
          <TextInput
            style={[styles.input, styles.monoInput]}
            value={sku}
            onChangeText={setSku}
            placeholder="e.g. LUXE-TS-001"
            placeholderTextColor={colors.light.mutedForeground}
            autoCapitalize="characters"
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>List price (LKR)</Text>
            <TextInput
              style={[styles.input, styles.monoInput]}
              value={mrp}
              onChangeText={setMrp}
              placeholder="0"
              keyboardType="numeric"
              placeholderTextColor={colors.light.mutedForeground}
            />
          </View>
          <View style={{ width: 12 }} />
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Selling price (LKR)</Text>
            <TextInput
              style={[styles.input, styles.monoInput, priceAheadOfMrp && styles.inputWarn]}
              value={price}
              onChangeText={setPrice}
              placeholder="0"
              keyboardType="numeric"
              placeholderTextColor={colors.light.mutedForeground}
            />
          </View>
        </View>
        {priceAheadOfMrp ? (
          <Text style={styles.fieldHintWarn}>Selling price cannot exceed list price.</Text>
        ) : computedDiscount > 0 ? (
          <Text style={styles.fieldHint}>{computedDiscount}% off list price</Text>
        ) : (
          <Text style={styles.fieldHint}>Discount is calculated from list vs selling price.</Text>
        )}

        <View style={styles.field}>
          <Text style={styles.label}>Tax</Text>
          <TextInput
            style={[styles.input, styles.monoInput]}
            value={taxRate}
            onChangeText={setTaxRate}
            placeholder="0"
            keyboardType="numeric"
            placeholderTextColor={colors.light.mutedForeground}
          />
          <Text style={[styles.fieldHint, { marginBottom: 0 }]}>Percent, e.g. 15 for 15% VAT.</Text>
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
          <Text style={styles.label}>Listing</Text>
          {isLive ? (
            <Text style={styles.liveStatusNote}>
              This piece is live. Submit again to re-run moderation. Archive hides it from shoppers.
            </Text>
          ) : (
            <Text style={styles.liveStatusNote}>
              Submit sends it for review. Archive keeps it out of the shop.
            </Text>
          )}
          <View style={styles.chipRow}>
            {statuses.map((s) => (
              <TouchableOpacity
                key={s.key}
                style={[styles.chip, status === s.key && styles.chipActive]}
                onPress={() => setStatus(s.key)}
              >
                <Text style={[styles.chipText, status === s.key && styles.chipTextActive]}>
                  {s.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={[styles.featureRow, isFeatured && styles.featureRowOn]}
            onPress={() => setIsFeatured((v) => !v)}
            accessibilityRole="switch"
            accessibilityState={{ checked: isFeatured }}
          >
            <Ionicons
              name={isFeatured ? "star" : "star-outline"}
              size={16}
              color={isFeatured ? GOLD : colors.olive[800]}
            />
            <Text style={[styles.featureText, isFeatured && styles.featureTextOn]}>
              {isFeatured ? "Featured in the lookbook" : "Not featured"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Tags</Text>
          <TextInput
            style={styles.input}
            value={tags}
            onChangeText={setTags}
            placeholder="cotton, casual, summer"
            placeholderTextColor={colors.light.mutedForeground}
          />
        </View>

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
                  {r.message}
                </Text>
              ))}
            </View>
          ) : null}
          <Text style={styles.preflightHint}>
            Updates as you type. Final check runs on save.
          </Text>
        </View>

        {!isNew ? (
          <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteProduct}>
            <Text style={styles.deleteButtonText}>Remove from the collection</Text>
          </TouchableOpacity>
        ) : null}

        <View style={{ height: 24 }} />
      </ScrollView>
      <View style={styles.saveBar}>
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={CREAM} />
          ) : (
            <Text style={styles.saveButtonText}>
              {isNew ? "Add to collection" : "Save piece"}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  content: { paddingHorizontal: spacing[5], paddingTop: spacing[3], paddingBottom: spacing[4] },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.light.background,
    paddingHorizontal: 32,
    gap: 8,
  },
  errorTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 22,
    color: INK,
    marginTop: 12,
    textAlign: "center",
  },
  errorSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
    textAlign: "center",
    lineHeight: 20,
  },
  retryBtn: {
    marginTop: 16,
    backgroundColor: colors.olive[800],
    paddingHorizontal: 18,
    minHeight: 44,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
  },
  retryBtnText: {
    color: CREAM,
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.sm,
  },

  header: { marginBottom: spacing[3] },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    minHeight: 44,
    marginLeft: -8,
    marginBottom: 4,
  },
  backButton: {
    fontSize: typography.fontSizes.sm,
    color: colors.olive[800],
    fontFamily: fontFamilies.sans.medium,
  },
  kicker: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 10,
    letterSpacing: typography.letterSpacing.editorial,
    textTransform: "uppercase",
    color: colors.olive[700],
    marginBottom: 2,
  },
  title: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 28,
    color: INK,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    marginTop: 4,
  },
  goldRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(200,164,74,0.55)",
    marginBottom: spacing[4],
  },

  field: { marginBottom: 16 },
  label: {
    fontSize: 11,
    fontFamily: fontFamilies.sans.medium,
    color: colors.olive[800],
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  input: {
    backgroundColor: CREAM,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.14)",
    borderRadius: radii.xl,
    paddingHorizontal: 14,
    minHeight: 48,
    fontSize: typography.fontSizes.sm,
    fontFamily: fontFamilies.sans.regular,
    color: INK,
  },
  monoInput: {
    fontFamily: fontFamilies.mono.regular,
  },
  inputWarn: {
    borderColor: "rgba(184,92,58,0.45)",
  },
  fieldHint: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: colors.light.mutedForeground,
    marginTop: 6,
    marginBottom: 14,
  },
  fieldHintWarn: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 11,
    color: RUST,
    marginTop: 6,
    marginBottom: 14,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
    textAlignVertical: "top",
  },

  row: { flexDirection: "row" },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    minHeight: 36,
    justifyContent: "center",
    borderRadius: radii.full,
    backgroundColor: CREAM,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.14)",
  },
  chipActive: {
    backgroundColor: colors.olive[800],
    borderColor: colors.olive[800],
  },
  chipText: {
    fontSize: typography.fontSizes.sm,
    fontFamily: fontFamilies.sans.medium,
    color: colors.olive[800],
  },
  chipTextActive: { color: CREAM },
  liveStatusNote: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    marginBottom: 8,
    lineHeight: 18,
  },
  featureRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: radii.xl,
    backgroundColor: CREAM,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.14)",
  },
  featureRowOn: {
    borderColor: "rgba(200,164,74,0.55)",
    backgroundColor: "#f7f1de",
  },
  featureText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: typography.fontSizes.sm,
    color: colors.olive[800],
  },
  featureTextOn: { color: INK },

  saveBar: {
    paddingHorizontal: spacing[5],
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: colors.light.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(200,164,74,0.35)",
  },
  saveButton: {
    backgroundColor: colors.olive[800],
    minHeight: 48,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: {
    color: CREAM,
    fontSize: typography.fontSizes.base,
    fontFamily: fontFamilies.sans.semibold,
  },
  deleteButton: {
    marginTop: 8,
    minHeight: 44,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(184,92,58,0.35)",
    backgroundColor: "#f4e6df",
  },
  deleteButtonText: {
    color: RUST,
    fontSize: typography.fontSizes.sm,
    fontFamily: fontFamilies.sans.semibold,
  },

  preflightCard: {
    marginTop: 8,
    marginBottom: 16,
    padding: 14,
    borderRadius: radii.xl,
    borderWidth: 1,
    backgroundColor: CREAM,
  },
  preflightIdle: { borderColor: "rgba(83,94,44,0.14)" },
  preflightApproved: { borderColor: "rgba(83,94,44,0.35)", backgroundColor: colors.olive[50] },
  preflightPending: { borderColor: "rgba(200,164,74,0.45)", backgroundColor: "#f3efe2" },
  preflightFlagged: { borderColor: "rgba(184,92,58,0.35)", backgroundColor: "#f4e6df" },
  preflightHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  preflightTitle: {
    fontSize: typography.fontSizes.sm,
    fontFamily: fontFamilies.display.semibold,
    color: INK,
  },
  preflightScore: {
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    fontFamily: fontFamilies.mono.medium,
  },
  preflightReason: {
    fontSize: 11,
    fontFamily: fontFamilies.sans.regular,
    color: colors.light.mutedForeground,
    marginTop: 2,
  },
  preflightHint: {
    fontSize: 10,
    fontFamily: fontFamilies.sans.regular,
    color: colors.light.mutedForeground,
    marginTop: 6,
  },
});
