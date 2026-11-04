import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@/components/ui/Icon";
import { useToast } from "@/components/ui";
import { useQuery } from "@tanstack/react-query";
import { getMyGiftCards, checkGiftCardByCode } from "@/lib/api";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";
import { UserPageFrame, UP as C } from "@/components/user/user-page";

type GiftCard = {
  id: string;
  code: string;
  current_balance: number;
  initial_balance: number;
  currency: string;
  recipient_email: string | null;
  recipient_name: string | null;
  message: string | null;
  scheduled_for: string | null;
  email_sent_at: string | null;
  expires_at: string | null;
  voided_at: string | null;
  is_active: boolean;
  source: "purchased" | "received";
};

const PRESET_AMOUNTS = [5000, 10000, 20000, 50000];


const STANDARDS: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  desc: string;
}[] = [
  {
    icon: "mail-outline",
    title: "Instant & scheduled delivery",
    desc: "Sent to the recipient's email with your message and chosen delivery date.",
  },
  {
    icon: "storefront-outline",
    title: "Accepted everywhere",
    desc: "Redeemable across all boutiques and verified sellers on the platform.",
  },
  {
    icon: "shield-checkmark-outline",
    title: "Balance never expires",
    desc: "Credits can be spent across multiple orders until they run out.",
  },
];

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export default function AccountGiftCards() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { toast } = useToast();

  const [redeemCode, setRedeemCode] = useState("");
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [showRedeemInput, setShowRedeemInput] = useState(false);

  const q = useQuery({
    queryKey: ["my-gift-cards"],
    queryFn: async () => {
      const r = await getMyGiftCards();
      return r.ok ? (r.data.cards as GiftCard[]) : [];
    },
  });

  const cards = q.data ?? [];

  // Total active balance
  const totalBalance = useMemo(() => {
    return cards
      .filter((c) => c.is_active && !c.voided_at)
      .reduce((sum, c) => sum + (c.current_balance || 0), 0);
  }, [cards]);

  const currency = cards[0]?.currency || "LKR";

  const copyCode = async (code: string) => {
    try {
      await Clipboard.setStringAsync(code);
      toast("Voucher code copied", "success");
    } catch {
      toast("Could not copy code", "error");
    }
  };

  const handleQuickCheck = async () => {
    const trimmed = redeemCode.trim().toUpperCase();
    if (trimmed.length < 4) {
      toast("Please enter a valid voucher code", "error");
      return;
    }
    setRedeemLoading(true);
    try {
      const res = await checkGiftCardByCode(trimmed);
      if (res.ok) {
        if (res.data?.valid && res.data.card) {
          toast(
            `Valid card: ${formatPrice(res.data.card.current_balance, res.data.card.currency)} available`,
            "success",
          );
          router.push("/(main)/gift-cards/redeem" as any);
        } else {
          toast(res.data?.reason || "Code not found or expired", "error");
        }
      } else {
        toast(res.error || "Verification failed. Try again.", "error");
      }
    } catch {
      toast("Verification failed. Try again.", "error");
    } finally {
      setRedeemLoading(false);
    }
  };

  const goBuy = (amt?: number) =>
    router.push(
      (amt ? `/(main)/gift-cards?amount=${amt}` : "/(main)/gift-cards") as any,
    );

  const activeCount = cards.filter((c) => c.is_active && !c.voided_at).length;

  return (
    <UserPageFrame
      title="Gift vouchers"
      right={
        <TouchableOpacity
          style={styles.navBtn}
          onPress={() => q.refetch()}
          disabled={q.isFetching}
          activeOpacity={0.7}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Refresh"
        >
          {q.isFetching && !q.isLoading ? (
            <ActivityIndicator size="small" color={C.accent} />
          ) : (
            <Ionicons name="refresh-outline" size={19} color={C.text} />
          )}
        </TouchableOpacity>
      }
    >
      <SafeAreaView style={styles.container} edges={[]}>
        <FlatList
          data={cards}
          keyExtractor={(c) => c.id}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 40 },
          ]}
          ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={q.isFetching && !q.isLoading}
              onRefresh={() => q.refetch()}
              tintColor={C.accent}
            />
          }
          ListHeaderComponent={
            <View style={styles.headerSection}>
              {/* Balance */}
              <View style={styles.cardShadow}>
                <View style={styles.card}>
                  <View style={styles.heroTop}>
                    <View style={styles.heroIcon}>
                      <Ionicons name="gift" size={22} color={C.accent} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.heroLabel}>Gift card balance</Text>
                      <Text
                        style={styles.heroBalance}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.7}
                      >
                        {formatPrice(totalBalance, currency)}
                      </Text>
                    </View>
                    <View style={styles.countPill}>
                      <Text style={styles.countPillValue}>{activeCount}</Text>
                      <Text style={styles.countPillLabel}>active</Text>
                    </View>
                  </View>

                  <Text style={styles.heroSub}>
                    {cards.length === 0
                      ? "Send a voucher to someone special, or redeem one you received."
                      : "Your balance is applied automatically at checkout."}
                  </Text>

                  <View style={styles.heroActions}>
                    <TouchableOpacity
                      style={styles.primaryPill}
                      activeOpacity={0.88}
                      onPress={() => goBuy()}
                      accessibilityRole="button"
                    >
                      <Ionicons name="paper-plane" size={15} color={C.lime} />
                      <Text style={styles.primaryPillText}>Send a voucher</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.outlinePill,
                        showRedeemInput && styles.outlinePillActive,
                      ]}
                      activeOpacity={0.8}
                      onPress={() => setShowRedeemInput((prev) => !prev)}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: showRedeemInput }}
                    >
                      <Ionicons
                        name={showRedeemInput ? "close" : "ticket-outline"}
                        size={16}
                        color={C.text}
                      />
                      <Text style={styles.outlinePillText}>
                        {showRedeemInput ? "Close" : "Redeem"}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {showRedeemInput && (
                    <View style={styles.redeemBox}>
                      <Text style={styles.redeemTitle}>Redeem a voucher</Text>
                      <View style={styles.redeemInputRow}>
                        <Ionicons name="ticket-outline" size={18} color={C.muted} />
                        <TextInput
                          value={redeemCode}
                          onChangeText={(v) => setRedeemCode(v.toUpperCase())}
                          placeholder="XXXX-XXXX-XXXX"
                          placeholderTextColor={C.faint}
                          style={styles.redeemInput}
                          autoCapitalize="characters"
                          autoCorrect={false}
                          returnKeyType="done"
                          onSubmitEditing={handleQuickCheck}
                          autoFocus
                        />
                        <TouchableOpacity
                          style={[
                            styles.redeemSubmitBtn,
                            redeemCode.trim().length < 4 && { opacity: 0.35 },
                          ]}
                          onPress={handleQuickCheck}
                          disabled={redeemLoading || redeemCode.trim().length < 4}
                          activeOpacity={0.85}
                          accessibilityRole="button"
                          accessibilityLabel="Apply voucher code"
                        >
                          {redeemLoading ? (
                            <ActivityIndicator size="small" color={C.lime} />
                          ) : (
                            <Ionicons name="arrow-forward" size={17} color={C.lime} />
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              </View>

              {/* Presets */}
              <View>
                <View style={styles.sectionRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sectionTitle}>Send a voucher</Text>
                    <Text style={styles.sectionSub}>Popular amounts · instant delivery</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => goBuy()}
                    hitSlop={8}
                    style={styles.customChip}
                    accessibilityRole="button"
                  >
                    <Ionicons name="create-outline" size={14} color={C.text} />
                    <Text style={styles.customChipText}>Custom</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.presetsRow}
                  style={styles.presetsScroll}
                >
                  {PRESET_AMOUNTS.map((amt, i) => {
                    const dark = i === 1;
                    return (
                      <TouchableOpacity
                        key={amt}
                        style={styles.presetShadow}
                        activeOpacity={0.88}
                        onPress={() => goBuy(amt)}
                        accessibilityRole="button"
                        accessibilityLabel={`Send a ${formatPrice(amt, "LKR")} voucher`}
                      >
                        <View style={[styles.presetTile, dark && styles.presetTileDark]}>
                          <View style={[styles.presetIcon, dark && styles.presetIconDark]}>
                            <Ionicons name="gift" size={16} color={dark ? C.ink : C.accent} />
                          </View>
                          <View>
                            <Text style={[styles.presetCurrency, dark && styles.presetSoftDark]}>LKR</Text>
                            <Text style={[styles.presetAmount, dark && styles.presetInkDark]}>
                              {amt.toLocaleString()}
                            </Text>
                          </View>
                          <View style={styles.presetFoot}>
                            <Text style={[styles.presetSub, dark && styles.presetSoftDark]}>Send</Text>
                            <Ionicons
                              name="arrow-forward"
                              size={15}
                              color={dark ? C.lime : C.text}
                            />
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* List heading */}
              {cards.length > 0 && (
                <View style={styles.sectionRow}>
                  <Text style={[styles.sectionTitle, { flex: 1 }]}>Your vouchers</Text>
                  <View style={styles.listCountPill}>
                    <Text style={styles.listCount}>{cards.length}</Text>
                  </View>
                </View>
              )}
            </View>
          }
          ListEmptyComponent={
            q.isLoading ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator color={C.accent} size="small" />
                <Text style={styles.loadingText}>Loading gift vouchers…</Text>
              </View>
            ) : (
              <View style={styles.cardShadow}>
                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>Good to know</Text>
                  {STANDARDS.map((s, i) => (
                    <View
                      key={s.title}
                      style={[styles.standardRow, i > 0 && styles.rowDivider]}
                    >
                      <View style={styles.standardIcon}>
                        <Ionicons name={s.icon} size={18} color={C.accent} />
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={styles.standardTitle}>{s.title}</Text>
                        <Text style={styles.standardDesc}>{s.desc}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )
          }
          renderItem={({ item }) => {
            const purchased = item.source === "purchased";
            const isVoided = !!item.voided_at;
            const remainingPct =
              item.initial_balance > 0
                ? Math.max(
                    0,
                    Math.min(
                      100,
                      (item.current_balance / item.initial_balance) * 100,
                    ),
                  )
                : 0;

            return (
              <View style={[styles.cardShadow, isVoided && { opacity: 0.65 }]}>
                <View style={styles.card}>
                  <View style={styles.voucherTop}>
                    <View style={styles.heroIcon}>
                      <Ionicons
                        name={purchased ? "arrow-up" : "arrow-down"}
                        size={20}
                        color={C.accent}
                      />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.heroLabel}>
                        {purchased ? "Sent" : "Received"}
                      </Text>
                      <Text style={styles.voucherBalance} numberOfLines={1}>
                        {formatPrice(item.current_balance, item.currency)}
                      </Text>
                    </View>
                    <View style={[styles.statusPill, isVoided && styles.statusVoided]}>
                      <Text style={[styles.statusPillText, isVoided && styles.statusVoidedText]}>
                        {isVoided ? "Voided" : "Active"}
                      </Text>
                    </View>
                  </View>

                  <View>
                    <View style={styles.balanceTrack}>
                      <View
                        style={[
                          styles.balanceFill,
                          { width: `${Math.max(remainingPct, 2)}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.voucherInitial}>
                      Remaining of {formatPrice(item.initial_balance, item.currency)}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.codeRow}
                    activeOpacity={0.7}
                    onPress={() => copyCode(item.code)}
                    accessibilityRole="button"
                    accessibilityLabel="Copy voucher code"
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.codeLabel}>Voucher code</Text>
                      <Text style={styles.codeValue} numberOfLines={1}>
                        {item.code}
                      </Text>
                    </View>
                    <View style={styles.codeCopyBtn}>
                      <Ionicons name="copy-outline" size={16} color={C.lime} />
                    </View>
                  </TouchableOpacity>

                  <View style={styles.metaRow}>
                    <Ionicons
                      name={purchased ? "person-outline" : "heart-outline"}
                      size={15}
                      color={C.muted}
                    />
                    <Text style={styles.metaText} numberOfLines={1}>
                      {purchased ? "To " : "From "}
                      <Text style={styles.metaStrong}>
                        {purchased
                          ? item.recipient_email || "Recipient"
                          : item.recipient_name || "A generous friend"}
                      </Text>
                    </Text>
                  </View>

                  {item.message ? (
                    <Text style={styles.voucherMessage} numberOfLines={3}>
                      “{item.message}”
                    </Text>
                  ) : null}

                  <View style={styles.voucherFooter}>
                    <Ionicons
                      name={
                        item.scheduled_for && !item.email_sent_at
                          ? "time-outline"
                          : item.expires_at
                            ? "calendar-outline"
                            : "infinite-outline"
                      }
                      size={14}
                      color={C.muted}
                    />
                    <Text style={styles.footerText}>
                      {item.scheduled_for && !item.email_sent_at
                        ? `Scheduled ${formatDate(item.scheduled_for)}`
                        : item.expires_at
                          ? `Expires ${formatDate(item.expires_at)}`
                          : "No expiry"}
                    </Text>
                  </View>
                </View>
              </View>
            );
          }}
        />
      </SafeAreaView>
    </UserPageFrame>
  );
}

const SHADOW = {
  shadowColor: "#16170f",
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.06,
  shadowRadius: 20,
  elevation: 3,
} as const;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "transparent" },
  navBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: C.card,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
  },
  listContent: { paddingHorizontal: 20, paddingTop: 2 },
  headerSection: { gap: 22, marginBottom: 14 },

  cardShadow: { borderRadius: 26, backgroundColor: C.card, ...SHADOW },
  card: {
    backgroundColor: C.card,
    borderRadius: 26,
    borderCurve: "continuous",
    padding: 18,
    borderWidth: 1,
    borderColor: C.line,
    gap: 14,
  },

  heroTop: { flexDirection: "row", alignItems: "center", gap: 14 },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.accentSoft,
  },
  heroLabel: { fontFamily: fontFamilies.sans.semibold, fontSize: 13, color: C.muted },
  heroBalance: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 28,
    letterSpacing: -0.8,
    color: C.text,
    fontVariant: ["tabular-nums"],
  },
  heroSub: { fontFamily: fontFamilies.sans.regular, fontSize: 13.5, lineHeight: 19, color: C.muted },
  countPill: {
    alignItems: "center",
    minWidth: 64,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: C.ink,
  },
  countPillValue: { fontFamily: fontFamilies.sans.bold, fontSize: 18, color: C.cream },
  countPillLabel: { fontFamily: fontFamilies.sans.medium, fontSize: 11.5, color: "rgba(250,248,241,0.6)" },
  heroActions: { flexDirection: "row", gap: 10 },
  primaryPill: {
    flex: 1.4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 50,
    borderRadius: 25,
    backgroundColor: C.ink,
  },
  primaryPillText: { fontFamily: fontFamilies.sans.semibold, fontSize: 14.5, color: C.cream },
  outlinePill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 50,
    borderRadius: 25,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: "rgba(22,23,15,0.14)",
  },
  outlinePillActive: { backgroundColor: "#f3f1e8", borderColor: "transparent" },
  outlinePillText: { fontFamily: fontFamilies.sans.semibold, fontSize: 14.5, color: C.text },

  redeemBox: { gap: 10, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.line },
  redeemTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 15, color: C.text },
  redeemInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 56,
    paddingLeft: 15,
    paddingRight: 6,
    borderRadius: 28,
    backgroundColor: "#f5f3ec",
  },
  redeemInput: {
    flex: 1,
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 15,
    letterSpacing: 1.2,
    color: C.text,
    padding: 0,
    ...(Platform.OS === "android" ? { paddingVertical: 0 } : null),
  },
  redeemSubmitBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.ink,
  },

  sectionRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 2 },
  sectionTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 19, letterSpacing: -0.4, color: C.text },
  sectionSub: { fontFamily: fontFamilies.sans.regular, fontSize: 13, color: C.muted, marginTop: 1 },
  customChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
  },
  customChipText: { fontFamily: fontFamilies.sans.semibold, fontSize: 13.5, color: C.text },

  presetsScroll: { marginHorizontal: -20, marginTop: 12 },
  presetsRow: { paddingHorizontal: 20, paddingBottom: 14, gap: 12 },
  presetShadow: { borderRadius: 24, backgroundColor: C.card, ...SHADOW },
  presetTile: {
    width: 148,
    height: 168,
    borderRadius: 24,
    borderCurve: "continuous",
    padding: 16,
    justifyContent: "space-between",
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
  },
  presetTileDark: { backgroundColor: C.ink, borderColor: C.ink },
  presetIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.accentSoft,
  },
  presetIconDark: { backgroundColor: C.lime },
  presetCurrency: { fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: C.muted },
  presetAmount: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 26,
    letterSpacing: -0.8,
    color: C.text,
    fontVariant: ["tabular-nums"],
  },
  presetFoot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  presetSub: { fontFamily: fontFamilies.sans.semibold, fontSize: 13, color: C.muted },
  presetSoftDark: { color: "rgba(250,248,241,0.6)" },
  presetInkDark: { color: C.cream },

  listCountPill: {
    minWidth: 26,
    height: 26,
    paddingHorizontal: 8,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.accentSoft,
  },
  listCount: { fontFamily: fontFamilies.sans.semibold, fontSize: 12.5, color: C.muted },

  loadingWrap: { alignItems: "center", gap: 10, paddingVertical: 32 },
  loadingText: { fontFamily: fontFamilies.sans.medium, fontSize: 14, color: C.muted },

  standardRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  rowDivider: { borderTopWidth: 1, borderTopColor: C.line },
  standardIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.accentSoft,
  },
  standardTitle: { fontFamily: fontFamilies.sans.semibold, fontSize: 14.5, color: C.text },
  standardDesc: { fontFamily: fontFamilies.sans.regular, fontSize: 12.5, lineHeight: 17, color: C.muted },

  voucherTop: { flexDirection: "row", alignItems: "center", gap: 14 },
  voucherBalance: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 22,
    letterSpacing: -0.6,
    color: C.text,
    fontVariant: ["tabular-nums"],
  },
  statusPill: {
    height: 28,
    paddingHorizontal: 12,
    borderRadius: 14,
    justifyContent: "center",
    backgroundColor: C.accentSoft,
  },
  statusPillText: { fontFamily: fontFamilies.sans.semibold, fontSize: 12.5, color: C.accent },
  statusVoided: { backgroundColor: "rgba(184,92,58,0.1)" },
  statusVoidedText: { color: C.rust },
  balanceTrack: { height: 8, borderRadius: 4, backgroundColor: "#f1efe6", overflow: "hidden" },
  balanceFill: { height: 8, borderRadius: 4, backgroundColor: C.ink },
  voucherInitial: { fontFamily: fontFamilies.sans.regular, fontSize: 12.5, color: C.muted, marginTop: 6 },
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#f5f3ec",
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "rgba(22,23,15,0.16)",
  },
  codeLabel: { fontFamily: fontFamilies.sans.medium, fontSize: 12, color: C.muted },
  codeValue: { fontFamily: fontFamilies.mono.semibold, fontSize: 15, letterSpacing: 1.2, color: C.text, marginTop: 1 },
  codeCopyBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.ink,
  },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  metaText: { flex: 1, fontFamily: fontFamilies.sans.regular, fontSize: 13.5, color: C.muted },
  metaStrong: { fontFamily: fontFamilies.sans.semibold, color: C.text },
  voucherMessage: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13.5,
    lineHeight: 19,
    color: "#3d3d36",
    padding: 12,
    borderRadius: 16,
    backgroundColor: C.accentSoft,
    overflow: "hidden",
  },
  voucherFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  footerText: { fontFamily: fontFamilies.sans.medium, fontSize: 12.5, color: C.muted },
});
