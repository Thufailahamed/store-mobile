import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { AiPageShell } from "@/components/ai/AiPageShell";
import { Body, Label } from "@/components/ui/Typography";
import { Ionicons } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui";
import { aiSearchBackend } from "@/lib/api/backend";
import { formatPrice } from "@/lib/utils";
import { colors, radii, spacing, shadows, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

const SUGGESTIONS = [
  "linen blazer under LKR 20,000",
  "wedding guest outfit",
  "running shoes for wide feet",
  "black tie event dress",
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

export default function AiSearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");
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

  return (
    <AiPageShell
      title="Smart Search"
      description="Describe what you're looking for — natural language works."
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <View style={styles.searchCard}>
          <View style={styles.inputRow}>
            <Ionicons
              name="sparkles"
              size={16}
              color={colors.accent2.ochre}
            />
            <TextInput
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => void search()}
              placeholder="e.g. leather loafers under LKR 25,000"
              placeholderTextColor={colors.light.mutedForeground}
              style={styles.input}
              returnKeyType="search"
            />
            {query.length > 0 ? (
              <TouchableOpacity onPress={() => setQuery("")} hitSlop={8}>
                <Ionicons
                  name="close-circle"
                  size={16}
                  color={colors.light.mutedForeground}
                />
              </TouchableOpacity>
            ) : null}
          </View>
          <TouchableOpacity
            style={[styles.go, (!query.trim() || loading) && { opacity: 0.6 }]}
            onPress={() => void search()}
            disabled={loading || !query.trim()}
            activeOpacity={0.85}
          >
            {loading ? (
              <Text style={styles.goText}>Searching…</Text>
            ) : (
              <>
                <Ionicons name="arrow-forward" size={14} color={colors.paper.cream} />
                <Text style={styles.goText}>Search</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {results === null && !loading && !error ? (
          <View style={styles.suggestSection}>
            <Label style={styles.suggestLabel}>TRY ASKING</Label>
            <View style={styles.chips}>
              {SUGGESTIONS.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={styles.chip}
                  onPress={() => {
                    setQuery(s);
                    void search(s);
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="sparkles-outline"
                    size={11}
                    color={colors.olive[600]}
                  />
                  <Body size="xs" style={{ color: colors.light.foreground }}>
                    {s}
                  </Body>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : null}

        {loading ? (
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
        ) : error ? (
          <View style={styles.stateWrap}>
            <View style={styles.stateIcon}>
              <Ionicons
                name="cloud-offline-outline"
                size={28}
                color={colors.olive[600]}
              />
            </View>
            <Text style={styles.stateTitle}>Search didn't go through</Text>
            <Body muted size="sm" style={styles.stateSub}>
              {error}
            </Body>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => void search()}
            >
              <Ionicons name="refresh" size={14} color={colors.paper.cream} />
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : results !== null ? (
          <>
            <View style={styles.resultHead}>
              <Body size="sm" style={{ fontFamily: fontFamilies.sans.semibold }}>
                {results.length} match{results.length === 1 ? "" : "es"}
              </Body>
              <Body muted size="xs" numberOfLines={1} style={{ flex: 1, textAlign: "right" }}>
                for “{searchedFor}”
              </Body>
            </View>
            {results.length === 0 ? (
              <View style={styles.stateWrap}>
                <View style={styles.stateIcon}>
                  <Ionicons
                    name="search-outline"
                    size={28}
                    color={colors.olive[600]}
                  />
                </View>
                <Text style={styles.stateTitle}>No matches</Text>
                <Body muted size="sm" style={styles.stateSub}>
                  Try different words — a color, fabric, occasion or budget.
                </Body>
              </View>
            ) : (
              <View style={styles.grid}>
                {results.map((p) => {
                  const off =
                    p.mrp && p.mrp > p.price
                      ? Math.round(((p.mrp - p.price) / p.mrp) * 100)
                      : 0;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={styles.card}
                      onPress={() =>
                        router.push(`/(main)/products/${p.slug}` as never)
                      }
                      activeOpacity={0.9}
                    >
                      <View>
                        {p.image_url ? (
                          <Image
                            source={{ uri: p.image_url }}
                            style={styles.img}
                            contentFit="cover"
                            transition={200}
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
                        {off > 0 ? (
                          <View style={styles.offBadge}>
                            <Text style={styles.offText}>-{off}%</Text>
                          </View>
                        ) : null}
                      </View>
                      <View style={styles.cardBody}>
                        <Body size="xs" numberOfLines={2} style={styles.name}>
                          {p.name}
                        </Body>
                        <View style={styles.priceRow}>
                          <Body size="sm" style={styles.price}>
                            {formatPrice(p.price)}
                          </Body>
                          {off > 0 && p.mrp ? (
                            <Body size="xs" muted style={styles.mrp}>
                              {formatPrice(p.mrp)}
                            </Body>
                          ) : null}
                        </View>
                        {p.rating && p.rating > 0 ? (
                          <View style={styles.ratingRow}>
                            <Ionicons
                              name="star"
                              size={10}
                              color={colors.accent2.ochre}
                            />
                            <Label style={styles.ratingText}>
                              {p.rating.toFixed(1)}
                              {p.total_reviews
                                ? ` · ${p.total_reviews}`
                                : ""}
                            </Label>
                          </View>
                        ) : null}
                      </View>
                    </TouchableOpacity>
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
  scroll: { paddingBottom: spacing[8] },
  searchCard: {
    marginHorizontal: spacing[5],
    marginTop: spacing[3],
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.light.card,
    padding: spacing[2.5],
    gap: spacing[2.5],
    ...shadows.soft,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    paddingHorizontal: spacing[2],
    height: 44,
  },
  input: {
    flex: 1,
    height: 44,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 14,
    color: colors.light.foreground,
  },
  go: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 44,
    borderRadius: radii.lg,
    backgroundColor: colors.olive[800],
    paddingHorizontal: spacing[4],
  },
  goText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: colors.paper.cream,
    letterSpacing: 0.3,
  },
  suggestSection: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    gap: spacing[2.5],
  },
  suggestLabel: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    letterSpacing: 1,
    color: colors.light.mutedForeground,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: radii.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.light.card,
  },
  resultHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[1],
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    gap: 12,
  },
  card: {
    width: "47%",
    backgroundColor: colors.light.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.light.border,
    overflow: "hidden",
    ...shadows.soft,
  },
  img: {
    width: "100%",
    aspectRatio: 0.85,
    backgroundColor: colors.olive[50],
  },
  imgFallback: { alignItems: "center", justifyContent: "center" },
  offBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    height: 20,
    paddingHorizontal: 7,
    borderRadius: radii.full,
    backgroundColor: colors.accent2.rust,
    alignItems: "center",
    justifyContent: "center",
  },
  offText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 9,
    color: "#fff",
  },
  cardBody: { padding: spacing[3], gap: 5 },
  name: { fontFamily: fontFamilies.sans.medium, lineHeight: 17 },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  price: { fontFamily: fontFamilies.sans.bold, color: colors.olive[700] },
  mrp: { textDecorationLine: "line-through" },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  ratingText: {
    fontFamily: fontFamilies.mono.medium,
    fontSize: 9,
    color: colors.light.mutedForeground,
  },
  stateWrap: {
    alignItems: "center",
    paddingHorizontal: spacing[8],
    paddingTop: spacing[10],
    gap: spacing[2],
  },
  stateIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.olive[50],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing[2],
  },
  stateTitle: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: typography.fontSizes.xl,
    color: colors.light.foreground,
  },
  stateSub: { textAlign: "center" },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: spacing[3],
    height: 40,
    paddingHorizontal: spacing[5],
    borderRadius: radii.full,
    backgroundColor: colors.olive[800],
  },
  retryText: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    color: colors.paper.cream,
  },
});
