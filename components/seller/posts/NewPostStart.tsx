/**
 * First screen of "New look" — the creation canvas, in the Runway Studio theme.
 *
 * Studio-mode bar with a drafts pill, a serif title, format chips, a dark
 * chocolate canvas that takes the shape of the chosen format, a caption card
 * and a guidance card.
 * "Next" opens the library; "Save draft" creates an empty draft from the caption.
 */
import { useEffect, useState } from "react";
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  useWindowDimensions,
} from "react-native";
import Animated, { Easing, FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, type IonIconName } from "@/components/ui/Icon";
import { fontFamilies } from "@/lib/theme/fonts";
import { POST_LIMITS } from "@/lib/posts/limits";
import { sellerPostsApi } from "@/lib/posts/api";
import { KICKER, P, RADIUS, SHADOW } from "./palette";
import { SpringPress } from "./motion";

export type StartFormat = "poster" | "carousel" | "film";

const MODES: {
  key: StartFormat; label: string; pick: "images" | "video"; ratio: number; icon: IonIconName;
  format: string; title: string; sub: string; meta: string; tip: string;
}[] = [
  {
    key: "poster", label: "Poster", pick: "images", ratio: 5 / 4, icon: "image-outline", format: "4:5",
    title: "Bring your look in.", sub: "One photo from your library — the one you posted on Instagram works.",
    meta: "ONE IMAGE · JPG PNG HEIC", tip: "Tag the pieces in it next — tagged looks are the ones shoppers can buy from.",
  },
  {
    key: "carousel", label: "Carousel", pick: "images", ratio: 5 / 4, icon: "copy-outline", format: "4:5 · SWIPE",
    title: "Tell it in frames.", sub: "Two to ten photos. They swipe in the order you pick them.",
    meta: "2–10 IMAGES", tip: "Lead with the full outfit, then close-ups of fabric and fit.",
  },
  {
    key: "film", label: "Film", pick: "video", ratio: 16 / 9, icon: "film-outline", format: "9:16",
    title: "Roll the runway.", sub: "A vertical film, up to ninety seconds, sound on.",
    meta: "MP4 · MOV · ≤ 90 SEC", tip: "Films lead the Runway feed — the first two seconds decide the scroll.",
  },
];

const EASE = { duration: 340, easing: Easing.out(Easing.cubic) };
const PAGE = 16;
const display = fontFamilies.display.semibold;
const italic = fontFamilies.display.italic;
const mono = fontFamilies.mono.medium;
const monoBold = fontFamilies.mono.semibold;

export function NewPostStart({ onPick, onSaveDraft, busy, initialFormat, error, caption, onCaption }: {
  onPick: (pick: "images" | "video", format: StartFormat) => void;
  onSaveDraft: (format: StartFormat) => void;
  busy: boolean;
  initialFormat?: StartFormat;
  error?: string | null;
  caption: string;
  onCaption: (v: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [mode, setMode] = useState<StartFormat>(initialFormat ?? "poster");
  const [drafts, setDrafts] = useState(0);
  const m = MODES.find((x) => x.key === mode)!;

  useEffect(() => {
    let alive = true;
    sellerPostsApi.list({ limit: 30 }).then((d) => {
      if (!alive) return;
      setDrafts(d.items.filter((p) => p.status === "draft").length);
    }).catch(() => undefined);
    return () => { alive = false; };
  }, []);

  // Canvas: full width, height follows the format (film capped so the page still breathes).
  const canvasW = width - PAGE * 2;
  const heightFor = (k: StartFormat) => {
    const r = MODES.find((x) => x.key === k)!.ratio;
    return Math.min(canvasW * r, k === "film" ? 400 : 350);
  };
  const h = useSharedValue(heightFor(mode));
  useEffect(() => { h.value = withTiming(heightFor(mode), EASE); }, [mode, width]); // eslint-disable-line react-hooks/exhaustive-deps
  const canvas = useAnimatedStyle(() => ({ height: h.value }));

  const choose = () => { if (!busy) onPick(m.pick, mode); };
  const canDraft = !busy && caption.trim().length > 0;
  const goDrafts = () => router.push(`/(seller)/posts?tab=drafts&t=${Date.now()}`);
  // Tabs: router.back() pops to the previously focused tab (Dashboard), so go to Studio explicitly.
  const back = () => router.navigate("/(seller)/posts");

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <StatusBar style="dark" />

      {/* Studio bar */}
      <View style={[styles.top, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={back} style={styles.roundBtn} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8}>
          <Ionicons name="arrow-back" size={19} color={P.ink} />
        </Pressable>
        <View style={styles.modePill}>
          <View style={styles.modeDot} />
          <Text style={styles.modeText} numberOfLines={1}>Studio · New look</Text>
          <View style={styles.modeTag}><Text style={styles.modeTagText}>STEP 1/3</Text></View>
        </View>
        <SpringPress onPress={goDrafts} style={styles.draftsPill} accessibilityRole="button" accessibilityLabel={`Drafts, ${drafts}`}>
          <Ionicons name="layers-outline" size={16} color={P.ink} />
          {drafts > 0 ? (
            <View style={styles.draftsCount}><Text style={styles.draftsCountText}>{drafts > 29 ? "29+" : drafts}</Text></View>
          ) : null}
        </SpringPress>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: 6, paddingBottom: 24 }}>
        {/* Title */}
        <Animated.View entering={FadeInDown.duration(380)} style={styles.titleBlock}>
          <Text style={styles.kicker}>MAKE SOMETHING</Text>
          <Text style={styles.title}>New look</Text>
          <Text style={styles.sub}>Posters, carousels and films — every piece in them shoppable.</Text>
        </Animated.View>

        {/* Format tiles */}
        <Animated.View entering={FadeInDown.delay(60).duration(380)} style={styles.tiles}>
          {MODES.map((s) => {
            const on = s.key === mode;
            return (
              <Pressable key={s.key} onPress={() => setMode(s.key)}
                style={[styles.tile, on && styles.tileOn]}
                accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={s.label}>
                <Ionicons name={s.icon} size={15} color={on ? P.lime : P.ink} />
                <Text style={[styles.tileName, on && styles.tileNameOn]}>{s.label}</Text>
              </Pressable>
            );
          })}
        </Animated.View>

        {/* Canvas */}
        <Animated.View entering={FadeInDown.delay(120).duration(420)} style={styles.canvasWrap}>
          <SpringPress onPress={choose} disabled={busy} scaleTo={0.985} accessibilityRole="button" accessibilityLabel={`Choose ${m.label.toLowerCase()} from library`}>
            <Animated.View style={[styles.canvas, canvas]}>
              {busy ? (
                <ActivityIndicator color={P.ink} />
              ) : (
                <Animated.View key={mode} entering={FadeIn.duration(260)} style={styles.canvasInner}>
                  <View style={styles.plus}>
                    <Ionicons name={m.icon} size={30} color={P.ink} />
                  </View>
                  <Text style={styles.canvasTitle}>{m.title}</Text>
                  <Text style={styles.canvasSub}>{m.sub}</Text>
                  <Text style={styles.canvasMeta}>{m.meta}</Text>
                </Animated.View>
              )}
            </Animated.View>
          </SpringPress>
          {error ? <Text style={styles.error} numberOfLines={3}>{error}</Text> : null}
        </Animated.View>

        {/* Caption */}
        <Animated.View entering={FadeInDown.delay(240).duration(420)} style={styles.captionCard}>
          <View style={styles.captionHead}>
            <Text style={styles.kicker}>THE STORY</Text>
            <Text style={styles.captionCount}>{caption.length.toLocaleString()}/{POST_LIMITS.captionMax.toLocaleString()}</Text>
          </View>
          <TextInput
            value={caption}
            onChangeText={(v) => onCaption(v.slice(0, POST_LIMITS.captionMax))}
            placeholder="Write a caption, set the mood…"
            placeholderTextColor={P.mute}
            multiline
            style={styles.captionInput}
            maxLength={POST_LIMITS.captionMax}
            accessibilityLabel="Caption"
          />
        </Animated.View>

        {/* Guidance */}
        <Animated.View key={`tip-${mode}`} entering={FadeIn.duration(260)} style={styles.tip}>
          <View style={styles.tipIcon}><Ionicons name="bulb-outline" size={16} color={P.ink} /></View>
          <Text style={styles.tipText}>{m.tip}</Text>
        </Animated.View>
      </ScrollView>

      {/* Actions */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 12 }]}>
        <SpringPress onPress={() => canDraft && onSaveDraft(mode)} disabled={!canDraft}
          accessibilityRole="button" accessibilityLabel="Save draft" accessibilityState={{ disabled: !canDraft }}
          style={[styles.draftBtn, !canDraft && { opacity: 0.45 }]}>
          <Ionicons name="bookmark-outline" size={16} color={P.ink} />
          <Text style={styles.draftBtnText}>Save draft</Text>
        </SpringPress>
        <SpringPress onPress={choose} disabled={busy} accessibilityRole="button" accessibilityLabel="Next: choose media"
          style={[styles.nextBtn, busy && { opacity: 0.5 }]}>
          {busy ? <ActivityIndicator size="small" color={P.paper} /> : (
            <>
              <Text style={styles.nextText}>Next</Text>
              <Ionicons name="arrow-forward" size={18} color={P.paper} />
            </>
          )}
        </SpringPress>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: P.paper },
  kicker: { fontFamily: mono, ...KICKER, color: P.mute },

  top: { flexDirection: "row", alignItems: "center", paddingHorizontal: PAGE, paddingBottom: 10, gap: 8, backgroundColor: P.paper },
  roundBtn: {
    width: 42, height: 42, borderRadius: RADIUS.pill, alignItems: "center", justifyContent: "center",
    backgroundColor: P.card, borderWidth: 1, borderColor: P.border, ...SHADOW, shadowOpacity: 0.05,
  },
  modePill: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 7, height: 36, paddingLeft: 12, paddingRight: 4,
    borderRadius: RADIUS.pill, backgroundColor: P.card, borderWidth: 1, borderColor: P.border,
  },
  modeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: P.coral },
  modeText: { flex: 1, fontFamily: fontFamilies.sans.semibold, fontSize: 12.5, color: P.ink },
  modeTag: { height: 26, paddingHorizontal: 9, borderRadius: RADIUS.pill, backgroundColor: P.ink, justifyContent: "center" },
  modeTagText: { fontFamily: monoBold, fontSize: 9, letterSpacing: 1.2, color: P.lime },
  draftsPill: {
    flexDirection: "row", alignItems: "center", gap: 6, height: 42, minWidth: 42, paddingHorizontal: 12,
    borderRadius: RADIUS.pill, backgroundColor: P.card, borderWidth: 1, borderColor: P.border, justifyContent: "center",
  },
  draftsCount: { minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, backgroundColor: P.coral, alignItems: "center", justifyContent: "center" },
  draftsCountText: { fontFamily: monoBold, fontSize: 10.5, color: P.paper },

  titleBlock: { paddingHorizontal: PAGE + 2, gap: 4 },
  title: { fontFamily: display, fontSize: 38, lineHeight: 44, letterSpacing: -1.2, color: P.ink },
  sub: { fontFamily: fontFamilies.sans.regular, fontSize: 14.5, lineHeight: 21, color: P.body, maxWidth: 330 },

  tiles: { flexDirection: "row", gap: 8, paddingHorizontal: PAGE, marginTop: 16 },
  tile: {
    flex: 1, height: 44, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
    backgroundColor: P.card, borderWidth: 1, borderColor: P.borderStrong,
  },
  tileOn: { backgroundColor: P.ink, borderColor: P.ink },
  tileName: { fontFamily: fontFamilies.sans.bold, fontSize: 14, color: P.ink },
  tileNameOn: { color: P.paper },

  canvasWrap: { paddingHorizontal: PAGE, marginTop: 16 },
  canvas: {
    height: 300, borderRadius: 28, backgroundColor: P.card, alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderStyle: "dashed", borderColor: P.dashed,
  },
  canvasInner: { alignItems: "center", paddingHorizontal: 28, gap: 8 },
  canvasTitle: { fontFamily: italic, fontSize: 26, lineHeight: 31, letterSpacing: -0.6, color: P.ink, textAlign: "center", marginTop: 14 },
  canvasSub: { fontFamily: fontFamilies.sans.regular, fontSize: 14, lineHeight: 20, color: P.body, textAlign: "center", maxWidth: 280 },
  canvasMeta: { fontFamily: mono, fontSize: 10, letterSpacing: 1.6, color: P.mute, marginTop: 4 },
  plus: {
    width: 84, height: 84, borderRadius: 30, backgroundColor: P.lime, alignItems: "center", justifyContent: "center",
    transform: [{ rotate: "-6deg" }],
  },
  error: {
    fontFamily: fontFamilies.sans.medium, fontSize: 13, lineHeight: 18, color: P.terracotta, textAlign: "center",
    paddingHorizontal: 8, marginTop: 10,
  },

  captionCard: {
    marginHorizontal: PAGE, marginTop: 24, padding: 16, borderRadius: 22,
    backgroundColor: P.card, borderWidth: 1, borderColor: P.border,
  },
  captionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  captionInput: {
    minHeight: 64, maxHeight: 150, fontFamily: italic, fontSize: 18, lineHeight: 25, color: P.ink,
    paddingTop: 2, paddingBottom: 0, textAlignVertical: "top",
  },
  captionCount: { fontFamily: mono, fontSize: 10, letterSpacing: 0.8, color: P.mute },

  tip: {
    flexDirection: "row", alignItems: "center", gap: 12, marginHorizontal: PAGE, marginTop: 12, padding: 14,
    borderRadius: 20, backgroundColor: P.warm, borderWidth: 1, borderColor: P.border,
  },
  tipIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: P.lime, alignItems: "center", justifyContent: "center" },
  tipText: { flex: 1, fontFamily: fontFamilies.sans.medium, fontSize: 13, lineHeight: 18, color: P.body },

  bottom: {
    flexDirection: "row", gap: 10, paddingHorizontal: PAGE, paddingTop: 12, backgroundColor: P.paper,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: P.border,
  },
  draftBtn: {
    flex: 1, height: 52, borderRadius: 15, backgroundColor: P.card, borderWidth: 1.5, borderColor: P.ink,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
  },
  draftBtnText: { fontFamily: fontFamilies.sans.bold, fontSize: 15, color: P.ink },
  nextBtn: {
    flex: 1.4, height: 52, borderRadius: 15, backgroundColor: P.ink, flexDirection: "row",
    alignItems: "center", justifyContent: "center", gap: 10,
    shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 4,
  },
  nextText: { fontFamily: fontFamilies.sans.bold, fontSize: 16, color: P.paper },
});
