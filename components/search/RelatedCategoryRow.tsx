import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Ionicons } from "@/components/ui/Icon";
import { fontFamilies } from "@/lib/theme/fonts";
import { getAllCategories } from "@/lib/api";
import type { Category, Product } from "@/lib/types";

const INK = "#1b1c1c";

type Tile = { id: string; slug: string; label: string; image?: string; count: number };

function genderWord(g?: string | null): string {
  const v = (g ?? "").toLowerCase();
  if (v === "men" || v === "male") return "Men";
  if (v === "women" || v === "female") return "Women";
  if (v === "kids" || v === "boys" || v === "girls") return "Kids";
  return "";
}

function withGender(name: string, gender: string): string {
  if (!gender || new RegExp(`\\b${gender}`, "i").test(name)) return name;
  return `${gender} ${name}`;
}

function productImage(p: Product): string | undefined {
  return p.images?.find((i) => i.is_primary)?.url || p.images?.[0]?.url;
}

/**
 * "Men Tshirts · Men Shirts · Sweatshirts…" image tiles above search results.
 * Categories present in the results come first, then siblings of the
 * dominant category from the full catalogue tree.
 */
let allCategoriesCache: Category[] | null = null;

/** Word stems for overlap ranking: "T-Shirts" → ["tshirt", "shirt"]. */
function stems(name: string): string[] {
  const words = name.toLowerCase().replace(/&/g, " ").split(/[\s,/]+/).filter(Boolean);
  const out = new Set<string>();
  for (const w of words) {
    const plain = w.replace(/[^a-z]/g, "").replace(/s$/, "");
    if (plain.length >= 3) out.add(plain);
    for (const part of w.split("-")) {
      const p = part.replace(/[^a-z]/g, "").replace(/s$/, "");
      if (p.length >= 3) out.add(p);
    }
  }
  return [...out];
}

export function RelatedCategoryRow({ products, categories }: { products: Product[]; categories: Category[] }) {
  const router = useRouter();
  const [all, setAll] = useState<Category[]>(allCategoriesCache ?? categories);

  useEffect(() => {
    if (allCategoriesCache) return;
    let live = true;
    getAllCategories().then((res) => {
      if (!res.ok || !live) return;
      allCategoriesCache = res.data;
      setAll(res.data);
    });
    return () => {
      live = false;
    };
  }, []);

  const tiles = useMemo<Tile[]>(() => {
    const catById = new Map(all.map((c) => [c.id, c]));
    // Categories present in the results, most products first.
    const counts = new Map<string, { cat: Category; count: number; image?: string; genders: Map<string, number> }>();
    for (const p of products) {
      const c = p.category;
      if (!c?.id || !c.slug || !c.name) continue;
      const cur = counts.get(c.id) ?? { cat: catById.get(c.id) ?? c, count: 0, image: undefined, genders: new Map() };
      cur.count += 1;
      cur.image ??= productImage(p);
      const g = genderWord(p.gender);
      if (g) cur.genders.set(g, (cur.genders.get(g) ?? 0) + 1);
      counts.set(c.id, cur);
    }
    const ranked = [...counts.values()].sort((a, b) => b.count - a.count);
    if (!ranked.length) return [];

    const genderOf = (cat: Category, votes?: Map<string, number>, total = 0): string => {
      const parent = cat.parent_id ? catById.get(cat.parent_id) : undefined;
      const fromTree = genderWord(cat.gender) || genderWord(parent?.name) || genderWord(parent?.gender);
      if (fromTree) return fromTree;
      const top = votes ? [...votes.entries()].sort((a, b) => b[1] - a[1])[0] : undefined;
      return top && total && top[1] / total >= 0.7 ? top[0] : "";
    };

    const out: Tile[] = ranked.map((r) => ({
      id: r.cat.id,
      slug: r.cat.slug,
      label: withGender(r.cat.name, genderOf(r.cat, r.genders, r.count)),
      image: r.cat.image_url || r.image,
      count: r.count,
    }));

    // Neighbouring aisles: siblings of the lead category, those sharing a
    // word with it first ("T-Shirts" → "Shirts", "Sweatshirts"), then by
    // catalogue position.
    const lead = ranked[0].cat;
    if (lead.parent_id) {
      const leadStems = stems(lead.name);
      const gender = genderOf(lead, ranked[0].genders, ranked[0].count);
      const siblings = all
        .filter((c) => c.parent_id === lead.parent_id && c.is_active !== false && !counts.has(c.id))
        .map((c) => ({
          c,
          overlap: stems(c.name).some((w) => leadStems.some((l) => l.includes(w) || w.includes(l))) ? 1 : 0,
        }))
        .sort((a, b) => b.overlap - a.overlap || (a.c.position ?? 0) - (b.c.position ?? 0));
      for (const { c } of siblings) {
        out.push({ id: c.id, slug: c.slug, label: withGender(c.name, gender), image: c.image_url, count: 0 });
      }
    }
    return out.slice(0, 10);
  }, [products, all]);

  if (tiles.length < 2) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.scroll}
    >
      {tiles.map((t) => (
        <TouchableOpacity
          key={t.id}
          style={styles.tile}
          activeOpacity={0.8}
          onPress={() => router.push(`/(main)/products?category=${t.slug}` as never)}
          accessibilityRole="button"
          accessibilityLabel={`Shop ${t.label}`}
        >
          <View style={styles.thumb}>
            {t.image ? (
              <Image source={{ uri: t.image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
            ) : (
              <Ionicons name="shirt-outline" size={20} color="#a3a19b" />
            )}
          </View>
          <Text style={styles.label} numberOfLines={2}>
            {t.label}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0 },
  row: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 4, gap: 10 },
  tile: {
    flexDirection: "row",
    alignItems: "center",
    height: 60,
    paddingRight: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e4e2dc",
    backgroundColor: "#ffffff",
    overflow: "hidden",
    maxWidth: 220,
  },
  thumb: {
    width: 56,
    height: "100%",
    backgroundColor: "#f3f2ee",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    overflow: "hidden",
  },
  label: { fontFamily: fontFamilies.sans.semibold, fontSize: 14, color: INK, flexShrink: 1 },
});
