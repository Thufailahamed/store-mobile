/**
 * Product ranker.
 *
 * Scores candidate products against a user profile and applies popularity,
 * recency, diversity, and repeat-penalties to produce a final ranking.
 *
 * The ranker is content-aware: it inspects the product's category, brand,
 * tags, material, variant colors, and price. It deliberately stays generic
 * over the `Product` type so it can rank any list the engine pulls.
 */

import type { Product } from "@/lib/types";
import { type UserProfile, profilePriceCenter } from "./profile";
import { extractGarmentToken } from "./events";
import { isProductInStock, minVariantStock } from "./inventory";

export interface RankedProduct {
  product: Product;
  score: number;
  /** Why this product was picked — for debugging / UI badges. */
  reasons: string[];
  /** Granular reason metadata (which axis matched and how strongly). */
  reasonDetails?: { axis: string; weight: number }[];
}

export interface RankOptions {
  /** Number of results to return. Default 12. */
  limit?: number;
  /** Exclude these product ids. */
  excludeIds?: string[];
  /** Boost products in the same category as this anchor product. */
  anchorProduct?: Product | null;
  /** If true, diversity penalty is applied across the result list. Default true. */
  diversity?: boolean;
  /** Minimum score for a product to be included. Default -Infinity. */
  minScore?: number;
  /** Skip out-of-stock products. Default true. */
  filterInStock?: boolean;
  /** Per-store cap. Default 3. */
  storeCap?: number;
  /** Per-brand cap (overrides store cap for brand_id). Default 2. */
  brandCap?: number;
  /** Per-category cap. Default 3. */
  categoryCap?: number;
}

const FIELD_WEIGHTS = {
  category: 3.0,
  brand: 2.0,
  material: 1.5,
  garment: 1.5,
  color: 1.0,
  tag: 1.0,
  gender: 0.5,
  price: 0.8,
} as const;

/** Normalize an affinity map into the [0, 1] range based on its max. */
function normalize(map: Record<string, number>): Record<string, number> {
  let max = 0;
  for (const v of Object.values(map)) {
    const abs = Math.abs(v);
    if (abs > max) max = abs;
  }
  if (max === 0) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(map)) {
    out[k] = v / max;
  }
  return out;
}

/** Cheap price band classifier (low / mid / high) for diversity scoring. */
function priceBand(price: number): "low" | "mid" | "high" {
  if (price <= 0) return "mid";
  if (price < 50) return "low"; // adjust per currency; reasonable default
  if (price < 200) return "mid";
  return "high";
}

/**
 * Affinity of a single product against a normalized profile.
 * Returns a value in [-1, 1] when the profile is non-empty; 0 otherwise.
 */
export function productAffinity(product: Product, profile: UserProfile): { score: number; reasons: string[]; details: { axis: string; weight: number }[] } {
  const reasons: string[] = [];
  const details: { axis: string; weight: number }[] = [];
  let total = 0;
  let weightSum = 0;

  const catN = normalize(profile.categories);
  const brN = normalize(profile.brands);
  const matN = normalize(profile.materials);
  const colN = normalize(profile.colors);
  const garN = normalize(profile.garments);
  const tagN = normalize(profile.tags);
  const genN = normalize(profile.genders);

  if (product.category_id && catN[product.category_id] !== undefined) {
    const v = catN[product.category_id];
    total += v * FIELD_WEIGHTS.category;
    weightSum += FIELD_WEIGHTS.category;
    if (Math.abs(v) > 0.4) {
      reasons.push(v >= 0 ? "category" : "category-");
      details.push({ axis: "category", weight: v * FIELD_WEIGHTS.category });
    }
  }

  if (product.brand_id && brN[product.brand_id] !== undefined) {
    const v = brN[product.brand_id];
    total += v * FIELD_WEIGHTS.brand;
    weightSum += FIELD_WEIGHTS.brand;
    if (Math.abs(v) > 0.4) {
      reasons.push(v >= 0 ? "brand" : "brand-");
      details.push({ axis: "brand", weight: v * FIELD_WEIGHTS.brand });
    }
  }

  if (product.material) {
    const key = product.material.toLowerCase();
    if (matN[key] !== undefined) {
      const v = matN[key];
      total += v * FIELD_WEIGHTS.material;
      weightSum += FIELD_WEIGHTS.material;
      if (Math.abs(v) > 0.4) {
        reasons.push(v >= 0 ? "material" : "material-");
        details.push({ axis: "material", weight: v * FIELD_WEIGHTS.material });
      }
    }
  }

  const garment = extractGarmentToken(product);
  if (garment && garN[garment] !== undefined) {
    const v = garN[garment];
    total += v * FIELD_WEIGHTS.garment;
    weightSum += FIELD_WEIGHTS.garment;
    if (Math.abs(v) > 0.4) {
      reasons.push(v >= 0 ? "garment" : "garment-");
      details.push({ axis: "garment", weight: v * FIELD_WEIGHTS.garment });
    }
  }

  if (product.variants && product.variants.length > 0) {
    const colorSet = new Set(
      product.variants.map((v) => (v.color ?? "").trim().toLowerCase()).filter(Boolean),
    );
    let best = 0;
    for (const c of colorSet) {
      if (colN[c] !== undefined && colN[c] > best) best = colN[c];
    }
    if (best > 0) {
      total += best * FIELD_WEIGHTS.color;
      weightSum += FIELD_WEIGHTS.color;
      if (best > 0.4) {
        reasons.push("color");
        details.push({ axis: "color", weight: best * FIELD_WEIGHTS.color });
      }
    }
  }

  if (product.tags && product.tags.length > 0) {
    let best = 0;
    for (const tag of product.tags) {
      const k = tag.toLowerCase();
      if (tagN[k] !== undefined && tagN[k] > best) best = tagN[k];
    }
    if (best > 0) {
      total += best * FIELD_WEIGHTS.tag;
      weightSum += FIELD_WEIGHTS.tag;
      if (best > 0.4) {
        reasons.push("tag");
        details.push({ axis: "tag", weight: best * FIELD_WEIGHTS.tag });
      }
    }
  }

  if (product.gender && genN[product.gender] !== undefined && Math.abs(genN[product.gender]) > 0.5) {
    total += genN[product.gender] * FIELD_WEIGHTS.gender;
    weightSum += FIELD_WEIGHTS.gender;
  }

  const center = profilePriceCenter(profile);
  if (center > 0 && product.price > 0) {
    const ratio = product.price / center;
    const inBand = ratio >= 0.5 && ratio <= 2.0;
    const priceScore = inBand
      ? 1.0 - Math.min(1, Math.abs(Math.log2(ratio)) / 2.5)
      : -0.5;
    total += priceScore * FIELD_WEIGHTS.price;
  }

  const profileWeightSum =
    (Object.keys(profile.categories).length > 0 ? FIELD_WEIGHTS.category : 0) +
    (Object.keys(profile.brands).length > 0 ? FIELD_WEIGHTS.brand : 0) +
    (Object.keys(profile.materials).length > 0 ? FIELD_WEIGHTS.material : 0) +
    (Object.keys(profile.garments).length > 0 ? FIELD_WEIGHTS.garment : 0) +
    (Object.keys(profile.colors).length > 0 ? FIELD_WEIGHTS.color : 0) +
    (Object.keys(profile.tags).length > 0 ? FIELD_WEIGHTS.tag : 0) +
    (Object.keys(profile.genders).length > 0 ? FIELD_WEIGHTS.gender : 0) +
    (profile.priceWeightTotal > 0 ? FIELD_WEIGHTS.price : 0);

  if (profileWeightSum === 0) return { score: 0, reasons: [], details: [] };
  return { score: total / profileWeightSum, reasons, details };
}

function popularityScore(totalSales: number): number {
  if (!totalSales || totalSales <= 0) return 0;
  return Math.min(1, Math.log10(1 + totalSales) / 4);
}

function recencyScore(createdAt: string): number {
  const t = Date.parse(createdAt);
  if (Number.isNaN(t)) return 0;
  const ageDays = (Date.now() - t) / (24 * 60 * 60 * 1000);
  if (ageDays < 0) return 0.5;
  if (ageDays < 7) return 0.5;
  if (ageDays < 30) return 0.35;
  if (ageDays < 90) return 0.2;
  if (ageDays < 180) return 0.1;
  return 0;
}

function ratingScore(rating: number, totalReviews: number): number {
  if (!rating || totalReviews <= 0) return 0;
  const conf = Math.min(1, Math.log10(1 + totalReviews) / 2);
  return ((rating - 3) / 2) * conf;
}

/** A short human-readable label describing why we picked a product. */
export function humanReason(ranked: RankedProduct): string | null {
  const positives = ranked.reasonDetails?.filter((d) => d.weight > 0) ?? [];
  if (positives.length === 0) {
    if ((ranked.product.total_sales ?? 0) > 100) return "Popular pick";
    if ((ranked.product.rating ?? 0) >= 4.5) return "Top rated";
    return null;
  }
  // Pick the strongest single reason.
  positives.sort((a, b) => b.weight - a.weight);
  const top = positives[0];
  switch (top.axis) {
    case "category": return "Matches your taste";
    case "brand": return "From a brand you like";
    case "material": return "Same fabric you love";
    case "color": return "In a color you like";
    case "garment": return "Similar style";
    case "tag": return "Right up your alley";
    default: return "Picked for you";
  }
}

/**
 * Rank a list of candidate products against a profile.
 *
 * Personalization is weighted heavily when the user has signal, and the
 * popularity baseline is kept as a floor so a fresh user with no events
 * still gets reasonable results.
 */
export function rankProducts(
  products: Product[],
  profile: UserProfile,
  options: RankOptions = {},
): RankedProduct[] {
  const {
    limit = 12,
    excludeIds = [],
    anchorProduct = null,
    diversity = true,
    minScore = -Infinity,
    filterInStock = true,
    storeCap = 3,
    brandCap = 3,
    categoryCap = 4,
  } = options;
  const exclude = new Set<string>([...excludeIds, ...profile.excludedProductIds]);
  if (anchorProduct) exclude.add(anchorProduct.id);

  const basePersonalization = profile.hasSignal ? 1.0 : 0.15;
  const recentSet = new Set(profile.recentProductIds);

  const candidates = products
    .filter((p) => !exclude.has(p.id))
    .filter((p) => (filterInStock ? isProductInStock(p) : true))
    .map((product) => {
      const { score: aff, reasons, details } = productAffinity(product, profile);
      const pop = popularityScore(product.total_sales ?? 0);
      const rec = recencyScore(product.created_at);
      const rat = ratingScore(product.rating ?? 0, product.total_reviews ?? 0);

      let anchorBoost = 0;
      if (anchorProduct) {
        if (anchorProduct.category_id && product.category_id === anchorProduct.category_id) anchorBoost += 0.3;
        if (anchorProduct.brand_id && product.brand_id === anchorProduct.brand_id) anchorBoost += 0.2;
        if (
          anchorProduct.material &&
          product.material &&
          anchorProduct.material.toLowerCase() === product.material.toLowerCase()
        ) anchorBoost += 0.1;
      }

      const repeatPenalty = recentSet.has(product.id) ? -0.4 : 0;

      const discount = product.mrp > product.price
        ? Math.min(0.4, ((product.mrp - product.price) / product.mrp) * 0.6)
        : 0;

      // Low-stock urgency: tiny bonus for almost-out products.
      const minStock = minVariantStock(product);
      const lowStockBonus =
        minStock > 0 && minStock < 5 ? 0.15 : 0;

      const personalization = aff * 5.0;
      const score =
        basePersonalization * personalization +
        0.9 * pop +
        0.4 * rec +
        0.4 * rat +
        0.5 * anchorBoost +
        0.3 * discount +
        lowStockBonus +
        repeatPenalty;

      return { product, score, reasons, reasonDetails: details };
    })
    .filter((r) => r.score >= minScore);

  candidates.sort((a, b) => b.score - a.score);

  if (!diversity) {
    return candidates.slice(0, limit);
  }

  // Greedy diversity pass: enforce brand, store, and category caps. Also
  // try to mix price bands so a top-heavy result is balanced.
  const result: RankedProduct[] = [];
  const brandCount: Record<string, number> = {};
  const storeCount: Record<string, number> = {};
  const categoryCount: Record<string, number> = {};
  const bandCount: Record<string, number> = { low: 0, mid: 0, high: 0 };
  const pickedBands: string[] = [];

  for (const cand of candidates) {
    if (result.length >= limit) break;
    const brandKey = cand.product.brand_id ?? `store-${cand.product.store_id ?? "x"}`;
    const storeKey = cand.product.store_id ?? "_none";
    const catKey = cand.product.category_id ?? "_none";
    const band = priceBand(cand.product.price ?? 0);
    if ((brandCount[brandKey] ?? 0) >= brandCap) continue;
    if ((storeCount[storeKey] ?? 0) >= storeCap) continue;
    if ((categoryCount[catKey] ?? 0) >= categoryCap) continue;
    // Price-band diversity: don't let one band dominate the top 6 slots.
    if (result.length < 6 && pickedBands.length >= 2 && pickedBands.every((b) => b === band)) {
      continue;
    }
    result.push(cand);
    brandCount[brandKey] = (brandCount[brandKey] ?? 0) + 1;
    storeCount[storeKey] = (storeCount[storeKey] ?? 0) + 1;
    categoryCount[catKey] = (categoryCount[catKey] ?? 0) + 1;
    bandCount[band] = (bandCount[band] ?? 0) + 1;
    pickedBands.push(band);
  }

  // Top up with remaining candidates if we couldn't fill the slot.
  if (result.length < limit) {
    for (const cand of candidates) {
      if (result.length >= limit) break;
      if (result.includes(cand)) continue;
      result.push(cand);
    }
  }

  return result;
}

/**
 * Rank candidates as "similar to this product" (no profile needed).
 * Returns products that share category, brand, material, or tags with the
 * anchor, ranked by overlap + popularity.
 */
export function rankSimilarTo(
  products: Product[],
  anchor: Product,
  options: { limit?: number; excludeIds?: string[]; filterInStock?: boolean } = {},
): RankedProduct[] {
  const { limit = 8, excludeIds = [], filterInStock = true } = options;
  const exclude = new Set([anchor.id, ...excludeIds]);

  const anchorTags = new Set((anchor.tags ?? []).map((t) => t.toLowerCase()));
  const anchorColors = new Set(
    (anchor.variants ?? []).map((v) => (v.color ?? "").trim().toLowerCase()).filter(Boolean),
  );
  const anchorGarment = extractGarmentToken(anchor);

  const scored = products
    .filter((p) => !exclude.has(p.id))
    .filter((p) => (filterInStock ? isProductInStock(p) : true))
    .map((product) => {
      let overlap = 0;
      const reasons: string[] = [];
      const details: { axis: string; weight: number }[] = [];
      if (product.category_id && product.category_id === anchor.category_id) {
        overlap += 3.0;
        reasons.push("category");
        details.push({ axis: "category", weight: 3.0 });
      }
      if (product.brand_id && product.brand_id === anchor.brand_id) {
        overlap += 2.0;
        reasons.push("brand");
        details.push({ axis: "brand", weight: 2.0 });
      }
      if (
        product.material &&
        anchor.material &&
        product.material.toLowerCase() === anchor.material.toLowerCase()
      ) {
        overlap += 1.0;
        reasons.push("material");
        details.push({ axis: "material", weight: 1.0 });
      }
      const g = extractGarmentToken(product);
      if (g && anchorGarment && g === anchorGarment) {
        overlap += 1.5;
        reasons.push("garment");
        details.push({ axis: "garment", weight: 1.5 });
      }
      if (anchorColors.size > 0 && product.variants && product.variants.length > 0) {
        const productColors = new Set(
          product.variants.map((v) => (v.color ?? "").trim().toLowerCase()).filter(Boolean),
        );
        for (const c of productColors) {
          if (anchorColors.has(c)) {
            overlap += 0.6;
            reasons.push("color");
            details.push({ axis: "color", weight: 0.6 });
            break;
          }
        }
      }
      let tagOverlap = 0;
      for (const t of product.tags ?? []) {
        if (anchorTags.has(t.toLowerCase())) tagOverlap += 0.4;
      }
      if (tagOverlap > 0) {
        overlap += tagOverlap;
        reasons.push("tag");
        details.push({ axis: "tag", weight: tagOverlap });
      }
      if (product.gender && product.gender === anchor.gender) {
        overlap += 0.4;
      }

      const pop = popularityScore(product.total_sales ?? 0);
      const rec = recencyScore(product.created_at);
      const rat = ratingScore(product.rating ?? 0, product.total_reviews ?? 0);
      const score = overlap * 2.0 + pop * 0.6 + rec * 0.3 + rat * 0.4;
      return { product, score, reasons, reasonDetails: details };
    })
    .filter((r) => r.score > 0);

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

/**
 * Re-rank an existing list (e.g. search results) against the user's
 * profile, lightly. Adds a personalization boost on top of the existing
 * score and excludes the user's disliked products.
 */
export function personalizeResults<T extends Product>(
  products: T[],
  profile: UserProfile,
  options: { limit?: number; excludeIds?: string[] } = {},
): T[] {
  const { limit, excludeIds = [] } = options;
  const exclude = new Set<string>([...excludeIds, ...profile.excludedProductIds]);
  const recentSet = new Set(profile.recentProductIds);

  const scored = products
    .filter((p) => !exclude.has(p.id))
    .filter((p) => isProductInStock(p))
    .map((p) => {
      const { score: aff } = productAffinity(p, profile);
      const pop = popularityScore(p.total_sales ?? 0);
      const rec = recencyScore(p.created_at);
      const rat = ratingScore(p.rating ?? 0, p.total_reviews ?? 0);
      const repeatPenalty = recentSet.has(p.id) ? -0.3 : 0;
      const personalization = profile.hasSignal ? aff * 1.5 : 0;
      const score = personalization + 0.4 * pop + 0.2 * rec + 0.2 * rat + repeatPenalty;
      return { product: p, score };
    });

  scored.sort((a, b) => b.score - a.score);
  const out = scored.map((s) => s.product);
  return typeof limit === "number" ? out.slice(0, limit) : out;
}
