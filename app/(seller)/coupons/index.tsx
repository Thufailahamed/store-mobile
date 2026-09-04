import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  RefreshControl,
  Alert,
  Switch,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { useAuth } from "@/lib/supabase/auth";
import {
  getSellerStore,
  getStoreCoupons,
  createStoreCoupon,
  updateStoreCoupon,
  deleteStoreCoupon,
  toggleCoupon,
  searchProductsBackend,
} from "@/lib/api";
import { colors, typography, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import type { AdminCoupon } from "@/lib/api";

const COUPON_TYPES = [
  { key: "percentage", label: "Percentage", icon: "percent-outline" as const },
  { key: "fixed", label: "Fixed Amount", icon: "cash-outline" as const },
  { key: "free_shipping", label: "Free Shipping", icon: "bicycle-outline" as const },
  { key: "bxgy", label: "Buy X Get Y", icon: "gift-outline" as const },
] as const;

/** Map a coupon type to its badge background style. Was previously a
 *  ternary that silently treated `bxgy` as `free_shipping` ("FREE" badge). */
function typeBadgeStyle(type: AdminCoupon["type"]) {
  switch (type) {
    case "percentage":   return s.badgePercentage;
    case "fixed":        return s.badgeFixed;
    case "free_shipping": return s.badgeShipping;
    case "bxgy":         return s.badgeBxgy;
    default:             return s.badgeShipping;
  }
}

function typeBadgeLabel(coupon: AdminCoupon) {
  if (coupon.type === "percentage") return `${coupon.value}%`;
  if (coupon.type === "fixed") return `Rs.${coupon.value}`;
  if (coupon.type === "bxgy") return "BXGY";
  return "FREE";
}

export default function SellerCoupons() {
  const { user } = useAuth();
  const [coupons, setCoupons] = useState<AdminCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<AdminCoupon | null>(null);

  // Create/edit form
  const [code, setCode] = useState("");
  const [type, setType] = useState<string>("percentage");
  const [value, setValue] = useState("");
  const [minOrder, setMinOrder] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // BXGY state — used when type === 'bxgy'. The fields round-trip through
  // AdminCoupon.bxgy_* properties. Buy and get product ids are selected via
  // the same ProductPicker the storefront editor uses (debounced search).
  const [bxgyBuyProductIds, setBxgyBuyProductIds] = useState<string[]>([]);
  const [bxgyBuyQuantity, setBxgyBuyQuantity] = useState("1");
  const [bxgyGetProductIds, setBxgyGetProductIds] = useState<string[]>([]);
  const [bxgyGetQuantity, setBxgyGetQuantity] = useState("1");
  const [bxgyGetDiscountPct, setBxgyGetDiscountPct] = useState("100");

  // Product picker modal — shared between buy and get side of BXGY.
  const [pickerOpen, setPickerOpen] = useState<null | "buy" | "get">(null);
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerResults, setPickerResults] = useState<
    Array<{ id: string; name: string; slug?: string; price?: number; image_url?: string | null }>
  >([]);
  const [pickerSearching, setPickerSearching] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) return;
    const storeRes = await getSellerStore(user.id);
    if (storeRes.ok && storeRes.data) {
      const res = await getStoreCoupons(storeRes.data.id);
      if (res.ok) setCoupons(res.data);
    }
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const handleToggle = async (coupon: AdminCoupon) => {
    const res = await toggleCoupon(coupon.id, !coupon.is_active);
    if (res.ok) {
      setCoupons((prev) =>
        prev.map((c) => (c.id === coupon.id ? { ...c, is_active: !c.is_active } : c))
      );
    }
  };

  const handleDelete = (coupon: AdminCoupon) => {
    Alert.alert(
      "Delete coupon?",
      `Permanently remove "${coupon.code}". Customers with the code will no longer be able to redeem it.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeletingId(coupon.id);
            const res = await deleteStoreCoupon(coupon.id);
            setDeletingId(null);
            if (res.ok) {
              setCoupons((prev) => prev.filter((c) => c.id !== coupon.id));
            } else {
              Alert.alert("Delete failed", res.error);
            }
          },
        },
      ],
    );
  };

  const openEdit = (coupon: AdminCoupon) => {
    setEditing(coupon);
    setCode(coupon.code);
    setType(coupon.type);
    setValue(String(coupon.value ?? 0));
    setMinOrder(coupon.min_order_total != null ? String(coupon.min_order_total) : "");
    setMaxUses(coupon.max_uses != null ? String(coupon.max_uses) : "");
    setBxgyBuyProductIds(coupon.bxgy_buy_product_ids ?? []);
    setBxgyBuyQuantity(String(coupon.bxgy_buy_quantity ?? 1));
    setBxgyGetProductIds(coupon.bxgy_get_product_ids ?? []);
    setBxgyGetQuantity(String(coupon.bxgy_get_quantity ?? 1));
    setBxgyGetDiscountPct(String(coupon.bxgy_get_discount_pct ?? 100));
  };

  const closeEdit = () => {
    setEditing(null);
    resetForm();
  };

  const handleCreate = async () => {
    if (!code.trim()) {
      Alert.alert("Error", "Coupon code is required");
      return;
    }
    if (!value || Number(value) <= 0) {
      Alert.alert("Error", "Enter a valid discount value");
      return;
    }
    if (minOrder.trim() && (!Number.isFinite(Number(minOrder)) || Number(minOrder) < 0)) {
      Alert.alert("Error", "Minimum order total must be a valid, non-negative number");
      return;
    }
    if (
      maxUses.trim() &&
      (!Number.isInteger(Number(maxUses)) || Number(maxUses) <= 0)
    ) {
      Alert.alert("Error", "Maximum uses must be a whole number greater than 0");
      return;
    }
    if (type === "bxgy") {
      if (bxgyBuyProductIds.length === 0 || bxgyGetProductIds.length === 0) {
        Alert.alert("Error", "Pick at least one buy and one get product for BXGY");
        return;
      }
      if (Number(bxgyGetDiscountPct) <= 0 || Number(bxgyGetDiscountPct) > 100) {
        Alert.alert("Error", "Get discount must be between 1 and 100");
        return;
      }
    }

    setCreating(true);
    const storeRes = await getSellerStore(user!.id);
    if (!storeRes.ok || !storeRes.data) {
      setCreating(false);
      return;
    }

    const coupon: Partial<AdminCoupon> = {
      code: code.trim().toUpperCase(),
      type: type as any,
      value: Number(value),
      min_order_total: minOrder ? Number(minOrder) : undefined,
      max_uses: maxUses ? Number(maxUses) : undefined,
      current_uses: 0,
      is_active: true,
      scope: storeRes.data.id,
      ...(type === "bxgy"
        ? {
            bxgy_buy_product_ids: bxgyBuyProductIds,
            bxgy_buy_quantity: Number(bxgyBuyQuantity) || 1,
            bxgy_get_product_ids: bxgyGetProductIds,
            bxgy_get_quantity: Number(bxgyGetQuantity) || 1,
            bxgy_get_discount_pct: Number(bxgyGetDiscountPct) || 100,
          }
        : {}),
    };

    const res = await createStoreCoupon(coupon);
    setCreating(false);

    if (res.ok) {
      setCoupons((prev) => [res.data, ...prev]);
      setShowCreate(false);
      resetForm();
    } else {
      Alert.alert("Error", res.error);
    }
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    if (!code.trim()) {
      Alert.alert("Error", "Coupon code is required");
      return;
    }
    setSaving(true);
    const patch: Partial<AdminCoupon> = {
      code: code.trim().toUpperCase(),
      type: type as AdminCoupon["type"],
      min_order_total: minOrder ? Number(minOrder) : undefined,
      max_uses: maxUses ? Number(maxUses) : undefined,
      ...(type === "bxgy"
        ? {
            bxgy_buy_product_ids: bxgyBuyProductIds,
            bxgy_buy_quantity: Number(bxgyBuyQuantity) || 1,
            bxgy_get_product_ids: bxgyGetProductIds,
            bxgy_get_quantity: Number(bxgyGetQuantity) || 1,
            bxgy_get_discount_pct: Number(bxgyGetDiscountPct) || 100,
          }
        : {}),
    };
    if (type !== "bxgy" && value) patch.value = Number(value);
    const res = await updateStoreCoupon(editing.id, patch);
    setSaving(false);
    if (res.ok) {
      setCoupons((prev) => prev.map((c) => (c.id === editing.id ? res.data : c)));
      closeEdit();
    } else {
      Alert.alert("Update failed", res.error);
    }
  };

  const resetForm = () => {
    setCode("");
    setType("percentage");
    setValue("");
    setMinOrder("");
    setMaxUses("");
    setBxgyBuyProductIds([]);
    setBxgyBuyQuantity("1");
    setBxgyGetProductIds([]);
    setBxgyGetQuantity("1");
    setBxgyGetDiscountPct("100");
  };

  // Product picker — debounced server-side search via /api/catalog/search
  const runProductSearch = useCallback(async (term: string) => {
    setPickerQuery(term);
    if (term.trim().length < 2) {
      setPickerResults([]);
      return;
    }
    setPickerSearching(true);
    const res = await searchProductsBackend({ q: term, limit: 10 });
    setPickerSearching(false);
    if (res.ok) {
      setPickerResults(
        (res.data.products ?? []).map((p: { id: string; name: string; slug: string; price: number; image: string | null }) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          price: p.price,
          image_url: p.image,
        })),
      );
    }
  }, []);

  const togglePickerProduct = (productId: string) => {
    if (!pickerOpen) return;
    if (pickerOpen === "buy") {
      setBxgyBuyProductIds((prev) =>
        prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId],
      );
    } else {
      setBxgyGetProductIds((prev) =>
        prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId],
      );
    }
  };

  if (loading) {
    return (
      <View style={s.loadingWrap}>
        <Ionicons name="pricetag-outline" size={32} color={colors.light.mutedForeground} />
        <Text style={s.loadingText}>Loading coupons...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.light.primary} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={s.header}>
        <View style={s.heroBg} />
        <View style={s.heroContent}>
          <View style={s.heroRow}>
            <View>
              <Text style={s.kicker}>PROMOTIONS</Text>
              <Text style={s.heroTitle}>Coupons</Text>
            </View>
            <TouchableOpacity style={s.addBtn} onPress={() => setShowCreate(true)}>
              <Ionicons name="add" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Stats */}
      <View style={s.statsRow}>
        <View style={s.statCard}>
          <Text style={s.statValue}>{coupons.length}</Text>
          <Text style={s.statLabel}>Total</Text>
        </View>
        <View style={s.statCard}>
          <Text style={[s.statValue, { color: colors.olive[600] }]}>
            {coupons.filter((c) => c.is_active).length}
          </Text>
          <Text style={s.statLabel}>Active</Text>
        </View>
        <View style={s.statCard}>
          <Text style={[s.statValue, { color: colors.light.mutedForeground }]}>
            {coupons.filter((c) => !c.is_active).length}
          </Text>
          <Text style={s.statLabel}>Inactive</Text>
        </View>
      </View>

      {/* Coupons List */}
      <View style={s.listSection}>
        {coupons.length === 0 ? (
          <View style={s.emptyCard}>
            <Ionicons name="pricetag-outline" size={32} color={colors.light.mutedForeground} />
            <Text style={s.emptyTitle}>No coupons yet</Text>
            <Text style={s.emptySub}>Create your first coupon to attract customers</Text>
            <TouchableOpacity style={s.emptyBtn} onPress={() => setShowCreate(true)}>
              <Text style={s.emptyBtnText}>Create Coupon</Text>
            </TouchableOpacity>
          </View>
        ) : (
          coupons.map((coupon) => (
            <TouchableOpacity
              key={coupon.id}
              style={s.couponCard}
              activeOpacity={0.7}
              onPress={() => openEdit(coupon)}
              accessibilityLabel={`Edit coupon ${coupon.code}`}
            >
              <View style={s.couponHeader}>
                <View style={s.couponCodeRow}>
                  <View style={[s.couponTypeBadge, typeBadgeStyle(coupon.type)]}>
                    <Text style={s.couponTypeText}>
                      {typeBadgeLabel(coupon)}
                    </Text>
                  </View>
                  <Text style={s.couponCode}>{coupon.code}</Text>
                </View>
                <Switch
                  value={coupon.is_active}
                  onValueChange={() => handleToggle(coupon)}
                  trackColor={{ false: colors.light.muted, true: colors.olive[300] }}
                  thumbColor={coupon.is_active ? colors.olive[600] : colors.light.mutedForeground}
                />
              </View>
              <View style={s.couponMeta}>
                <Text style={s.couponMetaText}>
                  {coupon.type === "percentage"
                    ? `${coupon.value}% off`
                    : coupon.type === "fixed"
                    ? `Rs. ${coupon.value} off`
                    : coupon.type === "bxgy"
                    ? "Buy X get Y"
                    : "Free shipping"}
                  {coupon.min_order_total ? ` (min Rs. ${coupon.min_order_total})` : ""}
                </Text>
                <Text style={s.couponMetaText}>
                  {coupon.current_uses}/{coupon.max_uses ?? "unlimited"} used
                </Text>
              </View>
              {coupon.ends_at && (
                <Text style={s.couponExpiry}>
                  Expires: {new Date(coupon.ends_at).toLocaleDateString("en-LK", { month: "short", day: "numeric", year: "numeric" })}
                </Text>
              )}
              <View style={s.couponActions}>
                <TouchableOpacity
                  style={s.couponActionBtn}
                  onPress={() => openEdit(coupon)}
                  accessibilityLabel={`Edit ${coupon.code}`}
                >
                  <Ionicons name="create-outline" size={16} color={colors.olive[700]} />
                  <Text style={s.couponActionText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.couponActionBtn, s.couponDeleteBtn]}
                  onPress={() => handleDelete(coupon)}
                  disabled={deletingId === coupon.id}
                  accessibilityLabel={`Delete ${coupon.code}`}
                >
                  <Ionicons name="trash-outline" size={16} color="#dc2626" />
                  <Text style={[s.couponActionText, { color: "#dc2626" }]}>
                    {deletingId === coupon.id ? "Deleting..." : "Delete"}
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      <View style={{ height: 40 }} />

      {/* Create Modal */}
      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={s.modalContainer}>
            <View style={s.modalHeader}>
              <TouchableOpacity onPress={() => { setShowCreate(false); resetForm(); }}>
                <Text style={s.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={s.modalTitle}>New Coupon</Text>
              <TouchableOpacity onPress={handleCreate} disabled={creating}>
                <Text style={[s.modalSave, creating && { opacity: 0.5 }]}>
                  {creating ? "Creating..." : "Create"}
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={s.modalContent} keyboardShouldPersistTaps="handled">
              {/* Coupon Type */}
              <Text style={s.fieldLabel}>Coupon Type</Text>
              <View style={s.typeRow}>
                {COUPON_TYPES.map((t) => {
                  const active = type === t.key;
                  return (
                    <TouchableOpacity
                      key={t.key}
                      style={[s.typeChip, active && s.typeChipActive]}
                      onPress={() => setType(t.key)}
                    >
                      <Ionicons name={t.icon as any} size={18} color={active ? "#fff" : colors.light.mutedForeground} />
                      <Text style={[s.typeChipText, active && s.typeChipTextActive]}>{t.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Code */}
              <Text style={s.fieldLabel}>Coupon Code</Text>
              <TextInput
                style={s.input}
                value={code}
                onChangeText={(t) => setCode(t.toUpperCase())}
                placeholder="SUMMER25"
                placeholderTextColor={colors.light.mutedForeground}
                autoCapitalize="characters"
                autoCorrect={false}
              />

              {/* Value */}
              <Text style={s.fieldLabel}>
                {type === "percentage" ? "Discount Percentage" : type === "fixed" ? "Discount Amount (Rs.)" : "Value"}
              </Text>
              <TextInput
                style={s.input}
                value={value}
                onChangeText={setValue}
                placeholder={type === "percentage" ? "25" : "500"}
                placeholderTextColor={colors.light.mutedForeground}
                keyboardType="numeric"
              />

              {/* Min Order */}
              <Text style={s.fieldLabel}>Minimum Order Total (Rs.)</Text>
              <TextInput
                style={s.input}
                value={minOrder}
                onChangeText={setMinOrder}
                placeholder="Optional"
                placeholderTextColor={colors.light.mutedForeground}
                keyboardType="numeric"
              />

              {/* Max Uses */}
              <Text style={s.fieldLabel}>Maximum Uses</Text>
              <TextInput
                style={s.input}
                value={maxUses}
                onChangeText={setMaxUses}
                placeholder="Unlimited"
                placeholderTextColor={colors.light.mutedForeground}
                keyboardType="numeric"
              />

              {/* BXGY fields — only relevant when type === 'bxgy' */}
              {type === "bxgy" && (
                <View>
                  <Text style={s.fieldLabel}>Buy products</Text>
                  <TouchableOpacity
                    style={s.productPickerBtn}
                    onPress={() => {
                      setPickerQuery("");
                      setPickerResults([]);
                      setPickerOpen("buy");
                    }}
                  >
                    <Text style={s.productPickerBtnText}>
                      {bxgyBuyProductIds.length === 0
                        ? "Pick products customer must buy"
                        : `${bxgyBuyProductIds.length} selected`}
                    </Text>
                    <Ionicons name="chevron-forward" size={18} color={colors.light.mutedForeground} />
                  </TouchableOpacity>

                  <Text style={s.fieldLabel}>Buy quantity</Text>
                  <TextInput
                    style={s.input}
                    value={bxgyBuyQuantity}
                    onChangeText={setBxgyBuyQuantity}
                    placeholder="1"
                    placeholderTextColor={colors.light.mutedForeground}
                    keyboardType="numeric"
                  />

                  <Text style={s.fieldLabel}>Get products</Text>
                  <TouchableOpacity
                    style={s.productPickerBtn}
                    onPress={() => {
                      setPickerQuery("");
                      setPickerResults([]);
                      setPickerOpen("get");
                    }}
                  >
                    <Text style={s.productPickerBtnText}>
                      {bxgyGetProductIds.length === 0
                        ? "Pick products customer receives"
                        : `${bxgyGetProductIds.length} selected`}
                    </Text>
                    <Ionicons name="chevron-forward" size={18} color={colors.light.mutedForeground} />
                  </TouchableOpacity>

                  <Text style={s.fieldLabel}>Get quantity</Text>
                  <TextInput
                    style={s.input}
                    value={bxgyGetQuantity}
                    onChangeText={setBxgyGetQuantity}
                    placeholder="1"
                    placeholderTextColor={colors.light.mutedForeground}
                    keyboardType="numeric"
                  />

                  <Text style={s.fieldLabel}>Get discount (%)</Text>
                  <TextInput
                    style={s.input}
                    value={bxgyGetDiscountPct}
                    onChangeText={setBxgyGetDiscountPct}
                    placeholder="100"
                    placeholderTextColor={colors.light.mutedForeground}
                    keyboardType="numeric"
                  />
                </View>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit Modal — mirrors create modal but pre-filled, no value field for BXGY */}
      <Modal visible={!!editing} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={s.modalContainer}>
            <View style={s.modalHeader}>
              <TouchableOpacity onPress={closeEdit}>
                <Text style={s.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={s.modalTitle}>Edit Coupon</Text>
              <TouchableOpacity onPress={handleSaveEdit} disabled={saving}>
                <Text style={[s.modalSave, saving && { opacity: 0.5 }]}>
                  {saving ? "Saving..." : "Save"}
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={s.modalContent} keyboardShouldPersistTaps="handled">
              <Text style={s.fieldLabel}>Coupon Type</Text>
              <View style={s.typeRow}>
                {COUPON_TYPES.map((t) => {
                  const active = type === t.key;
                  return (
                    <TouchableOpacity
                      key={t.key}
                      style={[s.typeChip, active && s.typeChipActive]}
                      onPress={() => setType(t.key)}
                    >
                      <Ionicons name={t.icon as any} size={18} color={active ? "#fff" : colors.light.mutedForeground} />
                      <Text style={[s.typeChipText, active && s.typeChipTextActive]}>{t.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={s.fieldLabel}>Coupon Code</Text>
              <TextInput
                style={s.input}
                value={code}
                onChangeText={(t) => setCode(t.toUpperCase())}
                placeholder="SUMMER25"
                placeholderTextColor={colors.light.mutedForeground}
                autoCapitalize="characters"
                autoCorrect={false}
              />

              {type !== "bxgy" && (
                <>
                  <Text style={s.fieldLabel}>
                    {type === "percentage" ? "Discount Percentage" : type === "fixed" ? "Discount Amount (Rs.)" : "Value"}
                  </Text>
                  <TextInput
                    style={s.input}
                    value={value}
                    onChangeText={setValue}
                    placeholder={type === "percentage" ? "25" : "500"}
                    placeholderTextColor={colors.light.mutedForeground}
                    keyboardType="numeric"
                  />
                </>
              )}

              <Text style={s.fieldLabel}>Minimum Order Total (Rs.)</Text>
              <TextInput
                style={s.input}
                value={minOrder}
                onChangeText={setMinOrder}
                placeholder="Optional"
                placeholderTextColor={colors.light.mutedForeground}
                keyboardType="numeric"
              />

              <Text style={s.fieldLabel}>Maximum Uses</Text>
              <TextInput
                style={s.input}
                value={maxUses}
                onChangeText={setMaxUses}
                placeholder="Unlimited"
                placeholderTextColor={colors.light.mutedForeground}
                keyboardType="numeric"
              />

              {type === "bxgy" && (
                <View>
                  <Text style={s.fieldLabel}>Buy products</Text>
                  <TouchableOpacity
                    style={s.productPickerBtn}
                    onPress={() => {
                      setPickerQuery("");
                      setPickerResults([]);
                      setPickerOpen("buy");
                    }}
                  >
                    <Text style={s.productPickerBtnText}>
                      {bxgyBuyProductIds.length === 0
                        ? "Pick products customer must buy"
                        : `${bxgyBuyProductIds.length} selected`}
                    </Text>
                    <Ionicons name="chevron-forward" size={18} color={colors.light.mutedForeground} />
                  </TouchableOpacity>

                  <Text style={s.fieldLabel}>Buy quantity</Text>
                  <TextInput
                    style={s.input}
                    value={bxgyBuyQuantity}
                    onChangeText={setBxgyBuyQuantity}
                    placeholder="1"
                    placeholderTextColor={colors.light.mutedForeground}
                    keyboardType="numeric"
                  />

                  <Text style={s.fieldLabel}>Get products</Text>
                  <TouchableOpacity
                    style={s.productPickerBtn}
                    onPress={() => {
                      setPickerQuery("");
                      setPickerResults([]);
                      setPickerOpen("get");
                    }}
                  >
                    <Text style={s.productPickerBtnText}>
                      {bxgyGetProductIds.length === 0
                        ? "Pick products customer receives"
                        : `${bxgyGetProductIds.length} selected`}
                    </Text>
                    <Ionicons name="chevron-forward" size={18} color={colors.light.mutedForeground} />
                  </TouchableOpacity>

                  <Text style={s.fieldLabel}>Get quantity</Text>
                  <TextInput
                    style={s.input}
                    value={bxgyGetQuantity}
                    onChangeText={setBxgyGetQuantity}
                    placeholder="1"
                    placeholderTextColor={colors.light.mutedForeground}
                    keyboardType="numeric"
                  />

                  <Text style={s.fieldLabel}>Get discount (%)</Text>
                  <TextInput
                    style={s.input}
                    value={bxgyGetDiscountPct}
                    onChangeText={setBxgyGetDiscountPct}
                    placeholder="100"
                    placeholderTextColor={colors.light.mutedForeground}
                    keyboardType="numeric"
                  />
                </View>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Product picker — shared between buy/get side of BXGY.
          Reuses the same server-side search the storefront editor uses,
          but stripped down to name + price for a single-step selection. */}
      <Modal visible={pickerOpen !== null} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={s.modalContainer}>
            <View style={s.modalHeader}>
              <TouchableOpacity onPress={() => setPickerOpen(null)}>
                <Text style={s.modalCancel}>Done</Text>
              </TouchableOpacity>
              <Text style={s.modalTitle}>
                {pickerOpen === "buy" ? "Buy products" : "Get products"}
              </Text>
              <View style={{ width: 40 }} />
            </View>
            <View style={s.modalContent}>
              <TextInput
                style={s.input}
                value={pickerQuery}
                onChangeText={(t) => runProductSearch(t)}
                placeholder="Search products..."
                placeholderTextColor={colors.light.mutedForeground}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {pickerSearching ? (
                <Text style={s.pickerHint}>Searching...</Text>
              ) : pickerResults.length === 0 && pickerQuery.length >= 2 ? (
                <Text style={s.pickerHint}>No products match.</Text>
              ) : (
                <ScrollView keyboardShouldPersistTaps="handled">
                  {pickerResults.map((p) => {
                    const selected =
                      pickerOpen === "buy"
                        ? bxgyBuyProductIds.includes(p.id)
                        : bxgyGetProductIds.includes(p.id);
                    return (
                      <TouchableOpacity
                        key={p.id}
                        style={[s.pickerRow, selected && s.pickerRowSelected]}
                        onPress={() => togglePickerProduct(p.id)}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={s.pickerName}>{p.name}</Text>
                          {p.price != null && (
                            <Text style={s.pickerPrice}>Rs. {p.price}</Text>
                          )}
                        </View>
                        <Ionicons
                          name={selected ? "checkmark-circle" : "ellipse-outline"}
                          size={22}
                          color={selected ? colors.olive[600] : colors.light.mutedForeground}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  content: { paddingBottom: 20 },
  loadingWrap: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, backgroundColor: colors.light.background },
  loadingText: { fontSize: typography.fontSizes.base, color: colors.light.mutedForeground },

  header: { position: "relative", marginBottom: 20 },
  heroBg: {
    position: "absolute", top: 0, left: 0, right: 0, height: 130,
    backgroundColor: colors.olive[700],
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
  },
  heroContent: { paddingTop: 56, paddingHorizontal: 24, paddingBottom: 20 },
  heroRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  kicker: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10, letterSpacing: 3, textTransform: "uppercase",
    color: colors.olive[200], marginBottom: 4,
  },
  heroTitle: {
    fontFamily: fontFamilies.display.regular,
    fontSize: typography.fontSizes["2xl"],
    fontWeight: typography.fontWeights.bold as any,
    color: "#fff",
  },
  addBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center", alignItems: "center",
  },

  statsRow: {
    flexDirection: "row", gap: 12,
    paddingHorizontal: 24, marginBottom: 20,
  },
  statCard: {
    flex: 1, backgroundColor: colors.light.card,
    borderRadius: radii.lg, borderWidth: 1, borderColor: colors.light.border,
    padding: 14, alignItems: "center",
  },
  statValue: {
    fontFamily: fontFamilies.display.regular,
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.bold as any,
    color: colors.light.foreground,
  },
  statLabel: {
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground, marginTop: 2,
  },

  listSection: { paddingHorizontal: 24 },
  emptyCard: {
    alignItems: "center", paddingVertical: 40, gap: 8,
    backgroundColor: colors.light.card, borderRadius: radii.xl,
    borderWidth: 1, borderColor: colors.light.border,
  },
  emptyTitle: {
    fontSize: typography.fontSizes.base,
    fontWeight: typography.fontWeights.semibold as any,
    color: colors.light.foreground,
  },
  emptySub: {
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground, textAlign: "center",
  },
  emptyBtn: {
    marginTop: 12, paddingHorizontal: 20, paddingVertical: 10,
    backgroundColor: colors.olive[600], borderRadius: radii.full,
  },
  emptyBtnText: {
    fontSize: typography.fontSizes.sm, fontWeight: typography.fontWeights.semibold as any,
    color: "#fff",
  },

  couponCard: {
    backgroundColor: colors.light.card, borderRadius: radii.xl,
    borderWidth: 1, borderColor: colors.light.border,
    padding: 16, marginBottom: 12,
  },
  couponHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginBottom: 10,
  },
  couponCodeRow: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  couponTypeBadge: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: radii.full,
  },
  badgePercentage: { backgroundColor: colors.olive[100] },
  badgeFixed: { backgroundColor: "#dbeafe" },
  badgeShipping: { backgroundColor: "#fef3c7" },
  badgeBxgy: { backgroundColor: "#ede9fe" },
  couponTypeText: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.bold as any,
    color: colors.olive[800],
  },
  couponCode: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.bold as any,
    color: colors.light.foreground, letterSpacing: 1,
  },
  couponMeta: {
    flexDirection: "row", justifyContent: "space-between",
  },
  couponMetaText: { fontSize: typography.fontSizes.xs, color: colors.light.mutedForeground },
  couponExpiry: {
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground, marginTop: 6,
  },
  couponActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
  },
  couponActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.light.background,
  },
  couponDeleteBtn: {
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
  },
  couponActionText: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.medium as any,
    color: colors.olive[700],
  },
  productPickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.lg,
    padding: 14,
  },
  productPickerBtnText: {
    fontSize: typography.fontSizes.base,
    color: colors.light.foreground,
  },
  pickerHint: {
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
    textAlign: "center",
    paddingVertical: 24,
  },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  pickerRowSelected: {
    backgroundColor: colors.olive[100],
  },
  pickerName: {
    fontSize: typography.fontSizes.base,
    fontWeight: typography.fontWeights.medium as any,
    color: colors.light.foreground,
  },
  pickerPrice: {
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    marginTop: 2,
  },

  // Modal
  modalContainer: { flex: 1, backgroundColor: colors.light.background },
  modalHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: colors.light.border,
  },
  modalCancel: { fontSize: typography.fontSizes.base, color: colors.light.mutedForeground },
  modalTitle: {
    fontSize: typography.fontSizes.base,
    fontWeight: typography.fontWeights.semibold as any,
    color: colors.light.foreground,
  },
  modalSave: {
    fontSize: typography.fontSizes.base,
    fontWeight: typography.fontWeights.bold as any,
    color: colors.olive[600],
  },
  modalContent: { padding: 24, gap: 4 },

  fieldLabel: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.medium as any,
    color: colors.light.foreground,
    marginTop: 16, marginBottom: 8,
  },
  input: {
    backgroundColor: colors.light.card,
    borderWidth: 1, borderColor: colors.light.border,
    borderRadius: radii.lg, padding: 14,
    fontSize: typography.fontSizes.base,
    color: colors.light.foreground,
  },
  typeRow: { flexDirection: "row", gap: 10 },
  typeChip: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 12,
    backgroundColor: colors.light.card, borderRadius: radii.lg,
    borderWidth: 1, borderColor: colors.light.border,
  },
  typeChipActive: { backgroundColor: colors.olive[600], borderColor: colors.olive[600] },
  typeChipText: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.medium as any,
    color: colors.light.mutedForeground,
  },
  typeChipTextActive: { color: "#fff" },
});
