import type { CartItem } from "@/lib/stores/cart-store";
import { buildCartLineKeyFromItem } from "@/lib/cart-line-key";

export type CartSyncResult = { ok: true } | { ok: false; error: string };

type RemoteCartRow = {
  id: string;
  product_id: string;
  variant_id: string | null;
  store_id: string;
  quantity: number;
  unit_price: number;
};

export function cartLineKeyFromRemote(row: Pick<RemoteCartRow, "store_id" | "product_id" | "variant_id">): string {
  return buildCartLineKeyFromItem({
    storeId: row.store_id,
    productId: row.product_id,
    variantId: row.variant_id,
  });
}

export function cartLineKeyFromLocal(item: CartItem): string {
  return buildCartLineKeyFromItem(item);
}

export type CartSyncPlan = {
  toDelete: RemoteCartRow[];
  toInsert: CartItem[];
  toUpdate: Array<{ id: string; quantity: number; unit_price: number }>;
};

export function planCartSync(localItems: CartItem[], remoteRows: RemoteCartRow[]): CartSyncPlan {
  const localByKey = new Map(localItems.map((item) => [cartLineKeyFromLocal(item), item]));
  const remoteByKey = new Map(remoteRows.map((row) => [cartLineKeyFromRemote(row), row]));

  const toDelete = remoteRows.filter((row) => !localByKey.has(cartLineKeyFromRemote(row)));
  const toInsert = localItems.filter((item) => !remoteByKey.has(cartLineKeyFromLocal(item)));
  const toUpdate: CartSyncPlan["toUpdate"] = [];

  for (const item of localItems) {
    const remote = remoteByKey.get(cartLineKeyFromLocal(item));
    if (!remote) continue;
    if (remote.quantity !== item.quantity || Number(remote.unit_price) !== item.price) {
      toUpdate.push({
        id: remote.id,
        quantity: item.quantity,
        unit_price: item.price,
      });
    }
  }

  return { toDelete, toInsert, toUpdate };
}
