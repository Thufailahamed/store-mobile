import { supabase } from "@/lib/supabase/client";

export type CartReservationItem = {
  variant_id: string;
  store_id: string;
  quantity: number;
};

export type CartReservationSyncResult =
  | { ok: true; synced: number; expiresAt?: string }
  | { ok: false; error: string };

const DEFAULT_TTL_MINUTES = 15;
const DEBOUNCE_MS = 450;

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let pendingUserId: string | null = null;
let pendingItems: CartReservationItem[] = [];
let syncErrorHandler: ((message: string) => void) | null = null;

export function setCartReservationSyncErrorHandler(
  handler: ((message: string) => void) | null,
): void {
  syncErrorHandler = handler;
}

function normalizeItems(items: CartReservationItem[]): CartReservationItem[] {
  const byKey = new Map<string, CartReservationItem>();
  for (const item of items) {
    if (!item.variant_id || !item.store_id || item.quantity <= 0) continue;
    const key = `${item.variant_id}:${item.store_id}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.quantity = Math.max(existing.quantity, item.quantity);
    } else {
      byKey.set(key, { ...item });
    }
  }
  return Array.from(byKey.values());
}

/** Atomically hold cart quantities on the server (authenticated users only). */
export async function syncCartReservations(
  items: CartReservationItem[],
  ttlMinutes = DEFAULT_TTL_MINUTES,
): Promise<CartReservationSyncResult> {
  const payload = normalizeItems(items);
  const { data, error } = await supabase.rpc("sync_cart_reservations", {
    p_items: payload,
    p_ttl_minutes: ttlMinutes,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  const row = (data ?? {}) as { synced?: number; expires_at?: string };
  return {
    ok: true,
    synced: Number(row.synced ?? payload.length),
    expiresAt: row.expires_at,
  };
}

/** Release all holds for the signed-in user (e.g. after checkout or sign-out). */
export async function releaseCartReservations(): Promise<void> {
  await supabase.rpc("release_cart_reservations");
}

/** Debounced sync after cart mutations. No-op when userId is null. */
export function scheduleCartReservationSync(
  userId: string | null,
  items: CartReservationItem[],
): void {
  pendingUserId = userId;
  pendingItems = items;

  if (!userId) return;

  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    const uid = pendingUserId;
    const nextItems = pendingItems;
    debounceTimer = null;
    if (!uid) return;
    void syncCartReservations(nextItems).then((result) => {
      if (!result.ok) {
        syncErrorHandler?.(result.error);
      }
    });
  }, DEBOUNCE_MS);
}

/** Cancel an unpaid PayHere order and release cart holds (mobile checkout abandon).
 *  For multi-vendor groups, prefer `abandonUnpaidPayHereGroup` so every
 *  sub-order gets rolled back atomically. */
export async function abandonUnpaidPayHereOrder(
  orderId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.rpc("cancel_order", { p_order_id: orderId });
  if (error) return { ok: false, error: error.message };
  await releaseCartReservations();
  return { ok: true };
}

/**
 * Abandon an entire multi-vendor order group (PayHere failure / cancel).
 * Single RPC call: every sub-order's inventory is restored, payment row
 * is flipped to `cancelled`, status flips to `cancelled`.
 */
export async function abandonUnpaidPayHereGroup(
  groupId: string,
): Promise<{ ok: true; cancelled: number; noop: number } | { ok: false; error: string }> {
  const { data, error } = await supabase.rpc("abandon_unpaid_order_group", {
    p_group_id: groupId,
  });
  if (error) return { ok: false, error: error.message };
  const payload = (data ?? {}) as { cancelled?: number; noop?: number };
  await releaseCartReservations();
  return {
    ok: true,
    cancelled: Number(payload.cancelled ?? 0),
    noop: Number(payload.noop ?? 0),
  };
}

/**
 * Cancel one order in a multi-vendor checkout while leaving the rest intact.
 * Used when a per-store order fails to place and we need to roll back only
 * that store's order without touching the others.
 */
export async function cancelPlacedOrder(
  orderId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.rpc("cancel_order", { p_order_id: orderId });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Cancel an entire multi-vendor order group. Inventory restored across
 * every sub-order; payment refunded if any sub-order was paid.
 */
export async function cancelPlacedOrderGroup(
  groupId: string,
  reason?: string,
): Promise<{ ok: true; cancelled: number; refunded: number; noop: number } | { ok: false; error: string }> {
  const { data, error } = await supabase.rpc("cancel_order_group", {
    p_group_id: groupId,
    p_reason: reason ?? null,
  });
  if (error) return { ok: false, error: error.message };
  const payload = (data ?? {}) as { cancelled?: number; refunded?: number; noop?: number };
  return {
    ok: true,
    cancelled: Number(payload.cancelled ?? 0),
    refunded:  Number(payload.refunded  ?? 0),
    noop:      Number(payload.noop      ?? 0),
  };
}

/** Flush any pending reservation sync immediately (checkout). */
export async function flushCartReservationSync(
  userId: string | null,
  items: CartReservationItem[],
): Promise<CartReservationSyncResult> {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (!userId) return { ok: true, synced: 0 };
  return syncCartReservations(items);
}

/** Map cart lines to reservation rows (authenticated users only). */
export function cartItemsToReservations(
  items: Array<{
    variantId: string | null;
    productId?: string;
    storeId: string;
    quantity: number;
  }>,
  productsById?: Record<string, { variants?: Array<{ id: string; is_active?: boolean }> }>,
): CartReservationItem[] {
  return items
    .filter((i) => i.quantity > 0)
    .map((item) => {
      let variantId = item.variantId;
      if (!variantId && item.productId && productsById) {
        const variants = (productsById[item.productId]?.variants ?? []).filter(
          (v) => v.is_active !== false,
        );
        if (variants.length === 1) {
          variantId = variants[0].id;
        }
      }
      if (!variantId) return null;
      return {
        variant_id: variantId,
        store_id: item.storeId,
        quantity: item.quantity,
      };
    })
    .filter((row): row is CartReservationItem => row !== null);
}
