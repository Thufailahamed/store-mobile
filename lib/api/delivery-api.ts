import { supabase } from "@/lib/supabase/client";
import type { IssueReason } from "@/lib/utils/delivery-format";

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
  /* ---- Phase 14 — failure-recovery fields --------------------------- *
   * Optional. Server may not yet return these; UI reads with `??`       *
   * defaults (0 / null) and degrades gracefully.                       */
  attempt_count?: number | null;
  failure_reason?: IssueReason | null;
  failure_evidence_url?: string | null;
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

/**
 * Optional fields that travel alongside `reason` on deliveryTransition /
 * scanPackage / deliveryPickupVerify. All server-side optional; the mobile
 * UI sends them when the rider has supplied categorical reason, free-text
 * notes, failure-evidence URL, attempt count, or a proposed retry time.
 */
export interface DeliveryFailureOpts {
  failure_reason?: IssueReason;
  failure_notes?: string;
  failure_evidence_url?: string | null;
  attempt_count?: number;
  next_retry_at?: string | null;
}

export async function deliveryTransition(
  orderId: string,
  status: "out_for_delivery" | "returned" | "cancelled",
  reason?: string,
  opts?: DeliveryFailureOpts,
): Promise<DeliveryApiResult<{ ok: boolean; status: string }>> {
  const newBody = JSON.stringify({
    order_id: orderId,
    status,
    reason,
    failure_reason: opts?.failure_reason,
    failure_notes: opts?.failure_notes,
    failure_evidence_url: opts?.failure_evidence_url ?? null,
    attempt_count: opts?.attempt_count,
    next_retry_at: opts?.next_retry_at ?? null,
  });
  const res = await storeApiFetch<{ ok: boolean; status: string }>(
    "/api/delivery/transition",
    {
      method: "POST",
      body: newBody,
    },
  );
  if (res.ok || !hasFailureFields(opts)) return res;
  // Server rejected unknown fields. Retry with legacy 3-field body so older
  // store-api deployments still work. The categorical reason and evidence
  // are dropped here — a separate admin-side reconciliation will catch up.
  if (!looksLikeUnknownFieldRejection(res.error)) return res;
  // eslint-disable-next-line no-console
  console.warn(
    "[deliveryTransition] server rejected failure_* fields; retrying with legacy body",
    res.error,
  );
  return storeApiFetch<{ ok: boolean; status: string }>(
    "/api/delivery/transition",
    {
      method: "POST",
      body: JSON.stringify({ order_id: orderId, status, reason }),
    },
  );
}

function hasFailureFields(opts?: DeliveryFailureOpts): boolean {
  if (!opts) return false;
  return (
    opts.failure_reason !== undefined ||
    opts.failure_notes !== undefined ||
    opts.failure_evidence_url !== undefined ||
    opts.attempt_count !== undefined ||
    opts.next_retry_at !== undefined
  );
}

function looksLikeUnknownFieldRejection(err: string): boolean {
  const e = err.toLowerCase();
  return (
    e.includes("unknown") ||
    e.includes("unexpected") ||
    e.includes("invalid field") ||
    e.includes("not allowed") ||
    e.includes("extra") ||
    e.includes("unrecognized")
  );
}

export async function deliveryVerify(
  orderId: string,
  otp: string,
  opts?: { proof_url?: string | null; signature_url?: string | null; notes?: string | null },
): Promise<DeliveryApiResult<{ ok: boolean; status: string }>> {
  return storeApiFetch("/api/delivery/verify", {
    method: "POST",
    body: JSON.stringify({
      order_id: orderId,
      otp,
      proof_url: opts?.proof_url ?? null,
      signature_url: opts?.signature_url ?? null,
      notes: opts?.notes ?? null,
    }),
  });
}

export async function deliveryPickupVerify(
  pickupId: string,
  action: "start" | "verify" | "fail" | "complete",
  opts?: {
    otp?: string;
    reason?: string;
    photo_url?: string;
    notes?: string;
    failure_reason?: IssueReason;
    failure_evidence_url?: string | null;
  },
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
      failure_reason: opts?.failure_reason,
      failure_evidence_url: opts?.failure_evidence_url ?? null,
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
  opts?: {
    pickup_decision?: "direct" | "transit_to_warehouse";
    notes?: string;
    location_text?: string;
    failure_reason?: IssueReason;
    failure_notes?: string;
    failure_evidence_url?: string | null;
  },
): Promise<DeliveryApiResult<unknown>> {
  // Only include failure_* keys for the fail_delivery action — older servers
  // may reject unknown fields. Building the body conditionally lets
  // JSON.stringify drop the keys entirely for other actions.
  const body: Record<string, unknown> = {
    token,
    action,
    pickup_decision: opts?.pickup_decision,
    notes: opts?.notes,
    location_text: opts?.location_text,
  };
  if (action === "fail_delivery") {
    body.failure_reason = opts?.failure_reason;
    body.failure_notes = opts?.failure_notes;
    body.failure_evidence_url = opts?.failure_evidence_url ?? null;
  }
  return storeApiFetch("/api/packages/scan", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function verifyPackageDelivery(
  token: string,
  opts: {
    otp?: string;
    customer_qr_token?: string;
    proof_url?: string | null;
    signature_url?: string | null;
    notes?: string | null;
  },
): Promise<DeliveryApiResult<unknown>> {
  return storeApiFetch("/api/packages/verify-delivery", {
    method: "POST",
    body: JSON.stringify({
      token,
      otp: opts.otp,
      customer_qr_token: opts.customer_qr_token,
      proof_url: opts.proof_url ?? null,
      signature_url: opts.signature_url ?? null,
      notes: opts.notes ?? null,
    }),
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

/* ------------------------------------------------------------------ */
/*  Phase 14 — Rider handoff / reassignment (mobile-side feature flag) */
/* ------------------------------------------------------------------ */

/**
 * Probe that caches the result of an initial OPTIONS request to
 * /api/delivery/reassign. If the server doesn't expose the route (404),
 * `isReassignAvailable()` returns false and the rider UI hides the
 * "Reassign" button per the locked Phase 14 decision. Subsequent calls
 * don't re-probe. 405 (Method Not Allowed) is treated as "route exists".
 */
let reassignProbeCache: boolean | null = null;
let reassignProbeInFlight: Promise<boolean> | null = null;

async function probeReassignSupport(): Promise<boolean> {
  if (reassignProbeCache !== null) return reassignProbeCache;
  if (reassignProbeInFlight) return reassignProbeInFlight;
  reassignProbeInFlight = (async () => {
    if (!STORE_API_URL) {
      reassignProbeCache = false;
      return false;
    }
    try {
      const token = await getAccessToken();
      if (!token) {
        reassignProbeCache = false;
        return false;
      }
      const res = await fetch(`${STORE_API_URL}/api/delivery/reassign`, {
        method: "OPTIONS",
        headers: { Authorization: `Bearer ${token}` },
      });
      // 2xx or 405 (Method Not Allowed but route exists) → supported.
      // 404 → not supported. Other → assume not supported (fail closed).
      reassignProbeCache = res.status !== 404 && res.status < 500;
      return reassignProbeCache;
    } catch {
      reassignProbeCache = false;
      return false;
    } finally {
      reassignProbeInFlight = null;
    }
  })();
  return reassignProbeInFlight;
}

export async function isReassignAvailable(): Promise<boolean> {
  return probeReassignSupport();
}

/** Test-only reset hook. */
export function __resetReassignProbeForTests(): void {
  reassignProbeCache = null;
  reassignProbeInFlight = null;
}

/**
 * Hand off a package to another rider. Returns `{ ok: false, error: "reassign-not-supported" }`
 * if the server's /api/delivery/reassign route is not reachable. Callers
 * (UI) should gate visibility on `isReassignAvailable()` so the button is
 * hidden entirely in unsupported deployments.
 */
export async function reassignDelivery(
  orderId: string,
  toRiderId: string,
): Promise<DeliveryApiResult<{ ok: boolean; status: string }>> {
  const supported = await isReassignAvailable();
  if (!supported) {
    return { ok: false, error: "reassign-not-supported" };
  }
  return storeApiFetch("/api/delivery/reassign", {
    method: "POST",
    body: JSON.stringify({ order_id: orderId, to_rider_id: toRiderId }),
  });
}
