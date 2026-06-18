/**
 * Client mirror of store/src/lib/delivery-assignment-queues.ts
 */

import { OPEN_INVENTORY_STATUSES } from "./warehouse-routing";

const ASSIGNABLE_STATUSES = ["confirmed", "processing", "shipped", "out_for_delivery"] as const;

function isOrderStatusAssignable(status: string): boolean {
  return (ASSIGNABLE_STATUSES as readonly string[]).includes(status);
}

export interface AssignmentOrderRow {
  id: string;
  order_number?: string | null;
  status: string;
  total?: number | null;
  currency?: string | null;
  payment_method?: string | null;
  shipping_address?: Record<string, string> | null;
  delivery_person_id?: string | null;
  pickup_driver_id?: string | null;
  pickup_decision?: string | null;
  pickup_warehouse_id?: string | null;
  pickup_warehouse?: { id: string; name: string } | null;
  placed_at?: string | null;
  confirmed_at?: string | null;
}

export interface HubInventoryRow {
  order_id: string;
  status: string;
  received_at?: string | null;
  warehouse?: { id: string; name: string } | null;
  order?: AssignmentOrderRow | null;
}

export function hubBlockedOrderIds(inventory: HubInventoryRow[]): Set<string> {
  const blocked = new Set<string>();
  for (const row of inventory) {
    if ((OPEN_INVENTORY_STATUSES as readonly string[]).includes(row.status)) {
      blocked.add(row.order_id);
    }
  }
  return blocked;
}

export function isPickupPendingOrder(
  order: AssignmentOrderRow,
  blockedAtHub: Set<string>,
): boolean {
  if (!isOrderStatusAssignable(order.status)) return false;
  if (order.pickup_driver_id) return false;
  if (order.delivery_person_id) return false;
  if (blockedAtHub.has(order.id)) return false;
  return true;
}

export function isHubLastMilePending(row: HubInventoryRow): boolean {
  if (row.status !== "received") return false;
  const order = row.order;
  if (!order) return false;
  if (order.delivery_person_id) return false;
  return true;
}

export type PendingAssignmentOrder = AssignmentOrderRow & {
  _warehouse?: { id: string; name: string } | null;
  _received_at?: string | null;
  _queue_kind: "pickup" | "hub_last_mile";
};

export function buildPickupPendingQueue(
  orders: AssignmentOrderRow[],
  inventory: HubInventoryRow[],
): PendingAssignmentOrder[] {
  const blocked = hubBlockedOrderIds(inventory);
  return orders
    .filter((o) => isPickupPendingOrder(o, blocked))
    .map((o) => ({
      ...o,
      _queue_kind: "pickup" as const,
      _warehouse: o.pickup_warehouse
        ? { id: o.pickup_warehouse.id, name: o.pickup_warehouse.name }
        : o.pickup_warehouse_id
          ? { id: o.pickup_warehouse_id, name: "Assigned hub" }
          : null,
    }))
    .sort((a, b) => {
      const ta = a.placed_at ?? a.confirmed_at ?? "";
      const tb = b.placed_at ?? b.confirmed_at ?? "";
      return ta.localeCompare(tb);
    });
}

export function buildHubLastMilePendingQueue(
  inventory: HubInventoryRow[],
): PendingAssignmentOrder[] {
  const seen = new Set<string>();
  const list: PendingAssignmentOrder[] = [];
  for (const row of inventory) {
    if (!isHubLastMilePending(row) || !row.order || seen.has(row.order_id)) continue;
    seen.add(row.order_id);
    list.push({
      ...row.order,
      _warehouse: row.warehouse ?? null,
      _received_at: row.received_at ?? null,
      _queue_kind: "hub_last_mile",
    });
  }
  return list.sort((a, b) => {
    const ta = a._received_at ? new Date(a._received_at).getTime() : Number.POSITIVE_INFINITY;
    const tb = b._received_at ? new Date(b._received_at).getTime() : Number.POSITIVE_INFINITY;
    return ta - tb;
  });
}

export function buildPendingQueueForLeg(
  leg: "pickup" | "last_mile" | "delivery",
  pickupOrders: AssignmentOrderRow[],
  inventory: HubInventoryRow[],
): PendingAssignmentOrder[] {
  if (leg === "pickup") return buildPickupPendingQueue(pickupOrders, inventory);
  return buildHubLastMilePendingQueue(inventory);
}
