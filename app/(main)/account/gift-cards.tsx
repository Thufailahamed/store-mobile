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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@/components/ui/Icon";
import { PaperBackground } from "@/components/layout";
import { useToast } from "@/components/ui";
import { useQuery } from "@tanstack/react-query";
import { getMyGiftCards, checkGiftCardByCode } from "@/lib/api";
import { colors, radii, shadows, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { formatPrice } from "@/lib/utils";

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

const GOLD = colors.accent2.ochre;
const GOLD_DEEP = "#85651b";
const GOLD_SOFT = "#E8CF8F";
const HAIRLINE = "rgba(22, 23, 15, 0.08)";

const STANDARDS: { icon: keyof typeof Ionicons.glyphMap; title: string; desc: string }[] = [
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
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

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
            "success"
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

  const goBuy = () => router.push("/(main)/gift-cards" as any);

  return (
    <PaperBackground>
      <SafeAreaView style={styles.container} edges={["top"]}>
        {/* Navigation */}
        <View style={styles.navBar}>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={20} color={colors.light.foreground} />
          </TouchableOpacity>

          <Text style={styles.navTitle}>Gift vouchers</Text>

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
              <ActivityIndicator size="small" color={GOLD} />
            ) : (
              <Ionicons name="refresh-outline" size={18} color={colors.light.foreground} />
            )}
          </TouchableOpacity>
        </View>

        <FlatList
          data={cards}
          keyExtractor={(c) => c.id}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 40 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={q.isFetching && !q.isLoading}
              onRefresh={() => q.refetch()}
              tintColor={GOLD}
            />
          }
          ListHeaderComponent={
            <View style={styles.headerSection}>
              {/* Heading */}
              <View style={styles.pageHead}>
                <Text style={styles.eyebrow}>Digital gifting</Text>
                <Text style={styles.pageTitle}>
                  Gift <Text style={styles.pageTitleAccent}>vouchers.</Text>
                </Text>
              </View>

              {/* Balance card */}
              <LinearGradient
                colors={["#1f2418", "#14170e"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.hero}
              >
                <View style={styles.heroTop}>
                  <Text style={styles.heroEyebrow}>Available balance</Text>
                  <View style={styles.heroGiftIcon}>
                    <Ionicons name="gift-outline" size={16} color={GOLD_SOFT} />
                  </View>
                </View>

                <Text style={styles.heroBalance}>
                  {formatPrice(totalBalance, currency)}
                </Text>
                <Text style={styles.heroSub}>
                  {cards.length === 0
                    ? "No vouchers yet — send one below."
                    : "Across all active vouchers"}
                </Text>

                <View style={styles.heroActions}>
                  <TouchableOpacity
                    style={styles.heroBuyBtn}
                    activeOpacity={0.88}
                    onPress={goBuy}
                    accessibilityRole="button"
                  >
                    <Ionicons name="add" size={16} color={colors.olive[900]} />
                    <Text style={styles.heroBuyBtnText}>Send a voucher</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.heroRedeemBtn}
                    activeOpacity={0.8}
                    onPress={() => setShowRedeemInput((prev) => !prev)}
                    accessibilityRole="button"
                  >
                    <Ionicons name="ticket-outline" size={14} color={GOLD_SOFT} />
                    <Text style={styles.heroRedeemBtnText}>Redeem</Text>
                  </TouchableOpacity>
                </View>
              </LinearGradient>

              {/* Quick redeem */}
              {showRedeemInput && (
                <View style={styles.redeemCard}>
                  <Text style={styles.redeemTitle}>Redeem a voucher</Text>
                  <Text style={styles.redeemSub}>
                    Enter the code on your gift voucher to check and apply it.
                  </Text>
                  <View style={styles.redeemInputRow}>
                    <TextInput
                      value={redeemCode}
                      onChangeText={(v) => setRedeemCode(v.toUpperCase())}
                      placeholder="XXXX-XXXX-XXXX-XXXX"
                      placeholderTextColor={colors.light.mutedForeground}
                      style={styles.redeemInput}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      returnKeyType="done"
                    />
                    <TouchableOpacity
                      style={styles.redeemSubmitBtn}
                      onPress={handleQuickCheck}
                      disabled={redeemLoading}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                    >
                      {redeemLoading ? (
                        <ActivityIndicator size="small" color={colors.paper.cream} />
                      ) : (
                        <Text style={styles.redeemSubmitBtnText}>Apply</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Presets */}
              <View style={styles.presets}>
                <View style={styles.presetsHeader}>
                  <View>
                    <Text style={styles.eyebrow}>Popular amounts</Text>
                    <Text style={styles.presetsTitle}>Send a voucher</Text>
                  </View>
                  <TouchableOpacity onPress={goBuy} hitSlop={8}>
                    <Text style={styles.presetsLink}>Custom amount</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.presetsRow}
                  style={styles.presetsScroll}
                >
                  {PRESET_AMOUNTS.map((amt) => (
                    <TouchableOpacity
                      key={amt}
                      style={styles.presetTile}
                      activeOpacity={0.8}
                      onPress={goBuy}
                      accessibilityRole="button"
                    >
                      <View style={styles.presetIcon}>
                        <Ionicons name="gift-outline" size={15} color={GOLD_DEEP} />
                      </View>
                      <Text style={styles.presetAmount}>{formatPrice(amt, "LKR")}</Text>
                      <Text style={styles.presetSub}>Instant delivery</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* List heading */}
              {cards.length > 0 && (
                <View style={styles.listHeader}>
                  <Text style={styles.eyebrow}>Your vouchers</Text>
                  <Text style={styles.listCount}>
                    {cards.length} {cards.length === 1 ? "voucher" : "vouchers"}
                  </Text>
                </View>
              )}
            </View>
          }
          ListEmptyComponent={
            q.isLoading ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator color={GOLD} size="small" />
                <Text style={styles.loadingText}>Loading gift vouchers…</Text>
              </View>
            ) : (
              <View style={styles.emptyWrap}>
                <View style={styles.emptyCard}>
                  <View style={styles.emptyIcon}>
                    <Ionicons name="gift-outline" size={26} color={colors.olive[700]} />
                  </View>
                  <Text style={styles.emptyTitle}>No vouchers yet</Text>
                  <Text style={styles.emptySub}>
                    Send a digital voucher to someone special, or redeem a code to use
                    across the boutique.
                  </Text>
                  <TouchableOpacity
                    style={styles.primaryBtn}
                    activeOpacity={0.88}
                    onPress={goBuy}
                    accessibilityRole="button"
                  >
                    <Text style={styles.primaryBtnText}>Purchase gift voucher</Text>
                    <View style={styles.primaryBtnArrow}>
                      <Ionicons name="arrow-forward" size={14} color={colors.olive[900]} />
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.textLink}
                    activeOpacity={0.7}
                    onPress={() => router.push("/(main)/gift-cards/redeem" as any)}
                    hitSlop={8}
                  >
                    <Text style={styles.textLinkText}>Redeem a voucher code</Text>
                  </TouchableOpacity>
                </View>

                {/* Standards */}
                <View style={styles.standardsCard}>
                  <Text style={styles.eyebrow}>Good to know</Text>
                  {STANDARDS.map((s, i) => (
                    <View key={s.title} style={[styles.standardRow, i > 0 && styles.rowDivider]}>
                      <View style={styles.standardIcon}>
                        <Ionicons name={s.icon} size={16} color={GOLD_DEEP} />
                      </View>
                      <View style={styles.standardBody}>
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

            return (
              <View style={styles.voucher}>
                {/* Top row */}
                <View style={styles.voucherTop}>
                  <View style={styles.typeBadge}>
                    <Ionicons
                      name={purchased ? "arrow-up" : "arrow-down"}
                      size={10}
                      color={GOLD_DEEP}
                    />
                    <Text style={styles.typeText}>
                      {purchased ? "Sent" : "Received"}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.statusPill,
                      isVoided ? styles.statusVoided : styles.statusActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        isVoided ? styles.statusVoidedText : styles.statusActiveText,
                      ]}
                    >
                      {isVoided ? "Voided" : "Active"}
                    </Text>
                  </View>
                </View>

                {/* Balance */}
                <View style={styles.voucherBalanceRow}>
                  <Text style={styles.voucherBalance}>
                    {formatPrice(item.current_balance, item.currency)}
                  </Text>
                  <Text style={styles.voucherInitial}>
                    of {formatPrice(item.initial_balance, item.currency)}
                  </Text>
                </View>

                {/* Code */}
                <TouchableOpacity
                  style={styles.codeRow}
                  activeOpacity={0.7}
                  onPress={() => copyCode(item.code)}
                  accessibilityRole="button"
                  accessibilityLabel="Copy voucher code"
                >
                  <Text style={styles.codeValue} numberOfLines={1}>
                    {item.code}
                  </Text>
                  <View style={styles.codeCopyBtn}>
                    <Ionicons name="copy-outline" size={13} color={colors.light.foreground} />
                    <Text style={styles.codeCopyText}>Copy</Text>
                  </View>
                </TouchableOpacity>

                {/* Recipient / message */}
                <View style={styles.voucherDetails}>
                  <Text style={styles.recipientText}>
                    {purchased
                      ? `To ${item.recipient_email || "Recipient"}`
                      : `From ${item.recipient_name || "A generous friend"}`}
                  </Text>
                  {item.message ? (
                    <Text style={styles.voucherMessage} numberOfLines={2}>
                      &quot;{item.message}&quot;
                    </Text>
                  ) : null}
                </View>

                {/* Footer */}
                <View style={styles.voucherFooter}>
                  {item.scheduled_for && !item.email_sent_at ? (
                    <View style={styles.footerMeta}>
                      <Ionicons name="time-outline" size={12} color={GOLD_DEEP} />
                      <Text style={[styles.footerText, { color: GOLD_DEEP }]}>
                        Scheduled {formatDate(item.scheduled_for)}
                      </Text>
                    </View>
                  ) : item.expires_at ? (
                    <View style={styles.footerMeta}>
                      <Ionicons name="calendar-outline" size={12} color={colors.light.mutedForeground} />
                      <Text style={styles.footerText}>
                        Expires {formatDate(item.expires_at)}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.footerMeta}>
                      <Ionicons name="infinite-outline" size={13} color={colors.light.mutedForeground} />
                      <Text style={styles.footerText}>No expiry</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          }}
        />
      </SafeAreaView>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingWrap: {
    padding: 32,
    alignItems: "center",
    gap: 8,
  },
  loadingText: {
    fontFamily: fontFamilies.display.italic,
    fontSize: 13.5,
    color: colors.light.mutedForeground,
  },

  /* Nav */
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[2.5],
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.paper.cream,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: HAIRLINE,
  },
  navTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 15,
    color: colors.light.foreground,
  },

  listContent: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
  },
  headerSection: {
    gap: 14,
    marginBottom: 4,
  },

  /* Heading */
  pageHead: {
    marginBottom: spacing[2],
  },
  eyebrow: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: GOLD_DEEP,
    marginBottom: 4,
  },
  pageTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 32,
    letterSpacing: -0.6,
    lineHeight: 38,
    color: colors.light.foreground,
  },
  pageTitleAccent: {
    fontFamily: fontFamilies.display.italic,
    color: GOLD_DEEP,
  },

  /* Balance hero */
  hero: {
    borderRadius: 24,
    padding: spacing[5],
    gap: 4,
    ...shadows.editorial,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  heroEyebrow: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: "rgba(232, 207, 143, 0.85)",
  },
  heroGiftIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(200, 164, 74, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroBalance: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 40,
    letterSpacing: -1,
    color: colors.paper.cream,
  },
  heroSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12.5,
    color: "rgba(250, 248, 241, 0.6)",
  },
  heroActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: spacing[5],
  },
  heroBuyBtn: {
    flex: 1.4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    height: 48,
    borderRadius: radii.full,
    backgroundColor: GOLD_SOFT,
  },
  heroBuyBtnText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 14,
    color: colors.olive[900],
  },
  heroRedeemBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    height: 48,
    borderRadius: radii.full,
    backgroundColor: "rgba(250, 248, 241, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(250, 248, 241, 0.15)",
  },
  heroRedeemBtnText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14,
    color: GOLD_SOFT,
  },

  /* Redeem */
  redeemCard: {
    backgroundColor: colors.paper.cream,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: HAIRLINE,
    padding: spacing[4],
    gap: 6,
  },
  redeemTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 17,
    color: colors.light.foreground,
  },
  redeemSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12.5,
    lineHeight: 17,
    color: colors.light.mutedForeground,
    marginBottom: 6,
  },
  redeemInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.paper.warm,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: HAIRLINE,
    paddingLeft: 16,
    paddingRight: 4,
    paddingVertical: 4,
  },
  redeemInput: {
    flex: 1,
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 14,
    letterSpacing: 1.2,
    color: colors.light.foreground,
    paddingVertical: Platform.OS === "ios" ? 10 : 6,
  },
  redeemSubmitBtn: {
    height: 38,
    paddingHorizontal: 18,
    borderRadius: radii.full,
    backgroundColor: colors.olive[900],
    alignItems: "center",
    justifyContent: "center",
  },
  redeemSubmitBtnText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 13,
    color: colors.paper.cream,
  },

  /* Presets */
  presets: {
    gap: 12,
  },
  presetsHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  presetsTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 20,
    letterSpacing: -0.3,
    color: colors.light.foreground,
  },
  presetsLink: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: GOLD_DEEP,
    textDecorationLine: "underline",
  },
  presetsScroll: {
    marginHorizontal: -spacing[5],
  },
  presetsRow: {
    paddingHorizontal: spacing[5],
    gap: 10,
  },
  presetTile: {
    width: 122,
    backgroundColor: colors.paper.cream,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: HAIRLINE,
    padding: 14,
    gap: 3,
  },
  presetIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(200, 164, 74, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  presetAmount: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 16,
    color: colors.light.foreground,
  },
  presetSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 10.5,
    color: colors.light.mutedForeground,
  },

  /* List heading */
  listHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginTop: 4,
  },
  listCount: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.light.mutedForeground,
  },

  /* Empty */
  emptyWrap: {
    gap: 14,
  },
  emptyCard: {
    alignItems: "center",
    backgroundColor: colors.paper.cream,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: HAIRLINE,
    paddingVertical: spacing[8],
    paddingHorizontal: spacing[6],
  },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.paper.warm,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing[4],
  },
  emptyTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 22,
    letterSpacing: -0.3,
    color: colors.light.foreground,
    textAlign: "center",
  },
  emptySub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.light.mutedForeground,
    textAlign: "center",
    marginTop: 6,
    maxWidth: 280,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    height: 50,
    paddingLeft: 22,
    paddingRight: 6,
    borderRadius: radii.full,
    backgroundColor: colors.olive[900],
    marginTop: spacing[5],
  },
  primaryBtnText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 14,
    color: colors.paper.cream,
  },
  primaryBtnArrow: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.paper.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  textLink: {
    marginTop: spacing[3],
    paddingVertical: 4,
  },
  textLinkText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: colors.light.foreground,
    textDecorationLine: "underline",
  },

  /* Standards */
  standardsCard: {
    backgroundColor: colors.paper.cream,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: HAIRLINE,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    paddingBottom: spacing[2],
  },
  standardRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing[3],
    paddingVertical: spacing[3.5],
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.light.border,
  },
  standardIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(200, 164, 74, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  standardBody: {
    flex: 1,
    gap: 3,
  },
  standardTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13.5,
    color: colors.light.foreground,
  },
  standardDesc: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.light.mutedForeground,
  },

  /* Voucher card */
  voucher: {
    backgroundColor: colors.paper.cream,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: HAIRLINE,
    padding: spacing[4],
    marginTop: 12,
    gap: spacing[3],
    ...shadows.soft,
  },
  voucherTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: "rgba(200, 164, 74, 0.12)",
  },
  typeText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 11.5,
    color: GOLD_DEEP,
  },
  statusPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  statusActive: {
    backgroundColor: "rgba(21, 128, 61, 0.1)",
  },
  statusVoided: {
    backgroundColor: "rgba(184, 92, 58, 0.1)",
  },
  statusPillText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 11,
  },
  statusActiveText: {
    color: "#15803d",
  },
  statusVoidedText: {
    color: colors.accent2.rust,
  },
  voucherBalanceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  voucherBalance: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 26,
    letterSpacing: -0.4,
    color: colors.light.foreground,
  },
  voucherInitial: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.light.mutedForeground,
  },
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    backgroundColor: colors.paper.warm,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: HAIRLINE,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 6,
  },
  codeValue: {
    flex: 1,
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 14,
    letterSpacing: 1.2,
    color: colors.light.foreground,
  },
  codeCopyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: colors.paper.cream,
    borderWidth: 1,
    borderColor: HAIRLINE,
  },
  codeCopyText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    color: colors.light.foreground,
  },
  voucherDetails: {
    gap: 4,
  },
  recipientText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12.5,
    color: colors.light.foreground,
  },
  voucherMessage: {
    fontFamily: fontFamilies.display.italic,
    fontSize: 13,
    lineHeight: 18,
    color: colors.light.mutedForeground,
  },
  voucherFooter: {
    paddingTop: spacing[2.5],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.light.border,
  },
  footerMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  footerText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11.5,
    color: colors.light.mutedForeground,
  },
});
