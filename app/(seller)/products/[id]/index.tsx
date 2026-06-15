import React, { useEffect, useState } from "react";
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
} from "@/lib/api";
import { colors, typography, radii } from "@/lib/theme/tokens";
import type { Product } from "@/lib/types";

export default function SellerProductEdit() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const isNew = id === "new";

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
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
        }
      }
      setLoading(false);
    })();
  }, [user, isNew, id]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Error", "Product name is required");
      return;
    }
    if (!price || isNaN(Number(price))) {
      Alert.alert("Error", "Valid price is required");
      return;
    }
    if (!storeId) {
      Alert.alert("Error", "Store not found");
      return;
    }

    setSaving(true);
    const productData: Partial<Product> = {
      name: name.trim(),
      sku: sku.trim() || undefined,
      description: description.trim() || undefined,
      mrp: Number(mrp) || Number(price),
      price: Number(price),
      discount_pct: Number(discountPct) || 0,
      gender: gender as any,
      status: status as any,
      tags: tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      store_id: storeId,
      currency: "LKR",
      is_active: status === "active",
    };

    let res;
    if (isNew) {
      res = await createSellerProduct(productData);
    } else {
      res = await updateSellerProduct(id!, productData);
    }

    setSaving(false);
    if (res.ok) {
      Alert.alert("Success", isNew ? "Product created" : "Product updated", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } else {
      Alert.alert("Error", res.error);
    }
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
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{isNew ? "New Product" : "Edit Product"}</Text>
        </View>

        {/* Name */}
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

        {/* SKU */}
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

        {/* Price Row */}
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

        {/* Discount */}
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

        {/* Description */}
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

        {/* Gender */}
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

        {/* Status */}
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

        {/* Tags */}
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

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>
            {saving ? "Saving..." : isNew ? "Create Product" : "Save Changes"}
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
