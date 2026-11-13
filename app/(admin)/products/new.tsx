import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui";
import { getAdminStores, getAdminCategories, createAdminProduct } from "@/lib/api";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";
import { themedAlert } from "@/lib/themed-alert";

const INK = colors.olive[950];
const RUST = "#7a2f1a";
const CREAM = colors.paper.cream;

export default function AdminNewProductScreen() {
  const params = useLocalSearchParams<{ storeId?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const [storeId, setStoreId] = useState(params.storeId || "");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [mrp, setMrp] = useState("");
  const [stock, setStock] = useState("10");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [storePickerOpen, setStorePickerOpen] = useState(false);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);

  const storesQ = useQuery({
    queryKey: ["admin-stores-picker"],
    queryFn: async () => {
      const r = await getAdminStores({ limit: 100 });
      return r.ok ? r.data.stores : [];
    },
  });

  const categoriesQ = useQuery({
    queryKey: ["admin-categories-picker"],
    queryFn: async () => {
      const r = await getAdminCategories();
      return r.ok ? r.data : [];
    },
  });

  useEffect(() => {
    if (params.storeId && !storeId) {
      setStoreId(params.storeId);
    }
  }, [params.storeId, storeId]);

  const selectedStore = useMemo(() => {
    return (storesQ.data ?? []).find((s) => s.id === storeId);
  }, [storesQ.data, storeId]);

  const selectedCategory = useMemo(() => {
    return (categoriesQ.data ?? []).find((c) => c.id === categoryId);
  }, [categoriesQ.data, categoryId]);

  const createM = useMutation({
    mutationFn: async () => {
      if (!storeId) throw new Error("Please select a store");
      if (!name.trim()) throw new Error("Product title is required");
      const numPrice = Number(price);
      if (isNaN(numPrice) || numPrice <= 0) throw new Error("Valid price is required");

      const numMrp = mrp ? Number(mrp) : numPrice;
      const numStock = stock ? parseInt(stock, 10) : 10;

      const payload: Record<string, unknown> = {
        store_id: storeId,
        name: name.trim(),
        price: numPrice,
        mrp: numMrp,
        initial_stock: isNaN(numStock) ? 10 : numStock,
        status: isActive ? "active" : "draft",
        is_active: isActive,
        description: description.trim() || undefined,
        category_id: categoryId || undefined,
      };

      if (imageUrl.trim()) {
        payload.images = [imageUrl.trim()];
      }

      const res = await createAdminProduct(payload);
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-store", storeId] });
      qc.invalidateQueries({ queryKey: ["cat-products"] });
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      themedAlert(
        "Product Uploaded",
        `"${name}" has been published for ${selectedStore?.name || "the store"}.`,
        [{ text: "OK", onPress: () => router.back() }]
      );
    },
    onError: (err: any) => {
      themedAlert("Upload Failed", err?.message || "Could not create product.");
    },
  });

  const canSubmit = !!storeId && !!name.trim() && Number(price) > 0 && !createM.isPending;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 8 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={24} color={INK} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>Admin concierge</Text>
          <Text style={styles.title}>Upload for store</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Store Selection */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>1. Target Store</Text>
          <Text style={styles.hint}>
            The verified boutique where this product will be listed.
          </Text>
          <TouchableOpacity
            style={styles.pickerRow}
            onPress={() => setStorePickerOpen(true)}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>STORE</Text>
              <Text style={styles.pickerValue}>
                {selectedStore ? selectedStore.name : "Select a store..."}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.ink.mute} />
          </TouchableOpacity>
        </View>

        {/* Product Details */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>2. Product Details</Text>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>TITLE / NAME *</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Cotton Embroidered Kurti"
              placeholderTextColor="rgba(101,104,77,0.55)"
              style={styles.input}
            />
          </View>

          <View style={styles.grid}>
            <View style={styles.gridCell}>
              <Text style={styles.fieldLabel}>SELLING PRICE (LKR) *</Text>
              <TextInput
                value={price}
                onChangeText={setPrice}
                placeholder="6500"
                keyboardType="numeric"
                placeholderTextColor="rgba(101,104,77,0.55)"
                style={styles.input}
              />
            </View>
            <View style={styles.gridCell}>
              <Text style={styles.fieldLabel}>MRP / LIST (LKR)</Text>
              <TextInput
                value={mrp}
                onChangeText={setMrp}
                placeholder="7500"
                keyboardType="numeric"
                placeholderTextColor="rgba(101,104,77,0.55)"
                style={styles.input}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>STOCK QUANTITY (UNITS) *</Text>
            <TextInput
              value={stock}
              onChangeText={setStock}
              placeholder="10"
              keyboardType="number-pad"
              placeholderTextColor="rgba(101,104,77,0.55)"
              style={styles.input}
            />
          </View>

          {/* Category Picker */}
          <TouchableOpacity
            style={styles.pickerRow}
            onPress={() => setCategoryPickerOpen(true)}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>CATEGORY</Text>
              <Text style={styles.pickerValue}>
                {selectedCategory ? selectedCategory.name : "Select category (optional)..."}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.ink.mute} />
          </TouchableOpacity>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>DESCRIPTION / STORY</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Fabric details, fit, sizing guide, or brand notes..."
              placeholderTextColor="rgba(101,104,77,0.55)"
              multiline
              numberOfLines={3}
              style={[styles.input, { height: 80, textAlignVertical: "top", paddingTop: 10 }]}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>IMAGE URL</Text>
            <TextInput
              value={imageUrl}
              onChangeText={setImageUrl}
              placeholder="https://... image link"
              placeholderTextColor="rgba(101,104,77,0.55)"
              autoCapitalize="none"
              keyboardType="url"
              style={styles.input}
            />
          </View>

          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleTitle}>Publish immediately</Text>
              <Text style={styles.toggleSub}>Active and available for buyers</Text>
            </View>
            <Switch value={isActive} onValueChange={setIsActive} />
          </View>
        </View>
      </ScrollView>

      {/* Sticky Bottom Save Bar */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TouchableOpacity
          onPress={() => createM.mutate()}
          disabled={!canSubmit}
          style={[styles.submitBtn, !canSubmit && { opacity: 0.5 }]}
          accessibilityRole="button"
        >
          {createM.isPending ? (
            <ActivityIndicator color={CREAM} />
          ) : (
            <Text style={styles.submitText}>Upload & Publish</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Store Picker Modal */}
      <Modal visible={storePickerOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setStorePickerOpen(false)}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Select Store</Text>
          <ScrollView style={{ maxHeight: 350 }}>
            {(storesQ.data ?? []).map((s) => (
              <TouchableOpacity
                key={s.id}
                style={styles.modalItem}
                onPress={() => {
                  setStoreId(s.id);
                  setStorePickerOpen(false);
                }}
              >
                <Text style={styles.modalItemText}>{s.name}</Text>
                {s.id === storeId && (
                  <Ionicons name="checkmark" size={18} color={colors.olive[700]} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Category Picker Modal */}
      <Modal visible={categoryPickerOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setCategoryPickerOpen(false)}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Select Category</Text>
          <ScrollView style={{ maxHeight: 350 }}>
            {(categoriesQ.data ?? []).map((c) => (
              <TouchableOpacity
                key={c.id}
                style={styles.modalItem}
                onPress={() => {
                  setCategoryId(c.id);
                  setCategoryPickerOpen(false);
                }}
              >
                <Text style={styles.modalItemText}>{c.name}</Text>
                {c.id === categoryId && (
                  <Ionicons name="checkmark" size={18} color={colors.olive[700]} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: colors.paper.cream,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(22,23,15,0.1)",
  },
  kicker: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 1.2,
    color: colors.ink.mute,
    textTransform: "uppercase",
  },
  title: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 19,
    color: INK,
    letterSpacing: -0.3,
  },
  content: { padding: 16, gap: 14 },
  card: {
    backgroundColor: colors.paper.cream,
    borderRadius: radii.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(22,23,15,0.08)",
  },
  cardTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 16,
    color: INK,
  },
  hint: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.ink.mute,
    marginTop: 4,
    marginBottom: 12,
  },
  field: { marginBottom: 12 },
  fieldLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9.5,
    letterSpacing: 1.2,
    color: colors.ink.mute,
    marginBottom: 6,
  },
  input: {
    height: 44,
    paddingHorizontal: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(22,23,15,0.12)",
    backgroundColor: colors.paper.DEFAULT,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 14,
    color: INK,
  },
  grid: { flexDirection: "row", gap: 10, marginBottom: 12 },
  gridCell: { flex: 1 },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(22,23,15,0.1)",
    marginBottom: 12,
  },
  pickerValue: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 14,
    color: INK,
    marginTop: 2,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(22,23,15,0.08)",
  },
  toggleTitle: { fontFamily: fontFamilies.sans.medium, fontSize: 13, color: INK },
  toggleSub: { fontFamily: fontFamilies.sans.regular, fontSize: 11, color: colors.ink.mute },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    backgroundColor: colors.paper.cream,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(22,23,15,0.15)",
  },
  submitBtn: {
    height: 48,
    borderRadius: radii.full,
    backgroundColor: colors.olive[900],
    alignItems: "center",
    justifyContent: "center",
  },
  submitText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 15,
    color: CREAM,
  },
  modalContent: {
    padding: 20,
    backgroundColor: colors.paper.cream,
    borderRadius: radii.xl,
  },
  modalTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 18,
    color: INK,
    marginBottom: 12,
  },
  modalItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(22,23,15,0.08)",
  },
  modalItemText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 14,
    color: INK,
  },
});
