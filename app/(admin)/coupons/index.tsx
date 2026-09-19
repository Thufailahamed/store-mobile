import React, { useState } from "react";
import { View, Text, FlatList, Pressable, RefreshControl, StyleSheet, TextInput, Alert, Modal } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@/components/ui/Icon";
import { getAdminCoupons, createCoupon, toggleCoupon, type AdminCoupon } from "@/lib/api";
import { EmptyState, Skeleton, Input, Button } from "@/components/ui";
import { colors, radii, shadows } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";

const TYPE_META: Record<string, { icon: keyof typeof Ionicons.glyphMap; label: string }> = {
  percentage: { icon: "pricetag-outline", label: "Percent" },
  fixed: { icon: "cash-outline", label: "Fixed" },
  free_shipping: { icon: "bicycle-outline", label: "Free Ship" },
  bxgy: { icon: "gift-outline", label: "BXGY" },
};

function couponSummary(c: AdminCoupon): string {
  const base =
    c.type === "percentage"
      ? `${c.value}% off`
      : c.type === "fixed"
        ? `${formatPrice(c.value ?? 0)} off`
        : c.type === "free_shipping"
          ? "Free shipping"
          : "Buy X get Y";
  const parts = [base];
  if (c.min_order_total) parts.push(`min ${formatPrice(c.min_order_total)}`);
  if (c.max_discount) parts.push(`cap ${formatPrice(c.max_discount)}`);
  return parts.join(" · ");
}

function expiryLabel(endsAt?: string): { text: string; expired: boolean } | null {
  if (!endsAt) return null;
  const end = new Date(endsAt).getTime();
  if (!Number.isFinite(end)) return null;
  if (end < Date.now()) return { text: "Expired", expired: true };
  return {
    text: `Ends ${new Date(end).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`,
    expired: false,
  };
}

export default function AdminCoupons() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [active, setActive] = useState("all");
  const [showCreate, setShowCreate] = useState(false);

  const q = useQuery({
    queryKey: ["admin-coupons", active, search],
    queryFn: async () => {
      const r = await getAdminCoupons({ search, is_active: active });
      if (r.ok) return { list: r.data, error: null as string | null };
      return { list: [] as AdminCoupon[], error: r.error ?? "Failed to load coupons" };
    },
  });

  const toggleM = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) => toggleCoupon(id, is_active),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-coupons"] }),
    onError: (e: any) => Alert.alert("Couldn't update coupon", e?.message ?? "Try again"),
  });

  const coupons = q.data?.list ?? [];
  const loadError = q.data?.error ?? null;
  const liveCount = coupons.filter((c) => c.is_active).length;
  const redemptions = coupons.reduce((n, c) => n + (c.current_uses ?? 0), 0);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>PROMOTIONS</Text>
          <Text style={styles.title}>Coupons</Text>
          <Text style={styles.subtitle}>
            {coupons.length ? `${liveCount} live · ${redemptions} redemptions` : "Platform discount codes"}
          </Text>
        </View>
        <Pressable onPress={() => setShowCreate(true)} style={styles.addBtn}>
          <Ionicons name="add" size={20} color="#fff" />
        </Pressable>
      </View>

      <TextInput
        style={styles.search}
        placeholder="Search by code…"
        placeholderTextColor={colors.light.mutedForeground}
        value={search}
        onChangeText={setSearch}
      />

      <FlatList
        horizontal
        data={["all", "true", "false"]}
        keyExtractor={(s) => s}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
        renderItem={({ item: t }) => (
          <Pressable onPress={() => setActive(t)} style={[styles.chip, active === t && styles.chipActive]}>
            <Text style={[styles.chipText, active === t && styles.chipTextActive]}>
              {t === "all" ? "All" : t === "true" ? "Live" : "Off"}
            </Text>
          </Pressable>
        )}
      />

      {q.isLoading ? (
        <View style={styles.list}>
          <Skeleton height={110} style={{ borderRadius: radii.xl }} />
          <Skeleton height={110} style={{ borderRadius: radii.xl }} />
        </View>
      ) : loadError ? (
        <EmptyState icon="cloud-offline-outline" title="Couldn't load coupons" description={loadError} />
      ) : coupons.length === 0 ? (
        <EmptyState
          icon="ticket-outline"
          title="No coupons"
          description={search || active !== "all" ? "No coupons match your filters." : "Create your first platform coupon."}
        />
      ) : (
        <FlatList
          data={coupons}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={colors.light.primary} />
          }
          renderItem={({ item }) => <CouponCard item={item} busy={toggleM.isPending} onToggle={() => toggleM.mutate({ id: item.id, is_active: !item.is_active })} />}
        />
      )}

      <CreateModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => { qc.invalidateQueries({ queryKey: ["admin-coupons"] }); setShowCreate(false); }}
      />
    </View>
  );
}

function CouponCard({ item, busy, onToggle }: { item: AdminCoupon; busy: boolean; onToggle: () => void }) {
  const meta = TYPE_META[item.type] ?? TYPE_META.percentage;
  const expiry = expiryLabel(item.ends_at);
  const exhausted = typeof item.max_uses === "number" && item.max_uses > 0 && (item.current_uses ?? 0) >= item.max_uses;
  const usagePct =
    typeof item.max_uses === "number" && item.max_uses > 0
      ? Math.min(1, (item.current_uses ?? 0) / item.max_uses)
      : null;
  const live = item.is_active && !exhausted && !expiry?.expired;

  return (
    <Pressable
      onPress={onToggle}
      disabled={busy}
      style={({ pressed }) => [styles.card, !item.is_active && styles.cardOff, pressed && styles.pressed]}
    >
      <View style={styles.cardTop}>
        <View style={styles.typeBadge}>
          <Ionicons name={meta.icon} size={15} color={colors.olive[800]} />
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.code}>{item.code}</Text>
          <Text style={styles.summary} numberOfLines={1}>{couponSummary(item)}</Text>
        </View>
        <View style={[styles.statusPill, live ? styles.statusPillLive : styles.statusPillOff]}>
          <View style={[styles.statusDot, { backgroundColor: live ? colors.olive[700] : colors.light.mutedForeground }]} />
          <Text style={[styles.statusPillText, live ? styles.statusPillTextLive : styles.statusPillTextOff]}>
            {expiry?.expired ? "Expired" : exhausted ? "Exhausted" : item.is_active ? "Live" : "Off"}
          </Text>
        </View>
      </View>

      {usagePct !== null ? (
        <View style={styles.meterWrap}>
          <View style={styles.meterTrack}>
            <View style={[styles.meterFill, { width: `${Math.round(usagePct * 100)}%` as never }, exhausted && styles.meterFillOut]} />
          </View>
          <Text style={styles.meterText}>{item.current_uses ?? 0}/{item.max_uses} used</Text>
        </View>
      ) : (
        <Text style={styles.meterText}>{item.current_uses ?? 0} redemptions · unlimited uses</Text>
      )}

      <View style={styles.cardFooter}>
        <View style={styles.footerChip}>
          <Ionicons name="layers-outline" size={11} color={colors.light.mutedForeground} />
          <Text style={styles.footerChipText}>{item.scope ?? "platform"}</Text>
        </View>
        {expiry ? (
          <View style={[styles.footerChip, expiry.expired && styles.footerChipExpired]}>
            <Ionicons name="calendar-outline" size={11} color={expiry.expired ? colors.accent2.rust : colors.light.mutedForeground} />
            <Text style={[styles.footerChipText, expiry.expired && styles.footerChipTextExpired]}>{expiry.text}</Text>
          </View>
        ) : (
          <View style={styles.footerChip}>
            <Ionicons name="infinite-outline" size={12} color={colors.light.mutedForeground} />
            <Text style={styles.footerChipText}>No expiry</Text>
          </View>
        )}
        <Text style={styles.footerHint}>Tap to {item.is_active ? "pause" : "activate"}</Text>
      </View>
    </Pressable>
  );
}

function CreateModal({ visible, onClose, onCreated }: { visible: boolean; onClose: () => void; onCreated: () => void }) {
  const [code, setCode] = useState("");
  const [value, setValue] = useState("");
  const [type, setType] = useState<"percentage" | "fixed" | "free_shipping">("percentage");
  const [loading, setLoading] = useState(false);

  const create = async () => {
    if (!code.trim() || !value.trim()) return Alert.alert("Missing fields", "Code and value are required");
    setLoading(true);
    const r = await createCoupon({
      code: code.toUpperCase().trim(),
      value: Number(value),
      type,
      is_active: true,
      current_uses: 0,
    });
    setLoading(false);
    if (r.ok) { setCode(""); setValue(""); onCreated(); }
    else Alert.alert("Error", r.error);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modal}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>New Coupon</Text>
          <Pressable onPress={onClose}><Ionicons name="close" size={22} color={colors.light.foreground} /></Pressable>
        </View>
        <Input label="Code" placeholder="WELCOME10" value={code} onChangeText={(t) => setCode(t.toUpperCase())} autoCapitalize="characters" />
        <View style={{ height: 12 }} />
        <Input label="Value" placeholder="10" value={value} onChangeText={setValue} keyboardType="numeric" />
        <View style={{ height: 12 }} />
        <Text style={styles.fieldLabel}>Type</Text>
        <View style={styles.typeRow}>
          {(["percentage", "fixed", "free_shipping"] as const).map((t) => (
            <Pressable key={t} onPress={() => setType(t)} style={[styles.typeBtn, type === t && styles.typeBtnActive]}>
              <Ionicons name={TYPE_META[t].icon} size={13} color={type === t ? "#fff" : colors.light.mutedForeground} />
              <Text style={[styles.typeText, type === t && styles.typeTextActive]}>{TYPE_META[t].label}</Text>
            </Pressable>
          ))}
        </View>
        <View style={{ height: 24 }} />
        <Button onPress={create} loading={loading}>Create Coupon</Button>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, paddingBottom: 12 },
  eyebrow: { fontFamily: fontFamilies.mono.medium, fontSize: 10, color: colors.light.primary, letterSpacing: 1.4 },
  title: { fontFamily: fontFamilies.display.regular, fontSize: 28, color: colors.light.foreground, marginTop: 4, letterSpacing: -0.5 },
  subtitle: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: colors.light.mutedForeground, marginTop: 4 },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.olive[900], alignItems: "center", justifyContent: "center", ...shadows.soft },
  search: { marginHorizontal: 20, marginBottom: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.light.card, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.light.border, fontSize: 14, color: colors.light.foreground },
  filters: { paddingHorizontal: 20, gap: 8, paddingBottom: 12 },
  chip: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 999, backgroundColor: colors.light.card, borderWidth: 1, borderColor: colors.light.border },
  chipActive: { backgroundColor: colors.light.primary, borderColor: colors.light.primary },
  chipText: { fontFamily: fontFamilies.mono.medium, fontSize: 11, color: colors.light.mutedForeground, letterSpacing: 0.6, textTransform: "uppercase" },
  chipTextActive: { color: "#fff" },
  list: { padding: 20, paddingTop: 0, paddingBottom: 100, gap: 10 },
  pressed: { opacity: 0.8 },
  card: {
    backgroundColor: colors.light.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: 14,
    gap: 10,
    ...shadows.soft,
  },
  cardOff: { opacity: 0.72 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  typeBadge: {
    width: 40,
    height: 40,
    borderRadius: 11,
    backgroundColor: "#eef0e2",
    borderWidth: 1,
    borderColor: "#dde0c9",
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: { flex: 1, gap: 2 },
  code: { fontFamily: fontFamilies.mono.semibold, fontSize: 15, color: colors.light.foreground, letterSpacing: 1 },
  summary: { fontFamily: fontFamilies.sans.regular, fontSize: 11.5, color: colors.light.mutedForeground },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: radii.full },
  statusPillLive: { backgroundColor: "rgba(83,94,44,0.14)" },
  statusPillOff: { backgroundColor: colors.light.muted },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusPillText: { fontFamily: fontFamilies.mono.semibold, fontSize: 9, letterSpacing: 0.5, textTransform: "uppercase" },
  statusPillTextLive: { color: colors.olive[800] },
  statusPillTextOff: { color: colors.light.mutedForeground },
  meterWrap: { gap: 5 },
  meterTrack: { height: 5, borderRadius: 3, backgroundColor: colors.light.muted, overflow: "hidden" },
  meterFill: { height: 5, borderRadius: 3, backgroundColor: colors.olive[700] },
  meterFillOut: { backgroundColor: colors.accent2.rust },
  meterText: { fontFamily: fontFamilies.mono.regular, fontSize: 10, color: colors.light.mutedForeground },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.light.border,
  },
  footerChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    backgroundColor: colors.light.muted,
  },
  footerChipExpired: { backgroundColor: "rgba(184,92,58,0.12)" },
  footerChipText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    color: colors.light.mutedForeground,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  footerChipTextExpired: { color: colors.accent2.rust },
  footerHint: {
    flex: 1,
    textAlign: "right",
    fontFamily: fontFamilies.sans.regular,
    fontSize: 10,
    color: colors.light.mutedForeground,
  },
  modal: { flex: 1, backgroundColor: colors.light.background, padding: 20, paddingTop: 60 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  modalTitle: { fontFamily: fontFamilies.display.regular, fontSize: 22, color: colors.light.foreground },
  fieldLabel: { fontFamily: fontFamilies.mono.medium, fontSize: 11, color: colors.light.foreground, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 },
  typeRow: { flexDirection: "row", gap: 8 },
  typeBtn: { flex: 1, flexDirection: "row", gap: 5, paddingVertical: 10, borderRadius: radii.md, backgroundColor: colors.light.card, borderWidth: 1, borderColor: colors.light.border, alignItems: "center", justifyContent: "center" },
  typeBtnActive: { backgroundColor: colors.light.primary, borderColor: colors.light.primary },
  typeText: { fontFamily: fontFamilies.sans.semibold, fontSize: 11, color: colors.light.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5 },
  typeTextActive: { color: "#fff" },
});
