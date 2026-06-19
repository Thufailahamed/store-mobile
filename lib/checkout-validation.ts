/**
 * Checkout-side required-field validation for the delivery address.
 * Mirrors the AddressFormSheet rules so the checkout flow can never accept
 * an address that the dedicated form would have rejected.
 *
 * - full_name, phone, line1, city, state, postal_code are all required.
 * - line2 is intentionally optional.
 * - country defaults to "Sri Lanka" server-side; not enforced here.
 *
 * Phone rules: at least 7 digits, only digits / `+` / spaces / dashes /
 * parentheses allowed. The strict E.164 normaliser lives next to the
 * address form; this check just blocks "abc" / "..." from being accepted
 * as a phone number.
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
  | { ok: false; missing: string[]; invalid: string[] };

const PHONE_DIGIT_MIN = 7;
const PHONE_CHARS_ALLOWED = /^[0-9+\-\s()]+$/;

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

  const invalid: string[] = [];
  const phone = fields.phone?.trim() ?? "";
  if (phone) {
    const digits = phone.replace(/\D/g, "");
    if (!PHONE_CHARS_ALLOWED.test(phone) || digits.length < PHONE_DIGIT_MIN) {
      invalid.push("phone");
    }
  }

  if (missing.length === 0 && invalid.length === 0) return { ok: true };
  return { ok: false, missing, invalid };
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

/** Stable label for an invalid (present-but-malformed) field key. */
export function checkoutAddressInvalidLabel(field: string): string {
  switch (field) {
    case "phone":
      return "phone number looks invalid";
    default:
      return `${checkoutAddressFieldLabel(field)} looks invalid`;
  }
}
