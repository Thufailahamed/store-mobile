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

/** Poll until the payment webhook marks the order paid (or terminal failure). */
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

export interface PaymentsLkSession {
  url: string;
  checkout_id?: string;
}

function extractPaymentsLkError(json: unknown): string {
  const err = (json as { error?: unknown }).error;
  return typeof err === "string"
    ? err
    : err && typeof err === "object" && err !== null && "message" in err
      ? String((err as { message?: unknown }).message)
      : "Payment session failed";
}

/** Fetch a Payments.lk hosted checkout URL for an authenticated order/group.
 *  `platform: "mobile"` makes the backend build app-scheme return URLs so the
 *  browser sheet can bounce back into the app via Linking.createURL. */
export async function getPaymentsLkSession(
  orderIdOrFirstSubOrder: string,
  opts: { groupId?: string } = {},
): Promise<{ ok: true; data: PaymentsLkSession } | { ok: false; error: string }> {
  if (!STORE_API_URL) {
    return { ok: false, error: "Card payments require EXPO_PUBLIC_STORE_API_URL" };
  }
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      return { ok: false, error: "Payment requires an authenticated session" };
    }
    const body: Record<string, string> = opts.groupId
      ? { group_id: opts.groupId, order_id: orderIdOrFirstSubOrder, platform: "mobile" }
      : { order_id: orderIdOrFirstSubOrder, platform: "mobile" };
    const res = await fetch(`${STORE_API_URL}/api/payments/paymentslk/checkout-session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) {
      return { ok: false, error: extractPaymentsLkError(json) };
    }
    const payload = (json && typeof json === "object" && "data" in json
      ? (json as { data: PaymentsLkSession }).data
      : json) as PaymentsLkSession;
    if (!payload?.url) {
      return { ok: false, error: "Payment session was missing the checkout URL" };
    }
    return { ok: true, data: { url: payload.url, checkout_id: payload.checkout_id } };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Network error" };
  }
}

/** Fetch a Stripe hosted Checkout URL for an authenticated order/group.
 *  Stripe's hosted page can't deep-link back into the app reliably, so
 *  the caller opens it in a browser sheet and polls order status after
 *  the buyer returns — the webhook is the source of truth. */
export async function getStripeCheckoutSession(
  orderIdOrFirstSubOrder: string,
  opts: { groupId?: string } = {},
): Promise<{ ok: true; data: { url: string; sessionId?: string } } | { ok: false; error: string }> {
  if (!STORE_API_URL) {
    return { ok: false, error: "Card payments require EXPO_PUBLIC_STORE_API_URL" };
  }
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      return { ok: false, error: "Payment requires an authenticated session" };
    }
    const body: Record<string, string> = opts.groupId
      ? { group_id: opts.groupId, order_id: orderIdOrFirstSubOrder }
      : { order_id: orderIdOrFirstSubOrder };
    const res = await fetch(`${STORE_API_URL}/api/payments/stripe/checkout-session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) {
      return { ok: false, error: extractPaymentsLkError(json) };
    }
    const payload = (json && typeof json === "object" && "data" in json
      ? (json as { data: { url?: string; sessionId?: string } }).data
      : json) as { url?: string; sessionId?: string };
    if (!payload?.url) {
      return { ok: false, error: "Payment session was missing the checkout URL" };
    }
    return { ok: true, data: { url: payload.url, sessionId: payload.sessionId } };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Network error" };
  }
}

export async function getGuestPaymentsLkSession(
  guestToken: string,
  guestEmail: string,
): Promise<{ ok: true; data: PaymentsLkSession } | { ok: false; error: string }> {
  if (!STORE_API_URL) {
    return { ok: false, error: "Card payments require EXPO_PUBLIC_STORE_API_URL" };
  }
  try {
    const res = await fetch(`${STORE_API_URL}/api/payments/paymentslk/guest-checkout-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guest_token: guestToken, guest_email: guestEmail, platform: "mobile" }),
    });
    const json = await res.json();
    if (!res.ok) {
      return { ok: false, error: extractPaymentsLkError(json) };
    }
    const payload = (json && typeof json === "object" && "data" in json
      ? (json as { data: PaymentsLkSession }).data
      : json) as PaymentsLkSession;
    if (!payload?.url) {
      return { ok: false, error: "Payment session was missing the checkout URL" };
    }
    return { ok: true, data: { url: payload.url, checkout_id: payload.checkout_id } };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Network error" };
  }
}

export async function getGiftCardPaymentsLkSession(input: {
  amount: number;
  currency?: string;
  recipient_email?: string;
  recipient_name?: string;
  message?: string;
  scheduled_for?: string;
}): Promise<{ ok: true; data: PaymentsLkSession & { pending_card_id?: string } } | { ok: false; error: string }> {
  if (!STORE_API_URL) {
    return { ok: false, error: "Card payments require EXPO_PUBLIC_STORE_API_URL" };
  }
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return { ok: false, error: "Payment requires an authenticated session" };
    const res = await fetch(`${STORE_API_URL}/api/payments/paymentslk/gift-card-session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ currency: "LKR", platform: "mobile", ...input }),
    });
    const json = await res.json();
    if (!res.ok) {
      return { ok: false, error: extractPaymentsLkError(json) };
    }
    const payload = (json && typeof json === "object" && "data" in json
      ? (json as { data: PaymentsLkSession & { pending_card_id?: string } }).data
      : json) as PaymentsLkSession & { pending_card_id?: string };
    if (!payload?.url) {
      return { ok: false, error: "Payment session was missing the checkout URL" };
    }
    return { ok: true, data: payload };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Network error" };
  }
}
