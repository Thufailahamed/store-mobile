/**
 * Checkout-side required-field validation for the delivery address.
 * Mirrors the AddressFormSheet rules so the checkout flow can never accept
 * an address that the dedicated form would have rejected.
 *
 * - full_name, phone, line1, city, state, postal_code are all required.
 * - line2 is intentionally optional.
 * - country defaults to "Sri Lanka" server-side; not enforced here.
 */
export interface CheckoutAddressFields {
  full_name?: string;
  phone?: string;
  line1?: string;
  city?: string;
  state?: string;
  postal_code?: string;
}

export type CheckoutAddressValidation =
  | { ok: true }
  | { ok: false; missing: string[] };

export function validateCheckoutAddress(
  fields: CheckoutAddressFields,
): CheckoutAddressValidation {
  const required: Array<keyof CheckoutAddressFields> = [
    "full_name",
    "phone",
    "line1",
    "city",
    "state",
    "postal_code",
  ];

  const missing = required
    .filter((key) => !fields[key] || !fields[key]!.trim())
    .map((key) => key as string);

  if (missing.length === 0) return { ok: true };
  return { ok: false, missing };
}

/** Friendly label for a missing field key. */
export function checkoutAddressFieldLabel(field: string): string {
  switch (field) {
    case "full_name":
      return "full name";
    case "line1":
      return "address";
    case "postal_code":
      return "postal code";
    default:
      return field.replace(/_/g, " ");
  }
}
