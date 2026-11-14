/**
 * Seller post composer (create + edit) — "The look sheet".
 *
 * Pick poster / carousel images or a film → draft created, uploads run in the
 * background → story → cast → show time → publish. Everything is set as a
 * printed page: hairline rules, serif captions, mono indices, one ink button.
 * Live posts can edit the story, cast, placements and end date.
 */
import { P, RADIUS, SHADOW } from "./palette";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions,
  type NativeScrollEvent, type NativeSyntheticEvent,
} from "react-native";
import Animated, { Easing, FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Image } from "expo-image";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, type IonIconName } from "@/components/ui/Icon";
import { aspectRatioOf } from "@/components/posts/PostMedia";
import { formatPrice } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import { themedAlert } from "@/lib/themed-alert";
import { POST_LIMITS, type PostKind, type PostPlacement } from "@/lib/posts/limits";
import { sellerPostsApi } from "@/lib/posts/api";
import {
  aspectFor, forgetPendingUpload, pendingUploadsFor, pickPostImages, pickPostVideo, resumePendingUpload, uploadPostMedia,
  validatePicked, type PendingUpload, type PickedMedia,
} from "@/lib/posts/upload";
import { STATUS_LABEL, type SellerPostDetail, type SellerPostMedia } from "@/lib/posts/types";
import { fontFamilies } from "@/lib/theme/fonts";
import { TagPickerSheet, type PickedProduct } from "./TagPickerSheet";
import { PostStatsCard } from "./PostStatsCard";
import { NewPostStart } from "./NewPostStart";
import { ReelPlayer } from "@/components/posts/ReelPlayer";

interface QueueItem {
  key: string;
  picked: PickedMedia;
  progress: number;
  state: "uploading" | "error";
  error?: string;
}

const SCHEDULES = [
  { key: "now", label: "Now", sub: "Straight away" },
  { key: "tonight", label: "Tonight", sub: "Today 7 PM" },
  { key: "tomorrow_am", label: "Morning", sub: "Tomorrow 9 AM" },
  { key: "tomorrow_pm", label: "Evening", sub: "Tomorrow 7 PM" },
] as const;
type ScheduleKey = (typeof SCHEDULES)[number]["key"];

const ENDS = [
  { key: "never", label: "Never", days: 0 },
  { key: "3d", label: "3 days", days: 3 },
  { key: "7d", label: "7 days", days: 7 },
  { key: "30d", label: "30 days", days: 30 },
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

const fromTags = (p: SellerPostDetail): PickedProduct[] =>
  p.tags.map((t) => ({
    id: t.product_id, name: t.product?.name ?? "Product", price: t.product?.price ?? 0, image_url: t.product?.image_url ?? null,
    source: t.source, media_id: t.media_id, x: t.x, y: t.y,
  }));

export function PostComposer({ initial, autoPick, format }: {
  initial?: SellerPostDetail; autoPick?: "video" | "images"; format?: "poster" | "carousel" | "film";
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { toast } = useToast();
  const [post, setPost] = useState<SellerPostDetail | null>(initial ?? null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [caption, setCaption] = useState(initial?.caption ?? "");
  const [removed, setRemoved] = useState<string[]>([]);
  const [tags, setTags] = useState<PickedProduct[]>(initial ? fromTags(initial) : []);
  const [suggestions, setSuggestions] = useState(initial?.moderation?.suggestions ?? []);
  const [onProductPages, setOnProductPages] = useState(initial ? initial.placements.includes("product") : true);
  const [onDiscover, setOnDiscover] = useState(initial ? initial.placements.includes("discover") : true);
  const [schedule, setSchedule] = useState<ScheduleKey>("now");
  const [ends, setEnds] = useState<EndKey>("never");
  const [tagSheet, setTagSheet] = useState(false);
  const [hotspotFor, setHotspotFor] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "create" | "save" | "publish">(null);
  const [error, setError] = useState<string | null>(null);
  // Store is always on. Product pages powers "Styled in"; Runway is the
  // ranked discovery feed (opt-out, default on).
  const placementsFor = (): PostPlacement[] => [
    "store",
    ...(onProductPages ? (["product"] as PostPlacement[]) : []),
    ...(onDiscover ? (["discover"] as PostPlacement[]) : []),
  ];
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  // Opened from the "Create" menu: go straight to the picker once.
  const autoPicked = useRef(false);
  useEffect(() => {
    if (!autoPick || initial || autoPicked.current) return;
    autoPicked.current = true;
    const t = setTimeout(() => { void addMedia(autoPick); }, 380);
    return () => clearTimeout(t);
  }, [autoPick]); // eslint-disable-line react-hooks/exhaustive-deps

  const status = post?.status ?? "draft";
  const isDraft = status === "draft";
  const media = useMemo(() => [...(post?.media ?? [])].sort((a, b) => a.position - b.position), [post?.media]);
  const uploading = queue.some((q) => q.state === "uploading");
  // Preview frame: full-width for posters / carousels, a centred film frame for reels.
  const isReel = post?.kind === "reel";
  const frameW = isReel ? Math.min((width - 40) * 0.7, 300) : width - 40;
  const frameH = frameW / (post ? aspectRatioOf(post.aspect) : 4 / 5);
  const [active, setActive] = useState(0);

  const refresh = useCallback(async (id: string) => {
    const fresh = await sellerPostsApi.get(id);
    if (!mounted.current) return fresh;
    setPost(fresh);
    if (fresh.moderation?.suggestions) setSuggestions(fresh.moderation.suggestions);
    return fresh;
  }, []);

  // Resumable uploads left over from a previous session.
  useEffect(() => {
    if (!post || post.status !== "draft") return;
    pendingUploadsFor(post.id).then((list) => {
      const notReady = list.filter((p) => post.media.some((m) => m.id === p.mediaId && m.state !== "ready"));
      if (mounted.current) setPending(notReady);
    });
  }, [post?.id, post?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll: AI suggestions while drafting; status while processing / in review.
  useEffect(() => {
    if (!post) return;
    const waitingStatus = post.status === "processing" || post.status === "in_review";
    const waitingSuggest = post.status === "draft" && media.length > 0 && !post.moderation?.suggestions;
    const waitingVideo = media.some((m) => m.media_type === "video" && m.state !== "ready" && m.state !== "failed");
    if (!waitingStatus && !waitingSuggest && !waitingVideo) return;
    let n = 0;
    const t = setInterval(async () => {
      n++;
      const fresh = await refresh(post.id).catch(() => null);
      if (!fresh || n > 60) { clearInterval(t); return; }
      if (waitingStatus && fresh.status === "published") toast.success("Your post is live");
      if (waitingStatus && fresh.status === "rejected") toast.error(fresh.rejection_reason ?? "Post not approved");
    }, 3000);
    return () => clearInterval(t);
  }, [post?.id, post?.status, post?.moderation?.suggestions, media, refresh]); // eslint-disable-line react-hooks/exhaustive-deps

  async function upload(postId: string, item: QueueItem) {
    setQueue((q) => q.map((x) => (x.key === item.key ? { ...x, state: "uploading", progress: 0, error: undefined } : x)));
    try {
      await uploadPostMedia(postId, item.picked, (f) => mounted.current && setQueue((q) => q.map((x) => (x.key === item.key ? { ...x, progress: f } : x))));
      if (mounted.current) setQueue((q) => q.filter((x) => x.key !== item.key));
    } catch (e) {
      if (mounted.current) setQueue((q) => q.map((x) => (x.key === item.key ? { ...x, state: "error", error: (e as Error).message } : x)));
    }
    if (mounted.current) await refresh(postId).catch(() => undefined);
  }

  async function addMedia(source: "images" | "video", formatOverride?: "poster" | "carousel" | "film") {
    const fmt = formatOverride ?? format;
    setError(null);
    try {
      let picked: PickedMedia[] = [];
      if (source === "video") {
        const v = await pickPostVideo();
        if (v) picked = [v];
      } else {
        const remaining = post ? POST_LIMITS.mediaMax - media.length : POST_LIMITS.mediaMax;
        const single = post ? post.kind === "poster" : fmt === "poster";
        picked = await pickPostImages(single ? 1 : remaining);
      }
      if (!picked.length) return;
      for (const m of picked) {
        const problem = validatePicked(m);
        if (problem) { setError(problem); return; }
      }

      let current = post;
      if (!current) {
        const kind: PostKind = source === "video" ? "reel"
          : fmt === "carousel" ? "carousel"
          : fmt === "poster" ? "poster"
          : picked.length === 1 ? "poster" : "carousel";
        setBusy("create");
        const created = await sellerPostsApi.create({
          kind, aspect: aspectFor(kind, picked[0]), caption: caption.trim() || undefined,
          placements: placementsFor(),
        });
        current = { ...created, media: [], tags: [] };
        setPost(current);
        setBusy(null);
      }
      const items: QueueItem[] = picked.map((p, i) => ({ key: `${Date.now()}-${i}`, picked: p, progress: 0, state: "uploading" }));
      setQueue((q) => [...q, ...items]);
      for (const it of items) await upload(current.id, it);
    } catch (e) {
      setBusy(null);
      setError((e as Error).message);
    }
  }

  /** Start screen "Save draft": an empty draft holding just the caption. */
  async function saveEmptyDraft(fmt: "poster" | "carousel" | "film") {
    if (post || !caption.trim()) return;
    setError(null);
    setBusy("create");
    try {
      const kind: PostKind = fmt === "film" ? "reel" : fmt;
      const created = await sellerPostsApi.create({
        kind, aspect: kind === "reel" ? "9:16" : "4:5", caption: caption.trim(),
        placements: placementsFor(),
      });
      if (mounted.current) setPost({ ...created, media: [], tags: [] });
      toast.success("Draft saved");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      if (mounted.current) setBusy(null);
    }
  }

  async function resume(p: PendingUpload) {
    setPending((list) => list.filter((x) => x.mediaId !== p.mediaId));
    const key = `resume-${p.mediaId}`;
    setQueue((q) => [...q, { key, picked: { uri: p.uri, kind: p.kind, fileName: "", mimeType: "", bytes: 0, width: 0, height: 0, durationMs: null }, progress: 0, state: "uploading" }]);
    try {
      await resumePendingUpload(p, (f) => mounted.current && setQueue((q) => q.map((x) => (x.key === key ? { ...x, progress: f } : x))));
      setQueue((q) => q.filter((x) => x.key !== key));
    } catch (e) {
      setQueue((q) => q.map((x) => (x.key === key ? { ...x, state: "error", error: (e as Error).message } : x)));
    }
    if (post) await refresh(post.id).catch(() => undefined);
  }

  async function removeMedia(m: SellerPostMedia) {
    if (!post) return;
    try {
      await sellerPostsApi.removeMedia(post.id, m.id);
      await forgetPendingUpload(m.id);
      setPending((l) => l.filter((x) => x.mediaId !== m.id));
      setTags((t) => t.map((x) => (x.media_id === m.id ? { ...x, media_id: null, x: null, y: null } : x)));
      await refresh(post.id);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function cleanCaption() {
    if (!caption.trim()) return;
    try {
      const r = await sellerPostsApi.cleanCaption(caption);
      setCaption(r.text);
      setRemoved(r.removed);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  function placeHotspot(m: SellerPostMedia, x: number, y: number) {
    if (!hotspotFor) return;
    setTags((t) => t.map((p) => (p.id === hotspotFor
      ? { ...p, media_id: m.id, x: Math.round(Math.min(1, Math.max(0, x / frameW)) * 1000) / 1000, y: Math.round(Math.min(1, Math.max(0, y / frameH)) * 1000) / 1000 }
      : p)));
    setHotspotFor(null);
  }

  function untag(id: string) {
    setTags((t) => t.filter((p) => p.id !== id));
    if (hotspotFor === id) setHotspotFor(null);
  }

  async function saveAll() {
    if (!post) return;
    const publishAt = isDraft ? scheduleToIso(schedule) : post.publish_at;
    await sellerPostsApi.update(post.id, {
      caption: caption.trim() || null,
      placements: placementsFor(),
      ...(isDraft ? { publish_at: publishAt } : {}),
      expires_at: ends === "never" && !isDraft ? post.expires_at : endToIso(ends, publishAt),
    });
    await sellerPostsApi.setTags(post.id, tags.map((t) => ({ product_id: t.id, media_id: t.media_id ?? null, x: t.x ?? null, y: t.y ?? null, source: t.source })));
    await refresh(post.id);
  }

  async function onSave() {
    setBusy("save");
    setError(null);
    try {
      await saveAll();
      toast.success(isDraft ? "Draft saved" : "Changes saved");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function onPublish() {
    if (!post) return;
    setBusy("publish");
    setError(null);
    try {
      await saveAll();
      const next = await sellerPostsApi.submit(post.id);
      setPost((p) => (p ? { ...p, ...next } : p));
      toast.success("Submitted — usually live within a minute");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  function confirmDelete() {
    if (!post) return;
    themedAlert("Delete this draft?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try { await sellerPostsApi.remove(post.id); router.replace("/(seller)/posts"); } catch (e) { toast.error((e as Error).message); }
        },
      },
    ]);
  }

  async function lifecycle(a: "archive" | "republish" | "pin" | "unpin") {
    if (!post) return;
    try { await sellerPostsApi[a](post.id); await refresh(post.id); } catch (e) { toast.error((e as Error).message); }
  }

  const needsProducts = (post?.cta ?? "shop") === "shop" && tags.length === 0;
  const failedMedia = media.some((m) => m.state === "failed") || queue.some((q) => q.state === "error");
  const blocker = !post ? "Add a poster, carousel or film first."
    : uploading ? "Wait for uploads to finish."
    : pending.length ? "Resume or remove the interrupted upload."
    : failedMedia ? "Remove the item that failed and try again."
    : media.length === 0 ? "Add at least one image or video."
    : post.kind === "carousel" && media.length < POST_LIMITS.carouselMin ? "A carousel needs at least 2 images."
    : needsProducts ? "Tag at least one product." : null;

  const kindLabel = post?.kind === "reel" ? "Runway film" : post?.kind === "carousel" ? "Carousel" : post ? "Poster" : "New look";
  const hasImages = media.some((m) => m.media_type === "image");
  const canAddMore = isDraft && post?.kind === "carousel" && media.length + queue.length < POST_LIMITS.mediaMax;
  const slides: Slide[] = [
    ...media.map((m) => ({ key: m.id, type: "media" as const, m })),
    ...queue.map((q) => ({ key: q.key, type: "queue" as const, q })),
    ...pending.map((p) => ({ key: p.mediaId, type: "pending" as const, p })),
  ];
  const hotspotName = hotspotFor ? tags.find((t) => t.id === hotspotFor)?.name : null;
  const mediaOk = !!post && media.length > 0 && !uploading && !failedMedia && !pending.length
    && !(post.kind === "carousel" && media.length < POST_LIMITS.carouselMin);
  const checklist = [
    { label: "Media", ok: mediaOk },
    { label: "Products", ok: !needsProducts },
    { label: "Caption", ok: caption.trim().length > 0, optional: true },
  ];
  const plateNo = Math.min(active, Math.max(0, slides.length - 1)) + 1;
  const readyCount = checklist.filter((c) => c.ok).length;

  const heroRef = useRef<ScrollView>(null);
  const step = frameW + 12;
  const onHeroScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    setActive(Math.max(0, Math.min(slides.length - 1, Math.round(e.nativeEvent.contentOffset.x / step))));
  const goTo = (i: number) => { heroRef.current?.scrollTo({ x: i * step, animated: true }); setActive(i); };

  function renderSlide(s: Slide, i: number) {
    const frame = { width: frameW, height: frameH };
    if (s.type === "queue") {
      const q = s.q;
      const pct = Math.max(1, Math.round(q.progress * 100));
      return (
        <View key={s.key} style={[styles.frame, styles.frameState, frame]}>
          {q.state === "error" ? (
            <>
              <Text style={styles.stateLabelRust}>UPLOAD FAILED</Text>
              <Text style={styles.stateTitle}>The file didn’t go through.</Text>
              <Text style={styles.stateText} numberOfLines={3}>{q.error}</Text>
              <View style={styles.stateActions}>
                {post ? (
                  <Pressable onPress={() => upload(post.id, q)} accessibilityRole="button" hitSlop={6}>
                    <Text style={styles.stateAction}>Retry →</Text>
                  </Pressable>
                ) : null}
                <Pressable onPress={() => setQueue((x) => x.filter((y) => y.key !== q.key))} accessibilityRole="button" hitSlop={6}>
                  <Text style={styles.stateActionMute}>Dismiss</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.percent}>{pct}<Text style={styles.percentSign}>%</Text></Text>
              <Text style={styles.stateLabel}>UPLOADING</Text>
              <Text style={styles.stateText}>{q.picked.kind === "video" ? "Sending your film" : "Sending your image"}</Text>
              <View style={styles.uploadTrack}><View style={[styles.uploadFill, { width: `${pct}%` }]} /></View>
            </>
          )}
        </View>
      );
    }
    if (s.type === "pending") {
      return (
        <View key={s.key} style={[styles.frame, styles.frameState, frame]}>
          <Text style={styles.stateLabelRust}>INTERRUPTED</Text>
          <Text style={styles.stateTitle}>Pick up where you left off.</Text>
          <Text style={styles.stateText}>The upload stopped before it finished.</Text>
          <View style={styles.stateActions}>
            <Pressable onPress={() => resume(s.p)} accessibilityRole="button" hitSlop={6}>
              <Text style={styles.stateAction}>Resume →</Text>
            </Pressable>
          </View>
        </View>
      );
    }
    const m = s.m;
    const src = m.media_type === "video" ? m.poster_url : m.url;
    const spots = tags.filter((t) => t.media_id === m.id && t.x != null);
    const targeting = !!hotspotFor && m.media_type === "image";
    const badge = m.media_type === "video"
      ? `RUNWAY${m.duration_ms ? ` · ${Math.floor(m.duration_ms / 60000)}:${String(Math.round((m.duration_ms % 60000) / 1000)).padStart(2, "0")}` : ""}`
      : m.position === 0 ? "COVER" : `FRAME ${i + 1}`;
    return (
      <Pressable key={s.key} style={frame} disabled={!targeting}
        onPress={(e) => placeHotspot(m, e.nativeEvent.locationX, e.nativeEvent.locationY)}
        accessibilityLabel={targeting ? `Place ${hotspotName ?? "product"} here` : undefined}>
        {m.media_type === "video" && m.url && m.state === "ready" ? (
          <ReelPlayer src={m.url} poster={m.poster_url} active controls radius={RADIUS.media + 4} style={frame} />
        ) : src ? (
          <Image source={{ uri: src }} style={[styles.frame, styles.frameImage, frame]} contentFit="cover" transition={200} />
        ) : (
          <View style={[styles.frame, styles.frameState, frame]}>
            {m.state === "failed" ? (
              <>
                <Text style={styles.stateLabelRust}>FAILED TO PROCESS</Text>
                <Text style={styles.stateTitle}>This file couldn’t be prepared.</Text>
                <Text style={styles.stateText} numberOfLines={3}>{m.error ?? "Remove it and try another file."}</Text>
              </>
            ) : (
              <>
                <ActivityIndicator color={P.ink} />
                <Text style={styles.stateLabel}>{m.media_type === "video" ? "PREPARING YOUR FILM" : "FINISHING THE PLATE"}</Text>
                <Text style={styles.stateText}>{m.media_type === "video" ? "This takes about a minute." : "Almost there."}</Text>
              </>
            )}
          </View>
        )}
        {m.media_type === "video" && src && !(m.url && m.state === "ready") ? (
          <View pointerEvents="none" style={[styles.playBadge, { left: frameW / 2 - 23, top: frameH / 2 - 23 }]}>
            <Ionicons name="play" size={19} color="#fff" style={{ marginLeft: 2 }} />
          </View>
        ) : null}
        {spots.map((t) => (
          <View key={t.id} pointerEvents="none" style={[styles.spot, { left: (t.x ?? 0) * frameW - 12, top: (t.y ?? 0) * frameH - 12 }]}>
            <View style={styles.spotCore} />
          </View>
        ))}
        <View pointerEvents="none" style={styles.badge}><Text style={styles.badgeText}>{badge}</Text></View>
        {isDraft ? (
          <Pressable onPress={() => removeMedia(m)} style={styles.frameBtn} accessibilityRole="button" accessibilityLabel="Remove this item" hitSlop={8}>
            <Ionicons name="trash-outline" size={15} color={P.ink} />
          </Pressable>
        ) : null}
        {targeting ? (
          <View pointerEvents="none" style={[styles.targetHint, { width: frameW - 24 }]}>
            <Ionicons name="hand-left-outline" size={14} color={P.paper} />
            <Text style={styles.targetHintText} numberOfLines={1}>Tap where “{hotspotName}” appears</Text>
          </View>
        ) : null}
      </Pressable>
    );
  }

  if (!post && queue.length === 0) {
    return (
      <NewPostStart
        onPick={(k, f) => void addMedia(k, f)}
        onSaveDraft={(f) => void saveEmptyDraft(f)}
        busy={busy === "create"}
        initialFormat={format ?? (autoPick === "video" ? "film" : undefined)}
        error={error}
        caption={caption}
        onCaption={setCaption}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: P.paper }}>
      <StatusBar style="dark" />

      <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
        <Pressable onPress={() => router.navigate("/(seller)/posts")}
          style={styles.headerBtn} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8}>
          <Ionicons name="chevron-back" size={19} color={P.ink} style={{ marginLeft: -2 }} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerKicker}>{isDraft ? "NEW LOOK" : `LOOK / ${STATUS_LABEL[status].toUpperCase()}`}</Text>
          <Text style={styles.headerTitle}>{kindLabel}</Text>
        </View>
        {post && (isDraft || status === "published" || status === "rejected") ? (
          <Pressable onPress={onSave} disabled={!!busy || uploading} hitSlop={8} accessibilityRole="button" accessibilityLabel="Save"
            style={({ pressed }) => [styles.headerSavePill, (!!busy || uploading) && { opacity: 0.35 }, pressed && { backgroundColor: P.warm }]}>
            <Text style={styles.headerSave}>{busy === "save" ? "Saving…" : "Save"}</Text>
          </Pressable>
        ) : <View style={{ width: 38 }} />}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: insets.bottom + (post ? 210 : 40), gap: 32 }}
        keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {status === "rejected" && post?.rejection_reason ? (
          <Note label="STATUS / RETURNED" title="Not approved" tone="error"
            text={`${post.rejection_reason} Edit and save to send it again.`} />
        ) : null}
        {status === "processing" || status === "in_review" ? (
          <Note label="STATUS / IN PROGRESS" waiting
            title={status === "processing" ? "Preparing your media" : "Checking the look"}
            text={status === "processing" ? "We’re preparing your files for the app." : "Usually live in under a minute."} />
        ) : null}
        {status === "published" ? (
          <Note label="STATUS / LIVE" tone="live" title={post?.pinned_at ? "Live · pinned to your store" : "Live on your store"}
            text="Edits to the story are checked again before they show." />
        ) : null}
        {error ? <Note label="ERROR" title="Something went wrong" text={error} tone="error" /> : null}

        {/* ── plate ── */}
        <View style={{ gap: 10 }}>
          <View style={styles.mediaMeta}>
            <Text style={styles.monoLabel}>PLATE {String(plateNo).padStart(2, "0")}{plateNo === 1 ? " — COVER" : ""}</Text>
            <Text style={styles.monoLabel}>{slides.length} {slides.length === 1 ? "FRAME" : "FRAMES"}</Text>
          </View>

          <ScrollView
            ref={heroRef} horizontal showsHorizontalScrollIndicator={false} scrollEnabled={slides.length > 1 && !hotspotFor}
            snapToInterval={step} decelerationRate="fast" onMomentumScrollEnd={onHeroScroll}
            style={{ marginHorizontal: -20 }}
            contentContainerStyle={{ paddingHorizontal: isReel ? (width - frameW) / 2 : 20, gap: 12, paddingVertical: 2 }}>
            {slides.map(renderSlide)}
          </ScrollView>

          {slides.length > 1 || canAddMore ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {slides.map((s, i) => {
                const src = s.type === "media" ? (s.m.media_type === "video" ? s.m.poster_url : s.m.url) : null;
                return (
                  <Pressable key={s.key} onPress={() => goTo(i)} accessibilityLabel={`Show item ${i + 1}`}
                    style={[styles.thumb, i === active && styles.thumbOn]}>
                    {src ? <Image source={{ uri: src }} style={styles.thumbImg} contentFit="cover" />
                      : <View style={[styles.thumbImg, styles.thumbEmpty]}><ActivityIndicator size="small" color={P.ink} /></View>}
                  </Pressable>
                );
              })}
              {canAddMore ? (
                <Pressable onPress={() => addMedia("images")} style={[styles.thumb, styles.thumbAdd]}
                  accessibilityRole="button" accessibilityLabel="Add images">
                  <Ionicons name="add" size={18} color={P.ink} />
                </Pressable>
              ) : null}
            </ScrollView>
          ) : null}

          {post?.kind === "carousel" ? (
            <Text style={styles.metaLine}>{media.length} of {POST_LIMITS.mediaMax} frames · the first is the cover</Text>
          ) : null}
        </View>

        {/* ── story ── */}
        <Section index="01" kicker="THE STORY" title="Caption"
          hint="Optional. Paste it straight from Instagram — we will tidy the sales copy.">
          <View style={styles.captionField}>
            <TextInput
              value={caption} onChangeText={setCaption} multiline maxLength={POST_LIMITS.captionMax}
              placeholder="Write the story behind this look…" placeholderTextColor={P.faint} style={styles.caption}
            />
            <View style={styles.captionBar}>
              <Pressable onPress={cleanCaption} disabled={!caption.trim()} hitSlop={6}
                style={[styles.tidyBtn, !caption.trim() && { opacity: 0.35 }]} accessibilityRole="button">
                <Ionicons name="sparkles-outline" size={12} color={P.terracotta} />
                <Text style={styles.tidyText}>Tidy caption</Text>
                <Ionicons name="arrow-forward" size={11} color={P.terracotta} />
              </Pressable>
              <Text style={styles.counter}>{caption.length}/{POST_LIMITS.captionMax}</Text>
            </View>
          </View>
          {removed.length ? (
            <Text style={styles.removed}>Removed {removed.join(" · ")}</Text>
          ) : null}
          <View style={styles.noteRow}>
            <Ionicons name="shield-checkmark-outline" size={12} color={P.mute} />
            <Text style={styles.noteLineText}>Keep orders on LUXE — leave out phone numbers, WhatsApp and “DM to order”.</Text>
          </View>
        </Section>

        {/* ── cast ── */}
        <Section index="02" kicker="THE CAST" title="Featured pieces"
          hint={tags.length ? `${tags.length} of ${POST_LIMITS.tagsMax} pieces tagged` : "Tag what shoppers can buy from this look."}
          action={tags.length ? <TextAction small label="Edit" onPress={() => setTagSheet(true)} /> : null}>
          {tags.length === 0 ? (
            <Pressable onPress={() => setTagSheet(true)} style={styles.addCast} accessibilityRole="button">
              <View style={styles.addCastIcon}><Ionicons name="pricetag-outline" size={17} color={P.ink} /></View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.addCastTitle}>Add the pieces in this look</Text>
                <Text style={styles.addCastSub}>
                  {suggestions.length ? `We spotted ${suggestions.length} of your pieces in the frame.` : "Search your store or take a suggestion."}
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={16} color={P.paper} />
            </Pressable>
          ) : (
            <View>
              {tags.map((t, i) => {
                const pinned = t.x != null;
                const placing = hotspotFor === t.id;
                return (
                  <Animated.View key={t.id} entering={FadeIn.duration(240)} style={[styles.castRow, i > 0 && styles.castBorder]}>
                    <Text style={styles.castIndex}>{String(i + 1).padStart(2, "0")}</Text>
                    <View style={styles.castThumb}>
                      {t.image_url ? <Image source={{ uri: t.image_url }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
                    </View>
                    <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                      <Text style={styles.castName} numberOfLines={1}>{t.name}</Text>
                      <Text style={styles.castPrice}>{formatPrice(t.price)}</Text>
                    </View>
                    {hasImages ? (
                      <Pressable onPress={() => setHotspotFor(placing ? null : t.id)} hitSlop={6} style={styles.pin}
                        accessibilityRole="button" accessibilityLabel={`Place ${t.name} on the photo`}>
                        <Ionicons name={pinned ? "location" : "location-outline"} size={12} color={placing ? P.terracotta : P.mute} />
                        <Text style={[styles.pinText, placing && { color: P.terracotta }]}>{placing ? "Tap photo" : pinned ? "Pinned" : "Pin"}</Text>
                      </Pressable>
                    ) : null}
                    {isDraft || status === "published" || status === "rejected" ? (
                      <Pressable onPress={() => untag(t.id)} hitSlop={8} style={styles.untag}
                        accessibilityRole="button" accessibilityLabel={`Remove ${t.name}`}>
                        <Ionicons name="close" size={14} color={P.mute} />
                      </Pressable>
                    ) : null}
                  </Animated.View>
                );
              })}
            </View>
          )}
        </Section>

        {/* ── show ── */}
        <Section index="03" kicker="THE SHOW" title="Where it shows">
          <View style={styles.settings}>
            <SettingRow title="Your store page" sub="Always shown">
              <MinimalSwitch value disabled />
            </SettingRow>
            <SettingRow title="Product pages" sub="As “Styled in” on tagged pieces" border>
              <MinimalSwitch value={onProductPages} onChange={setOnProductPages} />
            </SettingRow>
            <SettingRow title="Runway" sub="Ranked discovery feed for new shoppers" border>
              <MinimalSwitch value={onDiscover} onChange={setOnDiscover} />
            </SettingRow>
          </View>

          {isDraft ? (
            <View style={styles.subBlock}>
              <Text style={styles.subLabel}>GO LIVE</Text>
              <View style={styles.scheduleGrid}>
                {SCHEDULES.map((s) => {
                  const on = schedule === s.key;
                  return (
                    <Pressable key={s.key} onPress={() => setSchedule(s.key)}
                      style={[styles.scheduleCell, on && styles.scheduleCellOn]}
                      accessibilityRole="radio" accessibilityState={{ selected: on }}>
                      <View style={styles.scheduleTop}>
                        <View style={[styles.scheduleDot, on && styles.scheduleDotOn]} />
                        <Text style={[styles.scheduleLabel, on && { color: P.paper }]}>{s.label}</Text>
                      </View>
                      <Text style={[styles.scheduleSub, on && { color: P.champagne }]}>{s.sub}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : post?.publish_at && new Date(post.publish_at) > new Date() ? (
            <View style={styles.noteRow}>
              <Ionicons name="time-outline" size={12} color={P.mute} />
              <Text style={styles.noteLineText}>Goes live {new Date(post.publish_at).toLocaleString()}</Text>
            </View>
          ) : null}

          <View style={styles.subBlock}>
            <Text style={styles.subLabel}>HIDE AFTER</Text>
            <View style={styles.endRow}>
              {ENDS.map((s, i) => {
                const on = ends === s.key;
                return (
                  <Pressable key={s.key} onPress={() => setEnds(s.key)}
                    style={[styles.endCell, i > 0 && styles.endCellBorder, on && styles.endCellOn]}
                    accessibilityRole="radio" accessibilityState={{ selected: on }}>
                    <Text style={[styles.endText, on && styles.endTextOn]}>{s.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            {post?.expires_at && !isDraft ? (
              <Text style={styles.metaLine}>Currently hides on {new Date(post.expires_at).toLocaleDateString()}</Text>
            ) : null}
          </View>
        </Section>

        {post && (status === "published" || status === "archived") ? <PostStatsCard postId={post.id} /> : null}

        {post && (status === "draft" || status === "rejected") ? (
          <Pressable onPress={confirmDelete} style={styles.deleteBtn} accessibilityRole="button">
            <Ionicons name="trash-outline" size={14} color={P.terracotta} />
            <Text style={styles.deleteText}>Delete draft</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      {/* ── the desk ── */}
      {post ? (
        <View style={[styles.dock, { paddingBottom: Math.max(insets.bottom, 10) + 8 }]}>
          {isDraft ? (
            <>
              <View style={styles.readyRow}>
                <View style={styles.ticks}>
                  {checklist.map((c) => <View key={c.label} style={[styles.tick, c.ok && styles.tickOn]} />)}
                </View>
                <Text style={[styles.readyText, !!blocker && styles.readyWarn]} numberOfLines={1}>
                  {blocker ?? (schedule === "now" ? "Ready to publish" : `Ready — ${SCHEDULES.find((s) => s.key === schedule)?.sub.toLowerCase()}`)}
                </Text>
                <Text style={styles.readyCount}>{readyCount}/3</Text>
              </View>
              <View style={styles.dockActions}>
                <Pressable onPress={onSave} disabled={!!busy || uploading} accessibilityRole="button"
                  style={({ pressed }) => [styles.saveDraft, (busy || uploading) && { opacity: 0.35 }, pressed && { opacity: 0.6 }]}>
                  <Text style={styles.saveDraftText}>{busy === "save" ? "Saving…" : "Save draft"}</Text>
                </Pressable>
                <PrimaryBtn
                  label={schedule === "now" ? "Publish look" : "Schedule look"}
                  icon={schedule === "now" ? "arrow-forward" : "time-outline"}
                  onPress={onPublish} loading={busy === "publish"} disabled={!!blocker || !!busy} />
              </View>
            </>
          ) : status === "processing" || status === "in_review" ? (
            <View style={styles.waitRow}>
              <ActivityIndicator size="small" color={P.ink} />
              <Text style={styles.waitText}>{status === "processing" ? "PREPARING MEDIA" : "CHECKING THE LOOK"}</Text>
            </View>
          ) : (
            <View style={styles.dockActions}>
              {status === "published" ? (
                <>
                  <TextAction label={post.pinned_at ? "Unpin" : "Pin"} onPress={() => lifecycle(post.pinned_at ? "unpin" : "pin")} />
                  <TextAction label="Archive" onPress={() => lifecycle("archive")} />
                </>
              ) : status === "archived" ? (
                <TextAction label="Republish" onPress={() => lifecycle("republish")} />
              ) : null}
              <PrimaryBtn label={busy === "save" ? "Saving…" : "Save changes"} icon="checkmark"
                onPress={onSave} loading={busy === "save"} disabled={!!busy} />
            </View>
          )}
        </View>
      ) : null}

      <TagPickerSheet visible={tagSheet} onClose={() => setTagSheet(false)} value={tags} onChange={setTags} suggestions={suggestions} />
    </View>
  );
}

type Slide =
  | { key: string; type: "media"; m: SellerPostMedia }
  | { key: string; type: "queue"; q: QueueItem }
  | { key: string; type: "pending"; p: PendingUpload };

/* ───────────────────────── building blocks ───────────────────────── */

function Section({ index, kicker, title, hint, action, children }: {
  index: string; kicker: string; title: string; hint?: string; action?: ReactNode; children: ReactNode;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(Number(index) * 60).duration(340)} style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionIndex}>{index}</Text>
        <Text style={styles.sectionKicker}>{kicker}</Text>
        <View style={styles.sectionLine} />
        {action}
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
      {hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}
      <View style={styles.sectionBody}>{children}</View>
    </Animated.View>
  );
}

function Note({ label, title, text, tone = "info", waiting }: {
  label: string; title: string; text: string; tone?: "info" | "error" | "live"; waiting?: boolean;
}) {
  return (
    <Animated.View entering={FadeInDown.duration(320)} style={[styles.note, tone === "error" && styles.noteError, tone === "live" && styles.noteLive]}>
      <View style={styles.noteHead}>
        {waiting ? <ActivityIndicator size="small" color={P.terracotta} /> : <View style={[styles.noteDot, tone === "error" && { backgroundColor: P.terracotta }, tone === "live" && { backgroundColor: "#3f7a4f" }]} />}
        <Text style={[styles.noteLabel, tone === "error" && { color: P.terracotta }]}>{label}</Text>
      </View>
      <Text style={styles.noteTitle}>{title}</Text>
      <Text style={styles.noteText}>{text}</Text>
    </Animated.View>
  );
}

function SettingRow({ title, sub, border, children }: {
  title: string; sub: string; border?: boolean; children: ReactNode;
}) {
  return (
    <View style={[styles.settingRow, border && styles.settingBorder]}>
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingSub}>{sub}</Text>
      </View>
      {children}
    </View>
  );
}

function MinimalSwitch({ value, onChange, disabled }: { value: boolean; onChange?: (v: boolean) => void; disabled?: boolean }) {
  const x = useSharedValue(value ? 1 : 0);
  useEffect(() => { x.value = withTiming(value ? 1 : 0, { duration: 140, easing: Easing.out(Easing.quad) }); }, [value, x]);
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: x.value * 20 }] }));
  return (
    <Pressable onPress={() => { if (!disabled) onChange?.(!value); }} disabled={disabled}
      accessibilityRole="switch" accessibilityState={{ checked: value, disabled: !!disabled }}
      style={[styles.switch, value && styles.switchOn, disabled && { opacity: 0.45 }]}>
      <Animated.View style={[styles.switchKnob, knob]} />
    </Pressable>
  );
}

function TextAction({ label, onPress, small }: { label: string; onPress: () => void; small?: boolean }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={label}>
      <Text style={small ? styles.textActionSmall : styles.textAction}>{label}</Text>
    </Pressable>
  );
}

function PrimaryBtn({ label, icon, onPress, disabled, loading }: {
  label: string; icon?: IonIconName; onPress: () => void; disabled?: boolean; loading?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled || loading} accessibilityRole="button"
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      style={({ pressed }) => [styles.primary, (disabled || loading) && { opacity: 0.3 }, pressed && !disabled && { opacity: 0.82 }]}>
      {loading ? <ActivityIndicator size="small" color={P.paper} /> : (
        <>
          <Text style={styles.primaryText}>{label}</Text>
          {icon ? <Ionicons name={icon} size={15} color={P.paper} /> : null}
        </>
      )}
    </Pressable>
  );
}

/* ───────────────────────── styles ───────────────────────── */

const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, gap: 12, backgroundColor: P.paper,
  },
  headerBtn: {
    width: 40, height: 40, borderRadius: RADIUS.pill, alignItems: "center", justifyContent: "center",
    backgroundColor: P.card, ...SHADOW,
  },
  headerKicker: { fontFamily: fontFamilies.sans.medium, fontSize: 12, color: P.mute },
  headerTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 20, letterSpacing: -0.5, color: P.ink, marginTop: 1 },
  headerSavePill: {
    height: 36, paddingHorizontal: 18, borderRadius: RADIUS.pill, backgroundColor: P.track,
    alignItems: "center", justifyContent: "center",
  },
  headerSave: { fontFamily: fontFamilies.sans.semibold, fontSize: 13.5, color: P.ink },

  note: { backgroundColor: P.card, borderRadius: RADIUS.card, paddingHorizontal: 16, paddingVertical: 14, gap: 4, ...SHADOW },
  noteError: { backgroundColor: P.blush },
  noteLive: { backgroundColor: "#eaf6ee" },
  noteHead: { flexDirection: "row", alignItems: "center", gap: 7 },
  noteDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: P.ink },
  noteLabel: { fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: P.ink },
  noteTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 17, letterSpacing: -0.3, color: P.ink, marginTop: 2 },
  noteText: { fontFamily: fontFamilies.sans.regular, fontSize: 13.5, lineHeight: 20, color: P.body },

  mediaMeta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  monoLabel: { fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: P.mute },

  frame: { overflow: "hidden", borderRadius: RADIUS.media + 4 },
  frameImage: { backgroundColor: P.warm },
  frameState: {
    backgroundColor: P.card, alignItems: "center", justifyContent: "center", paddingHorizontal: 26, gap: 9, ...SHADOW,
  },
  stateLabel: { fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: P.mute, textAlign: "center" },
  stateLabelRust: { fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: P.terracotta, textAlign: "center" },
  stateTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 20, lineHeight: 26, letterSpacing: -0.4, color: P.ink, textAlign: "center" },
  stateText: { fontFamily: fontFamilies.sans.regular, fontSize: 13.5, lineHeight: 20, color: P.body, textAlign: "center" },
  stateActions: { flexDirection: "row", gap: 10, marginTop: 10, alignItems: "center" },
  stateAction: {
    fontFamily: fontFamilies.sans.semibold, fontSize: 13.5, color: P.paper, backgroundColor: P.ink,
    paddingHorizontal: 18, paddingVertical: 11, borderRadius: RADIUS.pill, overflow: "hidden",
  },
  stateActionMute: {
    fontFamily: fontFamilies.sans.semibold, fontSize: 13.5, color: P.ink, paddingHorizontal: 14, paddingVertical: 11,
    borderRadius: RADIUS.pill, backgroundColor: P.track, overflow: "hidden",
  },
  percent: { fontFamily: fontFamilies.sans.bold, fontSize: 60, lineHeight: 66, letterSpacing: -2.5, color: P.ink },
  percentSign: { fontSize: 26, color: P.terracotta },
  uploadTrack: { width: "62%", height: 6, borderRadius: 3, backgroundColor: P.track, marginTop: 8, overflow: "hidden" },
  uploadFill: { height: 6, borderRadius: 3, backgroundColor: P.ink },

  playBadge: {
    position: "absolute", width: 58, height: 58, borderRadius: 29, marginLeft: -5, marginTop: -5,
    backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center",
  },
  spot: { position: "absolute", width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.35)", borderWidth: 2, borderColor: "#fff", alignItems: "center", justifyContent: "center" },
  spotCore: { width: 8, height: 8, borderRadius: 4, backgroundColor: P.ink },
  badge: {
    position: "absolute", left: 12, top: 12, height: 26, paddingHorizontal: 11, justifyContent: "center",
    borderRadius: RADIUS.pill, backgroundColor: "rgba(255,255,255,0.94)",
  },
  badgeText: { fontFamily: fontFamilies.sans.semibold, fontSize: 11.5, color: P.ink },
  frameBtn: {
    position: "absolute", right: 12, top: 12, width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center",
  },
  targetHint: {
    position: "absolute", left: 12, bottom: 12, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: P.ink,
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: RADIUS.pill,
  },
  targetHintText: { flex: 1, fontFamily: fontFamilies.sans.semibold, fontSize: 13, color: P.paper },

  thumb: { width: 50, height: 62, borderRadius: 14, borderWidth: 2, borderColor: "transparent", padding: 2, overflow: "hidden" },
  thumbOn: { borderColor: P.ink },
  thumbImg: { width: "100%", height: "100%", borderRadius: 11, backgroundColor: P.warm },
  thumbEmpty: { backgroundColor: P.warm, alignItems: "center", justifyContent: "center" },
  thumbAdd: { borderStyle: "dashed", borderColor: P.faint, alignItems: "center", justifyContent: "center", backgroundColor: P.card },
  metaLine: { fontFamily: fontFamilies.sans.regular, fontSize: 12.5, color: P.mute },

  section: { paddingTop: 6, gap: 6 },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  sectionIndex: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: P.ink, color: P.paper, textAlign: "center",
    lineHeight: 24, fontFamily: fontFamilies.sans.bold, fontSize: 11,
  },
  sectionKicker: { fontFamily: fontFamilies.sans.semibold, fontSize: 12.5, color: P.mute },
  sectionLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: P.border },
  sectionTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 22, lineHeight: 28, letterSpacing: -0.6, color: P.ink, marginTop: 4 },
  sectionHint: { fontFamily: fontFamilies.sans.regular, fontSize: 14, lineHeight: 21, color: P.body },
  sectionBody: { marginTop: 12, gap: 12 },

  captionField: { backgroundColor: P.card, borderRadius: RADIUS.card, ...SHADOW },
  caption: {
    minHeight: 124, textAlignVertical: "top", paddingHorizontal: 16, paddingTop: 15, paddingBottom: 10,
    fontFamily: fontFamilies.sans.regular, fontSize: 16, lineHeight: 24, color: P.ink,
  },
  captionBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: P.border,
  },
  tidyBtn: { flexDirection: "row", alignItems: "center", gap: 6, height: 32, paddingHorizontal: 13, borderRadius: RADIUS.pill, backgroundColor: P.blush },
  tidyText: { fontFamily: fontFamilies.sans.semibold, fontSize: 12.5, color: P.terracottaDeep },
  counter: { fontFamily: fontFamilies.sans.medium, fontSize: 12, color: P.mute },
  removed: { fontFamily: fontFamilies.sans.medium, fontSize: 12.5, color: P.terracotta },
  noteRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  noteLineText: { flex: 1, fontFamily: fontFamilies.sans.regular, fontSize: 13, lineHeight: 19, color: P.mute },

  addCast: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: P.ink, borderRadius: RADIUS.card, paddingHorizontal: 16, paddingVertical: 16 },
  addCastIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: P.champagneSoft, alignItems: "center", justifyContent: "center" },
  addCastTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 16, color: P.paper, letterSpacing: -0.2 },
  addCastSub: { fontFamily: fontFamilies.sans.regular, fontSize: 12.5, lineHeight: 18, color: "rgba(255,255,255,0.7)" },

  castRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  castBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: P.border },
  castIndex: { fontFamily: fontFamilies.sans.bold, fontSize: 12, color: P.faint, width: 18 },
  castThumb: { width: 50, height: 62, borderRadius: 14, backgroundColor: P.warm, overflow: "hidden" },
  castName: { fontFamily: fontFamilies.sans.semibold, fontSize: 15, color: P.ink },
  castPrice: { fontFamily: fontFamilies.sans.medium, fontSize: 13, color: P.body },
  pin: {
    flexDirection: "row", alignItems: "center", gap: 5, height: 30, paddingHorizontal: 12, borderRadius: RADIUS.pill,
    backgroundColor: P.track,
  },
  pinText: { fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: P.body },
  untag: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: P.track },

  settings: { backgroundColor: P.card, borderRadius: RADIUS.card, paddingHorizontal: 16, ...SHADOW },
  settingRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 15 },
  settingBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: P.border },
  settingTitle: { fontFamily: fontFamilies.sans.semibold, fontSize: 15, color: P.ink },
  settingSub: { fontFamily: fontFamilies.sans.regular, fontSize: 12.5, color: P.mute },

  switch: { width: 48, height: 28, borderRadius: 14, justifyContent: "center", paddingHorizontal: 3, backgroundColor: P.switchOff },
  switchOn: { backgroundColor: P.success },
  switchKnob: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#fff", shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2 },

  subBlock: { gap: 10, marginTop: 8 },
  subLabel: { fontFamily: fontFamilies.sans.semibold, fontSize: 13, color: P.body },
  scheduleGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  scheduleCell: {
    flexBasis: "46%", flexGrow: 1, borderRadius: RADIUS.card, backgroundColor: P.card,
    paddingHorizontal: 14, paddingTop: 13, paddingBottom: 14, ...SHADOW, shadowOpacity: 0.04,
  },
  scheduleCellOn: { backgroundColor: P.ink },
  scheduleTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  scheduleDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: P.faint },
  scheduleDotOn: { backgroundColor: "#d9a77f" },
  scheduleLabel: { fontFamily: fontFamilies.sans.bold, fontSize: 16, color: P.ink },
  scheduleSub: { fontFamily: fontFamilies.sans.regular, fontSize: 12.5, color: P.mute, marginTop: 4 },

  endRow: { flexDirection: "row", borderRadius: RADIUS.pill, backgroundColor: P.track, padding: 4 },
  endCell: { flex: 1, height: 36, alignItems: "center", justifyContent: "center", borderRadius: RADIUS.pill },
  endCellBorder: {},
  endCellOn: { backgroundColor: P.card, ...SHADOW, shadowOpacity: 0.1 },
  endText: { fontFamily: fontFamilies.sans.semibold, fontSize: 13, color: P.mute },
  endTextOn: { color: P.ink },

  deleteBtn: {
    alignSelf: "stretch", height: 50, borderRadius: RADIUS.pill, alignItems: "center", justifyContent: "center",
    flexDirection: "row", gap: 8, backgroundColor: P.blush,
  },
  deleteText: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: P.terracotta },

  dock: {
    position: "absolute", left: 12, right: 12, bottom: 10, backgroundColor: "rgba(255,255,255,0.97)",
    borderRadius: RADIUS.sheet, paddingHorizontal: 16, paddingTop: 14, gap: 12,
    shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 22, shadowOffset: { width: 0, height: 8 }, elevation: 12,
  },
  readyRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  ticks: { flexDirection: "row", gap: 5 },
  tick: { width: 18, height: 6, borderRadius: 3, backgroundColor: P.track },
  tickOn: { backgroundColor: P.success },
  readyText: { flex: 1, fontFamily: fontFamilies.sans.semibold, fontSize: 13, color: P.body },
  readyWarn: { color: P.terracotta },
  readyCount: { fontFamily: fontFamilies.sans.semibold, fontSize: 12, color: P.mute },
  dockActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  saveDraft: { height: 52, paddingHorizontal: 20, borderRadius: RADIUS.pill, backgroundColor: P.track, alignItems: "center", justifyContent: "center" },
  saveDraftText: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: P.ink },
  primary: { flex: 1, height: 52, borderRadius: RADIUS.pill, backgroundColor: P.ink, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  primaryText: { fontFamily: fontFamilies.sans.semibold, fontSize: 15, color: P.paper },
  textAction: {
    fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: P.ink, height: 52, lineHeight: 52, paddingHorizontal: 18,
    borderRadius: RADIUS.pill, backgroundColor: P.track, overflow: "hidden", textAlign: "center",
  },
  textActionSmall: { fontFamily: fontFamilies.sans.semibold, fontSize: 13, color: P.ink },
  waitRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 18 },
  waitText: { fontFamily: fontFamilies.sans.semibold, fontSize: 13, color: P.body },
});
