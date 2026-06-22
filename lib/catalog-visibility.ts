import { supabase } from "@/lib/supabase/client";
import type { SellerComplianceDocument, SellerPayoutCompliance } from "@/lib/seller-access";

/** Client-side operational statuses (includes legacy "active" on in-memory rows). */
export const OPERATIONAL_STORE_STATUSES = ["approved", "active"] as const;

/** Values on the stores.status Postgres enum — "active" is not a valid member. */
export const BROWSABLE_STORE_DB_STATUSES = ["approved"] as const;

export function isOperationalStoreStatus(status: string | null | undefined): boolean {
  const s = String(status ?? "").toLowerCase();
  return OPERATIONAL_STORE_STATUSES.includes(s as (typeof OPERATIONAL_STORE_STATUSES)[number]);
}

export function isSellerPortalBlockedStatus(status: string | null | undefined): boolean {
  const s = String(status ?? "").toLowerCase();
  return s === "suspended" || s === "banned";
}

type StoreComplianceRow = {
  id: string;
  status?: string | null;
  legal_name?: string | null;
  tax_id?: string | null;
};

type CatalogRow = {
  store_id?: string | null;
  brand_id?: string | null;
  store?: { status?: string | null; id?: string } | null;
  brand?: { status?: string | null; id?: string } | null;
  status?: string;
  is_active?: boolean;
};

export function isStoreCatalogVisible(
  store: StoreComplianceRow,
  _payout?: SellerPayoutCompliance | null,
  _docs?: SellerComplianceDocument[] | null
): boolean {
  return isOperationalStoreStatus(store.status);
}

/** Approved/active stores — used for home, search, and product browse rails. */
export async function getBrowsableStoreIds(): Promise<Set<string>> {
  const { data: stores } = await supabase
    .from("stores")
    .select("id")
    .in("status", [...BROWSABLE_STORE_DB_STATUSES]);
  return new Set((stores ?? []).map((s) => s.id));
}

/** Approved/active stores — used at cart/checkout. */
export async function getCatalogVisibleStoreIds(): Promise<Set<string>> {
  const { data: stores } = await supabase
    .from("stores")
    .select("id, status")
    .in("status", [...BROWSABLE_STORE_DB_STATUSES]);

  return new Set(
    ((stores ?? []) as StoreComplianceRow[])
      .filter((store) => isStoreCatalogVisible(store))
      .map((store) => store.id),
  );
}

/** @deprecated Use getBrowsableStoreIds */
export async function getOperationalStoreIds(): Promise<string[]> {
  return [...(await getBrowsableStoreIds())];
}

/** True when a product may appear in browse/search (pass getBrowsableStoreIds). */
export function isPublicCatalogProduct(
  row: CatalogRow | null | undefined,
  catalogVisibleStoreIds?: Set<string>
): boolean {
  if (!row) return false;
  if (row.status && row.status !== "active") return false;
  if (row.is_active === false) return false;

  if (row.store_id || row.store?.id) {
    const storeId = row.store_id ?? row.store?.id;
    if (catalogVisibleStoreIds && storeId) {
      return catalogVisibleStoreIds.has(storeId);
    }
    return isOperationalStoreStatus(row.store?.status);
  }
  if (row.brand_id || row.brand?.status != null) {
    return String(row.brand?.status ?? "").toLowerCase() === "approved";
  }
  return false;
}
