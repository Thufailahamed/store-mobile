import React, { useEffect, useState, useCallback, useMemo } from "react";
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
  StatusBar,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@/components/ui/Icon";
import { useAuth } from "@/lib/supabase/auth";
import {
  getSellerStore,
  getStoreCoupons,
  createStoreCoupon,
  updateStoreCoupon,
  deleteStoreCoupon,
  getSellerProducts,
} from "@/lib/api";
import { colors, typography, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice, pluralize } from "@/lib/utils";
import { SellerBackButton } from "@/components/seller/SellerBackButton";
import { SellerStateView } from "@/components/seller/chrome";
import { Skeleton } from "@/components/ui/Skeleton";
import type { AdminCoupon } from "@/lib/api";

const CREAM = colors.paper.cream;
const GOLD = colors.accent2.ochre;
const RUST = colors.accent2.rust;
const INK = colors.olive[950];

const COUPON_TYPES = [
  { key: "percentage", label: "Percentage", icon: "pricetag-outline" as const },
  { key: "fixed", label: "Fixed Amount", icon: "cash-outline" as const },
  { key: "free_shipping", label: "Free Shipping", icon: "bicycle-outline" as const },
  { key: "bxgy", label: "Buy X Get Y", icon: "gift-outline" as const },
] as const;

const TYPE_META: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  percentage: { label: "Percentage", icon: "pricetag-outline" },
  fixed: { label: "Fixed amount", icon: "cash-outline" },
  free_shipping: { label: "Free shipping", icon: "bicycle-outline" },
  bxgy: { label: "Buy X get Y", icon: "gift-outline" },
};

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
  if (coupon.type === "fixed") return formatPrice(coupon.value ?? 0);
  if (coupon.type === "bxgy") return "BXGY";
  return "FREE";
}

function couponSummary(coupon: AdminCoupon): string {
  const base =
    coupon.type === "percentage"
      ? `${coupon.value}% off`
      : coupon.type === "fixed"
        ? `${formatPrice(coupon.value ?? 0)} off`
        : coupon.type === "bxgy"
          ? "Buy X get Y"
          : "Free shipping";
  return coupon.min_order_total
    ? `${base} · min ${formatPrice(coupon.min_order_total)}`
    : base;
}

function isExpired(coupon: AdminCoupon): boolean {
  if (!coupon.ends_at) return false;
  const d = new Date(coupon.ends_at);
  return !Number.isNaN(d.getTime()) && d.getTime() < Date.now();
}

function CouponsSkeleton() {
  return (
    <View style={{ paddingHorizontal: spacing[5], gap: 12 }}>
      <View style={{ flexDirection: "row", gap: 10 }}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} style={{ flex: 1 }} height={72} borderRadius={16} />
        ))}
      </View>
      {[0, 1].map((i) => (
        <View key={i} style={s.skelCard}>
          <Skeleton width="55%" height={18} />
          <Skeleton width="70%" height={12} />
          <Skeleton width="40%" height={12} />
        </View>
      ))}
    </View>
  );
}

export default function SellerCoupons() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [coupons, setCoupons] = useState<AdminCoupon[]>([]);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
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
    { id: string; name: string; slug?: string; price?: number; image_url?: string | null }[]
  >([]);
  const [pickerSearching, setPickerSearching] = useState(false);

  /** Only percentage and fixed coupons carry a flat discount value. */
  const needsValue = type === "percentage" || type === "fixed";

  const fetchData = useCallback(async () => {
    if (!user) return;
    const storeRes = await getSellerStore(user.id);
    if (!storeRes.ok || !storeRes.data) {
      setLoadError(storeRes.ok ? "No store found" : storeRes.error);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setStoreId(storeRes.data.id);
    const res = await getStoreCoupons(storeRes.data.id);
    if (res.ok) {
      setCoupons(res.data);
      setLoadError(null);
    } else {
      setLoadError(res.error);
    }
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const stats = useMemo(() => {
    const active = coupons.filter((c) => c.is_active && !isExpired(c)).length;
    const redemptions = coupons.reduce((sum, c) => sum + (c.current_uses ?? 0), 0);
    return { total: coupons.length, active, inactive: coupons.length - active, redemptions };
  }, [coupons]);

  const headerSubtitle = loadError && coupons.length === 0
    ? "Promotions unavailable"
    : coupons.length === 0
      ? "No promotions yet"
      : `${stats.active} active · ${pluralize(stats.redemptions, "redemption")}`;

  const handleToggle = async (coupon: AdminCoupon) => {
    const res = await updateStoreCoupon(coupon.id, { is_active: !coupon.is_active });
    if (res.ok) {
      setCoupons((prev) =>
        prev.map((c) => (c.id === coupon.id ? { ...c, is_active: !c.is_active } : c))
      );
    } else {
      Alert.alert("Update failed", res.error);
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

  const openCreate = () => {
    setEditing(null);
    resetForm();
    setFormOpen(true);
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
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
    resetForm();
  };

  const validateForm = (): boolean => {
    if (!code.trim()) {
      Alert.alert("Error", "Coupon code is required");
      return false;
    }
    // Free shipping and BXGY carry no flat discount value — free shipping is
    // the discount, and BXGY is priced by `bxgy_get_discount_pct`.
    if (needsValue) {
      if (!value || Number(value) <= 0) {
        Alert.alert("Error", "Enter a valid discount value");
        return false;
      }
      if (type === "percentage" && Number(value) > 100) {
        Alert.alert("Error", "Percentage coupons cannot exceed 100%");
        return false;
      }
    }
    if (minOrder.trim() && (!Number.isFinite(Number(minOrder)) || Number(minOrder) < 0)) {
      Alert.alert("Error", "Minimum order total must be a valid, non-negative number");
      return false;
    }
    if (maxUses.trim() && (!Number.isInteger(Number(maxUses)) || Number(maxUses) <= 0)) {
      Alert.alert("Error", "Maximum uses must be a whole number greater than 0");
      return false;
    }
    if (type === "bxgy") {
      if (bxgyBuyProductIds.length === 0 || bxgyGetProductIds.length === 0) {
        Alert.alert("Error", "Pick at least one buy and one get product for BXGY");
        return false;
      }
      if (Number(bxgyGetDiscountPct) <= 0 || Number(bxgyGetDiscountPct) > 100) {
        Alert.alert("Error", "Get discount must be between 1 and 100");
        return false;
      }
    }
    return true;
  };

  const buildPatch = (): Partial<AdminCoupon> => ({
    code: code.trim().toUpperCase(),
    type: type as AdminCoupon["type"],
    // Switching an existing coupon to free shipping / BXGY must clear any
    // stale flat discount, otherwise the old value keeps applying.
    value: needsValue ? Number(value) : 0,
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
  });

  const handleSubmit = async () => {
    if (!validateForm()) return;

    if (editing) {
      setSaving(true);
      const res = await updateStoreCoupon(editing.id, buildPatch());
      setSaving(false);
      if (res.ok) {
        setCoupons((prev) => prev.map((c) => (c.id === editing.id ? res.data : c)));
        closeForm();
      } else {
        Alert.alert("Update failed", res.error);
      }
      return;
    }

    setCreating(true);
    const storeRes = await getSellerStore(user!.id);
    if (!storeRes.ok || !storeRes.data) {
      setCreating(false);
      return;
    }
    const res = await createStoreCoupon({
      ...buildPatch(),
      current_uses: 0,
      is_active: true,
      scope: storeRes.data.id,
    });
    setCreating(false);
    if (res.ok) {
      setCoupons((prev) => [res.data, ...prev]);
      closeForm();
    } else {
      Alert.alert("Error", res.error);
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

  // Product picker — seller catalogue only (this maison), not the public storefront search
  const runProductSearch = useCallback(async (term: string) => {
    setPickerQuery(term);
    if (term.trim().length < 2) {
      setPickerResults([]);
      return;
    }
    if (!storeId) return;
    setPickerSearching(true);
    const res = await getSellerProducts(storeId, { search: term, limit: 10 });
    setPickerSearching(false);
    if (res.ok) {
      setPickerResults(
        res.data.products.map((p) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          price: p.price,
          image_url: p.images?.find((img) => img.is_primary)?.url ?? p.images?.[0]?.url ?? null,
        })),
      );
    }
  }, [storeId]);

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

  const formBusy = creating || saving;

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.olive[800]} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[s.header, { paddingTop: Math.max(insets.top, 12) + 8 }]}>
          <SellerBackButton label="More" fallbackHref="/(seller)/more" style={{ marginBottom: 6 }} />
          <View style={s.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.kicker}>Atelier · Promotions</Text>
              <Text style={s.title}>Coupons</Text>
              <Text style={s.subtitle}>{headerSubtitle}</Text>
            </View>
            <TouchableOpacity
              style={s.addBtn}
              onPress={openCreate}
              accessibilityRole="button"
              accessibilityLabel="Create coupon"
            >
              <Ionicons name="add" size={20} color={CREAM} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={s.goldRule} />

        {loading ? (
          <CouponsSkeleton />
        ) : loadError && coupons.length === 0 ? (
          <SellerStateView
            variant="error"
            icon="cloud-offline-outline"
            title="Couldn’t load coupons"
            description={loadError}
            actionLabel="Try again"
            onAction={onRefresh}
            style={{ marginTop: 40 }}
          />
        ) : (
          <View style={s.body}>
            {/* Stats */}
            <View style={s.statsRow}>
              <View style={s.statCard}>
                <View style={[s.statIcon, { backgroundColor: colors.olive[50] }]}>
                  <Ionicons name="pricetag-outline" size={14} color={colors.olive[700]} />
                </View>
                <Text style={s.statValue}>{stats.total}</Text>
                <Text style={s.statLabel}>Total</Text>
              </View>
              <View style={s.statCard}>
                <View style={[s.statIcon, { backgroundColor: "rgba(106,118,57,0.14)" }]}>
                  <Ionicons name="checkmark-circle-outline" size={14} color={colors.olive[600]} />
                </View>
                <Text style={[s.statValue, { color: colors.olive[600] }]}>{stats.active}</Text>
                <Text style={s.statLabel}>Active</Text>
              </View>
              <View style={s.statCard}>
                <View style={[s.statIcon, { backgroundColor: "rgba(200,164,74,0.16)" }]}>
                  <Ionicons name="ticket-outline" size={14} color="#8a6a2a" />
                </View>
                <Text style={s.statValue}>{stats.redemptions}</Text>
                <Text style={s.statLabel}>Redeemed</Text>
              </View>
            </View>

            {/* Coupons list */}
            {coupons.length === 0 ? (
              <SellerStateView
                variant="empty"
                icon="pricetag-outline"
                title="No coupons yet"
                description="Create your first coupon to reward customers and drive repeat orders."
                actionLabel="Create coupon"
                onAction={openCreate}
                style={{ marginTop: 8 }}
              />
            ) : (
              coupons.map((coupon) => {
                const expired = isExpired(coupon);
                const live = coupon.is_active && !expired;
                const usageCap = coupon.max_uses ?? null;
                const usagePct = usageCap ? Math.min(1, (coupon.current_uses ?? 0) / usageCap) : 0;
                const usageFull = usageCap != null && (coupon.current_uses ?? 0) >= usageCap;
                return (
                  <TouchableOpacity
                    key={coupon.id}
                    style={[s.couponCard, !live && s.couponCardDim]}
                    activeOpacity={0.85}
                    onPress={() => openEdit(coupon)}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit coupon ${coupon.code}`}
                  >
                    <View style={s.couponTop}>
                      <View style={[s.couponTypeBadge, typeBadgeStyle(coupon.type)]}>
                        <Ionicons
                          name={TYPE_META[coupon.type]?.icon ?? "pricetag-outline"}
                          size={12}
                          color={colors.olive[900]}
                        />
                        <Text style={s.couponTypeText}>{typeBadgeLabel(coupon)}</Text>
                      </View>
                      <Text style={s.couponCode} numberOfLines={1}>{coupon.code}</Text>
                      <Switch
                        value={coupon.is_active}
                        onValueChange={() => handleToggle(coupon)}
                        trackColor={{ false: colors.olive[100], true: colors.olive[300] }}
                        thumbColor={coupon.is_active ? colors.olive[700] : colors.ink.mute}
                      />
                    </View>

                    <View style={s.couponMetaRow}>
                      <Text style={s.couponMetaText}>{couponSummary(coupon)}</Text>
                      {expired ? (
                        <View style={s.expiredChip}>
                          <Text style={s.expiredChipText}>Expired</Text>
                        </View>
                      ) : coupon.ends_at ? (
                        <View style={s.metaItem}>
                          <Ionicons name="calendar-outline" size={11} color={colors.ink.mute} />
                          <Text style={s.couponMetaText}>
                            Ends {new Date(coupon.ends_at).toLocaleDateString("en-LK", { month: "short", day: "numeric", year: "numeric" })}
                          </Text>
                        </View>
                      ) : (
                        <Text style={s.couponMetaText}>No expiry</Text>
                      )}
                    </View>

                    <View style={s.usageRow}>
                      <View style={s.usageBarBg}>
                        <View
                          style={[
                            s.usageBarFill,
                            { width: `${usageCap ? Math.max(usagePct * 100, usagePct > 0 ? 4 : 0) : 0}%` },
                            usageFull && s.usageBarFull,
                          ]}
                        />
                      </View>
                      <Text style={s.usageText}>
                        {coupon.current_uses ?? 0}/{usageCap ?? "∞"} used
                      </Text>
                    </View>

                    <View style={s.couponActions}>
                      <View style={s.liveRow}>
                        <View style={[s.liveDot, { backgroundColor: live ? colors.olive[500] : colors.ink.mute }]} />
                        <Text style={s.liveText}>{expired ? "Expired" : live ? "Live" : "Paused"}</Text>
                      </View>
                      <View style={s.actionGroup}>
                        <TouchableOpacity
                          style={s.couponActionBtn}
                          onPress={() => openEdit(coupon)}
                          accessibilityRole="button"
                          accessibilityLabel={`Edit ${coupon.code}`}
                        >
                          <Ionicons name="create-outline" size={14} color={colors.olive[700]} />
                          <Text style={s.couponActionText}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={s.deleteBtn}
                          onPress={() => handleDelete(coupon)}
                          disabled={deletingId === coupon.id}
                          accessibilityRole="button"
                          accessibilityLabel={`Delete ${coupon.code}`}
                        >
                          <Ionicons name="trash-outline" size={14} color={RUST} />
                          <Text style={s.deleteText}>
                            {deletingId === coupon.id ? "Deleting…" : "Delete"}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Create / edit modal — shared form; `editing` decides the verb. */}
      <Modal visible={formOpen} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={s.modalContainer}>
            <View style={s.modalHeader}>
              <TouchableOpacity onPress={closeForm} accessibilityRole="button">
                <Text style={s.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={s.modalTitle}>{editing ? "Edit coupon" : "New coupon"}</Text>
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={formBusy}
                accessibilityRole="button"
                accessibilityLabel={editing ? "Save coupon" : "Create coupon"}
              >
                <Text style={[s.modalSave, formBusy && { opacity: 0.5 }]}>
                  {creating ? "Creating…" : saving ? "Saving…" : editing ? "Save" : "Create"}
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={s.modalContent} keyboardShouldPersistTaps="handled">
              {/* Coupon Type */}
              <Text style={s.fieldLabel}>Coupon type</Text>
              <View style={s.typeRow}>
                {COUPON_TYPES.map((t) => {
                  const active = type === t.key;
                  return (
                    <TouchableOpacity
                      key={t.key}
                      style={[s.typeChip, active && s.typeChipActive]}
                      onPress={() => setType(t.key)}
                      accessibilityRole="button"
                    >
                      <Ionicons
                        name={t.icon}
                        size={16}
                        color={active ? CREAM : colors.ink.mute}
                      />
                      <Text style={[s.typeChipText, active && s.typeChipTextActive]}>{t.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Code */}
              <Text style={s.fieldLabel}>Coupon code</Text>
              <TextInput
                style={s.input}
                value={code}
                onChangeText={(t) => setCode(t.toUpperCase())}
                placeholder="SUMMER25"
                placeholderTextColor={colors.ink.mute}
                autoCapitalize="characters"
                autoCorrect={false}
              />

              {/* Value — not applicable to free shipping or BXGY */}
              {needsValue ? (
                <>
                  <Text style={s.fieldLabel}>
                    {type === "percentage" ? "Discount percentage" : "Discount amount (Rs.)"}
                  </Text>
                  <TextInput
                    style={s.input}
                    value={value}
                    onChangeText={setValue}
                    placeholder={type === "percentage" ? "25" : "500"}
                    placeholderTextColor={colors.ink.mute}
                    keyboardType="numeric"
                  />
                </>
              ) : type === "free_shipping" ? (
                <Text style={s.fieldHint}>
                  Free shipping coupons waive the delivery fee — no discount value needed.
                </Text>
              ) : null}

              <View style={s.fieldRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>Minimum order (Rs.)</Text>
                  <TextInput
                    style={s.input}
                    value={minOrder}
                    onChangeText={setMinOrder}
                    placeholder="Optional"
                    placeholderTextColor={colors.ink.mute}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>Maximum uses</Text>
                  <TextInput
                    style={s.input}
                    value={maxUses}
                    onChangeText={setMaxUses}
                    placeholder="Unlimited"
                    placeholderTextColor={colors.ink.mute}
                    keyboardType="numeric"
                  />
                </View>
              </View>

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
                    accessibilityRole="button"
                  >
                    <Text style={s.productPickerBtnText}>
                      {bxgyBuyProductIds.length === 0
                        ? "Pick products customer must buy"
                        : `${bxgyBuyProductIds.length} selected`}
                    </Text>
                    <Ionicons name="chevron-forward" size={18} color={colors.ink.mute} />
                  </TouchableOpacity>

                  <Text style={s.fieldLabel}>Buy quantity</Text>
                  <TextInput
                    style={s.input}
                    value={bxgyBuyQuantity}
                    onChangeText={setBxgyBuyQuantity}
                    placeholder="1"
                    placeholderTextColor={colors.ink.mute}
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
                    accessibilityRole="button"
                  >
                    <Text style={s.productPickerBtnText}>
                      {bxgyGetProductIds.length === 0
                        ? "Pick products customer receives"
                        : `${bxgyGetProductIds.length} selected`}
                    </Text>
                    <Ionicons name="chevron-forward" size={18} color={colors.ink.mute} />
                  </TouchableOpacity>

                  <Text style={s.fieldLabel}>Get quantity</Text>
                  <TextInput
                    style={s.input}
                    value={bxgyGetQuantity}
                    onChangeText={setBxgyGetQuantity}
                    placeholder="1"
                    placeholderTextColor={colors.ink.mute}
                    keyboardType="numeric"
                  />

                  <Text style={s.fieldLabel}>Get discount (%)</Text>
                  <TextInput
                    style={s.input}
                    value={bxgyGetDiscountPct}
                    onChangeText={setBxgyGetDiscountPct}
                    placeholder="100"
                    placeholderTextColor={colors.ink.mute}
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
              <TouchableOpacity onPress={() => setPickerOpen(null)} accessibilityRole="button">
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
                placeholderTextColor={colors.ink.mute}
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
                        accessibilityRole="button"
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={s.pickerName}>{p.name}</Text>
                          {p.price != null && (
                            <Text style={s.pickerPrice}>{formatPrice(p.price)}</Text>
                          )}
                        </View>
                        <Ionicons
                          name={selected ? "checkmark-circle" : "ellipse-outline"}
                          size={22}
                          color={selected ? colors.olive[600] : colors.ink.mute}
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
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper.DEFAULT },
  content: { paddingBottom: 20 },
  body: { paddingHorizontal: spacing[5] },

  header: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[3],
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 12,
  },
  kicker: {
    fontFamily: fontFamilies.mono.medium,
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
    fontSize: typography.fontSizes.sm,
    color: colors.ink.mute,
    marginTop: 3,
  },
  addBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.olive[800],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
    shadowColor: colors.olive[950],
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  goldRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(200,164,74,0.55)",
    marginHorizontal: spacing[5],
    marginBottom: spacing[4],
  },

  statsRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  statCard: {
    flex: 1,
    backgroundColor: CREAM,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.12)",
    padding: 14,
    gap: 4,
    shadowColor: colors.olive[950],
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  statIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  statValue: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 22,
    color: INK,
    letterSpacing: -0.4,
  },
  statLabel: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    color: colors.ink.mute,
  },

  couponCard: {
    backgroundColor: CREAM,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.12)",
    padding: 16,
    marginBottom: 12,
    shadowColor: colors.olive[950],
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  couponCardDim: { opacity: 0.62 },
  couponTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  couponTypeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
  },
  badgePercentage: { backgroundColor: colors.olive[100] },
  badgeFixed: { backgroundColor: "rgba(200,164,74,0.22)" },
  badgeShipping: { backgroundColor: "rgba(83,94,44,0.12)" },
  badgeBxgy: { backgroundColor: "rgba(184,92,58,0.14)" },
  couponTypeText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: typography.fontSizes.xs,
    color: colors.olive[900],
  },
  couponCode: {
    flex: 1,
    fontFamily: fontFamilies.mono.medium,
    fontSize: typography.fontSizes.md,
    color: INK,
    letterSpacing: 1.4,
  },
  couponMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 10,
  },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  couponMetaText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.xs,
    color: colors.ink.mute,
    flexShrink: 1,
  },
  expiredChip: {
    backgroundColor: "rgba(184,92,58,0.12)",
    borderRadius: radii.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  expiredChipText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 10,
    color: RUST,
  },
  usageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
  },
  usageBarBg: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.olive[100],
    overflow: "hidden",
  },
  usageBarFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: colors.olive[500],
  },
  usageBarFull: { backgroundColor: RUST },
  usageText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 11,
    color: colors.ink.mute,
  },
  couponActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(83,94,44,0.12)",
  },
  liveRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  liveText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 11,
    color: colors.ink.soft,
  },
  actionGroup: { flexDirection: "row", gap: 8 },
  couponActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.22)",
    backgroundColor: colors.paper.DEFAULT,
  },
  couponActionText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.xs,
    color: colors.olive[800],
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "rgba(184,92,58,0.3)",
    backgroundColor: "rgba(184,92,58,0.08)",
  },
  deleteText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.xs,
    color: RUST,
  },

  modalContainer: { flex: 1, backgroundColor: colors.paper.DEFAULT },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(83,94,44,0.14)",
  },
  modalCancel: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: typography.fontSizes.sm,
    color: colors.ink.mute,
  },
  modalTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: typography.fontSizes.md,
    color: INK,
  },
  modalSave: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.sm,
    color: colors.olive[700],
  },
  modalContent: { padding: 20, paddingBottom: 48 },
  fieldLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.ink.mute,
    marginBottom: 8,
    marginTop: 18,
  },
  fieldHint: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.xs,
    color: colors.ink.mute,
    lineHeight: 18,
    marginTop: 6,
  },
  fieldRow: { flexDirection: "row", gap: 12 },
  input: {
    backgroundColor: CREAM,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.18)",
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.base,
    color: INK,
  },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: radii.full,
    backgroundColor: CREAM,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.18)",
  },
  typeChipActive: { backgroundColor: colors.olive[800], borderColor: colors.olive[800] },
  typeChipText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: typography.fontSizes.xs,
    color: colors.ink.soft,
  },
  typeChipTextActive: { color: CREAM },

  productPickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: CREAM,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.18)",
    borderRadius: radii.lg,
    padding: 14,
  },
  productPickerBtnText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.base,
    color: INK,
  },
  pickerHint: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    color: colors.ink.mute,
    textAlign: "center",
    paddingVertical: 24,
  },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radii.lg,
    marginTop: 6,
    backgroundColor: CREAM,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.1)",
  },
  pickerRowSelected: {
    borderColor: colors.olive[500],
    backgroundColor: colors.olive[50],
  },
  pickerName: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: typography.fontSizes.sm,
    color: INK,
  },
  pickerPrice: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.xs,
    color: colors.ink.mute,
    marginTop: 2,
  },

  skelCard: {
    backgroundColor: CREAM,
    borderRadius: radii["2xl"],
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.08)",
    gap: 10,
  },
});
