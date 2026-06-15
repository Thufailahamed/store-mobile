import type { Product } from "@/lib/types";

/**
 * Synonym maps for query expansion. Three categories:
 *   - COLOR_SYNONYMS     — color names → list of matching shades/aliases
 *   - MATERIAL_SYNONYMS  — fabric/material → matching fabric terms
 *   - GARMENT_SYNONYMS   — garment type → matching garment types
 *
 * Used by `expandTerms` to broaden matching (so "denim" matches "jeans"
 * products, "sneakers" matches "shoes", etc.) and by the constraint gate
 * in `scoreProduct` to require a match on any constrained query word.
 */
const COLOR_SYNONYMS: Record<string, string[]> = {
  navy: ["navy", "dark blue", "navy blue"],
  beige: ["beige", "tan", "khaki", "cream", "sand"],
  khaki: ["khaki", "beige", "tan", "sand"],
  grey: ["grey", "gray", "charcoal", "slate"],
  gray: ["gray", "grey", "charcoal", "slate"],
  charcoal: ["charcoal", "dark grey", "dark gray"],
  cream: ["cream", "off-white", "ivory", "beige"],
  ivory: ["ivory", "cream", "off-white", "white"],
  burgundy: ["burgundy", "maroon", "wine", "dark red"],
  maroon: ["maroon", "burgundy", "wine"],
  teal: ["teal", "turquoise", "cyan", "blue-green"],
  turquoise: ["turquoise", "teal", "cyan"],
  coral: ["coral", "salmon", "pink-orange"],
  rose: ["rose", "dusty pink", "blush", "mauve"],
  blush: ["blush", "light pink", "rose", "pale pink"],
  mauve: ["mauve", "dusty purple", "light purple"],
  lavender: ["lavender", "light purple", "lilac"],
  lilac: ["lilac", "lavender", "light purple"],
  mustard: ["mustard", "dark yellow", "gold"],
  olive: ["olive", "army green", "military green"],
  mint: ["mint", "light green", "seafoam"],
  peach: ["peach", "light orange", "salmon"],
  rust: ["rust", "burnt orange", "copper"],
  cobalt: ["cobalt", "bright blue", "royal blue"],
  indigo: ["indigo", "dark blue", "navy"],
  fuchsia: ["fuchsia", "hot pink", "magenta"],
  magenta: ["magenta", "fuchsia", "hot pink"],
  // Primary color mappings
  blue: ["blue", "navy", "indigo", "cobalt", "dark blue", "navy blue", "royal blue", "bright blue", "sky blue", "light blue"],
  red: ["red", "crimson", "burgundy", "maroon", "wine", "ruby", "scarlet"],
  green: ["green", "olive", "mint", "sage", "emerald", "army green", "military green", "teal"],
  yellow: ["yellow", "mustard", "gold", "lemon"],
  orange: ["orange", "peach", "rust", "coral", "terracotta", "saffron"],
  pink: ["pink", "rose", "blush", "fuchsia", "magenta", "coral"],
  purple: ["purple", "lavender", "lilac", "mauve", "plum", "violet", "indigo"],
  white: ["white", "ivory", "cream", "off-white"],
  black: ["black", "charcoal", "ebony", "onyx", "dark grey", "dark gray"],
  brown: ["brown", "tan", "beige", "khaki", "camel", "chocolate", "terracotta"],
};

/** Fabric / material synonyms. */
const MATERIAL_SYNONYMS: Record<string, string[]> = {
  denim: ["denim", "jeans"],
  jeans: ["jeans", "denim pants", "denim trousers", "denim bottoms"],
  leather: ["leather", "faux leather", "vegan leather", "pu leather"],
  cotton: ["cotton", "cotton blend", "100% cotton"],
  linen: ["linen", "flax"],
  silk: ["silk", "satin", "mulberry silk"],
  satin: ["satin", "silk"],
  wool: ["wool", "cashmere", "merino", "woolen"],
  cashmere: ["cashmere", "wool"],
  merino: ["merino", "wool"],
  polyester: ["polyester", "synthetic", "poly"],
  velvet: ["velvet", "velveteen"],
  suede: ["suede", "nubuck"],
  canvas: ["canvas", "duck cloth"],
  nylon: ["nylon", "polyamide"],
  rayon: ["rayon", "viscose"],
  chiffon: ["chiffon", "georgette"],
  lace: ["lace", "lacework"],
  knit: ["knit", "knitted", "jersey"],
};

/** Garment type synonyms. */
const GARMENT_SYNONYMS: Record<string, string[]> = {
  shirt: ["shirt", "shirts", "top", "tee", "tshirt", "t-shirt", "blouse"],
  tshirt: ["tshirt", "t-shirt", "tee", "shirt", "top"],
  pants: ["pants", "trousers", "bottoms", "leggings", "joggers", "track pants"],
  trousers: ["trousers", "pants", "bottoms"],
  shoes: ["shoes", "sneakers", "footwear", "boots", "loafers", "sandals", "heels", "pumps"],
  sneakers: ["sneakers", "shoes", "footwear", "trainers", "running shoes"],
  boots: ["boots", "shoes", "ankle boots", "knee boots"],
  jacket: ["jacket", "coat", "blazer", "outerwear", "cardigan"],
  coat: ["coat", "jacket", "outerwear", "overcoat"],
  blazer: ["blazer", "jacket", "sport coat"],
  dress: ["dress", "dresses", "gown", "midi dress", "maxi dress"],
  hoodie: ["hoodie", "hooded", "sweatshirt", "pullover"],
  sweatshirt: ["sweatshirt", "hoodie", "pullover"],
  bag: ["bag", "handbag", "tote", "tote bag", "purse", "clutch", "satchel", "backpack"],
  handbag: ["handbag", "bag", "purse", "tote", "shoulder bag"],
  shorts: ["shorts", "bermuda", "board shorts"],
  skirt: ["skirt", "skirts", "mini skirt", "pleated skirt"],
  sunglasses: ["sunglasses", "shades", "eyewear", "sun glasses"],
  watch: ["watch", "watches", "timepiece", "wristwatch"],
  cap: ["cap", "hat", "beanie", "headwear", "baseball cap"],
  hat: ["hat", "cap", "fedora", "headwear"],
  belt: ["belt", "belts", "waist belt"],
  scarf: ["scarf", "scarves", "muffler"],
  gloves: ["gloves", "mittens"],
  socks: ["socks", "sock", "ankle socks"],
  sweater: ["sweater", "jumper", "knitwear", "pullover"],
};

/**
 * Generic term expansion across all synonym maps.
 * First does a forward lookup (key → values), then a reverse lookup
 * (any value → its key's values). Falls back to the input lowercased.
 */
function expandFromMap(word: string, map: Record<string, string[]>): string[] {
  const lower = word.toLowerCase();
  if (map[lower]) return map[lower];
  for (const values of Object.values(map)) {
    if (values.includes(lower)) return values;
  }
  return [lower];
}

/** Expand a word using color synonyms only. */
export function expandColorTerms(word: string): string[] {
  return expandFromMap(word, COLOR_SYNONYMS);
}

/** Expand a word using material synonyms only. */
export function expandMaterialTerms(word: string): string[] {
  return expandFromMap(word, MATERIAL_SYNONYMS);
}

/** Expand a word using garment synonyms only. */
export function expandGarmentTerms(word: string): string[] {
  return expandFromMap(word, GARMENT_SYNONYMS);
}

/** Expand a word across all three synonym maps (color + material + garment). */
export function expandTerms(word: string): string[] {
  return [
    ...expandColorTerms(word),
    ...expandMaterialTerms(word),
    ...expandGarmentTerms(word),
  ];
}

/** Membership checks used by the constraint gate in `scoreProduct`. */
export function isColorWord(word: string): boolean {
  const lower = word.toLowerCase();
  if (COLOR_SYNONYMS[lower]) return true;
  return Object.values(COLOR_SYNONYMS).some((v) => v.includes(lower));
}
export function isMaterialWord(word: string): boolean {
  const lower = word.toLowerCase();
  if (MATERIAL_SYNONYMS[lower]) return true;
  return Object.values(MATERIAL_SYNONYMS).some((v) => v.includes(lower));
}
export function isGarmentWord(word: string): boolean {
  const lower = word.toLowerCase();
  if (GARMENT_SYNONYMS[lower]) return true;
  return Object.values(GARMENT_SYNONYMS).some((v) => v.includes(lower));
}

/** Tokenize a search query into cleaned lowercase words (≥2 chars). */
export function tokenizeQuery(q: string): string[] {
  return q
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9-]/g, ""))
    .filter((w) => w.length >= 2);
}

/** Extract color terms from a query word list. */
export function extractColorWords(words: string[]): string[] {
  const colorWords: string[] = [];
  for (const word of words) {
    if (isColorWord(word)) {
      colorWords.push(...expandColorTerms(word));
    }
  }
  return colorWords;
}

/** Extract material terms from a query word list. */
export function extractMaterialWords(words: string[]): string[] {
  const out: string[] = [];
  for (const word of words) {
    if (isMaterialWord(word)) {
      out.push(...expandMaterialTerms(word));
    }
  }
  return out;
}

/** Extract garment terms from a query word list. */
export function extractGarmentWords(words: string[]): string[] {
  const out: string[] = [];
  for (const word of words) {
    if (isGarmentWord(word)) {
      out.push(...expandGarmentTerms(word));
    }
  }
  return out;
}

/**
 * Extract every "constrained" word (color / material / garment) from a query,
 * fully expanded with synonyms. Used to power the constraint gate in
 * `scoreProduct`.
 */
export function extractConstraintWords(words: string[]): string[] {
  return [
    ...extractColorWords(words),
    ...extractMaterialWords(words),
    ...extractGarmentWords(words),
  ];
}

/**
 * Score a product against query words. Higher = more relevant.
 *
 * Scoring tiers:
 *   10 — exact word in product name
 *    8 — word in tags, variant colors, or brand name
 *    6 — word in category name
 *    4 — word in description or short_description
 *    3 — word in material, pattern, fit, store name
 *    2 — word in occasion, season
 *    1 — word in attributes JSON values
 *
 * Bonus: full-phrase match in name adds +15, in tags +10.
 *
 * Constraint gate: any query word that is a known color/material/garment
 * term must match the product in the appropriate fields. If a query word
 * is constrained and no product field carries any of its expanded forms,
 * the product is filtered out (returns 0). This is what makes
 * "blue denim" find a denim product with a blue variant — and not a
 * sneaker that happens to have a blue variant.
 */
export function scoreProduct(product: Product, words: string[], fullQuery: string): number {
  // ---- Constraint gate: color + material + garment terms must all match ----
  const productColors = [
    ...new Set(
      (product.variants ?? [])
        .map((v) => (v.color ?? "").toLowerCase())
        .filter(Boolean)
    ),
  ];
  const nameLower = (product.name ?? "").toLowerCase();
  const descLower = (product.description ?? "").toLowerCase();
  const shortLower = (product.short_description ?? "").toLowerCase();
  const tagsLower = (product.tags ?? []).map((t) => t.toLowerCase());
  const materialLower = (product.material ?? "").toLowerCase();
  const categoryNameLower = (product as Product & { category?: { name?: string } })
    .category?.name?.toLowerCase() ?? "";

  // Color constraint: at least one query color must hit the product.
  const queryColorWords = extractColorWords(words);
  if (queryColorWords.length > 0) {
    const matchesAny = queryColorWords.some((c) => {
      const cl = c.toLowerCase();
      return (
        productColors.some((pc) => pc.includes(cl) || cl.includes(pc)) ||
        nameLower.includes(cl) ||
        descLower.includes(cl) ||
        shortLower.includes(cl) ||
        tagsLower.some((t) => t.includes(cl))
      );
    });
    if (!matchesAny) return 0;
  }

  // Material constraint: query material term must hit name/desc/short/tags/material/category.
  const queryMaterialWords = extractMaterialWords(words);
  if (queryMaterialWords.length > 0) {
    const materialHaystack = [nameLower, descLower, shortLower, materialLower, categoryNameLower, ...tagsLower];
    const matchesAny = queryMaterialWords.some((m) => {
      const ml = m.toLowerCase();
      return materialHaystack.some((h) => h.includes(ml));
    });
    if (!matchesAny) return 0;
  }

  // Garment constraint: query garment term must hit name/desc/short/tags/category.
  const queryGarmentWords = extractGarmentWords(words);
  if (queryGarmentWords.length > 0) {
    const garmentHaystack = [nameLower, descLower, shortLower, categoryNameLower, ...tagsLower];
    const matchesAny = queryGarmentWords.some((g) => {
      const gl = g.toLowerCase();
      return garmentHaystack.some((h) => h.includes(gl));
    });
    if (!matchesAny) return 0;
  }

  // ---- Scoring ----
  let score = 0;

  const name = nameLower;
  const desc = descLower;
  const short = shortLower;
  const tags = tagsLower;
  const material = materialLower;
  const pattern = (product.pattern ?? "").toLowerCase();
  const fit = (product.fit ?? "").toLowerCase();
  const sleeve = (product.sleeve ?? "").toLowerCase();
  const occasion = (product.occasion ?? "").toLowerCase();
  const season = (product.season ?? "").toLowerCase();
  const brandName = (product.brand?.name ?? "").toLowerCase();
  const categoryName = categoryNameLower;
  const storeName = (product.store?.name ?? "").toLowerCase();

  const variantColorsArr = productColors;

  const attrValues = Object.values(product.attributes ?? {})
    .map((v) => (typeof v === "string" ? v.toLowerCase() : ""))
    .filter(Boolean);

  // Full-phrase bonus
  if (fullQuery.length >= 3) {
    if (name.includes(fullQuery)) score += 15;
    if (tags.some((t) => t.includes(fullQuery))) score += 10;
  }

  for (const word of words) {
    // Use the generic expander so material / garment words get the same
    // broad matching colors already had.
    const wordVariants = expandTerms(word);
    const matchesWord = (text: string) =>
      wordVariants.some((wv) => text.includes(wv));

    if (matchesWord(name)) score += 10;
    else if (tags.some((t) => matchesWord(t))) score += 8;
    else if (variantColorsArr.some((c) => matchesWord(c))) score += 8;
    else if (matchesWord(brandName)) score += 7;
    else if (matchesWord(categoryName)) score += 6;
    else if (matchesWord(desc)) score += 4;
    else if (matchesWord(short)) score += 4;
    else if (matchesWord(material) || matchesWord(pattern) || matchesWord(fit) || matchesWord(sleeve)) score += 3;
    else if (matchesWord(storeName)) score += 3;
    else if (matchesWord(occasion) || matchesWord(season)) score += 2;
    else if (attrValues.some((av) => matchesWord(av))) score += 1;
  }

  return score;
}

/**
 * Build Supabase OR filter parts for a query (for use in .or() calls).
 * Includes product-level fields + word-level expansion with color / material /
 * garment synonym broadening so a "jeans" query can match a product with
 * "denim" in its tags.
 */
export function buildSearchOrParts(q: string): string[] {
  const term = q.trim();
  const words = tokenizeQuery(term);
  const orParts: string[] = [];

  // Full-phrase matches
  orParts.push(`name.ilike.%${term}%`);
  orParts.push(`description.ilike.%${term}%`);
  orParts.push(`short_description.ilike.%${term}%`);

  // Tag array contains (full phrase)
  const tagPhrase = term.toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (tagPhrase) orParts.push(`tags.cs.{${tagPhrase}}`);

  // Word-level matches across more fields
  const searchFields = [
    "name",
    "description",
    "short_description",
    "material",
    "pattern",
    "fit",
    "sleeve",
    "occasion",
    "season",
  ];

  for (const word of words) {
    for (const field of searchFields) {
      orParts.push(`${field}.ilike.%${word}%`);
    }
    const tagWord = word.replace(/[^a-z0-9-]/g, "");
    if (tagWord) orParts.push(`tags.cs.{${tagWord}}`);

    // Synonym broadening: also match the word's expanded variants
    // (color / material / garment). Cheap, gives "jeans" → "denim" matching
    // at the SQL level for product-level fields.
    for (const variant of expandTerms(word)) {
      const v = variant.toLowerCase();
      if (!v || v === word) continue;
      for (const field of searchFields) {
        orParts.push(`${field}.ilike.%${v}%`);
      }
      const tagVariant = v.replace(/[^a-z0-9-]/g, "");
      if (tagVariant) orParts.push(`tags.cs.{${tagVariant}}`);
    }
  }

  return orParts;
}

/** Levenshtein distance between two strings (for typo tolerance). */
export function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/** Check if two strings are fuzzy-matching (within edit distance threshold). */
export function fuzzyMatch(a: string, b: string, threshold = 2): boolean {
  if (a.includes(b) || b.includes(a)) return true;
  if (Math.abs(a.length - b.length) > threshold) return false;
  return levenshtein(a, b) <= threshold;
}
