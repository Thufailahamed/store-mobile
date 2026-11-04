import React, { useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { AiPageShell } from "@/components/ai/AiPageShell";
import { UP as C } from "@/components/user/user-page";
import { Ionicons } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui";
import { aiSearchBackend } from "@/lib/api/backend";
import { formatPrice } from "@/lib/utils";
import { fontFamilies } from "@/lib/theme/fonts";

const SOFT = "#f5f3ec";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

const SUGGESTIONS: { text: string; tag: string; icon: IconName }[] = [
  { text: "linen blazer under LKR 20,000", tag: "Budget", icon: "wallet-outline" },
  { text: "wedding guest outfit", tag: "Occasion", icon: "wine-outline" },
  { text: "running shoes for wide feet", tag: "Fit", icon: "footsteps-outline" },
  { text: "black tie event dress", tag: "Evening", icon: "moon-outline" },
];

/** Tappable refiners — each appends a phrase so the hint actually does
 *  something instead of being a decorative pill. */
const REFINERS: { label: string; add: string; icon: IconName }[] = [
  { label: "Colour", add: "in black", icon: "color-palette-outline" },
  { label: "Fabric", add: "in linen", icon: "layers-outline" },
  { label: "Budget", add: "under LKR 20,000", icon: "wallet-outline" },
];

const STEPS: { icon: IconName; title: string; body: string }[] = [
  { icon: "create-outline", title: "Describe", body: "In your own words" },
  { icon: "sparkles-outline", title: "Understand", body: "Style, fit & budget" },
  { icon: "bag-handle-outline", title: "Curate", body: "Picks for you" },
];

type ProductHit = {
  id: string;
  name: string;
  slug: string;
  price: number;
  mrp?: number;
  discount_pct?: number;
  rating?: number;
  total_reviews?: number;
  image_url?: string;
};

function PressableScale({
  style,
  children,
  scale = 0.97,
  ...rest
}: React.ComponentProps<typeof Pressable> & { style?: StyleProp<ViewStyle>; scale?: number }) {
  return (
    <Pressable
      {...rest}
      style={({ pressed }) => [style, pressed && { transform: [{ scale }], opacity: 0.92 }]}
    >
      {children}
    </Pressable>
  );
}

export default function AiSearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [results, setResults] = useState<ProductHit[] | null>(null);
  const [searchedFor, setSearchedFor] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Only the latest request may write results — a slow earlier search must
  // not overwrite a newer one.
  const reqId = useRef(0);

  const search = async (q?: string) => {
    const text = (q ?? query).trim();
    if (!text) return;
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    setResults(null);
    setSearchedFor(text);
    const res = await aiSearchBackend(text);
    if (id !== reqId.current) return;
    if (res.ok) {
      setResults(res.data.products ?? []);
    } else {
      setError(res.error);
    }
    setLoading(false);
  };

  const reset = () => {
    reqId.current++;
    setQuery("");
    setResults(null);
    setError(null);
    setLoading(false);
    setSearchedFor("");
  };

  const refine = (add: string) => {
    setQuery((q) => (q.toLowerCase().includes(add.toLowerCase()) ? q : `${q.trim()} ${add}`.trim()));
  };

  const canSearch = !!query.trim() && !loading;
  const idle = results === null && !loading && !error;

  return (
    <AiPageShell title="Smart Search">
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* Composer */}
        <View style={styles.cardShadow}>
          <View style={styles.card}>
            {idle ? (
              <View style={styles.introRow}>
                <View style={styles.iconCircle}>
                  <Ionicons name="sparkles" size={22} color={C.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.introTitle}>Describe it, we&apos;ll find it</Text>
                  <Text style={styles.introSub}>
                    Mention a colour, fabric, occasion or budget.
                  </Text>
                </View>
              </View>
            ) : null}

            <View style={[styles.inputWrap, focused && styles.inputWrapFocused]}>
              <TextInput
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={() => void search()}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder="e.g. leather loafers under LKR 25,000"
                placeholderTextColor="#a3a39a"
                style={styles.input}
                returnKeyType="search"
                multiline
                blurOnSubmit
                selectionColor={C.accent}
              />
              {query.length > 0 || !idle ? (
                <Pressable
                  onPress={reset}
                  hitSlop={10}
                  accessibilityLabel="Clear search"
                  style={({ pressed }) => [styles.clearBtn, pressed && { opacity: 0.6 }]}
                >
                  <Ionicons name="close" size={14} color={C.text} />
                </Pressable>
              ) : null}
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.refineRow}
              style={styles.refineScroll}
            >
              {REFINERS.map((r) => (
                <Pressable
                  key={r.label}
                  onPress={() => refine(r.add)}
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${r.add}`}
                  style={({ pressed }) => [styles.chip, pressed && { opacity: 0.7 }]}
                >
                  <Ionicons name="add" size={14} color={C.accent} />
                  <Text style={styles.chipText}>{r.label}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <PressableScale
              onPress={() => void search()}
              disabled={!canSearch}
              accessibilityRole="button"
              accessibilityLabel="Search"
              style={[styles.cta, !canSearch && { opacity: 0.35 }]}
            >
              <View style={styles.ctaIcon}>
                <Ionicons name={loading ? "hourglass-outline" : "search"} size={18} color={C.ink} />
              </View>
              <Text style={styles.ctaText}>{loading ? "Searching…" : "Find pieces"}</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </PressableScale>
          </View>
        </View>

        {idle ? (
          <>
            <Text style={styles.sectionTitle}>Try asking</Text>
            <View style={styles.promptGrid}>
              {SUGGESTIONS.map((s) => (
                <PressableScale
                  key={s.text}
                  style={styles.promptCard}
                  onPress={() => {
                    setQuery(s.text);
                    void search(s.text);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Search ${s.text}`}
                >
                  <View style={styles.promptTop}>
                    <View style={styles.promptIcon}>
                      <Ionicons name={s.icon} size={18} color={C.accent} />
                    </View>
                    <View style={styles.promptArrow}>
                      <Ionicons name="arrow-forward" size={14} color={C.text} />
                    </View>
                  </View>
                  <Text style={styles.promptTag}>{s.tag}</Text>
                  <Text style={styles.promptText} numberOfLines={3}>
                    {s.text.charAt(0).toUpperCase() + s.text.slice(1)}
                  </Text>
                </PressableScale>
              ))}
            </View>

            <Text style={styles.sectionTitle}>How it works</Text>
            <View style={styles.stepsStrip}>
              {STEPS.map((step, i) => (
                <React.Fragment key={step.title}>
                  {i > 0 ? <View style={styles.stepRule} /> : null}
                  <View style={styles.step}>
                    <View style={styles.stepNum}>
                      <Text style={styles.stepNumText}>{i + 1}</Text>
                    </View>
                    <Text style={styles.stepTitle}>{step.title}</Text>
                    <Text style={styles.stepBody}>{step.body}</Text>
                  </View>
                </React.Fragment>
              ))}
            </View>
          </>
        ) : null}

        {loading ? (
          <>
            <View style={styles.resultHead}>
              <Text style={styles.resultTitle} numberOfLines={1}>
                Finding “{searchedFor}”
              </Text>
            </View>
            <View style={styles.grid}>
              {[1, 2, 3, 4].map((i) => (
                <View key={i} style={styles.product}>
                  <Skeleton style={styles.img} borderRadius={14} />
                  <View style={styles.productBody}>
                    <Skeleton width="90%" height={13} />
                    <Skeleton width="45%" height={12} />
                  </View>
                </View>
              ))}
            </View>
          </>
        ) : error ? (
          <View style={[styles.cardShadow, styles.stateGap]}>
            <View style={[styles.card, styles.stateCard]}>
              <View style={styles.iconCircle}>
                <Ionicons name="cloud-offline-outline" size={22} color={C.accent} />
              </View>
              <Text style={styles.stateTitle}>Search didn&apos;t go through</Text>
              <Text style={styles.stateSub}>{error}</Text>
              <PressableScale style={styles.smallCta} onPress={() => void search(searchedFor)}>
                <Ionicons name="refresh" size={15} color={C.lime} />
                <Text style={styles.smallCtaText}>Try again</Text>
              </PressableScale>
            </View>
          </View>
        ) : results !== null ? (
          <>
            <View style={styles.resultHead}>
              <Text style={styles.resultTitle} numberOfLines={1}>
                “{searchedFor}”
              </Text>
              <View style={styles.countBadge}>
                <Text style={styles.countText}>
                  {results.length} match{results.length === 1 ? "" : "es"}
                </Text>
              </View>
            </View>
            {results.length === 0 ? (
              <View style={styles.cardShadow}>
                <View style={[styles.card, styles.stateCard]}>
                  <View style={styles.iconCircle}>
                    <Ionicons name="search" size={22} color={C.accent} />
                  </View>
                  <Text style={styles.stateTitle}>No matches yet</Text>
                  <Text style={styles.stateSub}>
                    Try different words — a colour, fabric, occasion or budget.
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.grid}>
                {results.map((p) => {
                  const off =
                    p.mrp && p.mrp > p.price ? Math.round(((p.mrp - p.price) / p.mrp) * 100) : 0;
                  return (
                    <PressableScale
                      key={p.id}
                      scale={0.98}
                      style={styles.product}
                      onPress={() => router.push(`/(main)/products/${p.slug}` as never)}
                      accessibilityRole="button"
                      accessibilityLabel={p.name}
                    >
                      <View>
                        {p.image_url ? (
                          <Image
                            source={{ uri: p.image_url }}
                            style={styles.img}
                            contentFit="cover"
                            transition={250}
                          />
                        ) : (
                          <View style={[styles.img, styles.imgFallback]}>
                            <Ionicons name="shirt-outline" size={28} color={C.faint} />
                          </View>
                        )}
                        {off > 0 ? (
                          <View style={styles.offBadge}>
                            <Text style={styles.offText}>−{off}%</Text>
                          </View>
                        ) : null}
                        {p.rating && p.rating > 0 ? (
                          <View style={styles.ratingBadge}>
                            <Ionicons name="star" size={10} color={C.lime} />
                            <Text style={styles.ratingText}>
                              {p.rating.toFixed(1)}
                              {p.total_reviews ? ` (${p.total_reviews})` : ""}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <View style={styles.productBody}>
                        <Text numberOfLines={2} style={styles.name}>
                          {p.name}
                        </Text>
                        <View style={styles.priceRow}>
                          <Text style={styles.price}>{formatPrice(p.price)}</Text>
                          {off > 0 && p.mrp ? (
                            <Text style={styles.mrp}>{formatPrice(p.mrp)}</Text>
                          ) : null}
                        </View>
                      </View>
                    </PressableScale>
                  );
                })}
              </View>
            )}
          </>
        ) : null}
      </ScrollView>
    </AiPageShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 32 },

  cardShadow: {
    borderRadius: 26,
    shadowColor: "#16170f",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 3,
  },
  card: {
    backgroundColor: C.card,
    borderRadius: 26,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: C.line,
    padding: 16,
    overflow: "hidden",
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: C.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },

  // Composer
  introRow: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 14 },
  introTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 18, color: C.text, letterSpacing: -0.3 },
  introSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13.5,
    lineHeight: 18,
    color: C.muted,
    marginTop: 2,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    minHeight: 96,
    paddingLeft: 16,
    paddingRight: 10,
    paddingVertical: 12,
    borderRadius: 18,
    borderCurve: "continuous",
    backgroundColor: SOFT,
    borderWidth: 1,
    borderColor: "transparent",
  },
  inputWrapFocused: { borderColor: C.ink, backgroundColor: C.card },
  input: {
    flex: 1,
    fontFamily: fontFamilies.sans.medium,
    fontSize: 16,
    lineHeight: 22,
    color: C.text,
    padding: 0,
    textAlignVertical: "top",
  },
  clearBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(22,23,15,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  refineScroll: { flexGrow: 0, marginTop: 12, marginHorizontal: -16 },
  refineRow: { gap: 8, paddingHorizontal: 16 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 19,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
  },
  chipText: { fontFamily: fontFamilies.sans.semibold, fontSize: 13, color: C.text },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    height: 60,
    marginTop: 14,
    paddingLeft: 8,
    paddingRight: 20,
    borderRadius: 30,
    borderCurve: "continuous",
    backgroundColor: C.ink,
  },
  ctaIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.lime,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: { flex: 1, fontFamily: fontFamilies.sans.semibold, fontSize: 15.5, color: "#FFFFFF" },

  // Sections
  sectionTitle: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 18,
    color: C.text,
    letterSpacing: -0.3,
    marginTop: 26,
    marginBottom: 12,
  },
  promptGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  promptCard: {
    width: "48.5%",
    flexGrow: 1,
    minHeight: 150,
    padding: 14,
    borderRadius: 22,
    borderCurve: "continuous",
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
  },
  promptTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  promptIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: C.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  promptArrow: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: SOFT,
    alignItems: "center",
    justifyContent: "center",
  },
  promptTag: { fontFamily: fontFamilies.sans.medium, fontSize: 12.5, color: C.muted, marginTop: 14 },
  promptText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 14.5,
    lineHeight: 19,
    color: C.text,
    marginTop: 2,
  },
  stepsStrip: {
    flexDirection: "row",
    alignItems: "stretch",
    paddingVertical: 16,
    borderRadius: 22,
    borderCurve: "continuous",
    backgroundColor: C.ink,
  },
  stepRule: { width: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.16)" },
  step: { flex: 1, alignItems: "center", paddingHorizontal: 6, gap: 4 },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.lime,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  stepNumText: { fontFamily: fontFamilies.sans.bold, fontSize: 13, color: C.ink },
  stepTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 14, color: "#FFFFFF" },
  stepBody: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12,
    color: "rgba(255,255,255,0.55)",
    textAlign: "center",
  },

  // Results
  resultHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 24,
    marginBottom: 12,
  },
  resultTitle: {
    flex: 1,
    fontFamily: fontFamilies.sans.bold,
    fontSize: 18,
    color: C.text,
    letterSpacing: -0.3,
  },
  countBadge: {
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 13,
    backgroundColor: C.accentSoft,
    justifyContent: "center",
  },
  countText: { fontFamily: fontFamilies.sans.bold, fontSize: 12, color: C.accent },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  product: {
    width: "48.5%",
    flexGrow: 1,
    maxWidth: "50%",
    padding: 8,
    borderRadius: 22,
    borderCurve: "continuous",
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
  },
  img: { width: "100%", aspectRatio: 0.8, borderRadius: 14, backgroundColor: SOFT },
  imgFallback: { alignItems: "center", justifyContent: "center" },
  offBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    height: 22,
    paddingHorizontal: 8,
    borderRadius: 11,
    backgroundColor: C.lime,
    justifyContent: "center",
  },
  offText: { fontFamily: fontFamilies.sans.bold, fontSize: 11, color: C.ink },
  ratingBadge: {
    position: "absolute",
    bottom: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 22,
    paddingHorizontal: 8,
    borderRadius: 11,
    backgroundColor: C.ink,
  },
  ratingText: { fontFamily: fontFamilies.sans.semibold, fontSize: 11, color: "#FFFFFF" },
  productBody: { paddingHorizontal: 4, paddingTop: 10, paddingBottom: 4, gap: 4 },
  name: { fontFamily: fontFamilies.sans.semibold, fontSize: 13.5, lineHeight: 18, color: C.text },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  price: { fontFamily: fontFamilies.sans.bold, fontSize: 14, color: C.text },
  mrp: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11.5,
    color: C.muted,
    textDecorationLine: "line-through",
  },

  // States
  stateGap: { marginTop: 20 },
  stateCard: { alignItems: "center", paddingVertical: 28, gap: 6 },
  stateTitle: { fontFamily: fontFamilies.sans.bold, fontSize: 17, color: C.text, marginTop: 8 },
  stateSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13.5,
    lineHeight: 19,
    color: C.muted,
    textAlign: "center",
    maxWidth: 280,
  },
  smallCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 42,
    paddingHorizontal: 18,
    borderRadius: 21,
    backgroundColor: C.ink,
    marginTop: 10,
  },
  smallCtaText: { fontFamily: fontFamilies.sans.semibold, fontSize: 13.5, color: "#FFFFFF" },
});
