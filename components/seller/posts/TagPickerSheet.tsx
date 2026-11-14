/** Full-screen sheet: search the store's active products and tag up to 10, with AI suggestions on top. */
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Modal } from "@/components/ui/Modal";
import { Ionicons } from "@/components/ui/Icon";
import { getSellerProductsBackend, type CatalogProduct } from "@/lib/api/backend";
import { POST_LIMITS } from "@/lib/posts/limits";
import { formatPrice } from "@/lib/utils";
import { fontFamilies } from "@/lib/theme/fonts";


export interface PickedProduct {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  source: "seller" | "ai_suggested";
  media_id?: string | null;
  x?: number | null;
  y?: number | null;
}

const imageOf = (p: CatalogProduct) =>
  p.images?.find((i) => i.is_primary)?.url ?? [...(p.images ?? [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))[0]?.url ?? null;

export function TagPickerSheet({
  visible,
  onClose,
  value,
  onChange,
  suggestions,
}: {
  visible: boolean;
  onClose: () => void;
  value: PickedProduct[];
  onChange: (v: PickedProduct[]) => void;
  suggestions: { product_id: string; score: number }[];
}) {
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const cache = useRef(new Map<string, CatalogProduct>());
  const [, force] = useState(0);

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    setLoading(true);
    const t = setTimeout(async () => {
      const r = await getSellerProductsBackend({ limit: 30, status: "active", search: q.trim() || undefined, sort: "newest" });
      if (!alive) return;
      const list = r.ok ? r.data.products ?? [] : [];
      list.forEach((p) => cache.current.set(p.id, p));
      setResults(list);
      setLoading(false);
    }, 250);
    return () => { alive = false; clearTimeout(t); };
  }, [q, visible]);

  // Make sure suggested products are resolvable even if not in the first page.
  useEffect(() => {
    if (!visible || !suggestions.length) return;
    if (suggestions.every((s) => cache.current.has(s.product_id))) return;
    getSellerProductsBackend({ limit: 100, status: "active" }).then((r) => {
      if (r.ok) (r.data.products ?? []).forEach((p) => cache.current.set(p.id, p));
      force((n) => n + 1);
    });
  }, [suggestions, visible]);

  const picked = useMemo(() => new Set(value.map((v) => v.id)), [value]);
  const full = value.length >= POST_LIMITS.tagsMax;
  const suggested = suggestions.map((s) => cache.current.get(s.product_id)).filter((p): p is CatalogProduct => !!p && !picked.has(p.id));

  const toggle = (p: CatalogProduct, source: PickedProduct["source"]) => {
    if (picked.has(p.id)) onChange(value.filter((v) => v.id !== p.id));
    else if (!full) onChange([...value, { id: p.id, name: p.name, price: p.price, image_url: imageOf(p), source }]);
  };

  const selectedIds = value.map((v) => v.id);
  const clear = () => setQ("");

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <View style={[styles.root, { paddingTop: insets.top }]}>
        {/* bar */}
        <View style={styles.bar}>
          <Pressable onPress={onClose} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Close" hitSlop={8}>
            <Ionicons name="close" size={26} color={C.ink} />
          </Pressable>
          <Text style={styles.barTitle}>Tag products</Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Done" hitSlop={8} style={styles.doneTextBtn}>
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </View>

        {/* search */}
        <View style={styles.searchRow}>
          <Ionicons name="search" size={17} color={C.mute} />
          <TextInput value={q} onChangeText={setQ} placeholder="Search your products" placeholderTextColor={C.mute}
            style={styles.input} autoCorrect={false} returnKeyType="search" accessibilityLabel="Search products" />
          {loading ? <ActivityIndicator size="small" color={C.mute} />
            : q ? (
              <Pressable onPress={clear} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search">
                <Ionicons name="close-circle" size={18} color={C.faint} />
              </Pressable>
            ) : null}
        </View>

        {/* tagged strip */}
        {value.length > 0 ? (
          <View>
            <Text style={styles.section}>Tagged · {value.length}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
              {value.map((v) => (
                <Animated.View key={v.id} entering={ZoomIn.duration(180)} style={styles.stripItem}>
                  <View style={styles.stripThumb}>
                    {v.image_url ? <Image source={{ uri: v.image_url }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
                  </View>
                  <Pressable onPress={() => onChange(value.filter((x) => x.id !== v.id))} hitSlop={6} style={styles.stripRemove}
                    accessibilityRole="button" accessibilityLabel={`Remove ${v.name}`}>
                    <Ionicons name="close" size={11} color="#fff" />
                  </Pressable>
                  <Text style={styles.stripName} numberOfLines={1}>{v.name}</Text>
                </Animated.View>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <FlatList
          data={results}
          keyExtractor={(p) => p.id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          extraData={selectedIds}
          contentContainerStyle={{ paddingBottom: 12 }}
          ListHeaderComponent={
            <>
              {suggested.length > 0 && !q.trim() ? (
                <View style={styles.suggBlock}>
                  <View style={styles.suggHead}>
                    <Ionicons name="sparkles" size={13} color={C.ink} />
                    <Text style={styles.sectionInline}>Spotted in this look</Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggRow}>
                    {suggested.map((p) => {
                      const img = imageOf(p);
                      return (
                        <Pressable key={p.id} onPress={() => toggle(p, "ai_suggested")} disabled={full}
                          style={({ pressed }) => [styles.suggCard, full && { opacity: 0.4 }, pressed && { opacity: 0.7 }]}
                          accessibilityRole="button" accessibilityLabel={`Tag ${p.name}`}>
                          <View style={styles.suggThumb}>
                            {img ? <Image source={{ uri: img }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
                            <View style={styles.suggAdd}><Ionicons name="add" size={14} color={C.ink} /></View>
                          </View>
                          <Text style={styles.suggName} numberOfLines={1}>{p.name}</Text>
                          <Text style={styles.suggPrice}>{formatPrice(p.price, p.currency || "LKR")}</Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              ) : null}
              <Text style={styles.section}>{q.trim() ? "Results" : "Your products"}</Text>
            </>
          }
          ListEmptyComponent={!loading ? (
            <View style={styles.emptyBox}>
              <View style={styles.emptyIcon}><Ionicons name="search" size={22} color={C.mute} /></View>
              <Text style={styles.emptyTitle}>No products found</Text>
              <Text style={styles.empty}>Only active products in your store can be tagged.</Text>
            </View>
          ) : null}
          renderItem={({ item }) => {
            const on = picked.has(item.id);
            const img = imageOf(item);
            const off = !on && full;
            return (
              <Pressable onPress={() => toggle(item, "seller")} disabled={off}
                style={({ pressed }) => [styles.row, off && { opacity: 0.4 }, pressed && { backgroundColor: C.surface }]}
                accessibilityRole="checkbox" accessibilityState={{ checked: on, disabled: off }} accessibilityLabel={item.name}>
                <View style={styles.thumb}>
                  {img ? <Image source={{ uri: img }} style={StyleSheet.absoluteFill} contentFit="cover" transition={120} /> : null}
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                  <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.price}>{formatPrice(item.price, item.currency || "LKR")}</Text>
                </View>
                <View style={[styles.check, on && styles.checkOn]}>
                  {on ? <Ionicons name="checkmark" size={15} color="#fff" /> : null}
                </View>
              </Pressable>
            );
          }}
        />

        {/* footer */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 10 }]}>
          <View style={styles.meter}>
            <View style={[styles.meterFill, { width: `${(value.length / POST_LIMITS.tagsMax) * 100}%` }]} />
          </View>
          <Pressable onPress={onClose} accessibilityRole="button"
            style={({ pressed }) => [styles.doneBtn, pressed && { opacity: 0.85 }]}>
            <Text style={styles.doneBtnText}>
              {value.length ? `Done · ${value.length} of ${POST_LIMITS.tagsMax} tagged` : "Done"}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const C = {
  bg: "#ffffff",
  surface: "#f4f4f5",
  surface2: "#ebebee",
  ink: "#111114",
  body: "#45454c",
  mute: "#8a8a92",
  faint: "#c7c7cc",
  line: "rgba(17,17,20,0.08)",
} as const;
const sans = fontFamilies.sans;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  bar: { height: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8 },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  barTitle: { fontFamily: sans.bold, fontSize: 18, letterSpacing: -0.3, color: C.ink },
  doneTextBtn: { height: 44, minWidth: 44, paddingHorizontal: 8, alignItems: "center", justifyContent: "center" },
  doneText: { fontFamily: sans.bold, fontSize: 16, color: C.ink },

  searchRow: {
    marginHorizontal: 16, marginTop: 4, marginBottom: 6, flexDirection: "row", alignItems: "center", gap: 10, height: 42,
    paddingHorizontal: 14, borderRadius: 12, backgroundColor: C.surface,
  },
  input: { flex: 1, fontFamily: sans.regular, fontSize: 15.5, color: C.ink, padding: 0 },

  section: { fontFamily: sans.bold, fontSize: 15, color: C.ink, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  sectionInline: { fontFamily: sans.bold, fontSize: 15, color: C.ink },

  strip: { paddingHorizontal: 16, gap: 12, paddingBottom: 6 },
  stripItem: { width: 64, alignItems: "center", gap: 5 },
  stripThumb: { width: 60, height: 60, borderRadius: 30, backgroundColor: C.surface2, overflow: "hidden", borderWidth: 2, borderColor: C.ink },
  stripRemove: {
    position: "absolute", top: -2, right: -2, width: 20, height: 20, borderRadius: 10, backgroundColor: C.ink,
    alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#fff",
  },
  stripName: { fontFamily: sans.medium, fontSize: 11, color: C.body, maxWidth: 64 },

  suggBlock: { paddingTop: 10 },
  suggHead: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingBottom: 10 },
  suggRow: { paddingHorizontal: 16, gap: 10 },
  suggCard: { width: 112, gap: 3 },
  suggThumb: { width: 112, height: 140, borderRadius: 12, backgroundColor: C.surface, overflow: "hidden", marginBottom: 4 },
  suggAdd: {
    position: "absolute", right: 6, bottom: 6, width: 26, height: 26, borderRadius: 13, backgroundColor: "#fff",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2,
  },
  suggName: { fontFamily: sans.semibold, fontSize: 12.5, color: C.ink },
  suggPrice: { fontFamily: sans.regular, fontSize: 12, color: C.mute },

  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 8 },
  thumb: { width: 52, height: 64, borderRadius: 10, backgroundColor: C.surface, overflow: "hidden" },
  name: { fontFamily: sans.semibold, fontSize: 15, color: C.ink },
  price: { fontFamily: sans.regular, fontSize: 13.5, color: C.mute },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: C.faint, alignItems: "center", justifyContent: "center" },
  checkOn: { backgroundColor: C.ink, borderColor: C.ink },

  emptyBox: { alignItems: "center", paddingVertical: 40, paddingHorizontal: 32, gap: 6 },
  emptyIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: C.surface, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  emptyTitle: { fontFamily: sans.bold, fontSize: 16, color: C.ink },
  empty: { textAlign: "center", color: C.mute, fontFamily: sans.regular, fontSize: 13.5, lineHeight: 19 },

  footer: { paddingHorizontal: 16, paddingTop: 10, gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line, backgroundColor: C.bg },
  meter: { height: 3, borderRadius: 2, backgroundColor: C.surface2, overflow: "hidden" },
  meterFill: { height: 3, borderRadius: 2, backgroundColor: C.ink },
  doneBtn: { height: 48, borderRadius: 12, backgroundColor: C.ink, alignItems: "center", justifyContent: "center" },
  doneBtnText: { fontFamily: sans.semibold, fontSize: 15, color: "#fff" },
});
