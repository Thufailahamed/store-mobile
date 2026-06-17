import { supabase } from "@/lib/supabase/client";
import {
  getSellerComplianceGaps,
  type SellerComplianceDocument,
  type SellerPayoutCompliance,
} from "@/lib/seller-access";

/** Store statuses that may sell on the public marketplace. */
export const OPERATIONAL_STORE_STATUSES = ["approved", "active"] as const;

export function isOperationalStoreStatus(status: string | null | undefined): boolean {
  const s = String(status ?? "").toLowerCase();
  return OPERATIONAL_STORE_STATUSES.includes(s as (typeof OPERATIONAL_STORE_STATUSES)[number]);
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
  payout?: SellerPayoutCompliance | null,
  docs?: SellerComplianceDocument[] | null
): boolean {
  if (!isOperationalStoreStatus(store.status)) return false;
  return getSellerComplianceGaps(
    { ...store, status: store.status ?? undefined } as Parameters<typeof getSellerComplianceGaps>[0],
    payout ?? null,
    docs ?? []
  ).length === 0;
}

/** Operational stores with complete, approved compliance. */
export async function getCatalogVisibleStoreIds(): Promise<Set<string>> {
  const { data: stores } = await supabase
    .from("stores")
    .select("id, status, legal_name, tax_id")
    .in("status", [...OPERATIONAL_STORE_STATUSES]);

  const rows = (stores ?? []) as StoreComplianceRow[];
  if (!rows.length) return new Set();

  const ids = rows.map((s) => s.id);
  const [{ data: payouts }, { data: docs }] = await Promise.all([
    supabase
      .from("payout_settings")
      .select("store_id, bank_name, account_name, account_number_last4, tax_form_submitted")
      .in("store_id", ids),
    supabase
      .from("store_compliance_documents")
      .select("store_id, doc_type, file_url, file_name, status")
      .in("store_id", ids),
  ]);

  const payoutByStore = new Map(
    ((payouts ?? []) as (SellerPayoutCompliance & { store_id: string })[]).map((p) => [
      p.store_id,
      p,
    ])
  );
  const docsByStore = new Map<string, SellerComplianceDocument[]>();
  for (const row of (docs ?? []) as (SellerComplianceDocument & { store_id: string })[]) {
    const list = docsByStore.get(row.store_id) ?? [];
    list.push(row);
    docsByStore.set(row.store_id, list);
  }

  const visible = new Set<string>();
  for (const store of rows) {
    const payout = payoutByStore.get(store.id);
    const { store_id: _sid, ...payoutFields } = payout ?? { store_id: store.id };
    if (isStoreCatalogVisible(store, payout ? payoutFields : null, docsByStore.get(store.id) ?? [])) {
      visible.add(store.id);
    }
  }
  return visible;
}

/** @deprecated Use getCatalogVisibleStoreIds */
export async function getOperationalStoreIds(): Promise<string[]> {
  return [...(await getCatalogVisibleStoreIds())];
}

/** True when a product may appear in public browse/search. */
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
