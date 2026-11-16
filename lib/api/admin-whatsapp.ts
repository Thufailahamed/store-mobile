/**
 * Admin — WhatsApp orders for foreign-sourced dresses.
 * Mirrors store-backend/src/modules/admin/whatsapp-orders.ts and the web
 * page store/src/app/admin/whatsapp-orders/page.tsx.
 */
import { fetchJson, type ApiResult } from "./_fetch";

export type WaVariant = { id: string; sku: string | null; size: string | null; color: string | null; price: number | null; is_active: boolean | null };
export type WaProduct = {
  id: string;
  name: string;
  slug: string;
  price: number;
  currency: string;
  status: string;
  order_channel: "checkout" | "whatsapp";
  images?: { url: string; is_primary: boolean | null }[];
  variants?: WaVariant[];
  store?: { id: string; name: string } | null;
};
export type WaCustomer = { id: string; full_name: string | null; email: string | null; phone: string | null };
export type WaOrder = {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  payment_method: string | null;
  total: number;
  currency: string;
  placed_at: string;
  notes: string | null;
  metadata: { sourcing_stage?: string } | null;
  shipping_address: Record<string, string | null> | null;
  user: WaCustomer | null;
  items: { id: string; product_name: string; variant_label: string | null; quantity: number; total: number }[];
};

export const WA_STAGES = [
  { key: "confirmed", label: "Confirmed" },
  { key: "ordered_from_supplier", label: "Ordered from supplier" },
  { key: "arrived", label: "Arrived at our location" },
  { key: "checked", label: "Checked & packed" },
  { key: "shipped", label: "Sent to customer" },
  { key: "delivered", label: "Delivered" },
] as const;

const BASE = "/api/admin/whatsapp-orders";

export const listWaOrders = (status: "open" | "all"): Promise<ApiResult<{ orders: WaOrder[]; total: number }>> =>
  fetchJson(BASE, { query: { status, limit: 100 } });

export const setWaOrderStage = (
  id: string,
  body: { stage?: string; payment_status?: "paid" | "pending"; note?: string },
): Promise<ApiResult<{ order: unknown }>> => fetchJson(`${BASE}/${id}/stage`, { method: "POST", body });

export const listWaProducts = (scope: "whatsapp" | "all", search = ""): Promise<ApiResult<{ products: WaProduct[] }>> =>
  fetchJson(`${BASE}/products`, { query: { scope, search } });

export const setWaProductChannel = (id: string, order_channel: "checkout" | "whatsapp"): Promise<ApiResult<unknown>> =>
  fetchJson(`${BASE}/products/${id}`, { method: "PATCH", body: { order_channel } });

export const searchWaCustomers = (q: string): Promise<ApiResult<{ customers: WaCustomer[] }>> =>
  fetchJson(`${BASE}/customers`, { query: { q } });

export const getWaNumber = (): Promise<ApiResult<{ number: string | null }>> => fetchJson(`${BASE}/settings`);

export const setWaNumber = (number: string | null): Promise<ApiResult<{ number: string | null }>> =>
  fetchJson(`${BASE}/settings`, { method: "PUT", body: { number } });

export type CreateWaOrderInput = {
  customer: { user_id: string } | { full_name: string; phone: string; email?: string };
  items: { product_id: string; variant_id: string | null; quantity: number; unit_price: number }[];
  shipping_address: { full_name: string; phone: string; line1: string; line2?: string | null; city: string; district?: string | null; postal_code?: string | null; country?: string };
  shipping_fee: number;
  discount: number;
  payment_method: "bank_transfer" | "payhere" | "paymentslk" | "stripe";
  payment_status: "pending" | "paid";
  notes?: string | null;
};

export const createWaOrder = (
  body: CreateWaOrderInput,
): Promise<ApiResult<{ order: { id: string; order_number: string }; created_customer: boolean }>> =>
  fetchJson(BASE, { method: "POST", body });

/**
 * AI quick-analyze for admins creating a product in any store. Same seller
 * endpoint; admins pass ?store_id (getCallerStoreId honours it for admins).
 * Nothing is inserted — the draft prefills the admin create form.
 */
export const adminQuickAnalyze = (
  storeId: string,
  input: { image_url: string; extra_images?: string[]; price?: number; name?: string },
): Promise<ApiResult<import("./backend").QuickAnalyzeResult>> =>
  fetchJson("/api/seller/products/quick-analyze", {
    method: "POST",
    body: { ...input, stage: "full" },
    query: { store_id: storeId },
    timeoutMs: 70_000,
  });
