import { supabase } from "@/lib/supabase/client";

/** Store statuses that may sell on the public marketplace. */
export const OPERATIONAL_STORE_STATUSES = ["approved", "active"] as const;

export function isOperationalStoreStatus(status: string | null | undefined): boolean {
  const s = String(status ?? "").toLowerCase();
  return OPERATIONAL_STORE_STATUSES.includes(s as (typeof OPERATIONAL_STORE_STATUSES)[number]);
}

type CatalogRow = {
  store_id?: string | null;
  brand_id?: string | null;
  store?: { status?: string | null } | null;
  brand?: { status?: string | null } | null;
};

/** True when a product may appear in public browse/search. */
export function isPublicCatalogProduct(row: CatalogRow | null | undefined): boolean {
  if (!row) return false;
  if (row.store_id || row.store?.status != null) {
    return isOperationalStoreStatus(row.store?.status);
  }
  if (row.brand_id || row.brand?.status != null) {
    return String(row.brand?.status ?? "").toLowerCase() === "approved";
  }
  return false;
}

export async function getOperationalStoreIds(): Promise<string[]> {
  const { data } = await supabase
    .from("stores")
    .select("id")
    .in("status", [...OPERATIONAL_STORE_STATUSES]);
  return (data ?? []).map((s) => s.id);
}
