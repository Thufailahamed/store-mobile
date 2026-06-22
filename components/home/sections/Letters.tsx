import React, { useEffect, useState } from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { Display, Label, Body } from "@/components/ui/Typography";
import { colors, radii, spacing, shadows } from "@/lib/theme/tokens";
import type { Testimonial } from "@/lib/types";

const DEFAULT_LETTERS: Testimonial[] = [
  {
    id: "lt1",
    body:
      "My Linen Campo arrived smelling of olive leaves. I sat on the floor for a full ten minutes before opening the second parcel. The cloth is everything the description promised — and quieter than the photographs.",
    name: "Imani R.",
    place: "Brooklyn, NY",
    piece: "Linen Campo — Olive",
    accent: "olive",
    display_order: 1,
  },
  {
    id: "lt2",
    body:
      "I'd been wearing the same indigo shirt for four years. The Atelier Brun stitch replacement was the most honest repair I've ever paid for. The seamstress signed the cuff with her initials in white thread.",
    name: "Hugo M.",
    place: "Lisbon, PT",
    piece: "Atelier Brun — Repair",
    accent: "rust",
    display_order: 2,
  },
  {
    id: "lt3",
    body:
      "The packaging alone made me cry. Brown paper, a pressed olive sprig, a card in the editor's handwriting. I keep the sprig in my notebook.",
    name: "Saoirse K.",
    place: "Galway, IE",
    piece: "Press Olive Card",
    accent: "ink",
    display_order: 3,
  },
  {
    id: "lt4",
    body:
      "Wore the Wool Editor trousers to a wedding in Jaipur. Got four questions and zero offers to trade. They're mine, clearly mine, and I love them more for it.",
    name: "Devanshi T.",
    place: "Mumbai, IN",
    piece: "Wool Editor — Bone",
    accent: "ochre",
    display_order: 4,
  },
];

const ACCENT_BG: Record<string, string> = {
  olive: colors.olive[700],
  rust: colors.accent2.rust,
  ochre: colors.accent2.ochre,
  ink: colors.light.foreground,
};

interface LettersProps {
  letters?: Testimonial[];
  kicker?: string;
  title?: string;
  subtitle?: string;
}

/**
 * Letters — a parchment of correspondence from the LUXE community.
 * One active card with a wax-seal feel; rotates every 6.5s.
 */
export function Letters({
  letters = DEFAULT_LETTERS,
  kicker = "Letters · 06",
  title = "What our people write back.",
  subtitle = "We don't run a testimonials carousel. These are notes — real ones — copied from cards, parcel slips, and the occasional DMs. We asked permission before printing.",
}: LettersProps) {
  const list = letters?.length ? letters : DEFAULT_LETTERS;
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (list.length < 2) return;
    const t = setInterval(() => setActive((i) => (i + 1) % list.length), 6500);
    return () => clearInterval(t);
  }, [list.length]);

  if (!list.length) return null;

  const current = list[active];
  const accentBg = ACCENT_BG[current.accent ?? "olive"] ?? colors.olive[700];

  return (
    <View style={styles.wrap}>
      <View style={styles.halftone} pointerEvents="none" />
      <View style={[styles.blob, styles.blobA]} pointerEvents="none" />
      <View style={[styles.blob, styles.blobB]} pointerEvents="none" />

      <View style={styles.inner}>
        {/* Pull quote */}
        <View style={styles.pullQuoteWrap}>
          <View style={styles.kickerRow}>
            <View style={styles.kickerRule} />
            <Label style={styles.kickerText}>{kicker}</Label>
          </View>
          <View style={styles.titleRow}>
            <Ionicons name="chatbox-ellipses-outline" size={28} color={colors.light.primary} style={styles.titleIcon} />
            <Display size="3xl" style={styles.title} numberOfLines={3}>
              {title}
            </Display>
          </View>
          {subtitle ? <Body size="sm" style={styles.subtitle}>{subtitle}</Body> : null}
          <View style={styles.counter}>
            <Display size="2xl" style={styles.counterBig}>
              {String(active + 1).padStart(2, "0")}
            </Display>
            <Display size="md" style={styles.counterSmall}>
              / {String(list.length).padStart(2, "0")}
            </Display>
            <Label style={styles.counterLabel}>Currently reading</Label>
          </View>
        </View>

        {/* Letter card */}
        <View style={styles.letterWrap}>
          <View style={styles.letterCard}>
            <View style={[styles.waxSeal, { backgroundColor: accentBg }]}>
              <Display italic size="md" style={styles.waxSealText}>
                L
              </Display>
            </View>

            <View style={styles.letterhead}>
              <Label style={styles.letterheadLeft}>From the parcel</Label>
              <Label style={styles.letterheadRight}>
                Letter № {String(active + 1).padStart(2, "0")}
              </Label>
            </View>

            <Display italic size="lg" style={styles.body} numberOfLines={6}>
              "{current.body}"
            </Display>

            <View style={styles.signatureRow}>
              <View>
                <Display italic size="lg" style={styles.signatureName}>
                  — {current.name}
                </Display>
                <Label style={styles.signaturePlace}>
                  <Ionicons name="location-outline" size={10} color={colors.light.mutedForeground} /> {current.place}
                </Label>
              </View>
              <View style={styles.signatureRight}>
                <Label style={styles.signatureReLabel}>Re:</Label>
                <Label style={styles.signatureRePiece}>{current.piece}</Label>
              </View>
            </View>
          </View>

          {/* Dots */}
          <View style={styles.dots}>
            {list.map((_, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => setActive(i)}
                style={[styles.dot, i === active ? styles.dotActive : styles.dotIdle]}
                accessibilityLabel={`Letter ${i + 1}`}
              />
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.olive[50],
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.light.border,
    overflow: "hidden",
    position: "relative",
  },
  halftone: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(168, 176, 107, 0.10)" },
  blob: { position: "absolute", borderRadius: 999 },
  blobA: { top: -60, left: -60, width: 240, height: 240, backgroundColor: "rgba(204, 204, 160, 0.40)" },
  blobB: { bottom: -80, right: -40, width: 260, height: 260, backgroundColor: "rgba(168, 176, 107, 0.30)" },
  inner: { paddingHorizontal: 20, paddingTop: spacing[10], paddingBottom: spacing[10], gap: spacing[8] },
  // Pull quote
  pullQuoteWrap: { gap: spacing[2] },
  kickerRow: { flexDirection: "row", alignItems: "center", gap: spacing[2], marginBottom: 4 },
  kickerRule: { width: 24, height: 1, backgroundColor: colors.light.primary },
  kickerText: { color: colors.light.primary },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  titleIcon: { marginTop: 4 },
  title: { color: colors.light.foreground, flex: 1, lineHeight: 32 },
  subtitle: { color: colors.light.mutedForeground, marginTop: spacing[2] },
  counter: { flexDirection: "row", alignItems: "flex-end", gap: 6, marginTop: spacing[4], paddingTop: spacing[4], borderTopWidth: 1, borderTopColor: colors.light.border },
  counterBig: { color: colors.light.primary, fontSize: 36, lineHeight: 38 },
  counterSmall: { color: colors.light.mutedForeground, fontSize: 18, lineHeight: 22, paddingBottom: 2 },
  counterLabel: { color: colors.light.mutedForeground, fontSize: 10, paddingBottom: 6, marginLeft: 4 },
  // Letter
  letterWrap: { gap: spacing[3] },
  letterCard: {
    backgroundColor: colors.paper.cream,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.light.border,
    padding: spacing[5],
    position: "relative",
    gap: spacing[4],
    minHeight: 280,
    ...shadows.editorial,
  },
  waxSeal: {
    position: "absolute",
    top: -16,
    right: -16,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: colors.paper.cream,
    ...shadows.glow,
  },
  waxSealText: { color: colors.paper.cream, fontSize: 18 },
  letterhead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: spacing[3], borderBottomWidth: 1, borderBottomColor: colors.light.border },
  letterheadLeft: { color: colors.light.mutedForeground },
  letterheadRight: { color: colors.light.primary },
  body: { color: colors.light.foreground, lineHeight: 22 },
  signatureRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", paddingTop: spacing[3], borderTopWidth: 1, borderTopColor: colors.light.border, borderStyle: "dashed" },
  signatureName: { color: colors.light.foreground, fontSize: 18 },
  signaturePlace: { color: colors.light.mutedForeground, flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  signatureRight: { alignItems: "flex-end" },
  signatureReLabel: { color: colors.light.mutedForeground, fontSize: 9 },
  signatureRePiece: { color: colors.light.foreground, fontSize: 10 },
  dots: { flexDirection: "row", gap: 4, alignSelf: "center" },
  dot: { height: 4, borderRadius: 2 },
  dotActive: { width: 28, backgroundColor: colors.light.primary },
  dotIdle: { width: 8, backgroundColor: colors.light.border },
});
