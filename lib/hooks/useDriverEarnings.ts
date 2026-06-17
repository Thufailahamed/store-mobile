/**
 * Driver earnings aggregation. Pure functions over Order[] so they are unit-testable.
 * Server history is the source of truth — we only compute displayable metrics.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DriverMetrics } from "@/lib/types";
import type { Order } from "@/lib/types";
import { getRiderHistory } from "@/lib/api";
import { useAuth } from "@/lib/supabase/auth";

const TERMINAL_OK = new Set(["delivered"]);
const TERMINAL_FAIL = new Set(["returned", "cancelled", "refunded"]);

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function bucketByDay(orders: Order[]): Map<string, { delivered: number; failed: number; cod: number }> {
  const map = new Map<string, { delivered: number; failed: number; cod: number }>();
  for (const o of orders) {
    const when = o.delivered_at || o.placed_at;
    const d = new Date(when);
    if (Number.isNaN(d.getTime())) continue;
    const key = startOfDay(d).toISOString().slice(0, 10);
    const cur = map.get(key) ?? { delivered: 0, failed: 0, cod: 0 };
    if (TERMINAL_OK.has(o.status)) {
      cur.delivered += 1;
      if (o.payment_method === "cod" && o.payment_status === "paid") {
        cur.cod += o.total;
      }
    } else if (TERMINAL_FAIL.has(o.status)) {
      cur.failed += 1;
    }
    map.set(key, cur);
  }
  return map;
}

export function computeMetrics(orders: Order[], windowDays: number | "all"): DriverMetrics {
  const cutoff =
    windowDays === "all"
      ? null
      : startOfDay(new Date()).getTime() - (windowDays - 1) * 24 * 60 * 60 * 1000;

  const scoped = orders.filter((o) => {
    if (!cutoff) return true;
    const when = o.delivered_at || o.placed_at;
    return new Date(when).getTime() >= cutoff;
  });

  const delivered = scoped.filter((o) => o.status === "delivered").length;
  const failed = scoped.filter((o) => TERMINAL_FAIL.has(o.status)).length;
  const cancelled = scoped.filter((o) => o.status === "cancelled").length;
  const returned = scoped.filter((o) => o.status === "returned").length;
  const total_assigned = scoped.length;

  const total = delivered + failed;
  const success_rate = total === 0 ? 0 : Math.round((delivered / total) * 100);

  const cod_collected = scoped
    .filter((o) => o.status === "delivered" && o.payment_method === "cod" && o.payment_status === "paid")
    .reduce((sum, o) => sum + o.total, 0);

  // Average minutes from placed_at → delivered_at
  const deliveryMinutes = scoped
    .filter((o) => o.status === "delivered" && o.delivered_at)
    .map((o) => (new Date(o.delivered_at!).getTime() - new Date(o.placed_at).getTime()) / 60000)
    .filter((m) => m > 0 && m < 24 * 60);
  const avg_delivery_minutes =
    deliveryMinutes.length === 0
      ? 0
      : Math.round(deliveryMinutes.reduce((s, m) => s + m, 0) / deliveryMinutes.length);

  // Daily buckets for the chart (oldest → newest)
  const buckets = bucketByDay(scoped);
  const dailyKeys: string[] = [];
  if (windowDays === "all") {
    for (const k of Array.from(buckets.keys()).sort()) dailyKeys.push(k);
  } else {
    const today = startOfDay(new Date());
    for (let i = windowDays - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      dailyKeys.push(d.toISOString().slice(0, 10));
    }
  }
  const daily = dailyKeys.map((k) => ({
    date: k,
    delivered: buckets.get(k)?.delivered ?? 0,
    failed: buckets.get(k)?.failed ?? 0,
    cod: buckets.get(k)?.cod ?? 0,
  }));

  return {
    delivered,
    failed,
    returned,
    cancelled,
    total_assigned,
    success_rate,
    cod_collected,
    avg_delivery_minutes,
    daily,
  };
}

export function useDriverEarnings() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setError(null);
    const res = await getRiderHistory(user.id);
    if (res.ok) {
      setOrders(res.data);
    } else {
      setError(res.error);
    }
    setLoading(false);
    setRefreshing(false);
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const metricsByRange = useMemo(() => {
    return {
      today: computeMetrics(orders, 1),
      week: computeMetrics(orders, 7),
      month: computeMetrics(orders, 30),
      all: computeMetrics(orders, "all"),
    };
  }, [orders]);

  return {
    orders,
    loading,
    refreshing,
    error,
    load: () => { setRefreshing(true); load(); },
    metricsByRange,
  };
}
