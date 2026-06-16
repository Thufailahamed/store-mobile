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
  deleteSellerProductImage,
  setSellerProductImagePrimary,
  saveSellerVariants,
  type SellerVariantInput,
} from "@/lib/api";
import { uploadProductImage } from "@/lib/upload";
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
import type { Product, ProductImage } from "@/lib/types";

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
  const [mrp, setMrp] = useState("");
  const [price, setPrice] = useState("");
  const [discountPct, setDiscountPct] = useState("0");
  const [gender, setGender] = useState<string>("unisex");
  const [status, setStatus] = useState<string>("draft");
  const [tags, setTags] = useState("");

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

      if (!isNew && id) {
        const productRes = await getSellerProductById(id);
        if (productRes.ok && productRes.data) {
          const p = productRes.data;
          setName(p.name);
          setSku(p.sku ?? "");
          setDescription(p.description ?? "");
          setMrp(String(p.mrp));
          setPrice(String(p.price));
          setDiscountPct(String(p.discount_pct));
          setGender(p.gender ?? "unisex");
          setStatus(p.status);
          setTags(p.tags?.join(", ") ?? "");
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

    setSaving(true);
    try {
      const productData: Partial<Product> = {
        name: name.trim(),
        sku: sku.trim() || undefined,
        description: description.trim() || undefined,
        mrp: Number(mrp) || Number(price),
        price: Number(price),
        discount_pct: Number(discountPct) || 0,
        gender: gender as Product["gender"],
        status: status as Product["status"],
        tags: tags
          ? tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
        store_id: storeId,
        currency: "LKR",
        is_active: status === "active",
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
  const statuses = ["draft", "pending", "active"];

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

        <ProductVariantsSection
          variants={variants}
          basePrice={price}
          onChange={trackRemovedVariant}
        />

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
          <Text style={styles.label}>Status</Text>
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

  row: { flexDirection: "row" },

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
});
