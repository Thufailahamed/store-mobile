import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Switch,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Clipboard from "expo-clipboard";
import { Modal } from "@/components/ui/Modal";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@/components/ui/Icon";
import { getAdminCoupons, createCoupon, toggleCoupon, type AdminCoupon } from "@/lib/api";
import { EmptyState, Skeleton, Input, Button, useToast } from "@/components/ui";
import { colors, radii, shadows } from "@/lib/theme/tokens";
import { AdminMasthead, StatBand, SearchField, Segmented, premiumCard, GOLD, CREAM, RUST } from "@/components/admin/premium-kit";
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

type ActiveFilter = "all" | "true" | "false";

function stubValue(c: AdminCoupon): { big: string; small: string } {
  switch (c.type) {
    case "percentage":
      return { big: `${c.value}%`, small: "OFF" };
    case "fixed":
      return { big: formatPrice(c.value ?? 0).replace(/\.00$/, ""), small: "OFF" };
    case "free_shipping":
      return { big: "Free", small: "SHIPPING" };
    default:
      return { big: `${c.bxgy_buy_quantity ?? "X"}+${c.bxgy_get_quantity ?? "Y"}`, small: "BUY · GET" };
  }
}

export default function AdminCoupons() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<ActiveFilter>("all");
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
      <FlatList
        data={q.isLoading || loadError ? [] : coupons}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={q.isFetching && !q.isLoading} onRefresh={() => q.refetch()} tintColor={colors.light.primary} />
        }
        ListHeaderComponent={
          <View>
            <AdminMasthead
              eyebrow="Promotions"
              title="Coupon"
              italic="Ledger"
              subtitle="Platform discount codes, their reach and remaining runway."
              onAdd={() => setShowCreate(true)}
            />
            {coupons.length ? (
              <StatBand
                items={[
                  { label: "Codes", value: coupons.length },
                  { label: "Live", value: liveCount, accent: true },
                  { label: "Redeemed", value: redemptions.toLocaleString() },
                ]}
              />
            ) : null}
            <SearchField value={search} onChangeText={(t) => setSearch(t.toUpperCase())} placeholder="Search by code…" autoCapitalize="characters" />
            <Segmented<ActiveFilter>
              value={active}
              onChange={setActive}
              options={[
                { value: "all", label: "All" },
                { value: "true", label: "Live" },
                { value: "false", label: "Paused" },
              ]}
            />
          </View>
        }
        ListEmptyComponent={
          q.isLoading ? (
            <View style={{ gap: 14 }}>
              <Skeleton height={150} style={{ borderRadius: radii["2xl"] }} />
              <Skeleton height={150} style={{ borderRadius: radii["2xl"] }} />
            </View>
          ) : loadError ? (
            <EmptyState icon="cloud-offline-outline" title="Couldn't load coupons" description={loadError} />
          ) : (
            <EmptyState
              icon="ticket-outline"
              title="No coupons"
              description={search || active !== "all" ? "No coupons match your filters." : "Create your first platform coupon."}
            />
          )
        }
        renderItem={({ item }) => (
          <CouponTicket
            item={item}
            busy={toggleM.isPending}
            onToggle={(v) => toggleM.mutate({ id: item.id, is_active: v })}
          />
        )}
      />

      <CreateModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => { qc.invalidateQueries({ queryKey: ["admin-coupons"] }); setShowCreate(false); }}
      />
    </View>
  );
}

function CouponTicket({ item, busy, onToggle }: { item: AdminCoupon; busy: boolean; onToggle: (v: boolean) => void }) {
  const { toast } = useToast();
  const expiry = expiryLabel(item.ends_at);
  const exhausted = typeof item.max_uses === "number" && item.max_uses > 0 && (item.current_uses ?? 0) >= item.max_uses;
  const usagePct =
    typeof item.max_uses === "number" && item.max_uses > 0
      ? Math.min(1, (item.current_uses ?? 0) / item.max_uses)
      : null;
  const live = item.is_active && !exhausted && !expiry?.expired;
  const status = expiry?.expired ? "Expired" : exhausted ? "Exhausted" : item.is_active ? "Live" : "Paused";
  const stub = stubValue(item);
  const stubColors: [string, string] = live ? ["#3a4120", "#1c200f"] : ["#8d8b7c", "#6c6a5d"];

  return (
    <View style={[styles.ticket, !live && styles.ticketDim]}>
      <LinearGradient colors={stubColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.stub}>
        <Text style={styles.stubBig} numberOfLines={1} adjustsFontSizeToFit>{stub.big}</Text>
        <Text style={styles.stubSmall}>{stub.small}</Text>
        <View style={styles.stubType}>
          <Ionicons name={(TYPE_META[item.type] ?? TYPE_META.percentage).icon} size={11} color={live ? GOLD : CREAM} />
        </View>
      </LinearGradient>

      {/* perforation */}
      <View style={styles.perf}>
        <View style={[styles.notch, styles.notchTop]} />
        <View style={styles.perfLine} />
        <View style={[styles.notch, styles.notchBottom]} />
      </View>

      <View style={styles.ticketBody}>
        <View style={styles.codeRow}>
          <Pressable
            style={({ pressed }) => [styles.codeBtn, pressed && { opacity: 0.55 }]}
            hitSlop={4}
            onPress={async () => {
              await Clipboard.setStringAsync(item.code);
              toast.success(`${item.code} copied`);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Copy code ${item.code}`}
          >
            <Text style={styles.code} numberOfLines={1}>{item.code}</Text>
            <Ionicons name="copy-outline" size={13} color={colors.light.mutedForeground} />
          </Pressable>
          <View style={[styles.statusPill, live ? styles.statusPillLive : expiry?.expired || exhausted ? styles.statusPillWarn : styles.statusPillOff]}>
            <View style={[styles.statusDot, { backgroundColor: live ? "#4f8a2c" : expiry?.expired || exhausted ? RUST : colors.light.mutedForeground }]} />
            <Text style={[styles.statusPillText, { color: live ? colors.olive[800] : expiry?.expired || exhausted ? RUST : colors.light.mutedForeground }]}>
              {status}
            </Text>
          </View>
        </View>
        <Text style={styles.summary} numberOfLines={2}>{couponSummary(item)}</Text>

        {usagePct !== null ? (
          <View style={styles.meterWrap}>
            <View style={styles.meterTrack}>
              <LinearGradient
                colors={exhausted ? [RUST, "#d07a58"] : [colors.olive[700], colors.olive[400]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.meterFill, { width: `${Math.max(2, Math.round(usagePct * 100))}%` as never }]}
              />
            </View>
            <Text style={styles.meterText}>
              {item.current_uses ?? 0}<Text style={styles.meterTextDim}> / {item.max_uses} used</Text>
            </Text>
          </View>
        ) : (
          <Text style={styles.meterText}>
            {item.current_uses ?? 0}<Text style={styles.meterTextDim}> redeemed · unlimited</Text>
          </Text>
        )}

        <View style={styles.ticketFooter}>
          <Text style={styles.footMeta} numberOfLines={1}>
            {(item.scope ?? "platform").toUpperCase()}
            <Text style={expiry?.expired ? styles.footExpired : undefined}>
              {"  ·  "}{expiry ? expiry.text.toUpperCase() : "NO EXPIRY"}
            </Text>
          </Text>
          <Switch
            value={item.is_active}
            disabled={busy}
            onValueChange={onToggle}
            trackColor={{ true: colors.olive[600], false: colors.light.border }}
            thumbColor={colors.light.card}
            ios_backgroundColor={colors.light.border}
            style={styles.switch}
            accessibilityLabel={`${item.is_active ? "Pause" : "Activate"} ${item.code}`}
          />
        </View>
      </View>
    </View>
  );
}

type NewType = "percentage" | "fixed" | "free_shipping";

const TYPE_COPY: Record<NewType, { label: string; desc: string }> = {
  percentage: { label: "Percent", desc: "% off order" },
  fixed: { label: "Fixed", desc: "Rs. off order" },
  free_shipping: { label: "Free Ship", desc: "Rs. 0 delivery" },
};

function CreateModal({ visible, onClose, onCreated }: { visible: boolean; onClose: () => void; onCreated: () => void }) {
  const [code, setCode] = useState("");
  const [value, setValue] = useState("");
  const [minOrder, setMinOrder] = useState("");
  const [usageLimit, setUsageLimit] = useState("");
  const [type, setType] = useState<NewType>("percentage");
  const [loading, setLoading] = useState(false);

  const reset = () => { setCode(""); setValue(""); setMinOrder(""); setUsageLimit(""); setType("percentage"); };

  const create = async () => {
    const needsValue = type !== "free_shipping";
    if (!code.trim()) return Alert.alert("Missing code", "Give this coupon a code shoppers will enter.");
    if (needsValue && (!value.trim() || Number(value) <= 0)) return Alert.alert("Missing value", "Enter a discount value greater than zero.");
    setLoading(true);
    const r = await createCoupon({
      code: code.toUpperCase().trim(),
      value: needsValue ? Number(value) : 0,
      type,
      min_order_value: minOrder.trim() ? Number(minOrder) : 0,
      usage_limit: usageLimit.trim() ? Number(usageLimit) : undefined,
      is_active: true,
      current_uses: 0,
    } as Partial<AdminCoupon>);
    setLoading(false);
    if (r.ok) { reset(); onCreated(); }
    else Alert.alert("Error", r.error);
  };

  // Live preview stub — mirrors the ticket the coupon becomes once created.
  const previewCode = code.trim() || "YOURCODE";
  const previewStub =
    type === "percentage"
      ? { big: `${value.trim() || "0"}%`, small: "OFF" }
      : type === "fixed"
        ? { big: `Rs.${value.trim() ? Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 }) : "0"}`, small: "OFF" }
        : { big: "Free", small: "SHIPPING" };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.modal} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.grabber} />
        <View style={styles.modalHeader}>
          <View style={{ flex: 1 }}>
            <View style={styles.eyebrowRow}>
              <View style={styles.eyebrowRule} />
              <Text style={styles.eyebrow}>PROMOTIONS</Text>
            </View>
            <Text style={styles.modalTitle}>New <Text style={styles.modalTitleItalic}>Coupon</Text></Text>
          </View>
          <Pressable onPress={onClose} hitSlop={6} style={({ pressed }) => [styles.closeRing, pressed && { opacity: 0.85 }]} accessibilityLabel="Close">
            <LinearGradient colors={["#e3c878", GOLD, "#9c7a2c"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.closeRingInner}>
              <LinearGradient colors={["#3a4120", "#1c200f"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.closeInner}>
                <Ionicons name="close" size={18} color={CREAM} />
              </LinearGradient>
            </LinearGradient>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.modalScroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Live preview */}
          <View style={styles.previewTicket}>
            <LinearGradient colors={["#3a4120", "#1c200f"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.previewStub}>
              <Text style={styles.previewStubBig} numberOfLines={1} adjustsFontSizeToFit>{previewStub.big}</Text>
              <Text style={styles.previewStubSmall}>{previewStub.small}</Text>
            </LinearGradient>
            <View style={styles.previewBody}>
              <Text style={styles.previewLabel}>LIVE PREVIEW</Text>
              <Text style={styles.previewCode} numberOfLines={1}>{previewCode.toUpperCase()}</Text>
              <Text style={styles.previewMeta} numberOfLines={1}>
                {TYPE_COPY[type].desc.toUpperCase()}
                {minOrder.trim() ? `  ·  MIN Rs.${Number(minOrder).toLocaleString()}` : ""}
                {usageLimit.trim() ? `  ·  ${usageLimit} USES` : ""}
              </Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>01. Code</Text>
          <Input
            placeholder="WELCOME10"
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase().replace(/\s/g, ""))}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={40}
            style={styles.codeInput}
            leftIcon={<Ionicons name="ticket-outline" size={18} color={colors.light.mutedForeground} />}
          />

          <Text style={styles.sectionLabel}>02. Discount type</Text>
          <View style={styles.typeGrid}>
            {(Object.keys(TYPE_COPY) as NewType[]).map((t) => {
              const on = type === t;
              return (
                <Pressable
                  key={t}
                  onPress={() => setType(t)}
                  style={({ pressed }) => [styles.typeCard, on && styles.typeCardOn, pressed && { transform: [{ scale: 0.98 }] }]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                >
                  {on ? <View style={styles.typeCardRing} /> : null}
                  <View style={[styles.typeIcon, on && styles.typeIconOn]}>
                    <Ionicons name={TYPE_META[t].icon} size={16} color={on ? CREAM : colors.light.mutedForeground} />
                  </View>
                  <Text style={[styles.typeCardLabel, on && styles.typeCardLabelOn]}>{TYPE_COPY[t].label}</Text>
                  <Text style={[styles.typeCardDesc, on && styles.typeCardDescOn]}>{TYPE_COPY[t].desc}</Text>
                </Pressable>
              );
            })}
          </View>

          {type !== "free_shipping" ? (
            <>
              <Text style={styles.sectionLabel}>03. Value</Text>
              <Input
                placeholder={type === "percentage" ? "10" : "250"}
                value={value}
                onChangeText={setValue}
                keyboardType="numeric"
                style={styles.codeInput}
                leftIcon={
                  type === "percentage"
                    ? <Ionicons name="pricetag-outline" size={18} color={colors.light.mutedForeground} />
                    : <Text style={styles.affix}>Rs.</Text>
                }
                rightIcon={type === "percentage" ? <Text style={styles.affix}>%</Text> : undefined}
              />
            </>
          ) : null}

          <Text style={styles.sectionLabel}>{type === "free_shipping" ? "03. Limits" : "04. Limits"} <Text style={styles.sectionOptional}>optional</Text></Text>
          <View style={styles.limitRow}>
            <View style={{ flex: 1 }}>
              <Input
                label="Min order (Rs.)"
                placeholder="0"
                value={minOrder}
                onChangeText={setMinOrder}
                keyboardType="numeric"
                style={styles.codeInput}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                label="Usage limit"
                placeholder="∞"
                value={usageLimit}
                onChangeText={setUsageLimit}
                keyboardType="number-pad"
                style={styles.codeInput}
              />
            </View>
          </View>
        </ScrollView>

        <View style={styles.modalFooter}>
          <Button variant="brand" size="lg" onPress={create} loading={loading} style={styles.createBtn}>
            Create Coupon
          </Button>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const NOTCH = 14;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  list: { paddingBottom: 140, gap: 14 },

  ticket: { ...premiumCard, flexDirection: "row", marginHorizontal: 16, overflow: "hidden" },
  ticketDim: { opacity: 0.85 },
  stub: { width: 96, alignItems: "center", justifyContent: "center", paddingHorizontal: 8, paddingVertical: 18 },
  stubBig: { fontFamily: fontFamilies.display.semibold, fontSize: 28, color: CREAM, letterSpacing: -0.8, maxWidth: 84 },
  stubSmall: { fontFamily: fontFamilies.mono.medium, fontSize: 8.5, color: "rgba(250,248,241,0.7)", letterSpacing: 1.6, marginTop: 2 },
  stubType: {
    position: "absolute",
    top: 10,
    left: 10,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(200,164,74,0.5)",
  },
  perf: { width: 1, alignItems: "center" },
  perfLine: { flex: 1, width: 0, borderLeftWidth: 1, borderStyle: "dashed", borderColor: "#cfcdb9", marginVertical: NOTCH / 2 + 2 },
  notch: { position: "absolute", width: NOTCH, height: NOTCH, borderRadius: NOTCH / 2, backgroundColor: colors.light.background, zIndex: 2 },
  notchTop: { top: -NOTCH / 2 },
  notchBottom: { bottom: -NOTCH / 2 },

  ticketBody: { flex: 1, padding: 14, paddingLeft: 16, gap: 8 },
  codeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  codeBtn: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  code: { fontFamily: fontFamilies.mono.semibold, fontSize: 16, color: colors.light.foreground, letterSpacing: 1.6 },
  summary: { fontFamily: fontFamilies.sans.regular, fontSize: 12.5, lineHeight: 17, color: colors.light.mutedForeground },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.full },
  statusPillLive: { backgroundColor: "rgba(83,94,44,0.12)" },
  statusPillWarn: { backgroundColor: "rgba(184,92,58,0.1)" },
  statusPillOff: { backgroundColor: colors.light.muted },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusPillText: { fontFamily: fontFamilies.mono.semibold, fontSize: 8.5, letterSpacing: 0.8, textTransform: "uppercase" },
  meterWrap: { gap: 5 },
  meterTrack: { height: 4, borderRadius: 2, backgroundColor: "#e6e5d8", overflow: "hidden" },
  meterFill: { height: 4, borderRadius: 2 },
  meterText: { fontFamily: fontFamilies.mono.semibold, fontSize: 10.5, color: colors.light.foreground },
  meterTextDim: { fontFamily: fontFamilies.mono.regular, color: colors.light.mutedForeground },
  ticketFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#dddccd",
  },
  footMeta: { flex: 1, fontFamily: fontFamilies.mono.medium, fontSize: 9, color: colors.light.mutedForeground, letterSpacing: 1 },
  footExpired: { color: RUST },
  switch: { transform: [{ scale: 0.82 }], marginVertical: -6, marginRight: -4 },

  // ——— Create modal ———
  modal: { flex: 1, backgroundColor: colors.light.background },
  grabber: { alignSelf: "center", width: 38, height: 4, borderRadius: 2, backgroundColor: "#d6d4c4", marginTop: 10, marginBottom: 6 },
  modalHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 16 },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  eyebrowRule: { width: 18, height: 1, backgroundColor: colors.light.primary },
  eyebrow: { fontFamily: fontFamilies.mono.medium, fontSize: 10, color: colors.light.primary, letterSpacing: 2 },
  modalTitle: { fontFamily: fontFamilies.display.semibold, fontSize: 30, lineHeight: 34, color: colors.light.foreground, letterSpacing: -0.8, marginTop: 8 },
  modalTitleItalic: { fontFamily: fontFamilies.display.italic, color: colors.olive[600] },
  closeRing: { borderRadius: 20, ...shadows.editorial },
  closeRingInner: { width: 38, height: 38, borderRadius: 19, padding: 1.5 },
  closeInner: { flex: 1, borderRadius: 18, alignItems: "center", justifyContent: "center" },

  modalScroll: { paddingHorizontal: 20, paddingBottom: 24, gap: 4 },

  // Live preview ticket
  previewTicket: {
    flexDirection: "row",
    alignItems: "stretch",
    borderRadius: radii["2xl"],
    overflow: "hidden",
    marginBottom: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(200,164,74,0.35)",
    backgroundColor: colors.light.card,
    ...shadows.soft,
    shadowOpacity: 0.08,
  },
  previewStub: { width: 92, alignItems: "center", justifyContent: "center", paddingHorizontal: 8, paddingVertical: 20 },
  previewStubBig: { fontFamily: fontFamilies.display.semibold, fontSize: 24, color: CREAM, letterSpacing: -0.6, maxWidth: 80 },
  previewStubSmall: { fontFamily: fontFamilies.mono.medium, fontSize: 8, color: "rgba(250,248,241,0.7)", letterSpacing: 1.4, marginTop: 3 },
  previewBody: { flex: 1, padding: 14, paddingLeft: 16, justifyContent: "center", gap: 4 },
  previewLabel: { fontFamily: fontFamilies.mono.medium, fontSize: 8, color: GOLD, letterSpacing: 1.6 },
  previewCode: { fontFamily: fontFamilies.mono.semibold, fontSize: 18, color: colors.light.foreground, letterSpacing: 1.6 },
  previewMeta: { fontFamily: fontFamilies.mono.medium, fontSize: 9, color: colors.light.mutedForeground, letterSpacing: 0.8 },

  sectionLabel: { fontFamily: fontFamilies.mono.medium, fontSize: 10.5, color: colors.light.foreground, letterSpacing: 1.6, textTransform: "uppercase", marginBottom: 8, marginTop: 6 },
  sectionOptional: { fontFamily: fontFamilies.mono.regular, color: colors.light.mutedForeground, letterSpacing: 1, textTransform: "lowercase" },
  codeInput: { fontFamily: fontFamilies.mono.semibold, letterSpacing: 1.2 },
  affix: { fontFamily: fontFamilies.mono.semibold, fontSize: 13, color: colors.light.mutedForeground, letterSpacing: 0.5 },

  typeGrid: { flexDirection: "row", gap: 10, marginBottom: 12 },
  typeCard: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderRadius: radii.xl,
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  typeCardOn: { backgroundColor: colors.olive[900], borderColor: colors.olive[900], ...shadows.glow },
  typeCardRing: {
    position: "absolute",
    top: -3, left: -3, right: -3, bottom: -3,
    borderRadius: radii.xl + 3,
    borderWidth: 1.5,
    borderColor: "rgba(200,164,74,0.6)",
  },
  typeIcon: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: "center", justifyContent: "center",
    backgroundColor: colors.light.muted,
    marginBottom: 2,
  },
  typeIconOn: { backgroundColor: "rgba(250,248,241,0.14)" },
  typeCardLabel: { fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: colors.light.foreground, letterSpacing: 0.2 },
  typeCardLabelOn: { color: CREAM },
  typeCardDesc: { fontFamily: fontFamilies.mono.regular, fontSize: 8, color: colors.light.mutedForeground, letterSpacing: 0.4, textAlign: "center" },
  typeCardDescOn: { color: "rgba(250,248,241,0.6)" },

  limitRow: { flexDirection: "row", gap: 12 },

  modalFooter: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 20 : 16,
    backgroundColor: colors.light.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#dddccd",
  },
  createBtn: { width: "100%" },
});
