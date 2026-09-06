export type SellerReturnStatus = "requested" | "approved" | "rejected" | "received" | "refunded";

export type SellerReturnItem = {
  return_id: string;
  order_item_id: string;
  product_name: string;
  variant_label: string | null;
  quantity: number;
  unit_price: number;
  refund_amount: number;
};

export type SellerReturnListItem = {
  id: string;
  return_group_id: string;
  return_number: string;
  order_id: string;
  order_number: string;
  order_status: string;
  currency: string;
  reason: string;
  status: SellerReturnStatus;
  refund_amount: number | null;
  created_at: string;
  updated_at: string;
  received_at: string | null;
  seller_note: string | null;
  buyer_name: string | null;
  product_name: string | null;
  variant_label: string | null;
  items: SellerReturnItem[];
};

const STATUSES = new Set<SellerReturnStatus>([
  "requested",
  "approved",
  "rejected",
  "received",
  "refunded",
]);

const STATUS_LABELS: Record<SellerReturnStatus, string> = {
  requested: "Requested",
  approved: "Approved",
  received: "Received",
  refunded: "Refunded",
  rejected: "Rejected",
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function pickStr(...vals: unknown[]): string | null {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function firstFiniteNumber(...vals: unknown[]): number | null {
  for (const v of vals) {
    if (v == null || v === "") continue;
    const n = typeof v === "number" ? v : Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function formatReturnStatusLabel(status: string | null | undefined): string {
  if (!status) return "—";
  const key = status.toLowerCase() as SellerReturnStatus;
  return STATUS_LABELS[key] ?? status.replace(/_/g, " ");
}

export function returnRefundAmount(row: { refund_amount?: number | null }): number | null {
  return firstFiniteNumber(row.refund_amount);
}

export function mapSellerReturnRow(row: unknown): SellerReturnListItem {
  const r = asRecord(row) ?? {};
  const order = asRecord(r.order) ?? {};
  const id = pickStr(r.id, r.return_group_id) ?? "";
  const productName = pickStr(r.product_name, r.name);
  const variantLabel = pickStr(r.variant_label, r.variant);
  const refund = firstFiniteNumber(r.refund_amount);
  const itemsRaw = Array.isArray(r.items) ? r.items : [];
  const items: SellerReturnItem[] = itemsRaw.map((item) => {
    const i = asRecord(item) ?? {};
    return {
      return_id: pickStr(i.return_id, i.id, id) ?? "",
      order_item_id: pickStr(i.order_item_id, i.id) ?? "",
      product_name: pickStr(i.product_name, i.name, productName) ?? "Item",
      variant_label: pickStr(i.variant_label, i.variant),
      quantity: firstFiniteNumber(i.quantity) ?? 1,
      unit_price: firstFiniteNumber(i.unit_price, i.price) ?? 0,
      refund_amount: firstFiniteNumber(i.refund_amount, i.amount, refund) ?? 0,
    };
  });
  if (items.length === 0 && (productName || id)) {
    items.push({
      return_id: id,
      order_item_id: pickStr(r.order_item_id) ?? "",
      product_name: productName ?? "Item",
      variant_label: variantLabel,
      quantity: 1,
      unit_price: 0,
      refund_amount: refund ?? 0,
    });
  }

  const statusRaw = pickStr(r.status)?.toLowerCase() ?? "requested";
  const status = STATUSES.has(statusRaw as SellerReturnStatus)
    ? (statusRaw as SellerReturnStatus)
    : "requested";

  return {
    id,
    return_group_id: pickStr(r.return_group_id, r.id) ?? id,
    return_number: pickStr(r.return_number, r.number, order.order_number, id) ?? id,
    order_id: pickStr(r.order_id, order.id) ?? "",
    order_number: pickStr(r.order_number, order.order_number) ?? "",
    order_status: pickStr(r.order_status, order.status) ?? "",
    currency: pickStr(r.currency, order.currency) ?? "LKR",
    reason: pickStr(r.reason) ?? "",
    status,
    refund_amount: refund,
    created_at: pickStr(r.created_at) ?? new Date().toISOString(),
    updated_at: pickStr(r.updated_at, r.created_at) ?? new Date().toISOString(),
    received_at: pickStr(r.received_at),
    seller_note: pickStr(r.seller_note, r.note),
    buyer_name: pickStr(
      r.customer_name,
      r.buyer_name,
      order.customer_name,
      asRecord(order.shipping_address)?.full_name,
      asRecord(r.shipping_address)?.full_name,
    ),
    product_name: productName,
    variant_label: variantLabel,
    items,
  };
}

export function countReturnsByStatus(rows: SellerReturnListItem[]): Record<"all" | SellerReturnStatus, number> {
  const counts: Record<"all" | SellerReturnStatus, number> = {
    all: rows.length,
    requested: 0,
    approved: 0,
    received: 0,
    refunded: 0,
    rejected: 0,
  };
  for (const row of rows) {
    counts[row.status] += 1;
  }
  return counts;
}

export function filterSellerReturns(
  rows: SellerReturnListItem[],
  opts: { status?: string; search?: string } = {},
): SellerReturnListItem[] {
  const status = opts.status && opts.status !== "all" ? opts.status : null;
  const q = (opts.search ?? "").trim().toLowerCase();
  return rows.filter((row) => {
    if (status && row.status !== status) return false;
    if (!q) return true;
    const hay = [
      row.return_number,
      row.order_number,
      row.buyer_name,
      row.product_name,
      row.variant_label,
      row.reason,
      row.id,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}
