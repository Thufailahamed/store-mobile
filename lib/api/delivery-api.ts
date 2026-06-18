import { supabase } from "@/lib/supabase/client";

const STORE_API_URL = (process.env.EXPO_PUBLIC_STORE_API_URL ?? "").replace(/\/$/, "");

export type DeliveryApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function storeApiFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<DeliveryApiResult<T>> {
  if (!STORE_API_URL) {
    return { ok: false, error: "EXPO_PUBLIC_STORE_API_URL is not configured" };
  }
  try {
    const token = await getAccessToken();
    if (!token) return { ok: false, error: "Not signed in" };

    const res = await fetch(`${STORE_API_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(init.headers ?? {}),
      },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: (json as { error?: string }).error ?? `Request failed (${res.status})` };
    }
    return { ok: true, data: json as T };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Network error" };
  }
}

export function extractPackageToken(raw: string): string {
  const trimmed = raw.trim();
  try {
    const url = new URL(trimmed);
    const fromQuery = url.searchParams.get("token");
    if (fromQuery) return fromQuery;
  } catch {
    /* not a URL */
  }
  return trimmed;
}

export type PackageScanAction =
  | "pack"
  | "pickup"
  | "pickup:direct"
  | "pickup:transit_to_warehouse"
  | "receive"
  | "dispatch"
  | "start_delivery"
  | "verify_otp"
  | "verify_customer_qr"
  | "fail_delivery"
  | "cancel"
  | "regenerate";

export interface PackageMeta {
  order_id: string;
  order_number: string;
  package_id: string;
  package_status: string;
  order_status: string;
  next_actions_for_role: PackageScanAction[];
  next_action_options?: { action: string; decision: string | null }[];
  buyer?: { name: string | null; phone_last4: string | null } | null;
  address?: Record<string, string> | null;
  expires_at: string;
}

export interface ReturnPickup {
  id: string;
  return_group_id: string;
  order_id: string;
  user_id: string;
  delivery_person_id: string | null;
  pickup_otp: string | null;
  status: string;
  pickup_address: Record<string, string> | null;
  scheduled_at: string | null;
  picked_up_at: string | null;
  completed_at: string | null;
  failed_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export async function deliveryTransition(
  orderId: string,
  status: "out_for_delivery" | "returned" | "cancelled",
  reason?: string,
): Promise<DeliveryApiResult<{ ok: boolean; status: string }>> {
  return storeApiFetch("/api/delivery/transition", {
    method: "POST",
    body: JSON.stringify({ order_id: orderId, status, reason }),
  });
}

export async function deliveryVerify(
  orderId: string,
  otp: string,
): Promise<DeliveryApiResult<{ ok: boolean; status: string }>> {
  return storeApiFetch("/api/delivery/verify", {
    method: "POST",
    body: JSON.stringify({ order_id: orderId, otp }),
  });
}

export async function deliveryPickupVerify(
  pickupId: string,
  action: "start" | "verify" | "fail" | "complete",
  opts?: { otp?: string; reason?: string; photo_url?: string; notes?: string },
): Promise<DeliveryApiResult<{ ok: boolean; status: string }>> {
  return storeApiFetch("/api/delivery/pickup-verify", {
    method: "POST",
    body: JSON.stringify({
      pickup_id: pickupId,
      action,
      otp: opts?.otp,
      reason: opts?.reason,
      photo_url: opts?.photo_url,
      notes: opts?.notes,
    }),
  });
}

export async function deliveryProofUpload(
  orderId: string,
  photoUrl: string,
  notes?: string,
): Promise<DeliveryApiResult<{ ok: boolean; proof_id: string }>> {
  return storeApiFetch("/api/delivery/proof", {
    method: "POST",
    body: JSON.stringify({ order_id: orderId, photo_url: photoUrl, notes }),
  });
}

export async function getReturnPickups(
  status?: string,
): Promise<DeliveryApiResult<{ pickups: ReturnPickup[] }>> {
  const q = status ? `?status=${encodeURIComponent(status)}` : "";
  return storeApiFetch(`/api/returns/pickups${q}`);
}

export async function getOrderPackage(
  orderId: string,
): Promise<DeliveryApiResult<{ signed_token: string; package: { short_code: string; status: string } }>> {
  return storeApiFetch(`/api/orders/${orderId}/package`);
}

export async function resolvePackageQr(
  token: string,
): Promise<DeliveryApiResult<PackageMeta>> {
  return storeApiFetch(`/api/packages/qr/${encodeURIComponent(token)}`);
}

export async function scanPackage(
  token: string,
  action: PackageScanAction,
  opts?: { pickup_decision?: "direct" | "transit_to_warehouse"; notes?: string; location_text?: string },
): Promise<DeliveryApiResult<unknown>> {
  return storeApiFetch("/api/packages/scan", {
    method: "POST",
    body: JSON.stringify({
      token,
      action,
      pickup_decision: opts?.pickup_decision,
      notes: opts?.notes,
      location_text: opts?.location_text,
    }),
  });
}

export async function verifyPackageDelivery(
  token: string,
  opts: { otp?: string; customer_qr_token?: string },
): Promise<DeliveryApiResult<unknown>> {
  return storeApiFetch("/api/packages/verify-delivery", {
    method: "POST",
    body: JSON.stringify({ token, otp: opts.otp, customer_qr_token: opts.customer_qr_token }),
  });
}

export interface DeliveryPipelineZone {
  id: string;
  company_id: string | null;
  name: string;
  city: string;
  area?: string | null;
  cluster?: string | null;
  postal_codes: string[];
  is_active: boolean;
  hub?: { id: string; name: string } | null;
}

export async function getDeliveryPipelineZones(opts?: {
  company_id?: string;
  include_inactive?: boolean;
}): Promise<DeliveryApiResult<{ zones: DeliveryPipelineZone[] }>> {
  const params = new URLSearchParams();
  if (opts?.company_id) params.set("company_id", opts.company_id);
  if (opts?.include_inactive) params.set("include_inactive", "true");
  const q = params.toString();
  return storeApiFetch(`/api/delivery-pipeline/zones${q ? `?${q}` : ""}`);
}

export function hasStoreApi(): boolean {
  return Boolean(STORE_API_URL);
}
