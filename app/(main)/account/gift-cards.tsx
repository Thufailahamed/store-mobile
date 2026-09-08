import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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

export default function AccountGiftCards() {
  const router = useRouter();
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
      toast("Voucher code copied to clipboard", "success");
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

  return (
    <PaperBackground>
      <SafeAreaView style={styles.container} edges={["top"]}>
        {/* Atelier Top Navigation Bar */}
        <View style={styles.navBar}>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={20} color={colors.light.foreground} />
          </TouchableOpacity>

          <View style={styles.navTitleWrap}>
            <Text style={styles.navTitle}>GIFT VOUCHERS</Text>
            <Text style={styles.navSubtitle}>BESPOKE DIGITAL CARDS</Text>
          </View>

          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => q.refetch()}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name="refresh-outline"
              size={18}
              color={q.isFetching ? "#C8A44A" : colors.light.foreground}
            />
          </TouchableOpacity>
        </View>

        <FlatList
          data={cards}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={q.isFetching}
              onRefresh={() => q.refetch()}
              tintColor="#C8A44A"
            />
          }
          ListHeaderComponent={
            <View style={styles.headerSection}>
              {/* 1. Haute Couture Obsidian Hero Card */}
              <LinearGradient
                colors={["#1c2016", "#14170e", "#0e110a"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.heroCard}
              >
                <View style={styles.heroTopRow}>
                  <View style={styles.heroTagBadge}>
                    <Ionicons name="sparkles" size={11} color="#C8A44A" />
                    <Text style={styles.heroTagText}>HAUTE COUTURE GIFTING</Text>
                  </View>

                  <View style={styles.giftMedallion}>
                    <Ionicons name="gift" size={20} color="#E8CF8F" />
                  </View>
                </View>

                {/* Total Balance */}
                <View style={styles.balanceBlock}>
                  <Text style={styles.balanceNumber}>
                    {formatPrice(totalBalance, currency)}
                  </Text>
                  <Text style={styles.balanceLabel}>
                    ACTIVE GIFT VOUCHER BALANCE
                  </Text>
                </View>

                {/* Quick Action Buttons */}
                <View style={styles.heroActionsRow}>
                  <TouchableOpacity
                    style={styles.heroBuyBtn}
                    activeOpacity={0.88}
                    onPress={() => router.push("/(main)/gift-cards" as any)}
                  >
                    <Ionicons name="add-circle-outline" size={15} color="#181b12" />
                    <Text style={styles.heroBuyBtnText}>SEND A GIFT VOUCHER</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.heroRedeemBtn}
                    activeOpacity={0.8}
                    onPress={() => setShowRedeemInput((prev) => !prev)}
                  >
                    <Ionicons name="ticket-outline" size={14} color="#E8CF8F" />
                    <Text style={styles.heroRedeemBtnText}>REDEEM CODE</Text>
                  </TouchableOpacity>
                </View>
              </LinearGradient>

              {/* 2. Collapsible Quick Redeem Card */}
              {showRedeemInput && (
                <View style={styles.redeemCard}>
                  <View style={styles.redeemHeader}>
                    <Ionicons name="gift-outline" size={15} color="#85651b" />
                    <Text style={styles.redeemTitle}>Redeem a Gift Voucher</Text>
                  </View>
                  <Text style={styles.redeemSub}>
                    Enter your 16-character alphanumeric voucher code to add it to your collection.
                  </Text>

                  <View style={styles.redeemInputRow}>
                    <TextInput
                      value={redeemCode}
                      onChangeText={(v) => setRedeemCode(v.toUpperCase())}
                      placeholder="XXXX-XXXX-XXXX-XXXX"
                      placeholderTextColor={colors.light.mutedForeground}
                      style={styles.redeemInput}
                      autoCapitalize="characters"
                      returnKeyType="done"
                    />
                    <TouchableOpacity
                      style={styles.redeemSubmitBtn}
                      onPress={handleQuickCheck}
                      disabled={redeemLoading}
                      activeOpacity={0.85}
                    >
                      {redeemLoading ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <Text style={styles.redeemSubmitBtnText}>APPLY</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* 3. Preset Gifting Rail */}
              <View style={styles.presetsSection}>
                <View style={styles.presetsHeader}>
                  <View>
                    <Text style={styles.presetsEyebrow}>CURATED DENOMINATIONS</Text>
                    <Text style={styles.presetsTitle}>Send a Bespoke Voucher</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => router.push("/(main)/gift-cards" as any)}
                  >
                    <Text style={styles.presetsViewAll}>Custom Amount →</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.presetsGrid}>
                  {PRESET_AMOUNTS.map((amt) => (
                    <TouchableOpacity
                      key={amt}
                      style={styles.presetTile}
                      activeOpacity={0.8}
                      onPress={() => router.push("/(main)/gift-cards" as any)}
                    >
                      <Ionicons name="gift-outline" size={13} color="#85651b" />
                      <Text style={styles.presetAmountText}>
                        {formatPrice(amt, "LKR")}
                      </Text>
                      <Text style={styles.presetSubText}>Instant Delivery</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Header label for cards list */}
              {cards.length > 0 && (
                <View style={styles.cardsListHeader}>
                  <Text style={styles.cardsListEyebrow}>YOUR VOUCHERS</Text>
                  <Text style={styles.cardsListCount}>
                    {cards.length} {cards.length === 1 ? "voucher" : "vouchers"}
                  </Text>
                </View>
              )}
            </View>
          }
          ListEmptyComponent={
            q.isLoading ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator color="#C8A44A" size="small" />
                <Text style={styles.loadingText}>Loading gift vouchers…</Text>
              </View>
            ) : (
              <View style={styles.emptyWrap}>
                {/* Empty Medallion */}
                <View style={styles.emptyCard}>
                  <View style={styles.emptyMedallion}>
                    <Ionicons name="gift" size={30} color="#C8A44A" />
                  </View>
                  <Text style={styles.emptyTitle}>No Active Gift Cards</Text>
                  <Text style={styles.emptySubtitle}>
                    You do not have any stored gift vouchers. Send a luxury digital voucher to someone special, or redeem a code to shop across any atelier.
                  </Text>

                  <View style={styles.emptyActionsRow}>
                    <TouchableOpacity
                      style={styles.emptyBuyBtn}
                      activeOpacity={0.88}
                      onPress={() => router.push("/(main)/gift-cards" as any)}
                    >
                      <Text style={styles.emptyBuyBtnText}>
                        PURCHASE GIFT VOUCHER
                      </Text>
                      <Ionicons name="arrow-forward" size={13} color="#ffffff" />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.emptyRedeemBtn}
                      activeOpacity={0.8}
                      onPress={() => router.push("/(main)/gift-cards/redeem" as any)}
                    >
                      <Text style={styles.emptyRedeemBtnText}>
                        Redeem Voucher Code
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* The Atelier Gifting Standards (3 Value Cards) */}
                <View style={styles.standardsCard}>
                  <View style={styles.standardsHeader}>
                    <Ionicons name="sparkles" size={13} color="#85651b" />
                    <Text style={styles.standardsEyebrow}>
                      ATELIER GIFTING PRIVILEGES
                    </Text>
                  </View>
                  <Text style={styles.standardsTitle}>
                    The Luxury Gifting Experience
                  </Text>

                  <View style={styles.standardItem}>
                    <View style={styles.standardIconBox}>
                      <Ionicons name="mail-outline" size={15} color="#85651b" />
                    </View>
                    <View style={styles.standardContent}>
                      <Text style={styles.standardHeading}>
                        Instant & Scheduled Delivery
                      </Text>
                      <Text style={styles.standardDesc}>
                        Dispatched directly to the recipient&apos;s email with your personalized message and selected delivery date.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.standardItem}>
                    <View style={styles.standardIconBox}>
                      <Ionicons name="storefront-outline" size={15} color="#85651b" />
                    </View>
                    <View style={styles.standardContent}>
                      <Text style={styles.standardHeading}>
                        Universal Atelier Acceptance
                      </Text>
                      <Text style={styles.standardDesc}>
                        Redeemable seamlessly across all independent boutiques, verified sellers, and luxury lookbooks.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.standardItem}>
                    <View style={styles.standardIconBox}>
                      <Ionicons name="shield-checkmark-outline" size={15} color="#85651b" />
                    </View>
                    <View style={styles.standardContent}>
                      <Text style={styles.standardHeading}>
                        Permanent Balance Protection
                      </Text>
                      <Text style={styles.standardDesc}>
                        Gift card credits never expire and can be spent across multiple separate acquisitions.
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            )
          }
          renderItem={({ item }) => {
            const purchased = item.source === "purchased";
            const isVoided = !!item.voided_at;

            return (
              <View style={styles.voucherCard}>
                {/* Voucher Top Row */}
                <View style={styles.voucherTopRow}>
                  <View style={styles.voucherTypeBadge}>
                    <Ionicons
                      name={purchased ? "arrow-up-circle" : "arrow-down-circle"}
                      size={12}
                      color="#85651b"
                    />
                    <Text style={styles.voucherTypeText}>
                      {purchased ? "GIFT SENT" : "GIFT RECEIVED"}
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
                      {isVoided ? "VOIDED" : "ACTIVE"}
                    </Text>
                  </View>
                </View>

                {/* Balance */}
                <View style={styles.voucherBalanceRow}>
                  <Text style={styles.voucherBalance}>
                    {formatPrice(item.current_balance, item.currency)}
                  </Text>
                  <Text style={styles.voucherInitial}>
                    of {formatPrice(item.initial_balance, item.currency)} initial
                  </Text>
                </View>

                {/* Code Pill with 1-Tap Copy */}
                <View style={styles.codeContainer}>
                  <View style={styles.codeTextCol}>
                    <Text style={styles.codeLabel}>VOUCHER CODE</Text>
                    <Text style={styles.codeValue}>{item.code}</Text>
                  </View>

                  <TouchableOpacity
                    style={styles.copyBtn}
                    activeOpacity={0.7}
                    onPress={() => copyCode(item.code)}
                  >
                    <Ionicons name="copy-outline" size={13} color="#181b12" />
                    <Text style={styles.copyBtnText}>COPY</Text>
                  </TouchableOpacity>
                </View>

                {/* Recipient / Note details */}
                <View style={styles.voucherDetails}>
                  <Text style={styles.recipientText}>
                    {purchased
                      ? `To: ${item.recipient_email || "Recipient"}`
                      : `From: ${item.recipient_name || "Generous Patron"}`}
                  </Text>
                  {item.message ? (
                    <Text style={styles.voucherMessage} numberOfLines={2}>
                      &quot;{item.message}&quot;
                    </Text>
                  ) : null}
                </View>

                {/* Expiry date / Scheduled date */}
                <View style={styles.voucherFooterRow}>
                  {item.scheduled_for && !item.email_sent_at ? (
                    <View style={styles.scheduledPill}>
                      <Ionicons name="time-outline" size={11} color="#85651b" />
                      <Text style={styles.scheduledText}>
                        Scheduled:{" "}
                        {new Date(item.scheduled_for).toLocaleDateString()}
                      </Text>
                    </View>
                  ) : item.expires_at ? (
                    <Text style={styles.expiryText}>
                      Expires {new Date(item.expires_at).toLocaleDateString()}
                    </Text>
                  ) : (
                    <Text style={styles.expiryText}>Lifetime Validity</Text>
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

/* =========================================================================
   Styles
   ========================================================================= */
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
    fontFamily: fontFamilies.display.regular,
    fontSize: 13,
    color: colors.light.mutedForeground,
    fontStyle: "italic",
  },

  /* Navigation Bar */
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: "rgba(22, 23, 15, 0.06)",
  },
  navBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.08)",
    ...shadows.soft,
  },
  navTitleWrap: {
    alignItems: "center",
  },
  navTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 15,
    letterSpacing: 2,
    color: colors.light.foreground,
    textTransform: "uppercase",
  },
  navSubtitle: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9.5,
    color: "#85651b",
    marginTop: 1,
    letterSpacing: 1,
  },

  listContent: {
    paddingBottom: 40,
  },
  headerSection: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
  },

  /* 1. Hero Card */
  heroCard: {
    borderRadius: 20,
    padding: spacing[5],
    marginBottom: spacing[4],
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.35)",
    ...shadows.editorial,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroTagBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(200, 164, 74, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.3)",
  },
  heroTagText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    color: "#E8CF8F",
    letterSpacing: 1,
  },
  giftMedallion: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(200, 164, 74, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  balanceBlock: {
    marginVertical: 14,
  },
  balanceNumber: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 34,
    color: "#E8CF8F",
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  balanceLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9.5,
    color: "rgba(255, 255, 255, 0.7)",
    letterSpacing: 0.8,
    marginTop: 3,
  },
  heroActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  heroBuyBtn: {
    flex: 1.3,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#E8CF8F",
    paddingVertical: 11,
    borderRadius: radii.full,
  },
  heroBuyBtnText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
    color: "#181b12",
    letterSpacing: 0.8,
  },
  heroRedeemBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    paddingVertical: 11,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  heroRedeemBtnText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
    color: "#E8CF8F",
    letterSpacing: 0.8,
  },

  /* 2. Redeem Card */
  redeemCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: spacing[5],
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.08)",
    marginBottom: spacing[4],
    gap: 10,
    ...shadows.soft,
  },
  redeemHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  redeemTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 15.5,
    color: colors.light.foreground,
  },
  redeemSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.light.mutedForeground,
    lineHeight: 17,
  },
  redeemInputRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  redeemInput: {
    flex: 1,
    backgroundColor: "rgba(22, 23, 15, 0.03)",
    borderRadius: radii.xl,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 11 : 7,
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.1)",
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 12.5,
    color: colors.light.foreground,
    letterSpacing: 1,
  },
  redeemSubmitBtn: {
    backgroundColor: "#181b12",
    paddingHorizontal: 18,
    borderRadius: radii.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  redeemSubmitBtnText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 11,
    color: "#ffffff",
    letterSpacing: 1,
  },

  /* 3. Presets Section */
  presetsSection: {
    marginBottom: spacing[4],
  },
  presetsHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  presetsEyebrow: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9.5,
    color: "#85651b",
    letterSpacing: 1.2,
  },
  presetsTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 17,
    color: colors.light.foreground,
    marginTop: 1,
  },
  presetsViewAll: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10.5,
    color: "#85651b",
  },
  presetsGrid: {
    flexDirection: "row",
    gap: 8,
  },
  presetTile: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.08)",
    gap: 3,
    ...shadows.soft,
  },
  presetAmountText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 11,
    color: colors.light.foreground,
  },
  presetSubText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 9,
    color: colors.light.mutedForeground,
  },

  /* Cards List Header */
  cardsListHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  cardsListEyebrow: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10,
    color: "#85651b",
    letterSpacing: 1.2,
  },
  cardsListCount: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10.5,
    color: colors.light.mutedForeground,
  },

  /* Empty Wrap */
  emptyWrap: {
    paddingHorizontal: spacing[5],
    gap: 16,
  },
  emptyCard: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: spacing[7],
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.08)",
    ...shadows.soft,
  },
  emptyMedallion: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(200, 164, 74, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.3)",
    marginBottom: 12,
  },
  emptyTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 20,
    color: colors.light.foreground,
    textAlign: "center",
  },
  emptySubtitle: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12.5,
    color: colors.light.mutedForeground,
    textAlign: "center",
    lineHeight: 18,
    marginTop: 6,
    maxWidth: 290,
  },
  emptyActionsRow: {
    width: "100%",
    maxWidth: 290,
    gap: 10,
    marginTop: 18,
  },
  emptyBuyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#181b12",
    paddingVertical: 12,
    borderRadius: radii.full,
    ...shadows.soft,
  },
  emptyBuyBtnText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10.5,
    color: "#ffffff",
    letterSpacing: 1,
  },
  emptyRedeemBtn: {
    alignItems: "center",
    paddingVertical: 6,
  },
  emptyRedeemBtnText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 11,
    color: "#85651b",
    letterSpacing: 0.5,
  },

  /* Standards Card */
  standardsCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: spacing[5],
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.08)",
    ...shadows.soft,
    gap: 14,
  },
  standardsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  standardsEyebrow: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9.5,
    color: "#85651b",
    letterSpacing: 1.2,
  },
  standardsTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 16.5,
    color: colors.light.foreground,
    marginTop: -4,
  },
  standardItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  standardIconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(200, 164, 74, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.25)",
  },
  standardContent: {
    flex: 1,
    gap: 2,
  },
  standardHeading: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: colors.light.foreground,
  },
  standardDesc: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11.5,
    color: colors.light.mutedForeground,
    lineHeight: 16,
  },

  /* Voucher Card (Populated) */
  voucherCard: {
    marginHorizontal: spacing[5],
    marginBottom: spacing[3],
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: spacing[5],
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.08)",
    gap: 10,
    ...shadows.soft,
  },
  voucherTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  voucherTypeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(200, 164, 74, 0.1)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.25)",
  },
  voucherTypeText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 8.5,
    color: "#85651b",
    letterSpacing: 0.6,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  statusActive: {
    backgroundColor: "rgba(22, 101, 52, 0.1)",
    borderColor: "rgba(22, 101, 52, 0.25)",
  },
  statusVoided: {
    backgroundColor: "rgba(220, 38, 38, 0.1)",
    borderColor: "rgba(220, 38, 38, 0.25)",
  },
  statusPillText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 8.5,
    letterSpacing: 0.5,
  },
  statusActiveText: {
    color: "#15803d",
  },
  statusVoidedText: {
    color: "#dc2626",
  },
  voucherBalanceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
  },
  voucherBalance: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 22,
    color: colors.light.foreground,
  },
  voucherInitial: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 10.5,
    color: colors.light.mutedForeground,
  },
  codeContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(22, 23, 15, 0.03)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.06)",
  },
  codeTextCol: {
    gap: 1,
  },
  codeLabel: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 8,
    color: colors.light.mutedForeground,
    letterSpacing: 0.8,
  },
  codeValue: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 13,
    color: colors.light.foreground,
    letterSpacing: 1.5,
  },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.1)",
    ...shadows.soft,
  },
  copyBtnText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9.5,
    color: "#181b12",
    letterSpacing: 0.5,
  },
  voucherDetails: {
    gap: 2,
  },
  recipientText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    color: colors.light.foreground,
  },
  voucherMessage: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11.5,
    color: colors.light.mutedForeground,
    fontStyle: "italic",
    lineHeight: 16,
  },
  voucherFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: "rgba(22, 23, 15, 0.05)",
  },
  scheduledPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  scheduledText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    color: "#85651b",
  },
  expiryText: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 10,
    color: colors.light.mutedForeground,
  },
});
