import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import type { Store } from "@/lib/types";

const compact = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
  : n >= 1_000 ? `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`
  : String(n);

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "L";
}

/**
 * Editorial masthead for the boutique page — sits on the paper under the
 * banner like a magazine cover line: kicker, oversized serif name with an
 * italic last word, pull-quote description, a double-ruled stats index and
 * the follow / contact / share actions.
 */
export function StoreMasthead({
  store,
  description,
  followers,
  pieces,
  reviewTotal,
  avgRating,
  sinceYear,
  following,
  followBusy,
  onFollow,
  onContact,
  onShare,
}: {
  store: Store;
  description: string | null;
  followers: number;
  pieces: number;
  reviewTotal: number;
  avgRating: number;
  sinceYear: number | null;
  following: boolean;
  followBusy: boolean;
  onFollow: () => void;
  onContact: (() => void) | null;
  onShare: () => void;
}) {
  const words = store.name.trim().split(/\s+/);
  const lead = words.length > 1 ? words.slice(0, -1).join(" ") : store.name;
  const last = words.length > 1 ? words[words.length - 1] : null;

  const stats: { value: string; label: string; italic?: boolean }[] = [
    { value: compact(followers), label: followers === 1 ? "Follower" : "Followers" },
    { value: compact(pieces), label: pieces === 1 ? "Piece" : "Pieces" },
    reviewTotal > 0
      ? { value: avgRating.toFixed(1), label: `${reviewTotal} review${reviewTotal === 1 ? "" : "s"}` }
      : { value: "New", label: "Rating", italic: true },
  ];
  if (sinceYear) stats.push({ value: String(sinceYear), label: "Since" });

  return (
    <View style={styles.wrap}>
      {/* Logo + issue line */}
      <View style={styles.topRow}>
        <View style={styles.logoFrame}>
          {store.logo_url ? (
            <Image source={{ uri: store.logo_url }} style={styles.logo} contentFit="cover" transition={200} />
          ) : (
            <LinearGradient colors={[colors.olive[800], colors.olive[950]]} style={[styles.logo, styles.logoFallback]}>
              <Text style={styles.logoInitials}>{initials(store.name)}</Text>
            </LinearGradient>
          )}
          {store.is_online ? <View style={styles.onlineDot} /> : null}
        </View>
        <View style={styles.issue}>
          <Text style={styles.issueText}>LUXE ATELIER</Text>
          <Text style={styles.issueText}>
            {sinceYear ? `EST. ${sinceYear}` : "INDEPENDENT"}
            {store.is_online ? "  ·  OPEN NOW" : ""}
          </Text>
        </View>
      </View>

      {/* Kicker + credentials */}
      <View style={styles.kickerRow}>
        <View style={styles.kickerRule} />
        <Text style={styles.kicker}>THE BOUTIQUE</Text>
        <View style={{ flex: 1 }} />
        {store.status === "approved" ? (
          <View style={styles.cred}>
            <Ionicons name="shield-checkmark" size={11} color={colors.olive[600]} />
            <Text style={styles.credText}>VERIFIED</Text>
          </View>
        ) : null}
        {store.is_featured ? (
          <View style={styles.cred}>
            <Ionicons name="sparkles" size={11} color={colors.accent2.ochre} />
            <Text style={[styles.credText, { color: "#8a6d1f" }]}>FEATURED</Text>
          </View>
        ) : null}
      </View>

      {/* Name */}
      <Text style={styles.name} accessibilityRole="header">
        {lead}
        {last ? (
          <>
            {" "}
            <Text style={styles.nameItalic}>{last}</Text>
          </>
        ) : null}
      </Text>

      {description ? (
        <View style={styles.quote}>
          <Text style={styles.quoteMark}>“</Text>
          <Text style={styles.quoteText} numberOfLines={4}>{description}</Text>
        </View>
      ) : null}

      {/* The seller's banner, inset like an editorial photograph */}
      {store.banner_url ? (
        <Image
          source={{ uri: store.banner_url }}
          style={styles.cover}
          contentFit="cover"
          transition={250}
          accessibilityLabel={`${store.name} banner`}
        />
      ) : null}

      {/* Stats index between a newspaper double rule and a hairline */}
      <View style={styles.ruleThick} />
      <View style={styles.ruleThin} />
      <View style={styles.stats}>
        {stats.map((s, i) => (
          <View key={s.label} style={[styles.stat, i > 0 && styles.statDivided]}>
            <Text style={[styles.statValue, s.italic && styles.statValueItalic]} numberOfLines={1}>
              {s.value}
            </Text>
            <Text style={styles.statLabel} numberOfLines={1}>{s.label.toUpperCase()}</Text>
          </View>
        ))}
      </View>
      <View style={styles.ruleThin} />

      {/* Actions */}
      <View style={styles.actions}>
        <Pressable
          onPress={onFollow}
          disabled={followBusy}
          style={({ pressed }) => [styles.follow, following && styles.followActive, pressed && { opacity: 0.88 }]}
          accessibilityRole="button"
          accessibilityState={{ selected: following, busy: followBusy }}
        >
          {following ? null : (
            <LinearGradient colors={[colors.ink.soft, colors.ink.DEFAULT]} style={StyleSheet.absoluteFill} />
          )}
          <Text style={[styles.followText, following && styles.followTextActive]}>
            {following ? "Following" : "Follow the boutique"}
          </Text>
          <Ionicons
            name={following ? "checkmark" : "arrow-forward"}
            size={16}
            color={following ? colors.olive[700] : colors.accent2.ochre}
          />
        </Pressable>
        {onContact ? (
          <Pressable
            onPress={onContact}
            style={({ pressed }) => [styles.round, pressed && { opacity: 0.7 }]}
            accessibilityLabel="Contact boutique"
          >
            <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.ink.DEFAULT} />
          </Pressable>
        ) : null}
        <Pressable
          onPress={onShare}
          style={({ pressed }) => [styles.round, pressed && { opacity: 0.7 }]}
          accessibilityLabel="Share boutique"
        >
          <Ionicons name="paper-plane-outline" size={17} color={colors.ink.DEFAULT} />
        </Pressable>
      </View>
    </View>
  );
}

export function StoreMastheadSkeleton() {
  return (
    <View style={styles.wrap}>
      <Skeleton width={LOGO} height={LOGO} borderRadius={LOGO_RADIUS} />
      <Skeleton width={120} height={12} borderRadius={6} style={{ marginTop: spacing[6] }} />
      <Skeleton width="80%" height={44} borderRadius={8} style={{ marginTop: spacing[3] }} />
      <Skeleton width="65%" height={18} borderRadius={6} style={{ marginTop: spacing[4] }} />
      <Skeleton width="100%" height={70} borderRadius={6} style={{ marginTop: spacing[6] }} />
      <Skeleton width="100%" height={52} borderRadius={26} style={{ marginTop: spacing[5] }} />
    </View>
  );
}

const LOGO = 84;
const LOGO_RADIUS = 22;
const RULE = "rgba(22,23,15,0.14)";

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing[4] },
  cover: {
    width: "100%",
    aspectRatio: 16 / 9,
    marginTop: spacing[5],
    borderRadius: 18,
    backgroundColor: colors.paper.warm,
  },

  topRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  logoFrame: {
    width: LOGO,
    height: LOGO,
    borderRadius: LOGO_RADIUS,
    padding: 3,
    backgroundColor: colors.paper.cream,
    borderWidth: 1,
    borderColor: "rgba(200,164,74,0.45)",
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 10,
  },
  logo: { flex: 1, borderRadius: LOGO_RADIUS - 4, overflow: "hidden" },
  logoFallback: { alignItems: "center", justifyContent: "center" },
  logoInitials: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 28,
    letterSpacing: 1,
    color: colors.paper.cream,
  },
  onlineDot: {
    position: "absolute",
    right: -3,
    bottom: -3,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#3e9b52",
    borderWidth: 3,
    borderColor: colors.light.background,
  },
  issue: { alignItems: "flex-end", gap: 3, paddingBottom: 4 },
  issueText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.ink.mute,
  },

  kickerRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: spacing[6] },
  kickerRule: { width: 22, height: 1, backgroundColor: colors.accent2.ochre },
  kicker: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 10,
    letterSpacing: 2.6,
    color: colors.accent2.ochre,
  },
  cred: { flexDirection: "row", alignItems: "center", gap: 4, marginLeft: 6 },
  credText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9.5,
    letterSpacing: 1.2,
    color: colors.olive[700],
  },

  name: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 48,
    lineHeight: 52,
    letterSpacing: -1.6,
    color: colors.ink.DEFAULT,
    marginTop: spacing[2],
  },
  nameItalic: { fontFamily: fontFamilies.display.italic, color: colors.olive[600], letterSpacing: -1.2 },

  quote: { flexDirection: "row", gap: 10, marginTop: spacing[4], paddingRight: spacing[4] },
  quoteMark: {
    fontFamily: fontFamilies.display.italic,
    fontSize: 46,
    lineHeight: 46,
    marginTop: -4,
    color: colors.accent2.ochre,
  },
  quoteText: {
    flex: 1,
    fontFamily: fontFamilies.display.italic,
    fontSize: 17,
    lineHeight: 25,
    color: colors.ink.mute,
  },

  ruleThick: { height: 1.5, backgroundColor: colors.ink.DEFAULT, marginTop: spacing[5] },
  ruleThin: { height: StyleSheet.hairlineWidth, backgroundColor: colors.ink.DEFAULT, marginTop: 3, opacity: 0.5 },
  stats: { flexDirection: "row", paddingVertical: spacing[4] },
  stat: { flex: 1, paddingHorizontal: 10, gap: 5 },
  statDivided: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: RULE },
  statValue: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 27,
    lineHeight: 31,
    letterSpacing: -0.6,
    color: colors.ink.DEFAULT,
  },
  statValueItalic: { fontFamily: fontFamilies.display.italic, color: colors.olive[600] },
  statLabel: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    letterSpacing: 1.1,
    color: colors.ink.mute,
  },

  actions: { flexDirection: "row", alignItems: "center", gap: spacing[2], marginTop: spacing[5] },
  follow: {
    flex: 1,
    height: 54,
    borderRadius: radii.full,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
  },
  followActive: {
    backgroundColor: colors.olive[50],
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.3)",
  },
  followText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 15,
    letterSpacing: 0.3,
    color: colors.paper.cream,
  },
  followTextActive: { color: colors.olive[800] },
  round: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(22,23,15,0.18)",
  },
});
