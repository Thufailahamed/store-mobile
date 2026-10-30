/**
 * Canonical shopper-facing facet vocabulary.
 *
 * Seller variant colours ("Cobalt Blue", "Black Dial") and AI-extracted
 * attrs ("garden party", "pleated fabric", "maxi gown") are free text, so
 * exact-match filters miss most products. Everything here maps that text
 * onto a small fixed vocabulary — deterministically, no model calls.
 *
 * MIRRORED verbatim in store/src/lib/facet-vocab.ts and
 * store-mobile/lib/facet-vocab.ts — keep the three copies identical.
 */

export interface FacetOption {
  key: string;
  label: string;
}

export interface ColorFamily extends FacetOption {
  hex: string;
}

/* ------------------------------------------------------------------ */
/*  Text helpers                                                       */
/* ------------------------------------------------------------------ */

function words(raw: string | null | undefined): string[] {
  return (raw ?? "")
    .toLowerCase()
    .replace(/t[\s-]?shirts?\b/g, "tshirt")
    .replace(/[^a-z]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

function singular(w: string): string {
  if (w.length <= 3 || /(ss|us|is|as)$/.test(w)) return w;
  if (/(ches|shes|sses|xes)$/.test(w)) return w.slice(0, -2);
  if (w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.endsWith("s")) return w.slice(0, -1);
  return w;
}

/** Joined text with single spaces so multi-word phrases can be matched. */
function phraseText(raw: string | null | undefined): string {
  return ` ${words(raw).map(singular).join(" ")} `;
}

/**
 * First option (in priority order) whose keyword list hits the text.
 * Keywords may be multi-word phrases; matched on whole words, plural-insensitive.
 */
function firstHit(raw: string | null | undefined, table: Array<[string, string[]]>): string | null {
  const text = phraseText(raw);
  if (!text.trim()) return null;
  for (const [key, keywords] of table) {
    if (keywords.some((k) => text.includes(` ${k} `))) return key;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Colour families                                                    */
/* ------------------------------------------------------------------ */

export const COLOR_FAMILIES: ColorFamily[] = [
  { key: "black", label: "Black", hex: "#16170f" },
  { key: "white", label: "White", hex: "#f5f4ef" },
  { key: "grey", label: "Grey", hex: "#7a7a72" },
  { key: "beige", label: "Beige", hex: "#d9c9a8" },
  { key: "brown", label: "Brown", hex: "#6b4a2f" },
  { key: "red", label: "Red", hex: "#b3261e" },
  { key: "pink", label: "Pink", hex: "#e2a4b8" },
  { key: "orange", label: "Orange", hex: "#d9722b" },
  { key: "yellow", label: "Yellow", hex: "#e3b92b" },
  { key: "green", label: "Green", hex: "#3f7a3a" },
  { key: "blue", label: "Blue", hex: "#2563eb" },
  { key: "navy", label: "Navy", hex: "#1e2a4a" },
  { key: "purple", label: "Purple", hex: "#7b4ba0" },
  { key: "gold", label: "Gold", hex: "#c9a24a" },
  { key: "silver", label: "Silver", hex: "#bfc3c7" },
  { key: "multi", label: "Multi", hex: "conic-gradient(#b3261e,#e3b92b,#3f7a3a,#2563eb,#7b4ba0,#b3261e)" },
];

/** Multi-word shades that must win over their component words. */
const COLOR_PHRASES: Array<[string, string]> = [
  ["off white", "beige"],
  ["midnight blue", "navy"],
  ["navy blue", "navy"],
  ["rose gold", "gold"],
  ["dusty rose", "pink"],
];

const COLOR_WORDS: Record<string, string> = {};
const colorWords: Array<[string, string[]]> = [
  ["black", ["black", "jet", "onyx", "ebony"]],
  ["white", ["white", "snow", "optic"]],
  ["grey", ["grey", "gray", "charcoal", "slate", "ash", "smoke", "smoked", "graphite", "gunmetal", "heather"]],
  ["beige", ["beige", "ivory", "cream", "sand", "nude", "ecru", "khaki", "camel", "oatmeal", "stone", "champagne", "bone"]],
  ["brown", ["brown", "tan", "chocolate", "coffee", "mocha", "cognac", "taupe", "walnut", "chestnut", "espresso"]],
  ["red", ["red", "crimson", "scarlet", "maroon", "burgundy", "wine", "cherry", "ruby", "oxblood"]],
  ["pink", ["pink", "blush", "rose", "fuchsia", "magenta", "salmon"]],
  ["orange", ["orange", "rust", "terracotta", "saffron", "coral", "peach", "apricot", "copper", "tangerine", "amber"]],
  ["yellow", ["yellow", "mustard", "lemon", "ochre"]],
  ["green", ["green", "olive", "emerald", "sage", "mint", "forest", "jade", "teal", "lime", "bottle"]],
  ["blue", ["blue", "cobalt", "azure", "sky", "indigo", "turquoise", "aqua", "cyan", "denim", "ice"]],
  ["navy", ["navy", "midnight"]],
  ["purple", ["purple", "violet", "lavender", "lilac", "plum", "mauve"]],
  ["gold", ["gold", "golden", "brass"]],
  ["silver", ["silver", "steel", "chrome", "platinum"]],
  ["multi", ["multi", "multicolor", "multicolour", "rainbow"]],
];
for (const [fam, ws] of colorWords) for (const w of ws) COLOR_WORDS[w] = fam;

/**
 * Every colour family a free-text colour belongs to, in mention order.
 * "Cobalt Blue" → ["blue"], "Gold / Silver" → ["gold","silver"],
 * "Midnight Blue" → ["navy"], "Black Dial" → ["black"].
 */
export function colorFamilies(raw: string | null | undefined): string[] {
  let text = ` ${words(raw).join(" ")} `;
  const out: string[] = [];
  for (const [phrase, fam] of COLOR_PHRASES) {
    if (text.includes(` ${phrase} `)) {
      if (!out.includes(fam)) out.push(fam);
      text = text.replace(` ${phrase} `, " ");
    }
  }
  for (const w of text.trim().split(" ")) {
    const fam = COLOR_WORDS[w];
    if (fam && !out.includes(fam)) out.push(fam);
  }
  // A navy shade is not what a shopper means by "blue".
  if (out.includes("navy")) return out.filter((f) => f !== "blue");
  return out;
}

/* ------------------------------------------------------------------ */
/*  Occasion                                                           */
/* ------------------------------------------------------------------ */

export const OCCASIONS: FacetOption[] = [
  { key: "casual", label: "Casual" },
  { key: "work", label: "Work" },
  { key: "formal", label: "Formal" },
  { key: "evening", label: "Evening" },
  { key: "party", label: "Party" },
  { key: "wedding", label: "Wedding" },
  { key: "festive", label: "Festive" },
  { key: "sport", label: "Sport" },
  { key: "beach", label: "Beach & Holiday" },
];

/** Priority order — the most specific occasion wins ("cocktail party" → party). */
const OCCASION_TABLE: Array<[string, string[]]> = [
  ["wedding", ["wedding", "bridal", "bride", "bridesmaid", "engagement"]],
  ["festive", ["festive", "festival", "eid", "diwali", "christmas", "avurudu", "traditional", "religious", "ethnic"]],
  ["party", ["party", "club", "clubbing", "celebration"]],
  ["evening", ["evening", "night", "dinner", "cocktail", "date", "gala"]],
  ["formal", ["formal", "black tie", "ceremony", "ceremonial"]],
  ["work", ["work", "office", "business", "workwear", "professional", "corporate"]],
  ["sport", ["sport", "gym", "athletic", "workout", "running", "training", "diving", "outdoor", "active", "athleisure", "yoga", "hiking"]],
  ["beach", ["beach", "vacation", "resort", "holiday", "swim", "pool", "travel"]],
  ["casual", ["casual", "everyday", "daily", "weekend", "day", "brunch", "relaxed", "lounge", "street"]],
];

export function occasionKey(raw: string | null | undefined): string | null {
  return firstHit(raw, OCCASION_TABLE);
}

/* ------------------------------------------------------------------ */
/*  Material                                                           */
/* ------------------------------------------------------------------ */

export const MATERIALS: FacetOption[] = [
  { key: "cotton", label: "Cotton" },
  { key: "linen", label: "Linen" },
  { key: "silk", label: "Silk" },
  { key: "satin", label: "Satin" },
  { key: "chiffon", label: "Chiffon" },
  { key: "lace", label: "Lace" },
  { key: "velvet", label: "Velvet" },
  { key: "denim", label: "Denim" },
  { key: "wool", label: "Wool & Cashmere" },
  { key: "knit", label: "Knit & Fleece" },
  { key: "leather", label: "Leather & Suede" },
  { key: "synthetic", label: "Synthetic" },
  { key: "metal", label: "Metal" },
  { key: "glass", label: "Glass" },
];

/** Priority order — the most distinctive material wins ("silk chiffon" → chiffon). */
const MATERIAL_TABLE: Array<[string, string[]]> = [
  ["denim", ["denim", "jean"]],
  ["leather", ["leather", "suede", "nubuck", "patent"]],
  ["velvet", ["velvet", "velour"]],
  ["lace", ["lace", "crochet"]],
  ["chiffon", ["chiffon", "georgette", "organza", "tulle"]],
  ["satin", ["satin", "charmeuse"]],
  ["silk", ["silk"]],
  ["linen", ["linen", "flax"]],
  ["wool", ["wool", "cashmere", "merino", "tweed", "alpaca", "mohair"]],
  ["cotton", ["cotton", "poplin", "muslin", "chambray", "twill", "canvas", "seersucker"]],
  ["knit", ["knit", "fleece", "jersey", "rib", "ribbed", "terry", "french terry"]],
  ["synthetic", ["polyester", "nylon", "spandex", "elastane", "lycra", "rayon", "viscose", "modal", "acrylic", "synthetic", "mesh", "neoprene"]],
  ["metal", ["metal", "steel", "stainless", "gold", "silver", "titanium", "brass", "platinum", "alloy", "copper"]],
  ["glass", ["glass", "crystal"]],
];

export function materialKey(raw: string | null | undefined): string | null {
  return firstHit(raw, MATERIAL_TABLE);
}

/* ------------------------------------------------------------------ */
/*  Garment type (catalogue category agreement)                        */
/* ------------------------------------------------------------------ */

/** Priority order — "shirt dress" is a dress, "sweatshirt" is not a shirt. */
const GARMENT_TABLE: Array<[string, string[]]> = [
  ["dress", ["dress", "gown", "frock", "sundress", "kaftan"]],
  ["saree", ["saree", "sari", "lehenga"]],
  ["suit", ["suit", "tuxedo", "blazer"]],
  ["jeans", ["jeans", "jean"]],
  ["skirt", ["skirt"]],
  ["sweatshirt", ["sweatshirt", "hoodie", "pullover", "sweater", "jumper", "cardigan"]],
  ["tshirt", ["tshirt", "tee", "polo"]],
  ["shirt", ["shirt", "kurta"]],
  ["top", ["top", "blouse", "tank", "camisole", "cami", "bodysuit", "crop"]],
  ["trouser", ["trouser", "pant", "chino", "jogger", "legging", "short"]],
  ["jacket", ["jacket", "coat", "parka", "bomber", "windbreaker"]],
  ["sneaker", ["sneaker", "trainer", "running shoe"]],
  ["boot", ["boot"]],
  ["sandal", ["sandal", "slide", "flip flop", "heel", "slipper"]],
  ["watch", ["watch", "timepiece", "chronograph"]],
  ["perfume", ["perfume", "fragrance", "parfum", "cologne", "toilette", "attar", "oud", "scent", "mist"]],
  ["bag", ["bag", "handbag", "tote", "clutch", "backpack", "purse", "wallet"]],
  ["sunglasses", ["sunglass", "sunglasses", "eyewear", "shade"]],
  ["jewelry", ["jewelry", "jewellery", "necklace", "ring", "earring", "bracelet", "pendant", "bangle", "anklet"]],
];

/** Canonical garment type for an AI category or a catalogue category name. */
export function garmentKey(raw: string | null | undefined): string | null {
  return firstHit(raw, GARMENT_TABLE);
}

/* ------------------------------------------------------------------ */
/*  Product helpers (work on list-payload shaped products)             */
/* ------------------------------------------------------------------ */

type AttrBag = { occasion?: string | null; material?: string | null } | null | undefined;
export interface FacetProduct {
  variants?: Array<{ color?: string | null }> | null;
  ai_attrs?: AttrBag | AttrBag[];
}

function attrsOf(p: FacetProduct): { occasion?: string | null; material?: string | null } {
  const a = p.ai_attrs;
  return (Array.isArray(a) ? a[0] : a) ?? {};
}

export function productColorFamilies(p: FacetProduct): string[] {
  const out = new Set<string>();
  for (const v of p.variants ?? []) for (const f of colorFamilies(v.color)) out.add(f);
  return [...out];
}

export function productOccasion(p: FacetProduct): string | null {
  return occasionKey(attrsOf(p).occasion);
}

export function productMaterial(p: FacetProduct): string | null {
  return materialKey(attrsOf(p).material);
}

/** Accepts a canonical key, a label, or a legacy chip ("Olive" → "green"). */
export function resolveColorParam(v: string): string | null {
  const byKey = COLOR_FAMILIES.find((f) => f.key === v.toLowerCase() || f.label.toLowerCase() === v.toLowerCase());
  return byKey?.key ?? colorFamilies(v)[0] ?? null;
}
export function resolveOccasionParam(v: string): string | null {
  return OCCASIONS.find((o) => o.key === v.toLowerCase())?.key ?? occasionKey(v);
}
export function resolveMaterialParam(v: string): string | null {
  return MATERIALS.find((m) => m.key === v.toLowerCase())?.key ?? materialKey(v);
}
