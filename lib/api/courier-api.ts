/**
 * Mobile wrappers for the courier (Phase 0162) backend endpoints. Mirrors
 * `store/src/app/api/courier/*` proxies — the mobile app talks to the
 * Hono backend through the EXPO_PUBLIC_STORE_API_URL root.
 */

import { fetchJson, type ApiResult, hasStoreApi } from "./_fetch";

export interface CourierProvider {
  id: string;
  name: string;
  code: string;
  base_url: string;
  auth_type: string;
  active: boolean;
  created_at: string;
  updated_at: string;
  last_webhook: { at: string; ok: boolean; type: string | null } | null;
}

export interface CourierShipment {
  id: string;
  order_id: string;
  provider_id: string;
  provider_name: string;
  provider_code: string;
  status:
    | "created"
    | "pickup_scheduled"
    | "rider_assigned"
    | "picked_up"
    | "in_transit"
    | "out_for_delivery"
    | "delivered"
    | "failed_delivery"
    | "returned_to_origin"
    | "cancelled";
  external_tracking_id: string | null;
  external_tracking_url: string | null;
  last_event_at: string | null;
  dispatched_at: string | null;
  cancelled_at: string | null;
}

export interface CourierWebhookEvent {
  id: number;
  provider_id: string;
  provider_event_id: string;
  event_type: string | null;
  signature_ok: boolean;
  processed_at: string | null;
  error: string | null;
  received_at: string;
}

// =========================================================================
// Admin: provider CRUD
// =========================================================================

export async function listCourierProviders(): Promise<ApiResult<{ providers: CourierProvider[] }>> {
  if (!hasStoreApi()) return { ok: false, error: "Store API not configured" };
  return fetchJson<{ providers: CourierProvider[] }>("/api/admin/courier/providers", {
    requireAuth: true,
    
  });
}

export async function getCourierProvider(id: string): Promise<ApiResult<CourierProvider & { env_vars: Record<string, string> }>> {
  if (!hasStoreApi()) return { ok: false, error: "Store API not configured" };
  return fetchJson(`/api/admin/courier/providers/${id}`, {
    requireAuth: true,
    
  });
}

export async function testCourierProvider(id: string): Promise<ApiResult<{ ok: boolean; reachable?: boolean; error?: string }>> {
  if (!hasStoreApi()) return { ok: false, error: "Store API not configured" };
  return fetchJson(`/api/courier/health`, {
    method: "POST",
    body: { provider_id: id },
    requireAuth: true,
    
  });
}

// =========================================================================
// Admin: webhook log + replay
// =========================================================================

export async function listCourierWebhooks(providerId?: string): Promise<ApiResult<{ events: CourierWebhookEvent[] }>> {
  if (!hasStoreApi()) return { ok: false, error: "Store API not configured" };
  const q = providerId ? `?provider_id=${encodeURIComponent(providerId)}` : "";
  return fetchJson(`/api/admin/courier/webhooks${q}`, {
    requireAuth: true,
    
  });
}

export async function replayCourierWebhook(eventId: number, force = false): Promise<ApiResult<{ replayed: boolean; mapped?: string; reason?: string }>> {
  if (!hasStoreApi()) return { ok: false, error: "Store API not configured" };
  return fetchJson(`/api/admin/courier/webhooks/${eventId}/replay`, {
    method: "POST",
    body: { force },
    requireAuth: true,
    
  });
}

// =========================================================================
// Authed reads: shipment by order
// =========================================================================

export async function getShipmentByOrder(orderId: string): Promise<ApiResult<{ shipment: CourierShipment | null }>> {
  if (!hasStoreApi()) return { ok: false, error: "Store API not configured" };
  return fetchJson(`/api/courier/shipments/by-order/${orderId}`, {
    requireAuth: true,
  });
}