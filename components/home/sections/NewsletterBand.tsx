import React, { useState } from "react";
import { View, TouchableOpacity, TextInput, StyleSheet, Alert } from "react-native";
import { Display, Label, Body } from "@/components/ui/Typography";
import { colors, radii, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

interface NewsletterBandProps {
  kicker?: string;
  headline?: string;
  subhead?: string;
  ctaLabel?: string;
  stampText?: string;
  statReaders?: string;
  statCadence?: string;
  statSponsors?: string;
}

export function NewsletterBand({
  kicker = "Letters from the house · 10",
  headline = "One letter.\nEvery Sunday.",
  subhead = "Five quiet picks, a field note from an atelier, and the one piece we're wearing on repeat. No promotions, no countdowns, no 40%-off banners.",
  ctaLabel = "Subscribe",
  stampText = "Free · Forever",
  statReaders = "1,200",
  statCadence = "Sundays",
  statSponsors = "Zero",
}: NewsletterBandProps) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const submit = () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      Alert.alert("Doesn't look like an email", "Try again?");
      return;
    }
    setSent(true);
    setEmail("");
    setTimeout(() => setSent(false), 4000);
  };

  const [headA, headB] = headline.split("\n");
  const headAItal = (headA ?? "").trim();
  const headBItal = (headB ?? "").trim();
  // Extract the noun/word after "Every" for accent styling.
  const bItalStripped = headBItal.replace(/^Every\s*/i, "").replace(/\.$/, "");

  return (
    <View style={styles.wrap}>
      <View style={styles.halftone} pointerEvents="none" />
      <View style={[styles.blob, styles.blobA]} pointerEvents="none" />
      <View style={[styles.blob, styles.blobB]} pointerEvents="none" />
      <View style={styles.watermark} pointerEvents="none">
        <Display size="5xl">010</Display>
      </View>

      <View style={styles.inner}>
        {/* Title block */}
        <View style={styles.titleBlock}>
          <View style={styles.kickerRow}>
            <View style={styles.kickerRule} />
            <Label style={styles.kickerText}>{kicker}</Label>
          </View>
          <Display size="3xl" style={styles.title}>
            {headAItal}.{" "}
            {headBItal ? (
              <Display italic size="3xl" style={styles.titleAccent}>
                Every {bItalStripped}.
              </Display>
            ) : null}
          </Display>
          {subhead ? <Body size="sm" style={styles.subhead}>{subhead}</Body> : null}
        </View>

        {/* Form card */}
        <View style={styles.card}>
          <View style={styles.stamp}>
            <Label style={styles.stampText}>{stampText}</Label>
          </View>

          <Label style={styles.cardKicker}>Subscribe</Label>
          <Display size="lg" style={styles.cardTitle}>
            Read the next issue.
          </Display>
          <Body size="xs" style={styles.cardSub}>
            Join {statReaders} readers who'd rather get one good letter a week
            than a daily pitch.
          </Body>

          <View style={styles.formRow}>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@olive.ink"
              placeholderTextColor={colors.light.mutedForeground}
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
            />
            <TouchableOpacity activeOpacity={0.85} onPress={submit} style={styles.cta}>
              <Label style={styles.ctaText}>{sent ? "Sent ✓" : ctaLabel}</Label>
            </TouchableOpacity>
          </View>
          <View style={styles.reassureRow}>
            <View style={styles.liveDot} />
            <Label style={styles.reassureText}>One-click unsubscribe · We never sell</Label>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <Stat value={statReaders} label="Readers" />
          <Stat value={statCadence} label="Cadence" />
          <Stat value={statSponsors} label="Sponsors" />
        </View>
      </View>
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.statBlock}>
      <Display size="lg" style={styles.statValue}>
        {value}
      </Display>
      <Label style={styles.statLabel}>{label}</Label>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.olive[950],
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(245, 244, 239, 0.18)",
    overflow: "hidden",
    position: "relative",
  },
  halftone: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(168, 176, 107, 0.10)" },
  blob: { position: "absolute", borderRadius: 999 },
  blobA: { top: -100, left: -80, width: 320, height: 320, backgroundColor: "rgba(104, 118, 57, 0.30)" },
  blobB: { bottom: -120, right: -100, width: 360, height: 360, backgroundColor: "rgba(168, 176, 107, 0.20)" },
  watermark: {
    position: "absolute",
    top: -20,
    right: -10,
    fontSize: 180,
    lineHeight: 180,
    color: "rgba(245, 244, 239, 0.04)",
  },
  inner: { paddingHorizontal: 20, paddingTop: spacing[10], paddingBottom: spacing[10], gap: spacing[6] },
  // Title
  titleBlock: { gap: spacing[2] },
  kickerRow: { flexDirection: "row", alignItems: "center", gap: spacing[2], marginBottom: 4 },
  kickerRule: { width: 24, height: 1, backgroundColor: colors.olive[300] },
  kickerText: { color: colors.olive[300] },
  title: { color: colors.paper.cream, lineHeight: 36 },
  titleAccent: { color: colors.olive[300] },
  subhead: { color: "rgba(245, 244, 239, 0.75)", marginTop: spacing[2] },
  // Card
  card: {
    backgroundColor: colors.paper.cream,
    borderRadius: radii.md,
    padding: spacing[5],
    position: "relative",
    gap: spacing[2],
  },
  stamp: {
    position: "absolute",
    top: -10,
    right: -10,
    backgroundColor: colors.light.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    transform: [{ rotate: "8deg" }],
  },
  stampText: { color: colors.paper.cream, fontSize: 9 },
  cardKicker: { color: colors.light.primary },
  cardTitle: { color: colors.light.foreground, fontSize: 22 },
  cardSub: { color: colors.light.mutedForeground },
  formRow: { flexDirection: "row", gap: spacing[2], marginTop: spacing[3] },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.paper.warm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radii.sm,
    color: colors.light.foreground,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 14,
  },
  cta: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: colors.light.foreground,
    borderRadius: radii.sm,
    justifyContent: "center",
  },
  ctaText: { color: colors.paper.cream, fontFamily: fontFamilies.mono.medium, fontSize: 11, letterSpacing: typography.letterSpacing.editorial },
  reassureRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing[2] },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.light.primary },
  reassureText: { color: colors.light.mutedForeground, fontSize: 9 },
  // Stats
  statsRow: { flexDirection: "row", gap: spacing[2] },
  statBlock: { flex: 1, paddingLeft: spacing[3], borderLeftWidth: 1, borderLeftColor: "rgba(245, 244, 239, 0.18)" },
  statValue: { color: colors.paper.cream, fontSize: 22 },
  statLabel: { color: "rgba(245, 244, 239, 0.55)", fontSize: 9, marginTop: 2 },
});
