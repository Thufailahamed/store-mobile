import { supabase } from "@/lib/supabase/client";

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
    const body: Record<string, string> = opts.groupId
      ? { group_id: opts.groupId, order_id: orderIdOrFirstSubOrder }
      : { order_id: orderIdOrFirstSubOrder };
    const res = await fetch(`${STORE_API_URL}/api/payhere/checkout-session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) return { ok: false, error: json.error ?? "Payment session failed" };
    return { ok: true, data: { action: json.action, fields: json.fields } };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Network error" };
  }
}
