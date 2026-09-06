import type { Order, OrderItem, PaymentMethod, PaymentStatus, OrderStatus } from "@/lib/types";
import { resolveImageUrl } from "@/lib/utils";

/** Matches store-backend seller order list: never embed `users` (3 FKs on orders). */
export const SELLER_ORDERS_LIST_SELECT =
  "id, order_number, status, payment_status, payment_method, total, currency, placed_at, updated_at, delivered_at, user_id, notes, shipping_address, delivery_person_id, delivery_otp, " +
  "items:order_items!order_items_order_id_fkey(" +
  "id, order_id, product_id, variant_id, store_id, product_name, variant_label, sku, quantity, unit_price, total, status, " +
  "product:products!order_items_product_id_fkey(name, images:product_images!product_images_product_id_fkey(url, is_primary))" +
  ")";

export function isAmbiguousRelationshipError(error: string | null | undefined): boolean {
  if (!error) return false;
  return /more than one relationship was found/i.test(error);
}

const PAYMENT_METHODS = new Set<PaymentMethod>([
  "stripe",
  "payhere",
  "paypal",
  "cod",
  "wallet",
  "gift_card",
  "koko",
]);

const PAYMENT_STATUSES = new Set<PaymentStatus>([
  "pending",
  "paid",
  "failed",
  "refunded",
  "partially_refunded",
]);

const ORDER_STATUSES = new Set<OrderStatus>([
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "returned",
  "refunded",
  "failed_attempt",
]);

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  processing: "Packing",
  packed: "Packed",
  shipped: "Shipped",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  returned: "Returned",
  refunded: "Refunded",
  failed: "Failed",
  failed_attempt: "Failed attempt",
};

function pickStr(...vals: unknown[]): string | null {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

/** Buyer checkout method — card rail is PayHere, not seller Stripe Connect. */
export function formatCheckoutPayment(method?: string | null): string {
  const key = (method ?? "").trim().toLowerCase();
  if (!key) return "—";
  if (key === "payhere" || key === "stripe") return "PayHere";
  if (key === "cod") return "Cash on delivery";
  if (key === "paypal") return "PayPal";
  if (key === "wallet") return "Wallet";
  if (key === "gift_card") return "Gift card";
  if (key === "koko") return "Koko";
  return key.replace(/_/g, " ");
}

export function formatPaymentStatus(status?: string | null): string {
  const key = (status ?? "").trim().toLowerCase();
  if (!key) return "—";
  if (key === "paid") return "Paid";
  if (key === "pending") return "Unpaid";
  if (key === "failed") return "Failed";
  if (key === "refunded") return "Refunded";
  if (key === "partially_refunded") return "Partial refund";
  return key.replace(/_/g, " ");
}

export function formatOrderStatusLabel(status?: string | null): string {
  const key = (status ?? "").trim().toLowerCase();
  if (!key) return "—";
  return STATUS_LABELS[key] ?? key.replace(/_/g, " ");
}

export function countOrderUnits(items?: Array<{ quantity?: number }> | null): number | null {
  if (!items || items.length === 0) return null;
  let any = false;
  let sum = 0;
  for (const item of items) {
    if (typeof item.quantity === "number" && Number.isFinite(item.quantity)) {
      any = true;
      sum += item.quantity;
    }
  }
  return any ? sum : null;
}

export interface ShippingContact {
  name: string | null;
  place: string | null;
}

export function readShippingContact(order: {
  shipping_address?: unknown;
  address?: unknown;
}): ShippingContact {
  const ship = coerceAddress(order.shipping_address) ?? coerceAddress(order.address);
  if (!ship) return { name: null, place: null };
  return {
    name: pickStr(ship.full_name, ship.name),
    place: pickStr(ship.city, ship.town),
  };
}

function coerceAddress(raw: unknown): Record<string, unknown> | null {
  return asRecord(parseMaybeJson(raw));
}

export interface LineItemView {
  name: string | null;
  imageUrl: string | null;
  variant: string | null;
  quantity: number | null;
}

function primaryImageUrl(images: unknown): string | null {
  if (!Array.isArray(images) || images.length === 0) return null;
  const rows = images.map(asRecord).filter(Boolean) as Record<string, unknown>[];
  const primary = rows.find((img) => img.is_primary) ?? rows[0];
  const url = pickStr(primary?.url, primary?.src);
  return url ? resolveImageUrl(url) || url : null;
}

export function firstLineItem(items?: unknown[] | null): LineItemView | null {
  if (!items || items.length === 0) return null;
  const rec = asRecord(items[0]);
  if (!rec) return null;
  const product = asRecord(rec.product);
  const name = pickStr(rec.product_name, rec.name, product?.name);
  const imageUrl =
    pickStr(rec.image_url, rec.image) ? resolveImageUrl(pickStr(rec.image_url, rec.image) as string) : primaryImageUrl(product?.images);
  const qty = typeof rec.quantity === "number" && Number.isFinite(rec.quantity) ? rec.quantity : null;
  return {
    name: name ?? null,
    imageUrl: imageUrl || null,
    variant: pickStr(rec.variant_label, rec.variant),
    quantity: qty,
  };
}

function mapLineItem(raw: unknown, index: number): OrderItem {
  const rec = asRecord(raw) ?? {};
  const product = asRecord(rec.product);
  const name = pickStr(rec.product_name, rec.name, product?.name) ?? "Item";
  const qty = typeof rec.quantity === "number" && Number.isFinite(rec.quantity) ? rec.quantity : 0;
  const unit = Number(rec.unit_price ?? rec.price ?? 0);
  return {
    id: pickStr(rec.id) ?? `item-${index}`,
    order_id: pickStr(rec.order_id) ?? "",
    product_id: pickStr(rec.product_id, product?.id) ?? "",
    variant_id: pickStr(rec.variant_id) ?? undefined,
    store_id: pickStr(rec.store_id) ?? "",
    product_name: name,
    variant_label: pickStr(rec.variant_label) ?? undefined,
    quantity: qty,
    unit_price: Number.isFinite(unit) ? unit : 0,
    total: Number(rec.total ?? unit * qty) || 0,
    status: (pickStr(rec.status) as OrderStatus) ?? "pending",
    image_url: pickStr(rec.image_url, rec.image) ? resolveImageUrl(pickStr(rec.image_url, rec.image) as string) : primaryImageUrl(product?.images),
  };
}

function coercePaymentMethod(raw: unknown): PaymentMethod | undefined {
  const key = pickStr(raw)?.toLowerCase();
  if (key && PAYMENT_METHODS.has(key as PaymentMethod)) return key as PaymentMethod;
  return undefined;
}

function coercePaymentStatus(raw: unknown): PaymentStatus {
  const key = pickStr(raw)?.toLowerCase();
  if (key && PAYMENT_STATUSES.has(key as PaymentStatus)) return key as PaymentStatus;
  return "pending";
}

function coerceOrderStatus(raw: unknown): OrderStatus {
  const key = pickStr(raw)?.toLowerCase();
  if (key && ORDER_STATUSES.has(key as OrderStatus)) return key as OrderStatus;
  return "pending";
}

export function mapSellerOrderRow(row: unknown): Order {
  const rec = asRecord(row) ?? {};
  const ship = coerceAddress(rec.shipping_address) ?? coerceAddress(rec.address);
  const itemsRaw = Array.isArray(rec.items)
    ? rec.items
    : Array.isArray(rec.order_items)
      ? rec.order_items
      : [];
  const shipping = ship
    ? {
        full_name: pickStr(ship.full_name, ship.name) ?? "",
        phone: pickStr(ship.phone) ?? "",
        line1: pickStr(ship.line1, ship.address_line1) ?? "",
        line2: pickStr(ship.line2, ship.address_line2) ?? undefined,
        city: pickStr(ship.city, ship.town) ?? "",
        state: pickStr(ship.state, ship.province) ?? "",
        postal_code: pickStr(ship.postal_code, ship.zip) ?? "",
        country: pickStr(ship.country) ?? "",
      }
    : undefined;
  return {
    id: pickStr(rec.id) ?? "",
    order_number: pickStr(rec.order_number) ?? "",
    user_id: pickStr(rec.user_id) ?? "",
    subtotal: Number(rec.subtotal ?? 0) || 0,
    discount: Number(rec.discount ?? 0) || 0,
    shipping_fee: Number(rec.shipping_fee ?? 0) || 0,
    tax: Number(rec.tax ?? 0) || 0,
    total: Number(rec.total ?? 0) || 0,
    currency: pickStr(rec.currency) ?? "LKR",
    status: coerceOrderStatus(rec.status),
    payment_status: coercePaymentStatus(rec.payment_status),
    payment_method: coercePaymentMethod(rec.payment_method),
    notes: pickStr(rec.notes) ?? undefined,
    delivered_at: pickStr(rec.delivered_at) ?? null,
    placed_at: pickStr(rec.placed_at, rec.created_at) ?? new Date().toISOString(),
    items: itemsRaw.map(mapLineItem),
    shipping_address: shipping,
  };
}

export function filterSellerOrders(
  orders: Order[],
  opts: { status?: string; search?: string },
): Order[] {
  const status = (opts.status ?? "all").trim().toLowerCase();
  const needle = (opts.search ?? "").trim().toLowerCase();
  return orders.filter((order) => {
    if (status && status !== "all" && order.status !== status) return false;
    if (!needle) return true;
    const ship = readShippingContact(order);
    const hay = [
      order.order_number,
      ship.name,
      ship.place,
      ...(order.items ?? []).map((item) => item.product_name),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(needle);
  });
}

export function countOrdersByStatus(orders: Order[]): Record<string, number> {
  const out: Record<string, number> = { all: orders.length };
  for (const order of orders) {
    out[order.status] = (out[order.status] ?? 0) + 1;
  }
  return out;
}
