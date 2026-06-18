/**
 * Client-side warehouse routing helpers — mirrors store/src/lib/warehouse-routing.ts
 * for DC portal UI (readiness badges, constraint copy, skip-reason labels).
 */

export interface WarehouseRoutingStats {
  inventory_count: number;
  pickup_driver_count: number;
}

export interface WarehouseRoutingInput {
  id: string;
  is_active?: boolean | null;
  latitude?: number | null;
  longitude?: number | null;
  capacity_max?: number | null;
}

export type WarehouseCapacityStatus = "ok" | "near_full" | "full";

export const ASSIGNMENT_HARD_CONSTRAINTS = [
  "Company must be active to assign or receive packages.",
  "Pickup routing picks the nearest active hub with coordinates; without coordinates, the oldest active hub is used.",
  "Pickup drivers must be based at the assigned hub (home warehouse) and have pickup or both type.",
  "Last-mile drivers must match the delivery postal zone and have last-mile or both type.",
  "Driver capacity (active stops vs capacity_max) is enforced on auto and manual assignment.",
  "Hub receive is blocked when inventory reaches capacity_max.",
  "Warehouses with open inventory cannot be deleted.",
  "Manual assignment bypasses auto scoring but still enforces driver type, capacity, and order status.",
] as const;

export function isWarehouseGeocoded(warehouse: Pick<WarehouseRoutingInput, "latitude" | "longitude">): boolean {
  return warehouse.latitude != null && warehouse.longitude != null;
}

export function getWarehouseCapacityStatus(
  inventoryCount: number,
  capacityMax: number | null | undefined,
): WarehouseCapacityStatus {
  const cap = capacityMax ?? 0;
  if (cap <= 0) return "ok";
  if (inventoryCount >= cap) return "full";
  if (inventoryCount >= Math.ceil(cap * 0.9)) return "near_full";
  return "ok";
}

export function canReceiveAtWarehouse(
  inventoryCount: number,
  capacityMax: number | null | undefined,
): { ok: true } | { ok: false; error: string } {
  const status = getWarehouseCapacityStatus(inventoryCount, capacityMax);
  if (status === "full") {
    return {
      ok: false,
      error: `Hub is at capacity (${inventoryCount}/${capacityMax ?? 0}). Dispatch packages before receiving more.`,
    };
  }
  return { ok: true };
}

export function assessWarehouseRoutingReadiness(
  warehouse: WarehouseRoutingInput,
  stats: WarehouseRoutingStats,
): {
  geocoded: boolean;
  routing_ready: boolean;
  capacity_status: WarehouseCapacityStatus;
  warnings: string[];
} {
  const geocoded = isWarehouseGeocoded(warehouse);
  const capacity_status = getWarehouseCapacityStatus(stats.inventory_count, warehouse.capacity_max ?? null);
  const warnings: string[] = [];

  if (warehouse.is_active === false) {
    warnings.push("Inactive hubs are excluded from nearest-warehouse routing.");
  }
  if (!geocoded) {
    warnings.push("Add coordinates so pickup orders route to the nearest hub.");
  }
  if (stats.pickup_driver_count === 0) {
    warnings.push("No pickup drivers are based at this hub.");
  }
  if (capacity_status === "near_full") {
    warnings.push(`Hub is nearly full (${stats.inventory_count}/${warehouse.capacity_max}).`);
  }
  if (capacity_status === "full") {
    warnings.push(`Hub is at capacity (${stats.inventory_count}/${warehouse.capacity_max}).`);
  }

  const routing_ready =
    warehouse.is_active !== false &&
    geocoded &&
    stats.pickup_driver_count > 0 &&
    capacity_status !== "full";

  return { geocoded, routing_ready, capacity_status, warnings };
}

export function formatAssignmentSkipReason(reason: string): string {
  const map: Record<string, string> = {
    no_warehouse_in_company: "No active hub available for this company.",
    no_pickup_driver_with_capacity: "No pickup driver with capacity at the nearest hub.",
    no_driver_with_capacity: "No driver with remaining capacity.",
    "invalid_status:delivered": "Order is already delivered.",
    "invalid_status:cancelled": "Order was cancelled.",
    "invalid_status:returned": "Order was returned.",
    write_failed: "Assignment could not be saved.",
  };
  if (map[reason]) return map[reason];
  if (reason.startsWith("invalid_status:")) {
    return `Order status "${reason.slice("invalid_status:".length)}" cannot be assigned.`;
  }
  return reason.replace(/_/g, " ");
}

const OPEN_INVENTORY_STATUSES = ["received", "assigned", "in_transit"] as const;

export { OPEN_INVENTORY_STATUSES };

/** Haversine distance in km — matches `_nearest_warehouse_to_store` PG formula. */
export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180 / 2;
  const dLng = ((lng2 - lng1) * Math.PI) / 180 / 2;
  const a =
    Math.sin(dLat) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export interface WarehouseGeo {
  id: string;
  is_active?: boolean | null;
  latitude?: number | null;
  longitude?: number | null;
  created_at?: string | null;
}

export function resolveNearestWarehouse(
  warehouses: WarehouseGeo[],
  storeLat: number | null | undefined,
  storeLng: number | null | undefined,
): string | null {
  const active = warehouses.filter((w) => w.is_active !== false);
  if (!active.length) return null;

  if (storeLat == null || storeLng == null) {
    const sorted = [...active].sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return ta - tb;
    });
    return sorted[0]?.id ?? null;
  }

  const geocoded = active.filter((w) => w.latitude != null && w.longitude != null);
  if (!geocoded.length) return null;

  let bestId: string | null = null;
  let bestDist = Infinity;
  for (const w of geocoded) {
    const dist = haversineDistanceKm(storeLat, storeLng, w.latitude!, w.longitude!);
    if (dist < bestDist) {
      bestDist = dist;
      bestId = w.id;
    }
  }
  return bestId;
}

export function formatDistanceMeters(meters: number | null | undefined): string | null {
  if (meters == null || !Number.isFinite(meters)) return null;
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}
