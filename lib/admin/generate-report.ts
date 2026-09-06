import { Share } from "react-native";
import {
  getAdminOrders,
  getAdminProducts,
  getAdminStores,
  getAdminUsers,
} from "@/lib/api";

export type AdminReportKey =
  | "sales"
  | "orders"
  | "products"
  | "stores"
  | "customers"
  | "payouts"
  | "tax"
  | "finance";

function csvEscape(value: unknown): string {
  const s = value == null ? "" : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers.map(csvEscape).join(","), ...rows.map((r) => r.map(csvEscape).join(","))].join("\n");
}

export async function generateAdminReport(key: AdminReportKey): Promise<{ ok: true; csv: string; title: string } | { ok: false; error: string }> {
  try {
    if (key === "products") {
      const r = await getAdminProducts({ limit: 500 });
      if (!r.ok) return { ok: false, error: r.error };
      const csv = toCsv(
        ["id", "name", "status", "price", "stock"],
        (r.data.products ?? []).map((p: any) => [p.id, p.name, p.status, p.price, p.stock]),
      );
      return { ok: true, csv, title: "Catalogue snapshot" };
    }
    if (key === "stores") {
      const r = await getAdminStores({ limit: 500 });
      if (!r.ok) return { ok: false, error: r.error };
      const csv = toCsv(
        ["id", "name", "status", "slug"],
        (r.data.stores ?? []).map((s) => [s.id, s.name, s.status, s.slug]),
      );
      return { ok: true, csv, title: "Seller roster" };
    }
    if (key === "customers") {
      const r = await getAdminUsers({ limit: 500 });
      if (!r.ok) return { ok: false, error: r.error };
      const csv = toCsv(
        ["id", "name", "email", "role"],
        (r.data.users ?? []).map((u: any) => [u.id, u.full_name, u.email ?? u.phone, u.role]),
      );
      return { ok: true, csv, title: "Customer list" };
    }

    const r = await getAdminOrders({ limit: 500 });
    if (!r.ok) return { ok: false, error: r.error };
    const orders = r.data ?? [];
    if (key === "sales") {
      const byDay = new Map<string, { count: number; total: number }>();
      for (const o of orders) {
        const day = (o.placed_at ?? "").slice(0, 10);
        const prev = byDay.get(day) ?? { count: 0, total: 0 };
        byDay.set(day, { count: prev.count + 1, total: prev.total + (o.total ?? 0) });
      }
      const csv = toCsv(
        ["date", "orders", "gross"],
        [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => [date, v.count, v.total]),
      );
      return { ok: true, csv, title: "Sales by day" };
    }
    if (key === "payouts") {
      // No dedicated seller-payout ledger endpoint exists on the backend;
      // export the settled (paid) order basis that payouts are computed from.
      const settled = orders.filter((o) => o.payment_status === "paid");
      const csv = toCsv(
        ["id", "order_number", "status", "total", "placed_at"],
        settled.map((o) => [o.id, o.order_number, o.status, o.total, o.placed_at]),
      );
      return { ok: true, csv, title: "Payouts basis — paid orders" };
    }
    if (key === "tax") {
      // Orders carry no separate tax column; export gross totals per order
      // as the taxable basis instead of implying per-line tax data.
      const csv = toCsv(
        ["id", "order_number", "total", "payment_status", "placed_at"],
        orders.map((o) => [o.id, o.order_number, o.total, o.payment_status, o.placed_at]),
      );
      return { ok: true, csv, title: "Tax basis — gross sales" };
    }
    if (key === "finance") {
      const byStatus = new Map<string, { count: number; total: number }>();
      for (const o of orders) {
        const k = `${o.status ?? "unknown"} / ${o.payment_status ?? "unknown"}`;
        const prev = byStatus.get(k) ?? { count: 0, total: 0 };
        byStatus.set(k, { count: prev.count + 1, total: prev.total + (o.total ?? 0) });
      }
      const csv = toCsv(
        ["status", "orders", "gross"],
        [...byStatus.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([status, v]) => [status, v.count, v.total]),
      );
      return { ok: true, csv, title: "Finance pack — by status" };
    }
    const csv = toCsv(
      ["id", "order_number", "status", "payment_status", "total", "placed_at"],
      orders.map((o) => [o.id, o.order_number, o.status, o.payment_status, o.total, o.placed_at]),
    );
    return { ok: true, csv, title: "Order ledger" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to generate report" };
  }
}

export async function shareAdminReportCsv(title: string, csv: string): Promise<void> {
  await Share.share({
    title: `${title}.csv`,
    message: csv,
  });
}
