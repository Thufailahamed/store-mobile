/**
 * Pure filter helpers for the delivery-orders list.
 * Extracted from app/(delivery)/orders/index.tsx so they're unit-testable.
 */

import type { Order } from "@/lib/types";
import { isCompleted } from "@/lib/utils/delivery-format";

export type OrdersFilter = "all" | "assigned" | "out_for_delivery" | "completed";

export function matchesSearch(o: Order, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return (
    o.order_number?.toLowerCase().includes(needle) ||
    o.shipping_address?.full_name?.toLowerCase().includes(needle) ||
    o.shipping_address?.city?.toLowerCase().includes(needle) ||
    false
  );
}

export function matchesFilter(o: Order, filter: OrdersFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "assigned":
      return !isCompleted(o.status) && o.status !== "out_for_delivery";
    case "out_for_delivery":
      return o.status === "out_for_delivery";
    case "completed":
      return isCompleted(o.status);
  }
}

export function filterOrders(orders: Order[], q: string, filter: OrdersFilter): Order[] {
  return orders.filter((o) => matchesSearch(o, q) && matchesFilter(o, filter));
}

export function countByFilter(orders: Order[]): Record<OrdersFilter, number> {
  return {
    all: orders.length,
    assigned: orders.filter((o) => matchesFilter(o, "assigned")).length,
    out_for_delivery: orders.filter((o) => matchesFilter(o, "out_for_delivery")).length,
    completed: orders.filter((o) => matchesFilter(o, "completed")).length,
  };
}
