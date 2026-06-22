import React, { useEffect, useRef } from "react";
import { View, Animated, StyleSheet } from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { Display, Label, Body } from "@/components/ui/Typography";
import { colors, spacing } from "@/lib/theme/tokens";
import type { Tenet } from "@/lib/types";

const DEFAULT_TENETS: Tenet[] = [
  {
    id: "t1",
    n: "01",
    title: "Restraint",
    body: "We hold the line at a few pieces per drop. Nothing rolls over. Nothing waits for a sale.",
    tag: "Less, on purpose.",
    display_order: 1,
  },
  {
    id: "t2",
    n: "02",
    title: "Provenance",
    body: "Every garment names its atelier. Cloth, dye, and stitch traced to source — without the lecture.",
    tag: "Named, located, signed.",
    display_order: 2,
  },
  {
    id: "t3",
    n: "03",
    title: "Olive over loud",
    body: "A quiet palette built around dark olive green. Worn against ink and paper. Designed to age in.",
    tag: "Quiet, on purpose.",
    display_order: 3,
  },
  {
    id: "t4",
    n: "04",
    title: "Built by hand",
    body: "Hand-finished hems, signed labels, slow shipping. We trade speed for the kind of things you keep.",
    tag: "Slow, by hand.",
    display_order: 4,
  },
];

interface ManifestoProps {
  tenets?: Tenet[];
  kicker?: string;
  title?: string;
  subtitle?: string;
}

export function Manifesto({
  tenets = DEFAULT_TENETS,
  kicker = "Manifesto · 07",
  title = "What we believe, in writing.",
  subtitle = "Four tenets. Read once, lived daily. If you nod along, you're probably one of us.",
}: ManifestoProps) {
  const list = tenets?.length ? tenets : DEFAULT_TENETS;
  if (!list.length) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.inner}>
        <View style={styles.header}>
          <View>
            <View style={styles.kickerRow}>
              <View style={styles.kickerRule} />
              <Label style={styles.kickerText}>{kicker}</Label>
            </View>
            <Display size="3xl" style={styles.title} numberOfLines={2}>
              {title}
            </Display>
            {subtitle ? <Body size="sm" style={styles.subtitle}>{subtitle}</Body> : null}
          </View>
        </View>

        <View style={styles.list}>
          {list.map((t, i) => (
            <TenetRow key={t.id} tenet={t} index={i} total={list.length} />
          ))}
        </View>

        <View style={styles.footer}>
          <View style={styles.footerLeft}>
            <Ionicons name="arrow-forward" size={12} color={colors.light.primary} />
            <Label style={styles.footerLeftText}>Read the long form</Label>
          </View>
          <View style={styles.footerRule} />
        </View>
      </View>
    </View>
  );
}

function TenetRow({
  tenet,
  index,
  total,
}: {
  tenet: Tenet;
  index: number;
  total: number;
}) {
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 500,
      delay: index * 100,
      useNativeDriver: true,
    }).start();
  }, [fade, index]);

  return (
    <Animated.View style={[styles.tenet, { opacity: fade }]}>
      <View style={styles.tenetTop}>
        <Display size="4xl" style={styles.tenetNum}>
          {tenet.n}
        </Display>
        <View style={styles.tenetTopRight}>
          <View style={styles.tenetRule} />
          <Label style={styles.tenetCount}>
            {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </Label>
        </View>
      </View>
      <Display size="2xl" style={styles.tenetTitle}>
        {tenet.title}
      </Display>
      <Body size="sm" style={styles.tenetBody}>
        {tenet.body}
      </Body>
      <View style={styles.tenetTag}>
        <Ionicons name="arrow-forward" size={11} color={colors.light.primary} />
        <Label style={styles.tenetTagText}>{tenet.tag}</Label>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.paper.cream,
    paddingVertical: spacing[10],
  },
  inner: { paddingHorizontal: 20, gap: spacing[6] },
  header: { gap: spacing[2] },
  kickerRow: { flexDirection: "row", alignItems: "center", gap: spacing[2], marginBottom: 4 },
  kickerRule: { width: 24, height: 1, backgroundColor: colors.light.primary },
  kickerText: { color: colors.light.primary },
  title: { color: colors.light.foreground, lineHeight: 34 },
  subtitle: { color: colors.light.mutedForeground, marginTop: spacing[2] },
  list: { gap: 0 },
  tenet: {
    paddingTop: spacing[5],
    paddingBottom: spacing[5],
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
    gap: spacing[2],
  },
  tenetTop: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  tenetNum: { color: colors.light.primary, fontSize: 56, lineHeight: 60 },
  tenetTopRight: { flexDirection: "row", alignItems: "center", gap: 6, paddingBottom: 6 },
  tenetRule: { width: 24, height: 1, backgroundColor: colors.light.border },
  tenetCount: { color: colors.light.mutedForeground, fontSize: 10 },
  tenetTitle: { color: colors.light.foreground, fontSize: 26 },
  tenetBody: { color: colors.light.mutedForeground },
  tenetTag: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing[2] },
  tenetTagText: { color: colors.light.primary, fontStyle: "italic" },
  // Footer
  footer: { marginTop: spacing[4], gap: spacing[3] },
  footerLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  footerLeftText: { color: colors.light.foreground },
  footerRule: { width: "100%", height: 1, backgroundColor: colors.light.border },
});
