/**
 * Seller: Runway Studio — the boutique's posts hub, laid out like a creator profile.
 *
 * Studio-mode bar, a cinematic banner with the store identity overlapping it,
 * a figures card, format highlights, a
 * scheduled / drafts / review strip, sticky icon tabs,
 * filter chips and an edge-to-edge three-column grid. Everything shown comes
 * from the seller's own looks and store record — no invented numbers.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing, FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withTiming,
} from "react-native-reanimated";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, type IonIconName } from "@/components/ui/Icon";
import { POSTS_ENABLED, sellerPostsApi } from "@/lib/posts/api";
import { STATUS_LABEL, type PostStatus, type SellerPostListItem } from "@/lib/posts/types";
import { getSellerStore } from "@/lib/api";
import { useAuth } from "@/lib/supabase/auth";
import type { Store } from "@/lib/types";
import { fontFamilies } from "@/lib/theme/fonts";
import { KICKER, P, RADIUS, RUNWAY_GRADIENT, SHADOW } from "@/components/seller/posts/palette";
import { CountUp, PulseDot, Shimmer, SpringPress, compactCount } from "@/components/seller/posts/motion";

type Tab = "grid" | "runway" | "drafts" | "archive";
type Filter = "all" | "queue";
type Format = "poster" | "carousel" | "film";

const TABS: { key: Tab; label: string; icon: IonIconName; status?: PostStatus }[] = [
  { key: "grid", label: "Posts", icon: "grid-outline" },
  { key: "runway", label: "Films", icon: "film-outline" },
  { key: "drafts", label: "Drafts", icon: "document-text-outline", status: "draft" },
  { key: "archive", label: "Archive", icon: "archive-outline", status: "archived" },
];

const PAGE = 16;
const TILE_GAP = 2;
const display = fontFamilies.display.semibold;
const italic = fontFamilies.display.italic;
const mono = fontFamilies.mono.medium;
const monoBold = fontFamilies.mono.semibold;

const toneFor = (status: PostStatus) =>
  status === "published" ? P.success : status === "rejected" ? P.terracotta : status === "in_review" || status === "processing" ? P.champagne : P.mute;

const coverUri = (p: SellerPostListItem) =>
  p.cover?.media_type === "video" ? p.cover.poster_url : p.cover?.url;

const kindName = (p: SellerPostListItem) =>
  p.kind === "reel" ? "Runway film" : p.kind === "carousel" ? "Carousel" : "Poster";

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

const isScheduled = (p: SellerPostListItem) =>
  p.status === "published" && !!p.publish_at && new Date(p.publish_at) > new Date();
const isLive = (p: SellerPostListItem) => p.status === "published" && !isScheduled(p) && !p.hidden_reason;

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** "Fri 6 PM" / "Fri 6:30 PM" — no Intl dependency. */
function shortWhen(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes();
  const hh = h % 12 || 12;
  return `${DAYS[d.getDay()]} ${hh}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "AM" : "PM"}`;
}

type Totals = {
  posts: number;
  more: boolean;
  views: number;
  taps: number;
  live: number;
  drafts: number;
  review: number;
  scheduled: number;
  nextAt: string | null;
  untagged: number;
  pinned: SellerPostListItem | null;
  hero: string | null;
  /** Latest cover per format, for the highlights row. */
  covers: Partial<Record<Format, string>>;
};

function summarise(list: SellerPostListItem[], more: boolean): Totals {
  const covers: Totals["covers"] = {};
  let nextAt: string | null = null;
  for (const p of list) {
    const f: Format = p.kind === "reel" ? "film" : p.kind === "carousel" ? "carousel" : "poster";
    const uri = coverUri(p);
    if (uri && !covers[f]) covers[f] = uri;
    if (isScheduled(p) && (!nextAt || p.publish_at! < nextAt)) nextAt = p.publish_at!;
  }
  const live = list.filter(isLive);
  const pinned = live.find((p) => p.pinned_at && coverUri(p)) ?? null;
  return {
    posts: list.length,
    more,
    views: list.reduce((s, p) => s + (p.views_count ?? 0), 0),
    taps: list.reduce((s, p) => s + (p.clicks_count ?? 0), 0),
    live: live.length,
    drafts: list.filter((p) => p.status === "draft").length,
    review: list.filter((p) => p.status === "in_review" || p.status === "processing").length,
    scheduled: list.filter(isScheduled).length,
    nextAt,
    untagged: live.filter((p) => !p.tag_count).length,
    pinned,
    hero: (pinned && coverUri(pinned)) ?? (live.map(coverUri).find(Boolean) ?? null),
    covers,
  };
}

export default function SellerPostsScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ tab?: string; t?: string }>();
  const [store, setStore] = useState<Store | null>(null);
  const [tab, setTab] = useState<Tab>("grid");
  const [filter, setFilter] = useState<Filter>("all");
  const [items, setItems] = useState<SellerPostListItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totals, setTotals] = useState<Totals | null>(null);
  const loadingMore = useRef(false);
  const current = TABS.find((t) => t.key === tab)!;
  const tile = (width - TILE_GAP * 2) / 3;

  useEffect(() => {
    if (!user?.id) return;
    getSellerStore(user.id).then((r) => setStore(r.ok ? r.data : null)).catch(() => undefined);
  }, [user?.id]);

  const load = useCallback(async (before?: string) => {
    setError(null);
    try {
      const d = await sellerPostsApi.list({ status: current.status, before, limit: 30 });
      setItems((prev) => {
        const next = before ? [...prev, ...d.items] : d.items;
        if (tab === "grid") setTotals(summarise(next, !!d.next_cursor));
        return next;
      });
      setCursor(d.next_cursor);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
      loadingMore.current = false;
    }
  }, [tab, current.status]);

  useFocusEffect(useCallback(() => { setLoading(true); void load(); }, [load]));

  const changeTab = useCallback((t: Tab) => {
    if (t === tab) return;
    setItems([]);
    setCursor(null);
    setLoading(true);
    setFilter("all");
    setTab(t);
  }, [tab]);

  // Deep link from the composer: /(seller)/posts?tab=drafts&t=<nonce>.
  const handledParam = useRef<string | null>(null);
  useEffect(() => {
    const t = TABS.find((x) => x.key === params.tab)?.key;
    const key = `${params.tab}:${params.t}`;
    if (t && handledParam.current !== key) {
      handledParam.current = key;
      changeTab(t);
    }
  }, [params.tab, params.t, changeTab]);

  const loadMore = useCallback(() => {
    if (!cursor || loadingMore.current) return;
    loadingMore.current = true;
    void load(cursor);
  }, [cursor, load]);

  const shown = useMemo(() => {
    let list = tab === "runway" ? items.filter((p) => p.kind === "reel") : items;
    if (tab === "grid" && filter === "queue") list = list.filter((p) => !isLive(p));
    return list;
  }, [items, tab, filter]);
  const tall = tab === "runway";
  const rate = totals?.views ? Math.round((totals.taps / totals.views) * 1000) / 10 : 0;

  // "+" goes straight to the upload page (it has its own POST | REEL switch).
  const create = () => router.push(`/(seller)/posts/new?t=${Date.now()}`);
  // Nonce keeps each pick a fresh navigation, so the upload page opens the picker once.
  const pickFormat = (f: Format) => {
    router.push(`/(seller)/posts/new?mode=${f}&t=${Date.now()}`);
  };
  const open = (id: string) => router.push(`/(seller)/posts/${id}`);
  const viewStore = () => store?.slug && router.push(`/stores/${store.slug}`);
  const showQueue = () => { changeTab("grid"); setFilter("queue"); };

  if (!POSTS_ENABLED) {
    return (
      <View style={{ flex: 1, backgroundColor: P.paper, paddingTop: insets.top + 40 }}>
        <EmptyState tab="grid" onAction={create} title="Posts are coming soon" sub="This part of Runway is not open yet." />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: P.paper }}>
      <StatusBar style="dark" />

      <TopBar
        top={insets.top}
        store={store}
        onBack={() => (router.canGoBack() ? router.back() : router.replace("/(seller)/more"))}
        onWatch={() => {
          const first = items.find((p) => p.kind === "reel" && p.status === "published");
          if (first) router.push(`/(seller)/posts/${first.id}` as any);
        }}
        onCreate={create}
      />

      <ScrollView
        onScroll={({ nativeEvent }) => {
          if (nativeEvent.contentSize.height - nativeEvent.contentOffset.y - nativeEvent.layoutMeasurement.height < 700) loadMore();
        }}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}
        contentContainerStyle={{ paddingBottom: insets.bottom + 48 }}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={P.ink} onRefresh={() => { setRefreshing(true); void load(); }} />}>
        <View>
          <Hero store={store} totals={totals} onWatch={() => router.push("/reels")} />
          <Identity store={store} onEdit={() => router.push("/(seller)/settings")} onViewStore={viewStore} />
          <Figures store={store} totals={totals} rate={rate} />
          <Bio store={store} onViewStore={viewStore} />
          <Actions onPost={create} onReel={() => pickFormat("film")} onQueue={showQueue} />
          <Highlights
            covers={totals?.covers ?? {}}
            logo={store?.logo_url ?? null}
            onNew={create}
            onPick={pickFormat}
            onDrafts={() => changeTab("drafts")}
          />
          <StatusStrip totals={totals} onScheduled={showQueue} onDrafts={() => changeTab("drafts")} onReview={showQueue} />
        </View>

        <IconTabs value={tab} width={width} onChange={changeTab} />

        {loading && !items.length ? (
          <View style={styles.grid}>
            {Array.from({ length: 9 }, (_, i) => (
              <Shimmer key={i} delay={i * 50} style={{ width: tile, aspectRatio: tall ? 9 / 16 : 4 / 5 }} />
            ))}
          </View>
        ) : error && !items.length ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}><Ionicons name="cloud-offline-outline" size={26} color={P.ink} /></View>
            <Text style={styles.emptyTitle}>Couldn’t load your looks</Text>
            <Text style={styles.emptySub}>{error}</Text>
            <SpringPress onPress={() => { setLoading(true); void load(); }} accessibilityRole="button" style={styles.emptyCta}>
              <Text style={styles.emptyCtaText}>Try again</Text>
              <Ionicons name="refresh" size={15} color={P.paper} />
            </SpringPress>
          </View>
        ) : !items.length ? (
          <EmptyState tab={tab} onAction={create} />
        ) : (
          <Animated.View key={`${tab}:${filter}`} entering={FadeIn.duration(260)}>
            {tab === "grid" ? (
              <View style={styles.filters}>
                <Chip on={filter === "all"} label={`All ${totals?.posts ?? items.length}${totals?.more ? "+" : ""}`} onPress={() => setFilter("all")} />
                <Chip on={filter === "queue"} icon="time-outline" label="Queue" onPress={() => setFilter("queue")} />
                <View style={{ flex: 1 }} />
                <View style={styles.sortRow}>
                  <Ionicons name="swap-vertical" size={14} color={P.mute} />
                  <Text style={styles.sortText}>Recent</Text>
                </View>
              </View>
            ) : null}

            {shown.length ? (
              <View style={styles.grid}>
                {shown.map((p, i) => (
                  <Tile key={p.id} p={p} size={tile} tall={tall} order={i} onPress={() => open(p.id)} />
                ))}
              </View>
            ) : (
              <View style={styles.queueEmpty}>
                <Ionicons name="checkmark-done-outline" size={20} color={P.mute} />
                <Text style={styles.queueEmptyText}>Nothing waiting — every look is live.</Text>
              </View>
            )}

            {tab === "grid" ? <Tip totals={totals} onDrafts={() => changeTab("drafts")} onCreate={create} /> : null}

            {!cursor && shown.length > 3 ? (
              <View style={styles.caughtUp}>
                <View style={styles.caughtLine} />
                <Text style={styles.caughtUpText}>ALL CAUGHT UP</Text>
                <View style={styles.caughtLine} />
              </View>
            ) : null}
          </Animated.View>
        )}
      </ScrollView>

    </View>
  );
}

/* ───────────────────────── chrome ───────────────────────── */

function TopBar({ top, store, onBack, onWatch, onCreate }: {
  top: number; store: Store | null; onBack: () => void; onWatch: () => void; onCreate: () => void;
}) {
  const storeName = store?.name ? `${store.name} Studio` : "Aura Studio";
  return (
    <View style={[styles.top, { paddingTop: top + 6 }]}>
      <Pressable onPress={onBack} style={styles.topBackBtn} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8}>
        <Ionicons name="chevron-back" size={20} color={P.ink} />
        <Text style={styles.topBackText}>Studio</Text>
      </Pressable>
      <View style={styles.topTitleWrap}>
        <Text style={styles.topTitleText} numberOfLines={1}>{storeName}</Text>
        <View style={styles.topVerifiedCircle}>
          <Ionicons name="checkmark" size={10} color="#ffffff" />
        </View>
      </View>
      <View style={styles.topActions}>
        <SpringPress onPress={onWatch} style={styles.topPlayBtn} accessibilityRole="button" accessibilityLabel="Watch films" hitSlop={6}>
          <Ionicons name="play" size={13} color={P.ink} style={{ marginLeft: 2 }} />
        </SpringPress>
        <SpringPress onPress={onCreate} style={styles.topAddBtn} accessibilityRole="button" accessibilityLabel="New look" hitSlop={6}>
          <Ionicons name="add" size={20} color="#ffffff" />
        </SpringPress>
      </View>
    </View>
  );
}

/** Banner: store banner, else the pinned / latest live cover, else a warm gradient. */
function Hero({ store, totals, onWatch }: { store: Store | null; totals: Totals | null; onWatch: () => void }) {
  const uri = store?.banner_url || totals?.hero || null;
  const first = store?.description?.split(/[.,\n]/)[0]?.trim() ?? "";
  const headline = first && first.length <= 30 ? first : first.split(/\s+/).slice(0, 3).join(" ") || "Every piece, shoppable";
  return (
    <Animated.View entering={FadeInDown.duration(420)} style={styles.heroWrap}>
      <View style={styles.hero}>
        {uri ? (
          <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} />
        ) : (
          <LinearGradient colors={["#e9a66b", P.coral, "#8f3b1d"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        )}
        <LinearGradient pointerEvents="none" colors={["rgba(0,0,0,0.18)", "rgba(0,0,0,0)", "rgba(0,0,0,0.62)"]} locations={[0, 0.35, 1]} style={StyleSheet.absoluteFill} />

        <View style={styles.heroTop}>
          <View style={styles.heroChip}>
            <Ionicons name="flame" size={12} color={P.coralDeep} />
            <Text style={styles.heroChipText}>{totals?.live ?? 0} live</Text>
          </View>
          {store?.delivery_city ? (
            <View style={[styles.heroChip, styles.heroChipGlass]}>
              <Ionicons name="location" size={11} color={P.paper} />
              <Text style={[styles.heroChipText, { color: P.paper }]}>{store.delivery_city}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.heroBottom}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.heroKicker}>RUNWAY — {totals?.posts ?? 0}{totals?.more ? "+" : ""} {plural(totals?.posts ?? 0, "LOOK", "LOOKS")}</Text>
            <Text style={styles.heroTitle} numberOfLines={2}>{headline}.</Text>
          </View>
          <SpringPress onPress={onWatch} style={styles.heroFilm} accessibilityRole="button" accessibilityLabel="Watch Runway">
            <Ionicons name="play" size={12} color={P.ink} />
            <Text style={styles.heroFilmText}>Film</Text>
          </SpringPress>
        </View>
      </View>
    </Animated.View>
  );
}

/** Rounded-square avatar inside a warm gradient frame. */
function SquareFrame({ size, radius, children }: { size: number; radius: number; children: ReactNode }) {
  const t = 3;
  return (
    <LinearGradient colors={RUNWAY_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={{ width: size, height: size, borderRadius: radius, padding: t }}>
      <View style={{ flex: 1, borderRadius: radius - t, backgroundColor: P.paper, padding: 3 }}>
        <View style={{ flex: 1, borderRadius: radius - t - 3, overflow: "hidden", backgroundColor: P.ink }}>{children}</View>
      </View>
    </LinearGradient>
  );
}

function Identity({ store, onEdit, onViewStore }: { store: Store | null; onEdit: () => void; onViewStore: () => void }) {
  const name = store?.name ?? "Your boutique";
  const verified = store?.status === "approved";
  return (
    <View style={styles.identity}>
      <View>
        <SquareFrame size={88} radius={26}>
          {store?.logo_url ? (
            <Image source={{ uri: store.logo_url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
          ) : (
            <View style={styles.avatarFallback}><Text style={styles.avatarText}>{name.slice(0, 1).toUpperCase()}</Text></View>
          )}
        </SquareFrame>
        {verified ? (
          <View style={styles.verified}><Ionicons name="checkmark" size={13} color={P.paper} /></View>
        ) : null}
      </View>
      <Pressable onPress={onViewStore} style={styles.identityText} accessibilityRole="link" accessibilityLabel={`${name}, view store`}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          {verified ? <Ionicons name="checkmark-circle" size={16} color={P.coral} /> : null}
        </View>
        <Text style={styles.handle} numberOfLines={1}>@{store?.slug ?? "your-store"} · Boutique</Text>
      </Pressable>
      <SpringPress onPress={onEdit} style={styles.editBtn} accessibilityRole="button" accessibilityLabel="Edit store">
        <Ionicons name="create-outline" size={14} color={P.ink} />
        <Text style={styles.editText}>Edit</Text>
      </SpringPress>
    </View>
  );
}

function Figures({ store, totals, rate }: { store: Store | null; totals: Totals | null; rate: number }) {
  const cells = [
    { value: store?.total_followers ?? 0, label: "Followers", sub: null as string | null },
    { value: totals?.views ?? 0, label: "Reach", sub: totals?.views ? `${rate}% tap` : null },
    { value: store?.total_sales ?? 0, label: "Shop sales", sub: null },
  ];
  return (
    <Animated.View entering={FadeInDown.delay(80).duration(420)} style={styles.figures}>
      {cells.map((c, i) => (
        <View key={c.label} style={[styles.figure, i === 1 && styles.figureMid]}>
          <CountUp value={c.value} format={compactCount} delay={140 + i * 90} style={styles.figureValue} />
          <Text style={styles.figureLabel} numberOfLines={1}>
            {c.label}{c.sub ? <Text style={{ color: P.coralDeep }}> · {c.sub}</Text> : null}
          </Text>
        </View>
      ))}
    </Animated.View>
  );
}

function Bio({ store, onViewStore }: { store: Store | null; onViewStore: () => void }) {
  const text = store?.description?.trim() || "Your looks, filmed and photographed. Every piece in them, shoppable.";
  return (
    <View style={styles.bio}>
      <Text style={styles.dek} numberOfLines={3}>
        {text}{" "}
        {store?.slug ? <Text style={styles.link} onPress={onViewStore}>#{store.slug.replace(/-/g, "")}</Text> : null}
      </Text>
    </View>
  );
}

function Actions({ onPost, onReel, onQueue }: { onPost: () => void; onReel: () => void; onQueue: () => void }) {
  return (
    <View style={styles.actions}>
      <SpringPress onPress={onPost} accessibilityRole="button" accessibilityLabel="New post" style={styles.primaryBtn}>
        <Ionicons name="add" size={18} color={P.paper} />
        <Text style={styles.primaryText}>New post</Text>
      </SpringPress>
      <SpringPress onPress={onReel} accessibilityRole="button" accessibilityLabel="New film" style={styles.secondaryBtn}>
        <Ionicons name="film-outline" size={17} color={P.ink} />
        <Text style={styles.secondaryText}>New film</Text>
      </SpringPress>
      <SpringPress onPress={onQueue} accessibilityRole="button" accessibilityLabel="Queue" style={styles.squareBtn}>
        <Ionicons name="calendar-outline" size={19} color={P.ink} />
      </SpringPress>
    </View>
  );
}

function Highlights({ covers, logo, onNew, onPick, onDrafts }: {
  covers: Totals["covers"];
  logo: string | null;
  onNew: () => void;
  onPick: (f: Format) => void;
  onDrafts: () => void;
}) {
  const list: { key: string; label: string; icon: IonIconName; uri?: string; onPress: () => void }[] = [
    { key: "poster", label: "POSTER", icon: "image-outline", uri: covers.poster, onPress: () => onPick("poster") },
    { key: "carousel", label: "CAROUSEL", icon: "copy-outline", uri: covers.carousel, onPress: () => onPick("carousel") },
    { key: "film", label: "FILM", icon: "film-outline", uri: covers.film, onPress: () => onPick("film") },
    { key: "drafts", label: "DRAFTS", icon: "document-text-outline", uri: logo ?? undefined, onPress: onDrafts },
  ];
  return (
    <Animated.View entering={FadeInDown.delay(200).duration(420)}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hlRow}>
        {list.map((h) => (
          <View key={h.key} style={styles.hl}>
            <SpringPress onPress={h.onPress} accessibilityRole="button" accessibilityLabel={h.label.toLowerCase()} style={styles.hlFrame}>
              <View style={styles.hlInner}>
                {h.uri ? (
                  <>
                    <Image source={{ uri: h.uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
                    <View style={styles.hlBadge}><Ionicons name={h.icon} size={10} color={P.paper} /></View>
                  </>
                ) : (
                  <LinearGradient colors={[P.blush, P.champagneSoft]} style={[StyleSheet.absoluteFill, styles.center]}>
                    <Ionicons name={h.icon} size={20} color={P.coralDeep} />
                  </LinearGradient>
                )}
              </View>
            </SpringPress>
            <Text style={styles.hlLabel}>{h.label}</Text>
          </View>
        ))}
        <View style={styles.hl}>
          <SpringPress onPress={onNew} accessibilityRole="button" accessibilityLabel="New look" style={styles.hlNew}>
            <Ionicons name="add" size={24} color={P.body} />
          </SpringPress>
          <Text style={styles.hlLabel}>NEW</Text>
        </View>
      </ScrollView>
    </Animated.View>
  );
}

function StatusStrip({ totals, onScheduled, onDrafts, onReview }: {
  totals: Totals | null; onScheduled: () => void; onDrafts: () => void; onReview: () => void;
}) {
  const cells: { key: string; icon: IonIconName; title: string; sub: string; accent?: boolean; dot?: boolean; onPress: () => void }[] = [
    {
      key: "scheduled", icon: "calendar-outline",
      title: `${totals?.scheduled ?? 0} scheduled`,
      sub: totals?.nextAt ? shortWhen(totals.nextAt) : "None yet",
      accent: !!totals?.scheduled, onPress: onScheduled,
    },
    {
      key: "drafts", icon: "layers-outline",
      title: `${totals?.drafts ?? 0} ${plural(totals?.drafts ?? 0, "draft", "drafts")}`,
      sub: totals?.drafts ? "Finish up" : "All done",
      dot: !!totals?.drafts, onPress: onDrafts,
    },
    {
      key: "review", icon: "shield-checkmark-outline",
      title: `${totals?.review ?? 0} in review`,
      sub: totals?.review ? "In minutes" : "All clear",
      onPress: onReview,
    },
  ];
  return (
    <Animated.View entering={FadeInDown.delay(240).duration(420)} style={styles.strip}>
      {cells.map((c, i) => (
        <SpringPress key={c.key} onPress={c.onPress} scaleTo={0.97} accessibilityRole="button" accessibilityLabel={`${c.title}, ${c.sub}`}
          style={[styles.stripCell, i === 0 && styles.stripCellFirst, i > 0 && styles.stripDivider]}>
          <Ionicons name={c.icon} size={15} color={P.ink} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <Text style={styles.stripTitle} numberOfLines={1}>{c.title}</Text>
              {c.dot ? <View style={styles.stripDot} /> : null}
            </View>
            <Text style={[styles.stripSub, (c.accent || c.dot) && { color: P.coralDeep }]} numberOfLines={1}>{c.sub}</Text>
          </View>
        </SpringPress>
      ))}
    </Animated.View>
  );
}

function IconTabs({ value, width, onChange }: { value: Tab; width: number; onChange: (t: Tab) => void }) {
  const tabW = width / TABS.length;
  const idx = TABS.findIndex((t) => t.key === value);
  const x = useSharedValue(idx * tabW);
  useEffect(() => {
    x.value = withTiming(idx * tabW, { duration: 280, easing: Easing.out(Easing.cubic) });
  }, [idx, tabW, x]);
  const ind = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <View style={styles.tabs}>
      {TABS.map((t) => {
        const on = t.key === value;
        return (
          <Pressable key={t.key} onPress={() => onChange(t.key)} style={[styles.tab, { width: tabW }]}
            accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={t.label}>
            <Ionicons name={t.icon} size={22} color={on ? P.ink : P.faint} />
          </Pressable>
        );
      })}
      <Animated.View pointerEvents="none" style={[styles.tabIndicatorWrap, { width: tabW }, ind]}>
        <View style={styles.tabIndicator} />
      </Animated.View>
    </View>
  );
}

/* ───────────────────────── content ───────────────────────── */

function Chip({ on, label, icon, onPress }: { on: boolean; label: string; icon?: IonIconName; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }}
      style={[styles.chip, on && styles.chipOn]}>
      {icon ? <Ionicons name={icon} size={14} color={on ? P.paper : P.ink} /> : null}
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

function Tile({ p, size, tall, order, onPress }: {
  p: SellerPostListItem; size: number; tall: boolean; order: number; onPress: () => void;
}) {
  const uri = coverUri(p);
  const scheduled = isScheduled(p);
  const live = isLive(p);
  const label = p.hidden_reason ? "Hidden" : STATUS_LABEL[p.status];
  const tone = p.hidden_reason ? P.terracotta : toneFor(p.status);
  const pulsing = p.status === "processing" || p.status === "in_review";
  const views = p.views_count ?? 0;
  return (
    <Animated.View entering={FadeIn.delay(Math.min(order, 9) * 40).duration(320)} style={{ width: size }}>
      <SpringPress onPress={onPress} scaleTo={0.96}
        accessibilityRole="button"
        accessibilityLabel={`${scheduled ? "Scheduled" : label} ${kindName(p)}${p.caption ? `: ${p.caption.slice(0, 48)}` : ""}`}>
        <View style={[styles.tileFrame, { aspectRatio: tall ? 9 / 16 : 4 / 5 }]}>
          {uri ? (
            <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.center]}>
              <Ionicons name={p.kind === "reel" ? "film-outline" : "image-outline"} size={22} color={P.faint} />
            </View>
          )}
          <LinearGradient pointerEvents="none" colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.42)"]} locations={[0.62, 1]} style={StyleSheet.absoluteFill} />

          {!live && !scheduled ? (
            <View style={styles.tileStatus}>
              {pulsing ? <PulseDot color={tone} size={5} /> : <View style={[styles.statusDot, { backgroundColor: tone }]} />}
              <Text style={styles.tileStatusText} numberOfLines={1}>{label.toUpperCase()}</Text>
            </View>
          ) : null}

          <View style={styles.tileIcons}>
            {p.pinned_at ? <View style={styles.tileIcon}><Ionicons name="pin" size={11} color={P.paper} /></View> : null}
            {p.kind === "reel" ? <View style={styles.tileIcon}><Ionicons name="play" size={10} color={P.paper} style={{ marginLeft: 1 }} /></View> : null}
            {p.kind === "carousel" ? <View style={styles.tileIcon}><Ionicons name="copy" size={10} color={P.paper} /></View> : null}
          </View>

          <View style={styles.tileFoot}>
            {scheduled ? (
              <View style={styles.tilePill}>
                <Ionicons name="calendar" size={10} color={P.ink} />
                <Text style={styles.tilePillText}>{shortWhen(p.publish_at!)}</Text>
              </View>
            ) : live && p.tag_count ? (
              <View style={styles.tilePill}>
                <Ionicons name="bag-handle" size={10} color={P.ink} />
                <Text style={styles.tilePillText}>Shop</Text>
              </View>
            ) : <View />}
            {live ? (
              <View style={styles.tileViews}>
                <Ionicons name="eye-outline" size={11} color={P.paper} />
                <Text style={styles.tileViewsText}>{compactCount(views)}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </SpringPress>
    </Animated.View>
  );
}

/** One real, actionable nudge from the seller's own looks (or nothing). */
function Tip({ totals, onDrafts, onCreate }: { totals: Totals | null; onDrafts: () => void; onCreate: () => void }) {
  if (!totals) return null;
  const tip = totals.drafts
    ? { title: `Finish ${totals.drafts} ${plural(totals.drafts, "draft", "drafts")}`, sub: "They are one tap from your storefront.", cta: "Open", onPress: onDrafts }
    : totals.untagged
      ? { title: `Tag pieces in ${totals.untagged} ${plural(totals.untagged, "look", "looks")}`, sub: "Looks with tagged pieces are the ones shoppers can buy from.", cta: "Fix", onPress: onDrafts }
      : !totals.covers.film
        ? { title: "Post your first film", sub: "Vertical films lead the Runway feed shoppers scroll.", cta: "Start", onPress: onCreate }
        : null;
  if (!tip) return null;
  return (
    <Animated.View entering={FadeInDown.delay(120).duration(380)} style={styles.tipWrap}>
      <View style={styles.tip}>
        <View style={styles.tipIcon}><Ionicons name="sparkles" size={16} color={P.ink} /></View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.tipTitle}>{tip.title}</Text>
          <Text style={styles.tipSub}>{tip.sub}</Text>
        </View>
        <SpringPress onPress={tip.onPress} style={styles.tipBtn} accessibilityRole="button">
          <Text style={styles.tipBtnText}>{tip.cta}</Text>
        </SpringPress>
      </View>
    </Animated.View>
  );
}

function EmptyState({ tab, onAction, title, sub }: {
  tab: Tab; onAction: () => void; title?: string; sub?: string;
}) {
  const copy: Record<Tab, { title: string; sub: string; cta: string; icon: IonIconName }> = {
    grid: {
      title: "Your runway is empty",
      sub: "Use the posters and films you already made for Instagram. Tag the pieces inside and they become shoppable here.",
      cta: "Create your first look",
      icon: "sparkles-outline",
    },
    runway: {
      title: "No films yet",
      sub: "Vertical, up to ninety seconds. Shoppers watch, tap the bag, and buy without leaving the film.",
      cta: "Upload a film",
      icon: "film-outline",
    },
    drafts: {
      title: "No drafts",
      sub: "Looks you start but do not publish wait here until you are ready to share them.",
      cta: "Start a look",
      icon: "document-text-outline",
    },
    archive: {
      title: "Nothing archived",
      sub: "Retired looks live here — out of the storefront, still counted in your numbers.",
      cta: "Create a look",
      icon: "archive-outline",
    },
  };
  const c = copy[tab];
  return (
    <Animated.View entering={FadeInDown.duration(380)} style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={c.icon} size={26} color={P.ink} />
        <View style={styles.emptyIconPlus}><Ionicons name="add" size={12} color={P.paper} /></View>
      </View>
      <Text style={styles.emptyTitle}>{title ?? c.title}</Text>
      <Text style={styles.emptySub}>{sub ?? c.sub}</Text>
      <SpringPress onPress={onAction} accessibilityRole="button" style={styles.emptyCta}>
        <Text style={styles.emptyCtaText}>{c.cta}</Text>
        <Ionicons name="arrow-forward" size={15} color={P.paper} />
      </SpringPress>
    </Animated.View>
  );
}

/* ───────────────────────── styles ───────────────────────── */

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  kicker: { fontFamily: mono, ...KICKER, color: P.mute },
  statusDot: { width: 6, height: 6, borderRadius: 3 },

  top: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: PAGE, paddingBottom: 10, gap: 8,
    backgroundColor: P.paper,
  },
  topBackBtn: { flexDirection: "row", alignItems: "center", gap: 2, paddingVertical: 4, paddingRight: 6 },
  topBackText: { fontFamily: fontFamilies.sans.medium, fontSize: 16, color: P.ink },
  topTitleWrap: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  topTitleText: { fontFamily: italic, fontSize: 18, color: P.ink },
  topVerifiedCircle: { width: 15, height: 15, borderRadius: 7.5, backgroundColor: P.ink, alignItems: "center", justifyContent: "center" },
  topActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  topPlayBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: P.card, borderWidth: 1, borderColor: P.border, alignItems: "center", justifyContent: "center" },
  topAddBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: P.ink, alignItems: "center", justifyContent: "center" },
  roundBtn: {
    width: 42, height: 42, borderRadius: RADIUS.pill, alignItems: "center", justifyContent: "center",
    backgroundColor: P.card, borderWidth: 1, borderColor: P.border, ...SHADOW, shadowOpacity: 0.05,
  },
  roundBtnLime: { backgroundColor: P.lime, borderColor: "transparent" },
  modePill: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 7, height: 36, paddingLeft: 12, paddingRight: 4,
    borderRadius: RADIUS.pill, backgroundColor: P.card, borderWidth: 1, borderColor: P.border,
  },
  modeText: { flex: 1, fontFamily: fontFamilies.sans.semibold, fontSize: 12.5, color: P.ink },
  modeTag: { height: 26, paddingHorizontal: 9, borderRadius: RADIUS.pill, backgroundColor: P.ink, justifyContent: "center" },
  modeTagText: { fontFamily: monoBold, fontSize: 9, letterSpacing: 1.4, color: P.lime },

  heroWrap: { paddingHorizontal: PAGE, paddingTop: 4 },
  hero: { height: 196, borderRadius: 28, overflow: "hidden", backgroundColor: P.warm, justifyContent: "space-between", padding: 14 },
  heroTop: { flexDirection: "row", gap: 6 },
  heroChip: {
    flexDirection: "row", alignItems: "center", gap: 5, height: 26, paddingHorizontal: 10, borderRadius: RADIUS.pill,
    backgroundColor: "rgba(255,255,255,0.95)",
  },
  heroChipGlass: { backgroundColor: "rgba(0,0,0,0.32)", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" },
  heroChipText: { fontFamily: fontFamilies.sans.bold, fontSize: 12, color: P.ink },
  heroBottom: { flexDirection: "row", alignItems: "flex-end", gap: 12, paddingLeft: 92 },
  heroKicker: { fontFamily: mono, fontSize: 9.5, letterSpacing: 1.8, color: "rgba(255,255,255,0.82)" },
  heroTitle: { fontFamily: italic, fontSize: 21, lineHeight: 25, letterSpacing: -0.4, color: P.paper },
  heroFilm: {
    flexDirection: "row", alignItems: "center", gap: 5, height: 32, paddingHorizontal: 12, borderRadius: RADIUS.pill,
    backgroundColor: P.paper,
  },
  heroFilmText: { fontFamily: fontFamilies.sans.bold, fontSize: 13, color: P.ink },

  identity: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: PAGE + 8, marginTop: -40 },
  avatarFallback: { flex: 1, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: display, fontSize: 36, color: P.champagneSoft },
  verified: {
    position: "absolute", right: -5, bottom: -5, width: 26, height: 26, borderRadius: 13,
    backgroundColor: P.success, borderWidth: 3, borderColor: P.paper, alignItems: "center", justifyContent: "center",
  },
  identityText: { flex: 1, minWidth: 0, paddingTop: 48, gap: 2 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  name: { flexShrink: 1, fontFamily: display, fontSize: 22, lineHeight: 27, letterSpacing: -0.5, color: P.ink },
  handle: { fontFamily: fontFamilies.sans.regular, fontSize: 13, color: P.mute },
  editBtn: {
    flexDirection: "row", alignItems: "center", gap: 5, height: 34, paddingHorizontal: 13, marginTop: 52,
    borderRadius: RADIUS.pill, backgroundColor: P.card, borderWidth: 1, borderColor: P.borderStrong,
  },
  editText: { fontFamily: fontFamilies.sans.bold, fontSize: 13, color: P.ink },

  figures: {
    flexDirection: "row", marginHorizontal: PAGE, marginTop: 16, borderRadius: 20, backgroundColor: P.card,
    borderWidth: 1, borderColor: P.border, overflow: "hidden",
  },
  figure: { flex: 1, alignItems: "center", paddingVertical: 13, gap: 3 },
  figureMid: { backgroundColor: P.paper, borderLeftWidth: 1, borderRightWidth: 1, borderColor: P.border },
  figureValue: { fontFamily: display, fontSize: 21, letterSpacing: -0.4, color: P.ink },
  figureLabel: { fontFamily: fontFamilies.sans.medium, fontSize: 11.5, color: P.mute },

  bio: { paddingHorizontal: PAGE + 2, marginTop: 14 },
  dek: { fontFamily: fontFamilies.sans.regular, fontSize: 14.5, lineHeight: 21, color: P.body },
  link: { fontFamily: fontFamilies.sans.bold, color: P.coralDeep },

  actions: { flexDirection: "row", gap: 8, marginTop: 16, paddingHorizontal: PAGE },
  primaryBtn: {
    flex: 1, height: 48, borderRadius: 15, backgroundColor: P.ink, flexDirection: "row", gap: 6,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 4,
  },
  primaryText: { fontFamily: fontFamilies.sans.bold, fontSize: 15, color: P.paper },
  secondaryBtn: {
    flex: 1, height: 48, borderRadius: 15, backgroundColor: P.card, borderWidth: 1.5, borderColor: P.ink,
    flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center",
  },
  secondaryText: { fontFamily: fontFamilies.sans.bold, fontSize: 15, color: P.ink },
  squareBtn: {
    width: 48, height: 48, borderRadius: 15, backgroundColor: P.warm, borderWidth: 1, borderColor: P.border,
    alignItems: "center", justifyContent: "center",
  },

  hlRow: { paddingHorizontal: PAGE - 2, gap: 12, paddingTop: 20, paddingBottom: 16 },
  hl: { alignItems: "center", gap: 7, width: 72 },
  hlNew: {
    width: 70, height: 70, borderRadius: 35, borderWidth: 1.5, borderStyle: "dashed", borderColor: P.faint,
    alignItems: "center", justifyContent: "center",
  },
  hlFrame: {
    width: 70, height: 70, borderRadius: 35, padding: 3, backgroundColor: P.card,
    borderWidth: 1.5, borderColor: P.champagne,
  },
  hlInner: { flex: 1, borderRadius: 32, overflow: "hidden", backgroundColor: P.warm },
  hlBadge: {
    position: "absolute", right: 8, bottom: 6, width: 18, height: 18, borderRadius: 9,
    backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center",
  },
  hlLabel: { fontFamily: mono, fontSize: 9.5, letterSpacing: 1.4, color: P.body },

  strip: {
    flexDirection: "row", marginHorizontal: PAGE, marginBottom: 18, borderRadius: 20, backgroundColor: P.card,
    borderWidth: 1, borderColor: P.border, overflow: "hidden",
  },
  stripCell: { flex: 1, flexDirection: "row", alignItems: "center", gap: 7, paddingVertical: 12, paddingHorizontal: 9 },
  stripCellFirst: { backgroundColor: P.warm },
  stripDivider: { borderLeftWidth: 1, borderLeftColor: P.border },
  stripTitle: { flexShrink: 1, fontFamily: fontFamilies.sans.bold, fontSize: 12.5, color: P.ink },
  stripSub: { fontFamily: fontFamilies.sans.regular, fontSize: 11.5, color: P.mute, marginTop: 1 },
  stripDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: P.coral },

  tabs: {
    flexDirection: "row", height: 52, backgroundColor: P.paper,
    borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: P.borderStrong,
  },
  tab: { alignItems: "center", justifyContent: "center" },
  tabIndicatorWrap: { position: "absolute", bottom: -1, left: 0, alignItems: "center" },
  tabIndicator: { width: 34, height: 3.5, borderTopLeftRadius: 3, borderTopRightRadius: 3, backgroundColor: P.coral },

  filters: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: PAGE, paddingTop: 14, paddingBottom: 12 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 5, height: 34, paddingHorizontal: 14, borderRadius: RADIUS.pill,
    backgroundColor: P.card, borderWidth: 1, borderColor: P.borderStrong,
  },
  chipOn: { backgroundColor: P.ink, borderColor: P.ink },
  chipText: { fontFamily: fontFamilies.sans.bold, fontSize: 13, color: P.ink },
  chipTextOn: { color: P.paper },
  sortRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  sortText: { fontFamily: fontFamilies.sans.semibold, fontSize: 12.5, color: P.mute },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: TILE_GAP },

  tileFrame: { width: "100%", backgroundColor: P.warm, overflow: "hidden" },
  tileStatus: {
    position: "absolute", left: 6, top: 6, flexDirection: "row", alignItems: "center", gap: 5, maxWidth: "78%",
    height: 20, paddingHorizontal: 7, borderRadius: 6, backgroundColor: "rgba(255,255,255,0.94)",
  },
  tileStatusText: { fontFamily: monoBold, fontSize: 8.5, letterSpacing: 1, color: P.ink },
  tileIcons: { position: "absolute", right: 6, top: 6, gap: 5 },
  tileIcon: {
    width: 22, height: 22, borderRadius: 7, backgroundColor: "rgba(0,0,0,0.42)", alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.25)",
  },
  tileFoot: {
    position: "absolute", left: 6, right: 7, bottom: 6, flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  tilePill: {
    flexDirection: "row", alignItems: "center", gap: 4, height: 20, paddingHorizontal: 7, borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.94)",
  },
  tilePillText: { fontFamily: fontFamilies.sans.bold, fontSize: 10.5, color: P.ink },
  tileViews: { flexDirection: "row", alignItems: "center", gap: 3 },
  tileViewsText: { fontFamily: monoBold, fontSize: 10.5, color: P.paper },

  queueEmpty: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 36 },
  queueEmptyText: { fontFamily: fontFamilies.sans.medium, fontSize: 13.5, color: P.mute },

  tipWrap: { paddingHorizontal: PAGE, paddingTop: 18 },
  tip: {
    flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 22, backgroundColor: P.warm,
    borderWidth: 1, borderColor: P.border,
  },
  tipIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: P.lime, alignItems: "center", justifyContent: "center" },
  tipTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 14, color: P.ink },
  tipSub: { fontFamily: fontFamilies.sans.regular, fontSize: 12.5, lineHeight: 17, color: P.body },
  tipBtn: { height: 36, paddingHorizontal: 16, borderRadius: RADIUS.pill, backgroundColor: P.ink, justifyContent: "center" },
  tipBtnText: { fontFamily: fontFamilies.sans.bold, fontSize: 13, color: P.paper },

  caughtUp: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, paddingTop: 28, paddingHorizontal: PAGE * 2 },
  caughtLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: P.borderStrong },
  caughtUpText: { fontFamily: mono, fontSize: 10, letterSpacing: 2, color: P.mute },

  empty: { alignItems: "center", paddingHorizontal: 32, paddingTop: 40, paddingBottom: 20, gap: 10 },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 28, backgroundColor: P.lime, alignItems: "center", justifyContent: "center",
    marginBottom: 10, transform: [{ rotate: "-6deg" }],
  },
  emptyIconPlus: {
    position: "absolute", right: -6, bottom: -6, width: 24, height: 24, borderRadius: 12, backgroundColor: P.coral,
    borderWidth: 3, borderColor: P.paper, alignItems: "center", justifyContent: "center",
  },
  emptyTitle: { fontFamily: display, fontSize: 26, lineHeight: 31, letterSpacing: -0.7, color: P.ink, textAlign: "center" },
  emptySub: { fontFamily: fontFamilies.sans.regular, fontSize: 14, lineHeight: 21, color: P.body, textAlign: "center", maxWidth: 320 },
  emptyCta: {
    marginTop: 14, height: 52, paddingHorizontal: 26, borderRadius: 16, backgroundColor: P.ink,
    flexDirection: "row", alignItems: "center", gap: 10,
  },
  emptyCtaText: { fontFamily: fontFamilies.sans.bold, fontSize: 15, color: P.paper },
});
