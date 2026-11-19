/**
 * "Checkout first, then shuffle" browse ordering.
 *
 * The first `lead` cart-checkout products (order_channel !== 'whatsapp'),
 * in the incoming order, open the grid (~5 rows on a 2-column phone grid).
 * Everything after that — remaining checkout products and all WhatsApp-only
 * sourced products — is shuffled with a seeded PRNG, so one seed gives the
 * same order on every page request (pagination stays consistent).
 *
 * Mirrored verbatim in store/src/lib/checkout-first-mix.ts and
 * store-mobile/lib/checkout-first-mix.ts — keep the three in sync.
 */

export const CHECKOUT_FIRST_LEAD = 10;

type Channelled = { order_channel?: string | null };

/** mulberry32 — tiny deterministic PRNG, uniform in [0, 1). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function isCheckoutProduct(p: Channelled): boolean {
  return p.order_channel !== "whatsapp";
}

export function checkoutFirstMix<T extends Channelled>(
  items: readonly T[],
  opts: { seed: number; lead?: number },
): T[] {
  const lead = Math.max(0, opts.lead ?? CHECKOUT_FIRST_LEAD);
  const head: T[] = [];
  const rest: T[] = [];
  for (const item of items) {
    if (head.length < lead && isCheckoutProduct(item)) head.push(item);
    else rest.push(item);
  }
  const rand = mulberry32(opts.seed);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return [...head, ...rest];
}
