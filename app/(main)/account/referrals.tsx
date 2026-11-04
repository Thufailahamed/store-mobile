import React, { useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Share,
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
import * as Clipboard from "expo-clipboard";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { useToast } from "@/components/ui";
import { getReferralInfo, applyReferralCode } from "@/lib/api";
import { isValidReferralCode } from "@/lib/api/backend";
import { colors, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { UserPageFrame, UP as C } from "@/components/user/user-page";

const REWARD_POINTS = 100;

const STEPS: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  desc: string;
}[] = [
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
      toast(
        "That is your own code — enter an invitation from a friend",
        "error",
      );
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
        "success",
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
    <UserPageFrame
      title="Refer a friend"
      right={
        <>
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
              <Ionicons
                name="refresh-outline"
                size={18}
                color={colors.light.foreground}
              />
            )}
          </TouchableOpacity>
        </>
      }
    >
      <SafeAreaView style={styles.container} edges={[]}>
        {q.isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={C.accent} size="small" />
            <Text style={styles.loadingText}>Loading your invite…</Text>
          </View>
        ) : q.isError || !q.data ? (
          <View style={styles.centerError}>
            <View style={styles.errorIcon}>
              <Ionicons
                name="alert-circle-outline"
                size={26}
                color={colors.olive[700]}
              />
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
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: insets.bottom + 40 },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl
                refreshing={q.isFetching && !q.isLoading}
                onRefresh={() => q.refetch()}
                tintColor={C.accent}
              />
            }
          >
            {/* Invite card */}
            <View style={styles.cardShadow}>
              <View style={styles.card}>
                <View style={styles.heroTop}>
                  <View style={styles.heroIcon}>
                    <Ionicons name="people" size={22} color={C.accent} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.heroTitle}>
                      Invite friends, earn {REWARD_POINTS} pts
                    </Text>
                    <Text style={styles.heroSub}>
                      Credited when they place their first order.
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.codeBox}
                  activeOpacity={0.8}
                  onPress={handleCopy}
                  disabled={!code}
                  accessibilityRole="button"
                  accessibilityLabel="Copy invitation code"
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.codeLabel}>Your invitation code</Text>
                    <Text style={styles.codeText} numberOfLines={1} adjustsFontSizeToFit>
                      {code || "—"}
                    </Text>
                  </View>
                  <View style={styles.codeCopyIcon}>
                    <Ionicons
                      name={copied ? "checkmark" : "copy-outline"}
                      size={17}
                      color={C.lime}
                    />
                  </View>
                </TouchableOpacity>

                <View style={styles.heroActions}>
                  <TouchableOpacity
                    style={styles.shareBtn}
                    activeOpacity={0.88}
                    onPress={handleShare}
                    disabled={!code}
                    accessibilityRole="button"
                  >
                    <Ionicons name="paper-plane-outline" size={16} color={C.lime} />
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
                      size={16}
                      color={C.text}
                    />
                    <Text style={styles.copyBtnText}>
                      {copied ? "Copied" : "Copy link"}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.statsStrip}>
                  {stats.map((s, i) => (
                    <React.Fragment key={s.label}>
                      {i > 0 ? <View style={styles.statDivider} /> : null}
                      <View
                        style={styles.statCell}
                        accessible
                        accessibilityLabel={`${s.value} ${s.label}`}
                      >
                        <Text style={styles.statValue}>{s.value}</Text>
                        <Text style={styles.statLabel}>{s.label}</Text>
                      </View>
                    </React.Fragment>
                  ))}
                </View>
              </View>
            </View>

            {/* Apply a friend's code */}
            <View style={styles.cardShadow}>
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>Have an invitation?</Text>
                    <Text style={styles.cardSub}>
                      Enter a friend&apos;s code once — they&apos;re credited
                      when you place your first order.
                    </Text>
                  </View>
                  <View style={styles.oneTimeTag}>
                    <Text style={styles.oneTimeTagText}>One-time</Text>
                  </View>
                </View>

                <View style={styles.applyInputRow}>
                  <Ionicons name="ticket-outline" size={18} color={C.muted} />
                  <TextInput
                    value={applyCode}
                    onChangeText={(v) => setApplyCode(v.toUpperCase())}
                    placeholder="Enter code"
                    placeholderTextColor={C.faint}
                    style={styles.applyInputText}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    maxLength={12}
                  />
                  {applyCode.length > 0 && (
                    <TouchableOpacity onPress={() => setApplyCode("")} hitSlop={8}>
                      <Ionicons name="close-circle" size={18} color={C.faint} />
                    </TouchableOpacity>
                  )}
                </View>

                <TouchableOpacity
                  style={[
                    styles.applyBtn,
                    (!applyCode.trim() || applying) && styles.applyBtnDisabled,
                  ]}
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
                      <ActivityIndicator size="small" color={C.ink} />
                    ) : (
                      <Ionicons name="arrow-forward" size={16} color={C.ink} />
                    )}
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            {/* How it works */}
            <View style={styles.cardShadow}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>How it works</Text>
              {STEPS.map((s, i) => (
                <View
                  key={s.title}
                  style={[styles.stepRow, i > 0 && styles.rowDivider]}
                >
                  <View style={styles.stepIcon}>
                    <Ionicons name={s.icon} size={18} color={C.accent} />
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
            </View>

            {/* Activity */}
            {referrals.length > 0 && (
              <View style={styles.cardShadow}>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Recent activity</Text>

                {referrals.slice(0, 8).map((r, i) => (
                  <View
                    key={r.id}
                    style={[styles.activityRow, i > 0 && styles.rowDivider]}
                  >
                    <View
                      style={[
                        styles.activityIcon,
                        r.status === "completed" && styles.activityIconDone,
                      ]}
                    >
                      <Ionicons
                        name={
                          r.status === "completed"
                            ? "checkmark"
                            : "time-outline"
                        }
                        size={14}
                        color={r.status === "completed" ? C.lime : C.accent}
                      />
                    </View>
                    <View style={styles.activityBody}>
                      <Text style={styles.activityStatus}>
                        {r.status === "completed"
                          ? "Order completed"
                          : "Awaiting first order"}
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
                        r.status !== "completed" &&
                          styles.activityPointsPending,
                      ]}
                    >
                      +{r.reward_points ?? REWARD_POINTS} pts
                    </Text>
                  </View>
                ))}
              </View>
              </View>
            )}
          </ScrollView>
        )}
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
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontFamily: fontFamilies.sans.medium, fontSize: 14, color: C.muted },
  centerError: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[8],
    gap: 8,
  },
  errorIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: C.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  errorTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 19, color: C.text, textAlign: "center" },
  errorSub: { fontFamily: fontFamilies.sans.regular, fontSize: 13.5, color: C.muted, textAlign: "center" },
  secondaryBtn: {
    marginTop: 10,
    paddingHorizontal: 22,
    height: 46,
    justifyContent: "center",
    borderRadius: 23,
    backgroundColor: C.ink,
  },
  secondaryBtnText: { fontFamily: fontFamilies.sans.bold, fontSize: 14, color: C.cream },

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
  scrollContent: { paddingHorizontal: 20, paddingTop: 2, gap: 16 },

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

  /* Invite card */
  heroTop: { flexDirection: "row", alignItems: "center", gap: 14 },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.accentSoft,
  },
  heroTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 18, letterSpacing: -0.4, color: C.text },
  heroSub: { fontFamily: fontFamilies.sans.regular, fontSize: 13, color: C.muted, marginTop: 2 },
  codeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#f5f3ec",
    borderRadius: 20,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "rgba(22,23,15,0.16)",
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 10,
  },
  codeLabel: { fontFamily: fontFamilies.sans.medium, fontSize: 12, color: C.muted },
  codeText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 22,
    letterSpacing: 3,
    color: C.text,
    marginTop: 2,
  },
  codeCopyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  heroActions: { flexDirection: "row", gap: 10 },
  shareBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 50,
    borderRadius: 25,
    backgroundColor: C.ink,
  },
  shareBtnText: { fontFamily: fontFamilies.sans.semibold, fontSize: 14.5, color: C.cream },
  copyBtn: {
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
  copyBtnText: { fontFamily: fontFamilies.sans.semibold, fontSize: 14.5, color: C.text },

  /* Stats strip */
  statsStrip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 20,
    borderCurve: "continuous",
    backgroundColor: C.ink,
  },
  statCell: { flex: 1, alignItems: "center", gap: 2 },
  statDivider: { width: 1, height: 28, backgroundColor: "rgba(250,248,241,0.12)" },
  statValue: { fontFamily: fontFamilies.sans.bold, fontSize: 20, color: C.cream, fontVariant: ["tabular-nums"] },
  statLabel: { fontFamily: fontFamilies.sans.medium, fontSize: 12, color: "rgba(250,248,241,0.6)" },

  /* Cards */
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  cardTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 17, letterSpacing: -0.3, color: C.text },
  cardSub: { fontFamily: fontFamilies.sans.regular, fontSize: 13, lineHeight: 18, color: C.muted, marginTop: 3 },
  oneTimeTag: {
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 13,
    justifyContent: "center",
    backgroundColor: C.accentSoft,
  },
  oneTimeTagText: { fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: C.accent },
  applyInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 52,
    backgroundColor: "#f5f3ec",
    borderRadius: 16,
    paddingHorizontal: 15,
  },
  applyInputText: {
    flex: 1,
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 16,
    letterSpacing: 1.5,
    color: C.text,
    padding: 0,
  },
  applyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 56,
    paddingLeft: 22,
    paddingRight: 6,
    borderRadius: 28,
    backgroundColor: C.ink,
  },
  applyBtnDisabled: { opacity: 0.35 },
  applyBtnText: { fontFamily: fontFamilies.sans.semibold, fontSize: 15, color: C.cream },
  applyBtnArrow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.lime,
  },

  /* Steps */
  stepRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  rowDivider: { borderTopWidth: 1, borderTopColor: C.line },
  stepIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNum: {
    position: "absolute",
    top: -3,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: C.ink,
    borderWidth: 2,
    borderColor: C.card,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumText: { fontFamily: fontFamilies.sans.bold, fontSize: 10, color: C.lime },
  stepBody: { flex: 1, gap: 2 },
  stepTitle: { fontFamily: fontFamilies.sans.semibold, fontSize: 14.5, color: C.text },
  stepDesc: { fontFamily: fontFamilies.sans.regular, fontSize: 12.5, lineHeight: 17, color: C.muted },

  /* Activity */
  activityRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  activityIconDone: { backgroundColor: C.ink },
  activityBody: { flex: 1, gap: 1 },
  activityStatus: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: C.text },
  activityDate: { fontFamily: fontFamilies.sans.regular, fontSize: 12, color: C.muted },
  activityPoints: { fontFamily: fontFamilies.sans.bold, fontSize: 14, color: C.accent },
  activityPointsPending: { color: C.muted },
});
