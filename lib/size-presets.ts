/**
 * Category-aware size systems for product variants.
 *
 * Variant `size` is a free-text label, so seller editors offer presets
 * matched to the product type. Same option sets as the web editor
 * (store/src/lib/size-presets.ts) — keep the two in step.
 */
export type SizeSystem =
  | "apparel"
  | "waist"
  | "numeric"
  | "footwear"
  | "footwear_eu"
  | "onesize";

export const SIZE_PRESETS: Record<SizeSystem, readonly string[]> = {
  apparel: ["XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL", "5XL"],
  waist: ["28", "30", "32", "34", "36", "38", "40", "42"],
  numeric: ["38", "39", "40", "41", "42", "43", "44", "45", "46"],
  footwear: ["UK 5", "UK 6", "UK 7", "UK 8", "UK 9", "UK 10", "UK 11", "UK 12"],
  footwear_eu: ["EU 35", "EU 36", "EU 37", "EU 38", "EU 39", "EU 40", "EU 41", "EU 42", "EU 43", "EU 44", "EU 45", "EU 46"],
  onesize: ["One Size"],
};

export const DEFAULT_SIZES: Record<SizeSystem, readonly string[]> = {
  apparel: ["S", "M", "L"],
  waist: ["30", "32", "34", "36"],
  numeric: ["39", "40", "42", "44"],
  footwear: ["UK 7", "UK 8", "UK 9", "UK 10"],
  footwear_eu: ["EU 39", "EU 40", "EU 41", "EU 42"],
  onesize: ["One Size"],
};

/** Labels for the seller's size-system picker. */
export const SIZE_SYSTEM_LABELS: Record<SizeSystem, string> = {
  apparel: "Clothing",
  waist: "Waist",
  numeric: "Numeric",
  footwear: "UK shoes",
  footwear_eu: "EU shoes",
  onesize: "One size",
};

// Same lexical cues as the backend attr-parser (store-backend attr-parse.ts).
const FOOTWEAR_RE =
  /\b(shoes?|sneakers?|trainers?|sandals?|heels?|boots?|loafers?|slippers?|footwear|pumps?|wedges?|mules?|floaters?|flip[- ]?flops?)\b/i;
const WAIST_RE = /\b(jeans?|denims?|trousers?|pants|chinos?)\b/i;
const ONESIZE_RE =
  /\b(bags?|handbags?|totes?|watches?|jewell?ery|accessor(?:y|ies)|belts?|sunglasses?|wallets?|clutch(?:es)?|backpacks?|purses?|caps?|hats?|scar(?:f|ves))\b/i;

/** Pick the size system for a product. Pass category name first, then name. */
export function sizeSystemFor(
  ...hints: (string | null | undefined)[]
): SizeSystem {
  const t = hints.filter(Boolean).join(" ").toLowerCase();
  if (FOOTWEAR_RE.test(t)) return "footwear";
  if (WAIST_RE.test(t)) return "waist";
  if (ONESIZE_RE.test(t)) return "onesize";
  return "apparel";
}

const APPAREL_ORDER = [
  "XXS", "XS", "S", "M", "L", "XL", "XXL", "2XL", "3XL", "4XL", "5XL",
  "ONE SIZE", "FREE SIZE",
];

/**
 * Display order for size labels: apparel sequence first, then numerics
 * ascending ("UK 7" before "UK 10"), then anything else alphabetically.
 */
export function sortSizes(sizes: Iterable<string>): string[] {
  const order = new Map(APPAREL_ORDER.map((s, i) => [s, i]));
  return [...sizes].sort((a, b) => {
    const ai = order.get(a.trim().toUpperCase());
    const bi = order.get(b.trim().toUpperCase());
    if (ai !== undefined && bi !== undefined) return ai - bi;
    if (ai !== undefined) return -1;
    if (bi !== undefined) return 1;
    const an = parseFloat(a.replace(/[^\d.]/g, ""));
    const bn = parseFloat(b.replace(/[^\d.]/g, ""));
    const aNum = !Number.isNaN(an);
    const bNum = !Number.isNaN(bn);
    if (aNum && bNum) return an - bn;
    if (aNum) return -1;
    if (bNum) return 1;
    return a.localeCompare(b);
  });
}
