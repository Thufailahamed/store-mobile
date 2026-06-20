import { storeApiFetch } from "@/lib/api/delivery-api";
import {
  assertDeliveryCompanyOperations,
  assertDeliveryCompanySetup,
} from "@/lib/delivery-company-api-guard";
import type { DeliveryCompanyAccessState } from "@/lib/delivery-company-access";
import type { AssignmentOrderRow } from "@/lib/delivery-assignment-queues";

export type DcApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export interface DeliveryCompany {
  id: string;
  name: string;
  slug: string;
  status: string;
  description?: string | null;
  default_assignment_policy?: string;
  auto_assign_last_mile_on_receive?: boolean;
  serviceable_postal_codes?: string[];
  contact_phone?: string | null;
  contact_email?: string | null;
}

export interface DcReturnPickup {
  id: string;
  status: string;
  scheduled_at?: string | null;
  completed_at?: string | null;
  pickup_address?: Record<string, string> | null;
  order?: {
    id: string;
    order_number: string;
    total: number;
    currency: string;
  } | null;
  delivery_person?: {
    id: string;
    full_name?: string | null;
    phone?: string | null;
  } | null;
}

export interface DcAuditEntry {
  id: string;
  action: string;
  target_type?: string | null;
  target_id?: string | null;
  created_at: string;
  diff?: Record<string, unknown> | null;
  actor?: { id: string; full_name?: string | null } | null;
}

export type AssignmentPolicy = "zone" | "round_robin" | "distance" | "auto" | "auto_pickup" | "auto_last_mile";

export interface DcMembership {
  id: string | null;
  isAdmin: boolean;
  role: "owner" | "manager" | "driver" | null;
}

export interface DcDriverMember {
  id: string;
  user_id: string;
  company_role: string;
  driver_type?: string | null;
  is_active: boolean;
  capacity_max?: number;
  active_load?: number;
  serviceable_postal_codes?: string[];
  user?: {
    id: string;
    full_name?: string | null;
    email?: string | null;
    phone?: string | null;
    avatar_url?: string | null;
  } | null;
  home_warehouse?: { id: string; name: string } | null;
}

export interface DcWarehouse {
  id: string;
  name: string;
  company_id: string;
  address?: Record<string, string> | null;
  latitude?: number | null;
  longitude?: number | null;
  capacity_max?: number;
  is_active?: boolean;
  inventory_count?: number;
  pickup_driver_count?: number;
  geocoded?: boolean;
  routing_ready?: boolean;
  capacity_status?: "ok" | "near_full" | "full";
  routing_warnings?: string[];
}

export interface DcPackageInventory {
  id: string;
  warehouse_id: string;
  order_id: string;
  status: string;
  received_at?: string | null;
  warehouse?: { id: string; name: string } | null;
  order?: {
    id: string;
    order_number: string;
    status: string;
    total: number;
    currency: string;
    shipping_address?: Record<string, string> | null;
    pickup_driver_id?: string | null;
    pickup_decision?: string | null;
    delivery_person_id?: string | null;
  } | null;
}

export interface DcTrends {
  delivered: number[];
  failed: number[];
  in_transit: number[];
  in_hubs: number[];
  active_drivers: number[];
  days: number;
}

export interface DcRouteStop {
  id: string;
  route_id: string;
  sequence: number;
  order_id: string;
  status: string;
  address_snapshot?: Record<string, string> | null;
  arrived_at?: string | null;
  completed_at?: string | null;
  order?: {
    id: string;
    order_number: string;
    status: string;
    total: number;
    currency: string;
    shipping_address?: Record<string, string> | null;
  } | null;
}

export interface DcRoute {
  id: string;
  company_id: string;
  driver_id: string;
  warehouse_id?: string | null;
  status: string;
  route_kind?: string | null;
  total_stops?: number;
  created_at: string;
  driver?: {
    id: string;
    full_name?: string | null;
    avatar_url?: string | null;
    phone?: string | null;
  } | null;
  warehouse?: { id: string; name: string } | null;
  stops?: DcRouteStop[];
}

export interface DcAssignCandidate {
  member_id: string;
  user_id: string;
  full_name: string;
  avatar_url?: string | null;
  vehicle_type?: string | null;
  driver_type?: string;
  home_warehouse_id?: string | null;
  home_warehouse_name?: string | null;
  active_load: number;
  capacity_max: number;
  remaining_capacity: number;
  score: number;
  reason?: string;
  eligible: boolean;
  leg_eligible?: boolean;
  distance_meters?: number | null;
  duration_seconds?: number | null;
}

export interface DcRoutingContext {
  leg: string;
  warehouse: {
    id: string;
    name: string | null;
    latitude: number | null;
    longitude: number | null;
    geocoded: boolean;
  } | null;
  warehouse_resolution: string;
  scoring_method: string;
}

export interface DcDriverInvite {
  id: string;
  email: string;
  company_role: string;
  driver_type?: string | null;
  expires_at: string;
  created_at: string;
}

export async function getDeliveryCompanyMe(): Promise<
  DcApiResult<{
    company: DeliveryCompany;
    membership: DcMembership;
    access?: DeliveryCompanyAccessState & { reason?: string | null };
  }>
> {
  return storeApiFetch("/api/delivery-company/me");
}

export async function getDeliveryCompanyTrends(): Promise<DcApiResult<DcTrends>> {
  return storeApiFetch("/api/delivery-company/trends");
}

export async function getDeliveryCompanyPackages(opts?: {
  status?: string;
  warehouse_id?: string;
  search?: string;
}): Promise<DcApiResult<{ inventory: DcPackageInventory[]; route_stops: unknown[]; pickup_pending?: AssignmentOrderRow[] }>> {
  const params = new URLSearchParams();
  if (opts?.status) params.set("status", opts.status);
  if (opts?.warehouse_id) params.set("warehouse_id", opts.warehouse_id);
  if (opts?.search) params.set("search", opts.search);
  const q = params.toString();
  return storeApiFetch(`/api/delivery-company/packages${q ? `?${q}` : ""}`);
}

export async function getDeliveryCompanyDrivers(opts?: {
  search?: string;
  active?: boolean;
  role?: string;
}): Promise<DcApiResult<{ members: DcDriverMember[]; invites: unknown[] }>> {
  const params = new URLSearchParams();
  if (opts?.search) params.set("search", opts.search);
  if (opts?.active === true) params.set("active", "true");
  if (opts?.active === false) params.set("active", "false");
  if (opts?.role) params.set("role", opts.role);
  const q = params.toString();
  return storeApiFetch(`/api/delivery-company/drivers${q ? `?${q}` : ""}`);
}

export async function getDeliveryCompanyWarehouses(): Promise<
  DcApiResult<{ warehouses: DcWarehouse[] }>
> {
  return storeApiFetch("/api/delivery-company/warehouses");
}

export async function getDeliveryCompanyWarehouse(
  warehouseId: string,
): Promise<DcApiResult<{ warehouse: DcWarehouse }>> {
  return storeApiFetch(`/api/delivery-company/warehouses/${warehouseId}`);
}

export async function lookupDeliveryCompanyOrder(
  ref: string,
): Promise<DcApiResult<{ order_id: string; order_number: string; status: string }>> {
  const guard = await assertDeliveryCompanyOperations();
  if (!guard.ok) return guard;
  const params = new URLSearchParams({ ref: ref.trim() });
  return storeApiFetch(`/api/delivery-company/orders/lookup?${params}`);
}

export async function autoAssignOrders(
  orderIds: string[],
  leg: "pickup" | "last_mile" | "delivery" = "pickup",
  policy?: string,
): Promise<
  DcApiResult<{
    assignments?: unknown[];
    skipped?: { order_id: string; reason: string }[];
    scoring?: { method: string; leg: string };
  }>
> {
  const guard = await assertDeliveryCompanyOperations();
  if (!guard.ok) return guard;
  return storeApiFetch("/api/delivery-company/assignments/auto", {
    method: "POST",
    body: JSON.stringify({
      order_ids: orderIds,
      leg,
      ...(policy ? { policy } : {}),
    }),
  });
}

export async function receiveAtWarehouse(
  warehouseId: string,
  orderId: string,
): Promise<DcApiResult<{ last_mile_error?: string | null; last_mile_assignment?: unknown }>> {
  const guard = await assertDeliveryCompanyOperations();
  if (!guard.ok) return guard;
  return storeApiFetch(`/api/delivery-company/warehouses/${warehouseId}/receive`, {
    method: "POST",
    body: JSON.stringify({ order_id: orderId }),
  });
}

export async function assignLastMileBatch(
  orderIds: string[],
  warehouseId?: string,
): Promise<DcApiResult<unknown>> {
  const guard = await assertDeliveryCompanyOperations();
  if (!guard.ok) return guard;
  return storeApiFetch("/api/delivery-company/assignments/last-mile", {
    method: "POST",
    body: JSON.stringify({
      order_ids: orderIds,
      ...(warehouseId ? { warehouse_id: warehouseId } : {}),
    }),
  });
}

export async function getDeliveryCompanyRoutes(opts?: {
  status?: string;
  driver_id?: string;
}): Promise<DcApiResult<{ routes: DcRoute[] }>> {
  const params = new URLSearchParams();
  if (opts?.status) params.set("status", opts.status);
  if (opts?.driver_id) params.set("driver_id", opts.driver_id);
  const q = params.toString();
  return storeApiFetch(`/api/delivery-company/routes${q ? `?${q}` : ""}`);
}

export async function getDeliveryCompanyRoute(
  routeId: string,
): Promise<DcApiResult<{ route: DcRoute }>> {
  return storeApiFetch(`/api/delivery-company/routes/${routeId}`);
}

export async function dispatchRoute(routeId: string): Promise<DcApiResult<unknown>> {
  const guard = await assertDeliveryCompanyOperations();
  if (!guard.ok) return guard;
  return storeApiFetch(`/api/delivery-company/routes/${routeId}/dispatch`, { method: "POST" });
}

export async function cancelRoute(routeId: string, reason?: string): Promise<DcApiResult<unknown>> {
  const guard = await assertDeliveryCompanyOperations();
  if (!guard.ok) return guard;
  return storeApiFetch(`/api/delivery-company/routes/${routeId}/cancel`, {
    method: "POST",
    body: JSON.stringify(reason ? { reason } : {}),
  });
}

export async function getAssignmentCandidates(
  orderId: string,
  leg?: "pickup" | "last_mile" | "delivery",
): Promise<DcApiResult<{ candidates: DcAssignCandidate[]; leg: string; routing_context?: DcRoutingContext }>> {
  const params = new URLSearchParams({ order_id: orderId });
  if (leg) params.set("leg", leg);
  return storeApiFetch(`/api/delivery-company/assignments/candidates?${params}`);
}

export async function manualAssignOrder(
  orderId: string,
  driverId: string,
  opts?: { leg?: "pickup" | "last_mile" | "delivery"; warehouse_id?: string },
): Promise<DcApiResult<unknown>> {
  const guard = await assertDeliveryCompanyOperations();
  if (!guard.ok) return guard;
  return storeApiFetch("/api/delivery-company/assignments/manual", {
    method: "POST",
    body: JSON.stringify({
      order_id: orderId,
      driver_id: driverId,
      leg: opts?.leg ?? "last_mile",
      ...(opts?.warehouse_id ? { warehouse_id: opts.warehouse_id } : {}),
    }),
  });
}

export async function inviteDriver(body: {
  email: string;
  company_role?: "driver" | "manager";
  driver_type?: "pickup" | "last_mile" | "both";
  capacity_max?: number;
  home_warehouse_id?: string;
  serviceable_postal_codes?: string[];
}): Promise<DcApiResult<unknown>> {
  const guard = await assertDeliveryCompanySetup();
  if (!guard.ok) return guard;
  return storeApiFetch("/api/delivery-company/drivers", {
    method: "POST",
    body: JSON.stringify({
      company_role: "driver",
      driver_type: "both",
      capacity_max: 10,
      ...body,
    }),
  });
}

export async function updateDriverMember(
  memberId: string,
  patch: {
    is_active?: boolean;
    capacity_max?: number;
    driver_type?: string;
    home_warehouse_id?: string | null;
    serviceable_postal_codes?: string[];
  },
): Promise<DcApiResult<{ member: DcDriverMember }>> {
  const guard = await assertDeliveryCompanySetup();
  if (!guard.ok) return guard;
  return storeApiFetch(`/api/delivery-company/drivers/${memberId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function createWarehouse(body: {
  name: string;
  address: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postal_code: string;
    country?: string;
  };
  capacity_max?: number;
  latitude?: number | null;
  longitude?: number | null;
}): Promise<DcApiResult<{ warehouse: DcWarehouse }>> {
  const guard = await assertDeliveryCompanySetup();
  if (!guard.ok) return guard;
  return storeApiFetch("/api/delivery-company/warehouses", {
    method: "POST",
    body: JSON.stringify({ capacity_max: 500, ...body }),
  });
}

export async function updateWarehouse(
  warehouseId: string,
  patch: Partial<{
    name: string;
    address: DcWarehouse["address"];
    capacity_max: number;
    is_active: boolean;
    latitude: number | null;
    longitude: number | null;
  }>,
): Promise<DcApiResult<{ warehouse: DcWarehouse }>> {
  const guard = await assertDeliveryCompanySetup();
  if (!guard.ok) return guard;
  return storeApiFetch(`/api/delivery-company/warehouses/${warehouseId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function deleteWarehouse(warehouseId: string): Promise<DcApiResult<{ ok: boolean }>> {
  const guard = await assertDeliveryCompanySetup();
  if (!guard.ok) return guard;
  return storeApiFetch(`/api/delivery-company/warehouses/${warehouseId}`, { method: "DELETE" });
}

export async function updateDeliveryCompany(patch: {
  name?: string;
  description?: string;
  contact_phone?: string;
  contact_email?: string;
  serviceable_postal_codes?: string[];
  default_assignment_policy?: "zone" | "round_robin" | "manual";
  auto_assign_last_mile_on_receive?: boolean;
}): Promise<DcApiResult<{ company: DeliveryCompany }>> {
  const guard = await assertDeliveryCompanySetup();
  if (!guard.ok) return guard;
  return storeApiFetch("/api/delivery-company/me", {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function onboardDeliveryCompany(body: {
  name: string;
  slug: string;
  description?: string;
  contact_phone?: string;
  contact_email?: string;
  serviceable_postal_codes?: string[];
  default_assignment_policy?: "zone" | "round_robin" | "manual";
}): Promise<DcApiResult<{ company: DeliveryCompany }>> {
  return storeApiFetch("/api/delivery-company/onboard", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function acceptDriverInvite(token: string): Promise<DcApiResult<{ member: DcDriverMember }>> {
  return storeApiFetch("/api/delivery-company/drivers/accept", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export async function revokeInvite(inviteId: string): Promise<DcApiResult<{ ok: boolean; already_revoked?: boolean }>> {
  const guard = await assertDeliveryCompanySetup();
  if (!guard.ok) return guard;
  return storeApiFetch(`/api/delivery-company/invites/${inviteId}`, {
    method: "DELETE",
  });
}

export async function getDeliveryCompanyReturns(opts?: {
  status?: string;
}): Promise<DcApiResult<{ pickups: DcReturnPickup[] }>> {
  const params = new URLSearchParams();
  if (opts?.status && opts.status !== "all") params.set("status", opts.status);
  const q = params.toString();
  return storeApiFetch(`/api/delivery-company/returns${q ? `?${q}` : ""}`);
}

export async function getDeliveryCompanyAudit(): Promise<DcApiResult<{ entries: DcAuditEntry[] }>> {
  return storeApiFetch("/api/delivery-company/audit");
}

export type DcHistoryExportRow = {
  route_id: string;
  driver: string;
  warehouse: string;
  status: string;
  sequence: number;
  completed_at: string;
  address: string;
  cod_collected: number;
};

/** Stream a paginated history export. Loops server pages until `done=true`
 *  or the hard cap is reached. Caller controls concurrency (default 1). */
export async function* iterateDeliveryCompanyHistory(
  opts?: { pageSize?: number; signal?: AbortSignal },
): AsyncGenerator<{ rows: DcHistoryExportRow[]; cursor: number | null; done: boolean }> {
  let cursor: number | null = 0;
  const limit = Math.max(1, Math.min(200, opts?.pageSize ?? 200));
  while (cursor !== null) {
    if (opts?.signal?.aborted) return;
    const params = new URLSearchParams();
    params.set("cursor", String(cursor));
    params.set("limit", String(limit));
    const res = await storeApiFetch(`/api/delivery-company/history/export?${params.toString()}`);
    if (!res.ok) return;
    const data = res.data as {
      rows: DcHistoryExportRow[];
      next_cursor: number | null;
      done: boolean;
    };
    yield { rows: data.rows, cursor: data.next_cursor, done: data.done };
    cursor = data.next_cursor;
    if (data.done) return;
  }
}

export async function createDeliveryRoute(body: {
  driver_id: string;
  order_ids: string[];
  warehouse_id?: string;
}): Promise<DcApiResult<{ route: DcRoute }>> {
  const guard = await assertDeliveryCompanyOperations();
  if (!guard.ok) return guard;
  return storeApiFetch("/api/delivery-company/routes", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export { hasStoreApi } from "@/lib/api/delivery-api";
