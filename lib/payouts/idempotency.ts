/**
 * Generate a short, unique idempotency key for mutating endpoints.
 *
 * Used by withdraw + Stripe Connect requests so the backend can dedupe retries
 * after a network timeout without double-charging the seller.
 *
 * Format: 12-char base36 timestamp prefix + 16-char hex random suffix.
 * Collision-safe for a single user's session — the backend also keys by user.
 */
export function generateIdempotencyKey(prefix: string = "luxe"): string {
  const ts = Date.now().toString(36).padStart(12, "0");
  const rand = Math.floor(Math.random() * 0xffffffff_ffffffff).toString(16).padStart(16, "0");
  return `${prefix}-${ts}-${rand}`;
}
