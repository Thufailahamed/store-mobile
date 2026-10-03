import type { V2Suggestion } from "@/lib/api";

/**
 * Curated Luxury & Contemporary Fashion Taxonomy
 * Covers garments, materials, silhouettes, styles, footwear, and accessories.
 */
export const FASHION_TAXONOMY: string[] = [
  // Shirts & Tops
  "Shirt",
  "Linen Shirt",
  "Cotton Shirt",
  "Silk Shirt",
  "Oversized Shirt",
  "Oxford Shirt",
  "Polo Shirt",
  "Casual Shirt",
  "Formal Shirt",
  "Denim Shirt",
  "Short Sleeve Shirt",
  "Long Sleeve Shirt",
  "Camp Collar Shirt",
  "Dress Shirt",
  "Overshirt",
  "Flannel Shirt",
  "Striped Shirt",
  "White Shirt",
  "Black Shirt",
  "T-Shirt",
  "Graphic Tee",
  "Basic Tee",
  "Oversized Tee",
  "Crop Top",
  "Blouse",
  "Tank Top",
  "Silk Cami",
  "Bodysuit",
  "Knit Polo",
  "Vest",

  // Dresses & Gowns
  "Dress",
  "Evening Dress",
  "Maxi Dress",
  "Mini Dress",
  "Midi Dress",
  "Slip Dress",
  "Cocktail Dress",
  "Wrap Dress",
  "Silk Dress",
  "Summer Dress",
  "Linen Dress",
  "Floral Dress",
  "Party Dress",
  "Backless Dress",
  "Shirt Dress",

  // Trousers & Bottoms
  "Trousers",
  "Linen Trousers",
  "Pleated Pants",
  "Wide Leg Trousers",
  "Tailored Trousers",
  "Chinos",
  "Cargo Pants",
  "Drawstring Pants",
  "Straight Leg Pants",
  "Cropped Trousers",
  "Shorts",
  "Bermuda Shorts",
  "Linen Shorts",
  "Swim Shorts",

  // Jeans & Denim
  "Jeans",
  "Straight Leg Jeans",
  "Wide Leg Jeans",
  "Slim Jeans",
  "Vintage Denim",
  "Raw Denim",
  "Denim Jacket",
  "White Jeans",
  "Black Jeans",

  // Tailoring & Suiting
  "Blazer",
  "Linen Blazer",
  "Double Breasted Blazer",
  "Tailored Suit",
  "Tuxedo",
  "Structured Blazer",
  "Oversized Blazer",
  "Waistcoat",

  // Outerwear & Knitwear
  "Jacket",
  "Leather Jacket",
  "Trench Coat",
  "Wool Overcoat",
  "Bomber Jacket",
  "Cardigan",
  "Cashmere Cardigan",
  "Sweater",
  "Cashmere Sweater",
  "Merino Crewneck",
  "Knitwear",
  "Hoodie",
  "Zip Hoodie",
  "Sweatshirt",
  "Puffer Jacket",
  "Windbreaker",

  // Footwear
  "Shoes",
  "Loafers",
  "Leather Loafers",
  "Suede Loafers",
  "Sneakers",
  "Minimalist Sneakers",
  "Leather Sneakers",
  "Boots",
  "Chelsea Boots",
  "Ankle Boots",
  "Mules",
  "Sandals",
  "Leather Slides",
  "Heels",
  "Stilettos",
  "Derby Shoes",
  "Oxfords",

  // Bags & Leather Goods
  "Bag",
  "Tote Bag",
  "Leather Tote",
  "Canvas Tote",
  "Crossbody Bag",
  "Shoulder Bag",
  "Clutch",
  "Mini Bag",
  "Backpack",
  "Leather Backpack",
  "Card Holder",
  "Leather Wallet",

  // Accessories & Jewellery
  "Belt",
  "Leather Belt",
  "Silk Scarf",
  "Scarf",
  "Sunglasses",
  "Shades",
  "Watch",
  "Chronograph Watch",
  "Ring",
  "Signet Ring",
  "Necklace",
  "Gold Necklace",
  "Bracelet",
  "Cap",
  "Baseball Cap",
  "Bucket Hat",

  // Fabrics & Themes
  "Linen",
  "Silk",
  "Cashmere",
  "Merino Wool",
  "Cotton",
  "Leather",
  "Suede",
  "Velvet",
  "Satin",
  "Old Money",
  "Resort '26",
  "Summer Collection",
  "Monochrome",
  "Minimalist",
];

export const POPULAR_SEARCH_TAGS = [
  "Linen Shirts",
  "Tailored Blazers",
  "Silk Slip Dress",
  "Leather Loafers",
  "Cashmere Knits",
  "Summer Resort '26",
  "Wide Leg Trousers",
  "Minimalist Sneakers",
];

export const POPULAR_DEPARTMENTS = [
  { label: "Women", icon: "sparkles", path: "/(main)/products?gender=women" },
  { label: "Men", icon: "cube-outline", path: "/(main)/products?gender=men" },
  { label: "Shoes", icon: "footsteps-outline", path: "/(main)/products?category=shoes" },
  { label: "Bags", icon: "bag-handle-outline", path: "/(main)/products?category=bags" },
  { label: "Sale & Edit", icon: "pricetag-outline", path: "/(main)/products?sale=true" },
];

/**
 * Returns ranked keyword completions matching the user query from the taxonomy.
 */
export function getFashionKeywordCompletions(rawQuery: string, limit = 6): V2Suggestion[] {
  const q = rawQuery.trim().toLowerCase();
  if (q.length < 1) return [];

  const exact: string[] = [];
  const startsWith: string[] = [];
  const wordStarts: string[] = [];
  const contains: string[] = [];

  for (const phrase of FASHION_TAXONOMY) {
    const lower = phrase.toLowerCase();
    if (lower === q) {
      exact.push(phrase);
    } else if (lower.startsWith(q)) {
      startsWith.push(phrase);
    } else if (lower.split(/\s+/).some((word) => word.startsWith(q))) {
      wordStarts.push(phrase);
    } else if (lower.includes(q)) {
      contains.push(phrase);
    }
  }

  const combined = [...exact, ...startsWith, ...wordStarts, ...contains];
  const unique = Array.from(new Set(combined)).slice(0, limit);

  return unique.map((label) => ({
    kind: "keyword",
    label,
  }));
}

/**
 * Synthesizes smart department intent chips (e.g. "Shop Men's Shirts", "Shop Women's Shirts")
 * for fashion terms.
 */
export interface DepartmentChip {
  key: string;
  label: string;
  query: string;
  department?: "men" | "women" | "kids";
}

const COMMON_GARMENTS = new Set([
  "shirt",
  "shirts",
  "t-shirt",
  "tee",
  "top",
  "dress",
  "dresses",
  "pants",
  "trousers",
  "jeans",
  "denim",
  "shorts",
  "blazer",
  "suit",
  "jacket",
  "coat",
  "sweater",
  "cardigan",
  "hoodie",
  "shoes",
  "loafers",
  "sneakers",
  "boots",
  "sandals",
  "bag",
  "bags",
  "belt",
  "scarf",
  "watch",
  "sunglasses",
  "hat",
  "cap",
]);

export function getDepartmentIntentChips(rawQuery: string): DepartmentChip[] {
  const q = rawQuery.trim().toLowerCase();
  if (q.length < 2) return [];

  const tokens = q.split(/\s+/).filter(Boolean);
  const isGarment = tokens.some((t) => COMMON_GARMENTS.has(t) || COMMON_GARMENTS.has(t.replace(/s$/, "")));

  const chips: DepartmentChip[] = [];

  if (isGarment) {
    const term = rawQuery.trim();
    chips.push({
      key: "all",
      label: `All “${term}”`,
      query: term,
    });
    chips.push({
      key: "men",
      label: `Men's ${term}`,
      query: `Men ${term}`,
      department: "men",
    });
    chips.push({
      key: "women",
      label: `Women's ${term}`,
      query: `Women ${term}`,
      department: "women",
    });
    chips.push({
      key: "sale",
      label: `Sale ${term}`,
      query: `${term} sale`,
    });
  } else {
    // Non-garment search (e.g. color, fabric, lifestyle)
    const term = rawQuery.trim();
    chips.push({
      key: "all",
      label: `All “${term}”`,
      query: term,
    });
    chips.push({
      key: "women",
      label: `In Women's`,
      query: `Women ${term}`,
      department: "women",
    });
    chips.push({
      key: "men",
      label: `In Men's`,
      query: `Men ${term}`,
      department: "men",
    });
  }

  return chips;
}

/**
 * Filter live categories against the query.
 */
export function matchCategories(
  rawQuery: string,
  categories: Array<{ id: string; name: string; slug?: string }>,
  limit = 4,
): V2Suggestion[] {
  const q = rawQuery.trim().toLowerCase();
  if (!q || !categories.length) return [];

  const matches = categories.filter((c) => {
    const name = c.name.toLowerCase();
    return name.startsWith(q) || name.includes(q);
  });

  return matches.slice(0, limit).map((c) => ({
    kind: "category",
    label: c.name,
    slug: c.slug ?? c.name.toLowerCase().replace(/\s+/g, "-"),
  }));
}

/**
 * Filter live brands against the query.
 */
export function matchBrands(
  rawQuery: string,
  brands: Array<{ id: string; name: string; slug?: string; logo_url?: string | null; followers?: number; is_verified?: boolean }>,
  limit = 4,
): V2Suggestion[] {
  const q = rawQuery.trim().toLowerCase();
  if (!q || !brands.length) return [];

  const matches = brands.filter((b) => {
    const name = b.name.toLowerCase();
    return name.startsWith(q) || name.includes(q);
  });

  return matches.slice(0, limit).map((b) => ({
    kind: "brand",
    label: b.name,
    slug: b.slug ?? b.name.toLowerCase().replace(/\s+/g, "-"),
    logo_url: b.logo_url ?? undefined,
    followers: b.followers,
    is_verified: b.is_verified,
  }));
}

// ---------------------------------------------------------------------------
// Smart-search attr chips — mirrors backend attr-parse dictionaries so a
// partial draft like "red dr" offers a `red · dress` chip that submits the
// boosted full query. Pure local logic, no network.
// ---------------------------------------------------------------------------

const CHIP_COLORS = new Set([
  "navy blue", "rose gold", "off-white", "light blue", "dark blue",
  "light green", "dark green", "light pink", "hot pink", "baby pink",
  "red", "blue", "green", "black", "white", "gray", "grey", "pink", "yellow",
  "orange", "purple", "brown", "beige", "cream", "ivory", "gold", "silver",
  "maroon", "burgundy", "teal", "turquoise", "olive", "khaki", "mustard",
  "coral", "peach", "lavender", "mint", "charcoal", "taupe", "nude", "multicolor",
]);
const CHIP_ALIAS: Record<string, string> = { grey: "gray" };

const CHIP_GARMENTS = new Set([
  "dress", "gown", "frock", "shirt", "tshirt", "t-shirt", "tee", "blouse",
  "watch", "shoes", "sneakers", "heels", "sandals", "bag", "handbag",
  "backpack", "saree", "sari", "abaya", "kurta", "jeans", "denim",
  "trousers", "pants", "skirt", "jacket", "blazer", "coat", "perfume",
]);

export function attrChipForPartial(rawQuery: string): { label: string; query: string } | null {
  let rest = ` ${rawQuery.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ")} `;
  const take = (phrase: string): boolean => {
    const n = ` ${phrase} `;
    if (rest.includes(n)) { rest = rest.replace(n, " "); return true; }
    return false;
  };
  const colors: string[] = [];
  for (const c of [...CHIP_COLORS].sort((a, b) => b.length - a.length)) {
    if (take(c)) { const canon = CHIP_ALIAS[c] ?? c; if (!colors.includes(canon)) colors.push(canon); }
  }
  let garment: string | null = null;
  for (const g of [...CHIP_GARMENTS].sort((a, b) => b.length - a.length)) {
    if (take(g)) { garment = g === "gown" ? "dress" : g; break; }
  }
  // Partial draft: a leftover token that is a prefix of a garment
  // ("red dr") completes to the shortest matching garment.
  if (!garment) {
    const restTokens = rest.trim().split(/\s+/).filter(Boolean);
    for (const t of restTokens) {
      if (t.length < 2) continue;
      const hit = [...CHIP_GARMENTS].filter((g) => g.startsWith(t) && g !== t).sort((a, b) => a.length - b.length)[0];
      if (hit) { garment = hit === "gown" ? "dress" : hit; rest = rest.replace(` ${t} `, " "); break; }
    }
  }
  if (colors.length === 0 && !garment) return null;
  const parts = [...colors, garment ?? ""].filter(Boolean);
  return { label: parts.join(" · "), query: parts.join(" ") };
}
