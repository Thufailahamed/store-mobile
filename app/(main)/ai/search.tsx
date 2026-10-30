import React, { useState } from "react";
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
import { LinearGradient } from "expo-linear-gradient";
import { AiPageShell } from "@/components/ai/AiPageShell";
import { Ionicons } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui";
import { aiSearchBackend } from "@/lib/api/backend";
import { formatPrice } from "@/lib/utils";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

const GOLD = colors.accent2.ochre;
const CREAM = colors.paper.cream;
const INK = colors.ink.DEFAULT;

type IconName = React.ComponentProps<typeof Ionicons>["name"];

const SUGGESTIONS: { text: string; tag: string; icon: IconName }[] = [
  { text: "linen blazer under LKR 20,000", tag: "Budget", icon: "wallet-outline" },
  { text: "wedding guest outfit", tag: "Occasion", icon: "wine-outline" },
  { text: "running shoes for wide feet", tag: "Fit", icon: "footsteps-outline" },
  { text: "black tie event dress", tag: "Evening", icon: "moon-outline" },
];

const STEPS: { icon: IconName; title: string; body: string }[] = [
  { icon: "create-outline", title: "Describe", body: "In your own words" },
  { icon: "sparkles-outline", title: "Understand", body: "Style, fit & budget" },
  { icon: "bag-handle-outline", title: "Curate", body: "Picks made for you" },
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

  const search = async (q?: string) => {
    const text = (q ?? query).trim();
    if (!text) return;
    setLoading(true);
    setError(null);
    setResults(null);
    setSearchedFor(text);
    const res = await aiSearchBackend(text);
    if (res.ok) {
      setResults(res.data.products ?? []);
    } else {
      setError(res.error);
    }
    setLoading(false);
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
        {idle ? (
          <View style={styles.hero}>
            <Text style={styles.heroEyebrow}>LUXE AI · SMART SEARCH</Text>
            <Text style={styles.heroTitle}>
              Describe it.{"\n"}
              <Text style={styles.heroTitleItalic}>We'll find it.</Text>
            </Text>
            <Text style={styles.heroSub}>
              Natural language works — mention a colour, fabric, occasion or budget.
            </Text>
          </View>
        ) : null}

        <View style={[styles.composerShadow, focused && styles.composerShadowFocused]}>
          <LinearGradient
            colors={["#22271a", colors.olive[950], "#0b0c07"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.composer, focused && styles.composerFocused]}
          >
            <View style={styles.composerGlow} />
            <View style={styles.composerTop}>
              <LinearGradient
                colors={["#e6c873", GOLD, "#9c7a2c"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.composerBadge}
              >
                <Ionicons name="sparkles" size={13} color={colors.olive[950]} />
              </LinearGradient>
              <Text style={styles.composerLabel}>What are you looking for?</Text>
              {query.length > 0 ? (
                <Pressable
                  onPress={() => setQuery("")}
                  hitSlop={10}
                  accessibilityLabel="Clear search"
                  style={({ pressed }) => [styles.clearBtn, pressed && { opacity: 0.6 }]}
                >
                  <Ionicons name="close" size={14} color={CREAM} />
                </Pressable>
              ) : null}
            </View>

            <TextInput
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => void search()}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="e.g. leather loafers under LKR 25,000"
              placeholderTextColor={`${CREAM}59`}
              style={styles.input}
              returnKeyType="search"
              multiline
              blurOnSubmit
              selectionColor={GOLD}
            />

            <View style={styles.composerFooter}>
              <View style={styles.hintRow}>
                {(["Colour", "Fabric", "Budget"] as const).map((h) => (
                  <View key={h} style={styles.hint}>
                    <Text style={styles.hintText}>{h}</Text>
                  </View>
                ))}
              </View>
              <PressableScale
                onPress={() => void search()}
                disabled={!canSearch}
                accessibilityRole="button"
                accessibilityLabel="Search"
                style={[styles.goWrap, !canSearch && { opacity: 0.45 }]}
              >
                <LinearGradient
                  colors={["#e6c873", GOLD, "#a8862f"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.go}
                >
                  <Text style={styles.goText}>{loading ? "Searching…" : "Search"}</Text>
                  {!loading ? (
                    <Ionicons name="arrow-forward" size={15} color={colors.olive[950]} />
                  ) : null}
                </LinearGradient>
              </PressableScale>
            </View>
          </LinearGradient>
        </View>

        {idle ? (
          <>
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.eyebrow}>Inspiration</Text>
                <Text style={styles.sectionTitle}>Try asking</Text>
              </View>
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
                        <Ionicons name={s.icon} size={16} color={colors.olive[700]} />
                      </View>
                      <Ionicons
                        name="arrow-forward"
                        size={14}
                        color={colors.light.mutedForeground}
                        style={styles.promptArrow}
                      />
                    </View>
                    <Text style={styles.promptTag}>{s.tag}</Text>
                    <Text style={styles.promptText} numberOfLines={2}>
                      “{s.text}”
                    </Text>
                  </PressableScale>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.eyebrow}>How it works</Text>
                <Text style={styles.sectionTitle}>Your personal shopper</Text>
              </View>
              <View style={styles.stepsCard}>
                {STEPS.map((step, i) => (
                  <React.Fragment key={step.title}>
                    {i > 0 ? <View style={styles.stepDivider} /> : null}
                    <View style={styles.step}>
                      <View style={styles.stepIcon}>
                        <Ionicons name={step.icon} size={17} color={GOLD} />
                        <View style={styles.stepNum}>
                          <Text style={styles.stepNumText}>{i + 1}</Text>
                        </View>
                      </View>
                      <Text style={styles.stepTitle}>{step.title}</Text>
                      <Text style={styles.stepBody}>{step.body}</Text>
                    </View>
                  </React.Fragment>
                ))}
              </View>
            </View>
          </>
        ) : null}

        {loading ? (
          <>
            <View style={styles.statusRow}>
              <View style={styles.statusPill}>
                <Ionicons name="sparkles" size={12} color={GOLD} />
                <Text style={styles.statusText}>Curating picks for “{searchedFor}”</Text>
              </View>
            </View>
            <View style={styles.grid}>
              {[1, 2, 3, 4].map((i) => (
                <View key={i} style={styles.card}>
                  <Skeleton style={styles.img} borderRadius={0} />
                  <View style={styles.cardBody}>
                    <Skeleton width="90%" height={13} />
                    <Skeleton width="45%" height={12} />
                  </View>
                </View>
              ))}
            </View>
          </>
        ) : error ? (
          <View style={styles.stateCard}>
            <View style={styles.medallionOuter}>
              <LinearGradient
                colors={["#242621", "#151613"]}
                style={styles.medallionInner}
              >
                <Ionicons name="cloud-offline-outline" size={24} color={GOLD} />
              </LinearGradient>
            </View>
            <Text style={styles.stateTitle}>Search didn't go through</Text>
            <Text style={styles.stateSub}>{error}</Text>
            <PressableScale style={styles.retryBtn} onPress={() => void search()}>
              <Ionicons name="refresh" size={14} color={CREAM} />
              <Text style={styles.retryText}>Try again</Text>
            </PressableScale>
          </View>
        ) : results !== null ? (
          <>
            <View style={styles.resultHead}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.eyebrow}>Curated for you</Text>
                <Text style={styles.resultCount}>
                  {results.length}{" "}
                  <Text style={styles.resultCountItalic}>
                    match{results.length === 1 ? "" : "es"}
                  </Text>
                </Text>
              </View>
              <View style={styles.queryChip}>
                <Ionicons name="sparkles" size={11} color={colors.olive[700]} />
                <Text style={styles.queryChipText} numberOfLines={1}>
                  {searchedFor}
                </Text>
              </View>
            </View>
            {results.length === 0 ? (
              <View style={styles.stateCard}>
                <View style={styles.medallionOuter}>
                  <LinearGradient
                    colors={["#242621", "#151613"]}
                    style={styles.medallionInner}
                  >
                    <Ionicons name="search" size={22} color={GOLD} />
                  </LinearGradient>
                </View>
                <Text style={styles.stateTitle}>No matches yet</Text>
                <Text style={styles.stateSub}>
                  Try different words — a colour, fabric, occasion or budget.
                </Text>
              </View>
            ) : (
              <View style={styles.grid}>
                {results.map((p) => {
                  const off =
                    p.mrp && p.mrp > p.price
                      ? Math.round(((p.mrp - p.price) / p.mrp) * 100)
                      : 0;
                  return (
                    <PressableScale
                      key={p.id}
                      scale={0.98}
                      style={styles.card}
                      onPress={() =>
                        router.push(`/(main)/products/${p.slug}` as never)
                      }
                      accessibilityRole="button"
                      accessibilityLabel={p.name}
                    >
                      <View style={styles.imgWrap}>
                        {p.image_url ? (
                          <Image
                            source={{ uri: p.image_url }}
                            style={styles.img}
                            contentFit="cover"
                            transition={250}
                          />
                        ) : (
                          <View style={[styles.img, styles.imgFallback]}>
                            <Ionicons
                              name="shirt-outline"
                              size={28}
                              color={colors.olive[300]}
                            />
                          </View>
                        )}
                        <LinearGradient
                          colors={["transparent", `${INK}26`]}
                          style={styles.imgShade}
                          pointerEvents="none"
                        />
                        {off > 0 ? (
                          <View style={styles.offBadge}>
                            <Text style={styles.offText}>−{off}%</Text>
                          </View>
                        ) : null}
                        {p.rating && p.rating > 0 ? (
                          <View style={styles.ratingBadge}>
                            <Ionicons name="star" size={10} color={GOLD} />
                            <Text style={styles.ratingText}>
                              {p.rating.toFixed(1)}
                              {p.total_reviews ? (
                                <Text style={styles.ratingCount}> ({p.total_reviews})</Text>
                              ) : null}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <View style={styles.cardBody}>
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
  scroll: { paddingBottom: spacing[10] },
  hero: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[5],
    gap: spacing[2],
  },
  heroEyebrow: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 11,
    letterSpacing: 2.2,
    color: colors.olive[600],
  },
  heroTitle: {
    fontFamily: fontFamilies.display.regular,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -0.8,
    color: INK,
  },
  heroTitleItalic: {
    fontFamily: fontFamilies.display.italic,
    color: colors.olive[600],
  },
  heroSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.light.mutedForeground,
    maxWidth: 320,
  },
  composerShadow: {
    marginHorizontal: spacing[5],
    marginTop: spacing[2],
    borderRadius: 26,
    shadowColor: colors.olive[950],
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.25,
    shadowRadius: 26,
    elevation: 10,
  },
  composerShadowFocused: {
    shadowColor: GOLD,
    shadowOpacity: 0.35,
  },
  composer: {
    borderRadius: 26,
    padding: spacing[4],
    gap: spacing[3],
    overflow: "hidden",
    borderWidth: 1,
    borderColor: `${GOLD}26`,
  },
  composerFocused: {
    borderColor: `${GOLD}80`,
  },
  composerGlow: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    top: -120,
    right: -80,
    backgroundColor: `${GOLD}1A`,
  },
  composerTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
  },
  composerBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  composerLabel: {
    flex: 1,
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    letterSpacing: 0.4,
    color: `${CREAM}B3`,
  },
  clearBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${CREAM}14`,
  },
  input: {
    minHeight: 64,
    maxHeight: 140,
    fontFamily: fontFamilies.display.regular,
    fontSize: 20,
    lineHeight: 27,
    color: CREAM,
    paddingTop: 0,
    paddingBottom: 0,
    textAlignVertical: "top",
  },
  composerFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[2],
  },
  hintRow: {
    flexDirection: "row",
    flexShrink: 1,
    gap: 6,
  },
  hint: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: `${CREAM}1F`,
  },
  hintText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 10.5,
    color: `${CREAM}8C`,
  },
  goWrap: {
    borderRadius: radii.full,
  },
  go: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 42,
    paddingHorizontal: 18,
    borderRadius: radii.full,
  },
  goText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 13.5,
    color: colors.olive[950],
    letterSpacing: 0.2,
  },
  section: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[8],
    gap: spacing[4],
  },
  sectionHeader: { gap: 3 },
  eyebrow: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 10.5,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: colors.light.mutedForeground,
  },
  sectionTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 21,
    letterSpacing: -0.3,
    color: INK,
  },
  promptGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[3],
  },
  promptCard: {
    flexBasis: "47%",
    flexGrow: 1,
    minHeight: 132,
    padding: spacing[4],
    borderRadius: radii["3xl"],
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: `${INK}0D`,
    shadowColor: INK,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 3,
  },
  promptTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: spacing[3],
  },
  promptIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.olive[50],
  },
  promptArrow: {
    transform: [{ rotate: "-45deg" }],
  },
  promptTag: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: colors.olive[600],
    marginBottom: 4,
  },
  promptText: {
    fontFamily: fontFamilies.display.italic,
    fontSize: 15,
    lineHeight: 20,
    color: INK,
  },
  stepsCard: {
    flexDirection: "row",
    alignItems: "stretch",
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[2],
    borderRadius: radii["3xl"],
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: `${INK}0D`,
    shadowColor: INK,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
    elevation: 2,
  },
  step: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing[1],
  },
  stepDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: `${INK}1A`,
    marginVertical: spacing[2],
  },
  stepIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.olive[950],
    marginBottom: spacing[1],
  },
  stepNum: {
    position: "absolute",
    top: -3,
    right: -3,
    width: 17,
    height: 17,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: GOLD,
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  stepNumText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 8.5,
    color: colors.olive[950],
  },
  stepTitle: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 13,
    color: INK,
  },
  stepBody: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    textAlign: "center",
    color: colors.light.mutedForeground,
  },
  statusRow: {
    alignItems: "flex-start",
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: "100%",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.full,
    backgroundColor: colors.olive[950],
  },
  statusText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12,
    color: CREAM,
    flexShrink: 1,
  },
  resultHead: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing[3],
    paddingHorizontal: spacing[5],
    paddingTop: spacing[6],
    paddingBottom: spacing[1],
  },
  resultCount: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 24,
    letterSpacing: -0.4,
    color: INK,
  },
  resultCountItalic: {
    fontFamily: fontFamilies.display.italic,
    color: colors.olive[600],
  },
  queryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    maxWidth: "50%",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: colors.olive[50],
    borderWidth: 1,
    borderColor: `${colors.olive[600]}1F`,
  },
  queryChipText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12,
    color: colors.olive[800],
    flexShrink: 1,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    gap: 14,
  },
  card: {
    width: "47%",
    flexGrow: 1,
    backgroundColor: "#ffffff",
    borderRadius: radii["3xl"],
    borderWidth: 1,
    borderColor: `${INK}0D`,
    overflow: "hidden",
    shadowColor: INK,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 18,
    elevation: 3,
  },
  imgWrap: {
    margin: 6,
    borderRadius: radii["2xl"],
    overflow: "hidden",
  },
  img: {
    width: "100%",
    aspectRatio: 0.82,
    backgroundColor: colors.olive[50],
  },
  imgShade: {
    ...StyleSheet.absoluteFillObject,
    top: "55%",
  },
  imgFallback: { alignItems: "center", justifyContent: "center" },
  offBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    height: 22,
    paddingHorizontal: 8,
    borderRadius: radii.full,
    backgroundColor: colors.accent2.rust,
    alignItems: "center",
    justifyContent: "center",
  },
  offText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 10.5,
    color: "#fff",
  },
  ratingBadge: {
    position: "absolute",
    left: 8,
    bottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radii.full,
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  ratingText: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 10.5,
    color: INK,
  },
  ratingCount: {
    fontFamily: fontFamilies.sans.medium,
    color: colors.light.mutedForeground,
  },
  cardBody: {
    paddingHorizontal: spacing[3],
    paddingTop: spacing[1],
    paddingBottom: spacing[3],
    gap: 6,
  },
  name: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 13,
    lineHeight: 18,
    color: INK,
  },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  price: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 14.5,
    color: INK,
  },
  mrp: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 12,
    color: colors.light.mutedForeground,
    textDecorationLine: "line-through",
  },
  stateCard: {
    alignItems: "center",
    marginHorizontal: spacing[5],
    marginTop: spacing[6],
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[8],
    gap: spacing[2],
    borderRadius: radii["3xl"],
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: `${INK}0D`,
    shadowColor: INK,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
    elevation: 2,
  },
  medallionOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: `${GOLD}4D`,
    marginBottom: spacing[2],
  },
  medallionInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
  },
  stateTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 21,
    color: INK,
  },
  stateSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    color: colors.light.mutedForeground,
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: spacing[3],
    height: 42,
    paddingHorizontal: spacing[5],
    borderRadius: radii.full,
    backgroundColor: colors.olive[950],
  },
  retryText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: CREAM,
  },
});
