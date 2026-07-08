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
import { getSellerStore, getStoreCoupons, createStoreCoupon, toggleCoupon } from "@/lib/api";
import { colors, typography, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import type { AdminCoupon } from "@/lib/api";

const COUPON_TYPES = [
  { key: "percentage", label: "Percentage", icon: "percent-outline" as const },
  { key: "fixed", label: "Fixed Amount", icon: "cash-outline" as const },
  { key: "free_shipping", label: "Free Shipping", icon: "bicycle-outline" as const },
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

  // Create form
  const [code, setCode] = useState("");
  const [type, setType] = useState<string>("percentage");
  const [value, setValue] = useState("");
  const [minOrder, setMinOrder] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [creating, setCreating] = useState(false);

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

  const resetForm = () => {
    setCode("");
    setType("percentage");
    setValue("");
    setMinOrder("");
    setMaxUses("");
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
            <View key={coupon.id} style={s.couponCard}>
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
            </View>
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
            </ScrollView>
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
