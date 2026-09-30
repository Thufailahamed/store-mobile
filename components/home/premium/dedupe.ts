import type { Product } from "@/lib/types";

/**
 * Keys that identify a product *as the shopper sees it*. Besides id we match
 * on slug and primary image, because the same piece can be listed by more
 * than one store (different ids, identical card) and feed rows don't always
 * carry the same id field as catalog rows.
 */
function keysFor(p: Product): string[] {
  const keys = [`id:${p.id}`];
  if (p.slug) keys.push(`slug:${p.slug}`);
  const img = p.images?.find((i) => i.is_primary)?.url ?? p.images?.[0]?.url;
  if (img) keys.push(`img:${img}`);
  return keys;
}

/** Tracks which products have already been shown on a page. */
export function createSeenSet() {
  const seen = new Set<string>();
  return {
    mark(list: Product[]) {
      for (const p of list) for (const k of keysFor(p)) seen.add(k);
    },
    has(p: Product) {
      return keysFor(p).some((k) => seen.has(k));
    },
    /** Unseen items from `list`; [] if fewer than `min` remain. Marks what it returns. */
    take(list: Product[] | undefined, min: number): Product[] {
      const fresh = (list ?? []).filter((p) => !this.has(p));
      if (fresh.length < min) return [];
      this.mark(fresh);
      return fresh;
    },
  };
}
