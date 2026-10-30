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

  const goBuy = (amt?: number) =>
    router.push((amt ? `/(main)/gift-cards?amount=${amt}` : "/(main)/gift-cards") as any);

  const activeCount = cards.filter((c) => c.is_active && !c.voided_at).length;

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
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 40 }]}
          ItemSeparatorComponent={() => <View style={{ height: spacing[4] }} />}
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
                <View style={styles.eyebrowRow}>
                  <View style={styles.eyebrowRule} />
                  <Text style={styles.eyebrow}>Digital gifting</Text>
                </View>
                <Text style={styles.pageTitle}>
                  Gift <Text style={styles.pageTitleAccent}>vouchers.</Text>
                </Text>
              </View>

              {/* Balance — styled as a ribboned gift card */}
              <View style={styles.heroShadow}>
                <LinearGradient
                  colors={["#2c3119", "#181b0f", "#0e1009"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.hero}
                >
                  {/* Ribbon */}
                  <LinearGradient
                    colors={["rgba(232,207,143,0.0)", "rgba(232,207,143,0.22)", "rgba(232,207,143,0.0)"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.ribbonV}
                    pointerEvents="none"
                  />
                  <LinearGradient
                    colors={["rgba(232,207,143,0.0)", "rgba(232,207,143,0.16)", "rgba(232,207,143,0.0)"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={styles.ribbonH}
                    pointerEvents="none"
                  />
                  <LinearGradient
                    colors={["rgba(255,255,255,0.09)", "rgba(255,255,255,0)"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0.6, y: 0.6 }}
                    style={StyleSheet.absoluteFill}
                    pointerEvents="none"
                  />

                  <View style={styles.heroTop}>
                    <View>
                      <Text style={styles.heroWordmark}>LUXE</Text>
                      <Text style={styles.heroEyebrow}>Gift card balance</Text>
                    </View>
                    <LinearGradient
                      colors={[GOLD_SOFT, GOLD, GOLD_DEEP]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.heroBow}
                    >
                      <Ionicons name="gift" size={18} color={colors.olive[950]} />
                    </LinearGradient>
                  </View>

                  <Text style={styles.heroBalance} numberOfLines={1} adjustsFontSizeToFit>
                    {formatPrice(totalBalance, currency)}
                  </Text>
                  <View style={styles.heroMetaRow}>
                    <View style={styles.heroMetaPill}>
                      <View style={[styles.heroMetaDot, activeCount === 0 && { backgroundColor: "rgba(250,248,241,0.35)" }]} />
                      <Text style={styles.heroMetaText}>
                        {activeCount} active {activeCount === 1 ? "voucher" : "vouchers"}
                      </Text>
                    </View>
                    <Text style={styles.heroSub} numberOfLines={1}>
                      {cards.length === 0 ? "Send or redeem one below" : "Usable at checkout"}
                    </Text>
                  </View>

                  <View style={styles.heroActions}>
                    <TouchableOpacity
                      style={styles.heroBuyTouch}
                      activeOpacity={0.9}
                      onPress={() => goBuy()}
                      accessibilityRole="button"
                    >
                      <LinearGradient
                        colors={[GOLD_SOFT, GOLD]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.heroBuyBtn}
                      >
                        <Ionicons name="paper-plane" size={15} color={colors.olive[950]} />
                        <Text style={styles.heroBuyBtnText}>Send a voucher</Text>
                      </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.heroRedeemBtn, showRedeemInput && styles.heroRedeemBtnActive]}
                      activeOpacity={0.8}
                      onPress={() => setShowRedeemInput((prev) => !prev)}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: showRedeemInput }}
                    >
                      <Ionicons name={showRedeemInput ? "close" : "ticket-outline"} size={15} color={GOLD_SOFT} />
                      <Text style={styles.heroRedeemBtnText}>{showRedeemInput ? "Close" : "Redeem"}</Text>
                    </TouchableOpacity>
                  </View>
                </LinearGradient>
              </View>

              {/* Quick redeem */}
              {showRedeemInput && (
                <View style={styles.redeemCard}>
                  <View style={styles.redeemHead}>
                    <LinearGradient colors={[GOLD_SOFT, GOLD]} style={styles.redeemIcon}>
                      <Ionicons name="ticket" size={16} color={colors.olive[950]} />
                    </LinearGradient>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.redeemTitle}>Redeem a voucher</Text>
                      <Text style={styles.redeemSub}>Enter the code printed on your gift voucher.</Text>
                    </View>
                  </View>
                  <View style={styles.redeemInputRow}>
                    <TextInput
                      value={redeemCode}
                      onChangeText={(v) => setRedeemCode(v.toUpperCase())}
                      placeholder="XXXX-XXXX-XXXX-XXXX"
                      placeholderTextColor="rgba(22,23,15,0.3)"
                      style={styles.redeemInput}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      returnKeyType="done"
                      onSubmitEditing={handleQuickCheck}
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
                        <>
                          <Text style={styles.redeemSubmitBtnText}>Apply</Text>
                          <Ionicons name="arrow-forward" size={13} color={GOLD_SOFT} />
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Presets */}
              <View>
                <View style={styles.presetsHeader}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.eyebrowRow}>
                      <View style={styles.eyebrowRule} />
                      <Text style={styles.eyebrow}>Popular amounts</Text>
                    </View>
                    <Text style={styles.presetsTitle}>
                      Send a <Text style={styles.pageTitleAccent}>voucher</Text>
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => goBuy()} hitSlop={8} style={styles.presetsLink}>
                    <Ionicons name="create-outline" size={13} color={GOLD_DEEP} />
                    <Text style={styles.presetsLinkText}>Custom</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.presetsRow}
                  style={styles.presetsScroll}
                >
                  {PRESET_AMOUNTS.map((amt, i) => {
                    const finish = PRESET_FINISH[i % PRESET_FINISH.length];
                    return (
                      <TouchableOpacity
                        key={amt}
                        style={styles.presetShadow}
                        activeOpacity={0.88}
                        onPress={() => goBuy(amt)}
                        accessibilityRole="button"
                        accessibilityLabel={`Send a ${formatPrice(amt, "LKR")} voucher`}
                      >
                        <LinearGradient
                          colors={finish.bg}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.presetTile}
                        >
                          <View style={[styles.presetRibbon, { backgroundColor: finish.ribbon }]} />
                          <View style={styles.presetTop}>
                            <Text style={[styles.presetBrand, { color: finish.soft }]}>LUXE</Text>
                            <Ionicons name="gift" size={14} color={finish.ribbonIcon} />
                          </View>
                          <View>
                            <Text style={[styles.presetCurrency, { color: finish.soft }]}>LKR</Text>
                            <Text style={[styles.presetAmount, { color: finish.ink }]}>
                              {amt.toLocaleString()}
                            </Text>
                          </View>
                          <View style={styles.presetFoot}>
                            <Text style={[styles.presetSub, { color: finish.soft }]}>Instant delivery</Text>
                            <Ionicons name="arrow-forward" size={13} color={finish.ink} />
                          </View>
                        </LinearGradient>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* List heading */}
              {cards.length > 0 && (
                <View style={styles.listHeader}>
                  <View>
                    <View style={styles.eyebrowRow}>
                      <View style={styles.eyebrowRule} />
                      <Text style={styles.eyebrow}>Your wallet</Text>
                    </View>
                    <Text style={styles.presetsTitle}>
                      Your <Text style={styles.pageTitleAccent}>vouchers</Text>
                    </Text>
                  </View>
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
                <ActivityIndicator color={GOLD} size="small" />
                <Text style={styles.loadingText}>Loading gift vouchers…</Text>
              </View>
            ) : (
              <View style={styles.emptyWrap}>
                <LinearGradient
                  colors={[colors.paper.cream, colors.paper.warm]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={styles.emptyCard}
                >
                  <View style={styles.emptyHaloOuter}>
                    <View style={styles.emptyHalo}>
                      <LinearGradient colors={[colors.olive[800], colors.olive[950]]} style={styles.emptyIcon}>
                        <Ionicons name="gift-outline" size={22} color={GOLD} />
                      </LinearGradient>
                    </View>
                  </View>
                  <Text style={styles.emptyEyebrow}>YOUR WALLET IS EMPTY</Text>
                  <Text style={styles.emptyTitle}>No vouchers yet</Text>
                  <Text style={styles.emptySub}>
                    Send a digital voucher to someone special, or redeem a code to use across the boutique.
                  </Text>
                  <TouchableOpacity
                    style={styles.primaryBtnShadow}
                    activeOpacity={0.9}
                    onPress={() => goBuy()}
                    accessibilityRole="button"
                  >
                    <LinearGradient
                      colors={[colors.olive[800], colors.olive[950]]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.primaryBtn}
                    >
                      <Text style={styles.primaryBtnText}>Purchase gift voucher</Text>
                      <LinearGradient colors={[GOLD_SOFT, GOLD]} style={styles.primaryBtnArrow}>
                        <Ionicons name="arrow-forward" size={15} color={colors.olive[950]} />
                      </LinearGradient>
                    </LinearGradient>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.textLink}
                    activeOpacity={0.7}
                    onPress={() => router.push("/(main)/gift-cards/redeem" as any)}
                    hitSlop={8}
                  >
                    <Ionicons name="ticket-outline" size={14} color={GOLD_DEEP} />
                    <Text style={styles.textLinkText}>Redeem a voucher code</Text>
                  </TouchableOpacity>
                </LinearGradient>

                {/* Standards */}
                <View style={styles.standardsCard}>
                  <View style={styles.eyebrowRow}>
                    <View style={styles.eyebrowRule} />
                    <Text style={styles.eyebrow}>Good to know</Text>
                  </View>
                  <Text style={styles.presetsTitle}>
                    The art of <Text style={styles.pageTitleAccent}>gifting</Text>
                  </Text>
                  <View style={styles.standardList}>
                    {STANDARDS.map((s) => (
                      <View key={s.title} style={styles.standardTile}>
                        <LinearGradient
                          colors={[GOLD_SOFT, GOLD]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.standardIcon}
                        >
                          <Ionicons name={s.icon} size={16} color={colors.olive[950]} />
                        </LinearGradient>
                        <View style={styles.standardBody}>
                          <Text style={styles.standardTitle}>{s.title}</Text>
                          <Text style={styles.standardDesc}>{s.desc}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            )
          }
          renderItem={({ item }) => {
            const purchased = item.source === "purchased";
            const isVoided = !!item.voided_at;
            const remainingPct =
              item.initial_balance > 0
                ? Math.max(0, Math.min(100, (item.current_balance / item.initial_balance) * 100))
                : 0;

            return (
              <View style={[styles.voucher, isVoided && { opacity: 0.7 }]}>
                {/* Stub — balance */}
                <LinearGradient
                  colors={isVoided ? ["#6b6b60", "#45453d"] : ["#2c3119", "#14170e"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.voucherStub}
                >
                  <LinearGradient
                    colors={["rgba(232,207,143,0)", "rgba(232,207,143,0.18)", "rgba(232,207,143,0)"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.stubRibbon}
                    pointerEvents="none"
                  />
                  <View style={styles.voucherTop}>
                    <View style={styles.typeBadge}>
                      <Ionicons name={purchased ? "arrow-up" : "arrow-down"} size={10} color={GOLD_SOFT} />
                      <Text style={styles.typeText}>{purchased ? "Sent" : "Received"}</Text>
                    </View>
                    <View style={[styles.statusPill, isVoided ? styles.statusVoided : styles.statusActive]}>
                      <View style={[styles.statusDot, { backgroundColor: isVoided ? "#f3b8a4" : "#8fd19e" }]} />
                      <Text style={styles.statusPillText}>{isVoided ? "Voided" : "Active"}</Text>
                    </View>
                  </View>

                  <Text style={styles.voucherBalance}>{formatPrice(item.current_balance, item.currency)}</Text>
                  <Text style={styles.voucherInitial}>
                    remaining of {formatPrice(item.initial_balance, item.currency)}
                  </Text>
                  <View style={styles.balanceTrack}>
                    <LinearGradient
                      colors={[GOLD_SOFT, GOLD]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.balanceFill, { width: `${Math.max(remainingPct, 2)}%` }]}
                    />
                  </View>
                </LinearGradient>

                {/* Perforation */}
                <View style={styles.perforation}>
                  <View style={[styles.notch, styles.notchLeft]} />
                  <View style={styles.perfLine} />
                  <View style={[styles.notch, styles.notchRight]} />
                </View>

                {/* Body */}
                <View style={styles.voucherBody}>
                  <TouchableOpacity
                    style={styles.codeRow}
                    activeOpacity={0.7}
                    onPress={() => copyCode(item.code)}
                    accessibilityRole="button"
                    accessibilityLabel="Copy voucher code"
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.codeLabel}>VOUCHER CODE</Text>
                      <Text style={styles.codeValue} numberOfLines={1}>{item.code}</Text>
                    </View>
                    <View style={styles.codeCopyBtn}>
                      <Ionicons name="copy-outline" size={13} color={colors.paper.cream} />
                      <Text style={styles.codeCopyText}>Copy</Text>
                    </View>
                  </TouchableOpacity>

                  <View style={styles.recipientRow}>
                    <View style={styles.recipientAvatar}>
                      <Ionicons name={purchased ? "person-outline" : "heart-outline"} size={14} color={GOLD_DEEP} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.recipientLabel}>{purchased ? "TO" : "FROM"}</Text>
                      <Text style={styles.recipientText} numberOfLines={1}>
                        {purchased
                          ? item.recipient_email || "Recipient"
                          : item.recipient_name || "A generous friend"}
                      </Text>
                    </View>
                  </View>

                  {item.message ? (
                    <View style={styles.messageBox}>
                      <Text style={styles.messageQuote}>“</Text>
                      <Text style={styles.voucherMessage} numberOfLines={3}>{item.message}</Text>
                    </View>
                  ) : null}

                  <View style={styles.voucherFooter}>
                    {item.scheduled_for && !item.email_sent_at ? (
                      <View style={[styles.footerMeta, styles.footerMetaGold]}>
                        <Ionicons name="time-outline" size={12} color={GOLD_DEEP} />
                        <Text style={[styles.footerText, { color: GOLD_DEEP }]}>
                          Scheduled {formatDate(item.scheduled_for)}
                        </Text>
                      </View>
                    ) : item.expires_at ? (
                      <View style={styles.footerMeta}>
                        <Ionicons name="calendar-outline" size={12} color={colors.light.mutedForeground} />
                        <Text style={styles.footerText}>Expires {formatDate(item.expires_at)}</Text>
                      </View>
                    ) : (
                      <View style={styles.footerMeta}>
                        <Ionicons name="infinite-outline" size={13} color={colors.light.mutedForeground} />
                        <Text style={styles.footerText}>No expiry</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            );
          }}
        />
      </SafeAreaView>
    </PaperBackground>
  );
}

/** Each preset tile gets its own finish so the row reads like a fan of gift cards. */
const PRESET_FINISH: {
  bg: [string, string];
  ink: string;
  soft: string;
  ribbon: string;
  ribbonIcon: string;
}[] = [
  { bg: ["#faf3df", "#ead9a8"], ink: colors.ink.DEFAULT, soft: "rgba(22,23,15,0.55)", ribbon: "rgba(133,101,27,0.18)", ribbonIcon: GOLD_DEEP },
  { bg: ["#2c3119", "#14170e"], ink: colors.paper.cream, soft: "rgba(232,207,143,0.75)", ribbon: "rgba(232,207,143,0.16)", ribbonIcon: GOLD_SOFT },
  { bg: ["#d9b866", "#8a6a1f"], ink: "#1a1406", soft: "rgba(26,20,6,0.6)", ribbon: "rgba(255,255,255,0.22)", ribbonIcon: "#1a1406" },
  { bg: ["#5a3a22", "#1f140b"], ink: "#f6e3cf", soft: "rgba(246,227,207,0.65)", ribbon: "rgba(217,162,115,0.2)", ribbonIcon: "#d9a273" },
];

const GOLD_HAIRLINE = "rgba(200,164,74,0.24)";

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingWrap: { padding: 32, alignItems: "center", gap: 8 },
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
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.paper.cream,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: HAIRLINE,
    ...shadows.soft,
  },
  navTitle: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 18,
    color: colors.light.foreground,
  },

  listContent: { paddingHorizontal: spacing[5], paddingTop: spacing[2] },
  headerSection: { gap: spacing[5], marginBottom: spacing[4] },

  /* Heading */
  pageHead: {},
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  eyebrowRule: { width: 18, height: 1, backgroundColor: GOLD },
  eyebrow: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: GOLD_DEEP,
  },
  pageTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 34,
    letterSpacing: -0.8,
    lineHeight: 40,
    color: colors.light.foreground,
  },
  pageTitleAccent: { fontFamily: fontFamilies.display.italic, color: GOLD_DEEP },

  /* Hero */
  heroShadow: {
    borderRadius: 28,
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.26,
    shadowRadius: 28,
    elevation: 12,
  },
  hero: {
    borderRadius: 28,
    padding: spacing[5],
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(232,207,143,0.14)",
  },
  ribbonV: { position: "absolute", top: 0, bottom: 0, right: 64, width: 30 },
  ribbonH: { position: "absolute", left: 0, right: 0, top: 29, height: 26 },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  heroWordmark: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 18,
    letterSpacing: 6,
    color: colors.paper.cream,
  },
  heroEyebrow: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 9.5,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "rgba(232,207,143,0.85)",
    marginTop: 4,
  },
  heroBow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 37,
    borderWidth: 2,
    borderColor: "#181b0f",
  },
  heroBalance: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 46,
    lineHeight: 54,
    letterSpacing: -1.4,
    color: colors.paper.cream,
    marginTop: spacing[6],
  },
  heroMetaRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 },
  heroMetaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: "rgba(250,248,241,0.08)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(250,248,241,0.18)",
  },
  heroMetaDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#8fd19e" },
  heroMetaText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 11.5,
    color: colors.paper.cream,
  },
  heroSub: {
    flex: 1,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: "rgba(250,248,241,0.55)",
  },
  heroActions: { flexDirection: "row", gap: spacing[2.5], marginTop: spacing[5] },
  heroBuyTouch: {
    flex: 1.4,
    borderRadius: radii.full,
    shadowColor: "#c8a44a",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  heroBuyBtn: {
    height: 52,
    borderRadius: radii.full,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  heroBuyBtnText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 14.5,
    color: colors.olive[950],
  },
  heroRedeemBtn: {
    flex: 1,
    height: 52,
    borderRadius: radii.full,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: "rgba(250,248,241,0.06)",
    borderWidth: 1,
    borderColor: "rgba(232,207,143,0.3)",
  },
  heroRedeemBtnActive: { backgroundColor: "rgba(232,207,143,0.14)" },
  heroRedeemBtnText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14,
    color: GOLD_SOFT,
  },

  /* Redeem */
  redeemCard: {
    backgroundColor: colors.paper.cream,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: GOLD_HAIRLINE,
    padding: spacing[4],
    gap: spacing[4],
    ...shadows.soft,
  },
  redeemHead: { flexDirection: "row", alignItems: "center", gap: spacing[3] },
  redeemIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  redeemTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 18,
    color: colors.light.foreground,
  },
  redeemSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12.5,
    color: colors.light.mutedForeground,
    marginTop: 2,
  },
  redeemInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 5,
    borderRadius: radii.full,
    backgroundColor: colors.light.background,
    borderWidth: 1,
    borderColor: "rgba(200,164,74,0.35)",
    borderStyle: "dashed",
  },
  redeemInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "android" ? 6 : 10,
    fontFamily: fontFamilies.mono.medium,
    fontSize: 14,
    letterSpacing: 1.5,
    color: colors.light.foreground,
  },
  redeemSubmitBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 42,
    paddingHorizontal: 18,
    borderRadius: radii.full,
    backgroundColor: colors.ink.DEFAULT,
    justifyContent: "center",
    minWidth: 92,
  },
  redeemSubmitBtnText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 13.5,
    color: colors.paper.cream,
  },

  /* Presets */
  presetsHeader: { flexDirection: "row", alignItems: "flex-end", marginBottom: spacing[3] },
  presetsTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 24,
    letterSpacing: -0.4,
    color: colors.light.foreground,
    marginTop: 2,
  },
  presetsLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: GOLD_HAIRLINE,
    backgroundColor: colors.paper.cream,
  },
  presetsLinkText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12.5,
    color: GOLD_DEEP,
  },
  presetsScroll: { marginHorizontal: -spacing[5] },
  presetsRow: { paddingHorizontal: spacing[5], gap: spacing[3], paddingVertical: 8 },
  presetShadow: {
    borderRadius: 22,
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 6,
  },
  presetTile: {
    width: 158,
    height: 176,
    borderRadius: 22,
    padding: spacing[4],
    justifyContent: "space-between",
    overflow: "hidden",
  },
  presetRibbon: { position: "absolute", top: 0, bottom: 0, right: 16, width: 10 },
  presetTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingRight: 2 },
  presetBrand: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 12,
    letterSpacing: 4,
  },
  presetCurrency: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 10,
    letterSpacing: 1.6,
  },
  presetAmount: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.6,
  },
  presetFoot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  presetSub: { fontFamily: fontFamilies.sans.medium, fontSize: 11.5 },

  /* List heading */
  listHeader: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  listCountPill: {
    minWidth: 36,
    height: 36,
    paddingHorizontal: 10,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.ink.DEFAULT,
  },
  listCount: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 15,
    color: GOLD_SOFT,
  },

  /* Empty */
  emptyWrap: { gap: spacing[4] },
  emptyCard: {
    alignItems: "center",
    paddingVertical: spacing[8],
    paddingHorizontal: spacing[6],
    borderRadius: 28,
    borderWidth: 1,
    borderColor: GOLD_HAIRLINE,
  },
  emptyHaloOuter: {
    width: 108,
    height: 108,
    borderRadius: 54,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(200,164,74,0.16)",
  },
  emptyHalo: {
    width: 82,
    height: 82,
    borderRadius: 41,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(200,164,74,0.08)",
    borderWidth: 1,
    borderColor: "rgba(200,164,74,0.28)",
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyEyebrow: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 10,
    letterSpacing: 2,
    color: GOLD,
    marginTop: spacing[5],
  },
  emptyTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 24,
    letterSpacing: -0.3,
    color: colors.light.foreground,
    marginTop: spacing[2],
  },
  emptySub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 14,
    lineHeight: 21,
    color: colors.light.mutedForeground,
    textAlign: "center",
    marginTop: spacing[2],
    maxWidth: 290,
  },
  primaryBtnShadow: {
    marginTop: spacing[5],
    borderRadius: radii.full,
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 6,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    height: 54,
    paddingLeft: 24,
    paddingRight: 6,
    borderRadius: radii.full,
  },
  primaryBtnText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 15,
    color: colors.paper.cream,
  },
  primaryBtnArrow: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  textLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: spacing[4],
  },
  textLinkText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13.5,
    color: GOLD_DEEP,
    textDecorationLine: "underline",
  },

  /* Standards */
  standardsCard: {
    padding: spacing[5],
    borderRadius: 28,
    backgroundColor: colors.paper.cream,
    borderWidth: 1,
    borderColor: GOLD_HAIRLINE,
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 3,
  },
  standardList: { marginTop: spacing[4], gap: spacing[2.5] },
  standardTile: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing[3],
    padding: spacing[3.5],
    borderRadius: 18,
    backgroundColor: colors.light.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(22,23,15,0.08)",
  },
  standardIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  standardBody: { flex: 1, gap: 3 },
  standardTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14,
    color: colors.light.foreground,
  },
  standardDesc: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.light.mutedForeground,
  },

  /* Voucher ticket */
  voucher: {
    borderRadius: 26,
    backgroundColor: colors.paper.cream,
    borderWidth: 1,
    borderColor: GOLD_HAIRLINE,
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 22,
    elevation: 5,
  },
  voucherStub: {
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    padding: spacing[5],
    paddingBottom: spacing[5],
    overflow: "hidden",
  },
  stubRibbon: { position: "absolute", top: 0, bottom: 0, right: 48, width: 24 },
  voucherTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: "rgba(232,207,143,0.14)",
  },
  typeText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: GOLD_SOFT,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  statusActive: { backgroundColor: "rgba(143,209,158,0.14)" },
  statusVoided: { backgroundColor: "rgba(243,184,164,0.16)" },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusPillText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 11,
    color: colors.paper.cream,
  },
  voucherBalance: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -0.8,
    color: colors.paper.cream,
    marginTop: spacing[4],
  },
  voucherInitial: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: "rgba(250,248,241,0.6)",
  },
  balanceTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(250,248,241,0.14)",
    marginTop: spacing[3],
    overflow: "hidden",
  },
  balanceFill: { height: "100%", borderRadius: 2 },

  perforation: { height: 22, justifyContent: "center" },
  perfLine: {
    marginHorizontal: 18,
    borderTopWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "rgba(22,23,15,0.14)",
  },
  notch: {
    position: "absolute",
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.light.background,
    borderWidth: 1,
    borderColor: GOLD_HAIRLINE,
  },
  notchLeft: { left: -12 },
  notchRight: { right: -12 },

  voucherBody: { paddingHorizontal: spacing[5], paddingBottom: spacing[4], gap: spacing[3] },
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    padding: spacing[3],
    paddingLeft: spacing[4],
    borderRadius: 16,
    backgroundColor: colors.light.background,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(200,164,74,0.4)",
  },
  codeLabel: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 8.5,
    letterSpacing: 1.6,
    color: colors.light.mutedForeground,
  },
  codeValue: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 14,
    letterSpacing: 1.6,
    color: colors.light.foreground,
    marginTop: 2,
  },
  codeCopyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: radii.full,
    backgroundColor: colors.ink.DEFAULT,
  },
  codeCopyText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    color: colors.paper.cream,
  },
  recipientRow: { flexDirection: "row", alignItems: "center", gap: spacing[3] },
  recipientAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(200,164,74,0.12)",
    borderWidth: 1,
    borderColor: "rgba(200,164,74,0.3)",
  },
  recipientLabel: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 8.5,
    letterSpacing: 1.6,
    color: colors.light.mutedForeground,
  },
  recipientText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13.5,
    color: colors.light.foreground,
    marginTop: 1,
  },
  messageBox: {
    flexDirection: "row",
    gap: 6,
    padding: spacing[3],
    borderRadius: 14,
    backgroundColor: "rgba(200,164,74,0.07)",
  },
  messageQuote: {
    fontFamily: fontFamilies.display.italic,
    fontSize: 30,
    lineHeight: 30,
    color: GOLD,
  },
  voucherMessage: {
    flex: 1,
    fontFamily: fontFamilies.display.italic,
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink.soft,
    paddingTop: 2,
  },
  voucherFooter: {
    flexDirection: "row",
    paddingTop: spacing[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.light.border,
  },
  footerMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
    backgroundColor: colors.paper.warm,
  },
  footerMetaGold: { backgroundColor: "rgba(200,164,74,0.12)" },
  footerText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 11.5,
    color: colors.light.mutedForeground,
  },
});
