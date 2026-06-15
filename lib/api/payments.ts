import { supabase } from "@/lib/supabase/client";

const STORE_API_URL = process.env.EXPO_PUBLIC_STORE_API_URL ?? "";

export interface PayHereSession {
  action: string;
  fields: Record<string, string>;
}

/** Fetch PayHere checkout session from the web store API (requires deployed store + env). */
export async function getPayHereSession(orderId: string): Promise<
  { ok: true; data: PayHereSession } | { ok: false; error: string }
> {
  if (!STORE_API_URL) {
    return { ok: false, error: "Card payments require EXPO_PUBLIC_STORE_API_URL" };
  }
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    const res = await fetch(`${STORE_API_URL}/api/payhere/checkout-session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ order_id: orderId }),
    });
    const json = await res.json();
    if (!res.ok) return { ok: false, error: json.error ?? "Payment session failed" };
    return { ok: true, data: { action: json.action, fields: json.fields } };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Network error" };
  }
}
