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
 * Profile-style header for the boutique page: a cover (the seller's banner,
 * or an olive atelier backdrop), the logo as an avatar overlapping it, the
 * centred name + handle + credentials, a bio, a dark stats strip in the same
 * language as the Account profile card, and the follow / contact / share row.
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
  topInset,
}: {
  /** Height of the status bar + floating nav the cover runs under. */
  topInset: number;
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
  const verified = store.status === "approved";

  const stats: { value: string; label: string; icon?: keyof typeof Ionicons.glyphMap }[] = [
    { value: compact(followers), label: followers === 1 ? "Follower" : "Followers" },
    { value: compact(pieces), label: pieces === 1 ? "Piece" : "Pieces" },
    reviewTotal > 0
      ? { value: avgRating.toFixed(1), label: `${compact(reviewTotal)} review${reviewTotal === 1 ? "" : "s"}`, icon: "star" }
      : { value: "New", label: "Rating" },
  ];
  if (sinceYear) stats.push({ value: String(sinceYear), label: "Since" });

  return (
    <View>
      {/* Full-bleed cover, running up under the status bar and floating nav */}
      <View style={[styles.cover, { height: topInset + COVER_H }]}>
        {store.banner_url ? (
          <>
            <Image
              source={{ uri: store.banner_url }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={250}
              accessibilityLabel={`${store.name} banner`}
            />
            <LinearGradient
              colors={["rgba(22,23,15,0.55)", "rgba(22,23,15,0.1)", "rgba(22,23,15,0.6)"]}
              locations={[0, 0.45, 1]}
              style={StyleSheet.absoluteFill}
            />
          </>
        ) : (
          <LinearGradient
            colors={[colors.olive[950], colors.olive[800], colors.olive[700]]}
            locations={[0, 0.55, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.6, y: 1 }}
            style={StyleSheet.absoluteFill}
          >
            {/* Oversized monogram watermark + concentric rings around the avatar */}
            <Text style={styles.watermark} numberOfLines={1}>
              {initials(store.name)}
            </Text>
            {[420, 320, 230].map((d) => (
              <View
                key={d}
                style={[styles.ring, { width: d, height: d, borderRadius: d / 2, left: "50%", marginLeft: -d / 2, bottom: -d / 2 + 6 }]}
              />
            ))}
            <LinearGradient
              colors={["rgba(232,208,140,0)", "rgba(232,208,140,0.10)"]}
              style={styles.glow}
            />
          </LinearGradient>
        )}
        <View style={[styles.coverBody, { paddingTop: topInset }]}>
          <View style={styles.coverKicker}>
            <View style={styles.coverRule} />
            <Text style={styles.coverMark}>
              LUXE ATELIER{sinceYear ? `  ·  EST. ${sinceYear}` : ""}
            </Text>
            <View style={styles.coverRule} />
          </View>
          {store.is_online ? (
            <View style={styles.openChip}>
              <View style={styles.openDot} />
              <Text style={styles.openText}>OPEN NOW</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.wrap}>
      {/* Avatar overlapping the cover */}
      <View style={styles.avatarWrap}>
        <View style={styles.avatarRing}>
          {store.logo_url ? (
            <Image source={{ uri: store.logo_url }} style={styles.avatar} contentFit="cover" transition={200} />
          ) : (
            <LinearGradient colors={[colors.olive[800], colors.olive[950]]} style={[styles.avatar, styles.center]}>
              <Text style={styles.avatarInitials}>{initials(store.name)}</Text>
            </LinearGradient>
          )}
        </View>
        {verified ? (
          <View style={styles.verifiedBadge}>
            <Ionicons name="checkmark" size={13} color={colors.paper.cream} />
          </View>
        ) : null}
      </View>

      {/* Identity */}
      <Text style={styles.name} accessibilityRole="header" numberOfLines={2}>
        {lead}
        {last ? (
          <>
            {" "}
            <Text style={styles.nameItalic}>{last}</Text>
          </>
        ) : null}
      </Text>
      <Text style={styles.handle}>@{store.slug}</Text>

      <View style={styles.creds}>
        {verified ? (
          <View style={styles.cred}>
            <Ionicons name="shield-checkmark" size={11} color={colors.olive[600]} />
            <Text style={styles.credText}>Verified</Text>
          </View>
        ) : null}
        {store.is_featured ? (
          <View style={[styles.cred, styles.credGold]}>
            <Ionicons name="sparkles" size={11} color={colors.accent2.ochre} />
            <Text style={[styles.credText, { color: "#8a6d1f" }]}>Featured</Text>
          </View>
        ) : null}
        <View style={styles.cred}>
          <Ionicons name="storefront-outline" size={11} color={colors.ink.mute} />
          <Text style={[styles.credText, { color: colors.ink.mute }]}>
            {sinceYear ? `Est. ${sinceYear}` : "Independent"}
          </Text>
        </View>
      </View>

      {description ? (
        <Text style={styles.bio} numberOfLines={4}>
          {description}
        </Text>
      ) : null}

      {/* Stats strip */}
      <View style={styles.stats}>
        {stats.map((s, i) => (
          <React.Fragment key={s.label}>
            {i > 0 ? <View style={styles.statDivider} /> : null}
            <View style={styles.stat} accessible accessibilityLabel={`${s.value} ${s.label}`}>
              <View style={styles.statValueRow}>
                {s.icon ? <Ionicons name={s.icon} size={13} color={colors.accent2.ochre} /> : null}
                <Text style={styles.statValue} numberOfLines={1}>
                  {s.value}
                </Text>
              </View>
              <Text style={styles.statLabel} numberOfLines={1}>
                {s.label}
              </Text>
            </View>
          </React.Fragment>
        ))}
      </View>

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
            <LinearGradient colors={[colors.olive[700], colors.olive[900]]} style={StyleSheet.absoluteFill} />
          )}
          <Ionicons
            name={following ? "checkmark-circle" : "add-circle-outline"}
            size={18}
            color={following ? colors.olive[700] : colors.paper.cream}
          />
          <Text style={[styles.followText, following && styles.followTextActive]}>
            {following ? "Following" : "Follow"}
          </Text>
        </Pressable>
        {onContact ? (
          <Pressable
            onPress={onContact}
            style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.7 }]}
            accessibilityRole="button"
            accessibilityLabel="Contact boutique"
          >
            <Ionicons name="chatbubble-ellipses-outline" size={17} color={colors.ink.DEFAULT} />
            <Text style={styles.secondaryText}>Message</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={onShare}
          style={({ pressed }) => [styles.round, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
          accessibilityLabel="Share boutique"
        >
          <Ionicons name="paper-plane-outline" size={17} color={colors.ink.DEFAULT} />
        </Pressable>
      </View>
      </View>
    </View>
  );
}

export function StoreMastheadSkeleton({ topInset }: { topInset: number }) {
  return (
    <View>
      <View style={[styles.cover, { height: topInset + COVER_H, backgroundColor: colors.olive[900] }]} />
      <View style={styles.wrap}>
      <View style={{ alignItems: "center", marginTop: -AVATAR / 2 }}>
        <Skeleton width={AVATAR} height={AVATAR} borderRadius={AVATAR / 2} />
        <Skeleton width="60%" height={32} borderRadius={8} style={{ marginTop: spacing[4] }} />
        <Skeleton width={110} height={12} borderRadius={6} style={{ marginTop: spacing[2] }} />
        <Skeleton width="80%" height={16} borderRadius={6} style={{ marginTop: spacing[4] }} />
      </View>
      <Skeleton width="100%" height={68} borderRadius={20} style={{ marginTop: spacing[5] }} />
      <Skeleton width="100%" height={50} borderRadius={25} style={{ marginTop: spacing[4] }} />
      </View>
    </View>
  );
}

/** Cover height below the status bar + nav. */
export const COVER_H = 132;
const COVER_R = 36;
const AVATAR = 104;
const LINE = "rgba(22,23,15,0.12)";

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing[4] },
  center: { alignItems: "center", justifyContent: "center" },

  cover: {
    borderBottomLeftRadius: COVER_R,
    borderBottomRightRadius: COVER_R,
    borderCurve: "continuous",
    overflow: "hidden",
    backgroundColor: colors.olive[900],
  },
  watermark: {
    position: "absolute",
    right: -18,
    top: 18,
    fontFamily: fontFamilies.display.italic,
    fontSize: 210,
    lineHeight: 230,
    letterSpacing: -8,
    color: "rgba(232,208,140,0.06)",
  },
  ring: {
    position: "absolute",
    borderWidth: 1,
    borderColor: "rgba(232,208,140,0.13)",
  },
  glow: { position: "absolute", left: 0, right: 0, bottom: 0, height: 90 },
  coverBody: {
    flex: 1,
    alignItems: "center",
    gap: 10,
  },
  coverKicker: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 },
  coverRule: { width: 18, height: StyleSheet.hairlineWidth, backgroundColor: "rgba(232,208,140,0.6)" },
  coverMark: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 2.4,
    color: "rgba(232,208,140,0.85)",
  },
  openChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
    backgroundColor: "rgba(250,248,241,0.16)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(250,248,241,0.3)",
  },
  openDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#7bd389" },
  openText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9.5,
    letterSpacing: 1.2,
    color: colors.paper.cream,
  },

  avatarWrap: {
    alignSelf: "center",
    marginTop: -AVATAR / 2,
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 10,
  },
  avatarRing: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    padding: 4,
    backgroundColor: colors.light.background,
  },
  avatar: { flex: 1, borderRadius: AVATAR / 2 - 4, overflow: "hidden" },
  avatarInitials: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 34,
    letterSpacing: 1,
    color: colors.paper.cream,
  },
  verifiedBadge: {
    position: "absolute",
    right: 4,
    bottom: 4,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.olive[600],
    borderWidth: 3,
    borderColor: colors.light.background,
  },

  name: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -1,
    color: colors.ink.DEFAULT,
    textAlign: "center",
    marginTop: spacing[3],
  },
  nameItalic: { fontFamily: fontFamilies.display.italic, color: colors.olive[600], letterSpacing: -0.6 },
  handle: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 12,
    letterSpacing: 0.4,
    color: colors.ink.mute,
    textAlign: "center",
    marginTop: 2,
  },

  creds: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 6,
    marginTop: spacing[3],
  },
  cred: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
    backgroundColor: "rgba(250,248,241,0.9)",
    borderWidth: 1,
    borderColor: LINE,
  },
  credGold: { borderColor: "rgba(200,164,74,0.4)", backgroundColor: "rgba(200,164,74,0.08)" },
  credText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 11.5,
    color: colors.olive[700],
  },

  bio: {
    fontFamily: fontFamilies.display.italic,
    fontSize: 16,
    lineHeight: 23,
    color: colors.ink.mute,
    textAlign: "center",
    marginTop: spacing[4],
    paddingHorizontal: spacing[3],
  },

  stats: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing[5],
    paddingVertical: 14,
    borderRadius: 20,
    borderCurve: "continuous",
    backgroundColor: colors.ink.DEFAULT,
  },
  stat: { flex: 1, alignItems: "center", gap: 2, paddingHorizontal: 4 },
  statValueRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  statValue: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 19,
    color: colors.paper.cream,
    fontVariant: ["tabular-nums"],
  },
  statLabel: { fontFamily: fontFamilies.sans.medium, fontSize: 11.5, color: "rgba(250,248,241,0.6)" },
  statDivider: { width: 1, height: 28, backgroundColor: "rgba(250,248,241,0.12)" },

  actions: { flexDirection: "row", alignItems: "center", gap: spacing[2], marginTop: spacing[4] },
  follow: {
    flex: 1,
    height: 50,
    borderRadius: radii.full,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  followActive: {
    backgroundColor: colors.olive[50],
    borderWidth: 1,
    borderColor: "rgba(83,94,44,0.3)",
  },
  followText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 15,
    letterSpacing: 0.2,
    color: colors.paper.cream,
  },
  followTextActive: { color: colors.olive[800] },
  secondary: {
    flex: 1,
    height: 50,
    borderRadius: radii.full,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(250,248,241,0.9)",
    borderWidth: 1,
    borderColor: "rgba(22,23,15,0.16)",
  },
  secondaryText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 15,
    color: colors.ink.DEFAULT,
  },
  round: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(250,248,241,0.9)",
    borderWidth: 1,
    borderColor: "rgba(22,23,15,0.16)",
  },
});
