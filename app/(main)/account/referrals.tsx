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
import { SafeAreaView } from "react-native-safe-area-context";
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

export default function ReferralsScreen() {
  const router = useRouter();
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
      toast("Invitation link copied to clipboard", "success");
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

  return (
    <PaperBackground>
      <SafeAreaView style={styles.container} edges={["top"]}>
        {/* Atelier Screen Header */}
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
            <Text style={styles.navTitle}>REFER A FRIEND</Text>
            <Text style={styles.navSubtitle}>PATRON CIRCLE INVITATION</Text>
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

        {q.isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color="#C8A44A" size="small" />
            <Text style={styles.loadingText}>Retrieving invitation ledger…</Text>
          </View>
        ) : q.isError || !q.data ? (
          <View style={styles.centerError}>
            <Ionicons name="alert-circle-outline" size={36} color={colors.light.mutedForeground} />
            <Text style={styles.errorTitle}>Could Not Load Referral Ledger</Text>
            <Text style={styles.errorSub}>Please verify your connection and try again.</Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => q.refetch()}
              activeOpacity={0.85}
            >
              <Text style={styles.retryBtnText}>RETRY</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={q.isFetching}
                onRefresh={() => q.refetch()}
                tintColor="#C8A44A"
              />
            }
          >
            {/* 1. Haute Couture Obsidian Invitation Hero Card */}
            <LinearGradient
              colors={["#1c2016", "#14170e", "#0e110a"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroCard}
            >
              <View style={styles.heroTopRow}>
                <View style={styles.heroTagBadge}>
                  <Ionicons name="sparkles" size={11} color="#C8A44A" />
                  <Text style={styles.heroTagText}>PATRON CIRCLE</Text>
                </View>

                <View style={styles.rewardPill}>
                  <Text style={styles.rewardPillText}>+{REWARD_POINTS} PTS / PATRON</Text>
                </View>
              </View>

              {/* Code Showcase Block */}
              <View style={styles.codeShowcase}>
                <Text style={styles.codeLabel}>YOUR PERSONAL INVITATION CODE</Text>
                <TouchableOpacity
                  style={styles.codeDisplayBox}
                  activeOpacity={0.8}
                  onPress={handleCopy}
                >
                  <Text style={styles.codeText}>{code || "—"}</Text>
                  <View style={styles.copyMiniBtn}>
                    <Ionicons
                      name={copied ? "checkmark" : "copy-outline"}
                      size={14}
                      color="#181b12"
                    />
                  </View>
                </TouchableOpacity>
              </View>

              <Text style={styles.heroSubtitle}>
                Invite fellow connoisseurs to the atelier. When a patron you invite completes their first acquisition, you earn {REWARD_POINTS} loyalty points credited directly to your standing.
              </Text>

              {/* Action Buttons */}
              <View style={styles.heroActionsRow}>
                <TouchableOpacity
                  style={styles.heroShareBtn}
                  activeOpacity={0.88}
                  onPress={handleShare}
                  disabled={!code}
                >
                  <Ionicons name="paper-plane" size={14} color="#181b12" />
                  <Text style={styles.heroShareBtnText}>SHARE CODE</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.heroCopyBtn}
                  activeOpacity={0.8}
                  onPress={handleCopy}
                  disabled={!code}
                >
                  <Ionicons
                    name={copied ? "checkmark" : "link-outline"}
                    size={14}
                    color="#E8CF8F"
                  />
                  <Text style={styles.heroCopyBtnText}>
                    {copied ? "COPIED" : "COPY LINK"}
                  </Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>

            {/* 2. Redesigned 4-Metric Performance Grid */}
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <View style={styles.statIconWrap}>
                  <Ionicons name="people-outline" size={15} color="#85651b" />
                </View>
                <Text style={styles.statNumber}>{invitesSent}</Text>
                <Text style={styles.statLabel}>INVITED</Text>
                <Text style={styles.statSub}>Total patrons reached</Text>
              </View>

              <View style={styles.statCard}>
                <View style={styles.statIconWrap}>
                  <Ionicons name="hourglass-outline" size={15} color="#85651b" />
                </View>
                <Text style={styles.statNumber}>{pending}</Text>
                <Text style={styles.statLabel}>AWAITING ORDER</Text>
                <Text style={styles.statSub}>Cart in progress</Text>
              </View>

              <View style={styles.statCard}>
                <View style={styles.statIconWrap}>
                  <Ionicons name="checkmark-circle-outline" size={15} color="#15803d" />
                </View>
                <Text style={styles.statNumber}>{invitesCompleted}</Text>
                <Text style={styles.statLabel}>COMPLETED</Text>
                <Text style={styles.statSub}>Orders fulfilled</Text>
              </View>

              <View style={styles.statCard}>
                <View style={[styles.statIconWrap, { backgroundColor: "rgba(200, 164, 74, 0.15)" }]}>
                  <Ionicons name="sparkles" size={15} color="#85651b" />
                </View>
                <Text style={[styles.statNumber, { color: "#85651b" }]}>
                  {pointsEarned}
                </Text>
                <Text style={styles.statLabel}>PTS EARNED</Text>
                <Text style={styles.statSub}>Loyalty accrued</Text>
              </View>
            </View>

            {/* 3. Enter a Friend's Code Card */}
            <View style={styles.applyCard}>
              <View style={styles.applyHeader}>
                <View>
                  <Text style={styles.applyEyebrow}>HAVE AN INVITATION?</Text>
                  <Text style={styles.applyTitle}>Link Referrer Code</Text>
                </View>
                <View style={styles.oneTimeTag}>
                  <Text style={styles.oneTimeTagText}>ONE-TIME</Text>
                </View>
              </View>

              <Text style={styles.applySub}>
                Enter an invitation code once to connect your profile with your referrer and credit their account upon your first order.
              </Text>

              <View style={styles.applyInputRow}>
                <Ionicons name="ticket-outline" size={18} color="#85651b" />
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
                style={[
                  styles.applyBtn,
                  (!applyCode.trim() || applying) && styles.applyBtnDisabled,
                ]}
                onPress={handleApply}
                disabled={!applyCode.trim() || applying}
                activeOpacity={0.88}
              >
                {applying ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={14} color="#ffffff" />
                    <Text style={styles.applyBtnText}>APPLY INVITATION CODE</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* 4. Patron Circle Privileges (3 Value Cards) */}
            <View style={styles.privilegesCard}>
              <View style={styles.privilegesHeader}>
                <Ionicons name="sparkles" size={13} color="#85651b" />
                <Text style={styles.privilegesEyebrow}>
                  HOW THE PATRON CIRCLE WORKS
                </Text>
              </View>
              <Text style={styles.privilegesTitle}>The Atelier Referral Journey</Text>

              <View style={styles.privilegeItem}>
                <View style={styles.privilegeIconBox}>
                  <Ionicons name="share-social-outline" size={15} color="#85651b" />
                </View>
                <View style={styles.privilegeContent}>
                  <Text style={styles.privilegeHeading}>1. Share Your Bespoke Link</Text>
                  <Text style={styles.privilegeDesc}>
                    Send your personalized invite code to friends via WhatsApp, Messages, or social channels.
                  </Text>
                </View>
              </View>

              <View style={styles.privilegeItem}>
                <View style={styles.privilegeIconBox}>
                  <Ionicons name="bag-check-outline" size={15} color="#85651b" />
                </View>
                <View style={styles.privilegeContent}>
                  <Text style={styles.privilegeHeading}>2. Friend Completes Order</Text>
                  <Text style={styles.privilegeDesc}>
                    Your friend acquires their first luxury piece and verifies delivery.
                  </Text>
                </View>
              </View>

              <View style={styles.privilegeItem}>
                <View style={styles.privilegeIconBox}>
                  <Ionicons name="trophy-outline" size={15} color="#85651b" />
                </View>
                <View style={styles.privilegeContent}>
                  <Text style={styles.privilegeHeading}>3. Points Accrued Instantly</Text>
                  <Text style={styles.privilegeDesc}>
                    You immediately receive {REWARD_POINTS} patron loyalty points, elevating your VIP tier standing.
                  </Text>
                </View>
              </View>
            </View>

            {/* 5. Recent Invites Activity Ledger */}
            {referrals.length > 0 && (
              <View style={styles.activityCard}>
                <View style={styles.activityHeader}>
                  <Text style={styles.activityEyebrow}>INVITATION LOG</Text>
                  <Text style={styles.activityTitle}>Recent Circle Activity</Text>
                </View>

                <View style={styles.activityList}>
                  {referrals.slice(0, 8).map((r) => (
                    <View key={r.id} style={styles.inviteItemRow}>
                      <View style={styles.inviteIconCircle}>
                        <Ionicons
                          name={r.status === "completed" ? "checkmark-circle" : "time-outline"}
                          size={14}
                          color={r.status === "completed" ? "#15803d" : "#85651b"}
                        />
                      </View>
                      <View style={styles.inviteInfoCol}>
                        <Text style={styles.inviteStatusText}>
                          {r.status === "completed" ? "Order Completed" : "Invited · Awaiting Order"}
                        </Text>
                        <Text style={styles.inviteDateText}>
                          {new Date(r.created_at).toLocaleDateString()}
                        </Text>
                      </View>
                      <Text style={styles.invitePointsValue}>
                        +{r.reward_points ?? REWARD_POINTS} pts
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <View style={{ height: 20 }} />
          </ScrollView>
        )}
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
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 14,
    color: colors.light.mutedForeground,
    fontStyle: "italic",
  },
  centerError: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[8],
    gap: 8,
  },
  errorTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 18,
    color: colors.light.foreground,
    textAlign: "center",
  },
  errorSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12.5,
    color: colors.light.mutedForeground,
    textAlign: "center",
  },
  retryBtn: {
    backgroundColor: "#181b12",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: radii.full,
    marginTop: 8,
  },
  retryBtnText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 11,
    color: "#ffffff",
    letterSpacing: 1,
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

  scrollContent: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: 40,
    gap: 14,
  },

  /* 1. Hero Card */
  heroCard: {
    borderRadius: 20,
    padding: spacing[5],
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.35)",
    ...shadows.editorial,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
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
  rewardPill: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  rewardPillText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    color: "#E8CF8F",
    letterSpacing: 0.5,
  },

  /* Code Showcase */
  codeShowcase: {
    alignItems: "center",
    marginVertical: 4,
    gap: 8,
  },
  codeLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9.5,
    color: "rgba(255, 255, 255, 0.65)",
    letterSpacing: 1,
  },
  codeDisplayBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.35)",
  },
  codeText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 26,
    color: "#E8CF8F",
    letterSpacing: 3,
  },
  copyMiniBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#E8CF8F",
    alignItems: "center",
    justifyContent: "center",
  },
  heroSubtitle: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12.5,
    color: "rgba(255, 255, 255, 0.72)",
    lineHeight: 18,
    marginTop: 10,
    marginBottom: 16,
    textAlign: "center",
  },
  heroActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  heroShareBtn: {
    flex: 1.3,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#E8CF8F",
    paddingVertical: 11,
    borderRadius: radii.full,
  },
  heroShareBtnText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10.5,
    color: "#181b12",
    letterSpacing: 0.8,
  },
  heroCopyBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingVertical: 11,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  heroCopyBtnText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10.5,
    color: "#E8CF8F",
    letterSpacing: 0.8,
  },

  /* 2. Metrics Grid */
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statCard: {
    width: "48.5%",
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 13,
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.08)",
    gap: 3,
    ...shadows.soft,
  },
  statIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(200, 164, 74, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  statNumber: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 20,
    color: colors.light.foreground,
    lineHeight: 24,
  },
  statLabel: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 8.5,
    color: "#85651b",
    letterSpacing: 0.8,
  },
  statSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 9.5,
    color: colors.light.mutedForeground,
  },

  /* 3. Apply Code Card */
  applyCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: spacing[5],
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.08)",
    gap: 12,
    ...shadows.soft,
  },
  applyHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  applyEyebrow: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9.5,
    color: "#85651b",
    letterSpacing: 1.2,
  },
  applyTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 17,
    color: colors.light.foreground,
    marginTop: 2,
  },
  oneTimeTag: {
    backgroundColor: "rgba(22, 23, 15, 0.05)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  oneTimeTagText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 8.5,
    color: colors.light.mutedForeground,
    letterSpacing: 0.5,
  },
  applySub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.light.mutedForeground,
    lineHeight: 17,
  },
  applyInputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(22, 23, 15, 0.03)",
    borderRadius: radii.xl,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 11 : 7,
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.1)",
    gap: 8,
  },
  applyInputText: {
    flex: 1,
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 14,
    color: colors.light.foreground,
    letterSpacing: 2,
  },
  applyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#181b12",
    borderRadius: radii.full,
    paddingVertical: 12,
    ...shadows.soft,
  },
  applyBtnDisabled: {
    opacity: 0.45,
  },
  applyBtnText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 10.5,
    color: "#ffffff",
    letterSpacing: 1.2,
  },

  /* 4. Privileges Card */
  privilegesCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: spacing[5],
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.08)",
    ...shadows.soft,
    gap: 14,
  },
  privilegesHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  privilegesEyebrow: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9.5,
    color: "#85651b",
    letterSpacing: 1.2,
  },
  privilegesTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 16.5,
    color: colors.light.foreground,
    marginTop: -4,
  },
  privilegeItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  privilegeIconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(200, 164, 74, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(200, 164, 74, 0.25)",
  },
  privilegeContent: {
    flex: 1,
    gap: 2,
  },
  privilegeHeading: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: colors.light.foreground,
  },
  privilegeDesc: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11.5,
    color: colors.light.mutedForeground,
    lineHeight: 16,
  },

  /* 5. Activity Card */
  activityCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: spacing[5],
    borderWidth: 1,
    borderColor: "rgba(22, 23, 15, 0.08)",
    ...shadows.soft,
    gap: 10,
  },
  activityHeader: {
    marginBottom: 2,
  },
  activityEyebrow: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9.5,
    color: "#85651b",
    letterSpacing: 1.2,
  },
  activityTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 16.5,
    color: colors.light.foreground,
    marginTop: 2,
  },
  activityList: {
    gap: 4,
  },
  inviteItemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(22, 23, 15, 0.05)",
  },
  inviteIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(22, 23, 15, 0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  inviteInfoCol: {
    flex: 1,
    gap: 1,
  },
  inviteStatusText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12.5,
    color: colors.light.foreground,
  },
  inviteDateText: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 10,
    color: colors.light.mutedForeground,
  },
  invitePointsValue: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 12,
    color: "#85651b",
  },
});
