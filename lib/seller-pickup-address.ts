/**
 * A store's courier pickup point (stores.delivery_* — migration 0154) counts
 * as added once it has a street line and a city. The seller dashboard keeps
 * prompting until then. Mirrors store/src/lib/seller-pickup-address.ts.
 */
export type PickupAddressFields = {
  delivery_address_line1?: string | null;
  delivery_city?: string | null;
};

export function hasPickupAddress(store: PickupAddressFields | null | undefined): boolean {
  return !!(store?.delivery_address_line1?.trim() && store?.delivery_city?.trim());
}

export const PICKUP_ADDRESS_ROUTE = "/(seller)/settings/pickup-address";
