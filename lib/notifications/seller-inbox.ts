import { formatPrice } from "@/lib/utils";

export type SellerNotifBucket = "order" | "inventory" | "review" | "system";

export type SellerInboxItem = {
  id: string;
  type: string;
  title?: string;
  body?: string | null;
  data?: Record<string, unknown> | null;
  status?: string | null;
  read_at?: string | null;
  created_at: string;
};

export type ParsedOrderAlert = {
  orderNumber: string | null;
  orderId: string | null;
  amount: number | null;
  currency: string;
  storeName: string | null;
};

const ORDER_REF_RE = /\b(ORD-[A-Z0-9-]+|LX-[A-Z0-9-]+)\b/i;
const WORTH_RE = /worth\s+([\d,]+(?:\.\d+)?)\s*([A-Z]{3})?/i;
const STORE_RE = /\bat\s+(.+?)\s*$/i;

function asRecord(data: unknown): Record<string, unknown> {
  return data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asAmount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value === "string") {
    const n = Number(value.replace(/,/g, ""));
    if (Number.isFinite(n)) return Math.round(n);
  }
  return null;
}

export function normalizeSellerNotifType(rawType: string | undefined | null): SellerNotifBucket {
  const t = (rawType || "").toLowerCase();
  if (t.includes("order") || t.includes("checkout") || t.includes("purchase") || t.includes("sale")) {
    return "order";
  }
  if (t.includes("inventory") || t.includes("stock") || t.includes("sku") || t.includes("replenish")) {
    return "inventory";
  }
  if (t.includes("review") || t.includes("rating") || t.includes("feedback")) {
    return "review";
  }
  return "system";
}

export function isNotificationUnread(n: { status?: string | null; read_at?: string | null }): boolean {
  if (n.status === "read") return false;
  if (n.read_at) return false;
  return true;
}

export function extractOrderRef(text: string, data?: Record<string, unknown> | null): string | null {
  const fromData = asString(asRecord(data).order_number);
  if (fromData) return fromData;
  const match = text.match(ORDER_REF_RE);
  return match ? match[1] : null;
}

export function parseOrderAlert(
  body: string | undefined | null,
  data?: Record<string, unknown> | null,
): ParsedOrderAlert {
  const rec = asRecord(data);
  const text = body ?? "";
  const fromWorth = text.match(WORTH_RE);
  const fromStore = text.match(STORE_RE);

  return {
    orderNumber: asString(rec.order_number) ?? extractOrderRef(text, rec),
    orderId: asString(rec.order_id) ?? asString(rec.orderId),
    amount:
      asAmount(rec.total) ??
      asAmount(rec.amount) ??
      asAmount(rec.order_total) ??
      (fromWorth ? asAmount(fromWorth[1]) : null),
    currency: asString(rec.currency) ?? (fromWorth?.[2] ? fromWorth[2].toUpperCase() : "LKR"),
    storeName: asString(rec.store_name) ?? asString(rec.storeName) ?? (fromStore ? fromStore[1].trim() : null),
  };
}

export function formatNotificationBody(
  body: string | undefined | null,
  data?: Record<string, unknown> | null,
): string {
  const parsed = parseOrderAlert(body, data);
  const parts: string[] = [];
  if (parsed.orderNumber) parts.push(parsed.orderNumber);
  if (parsed.amount != null) parts.push(formatPrice(parsed.amount, parsed.currency || "LKR"));
  if (parsed.storeName) parts.push(parsed.storeName);
  if (parts.length > 0) return parts.join(" · ");
  return (body ?? "").trim();
}

export function sellerNotifHref(item: {
  type?: string;
  body?: string | null;
  data?: Record<string, unknown> | null;
}): string | null {
  const rec = asRecord(item.data);
  const returnId = asString(rec.return_group_id) ?? asString(rec.return_id);
  if (returnId) return `/(seller)/returns/${returnId}`;

  const parsed = parseOrderAlert(item.body, rec);
  if (parsed.orderId) return `/(seller)/orders/${parsed.orderId}`;

  const bucket = normalizeSellerNotifType(item.type);
  if (bucket === "order" && parsed.orderNumber) {
    return `/(seller)/orders?search=${encodeURIComponent(parsed.orderNumber)}`;
  }
  if (bucket === "inventory") return "/(seller)/inventory";
  if (bucket === "review") return "/(seller)/reviews";
  return null;
}

export function markInboxItemRead<T extends { status?: string | null; read_at?: string | null }>(
  item: T,
  at = new Date().toISOString(),
): T {
  return { ...item, status: "read", read_at: item.read_at ?? at };
}

export function filterSellerInbox<T extends SellerInboxItem>(
  items: T[],
  opts: { tab?: "all" | "unread" | SellerNotifBucket; search?: string } = {},
): T[] {
  const tab = opts.tab ?? "all";
  const q = (opts.search ?? "").trim().toLowerCase();
  return items.filter((item) => {
    if (tab === "unread" && !isNotificationUnread(item)) return false;
    if (tab !== "all" && tab !== "unread" && normalizeSellerNotifType(item.type) !== tab) return false;
    if (!q) return true;
    const hay = [item.title, item.body, formatNotificationBody(item.body, item.data), extractOrderRef(item.body ?? "", item.data)]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}
