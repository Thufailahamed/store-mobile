import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@/components/ui/Icon";
import { PaperBackground } from "@/components/layout";
import { useToast } from "@/components/ui";
import { getReferralInfo, applyReferralCode } from "@/lib/api";
import { isValidReferralCode } from "@/lib/api/backend";
import { colors, radii, shadows, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

const REWARD_POINTS = 100;
const GOLD = colors.accent2.ochre;
const GOLD_DEEP = "#85651b";
const HAIRLINE = "rgba(22, 23, 15, 0.08)";

const STEPS: { icon: keyof typeof Ionicons.glyphMap; title: string; desc: string }[] = [
  {
    icon: "share-social-outline",
    title: "Share your invite",
    desc: "Send your code or link to friends via WhatsApp, Messages, or socials.",
  },
  {
    icon: "bag-check-outline",
    title: "They place an order",
    desc: "Your friend makes their first purchase using your invitation.",
  },
  {
    icon: "trophy-outline",
    title: "You earn points",
    desc: `You receive ${REWARD_POINTS} loyalty points towards your tier standing.`,
  },
];

export default function ReferralsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [applyCode, setApplyCode] = useState("");
  const [applying, setApplying] = useState(false);
  const [copied, setCopied] = useState(false);

  const q = useQuery({
    queryKey: ["referral-info"],
    queryFn: async () => {
      const r = await getReferralInfo();
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
  });

  const code = q.data?.code ?? "";
  const shareUrl =
    q.data?.shareUrl ?? (code ? `https://synapstore.shop/r/${code}` : "");
  const invitesSent =
    q.data?.invites_sent ?? q.data?.totalReferrals ?? q.data?.uses ?? 0;
  const invitesCompleted = q.data?.invites_completed ?? 0;
  const pending =
    q.data?.pendingRewards ?? Math.max(0, invitesSent - invitesCompleted);
  const pointsEarned = q.data?.points_earned ?? 0;
  const referrals = q.data?.referrals ?? [];

  const handleCopy = async () => {
    if (!code) return;
    try {
      await Clipboard.setStringAsync(shareUrl || code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast("Invitation link copied", "success");
    } catch {
      toast("Could not copy link", "error");
    }
  };

  const handleShare = async () => {
    if (!code) return;
    try {
      await Share.share({
        message: `Join the LUXE Atelier with my personal invitation code ${code} — ${shareUrl}\nDiscover luxury designer collections and earn loyalty rewards on your first acquisition!`,
        url: shareUrl,
      });
    } catch {
      /* dismissed */
    }
  };

  const handleApply = async () => {
    const normalized = applyCode.trim().toUpperCase();
    if (!isValidReferralCode(normalized)) {
      toast("Enter a valid code (4–12 letters/numbers)", "error");
      return;
    }
    if (normalized === code) {
      toast("That is your own code — enter an invitation from a friend", "error");
      return;
    }
    setApplying(true);
    try {
      const r = await applyReferralCode(normalized);
      if (!r.ok) {
        toast(r.error, "error");
        return;
      }
      toast(
        r.data.already
          ? "Referral code already linked to this account"
          : "Invitation applied! Your friend earns points upon your first order.",
        "success"
      );
      setApplyCode("");
      qc.invalidateQueries({ queryKey: ["referral-info"] });
    } finally {
      setApplying(false);
    }
  };

  const stats = [
    { label: "Invited", value: invitesSent },
    { label: "Pending", value: pending },
    { label: "Ordered", value: invitesCompleted },
    { label: "Points", value: pointsEarned },
  ];

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

          <Text style={styles.navTitle}>Refer a friend</Text>

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

        {q.isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={GOLD} size="small" />
            <Text style={styles.loadingText}>Loading your invite…</Text>
          </View>
        ) : q.isError || !q.data ? (
          <View style={styles.centerError}>
            <View style={styles.errorIcon}>
              <Ionicons name="alert-circle-outline" size={26} color={colors.olive[700]} />
            </View>
            <Text style={styles.errorTitle}>Could not load referrals</Text>
            <Text style={styles.errorSub}>
              Check your connection and try again.
            </Text>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => q.refetch()}
              activeOpacity={0.85}
            >
              <Text style={styles.secondaryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl
                refreshing={q.isFetching && !q.isLoading}
                onRefresh={() => q.refetch()}
                tintColor={GOLD}
              />
            }
          >
            {/* Heading */}
            <View style={styles.pageHead}>
              <Text style={styles.eyebrow}>Patron circle</Text>
              <Text style={styles.pageTitle}>
                Invite a friend, <Text style={styles.pageTitleAccent}>earn {REWARD_POINTS} points.</Text>
              </Text>
              <Text style={styles.pageSub}>
                When someone you invite places their first order, {REWARD_POINTS} loyalty points
                are credited to you.
              </Text>
            </View>

            {/* Invite code card */}
            <LinearGradient
              colors={["#1f2418", "#14170e"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.hero}
            >
              <Text style={styles.heroEyebrow}>Your invitation code</Text>

              <TouchableOpacity
                style={styles.codeBox}
                activeOpacity={0.8}
                onPress={handleCopy}
                disabled={!code}
                accessibilityRole="button"
                accessibilityLabel="Copy invitation code"
              >
                <Text style={styles.codeText}>{code || "—"}</Text>
                <View style={styles.codeCopyIcon}>
                  <Ionicons
                    name={copied ? "checkmark" : "copy-outline"}
                    size={15}
                    color={colors.olive[900]}
                  />
                </View>
              </TouchableOpacity>

              <Text style={styles.heroSub}>
                Tap the code to copy your link, or send it straight from here.
              </Text>

              <View style={styles.heroActions}>
                <TouchableOpacity
                  style={styles.shareBtn}
                  activeOpacity={0.88}
                  onPress={handleShare}
                  disabled={!code}
                  accessibilityRole="button"
                >
                  <Ionicons name="paper-plane-outline" size={14} color={colors.olive[900]} />
                  <Text style={styles.shareBtnText}>Share code</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.copyBtn}
                  activeOpacity={0.8}
                  onPress={handleCopy}
                  disabled={!code}
                  accessibilityRole="button"
                >
                  <Ionicons
                    name={copied ? "checkmark" : "link-outline"}
                    size={14}
                    color="#E8CF8F"
                  />
                  <Text style={styles.copyBtnText}>{copied ? "Copied" : "Copy link"}</Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>

            {/* Stats strip */}
            <View style={styles.statsStrip}>
              {stats.map((s, i) => (
                <View key={s.label} style={[styles.statCell, i > 0 && styles.statDivider]}>
                  <Text style={[styles.statValue, s.value === 0 && styles.statValueMuted]}>
                    {s.value}
                  </Text>
                  <Text style={styles.statLabel}>{s.label}</Text>
                </View>
              ))}
            </View>

            {/* Apply a friend's code */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardEyebrow}>Have an invitation?</Text>
                  <Text style={styles.cardTitle}>Link a friend&apos;s code</Text>
                </View>
                <View style={styles.oneTimeTag}>
                  <Text style={styles.oneTimeTagText}>One-time</Text>
                </View>
              </View>

              <Text style={styles.cardSub}>
                Enter their code once — their account is credited when you place your first order.
              </Text>

              <View style={styles.applyInputRow}>
                <Ionicons name="ticket-outline" size={17} color={colors.light.mutedForeground} />
                <TextInput
                  value={applyCode}
                  onChangeText={(v) => setApplyCode(v.toUpperCase())}
                  placeholder="e.g. 3D4E8770"
                  placeholderTextColor={colors.light.mutedForeground}
                  style={styles.applyInputText}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={12}
                />
                {applyCode.length > 0 && (
                  <TouchableOpacity onPress={() => setApplyCode("")} hitSlop={8}>
                    <Ionicons name="close-circle" size={16} color={colors.light.mutedForeground} />
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity
                style={[styles.applyBtn, (!applyCode.trim() || applying) && styles.applyBtnDisabled]}
                onPress={handleApply}
                disabled={!applyCode.trim() || applying}
                activeOpacity={0.88}
                accessibilityRole="button"
                accessibilityLabel="Apply invitation code"
              >
                <Text style={styles.applyBtnText}>
                  {applying ? "Applying…" : "Apply code"}
                </Text>
                <View style={styles.applyBtnArrow}>
                  {applying ? (
                    <ActivityIndicator size="small" color={colors.olive[900]} />
                  ) : (
                    <Ionicons name="arrow-forward" size={14} color={colors.olive[900]} />
                  )}
                </View>
              </TouchableOpacity>
            </View>

            {/* How it works */}
            <View style={styles.card}>
              <Text style={styles.cardEyebrow}>How it works</Text>
              {STEPS.map((s, i) => (
                <View key={s.title} style={[styles.stepRow, i > 0 && styles.rowDivider]}>
                  <View style={styles.stepIcon}>
                    <Ionicons name={s.icon} size={16} color={GOLD_DEEP} />
                    <View style={styles.stepNum}>
                      <Text style={styles.stepNumText}>{i + 1}</Text>
                    </View>
                  </View>
                  <View style={styles.stepBody}>
                    <Text style={styles.stepTitle}>{s.title}</Text>
                    <Text style={styles.stepDesc}>{s.desc}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Activity */}
            {referrals.length > 0 && (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.cardEyebrow}>Invitation log</Text>
                    <Text style={styles.cardTitle}>Recent activity</Text>
                  </View>
                </View>

                {referrals.slice(0, 8).map((r, i) => (
                  <View key={r.id} style={[styles.activityRow, i > 0 && styles.rowDivider]}>
                    <View
                      style={[
                        styles.activityIcon,
                        r.status === "completed" && styles.activityIconDone,
                      ]}
                    >
                      <Ionicons
                        name={r.status === "completed" ? "checkmark" : "time-outline"}
                        size={14}
                        color={r.status === "completed" ? colors.paper.cream : GOLD_DEEP}
                      />
                    </View>
                    <View style={styles.activityBody}>
                      <Text style={styles.activityStatus}>
                        {r.status === "completed" ? "Order completed" : "Awaiting first order"}
                      </Text>
                      <Text style={styles.activityDate}>
                        {new Date(r.created_at).toLocaleDateString(undefined, {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.activityPoints,
                        r.status !== "completed" && styles.activityPointsPending,
                      ]}
                    >
                      +{r.reward_points ?? REWARD_POINTS} pts
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontFamily: fontFamilies.display.italic,
    fontSize: 14,
    color: colors.light.mutedForeground,
  },
  centerError: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[8],
    gap: 8,
  },
  errorIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.paper.warm,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  errorTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 20,
    color: colors.light.foreground,
    textAlign: "center",
  },
  errorSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    color: colors.light.mutedForeground,
    textAlign: "center",
  },
  secondaryBtn: {
    marginTop: 8,
    paddingHorizontal: 20,
    height: 40,
    justifyContent: "center",
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  secondaryBtnText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: colors.light.foreground,
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

  scrollContent: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
    gap: 14,
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
  pageSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.light.mutedForeground,
    marginTop: 6,
    maxWidth: 320,
  },

  /* Invite code card */
  hero: {
    borderRadius: 24,
    padding: spacing[5],
    gap: spacing[3],
    ...shadows.editorial,
  },
  heroEyebrow: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: "rgba(232, 207, 143, 0.85)",
  },
  codeBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(250, 248, 241, 0.07)",
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.4)",
    borderRadius: 18,
    paddingLeft: spacing[4],
    paddingRight: 6,
    paddingVertical: 6,
  },
  codeText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 22,
    letterSpacing: 3,
    color: "#E8CF8F",
  },
  codeCopyIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#E8CF8F",
    alignItems: "center",
    justifyContent: "center",
  },
  heroSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    lineHeight: 17,
    color: "rgba(250, 248, 241, 0.6)",
  },
  heroActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 2,
  },
  shareBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    height: 48,
    borderRadius: radii.full,
    backgroundColor: "#E8CF8F",
  },
  shareBtnText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 14,
    color: colors.olive[900],
  },
  copyBtn: {
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
  copyBtnText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14,
    color: "#E8CF8F",
  },

  /* Stats strip */
  statsStrip: {
    flexDirection: "row",
    backgroundColor: colors.paper.cream,
    borderRadius: radii["2xl"],
    borderWidth: 1,
    borderColor: HAIRLINE,
    paddingVertical: spacing[3.5],
  },
  statCell: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  statDivider: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.light.border,
  },
  statValue: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 22,
    color: colors.light.foreground,
  },
  statValueMuted: {
    color: colors.olive[300],
  },
  statLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9.5,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.light.mutedForeground,
  },

  /* Cards */
  card: {
    backgroundColor: colors.paper.cream,
    borderRadius: 24,
    padding: spacing[5],
    borderWidth: 1,
    borderColor: HAIRLINE,
    gap: spacing[2],
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  cardEyebrow: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: GOLD_DEEP,
    marginBottom: 3,
  },
  cardTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 20,
    letterSpacing: -0.3,
    color: colors.light.foreground,
  },
  cardSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.light.mutedForeground,
  },
  oneTimeTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    backgroundColor: "rgba(200, 164, 74, 0.14)",
  },
  oneTimeTagText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: GOLD_DEEP,
  },

  applyInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.paper.warm,
    borderRadius: radii.xl,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 13 : 9,
    borderWidth: 1,
    borderColor: HAIRLINE,
    marginTop: 4,
  },
  applyInputText: {
    flex: 1,
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 15,
    letterSpacing: 1.5,
    color: colors.light.foreground,
    padding: 0,
  },
  applyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 52,
    paddingLeft: 20,
    paddingRight: 6,
    borderRadius: radii.full,
    backgroundColor: colors.olive[900],
    marginTop: 6,
  },
  applyBtnDisabled: {
    opacity: 0.55,
  },
  applyBtnText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 14.5,
    color: colors.paper.cream,
  },
  applyBtnArrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.paper.cream,
  },

  /* Steps */
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing[3],
    paddingVertical: spacing[3.5],
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.light.border,
  },
  stepIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(200, 164, 74, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  stepNum: {
    position: "absolute",
    top: -3,
    right: -3,
    width: 15,
    height: 15,
    borderRadius: 7.5,
    backgroundColor: GOLD,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 8.5,
    color: colors.olive[950],
  },
  stepBody: {
    flex: 1,
    gap: 2,
  },
  stepTitle: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13.5,
    color: colors.light.foreground,
  },
  stepDesc: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.light.mutedForeground,
  },

  /* Activity */
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    paddingVertical: 10,
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(200, 164, 74, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  activityIconDone: {
    backgroundColor: colors.olive[700],
  },
  activityBody: {
    flex: 1,
    gap: 1,
  },
  activityStatus: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: colors.light.foreground,
  },
  activityDate: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11.5,
    color: colors.light.mutedForeground,
  },
  activityPoints: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 13,
    color: colors.olive[700],
  },
  activityPointsPending: {
    color: colors.light.mutedForeground,
  },
});
