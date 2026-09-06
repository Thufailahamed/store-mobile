/**
 * Payments — session creation + status polling.
 *
 * Status polling: prefer the new backend endpoint
 *   GET /api/payments/orders/:id/status
 * which reads from the cross-provider status view in Postgres. Falls
 * back to the legacy direct-Supabase poll if the backend doesn't
 * expose that endpoint yet (older deployments).
 */

import { supabase } from "@/lib/supabase/client";
import { fetchJson, type ApiResult } from "@/lib/api/backend";
import { hasStoreApi } from "@/lib/api/delivery-api";
import type { PaymentStatus } from "@/lib/api/backend";

const STORE_API_URL = process.env.EXPO_PUBLIC_STORE_API_URL ?? "";

export type PaymentPollResult =
  | { ok: true; paymentStatus: "paid" }
  | { ok: false; error: string; paymentStatus?: string };

/** Poll until PayHere webhook marks the order paid (or terminal failure). */
export async function pollOrderPaymentStatus(
  orderId: string,
  opts: { intervalMs?: number; maxAttempts?: number } = {},
): Promise<PaymentPollResult> {
  const intervalMs = opts.intervalMs ?? 3000;
  const maxAttempts = opts.maxAttempts ?? 40;

  // Backend path — preferred.
  if (hasStoreApi()) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const res: ApiResult<PaymentStatus> = await fetchJson(
        `/api/payments/orders/${orderId}/status`,
        { timeoutMs: 10_000 },
      );
      if (res.ok) {
        if (res.data.payment_status === "paid") {
          return { ok: true, paymentStatus: "paid" };
        }
        if (res.data.status === "cancelled") {
          return {
            ok: false,
            error: "Order was cancelled",
            paymentStatus: res.data.payment_status ?? undefined,
          };
        }
      } else if (!res.error.toLowerCase().includes("not found")) {
        // Transient — keep polling.
      } else {
        // 404 → backend route missing, fall back to direct Supabase.
        return pollOrderPaymentStatusFallback(orderId, intervalMs, maxAttempts);
      }

      if (attempt < maxAttempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
    }
    return {
      ok: false,
      error: "Payment confirmation timed out. Check your orders for status.",
    };
  }

  return pollOrderPaymentStatusFallback(orderId, intervalMs, maxAttempts);
}

async function pollOrderPaymentStatusFallback(
  orderId: string,
  intervalMs: number,
  maxAttempts: number,
): Promise<PaymentPollResult> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const { data, error } = await supabase
      .from("orders")
      .select("payment_status, status")
      .eq("id", orderId)
      .maybeSingle();

    if (error) return { ok: false, error: error.message };
    if (data?.payment_status === "paid") {
      return { ok: true, paymentStatus: "paid" };
    }
    if (data?.status === "cancelled") {
      return {
        ok: false,
        error: "Order was cancelled",
        paymentStatus: data.payment_status ?? undefined,
      };
    }
    if (attempt < maxAttempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
  return {
    ok: false,
    error: "Payment confirmation timed out. Check your orders for status.",
  };
}

export interface PayHereSession {
  action: string;
  fields: Record<string, string>;
}

/** Fetch PayHere checkout session from the web store API (requires deployed store + env).
 *  Pass `groupId` to charge across multiple sub-orders atomically; otherwise
 *  falls back to the legacy single-order path.
 */
export async function getPayHereSession(
  orderIdOrFirstSubOrder: string,
  opts: { groupId?: string } = {},
): Promise<
  { ok: true; data: PayHereSession } | { ok: false; error: string }
> {
  if (!STORE_API_URL) {
    return { ok: false, error: "Card payments require EXPO_PUBLIC_STORE_API_URL" };
  }
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    // L-04 AUDIT: Fail closed — payment session requires an authenticated session.
    if (!token) {
      return { ok: false, error: "Payment requires an authenticated session" };
    }
    const body: Record<string, string> = opts.groupId
      ? { group_id: opts.groupId, order_id: orderIdOrFirstSubOrder }
      : { order_id: orderIdOrFirstSubOrder };
    const res = await fetch(`${STORE_API_URL}/api/payhere/checkout-session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) {
      const err = (json as { error?: unknown }).error;
      const message =
        typeof err === "string"
          ? err
          : err && typeof err === "object" && err !== null && "message" in err
            ? String((err as { message?: unknown }).message)
            : "Payment session failed";
      return { ok: false, error: message };
    }
    const payload = (json && typeof json === "object" && "data" in json
      ? (json as { data: PayHereSession }).data
      : json) as PayHereSession;
    if (!payload?.action || !payload?.fields) {
      return { ok: false, error: "Payment session was missing checkout fields" };
    }
    return { ok: true, data: { action: payload.action, fields: payload.fields } };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Network error" };
  }
}

export async function getGiftCardPayHereSession(input: {
  amount: number;
  currency?: string;
  recipient_email?: string;
  recipient_name?: string;
  message?: string;
  scheduled_for?: string;
}): Promise<{ ok: true; data: PayHereSession & { pending_card_id?: string } } | { ok: false; error: string }> {
  if (!STORE_API_URL) {
    return { ok: false, error: "Card payments require EXPO_PUBLIC_STORE_API_URL" };
  }
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return { ok: false, error: "Payment requires an authenticated session" };
    const res = await fetch(`${STORE_API_URL}/api/payhere/gift-card-session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ currency: "LKR", ...input }),
    });
    const json = await res.json();
    if (!res.ok) {
      const err = (json as { error?: unknown }).error;
      const message =
        typeof err === "string"
          ? err
          : err && typeof err === "object" && err !== null && "message" in err
            ? String((err as { message?: unknown }).message)
            : "Payment session failed";
      return { ok: false, error: message };
    }
    const payload = (json && typeof json === "object" && "data" in json
      ? (json as { data: PayHereSession & { pending_card_id?: string } }).data
      : json) as PayHereSession & { pending_card_id?: string };
    if (!payload?.action || !payload?.fields) {
      return { ok: false, error: "Payment session was missing checkout fields" };
    }
    return { ok: true, data: payload };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Network error" };
  }
}

export async function getGuestPayHereSession(
  guestToken: string,
  guestEmail: string,
): Promise<{ ok: true; data: PayHereSession } | { ok: false; error: string }> {
  if (!STORE_API_URL) {
    return { ok: false, error: "Card payments require EXPO_PUBLIC_STORE_API_URL" };
  }
  try {
    const res = await fetch(`${STORE_API_URL}/api/payhere/guest-checkout-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guest_token: guestToken, guest_email: guestEmail }),
    });
    const json = await res.json();
    if (!res.ok) {
      const err = (json as { error?: unknown }).error;
      const message =
        typeof err === "string"
          ? err
          : err && typeof err === "object" && err !== null && "message" in err
            ? String((err as { message?: unknown }).message)
            : "Payment session failed";
      return { ok: false, error: message };
    }
    const payload = (json && typeof json === "object" && "data" in json
      ? (json as { data: PayHereSession }).data
      : json) as PayHereSession;
    if (!payload?.action || !payload?.fields) {
      return { ok: false, error: "Payment session was missing checkout fields" };
    }
    return { ok: true, data: { action: payload.action, fields: payload.fields } };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Network error" };
  }
}
