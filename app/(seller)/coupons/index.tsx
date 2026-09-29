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
import { useToast } from "@/components/ui";
import * as Clipboard from "expo-clipboard";
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
  const { toast } = useToast();
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
      : "Discount codes for your store";

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

  const copyCode = async (code: string) => {
    await Clipboard.setStringAsync(code);
    toast.success(`Copied ${code}`);
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
              <Ionicons name="add" size={17} color={CREAM} />
              <Text style={s.addBtnText}>New</Text>
            </TouchableOpacity>
          </View>
        </View>

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
            {coupons.length > 0 ? (
              <View style={s.statsStrip}>
                {[
                  { label: "Live", value: stats.active, dot: colors.olive[500] },
                  { label: "Paused / ended", value: stats.inactive, dot: colors.ink.mute },
                  { label: "Redeemed", value: stats.redemptions, dot: GOLD },
                ].map((st, i) => (
                  <View key={st.label} style={[s.statCell, i > 0 && s.statCellDivider]}>
                    <Text style={s.statValue}>{st.value}</Text>
                    <View style={s.statLabelRow}>
                      <View style={[s.statDot, { backgroundColor: st.dot }]} />
                      <Text style={s.statLabel} numberOfLines={1}>{st.label}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

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
                const uses = coupon.current_uses ?? 0;
                const usageCap = coupon.max_uses ?? null;
                const usagePct = usageCap ? Math.min(1, uses / usageCap) : 0;
                const usageFull = usageCap != null && uses >= usageCap;
                const status = expired ? "Expired" : usageFull ? "Used up" : live ? "Live" : "Paused";
                const statusTone =
                  status === "Live"
                    ? { fg: colors.olive[800], bg: "rgba(106,118,57,0.14)" }
                    : status === "Paused"
                      ? { fg: colors.ink.mute, bg: "rgba(83,94,44,0.08)" }
                      : { fg: RUST, bg: "rgba(184,92,58,0.1)" };
                const heroValue =
                  coupon.type === "percentage" ? `${coupon.value}%`
                  : coupon.type === "fixed" ? formatPrice(coupon.value ?? 0)
                  : coupon.type === "bxgy" ? "BXGY"
                  : "FREE";
                const heroSub =
                  coupon.type === "free_shipping" ? "shipping"
                  : coupon.type === "bxgy" ? "bundle"
                  : "off";
                const endsLabel = coupon.ends_at
                  ? `${expired ? "Ended" : "Ends"} ${new Date(coupon.ends_at).toLocaleDateString("en-LK", { month: "short", day: "numeric", year: "numeric" })}`
                  : "No expiry";
                return (
                  <TouchableOpacity
                    key={coupon.id}
                    style={s.ticket}
                    activeOpacity={0.9}
                    onPress={() => openEdit(coupon)}
                    accessibilityRole="button"
                    accessibilityLabel={`Coupon ${coupon.code}, ${status}. Tap to edit`}
                  >
                    <View style={[s.ticketMain, !live && s.dim]}>
                      <View style={[s.stub, !live && s.stubMuted]}>
                        <Text style={s.stubValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                          {heroValue}
                        </Text>
                        <Text style={s.stubSub}>{heroSub}</Text>
                      </View>
                      <View style={s.perf}>
                        <View style={[s.notch, s.notchTop]} />
                        <View style={s.perfLine} />
                        <View style={[s.notch, s.notchBottom]} />
                      </View>
                      <View style={s.ticketBody}>
                        <View style={s.codeRow}>
                          <Text style={s.couponCode} numberOfLines={1}>{coupon.code}</Text>
                          <TouchableOpacity
                            onPress={() => void copyCode(coupon.code)}
                            hitSlop={8}
                            style={s.copyBtn}
                            accessibilityRole="button"
                            accessibilityLabel={`Copy ${coupon.code}`}
                          >
                            <Ionicons name="copy-outline" size={14} color={colors.olive[700]} />
                          </TouchableOpacity>
                        </View>
                        <Text style={s.couponMetaText} numberOfLines={1}>
                          {coupon.min_order_total ? `Min. order ${formatPrice(coupon.min_order_total)}` : "No minimum order"}
                        </Text>
                        <View style={s.metaItem}>
                          <Ionicons name="calendar-outline" size={11} color={expired ? RUST : colors.ink.mute} />
                          <Text style={[s.couponMetaText, expired && { color: RUST }]}>{endsLabel}</Text>
                        </View>
                      </View>
                    </View>

                    <View style={s.usageBlock}>
                      <View style={s.usageTop}>
                        <Text style={s.usageLabel}>
                          <Text style={s.usageStrong}>{uses}</Text>
                          {usageCap ? ` of ${usageCap} redeemed` : ` ${pluralize(uses, "redemption")} · no limit`}
                        </Text>
                        {usageCap ? (
                          <Text style={s.usageLabel}>{Math.max(0, usageCap - uses)} left</Text>
                        ) : null}
                      </View>
                      {usageCap ? (
                        <View style={s.usageBarBg}>
                          <View
                            style={[
                              s.usageBarFill,
                              { width: `${Math.max(usagePct * 100, usagePct > 0 ? 3 : 0)}%` },
                              usageFull && s.usageBarFull,
                            ]}
                          />
                        </View>
                      ) : null}
                    </View>

                    <View style={s.couponActions}>
                      <View style={[s.statusPill, { backgroundColor: statusTone.bg }]}>
                        <View style={[s.liveDot, { backgroundColor: statusTone.fg }]} />
                        <Text style={[s.statusText, { color: statusTone.fg }]}>{status}</Text>
                      </View>
                      <View style={s.actionGroup}>
                        <View style={s.switchWrap}>
                          <Text style={s.switchLabel}>{coupon.is_active ? "On" : "Off"}</Text>
                          <Switch
                            value={coupon.is_active}
                            onValueChange={() => handleToggle(coupon)}
                            trackColor={{ false: "rgba(83,94,44,0.18)", true: colors.olive[700] }}
                            thumbColor="#FFFFFF"
                            ios_backgroundColor="rgba(83,94,44,0.18)"
                            style={{ transform: [{ scale: 0.85 }] }}
                            accessibilityLabel={`${coupon.is_active ? "Pause" : "Activate"} ${coupon.code}`}
                          />
                        </View>
                        <TouchableOpacity
                          style={s.iconAction}
                          onPress={() => handleDelete(coupon)}
                          disabled={deletingId === coupon.id}
                          accessibilityRole="button"
                          accessibilityLabel={`Delete ${coupon.code}`}
                        >
                          <Ionicons
                            name={deletingId === coupon.id ? "hourglass-outline" : "trash-outline"}
                            size={16}
                            color={RUST}
                          />
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
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 40,
    paddingLeft: 12,
    paddingRight: 16,
    borderRadius: radii.full,
    backgroundColor: colors.olive[900],
    marginBottom: 4,
  },
  addBtnText: { fontFamily: fontFamilies.sans.semibold, fontSize: 13, color: CREAM },

  statsStrip: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.1)",
    paddingVertical: 12,
    marginTop: 4,
    marginBottom: 16,
  },
  statCell: { flex: 1, paddingHorizontal: 14 },
  statCellDivider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: "rgba(83,94,44,0.16)" },
  statValue: { fontFamily: fontFamilies.display.semibold, fontSize: 22, color: INK, fontVariant: ["tabular-nums"] },
  statLabelRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  statDot: { width: 6, height: 6, borderRadius: 3 },
  statLabel: { flexShrink: 1, fontFamily: fontFamilies.sans.regular, fontSize: 11, color: colors.ink.mute },

  ticket: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.1)",
    marginBottom: 12,
    overflow: "hidden",
  },
  dim: { opacity: 0.55 },
  ticketMain: { flexDirection: "row", alignItems: "stretch", minHeight: 104 },
  stub: {
    width: 104,
    backgroundColor: colors.olive[900],
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  stubMuted: { backgroundColor: colors.ink.mute },
  stubValue: { fontFamily: fontFamilies.display.semibold, fontSize: 28, color: CREAM, letterSpacing: -0.5 },
  stubSub: {
    marginTop: 2,
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: GOLD,
  },
  perf: { width: 14, alignItems: "center", marginLeft: -7, zIndex: 1 },
  notch: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.paper.DEFAULT },
  notchTop: { marginTop: -7 },
  notchBottom: { marginBottom: -7 },
  perfLine: {
    flex: 1,
    width: 0,
    borderLeftWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "rgba(83,94,44,0.25)",
    marginVertical: 4,
  },
  ticketBody: { flex: 1, minWidth: 0, justifyContent: "center", paddingVertical: 14, paddingRight: 14, paddingLeft: 6, gap: 4 },
  codeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  couponCode: {
    flexShrink: 1,
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 18,
    letterSpacing: 1.6,
    color: INK,
  },
  copyBtn: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: colors.olive[50],
    alignItems: "center",
    justifyContent: "center",
  },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  couponMetaText: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.ink.mute },

  usageBlock: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 7,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(83,94,44,0.12)",
  },
  usageTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  usageLabel: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.ink.mute },
  usageStrong: { fontFamily: fontFamilies.sans.semibold, color: INK },
  usageBarBg: { height: 6, borderRadius: 3, backgroundColor: "rgba(83,94,44,0.1)", overflow: "hidden" },
  usageBarFill: { height: "100%", borderRadius: 3, backgroundColor: colors.olive[600] },
  usageBarFull: { backgroundColor: RUST },

  couponActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontFamily: fontFamilies.sans.semibold, fontSize: 12 },
  actionGroup: { flexDirection: "row", alignItems: "center", gap: 6 },
  switchWrap: { flexDirection: "row", alignItems: "center", gap: 2 },
  switchLabel: { fontFamily: fontFamilies.sans.medium, fontSize: 12, color: colors.ink.mute },
  iconAction: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(184,92,58,0.08)",
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
