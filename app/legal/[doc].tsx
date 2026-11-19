import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Linking,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { colors } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import {
  formatLegalDate,
  LEGAL_ADDRESS,
  LEGAL_DOCS,
  LEGAL_ENTITY,
  SITE_ORIGIN,
  type LegalBlock,
} from "@/lib/legal/documents";

const C = colors.light;
const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Native Privacy Policy / Terms screen. Public route (works signed-out) so it
 * can be reached from onboarding, register and settings. Content is bundled,
 * so it renders offline and is identical to vestara.lk/legal/*.
 *
 *   router.push("/legal/privacy")
 *   router.push({ pathname: "/legal/[doc]", params: { doc: "privacy", section: "delete-account" } })
 */
export default function LegalScreen() {
  const { doc: slug, section } = useLocalSearchParams<{ doc: string; section?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const doc = LEGAL_DOCS[slug === "terms" ? "terms" : "privacy"];
  const other = doc.slug === "privacy" ? LEGAL_DOCS.terms : LEGAL_DOCS.privacy;

  const scrollRef = useRef<ScrollView>(null);
  const offsets = useRef<Record<string, number>>({});
  const bodyTop = useRef(0);
  const progress = useRef(new Animated.Value(0)).current;
  const [active, setActive] = useState(doc.sections[0]?.id);
  const [didDeepScroll, setDidDeepScroll] = useState(false);

  const scrollTo = useCallback((id: string, animated = true) => {
    const y = offsets.current[id];
    if (y == null) return;
    scrollRef.current?.scrollTo({ y: Math.max(0, bodyTop.current + y - 72), animated });
  }, []);

  // Deep link straight to a section (e.g. ?section=delete-account).
  useEffect(() => {
    if (!section || didDeepScroll) return;
    const t = setTimeout(() => {
      scrollTo(section, false);
      setDidDeepScroll(true);
    }, 250);
    return () => clearTimeout(t);
  }, [section, didDeepScroll, scrollTo]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const max = contentSize.height - layoutMeasurement.height;
    progress.setValue(max > 0 ? Math.min(1, Math.max(0, contentOffset.y / max)) : 0);
    const line = contentOffset.y + 140 - bodyTop.current;
    let current = doc.sections[0]?.id;
    for (const s of doc.sections) {
      const y = offsets.current[s.id];
      if (y != null && y <= line) current = s.id;
    }
    if (current !== active) setActive(current);
  };

  const url = `${SITE_ORIGIN}/legal/${doc.slug}`;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false, title: doc.kicker }} />

      {/* Top bar */}
      <View style={styles.bar}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(main)"))}
          hitSlop={10}
          style={styles.iconBtn}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={20} color={C.foreground} />
        </Pressable>
        <Text style={styles.barTitle} numberOfLines={1}>
          {doc.kicker}
        </Text>
        <Pressable
          onPress={() => Share.share({ message: `${doc.kicker} — VESTARA\n${url}`, url })}
          hitSlop={10}
          style={styles.iconBtn}
          accessibilityRole="button"
          accessibilityLabel="Share"
        >
          <Ionicons name="share-outline" size={19} color={C.foreground} />
        </Pressable>
      </View>
      <View style={styles.progressTrack}>
        <Animated.View
          style={[
            styles.progressFill,
            { width: progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) },
          ]}
        />
      </View>

      <ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        scrollEventThrottle={32}
        contentContainerStyle={{ paddingBottom: insets.bottom + 48 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.kickerRow}>
            <View style={styles.kickerLine} />
            <Text style={styles.kicker}>{doc.kicker.toUpperCase()}</Text>
          </View>
          <Text style={styles.title} accessibilityRole="header">
            {doc.title}
          </Text>
          <Text style={styles.intro}>{doc.intro}</Text>
          <View style={styles.metaRow}>
            <View style={styles.metaChip}>
              <View style={styles.dot} />
              <Text style={styles.metaText}>Updated {formatLegalDate(doc.updated)}</Text>
            </View>
            <View style={styles.metaChip}>
              <Ionicons name="time-outline" size={12} color={C.mutedForeground} />
              <Text style={styles.metaText}>{doc.readMinutes} min read</Text>
            </View>
          </View>
        </View>

        {/* At a glance */}
        <Text style={[styles.label, { marginHorizontal: 20 }]}>AT A GLANCE</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.glanceRow}
          decelerationRate="fast"
          snapToInterval={232}
        >
          {doc.highlights.map((h, i) => (
            <View key={h.title} style={styles.glanceCard}>
              <Text style={styles.glanceNum}>{pad(i + 1)}</Text>
              <Text style={styles.glanceTitle}>{h.title}</Text>
              <Text style={styles.glanceText}>{h.text}</Text>
            </View>
          ))}
        </ScrollView>

        {/* Contents */}
        <View style={styles.toc}>
          <Text style={styles.label}>CONTENTS · {doc.sections.length} SECTIONS</Text>
          {doc.sections.map((s, i) => {
            const on = active === s.id;
            return (
              <Pressable
                key={s.id}
                onPress={() => scrollTo(s.id)}
                style={({ pressed }) => [styles.tocRow, pressed && { opacity: 0.6 }]}
                accessibilityRole="link"
              >
                <Text style={[styles.tocNum, on && { color: C.primary }]}>{pad(i + 1)}</Text>
                <Text style={[styles.tocText, on && { color: C.foreground, fontFamily: fontFamilies.sans.semibold }]}>
                  {s.title}
                </Text>
                <Ionicons name="arrow-down" size={13} color={C.mutedForeground} />
              </Pressable>
            );
          })}
        </View>

        {/* Sections */}
        <View onLayout={(e) => (bodyTop.current = e.nativeEvent.layout.y)}>
          {doc.sections.map((s, i) => (
            <View
              key={s.id}
              style={styles.section}
              onLayout={(e) => {
                offsets.current[s.id] = e.nativeEvent.layout.y;
              }}
            >
              <View style={styles.sectionHead}>
                <Text style={styles.sectionNum}>{pad(i + 1)}</Text>
                <Text style={styles.sectionTitle} accessibilityRole="header">
                  {s.title}
                </Text>
              </View>
              <View style={styles.inShort}>
                <Text style={styles.inShortLabel}>IN SHORT</Text>
                <Text style={styles.inShortText}>{s.inShort}</Text>
              </View>
              <View style={{ gap: 14 }}>
                {s.blocks.map((b, bi) => (
                  <Block key={bi} block={b} />
                ))}
              </View>
            </View>
          ))}
        </View>

        {/* Contact */}
        <View style={styles.contact}>
          <Text style={styles.contactLabel}>STILL HAVE QUESTIONS?</Text>
          <Text style={styles.contactTitle}>Write to us — a real person reads every message.</Text>
          <Pressable
            onPress={() => Linking.openURL(`mailto:${doc.contactEmail}`)}
            style={({ pressed }) => [styles.contactBtn, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
          >
            <Ionicons name="mail-outline" size={16} color={C.foreground} />
            <Text style={styles.contactBtnText}>{doc.contactEmail}</Text>
          </Pressable>
          <Text style={styles.contactFoot}>
            {LEGAL_ENTITY} · {LEGAL_ADDRESS}
          </Text>
        </View>

        {/* Footer links */}
        <View style={styles.footer}>
          <Pressable
            onPress={() => router.replace({ pathname: "/legal/[doc]", params: { doc: other.slug } })}
            style={({ pressed }) => [styles.footRow, pressed && { opacity: 0.6 }]}
            accessibilityRole="link"
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>READ NEXT</Text>
              <Text style={styles.footTitle}>{other.kicker}</Text>
            </View>
            <Ionicons name="arrow-forward" size={18} color={C.foreground} />
          </Pressable>
          <Pressable
            onPress={() => WebBrowser.openBrowserAsync(url).catch(() => Linking.openURL(url))}
            style={({ pressed }) => [styles.footRow, pressed && { opacity: 0.6 }]}
            accessibilityRole="link"
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>ON THE WEB</Text>
              <Text style={styles.footSmall}>{url.replace("https://", "")}</Text>
            </View>
            <Ionicons name="open-outline" size={17} color={C.foreground} />
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function Block({ block }: { block: LegalBlock }) {
  switch (block.type) {
    case "p":
      return <Text style={styles.p}>{block.text}</Text>;
    case "list":
      return (
        <View style={{ gap: 12 }}>
          {block.items.map((it, i) => (
            <View key={i} style={styles.li}>
              <View style={styles.bullet} />
              <Text style={[styles.p, { flex: 1 }]}>
                {it.term ? <Text style={styles.term}>{it.term}. </Text> : null}
                {it.text}
              </Text>
            </View>
          ))}
        </View>
      );
    case "callout":
      return (
        <View style={styles.callout}>
          <Text style={styles.calloutTitle}>{block.title}</Text>
          <Text style={[styles.p, { fontSize: 14 }]}>{block.text}</Text>
        </View>
      );
    case "table":
      return (
        <View style={styles.table}>
          {block.rows.map((r, i) => (
            <View key={r[0]} style={[styles.tableRow, i > 0 && styles.tableDivider]}>
              <Text style={styles.tableKey}>{r[0]}</Text>
              <Text style={[styles.p, { fontSize: 14 }]}>{r[1]}</Text>
              <Text style={styles.tableMeta}>
                {block.head[2].toUpperCase()}: {r[2]}
              </Text>
            </View>
          ))}
        </View>
      );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  bar: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 8,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
  },
  barTitle: {
    flex: 1,
    textAlign: "center",
    fontFamily: fontFamilies.mono.medium,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: C.foreground,
  },
  progressTrack: { height: 2, backgroundColor: C.border, overflow: "hidden" },
  progressFill: {
    height: 2,
    backgroundColor: C.primary,
  },

  hero: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 28 },
  kickerRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  kickerLine: { width: 24, height: 1, backgroundColor: C.primary },
  kicker: { fontFamily: fontFamilies.mono.medium, fontSize: 11, letterSpacing: 2.4, color: C.primary },
  title: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 44,
    lineHeight: 46,
    letterSpacing: -1.4,
    color: C.foreground,
  },
  intro: {
    marginTop: 16,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 15,
    lineHeight: 23,
    color: C.mutedForeground,
  },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 20 },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: C.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#2f9e5b" },
  metaText: { fontFamily: fontFamilies.mono.regular, fontSize: 11, color: C.mutedForeground },

  label: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 10,
    letterSpacing: 2,
    color: C.mutedForeground,
    marginBottom: 10,
  },
  glanceRow: { paddingHorizontal: 20, gap: 12, paddingBottom: 8 },
  glanceCard: {
    width: 220,
    padding: 18,
    borderRadius: 20,
    backgroundColor: C.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
  },
  glanceNum: { fontFamily: fontFamilies.mono.medium, fontSize: 11, color: C.primary },
  glanceTitle: {
    marginTop: 22,
    fontFamily: fontFamilies.display.semibold,
    fontSize: 18,
    lineHeight: 22,
    color: C.foreground,
  },
  glanceText: {
    marginTop: 6,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    lineHeight: 19,
    color: C.mutedForeground,
  },

  toc: {
    margin: 20,
    marginTop: 28,
    padding: 18,
    paddingBottom: 8,
    borderRadius: 20,
    backgroundColor: C.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
  },
  tocRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.border,
  },
  tocNum: { fontFamily: fontFamilies.mono.regular, fontSize: 11, color: C.mutedForeground, width: 20 },
  tocText: { flex: 1, fontFamily: fontFamilies.sans.medium, fontSize: 14, color: C.mutedForeground },

  section: {
    marginHorizontal: 20,
    paddingVertical: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.border,
  },
  sectionHead: { flexDirection: "row", alignItems: "baseline", gap: 12 },
  sectionNum: { fontFamily: fontFamilies.mono.medium, fontSize: 13, color: C.primary },
  sectionTitle: {
    flex: 1,
    fontFamily: fontFamilies.display.regular,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.6,
    color: C.foreground,
  },
  inShort: {
    marginTop: 16,
    marginBottom: 18,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "rgba(83,94,44,0.08)",
  },
  inShortLabel: { fontFamily: fontFamilies.mono.medium, fontSize: 10, letterSpacing: 2, color: C.primary },
  inShortText: {
    marginTop: 6,
    fontFamily: fontFamilies.sans.medium,
    fontSize: 14,
    lineHeight: 20,
    color: C.foreground,
  },
  p: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 15,
    lineHeight: 24,
    color: "#3b3d2e",
  },
  term: { fontFamily: fontFamilies.sans.semibold, color: C.foreground },
  li: { flexDirection: "row", gap: 12 },
  bullet: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.primary, marginTop: 10 },
  callout: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: C.muted,
    gap: 6,
  },
  calloutTitle: { fontFamily: fontFamilies.display.semibold, fontSize: 17, color: C.foreground },
  table: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    backgroundColor: C.card,
    overflow: "hidden",
  },
  tableRow: { padding: 14, gap: 4 },
  tableDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  tableKey: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: C.foreground },
  tableMeta: {
    marginTop: 4,
    fontFamily: fontFamilies.mono.regular,
    fontSize: 10,
    letterSpacing: 1,
    color: C.mutedForeground,
  },

  contact: {
    margin: 20,
    marginTop: 12,
    padding: 24,
    borderRadius: 24,
    backgroundColor: C.foreground,
  },
  contactLabel: { fontFamily: fontFamilies.mono.medium, fontSize: 10, letterSpacing: 2, color: "rgba(245,244,239,0.6)" },
  contactTitle: {
    marginTop: 12,
    fontFamily: fontFamilies.display.regular,
    fontSize: 26,
    lineHeight: 30,
    color: C.background,
  },
  contactBtn: {
    marginTop: 20,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 999,
    backgroundColor: C.background,
  },
  contactBtnText: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: C.foreground },
  contactFoot: {
    marginTop: 20,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: "rgba(245,244,239,0.55)",
  },

  footer: { marginHorizontal: 20, marginTop: 8 },
  footRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.border,
  },
  footTitle: { fontFamily: fontFamilies.display.regular, fontSize: 22, color: C.foreground, marginTop: -2 },
  footSmall: { fontFamily: fontFamilies.mono.regular, fontSize: 12, color: C.foreground },
});
