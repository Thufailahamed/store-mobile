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
    const csv = toCsv(
      ["id", "order_number", "status", "payment_status", "total", "placed_at"],
      orders.map((o) => [o.id, o.order_number, o.status, o.payment_status, o.total, o.placed_at]),
    );
    const titles: Record<string, string> = {
      orders: "Order ledger",
      payouts: "Payouts queue",
      tax: "Tax summary",
      finance: "Finance pack",
    };
    return { ok: true, csv, title: titles[key] ?? "Orders" };
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
