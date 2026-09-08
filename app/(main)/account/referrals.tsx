import React, { useState } from "react";
import { View, Text, StyleSheet, Share, ActivityIndicator } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ScreenHeader } from "@/components/layout";
import { Button, Input, useToast } from "@/components/ui";
import { getReferralInfo, applyReferralCode } from "@/lib/api";
import { isValidReferralCode } from "@/lib/api/backend";
import { colors, radii, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const REWARD_POINTS = 100;

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
  const shareUrl = q.data?.shareUrl ?? (code ? `https://synapstore.shop/r/${code}` : "");
  const sharePath = q.data?.sharePath ?? (code ? `/r/${code}` : "");
  const invitesSent = q.data?.invites_sent ?? q.data?.totalReferrals ?? q.data?.uses ?? 0;
  const invitesCompleted = q.data?.invites_completed ?? 0;
  const pending = q.data?.pendingRewards ?? Math.max(0, invitesSent - invitesCompleted);
  const pointsEarned = q.data?.points_earned ?? 0;
  const referrals = q.data?.referrals ?? [];

  const handleCopy = async () => {
    if (!code) return;
    try {
      await Clipboard.setStringAsync(shareUrl || code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast("Invite link copied", "success");
    } catch {
      toast("Couldn't copy link", "error");
    }
  };

  const handleShare = async () => {
    if (!code) return;
    try {
      await Share.share({
        message: `Shop LUXE with my invite ${code} — ${shareUrl}\nYou earn loyalty points on your first order, and I earn ${REWARD_POINTS} points when you complete it!`,
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
      toast("That's your own code — ask a friend for theirs", "error");
      return;
    }
    setApplying(true);
    try {
      const r = await applyReferralCode(normalized);
      if (!r.ok) {
        toast(r.error, "error");
        return;
      }
      toast(r.data.already ? "Referral already applied" : "Referral applied! Your friend earns points on your first order.", "success");
      setApplyCode("");
      qc.invalidateQueries({ queryKey: ["referral-info"] });
    } finally {
      setApplying(false);
    }
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 24 }]}>
      <ScreenHeader title="Refer a friend" onBack={() => router.back()} />
      {q.isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} />
      ) : q.isError || !q.data ? (
        <View style={styles.center}>
          <Text style={styles.body}>Couldn't load your referral code. Try again later.</Text>
          <Button onPress={() => q.refetch()} style={{ marginTop: 12 }}>Retry</Button>
        </View>
      ) : (
        <View style={styles.content}>
          <View style={styles.card}>
            <Text style={styles.label}>Your code</Text>
            <Text style={styles.code}>{code || "—"}</Text>
            <Text style={styles.hint}>
              Share this with friends. You earn {REWARD_POINTS} loyalty points when a friend you referred completes
              their first paid order.
            </Text>
            {!!shareUrl && <Text style={styles.link}>{shareUrl}</Text>}
            <View style={styles.row}>
              <Button variant="outline" onPress={handleCopy} disabled={!code} style={styles.flex}>
                {copied ? "Copied!" : "Copy link"}
              </Button>
              <Button onPress={handleShare} disabled={!code} style={styles.flex}>
                Share code
              </Button>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{invitesSent}</Text>
              <Text style={styles.statLabel}>Invited</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{pending}</Text>
              <Text style={styles.statLabel}>Awaiting order</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{invitesCompleted}</Text>
              <Text style={styles.statLabel}>Completed</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{pointsEarned}</Text>
              <Text style={styles.statLabel}>Pts earned</Text>
            </View>
          </View>

          {referrals.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.label}>Recent invites</Text>
              {referrals.slice(0, 8).map((r) => (
                <View key={r.id} style={styles.inviteRow}>
                  <Text style={styles.inviteStatus}>{r.status}</Text>
                  <Text style={styles.inviteMeta}>
                    {new Date(r.created_at).toLocaleDateString()} · {r.reward_points ?? REWARD_POINTS} pts
                  </Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.card}>
            <Text style={styles.label}>Have a friend's code?</Text>
            <Text style={styles.hint}>Enter it once — it links your account to your referrer.</Text>
            <Input
              placeholder="e.g. A1B2C3D4"
              value={applyCode}
              onChangeText={(v) => setApplyCode(v.toUpperCase())}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <Button loading={applying} onPress={handleApply} disabled={!applyCode.trim()}>
              Apply code
            </Button>
            {!!sharePath && <Text style={styles.finePrint}>Your share link path: {sharePath}</Text>}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  content: { gap: spacing[3], paddingBottom: spacing[6] },
  center: { alignItems: "center", marginTop: 40, paddingHorizontal: spacing[5] },
  card: {
    marginHorizontal: spacing[5],
    marginTop: spacing[4],
    padding: spacing[5],
    backgroundColor: colors.light.card,
    borderRadius: radii.lg,
    gap: spacing[3],
  },
  label: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  code: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 28,
    color: colors.light.foreground,
    letterSpacing: 2,
  },
  body: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
    textAlign: "center",
  },
  hint: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.sm,
    color: colors.light.mutedForeground,
  },
  link: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: typography.fontSizes.xs,
    color: colors.light.primary,
  },
  finePrint: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 10,
    color: colors.light.mutedForeground,
  },
  row: { flexDirection: "row", gap: spacing[2] },
  flex: { flex: 1 },
  statsRow: {
    flexDirection: "row",
    marginHorizontal: spacing[5],
    marginTop: spacing[4],
    backgroundColor: colors.light.card,
    borderRadius: radii.lg,
    padding: spacing[4],
  },
  stat: { flex: 1, alignItems: "center" },
  statValue: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 20,
    color: colors.light.foreground,
  },
  statLabel: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 10,
    color: colors.light.mutedForeground,
    marginTop: 2,
  },
  inviteRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
  },
  inviteStatus: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: typography.fontSizes.sm,
    color: colors.light.foreground,
    textTransform: "capitalize",
  },
  inviteMeta: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
  },
});
