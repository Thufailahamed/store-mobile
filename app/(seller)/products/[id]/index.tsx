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

function EditorSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}
      </View>
      {children}
    </View>
  );
}

/** Text input with a fixed unit shown inside the field (LKR, %). */
function AffixInput({
  prefix,
  suffix,
  warn,
  ...props
}: React.ComponentProps<typeof TextInput> & { prefix?: string; suffix?: string; warn?: boolean }) {
  return (
    <View style={[styles.affixWrap, warn && styles.inputWarn]}>
      {prefix ? <Text style={styles.affixText}>{prefix}</Text> : null}
      <TextInput
        {...props}
        style={styles.affixInput}
        placeholderTextColor={colors.light.mutedForeground}
      />
      {suffix ? <Text style={styles.affixText}>{suffix}</Text> : null}
    </View>
  );
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
  const [showAttributes, setShowAttributes] = useState(false);

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
    <View style={styles.topBar}>
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Back to products"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="chevron-back" size={20} color={INK} />
      </TouchableOpacity>
      <View style={styles.headerCopy}>
        <Text style={styles.title} numberOfLines={1}>{isNew ? "New product" : "Edit product"}</Text>
        {!isNew && name.trim() ? <Text style={styles.subtitle} numberOfLines={1}>{name.trim()}</Text> : null}
      </View>
      <View style={[styles.headerStatus, status === "active" && styles.headerStatusLive]}>
        <View style={[styles.headerStatusDot, status === "active" && styles.headerStatusDotLive]} />
        <Text style={[styles.headerStatusText, status === "active" && styles.headerStatusTextLive]}>
          {status === "active" ? "Live" : status === "pending" ? "In review" : status === "archived" ? "Archived" : "Draft"}
        </Text>
      </View>
    </View>
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
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

        <EditorSection title="Details">
          <View style={styles.field}>
            <Text style={styles.label}>Product name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Classic cotton tee"
              placeholderTextColor={colors.light.mutedForeground}
            />
          </View>

          <View style={[styles.field, { marginBottom: 0 }]}>
            <Text style={styles.label}>SKU</Text>
            <TextInput
              style={[styles.input, styles.monoInput]}
              value={sku}
              onChangeText={setSku}
              placeholder="e.g. LUXE-TS-001"
              placeholderTextColor={colors.light.mutedForeground}
              autoCapitalize="characters"
              autoCorrect={false}
            />
          </View>
        </EditorSection>

        <EditorSection title="Pricing">
          <View style={styles.row}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Selling price</Text>
              <AffixInput
                prefix="LKR"
                value={price}
                onChangeText={setPrice}
                placeholder="0"
                keyboardType="numeric"
                warn={priceAheadOfMrp}
              />
            </View>
            <View style={{ width: 12 }} />
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>Compare-at price</Text>
              <AffixInput
                prefix="LKR"
                value={mrp}
                onChangeText={setMrp}
                placeholder="Optional"
                keyboardType="numeric"
              />
            </View>
          </View>
          {priceAheadOfMrp ? (
            <View style={[styles.priceNote, styles.priceNoteWarn]}>
              <Ionicons name="alert-circle-outline" size={15} color={RUST} />
              <Text style={styles.fieldHintWarn}>Selling price can’t be higher than the compare-at price.</Text>
            </View>
          ) : computedDiscount > 0 ? (
            <View style={styles.priceNote}>
              <Ionicons name="pricetag-outline" size={15} color={colors.olive[700]} />
              <Text style={styles.priceNoteText}>Shoppers see <Text style={styles.priceNoteStrong}>{computedDiscount}% off</Text></Text>
            </View>
          ) : (
            <Text style={styles.fieldHint}>Set a compare-at price above the selling price to show a discount.</Text>
          )}

          <View style={[styles.field, { marginBottom: 0 }]}>
            <Text style={styles.label}>Tax rate</Text>
            <View style={{ width: "48%" }}>
              <AffixInput
                suffix="%"
                value={taxRate}
                onChangeText={setTaxRate}
                placeholder="0"
                keyboardType="numeric"
              />
            </View>
          </View>
        </EditorSection>

        <ProductVariantsSection
          variants={variants}
          basePrice={price}
          onChange={trackRemovedVariant}
        />

        <EditorSection title="Description">
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

        <TouchableOpacity
          style={[styles.disclosure, !showAttributes && { marginBottom: 0 }]}
          onPress={() => setShowAttributes((v) => !v)}
          accessibilityRole="button"
          accessibilityState={{ expanded: showAttributes }}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.disclosureTitle}>Attributes</Text>
            <Text style={styles.disclosureHint} numberOfLines={1}>
              {[material, pattern, fit, sleeve, season, occasion].filter((v) => v.trim()).join(" · ") ||
                "Material, fit, season, care — helps search and filters"}
            </Text>
          </View>
          <Ionicons name={showAttributes ? "chevron-up" : "chevron-down"} size={18} color={colors.olive[800]} />
        </TouchableOpacity>

        {showAttributes ? (
        <>
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
        </>
        ) : null}
        </EditorSection>

        <EditorSection title="Organise" hint="Where shoppers find this product">
        <View style={styles.field}>
          <Text style={styles.label}>Brand</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipScroll}
            contentContainerStyle={styles.chipScrollContent}
          >
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
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipScroll}
            contentContainerStyle={styles.chipScrollContent}
          >
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

        <View style={[styles.field, { marginBottom: 0 }]}>
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
        </EditorSection>

        <EditorSection title="Visibility">
        <View style={styles.field}>
          {isLive ? (
            <Text style={styles.liveStatusNote}>
              This piece is live. Submit again to re-run moderation. Archive hides it from shoppers.
            </Text>
          ) : (
            <Text style={styles.liveStatusNote}>
              Submit sends it for review. Archive keeps it out of the shop.
            </Text>
          )}
          <View style={styles.segmented}>
            {statuses.map((s) => (
              <TouchableOpacity
                key={s.key}
                style={[styles.segment, status === s.key && styles.segmentActive]}
                onPress={() => setStatus(s.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: status === s.key }}
              >
                <Text style={[styles.segmentText, status === s.key && styles.segmentTextActive]} numberOfLines={1}>
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
            <View style={{ flex: 1 }}>
              <Text style={[styles.featureText, isFeatured && styles.featureTextOn]}>Feature on storefront</Text>
              <Text style={styles.featureHint}>Highlights this product in featured sections</Text>
            </View>
            <View style={[styles.toggle, isFeatured && styles.toggleOn]}>
              <View style={[styles.toggleKnob, isFeatured && styles.toggleKnobOn]} />
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Search tags</Text>
          <TextInput
            style={styles.input}
            value={tags}
            onChangeText={setTags}
            placeholder="cotton, casual, summer"
            placeholderTextColor={colors.light.mutedForeground}
            autoCapitalize="none"
          />
          <Text style={[styles.fieldHint, { marginBottom: 0 }]}>Separate with commas.</Text>
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
        </EditorSection>

        {!isNew ? (
          <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteProduct} accessibilityRole="button">
            <Ionicons name="trash-outline" size={16} color={RUST} />
            <Text style={styles.deleteButtonText}>Delete product</Text>
          </TouchableOpacity>
        ) : null}

        <View style={{ height: 24 }} />
      </ScrollView>
      <View style={styles.saveBar}>
        {preflight || preflightBusy ? (
          <View style={styles.saveSummary}>
            <View
              style={[
                styles.saveSummaryDot,
                preflight?.flagged ? styles.dotFlagged : preflight?.auto_approved ? styles.dotOk : styles.dotPending,
              ]}
            />
            <View style={styles.saveSummaryCopy}>
              <Text style={styles.saveSummaryTitle} numberOfLines={1}>
                {preflightBusy
                  ? "Checking…"
                  : preflight?.auto_approved
                    ? "Auto-approval likely"
                    : preflight?.flagged
                      ? "Will be flagged"
                      : "Needs review"}
              </Text>
              <Text style={styles.saveSummaryHint} numberOfLines={1}>Moderation check</Text>
            </View>
          </View>
        ) : null}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
          accessibilityRole="button"
        >
          {saving ? (
            <ActivityIndicator color={CREAM} />
          ) : (
            <>
              <Ionicons name="checkmark" size={18} color={CREAM} />
              <Text style={styles.saveButtonText}>{isNew ? "Add product" : "Save changes"}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  content: { paddingHorizontal: spacing[4], paddingTop: spacing[2], paddingBottom: spacing[7] },
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

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: spacing[4],
    paddingTop: 6,
    paddingBottom: 12,
    backgroundColor: colors.light.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(83,94,44,0.12)",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.14)",
  },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { fontFamily: fontFamilies.display.semibold, fontSize: 20, lineHeight: 25, color: INK, letterSpacing: -0.3 },
  subtitle: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.light.mutedForeground, marginTop: 1 },
  headerStatus: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 11, paddingVertical: 7, borderRadius: radii.full, backgroundColor: colors.paper.warm },
  headerStatusLive: { backgroundColor: colors.olive[50] },
  headerStatusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.ink.mute },
  headerStatusDotLive: { backgroundColor: "#4E8D42" },
  headerStatusText: { fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: colors.ink.mute },
  headerStatusTextLive: { color: colors.olive[800] },
  sectionCard: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "rgba(83,94,44,0.12)", borderRadius: 22, padding: 16, marginBottom: 14 },
  sectionHeader: { marginBottom: 16, gap: 3 },
  sectionTitle: { fontFamily: fontFamilies.display.semibold, fontSize: 19, color: INK },
  sectionHint: { fontFamily: fontFamilies.sans.regular, fontSize: 13, color: colors.light.mutedForeground },

  field: { marginBottom: 16 },
  label: {
    fontSize: 13,
    fontFamily: fontFamilies.sans.medium,
    color: colors.olive[900],
    marginBottom: 7,
  },
  input: {
    backgroundColor: "#FAF9F5",
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.14)",
    borderRadius: 14,
    paddingHorizontal: 14,
    minHeight: 50,
    fontSize: 15,
    fontFamily: fontFamilies.sans.regular,
    color: INK,
  },
  monoInput: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 14,
  },
  inputWarn: {
    borderColor: "rgba(184,92,58,0.55)",
    backgroundColor: "#FFF8F4",
  },
  affixWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FAF9F5",
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.14)",
    borderRadius: 14,
    paddingHorizontal: 14,
    minHeight: 50,
  },
  affixText: { fontFamily: fontFamilies.sans.medium, fontSize: 13, color: colors.light.mutedForeground },
  affixInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    fontSize: 15,
    fontFamily: fontFamilies.sans.medium,
    color: INK,
    fontVariant: ["tabular-nums"],
  },
  fieldHint: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.light.mutedForeground,
    marginTop: -6,
    marginBottom: 16,
  },
  fieldHintWarn: {
    flex: 1,
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12,
    lineHeight: 17,
    color: RUST,
  },
  priceNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: -6,
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: colors.olive[50],
  },
  priceNoteWarn: { backgroundColor: "rgba(184,92,58,0.08)" },
  priceNoteText: { flex: 1, fontFamily: fontFamilies.sans.regular, fontSize: 13, color: colors.olive[900] },
  priceNoteStrong: { fontFamily: fontFamilies.sans.semibold },
  textArea: {
    minHeight: 100,
    paddingTop: 13,
    textAlignVertical: "top",
  },

  row: { flexDirection: "row" },

  disclosure: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 58,
    paddingHorizontal: 14,
    marginBottom: 16,
    borderRadius: 14,
    backgroundColor: colors.olive[50],
  },
  disclosureTitle: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: INK },
  disclosureHint: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.light.mutedForeground, marginTop: 2 },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chipScroll: { marginHorizontal: -16 },
  chipScrollContent: { paddingHorizontal: 16, gap: 8 },
  chip: {
    paddingHorizontal: 14,
    minHeight: 38,
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
    fontSize: 14,
    fontFamily: fontFamilies.sans.medium,
    color: colors.olive[800],
  },
  chipTextActive: { color: CREAM },
  segmented: {
    flexDirection: "row",
    padding: 4,
    gap: 4,
    borderRadius: 16,
    backgroundColor: colors.olive[50],
  },
  segment: { flex: 1, minHeight: 40, alignItems: "center", justifyContent: "center", borderRadius: 12, paddingHorizontal: 4 },
  segmentActive: { backgroundColor: "#FFFFFF", shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  segmentText: { fontFamily: fontFamilies.sans.medium, fontSize: 13, color: colors.olive[700] },
  segmentTextActive: { fontFamily: fontFamilies.sans.semibold, color: INK },
  liveStatusNote: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    color: colors.light.mutedForeground,
    marginBottom: 12,
    lineHeight: 19,
  },
  featureRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 60,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: "#FAF9F5",
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.14)",
  },
  featureRowOn: {
    borderColor: "rgba(200,164,74,0.55)",
    backgroundColor: "#f7f1de",
  },
  featureText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14,
    color: colors.olive[900],
  },
  featureTextOn: { color: INK },
  featureHint: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.light.mutedForeground, marginTop: 2 },
  toggle: { width: 44, height: 26, borderRadius: 13, padding: 3, backgroundColor: "rgba(83,94,44,0.2)" },
  toggleOn: { backgroundColor: GOLD },
  toggleKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#FFFFFF" },
  toggleKnobOn: { transform: [{ translateX: 18 }] },

  saveBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: spacing[4],
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: "#FFFFFF",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(83,94,44,0.14)",
  },
  saveSummary: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 9 },
  saveSummaryDot: { width: 9, height: 9, borderRadius: 5 },
  dotOk: { backgroundColor: "#4E8D42" },
  dotPending: { backgroundColor: GOLD },
  dotFlagged: { backgroundColor: RUST },
  saveSummaryCopy: { flex: 1, minWidth: 0 },
  saveSummaryTitle: { fontFamily: fontFamilies.sans.semibold, fontSize: 13, color: INK },
  saveSummaryHint: { marginTop: 1, fontFamily: fontFamilies.sans.regular, fontSize: 11, color: colors.ink.mute },
  saveButton: {
    flex: 1,
    minHeight: 52,
    flexDirection: "row",
    gap: 7,
    backgroundColor: colors.olive[900],
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: CREAM, fontSize: 16, fontFamily: fontFamilies.sans.semibold },
  deleteButton: {
    marginTop: 4,
    minHeight: 48,
    flexDirection: "row",
    gap: 7,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteButtonText: {
    color: RUST,
    fontSize: 14,
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
    fontSize: 15,
    fontFamily: fontFamilies.display.semibold,
    color: INK,
  },
  preflightScore: {
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    fontFamily: fontFamilies.mono.medium,
  },
  preflightReason: {
    fontSize: 13,
    fontFamily: fontFamilies.sans.regular,
    color: colors.light.mutedForeground,
    marginTop: 2,
  },
  preflightHint: {
    fontSize: 12,
    fontFamily: fontFamilies.sans.regular,
    color: colors.light.mutedForeground,
    marginTop: 6,
  },
});
