/**
 * New post / reel upload — an Instagram-style, light, three-step flow.
 *
 *   1. Pick     "New reel" / "New post": camera + library tiles, drafts grid,
 *               POST | REEL switch, "Select" for multi-image carousels.
 *   2. Preview  the picked media full-size while it uploads in the background;
 *               tool row: Products, Pin, Add, Sound. "Next →".
 *   3. Details  cover + caption ("Write a caption and add hashtags…"), chips,
 *               settings rows, Save draft | Share. Share opens the
 *               "About Runway" sheet the first time.
 *
 * The draft is created as soon as media is picked so uploads start straight
 * away. Editing an existing post still uses PostComposer.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator, BackHandler, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput,
  View, useWindowDimensions, type NativeScrollEvent, type StyleProp, type ViewStyle, type NativeSyntheticEvent,
} from "react-native";
import Animated, { Easing, FadeIn, FadeInDown, FadeInUp, SlideInDown, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useVideoPlayer, VideoView } from "expo-video";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, type IonIconName } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { themedAlert } from "@/lib/themed-alert";
import { formatPrice } from "@/lib/utils";
import { fontFamilies } from "@/lib/theme/fonts";
import { POST_LIMITS, type PostKind } from "@/lib/posts/limits";
import { sellerPostsApi } from "@/lib/posts/api";
import {
  aspectFor, capturePostMedia, pickPostImages, pickPostVideo, uploadPostMedia, validatePicked, type PickedMedia,
} from "@/lib/posts/upload";
import type { SellerPostDetail, SellerPostListItem } from "@/lib/posts/types";
import { TagPickerSheet, type PickedProduct } from "./TagPickerSheet";
import { SpringPress } from "./motion";

/* ── light theme ─────────────────────────────────────────────────────────── */

const C = {
  bg: "#ffffff",
  surface: "#f4f4f5",
  surface2: "#ebebee",
  ink: "#111114",
  body: "#45454c",
  mute: "#8a8a92",
  faint: "#c7c7cc",
  line: "rgba(17,17,20,0.08)",
  accent: "#111114",
  danger: "#d64545",
  success: "#2f8f5b",
} as const;

const sans = fontFamilies.sans;
const PAGE = 16;

type Mode = "post" | "reel";
type Step = "pick" | "preview" | "details";

interface Item {
  key: string;
  picked: PickedMedia;
  progress: number;
  state: "waiting" | "uploading" | "done" | "error";
  mediaId?: string;
  error?: string;
}

const SCHEDULES = [
  { key: "now", label: "Now" },
  { key: "tonight", label: "Tonight, 7 PM" },
  { key: "tomorrow_am", label: "Tomorrow, 9 AM" },
  { key: "tomorrow_pm", label: "Tomorrow, 7 PM" },
] as const;
type ScheduleKey = (typeof SCHEDULES)[number]["key"];

const ENDS = [
  { key: "never", label: "Never", days: 0 },
  { key: "3d", label: "After 3 days", days: 3 },
  { key: "7d", label: "After 7 days", days: 7 },
  { key: "30d", label: "After 30 days", days: 30 },
] as const;
type EndKey = (typeof ENDS)[number]["key"];

function scheduleToIso(k: ScheduleKey): string | null {
  const d = new Date();
  if (k === "now") return null;
  if (k === "tonight") d.setHours(19, 0, 0, 0);
  if (k === "tomorrow_am") { d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); }
  if (k === "tomorrow_pm") { d.setDate(d.getDate() + 1); d.setHours(19, 0, 0, 0); }
  return d.getTime() > Date.now() ? d.toISOString() : null;
}

function endToIso(k: EndKey, from: string | null): string | null {
  const e = ENDS.find((x) => x.key === k)!;
  if (!e.days) return null;
  const base = from ? new Date(from) : new Date();
  return new Date(base.getTime() + e.days * 86_400_000).toISOString();
}

const fmtDuration = (ms: number | null | undefined) => {
  if (!ms) return "";
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

const ABOUT_SEEN_KEY = "luxe-posts-about-seen-v1";

export function UploadFlow({ format, autoPick }: {
  format?: "poster" | "carousel" | "film"; autoPick?: "video" | "images";
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("pick");
  const [mode, setMode] = useState<Mode>(format === "film" || autoPick === "video" ? "reel" : "post");
  const [multi, setMulti] = useState(format === "carousel");
  const [items, setItems] = useState<Item[]>([]);
  const [post, setPost] = useState<SellerPostDetail | null>(null);
  const [caption, setCaption] = useState("");
  const [removed, setRemoved] = useState<string[]>([]);
  const [tags, setTags] = useState<PickedProduct[]>([]);
  const [suggestions, setSuggestions] = useState<{ product_id: string; score: number }[]>([]);
  const [onProductPages, setOnProductPages] = useState(true);
  const [schedule, setSchedule] = useState<ScheduleKey>("now");
  const [ends, setEnds] = useState<EndKey>("never");
  const [tagSheet, setTagSheet] = useState(false);
  const [hotspotFor, setHotspotFor] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "pick" | "create" | "save" | "publish">(null);
  const [error, setError] = useState<string | null>(null);
  const [about, setAbout] = useState(false);
  const [optionSheet, setOptionSheet] = useState<null | "schedule" | "ends">(null);
  const [drafts, setDrafts] = useState<SellerPostListItem[]>([]);
  const [slide, setSlide] = useState(0);
  const [muted, setMuted] = useState(false);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  /* drafts for the pick grid */
  useEffect(() => {
    let alive = true;
    sellerPostsApi.list({ status: "draft", limit: 30 })
      .then((d) => { if (alive) setDrafts(d.items); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, []);

  /* opened from the Runway "Create" sheet: straight to the library once */
  const autoPicked = useRef(false);
  useEffect(() => {
    if (!autoPick || autoPicked.current) return;
    autoPicked.current = true;
    const t = setTimeout(() => { void pick("library"); }, 350);
    return () => clearTimeout(t);
  }, [autoPick]); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(async (id: string) => {
    const fresh = await sellerPostsApi.get(id);
    if (!mounted.current) return fresh;
    setPost(fresh);
    if (fresh.moderation?.suggestions) setSuggestions(fresh.moderation.suggestions);
    return fresh;
  }, []);

  /* poll for AI product suggestions once media is in */
  const allUploaded = items.length > 0 && items.every((i) => i.state === "done");
  useEffect(() => {
    if (!post || !allUploaded || post.moderation?.suggestions) return;
    let n = 0;
    const t = setInterval(async () => {
      n++;
      const fresh = await refresh(post.id).catch(() => null);
      if (!fresh || fresh.moderation?.suggestions || n > 40) clearInterval(t);
    }, 3000);
    return () => clearInterval(t);
  }, [post?.id, allUploaded, post?.moderation?.suggestions, refresh]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── uploads ── */

  async function uploadOne(postId: string, item: Item) {
    setItems((l) => l.map((x) => (x.key === item.key ? { ...x, state: "uploading", progress: 0, error: undefined } : x)));
    try {
      const media = await uploadPostMedia(postId, item.picked, (f) => {
        if (mounted.current) setItems((l) => l.map((x) => (x.key === item.key ? { ...x, progress: f } : x)));
      });
      if (mounted.current) setItems((l) => l.map((x) => (x.key === item.key ? { ...x, state: "done", progress: 1, mediaId: media.id } : x)));
    } catch (e) {
      if (mounted.current) setItems((l) => l.map((x) => (x.key === item.key ? { ...x, state: "error", error: (e as Error).message } : x)));
    }
  }

  async function startUploads(list: Item[], existing: SellerPostDetail | null) {
    let current = existing;
    try {
      if (!current) {
        const kind: PostKind = mode === "reel" ? "reel" : multi ? "carousel" : "poster";
        setBusy("create");
        const created = await sellerPostsApi.create({
          kind, aspect: aspectFor(kind, list[0].picked), placements: ["store", "product"],
        });
        current = { ...created, media: [], tags: [] };
        if (mounted.current) setPost(current);
        setBusy(null);
      }
      for (const it of list) await uploadOne(current.id, it);
      if (mounted.current) await refresh(current.id).catch(() => undefined);
    } catch (e) {
      setBusy(null);
      if (mounted.current) {
        setError((e as Error).message);
        setItems((l) => l.map((x) => (x.state === "waiting" ? { ...x, state: "error", error: (e as Error).message } : x)));
      }
    }
  }

  async function pick(source: "library" | "camera", append = false) {
    if (busy) return;
    setError(null);
    setBusy("pick");
    try {
      let picked: PickedMedia[] = [];
      if (mode === "reel") {
        const v = source === "camera" ? await capturePostMedia("video") : await pickPostVideo();
        if (v) picked = [v];
      } else if (source === "camera") {
        const p = await capturePostMedia("image");
        if (p) picked = [p];
      } else {
        const room = POST_LIMITS.mediaMax - (append ? items.length : 0);
        picked = await pickPostImages(multi ? room : 1);
      }
      setBusy(null);
      if (!picked.length) return;
      for (const m of picked) {
        const problem = validatePicked(m);
        if (problem) { setError(problem); return; }
      }
      const fresh: Item[] = picked.map((p, i) => ({ key: `${Date.now()}-${i}`, picked: p, progress: 0, state: "waiting" }));
      setItems((l) => (append ? [...l, ...fresh] : fresh));
      if (!append) { setSlide(0); setStep("preview"); }
      void startUploads(fresh, append ? post : null);
    } catch (e) {
      setBusy(null);
      setError((e as Error).message);
    }
  }

  function retry(item: Item) {
    if (post) void uploadOne(post.id, item).then(() => post && refresh(post.id).catch(() => undefined));
    else void startUploads(items, null);
  }

  async function removeItem(item: Item) {
    if (post && item.mediaId) {
      try { await sellerPostsApi.removeMedia(post.id, item.mediaId); } catch (e) { toast.error((e as Error).message); return; }
      setTags((t) => t.map((x) => (x.media_id === item.mediaId ? { ...x, media_id: null, x: null, y: null } : x)));
    }
    const left = items.filter((x) => x.key !== item.key);
    setItems(left);
    setSlide((s) => Math.max(0, Math.min(s, left.length - 1)));
    if (!left.length) void discard(true);
  }

  /** Throw the draft away and go back to the picker. */
  async function discard(silent = false) {
    const id = post?.id;
    setPost(null); setItems([]); setTags([]); setSuggestions([]); setCaption(""); setRemoved([]);
    setHotspotFor(null); setError(null); setStep("pick");
    if (id) {
      try { await sellerPostsApi.remove(id); } catch { /* best effort */ }
      setDrafts((d) => d.filter((x) => x.id !== id));
    }
    if (!silent) toast.success("Discarded");
  }

  function leavePreview() {
    if (!post && !items.length) { setStep("pick"); return; }
    themedAlert("Discard this " + (mode === "reel" ? "reel" : "post") + "?", "If you go back now, you'll lose what you picked.", [
      { text: "Keep editing", style: "cancel" },
      { text: "Save draft", onPress: () => void onSaveDraft() },
      { text: "Discard", style: "destructive", onPress: () => void discard() },
    ]);
  }

  /* Android back walks the steps */
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (about) { setAbout(false); return true; }
      if (optionSheet) { setOptionSheet(null); return true; }
      if (step === "details") { setStep("preview"); return true; }
      if (step === "preview") { leavePreview(); return true; }
      return false;
    });
    return () => sub.remove();
  }); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── save / share ── */

  async function saveAll() {
    if (!post) return;
    const publishAt = scheduleToIso(schedule);
    await sellerPostsApi.update(post.id, {
      caption: caption.trim() || null,
      placements: onProductPages ? ["store", "product"] : ["store"],
      publish_at: publishAt,
      expires_at: endToIso(ends, publishAt),
    });
    await sellerPostsApi.setTags(post.id, tags.map((t) => ({
      product_id: t.id, media_id: t.media_id ?? null, x: t.x ?? null, y: t.y ?? null, source: t.source,
    })));
  }

  async function onSaveDraft() {
    if (!post) return;
    setBusy("save");
    setError(null);
    try {
      await saveAll();
      toast.success("Draft saved");
      router.replace(`/(seller)/posts?tab=drafts&t=${Date.now()}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      if (mounted.current) setBusy(null);
    }
  }

  async function share() {
    if (!post) return;
    setAbout(false);
    setBusy("publish");
    setError(null);
    try {
      await saveAll();
      await sellerPostsApi.submit(post.id);
      toast.success(schedule === "now" ? "Shared — usually live within a minute" : "Scheduled");
      router.replace(`/(seller)/posts?t=${Date.now()}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      if (mounted.current) setBusy(null);
    }
  }

  async function onShare() {
    let seen = false;
    try { seen = (await AsyncStorage.getItem(ABOUT_SEEN_KEY)) === "1"; } catch { /* ignore */ }
    if (seen) { void share(); return; }
    setAbout(true);
  }

  async function confirmAbout() {
    try { await AsyncStorage.setItem(ABOUT_SEEN_KEY, "1"); } catch { /* ignore */ }
    void share();
  }

  async function tidyCaption() {
    if (!caption.trim()) return;
    try {
      const r = await sellerPostsApi.cleanCaption(caption);
      setCaption(r.text);
      setRemoved(r.removed);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  /* ── derived ── */

  const kind: PostKind = post?.kind ?? (mode === "reel" ? "reel" : multi ? "carousel" : "poster");
  const noun = kind === "reel" ? "reel" : "post";
  const uploading = items.some((i) => i.state === "uploading" || i.state === "waiting");
  const failed = items.some((i) => i.state === "error");
  const overall = items.length ? items.reduce((s, i) => s + (i.state === "done" ? 1 : i.progress), 0) / items.length : 0;
  const blocker = !post ? (busy === "create" ? "Starting your draft…" : "Add media first.")
    : uploading ? "Wait for the upload to finish."
    : failed ? "Retry or remove the item that failed."
    : kind === "carousel" && items.length < POST_LIMITS.carouselMin ? "A carousel needs at least 2 photos."
    : tags.length === 0 ? "Tag at least one product."
    : null;
  const hotspotName = hotspotFor ? tags.find((t) => t.id === hotspotFor)?.name : null;
  const hasImages = items.some((i) => i.picked.kind === "image");
  const kindDrafts = useMemo(
    () => drafts.filter((d) => (mode === "reel" ? d.kind === "reel" : d.kind !== "reel")),
    [drafts, mode],
  );

  /* ═════════════════════════════ STEP 1 — PICK ═════════════════════════════ */

  if (step === "pick") {
    const cols = 3;
    const gap = 3;
    const tileW = (width - gap * (cols - 1)) / cols;
    const tileH = mode === "reel" ? tileW * 1.6 : tileW * 1.25;
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <StatusBar style="dark" />
        <View style={styles.bar}>
          <IconBtn icon="close" label="Close" onPress={() => router.navigate("/(seller)/posts")} />
          <Text style={styles.barTitle}>{mode === "reel" ? "New reel" : "New post"}</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.chipsRow}>
          <Chip icon="layers-outline" label={`Drafts${drafts.length ? ` · ${drafts.length}` : ""}`}
            onPress={() => router.push(`/(seller)/posts?tab=drafts&t=${Date.now()}`)} />
          <Chip icon="camera-outline" label={mode === "reel" ? "Record" : "Camera"} onPress={() => void pick("camera")} />
        </View>

        <View style={styles.recentsRow}>
          <Text style={styles.recents}>Start a {mode === "reel" ? "reel" : "post"}</Text>
          {mode === "post" ? (
            <Pressable onPress={() => setMulti((v) => !v)} accessibilityRole="switch" accessibilityState={{ checked: multi }}
              style={[styles.selectBtn, multi && styles.selectBtnOn]} hitSlop={6}>
              <Ionicons name="copy-outline" size={13} color={multi ? "#fff" : C.ink} />
              <Text style={[styles.selectText, multi && { color: "#fff" }]}>{multi ? "Multiple" : "Select"}</Text>
            </Pressable>
          ) : null}
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 110 }} showsVerticalScrollIndicator={false}>
          <View style={[styles.grid, { gap }]}>
            <SpringPress onPress={() => void pick("camera")} scaleTo={0.96} accessibilityRole="button"
              accessibilityLabel={mode === "reel" ? "Record a reel" : "Take a photo"}
              style={[styles.tile, styles.tileAction, { width: tileW, height: tileH }]}>
              <View style={styles.tileIcon}><Ionicons name={mode === "reel" ? "videocam-outline" : "camera-outline"} size={24} color={C.ink} /></View>
              <Text style={styles.tileLabel}>{mode === "reel" ? "Record" : "Camera"}</Text>
            </SpringPress>
            <SpringPress onPress={() => void pick("library")} scaleTo={0.96} accessibilityRole="button"
              accessibilityLabel={mode === "reel" ? "Choose a video" : multi ? "Choose photos" : "Choose a photo"}
              style={[styles.tile, styles.tileLibrary, { width: tileW, height: tileH }]}>
              {busy === "pick" ? <ActivityIndicator color="#fff" /> : (
                <>
                  <View style={[styles.tileIcon, { backgroundColor: "rgba(255,255,255,0.16)" }]}>
                    <Ionicons name={mode === "reel" ? "film-outline" : "images-outline"} size={24} color="#fff" />
                  </View>
                  <Text style={[styles.tileLabel, { color: "#fff" }]}>Library</Text>
                  <Text style={styles.tileSub}>{mode === "reel" ? "Video · up to 90s" : multi ? "Up to 10 photos" : "One photo"}</Text>
                </>
              )}
            </SpringPress>
            {kindDrafts.map((d, i) => {
              const src = d.cover ? (d.cover.media_type === "video" ? d.cover.poster_url : d.cover.url) : null;
              return (
                <Animated.View key={d.id} entering={FadeIn.delay(40 * i).duration(240)}>
                  <Pressable onPress={() => router.push(`/(seller)/posts/${d.id}`)} accessibilityRole="button"
                    accessibilityLabel={`Open draft ${d.caption ?? ""}`}
                    style={[styles.tile, { width: tileW, height: tileH }]}>
                    {src ? <Image source={{ uri: src }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
                      : <View style={[StyleSheet.absoluteFill, styles.tileEmpty]}><Ionicons name="document-text-outline" size={20} color={C.mute} /></View>}
                    <View style={styles.draftTag}><Text style={styles.draftTagText}>Draft</Text></View>
                    {d.kind === "carousel" ? <Ionicons name="copy" size={14} color="#fff" style={styles.tileCorner} /> : null}
                    {d.kind === "reel" && d.cover?.state === "ready" ? <Ionicons name="play" size={14} color="#fff" style={styles.tileCorner} /> : null}
                  </Pressable>
                </Animated.View>
              );
            })}
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.hint}>
            <View style={styles.hintIcon}><Ionicons name="bulb-outline" size={16} color={C.ink} /></View>
            <Text style={styles.hintText}>
              {mode === "reel"
                ? "Vertical video, 3–90 seconds. The first two seconds decide the scroll — open on the full look."
                : multi
                  ? "Pick 2–10 photos. Lead with the full outfit, then close-ups of fabric and fit."
                  : "One photo — the one you posted on Instagram works. Tag the pieces in it next."}
            </Text>
          </View>
        </ScrollView>

        {/* POST | REEL switch */}
        <View style={[styles.modeSwitchWrap, { bottom: insets.bottom + 18 }]} pointerEvents="box-none">
          <View style={styles.modeSwitch}>
            {(["post", "reel"] as const).map((m) => {
              const on = m === mode;
              return (
                <Pressable key={m} onPress={() => { setMode(m); setError(null); }} accessibilityRole="tab"
                  accessibilityState={{ selected: on }} style={[styles.modeBtn, on && styles.modeBtnOn]}>
                  <Text style={[styles.modeText, on && styles.modeTextOn]}>{m === "post" ? "POST" : "REEL"}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    );
  }

  /* ═════════════════════════════ STEP 2 — PREVIEW ═════════════════════════════ */

  if (step === "preview") {
    const frameW = width - 24;
    const maxH = height - insets.top - insets.bottom - 230;
    const ratio = kind === "reel" ? 9 / 16 : (post?.aspect === "1:1" ? 1 : 4 / 5);
    const frameH = Math.min(frameW / ratio, maxH);
    const fw = Math.min(frameW, frameH * ratio);
    const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
      setSlide(Math.max(0, Math.min(items.length - 1, Math.round(e.nativeEvent.contentOffset.x / width))));
    const nextUnpinned = tags.find((t) => t.x == null);
    const tools: { icon: IonIconName; label: string; onPress: () => void; on?: boolean; disabled?: boolean }[] = [
      { icon: "pricetag-outline", label: tags.length ? `Products · ${tags.length}` : "Products", onPress: () => setTagSheet(true) },
    ];
    if (hasImages) {
      tools.push({
        icon: "location-outline", label: hotspotFor ? "Cancel" : "Pin", on: !!hotspotFor, disabled: !tags.length,
        onPress: () => setHotspotFor(hotspotFor ? null : (nextUnpinned ?? tags[0])?.id ?? null),
      });
    }
    if (kind === "carousel") {
      tools.push({ icon: "add-circle-outline", label: "Add", disabled: items.length >= POST_LIMITS.mediaMax || !post, onPress: () => void pick("library", true) });
    }
    if (kind === "reel") {
      tools.push({ icon: muted ? "volume-mute-outline" : "volume-high-outline", label: muted ? "Muted" : "Sound", onPress: () => setMuted((v) => !v) });
    }

    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <StatusBar style="dark" />
        <View style={styles.bar}>
          <IconBtn icon="chevron-back" label="Back" onPress={leavePreview} />
          <UploadPill progress={overall} uploading={uploading || busy === "create"} failed={failed} />
          <SpringPress onPress={() => setStep("details")} accessibilityRole="button" accessibilityLabel="Next"
            style={styles.nextRound}>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </SpringPress>
        </View>

        <View style={{ flex: 1, justifyContent: "center" }}>
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onScroll}
            scrollEnabled={items.length > 1 && !hotspotFor}>
            {items.map((it, i) => (
              <View key={it.key} style={{ width, alignItems: "center", justifyContent: "center" }}>
                <PreviewFrame
                  item={it} w={fw} h={frameH} active={i === slide} muted={muted}
                  spots={it.mediaId ? tags.filter((t) => t.media_id === it.mediaId && t.x != null) : []}
                  targeting={!!hotspotFor && it.picked.kind === "image" && !!it.mediaId}
                  onPlace={(x, y) => {
                    if (!hotspotFor || !it.mediaId) return;
                    const mediaId = it.mediaId;
                    setTags((t) => t.map((p) => (p.id === hotspotFor ? {
                      ...p, media_id: mediaId,
                      x: Math.round(Math.min(1, Math.max(0, x / fw)) * 1000) / 1000,
                      y: Math.round(Math.min(1, Math.max(0, y / frameH)) * 1000) / 1000,
                    } : p)));
                    setHotspotFor(null);
                  }}
                  onRetry={() => retry(it)}
                  onRemove={items.length > 1 || kind !== "reel" ? () => void removeItem(it) : undefined}
                />
              </View>
            ))}
          </ScrollView>
          {items.length > 1 ? (
            <View style={styles.dots}>
              {items.map((it, i) => <View key={it.key} style={[styles.dot, i === slide && styles.dotOn]} />)}
            </View>
          ) : null}
          {hotspotFor ? (
            <Animated.View entering={FadeInUp.duration(200)} style={styles.targetHint}>
              <Ionicons name="hand-left-outline" size={14} color="#fff" />
              <Text style={styles.targetHintText} numberOfLines={1}>Tap where “{hotspotName}” appears</Text>
            </Animated.View>
          ) : null}
        </View>

        {error ? <Text style={[styles.errorText, { marginTop: 0 }]}>{error}</Text> : null}

        {/* tool row */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}
          contentContainerStyle={styles.tools}>
          {tools.map((t) => (
            <Pressable key={t.icon} onPress={t.onPress} disabled={t.disabled} accessibilityRole="button" accessibilityLabel={t.label}
              style={[styles.tool, t.disabled && { opacity: 0.35 }]}>
              <View style={[styles.toolIcon, t.on && { backgroundColor: C.ink }]}>
                <Ionicons name={t.icon} size={20} color={t.on ? "#fff" : C.ink} />
              </View>
              <Text style={styles.toolLabel} numberOfLines={1}>{t.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={[styles.previewBottom, { paddingBottom: insets.bottom + 10 }]}>
          <SpringPress onPress={leavePreview} style={styles.ghostPill} accessibilityRole="button">
            <Text style={styles.ghostPillText}>Change</Text>
          </SpringPress>
          <SpringPress onPress={() => setStep("details")} style={styles.inkPill} accessibilityRole="button">
            <Text style={styles.inkPillText}>Next</Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" />
          </SpringPress>
        </View>

        <TagPickerSheet visible={tagSheet} onClose={() => setTagSheet(false)} value={tags} onChange={setTags} suggestions={suggestions} />
      </View>
    );
  }

  /* ═════════════════════════════ STEP 3 — DETAILS ═════════════════════════════ */

  const cover = items[0];
  const coverW = kind === "reel" ? 132 : 150;
  const coverH = kind === "reel" ? coverW * 16 / 9 : coverW * 5 / 4;
  const scheduleLabel = SCHEDULES.find((s) => s.key === schedule)!.label;
  const endLabel = ENDS.find((s) => s.key === ends)!.label;

  return (
    <KeyboardAvoidingView style={[styles.root, { paddingTop: insets.top }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <StatusBar style="dark" />
      <View style={styles.barLeft}>
        <IconBtn icon="arrow-back" label="Back" onPress={() => setStep("preview")} />
        <Text style={styles.barTitleLeft}>{kind === "reel" ? "New reel" : "New post"}</Text>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}>
        {/* cover */}
        <Animated.View entering={FadeInDown.duration(300)} style={styles.coverWrap}>
          <Pressable onPress={() => setStep("preview")} accessibilityRole="button" accessibilityLabel="Preview"
            style={[styles.cover, { width: coverW, height: coverH }]}>
            {cover ? <CoverImage item={cover} /> : null}
            {uploading ? (
              <View style={styles.coverShade}>
                <Text style={styles.coverPct}>{Math.max(1, Math.round(overall * 100))}%</Text>
                <View style={styles.coverTrack}><View style={[styles.coverFill, { width: `${Math.max(2, overall * 100)}%` }]} /></View>
              </View>
            ) : null}
            <View style={styles.coverChip}>
              <Text style={styles.coverChipText}>{items.length > 1 ? `${items.length} photos` : kind === "reel" ? fmtDuration(cover?.picked.durationMs) || "Reel" : "Cover"}</Text>
            </View>
          </Pressable>
        </Animated.View>

        {/* caption */}
        <TextInput
          value={caption}
          onChangeText={(v) => setCaption(v.slice(0, POST_LIMITS.captionMax))}
          placeholder="Write a caption and add hashtags…"
          placeholderTextColor={C.mute}
          multiline
          maxLength={POST_LIMITS.captionMax}
          style={styles.captionInput}
          accessibilityLabel="Caption"
        />
        {removed.length ? <Text style={styles.removed}>Removed {removed.join(" · ")}</Text> : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.capChips}>
          <SmallChip icon="pricetag-outline" label="Hashtags" text="#"
            onPress={() => setCaption((c) => (c.length && !c.endsWith(" ") ? `${c} #` : `${c}#`))} />
          <SmallChip icon="sparkles-outline" label="Tidy caption" onPress={tidyCaption} disabled={!caption.trim()} />
          <SmallChip icon="bag-handle-outline" label="Products" onPress={() => setTagSheet(true)} />
          <Text style={styles.counter}>{caption.length}/{POST_LIMITS.captionMax}</Text>
        </ScrollView>

        <View style={styles.divider} />

        {/* rows */}
        <Row icon="pricetag-outline" title="Tag products" value={tags.length ? `${tags.length}` : undefined}
          sub={!tags.length && suggestions.length ? `We spotted ${suggestions.length} of your pieces` : undefined}
          onPress={() => setTagSheet(true)} />
        {tags.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagStrip}>
            {tags.map((t) => (
              <View key={t.id} style={styles.tagCard}>
                <View style={styles.tagThumb}>
                  {t.image_url ? <Image source={{ uri: t.image_url }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.tagName} numberOfLines={1}>{t.name}</Text>
                  <Text style={styles.tagPrice}>{formatPrice(t.price)}{t.x != null ? "  ·  pinned" : ""}</Text>
                </View>
                <Pressable onPress={() => setTags((l) => l.filter((x) => x.id !== t.id))} hitSlop={8}
                  accessibilityRole="button" accessibilityLabel={`Remove ${t.name}`}>
                  <Ionicons name="close" size={15} color={C.mute} />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        ) : null}
        <Row icon="storefront-outline" title="Your store page" sub="Always shown"><Toggle value disabled /></Row>
        <Row icon="shirt-outline" title="Product pages" sub="As “Styled in” on tagged pieces">
          <Toggle value={onProductPages} onChange={setOnProductPages} />
        </Row>
        <Row icon="time-outline" title="Go live" value={scheduleLabel} onPress={() => setOptionSheet("schedule")} />
        <Row icon="eye-off-outline" title="Hide" value={endLabel} onPress={() => setOptionSheet("ends")} />

        <View style={styles.policy}>
          <Ionicons name="shield-checkmark-outline" size={14} color={C.mute} />
          <Text style={styles.policyText}>
            Keep orders on LUXE — leave out phone numbers, WhatsApp and “DM to order”. Every {noun} is checked before it goes live.
          </Text>
        </View>
      </ScrollView>

      {error || blocker ? (
        <Text style={[styles.blocker, error ? { color: C.danger } : null]} numberOfLines={2}>{error ?? blocker}</Text>
      ) : null}
      <View style={[styles.detailsBottom, { paddingBottom: insets.bottom + 10 }]}>
        <SpringPress onPress={onSaveDraft} disabled={!post || !!busy} accessibilityRole="button"
          style={[styles.ghostBtn, (!post || !!busy) && { opacity: 0.45 }]}>
          {busy === "save" ? <ActivityIndicator size="small" color={C.ink} /> : <Text style={styles.ghostBtnText}>Save draft</Text>}
        </SpringPress>
        <SpringPress onPress={onShare} disabled={!!blocker || !!busy} accessibilityRole="button"
          accessibilityState={{ disabled: !!blocker || !!busy }}
          style={[styles.inkBtn, (!!blocker || !!busy) && { opacity: 0.35 }]}>
          {busy === "publish" ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.inkBtnText}>{schedule === "now" ? "Share" : "Schedule"}</Text>}
        </SpringPress>
      </View>

      <TagPickerSheet visible={tagSheet} onClose={() => setTagSheet(false)} value={tags} onChange={setTags} suggestions={suggestions} />

      <OptionSheet
        visible={optionSheet !== null}
        title={optionSheet === "schedule" ? "Go live" : "Hide this " + noun}
        options={optionSheet === "schedule" ? SCHEDULES.map((s) => ({ key: s.key, label: s.label })) : ENDS.map((s) => ({ key: s.key, label: s.label }))}
        value={optionSheet === "schedule" ? schedule : ends}
        onPick={(k) => {
          if (optionSheet === "schedule") setSchedule(k as ScheduleKey);
          else setEnds(k as EndKey);
          setOptionSheet(null);
        }}
        onClose={() => setOptionSheet(null)}
      />

      <AboutSheet visible={about} noun={noun} onShare={confirmAbout} onCancel={() => setAbout(false)} />
    </KeyboardAvoidingView>
  );
}

/* ───────────────────────── pieces ───────────────────────── */

function IconBtn({ icon, label, onPress }: { icon: IonIconName; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={label} style={styles.iconBtn}>
      <Ionicons name={icon} size={24} color={C.ink} />
    </Pressable>
  );
}

function Chip({ icon, label, onPress }: { icon: IonIconName; label: string; onPress: () => void }) {
  return (
    <SpringPress onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.chip}>
      <Ionicons name={icon} size={16} color={C.ink} />
      <Text style={styles.chipText}>{label}</Text>
    </SpringPress>
  );
}

function SmallChip({ icon, label, text, onPress, disabled }: {
  icon: IonIconName; label: string; text?: string; onPress: () => void; disabled?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label}
      style={({ pressed }) => [styles.smallChip, disabled && { opacity: 0.4 }, pressed && { backgroundColor: C.surface2 }]}>
      {text ? <Text style={styles.smallChipHash}>{text}</Text> : <Ionicons name={icon} size={13} color={C.ink} />}
      <Text style={styles.smallChipText}>{label}</Text>
    </Pressable>
  );
}

function Row({ icon, title, sub, value, onPress, children }: {
  icon: IonIconName; title: string; sub?: string; value?: string; onPress?: () => void; children?: ReactNode;
}) {
  const body = (
    <>
      <Ionicons name={icon} size={22} color={C.ink} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        {sub ? <Text style={styles.rowSub} numberOfLines={1}>{sub}</Text> : null}
      </View>
      {value ? <Text style={styles.rowValue} numberOfLines={1}>{value}</Text> : null}
      {children}
      {onPress ? <Ionicons name="chevron-forward" size={18} color={C.mute} /> : null}
    </>
  );
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={title}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: C.surface }]}>{body}</Pressable>
  ) : <View style={styles.row}>{body}</View>;
}

function Toggle({ value, onChange, disabled }: { value: boolean; onChange?: (v: boolean) => void; disabled?: boolean }) {
  const x = useSharedValue(value ? 1 : 0);
  useEffect(() => { x.value = withTiming(value ? 1 : 0, { duration: 150, easing: Easing.out(Easing.quad) }); }, [value, x]);
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: x.value * 20 }] }));
  return (
    <Pressable onPress={() => { if (!disabled) onChange?.(!value); }} disabled={disabled}
      accessibilityRole="switch" accessibilityState={{ checked: value, disabled: !!disabled }}
      style={[styles.toggle, value && styles.toggleOn, disabled && { opacity: 0.45 }]}>
      <Animated.View style={[styles.toggleKnob, knob]} />
    </Pressable>
  );
}

function UploadPill({ progress, uploading, failed }: { progress: number; uploading: boolean; failed: boolean }) {
  const pct = Math.max(1, Math.round(progress * 100));
  return (
    <View style={styles.uploadPill}>
      {failed ? <Ionicons name="alert-circle" size={15} color={C.danger} />
        : uploading ? <ActivityIndicator size="small" color={C.ink} />
          : <Ionicons name="checkmark-circle" size={15} color={C.success} />}
      <Text style={[styles.uploadPillText, failed && { color: C.danger }]}>
        {failed ? "Upload failed" : uploading ? `Uploading ${pct}%` : "Uploaded"}
      </Text>
    </View>
  );
}

function CoverImage({ item }: { item: Item }) {
  // Videos: the picker URI isn't an image; show a neutral frame with a play glyph.
  if (item.picked.kind === "video") {
    return (
      <View style={[StyleSheet.absoluteFill, styles.coverVideo]}>
        <LocalVideo uri={item.picked.uri} active muted style={StyleSheet.absoluteFill} />
      </View>
    );
  }
  return <Image source={{ uri: item.picked.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />;
}

function PreviewFrame({ item, w, h, active, muted, spots, targeting, onPlace, onRetry, onRemove }: {
  item: Item; w: number; h: number; active: boolean; muted: boolean;
  spots: PickedProduct[]; targeting: boolean;
  onPlace: (x: number, y: number) => void; onRetry: () => void; onRemove?: () => void;
}) {
  const frame = { width: w, height: h };
  return (
    <Pressable disabled={!targeting} onPress={(e) => onPlace(e.nativeEvent.locationX, e.nativeEvent.locationY)} style={frame}>
      {item.picked.kind === "video" ? (
        <LocalVideo uri={item.picked.uri} active={active} muted={muted} style={[styles.previewMedia, frame]} />
      ) : (
        <Image source={{ uri: item.picked.uri }} style={[styles.previewMedia, frame]} contentFit="cover" transition={150} />
      )}
      {spots.map((t) => (
        <View key={t.id} pointerEvents="none" style={[styles.spot, { left: (t.x ?? 0) * w - 14, top: (t.y ?? 0) * h - 14 }]}>
          <View style={styles.spotCore} />
        </View>
      ))}
      {item.state === "error" ? (
        <View style={[styles.frameShade, { borderRadius: 18 }]}>
          <Ionicons name="cloud-offline-outline" size={26} color="#fff" />
          <Text style={styles.frameShadeTitle}>Upload failed</Text>
          <Text style={styles.frameShadeText} numberOfLines={3}>{item.error}</Text>
          <Pressable onPress={onRetry} style={styles.retryBtn} accessibilityRole="button">
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : item.state !== "done" ? (
        <View pointerEvents="none" style={styles.frameProgress}>
          <View style={[styles.frameProgressFill, { width: `${Math.max(3, item.progress * 100)}%` }]} />
        </View>
      ) : null}
      {onRemove ? (
        <Pressable onPress={onRemove} hitSlop={8} accessibilityRole="button" accessibilityLabel="Remove" style={styles.removeBtn}>
          <Ionicons name="trash-outline" size={16} color="#fff" />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

/** Local file playback for the preview (no caching, loops). */
function LocalVideo({ uri, active, muted, style }: {
  uri: string; active: boolean; muted: boolean; style: StyleProp<ViewStyle>;
}) {
  const player = useVideoPlayer({ uri }, (p) => { p.loop = true; p.muted = muted; });
  useEffect(() => { if (active) player.play(); else player.pause(); }, [active, player]);
  useEffect(() => { player.muted = muted; }, [muted, player]);
  return <VideoView player={player} style={style} contentFit="cover" nativeControls={false} />;
}

function OptionSheet({ visible, title, options, value, onPick, onClose }: {
  visible: boolean; title: string; options: { key: string; label: string }[]; value: string;
  onPick: (k: string) => void; onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />
      <Animated.View entering={SlideInDown.duration(260)} style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.grabber} />
        <Text style={styles.sheetTitle}>{title}</Text>
        {options.map((o) => {
          const on = o.key === value;
          return (
            <Pressable key={o.key} onPress={() => onPick(o.key)} accessibilityRole="radio" accessibilityState={{ selected: on }}
              style={({ pressed }) => [styles.optRow, pressed && { backgroundColor: C.surface }]}>
              <Text style={styles.optText}>{o.label}</Text>
              <View style={[styles.radio, on && styles.radioOn]}>{on ? <View style={styles.radioDot} /> : null}</View>
            </Pressable>
          );
        })}
      </Animated.View>
    </Modal>
  );
}

function AboutSheet({ visible, noun, onShare, onCancel }: {
  visible: boolean; noun: string; onShare: () => void; onCancel: () => void;
}) {
  const insets = useSafeAreaInsets();
  const points: { icon: IonIconName; text: string }[] = [
    { icon: "storefront-outline", text: `Your ${noun} shows on your store page and in the Runway feed, where any shopper can see it.` },
    { icon: "bag-handle-outline", text: "Shoppers can tap the products you tagged and buy them straight from it. Sold-out pieces are hidden automatically." },
    { icon: "shield-checkmark-outline", text: "Every post is checked before it goes live — usually in under a minute. Contact details and off-app ordering aren't allowed." },
    { icon: "settings-outline", text: "You can edit the caption and tags, pin, or archive it at any time from Studio." },
  ];
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <Pressable style={styles.scrim} onPress={onCancel} accessibilityLabel="Close" />
      <Animated.View entering={SlideInDown.duration(280)} style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.grabber} />
        <Text style={styles.aboutTitle}>About Runway</Text>
        {points.map((p) => (
          <View key={p.icon} style={styles.aboutRow}>
            <Ionicons name={p.icon} size={22} color={C.ink} />
            <Text style={styles.aboutText}>{p.text}</Text>
          </View>
        ))}
        <SpringPress onPress={onShare} accessibilityRole="button" style={[styles.inkBtn, { flex: 0, marginTop: 14 }]}>
          <Text style={styles.inkBtnText}>Share</Text>
        </SpringPress>
        <Pressable onPress={onCancel} accessibilityRole="button" style={styles.cancelBtn}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

/* ───────────────────────── styles ───────────────────────── */

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  bar: { height: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8 },
  barTitle: { fontFamily: sans.bold, fontSize: 18, color: C.ink, letterSpacing: -0.3 },
  barLeft: { height: 52, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 8 },
  barTitleLeft: { fontFamily: sans.bold, fontSize: 19, color: C.ink, letterSpacing: -0.3 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  nextRound: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: C.ink, alignItems: "center", justifyContent: "center", marginRight: 4,
  },

  chipsRow: { flexDirection: "row", gap: 8, paddingHorizontal: PAGE, paddingTop: 4, paddingBottom: 12 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 7, height: 38, paddingHorizontal: 14, borderRadius: 12,
    backgroundColor: C.surface,
  },
  chipText: { fontFamily: sans.semibold, fontSize: 14, color: C.ink },

  recentsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: PAGE, paddingBottom: 10 },
  recents: { fontFamily: sans.bold, fontSize: 16, color: C.ink },
  selectBtn: {
    flexDirection: "row", alignItems: "center", gap: 6, height: 30, paddingHorizontal: 12, borderRadius: 999, backgroundColor: C.surface,
  },
  selectBtnOn: { backgroundColor: C.ink },
  selectText: { fontFamily: sans.semibold, fontSize: 13, color: C.ink },

  grid: { flexDirection: "row", flexWrap: "wrap" },
  tile: { backgroundColor: C.surface, overflow: "hidden" },
  tileAction: { alignItems: "center", justifyContent: "center", gap: 10 },
  tileLibrary: { alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.ink, paddingHorizontal: 8 },
  tileIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  tileLabel: { fontFamily: sans.bold, fontSize: 14, color: C.ink },
  tileSub: { fontFamily: sans.medium, fontSize: 11.5, color: "rgba(255,255,255,0.7)", textAlign: "center" },
  tileEmpty: { alignItems: "center", justifyContent: "center", backgroundColor: C.surface2 },
  tileCorner: { position: "absolute", top: 8, right: 8 },
  draftTag: {
    position: "absolute", left: 6, bottom: 6, paddingHorizontal: 8, height: 22, borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.94)", justifyContent: "center",
  },
  draftTagText: { fontFamily: sans.semibold, fontSize: 11, color: C.ink },

  hint: {
    flexDirection: "row", alignItems: "center", gap: 12, marginHorizontal: PAGE, marginTop: 18, padding: 14,
    borderRadius: 16, backgroundColor: C.surface,
  },
  hintIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  hintText: { flex: 1, fontFamily: sans.medium, fontSize: 13, lineHeight: 19, color: C.body },

  errorText: {
    fontFamily: sans.medium, fontSize: 13, lineHeight: 18, color: C.danger, textAlign: "center", paddingHorizontal: 24, marginTop: 14,
  },

  modeSwitchWrap: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  modeSwitch: {
    flexDirection: "row", padding: 4, borderRadius: 999, backgroundColor: "#fff",
    shadowColor: "#000", shadowOpacity: 0.14, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  modeBtn: { height: 38, paddingHorizontal: 22, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  modeBtnOn: { backgroundColor: C.ink },
  modeText: { fontFamily: sans.bold, fontSize: 12.5, letterSpacing: 1.6, color: C.mute },
  modeTextOn: { color: "#fff" },

  uploadPill: {
    flexDirection: "row", alignItems: "center", gap: 7, height: 34, paddingHorizontal: 14, borderRadius: 999, backgroundColor: C.surface,
  },
  uploadPillText: { fontFamily: sans.semibold, fontSize: 13, color: C.ink },

  previewMedia: { borderRadius: 18, backgroundColor: C.surface },
  dots: { flexDirection: "row", justifyContent: "center", gap: 5, marginTop: 12 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.faint },
  dotOn: { backgroundColor: C.ink, width: 16 },
  spot: {
    position: "absolute", width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.4)",
    borderWidth: 2, borderColor: "#fff", alignItems: "center", justifyContent: "center",
  },
  spotCore: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.ink },
  frameShade: {
    ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(17,17,20,0.6)", alignItems: "center", justifyContent: "center",
    gap: 6, paddingHorizontal: 28,
  },
  frameShadeTitle: { fontFamily: sans.bold, fontSize: 17, color: "#fff" },
  frameShadeText: { fontFamily: sans.regular, fontSize: 13, lineHeight: 18, color: "rgba(255,255,255,0.8)", textAlign: "center" },
  retryBtn: { marginTop: 8, height: 38, paddingHorizontal: 20, borderRadius: 999, backgroundColor: "#fff", justifyContent: "center" },
  retryText: { fontFamily: sans.semibold, fontSize: 14, color: C.ink },
  frameProgress: {
    position: "absolute", left: 14, right: 14, bottom: 14, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.45)",
    overflow: "hidden",
  },
  frameProgressFill: { height: 4, borderRadius: 2, backgroundColor: "#fff" },
  removeBtn: {
    position: "absolute", top: 12, right: 12, width: 34, height: 34, borderRadius: 17,
    backgroundColor: "rgba(17,17,20,0.5)", alignItems: "center", justifyContent: "center",
  },
  targetHint: {
    position: "absolute", alignSelf: "center", bottom: 18, flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: C.ink, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 999, maxWidth: "86%",
  },
  targetHintText: { fontFamily: sans.semibold, fontSize: 13, color: "#fff" },

  tools: { paddingHorizontal: PAGE, paddingTop: 14, paddingBottom: 6, gap: 6, minWidth: "100%", justifyContent: "center" },
  tool: { width: 74, alignItems: "center", gap: 6 },
  toolIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.surface, alignItems: "center", justifyContent: "center" },
  toolLabel: { fontFamily: sans.medium, fontSize: 11.5, color: C.body },
  previewBottom: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: PAGE, paddingTop: 10 },
  ghostPill: { height: 42, paddingHorizontal: 20, borderRadius: 999, backgroundColor: C.surface, justifyContent: "center" },
  ghostPillText: { fontFamily: sans.semibold, fontSize: 14, color: C.ink },
  inkPill: {
    height: 42, paddingHorizontal: 20, borderRadius: 999, backgroundColor: C.ink, flexDirection: "row", alignItems: "center", gap: 6,
  },
  inkPillText: { fontFamily: sans.semibold, fontSize: 14, color: "#fff" },

  coverWrap: { alignItems: "center", paddingTop: 10, paddingBottom: 14 },
  cover: { borderRadius: 14, backgroundColor: C.surface, overflow: "hidden" },
  coverVideo: { backgroundColor: C.surface2 },
  coverShade: {
    ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(255,255,255,0.55)", alignItems: "center", justifyContent: "center", gap: 8,
  },
  coverPct: { fontFamily: sans.bold, fontSize: 22, color: C.ink },
  coverTrack: { width: "64%", height: 4, borderRadius: 2, backgroundColor: "rgba(17,17,20,0.12)", overflow: "hidden" },
  coverFill: { height: 4, borderRadius: 2, backgroundColor: C.ink },
  coverChip: {
    position: "absolute", bottom: 8, alignSelf: "center", height: 24, paddingHorizontal: 10, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.94)", justifyContent: "center",
  },
  coverChipText: { fontFamily: sans.semibold, fontSize: 11.5, color: C.ink },

  captionInput: {
    minHeight: 70, maxHeight: 180, paddingHorizontal: PAGE, paddingTop: 6, textAlignVertical: "top",
    fontFamily: sans.regular, fontSize: 16, lineHeight: 23, color: C.ink,
  },
  removed: { fontFamily: sans.medium, fontSize: 12.5, color: C.danger, paddingHorizontal: PAGE, marginTop: 4 },
  capChips: { paddingHorizontal: PAGE, paddingVertical: 10, gap: 8, alignItems: "center" },
  smallChip: {
    flexDirection: "row", alignItems: "center", gap: 5, height: 32, paddingHorizontal: 12, borderRadius: 8, backgroundColor: C.surface,
  },
  smallChipHash: { fontFamily: sans.bold, fontSize: 14, color: C.ink },
  smallChipText: { fontFamily: sans.semibold, fontSize: 13, color: C.ink },
  counter: { fontFamily: sans.medium, fontSize: 12, color: C.mute, marginLeft: 6 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: C.line, marginVertical: 4 },

  row: { flexDirection: "row", alignItems: "center", gap: 14, minHeight: 56, paddingHorizontal: PAGE, paddingVertical: 10 },
  rowTitle: { fontFamily: sans.medium, fontSize: 16, color: C.ink },
  rowSub: { fontFamily: sans.regular, fontSize: 12.5, color: C.mute, marginTop: 2 },
  rowValue: { fontFamily: sans.regular, fontSize: 14, color: C.mute, maxWidth: 160 },

  tagStrip: { paddingHorizontal: PAGE, paddingBottom: 8, gap: 8 },
  tagCard: {
    flexDirection: "row", alignItems: "center", gap: 10, width: 220, padding: 8, borderRadius: 14, backgroundColor: C.surface,
  },
  tagThumb: { width: 40, height: 48, borderRadius: 8, backgroundColor: C.surface2, overflow: "hidden" },
  tagName: { fontFamily: sans.semibold, fontSize: 13.5, color: C.ink },
  tagPrice: { fontFamily: sans.regular, fontSize: 12, color: C.body, marginTop: 2 },

  toggle: { width: 48, height: 28, borderRadius: 14, justifyContent: "center", paddingHorizontal: 3, backgroundColor: C.surface2 },
  toggleOn: { backgroundColor: C.ink },
  toggleKnob: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: "#fff",
    shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2,
  },

  policy: { flexDirection: "row", gap: 10, paddingHorizontal: PAGE, paddingTop: 14 },
  policyText: { flex: 1, fontFamily: sans.regular, fontSize: 12.5, lineHeight: 18, color: C.mute },

  blocker: { fontFamily: sans.medium, fontSize: 12.5, color: C.body, textAlign: "center", paddingHorizontal: PAGE, paddingTop: 8 },
  detailsBottom: {
    flexDirection: "row", gap: 10, paddingHorizontal: PAGE, paddingTop: 10, backgroundColor: C.bg,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line,
  },
  ghostBtn: { flex: 1, height: 48, borderRadius: 12, backgroundColor: C.surface, alignItems: "center", justifyContent: "center" },
  ghostBtnText: { fontFamily: sans.semibold, fontSize: 15, color: C.ink },
  inkBtn: { flex: 1, height: 48, borderRadius: 12, backgroundColor: C.accent, alignItems: "center", justifyContent: "center" },
  inkBtnText: { fontFamily: sans.semibold, fontSize: 15, color: "#fff" },

  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: {
    position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 10,
  },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: C.faint, marginBottom: 14 },
  sheetTitle: { fontFamily: sans.bold, fontSize: 18, color: C.ink, marginBottom: 6 },
  optRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 52, borderRadius: 12, paddingHorizontal: 4 },
  optText: { fontFamily: sans.medium, fontSize: 16, color: C.ink },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: C.faint, alignItems: "center", justifyContent: "center" },
  radioOn: { borderColor: C.ink },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.ink },

  aboutTitle: { fontFamily: sans.bold, fontSize: 24, color: C.ink, letterSpacing: -0.5, marginBottom: 14 },
  aboutRow: { flexDirection: "row", gap: 16, paddingVertical: 10, alignItems: "flex-start" },
  aboutText: { flex: 1, fontFamily: sans.regular, fontSize: 14, lineHeight: 20, color: C.body },
  cancelBtn: { height: 46, alignItems: "center", justifyContent: "center", marginTop: 4 },
  cancelText: { fontFamily: sans.semibold, fontSize: 15, color: C.ink },
});
