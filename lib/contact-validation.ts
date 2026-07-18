/**
 * Single source of truth for phone + email format validation across the
 * mobile checkout, address form, auth flows, and delivery-company invite.
 * Mirrors `store/src/lib/contact-validation.ts` byte-for-byte so the web
 * and mobile clients reject the same junk inputs.
 *
 * Phone rules (intentionally not strict E.164 here):
 *   - At least `PHONE_DIGIT_MIN` digits after stripping non-digits.
 *   - Only digits, `+`, spaces, dashes, and parentheses are allowed.
 *   - Stops "abc", "...", "a@b" etc. without rejecting
 *     "077 123 4567" / "+94 77 123 4567" / "+1 (415) 555-0100".
 *
 * Email rules (RFC-5321 pragmatic subset):
 *   - Single `@`, at least one char on each side.
 *   - Domain has at least one `.` with a non-empty TLD.
 *   - No whitespace anywhere.
 */
export const PHONE_DIGIT_MIN = 7;

/** Minimum password length enforced across auth flows (signup, reset). */
export const PASSWORD_MIN_LENGTH = 8;
export const PHONE_CHARS_ALLOWED = /^[0-9+\-\s()]+$/;

/** Pragmatic email regex — `something@something.tld`, no whitespace. */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidPhone(value: string | null | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (!PHONE_CHARS_ALLOWED.test(trimmed)) return false;
  const digits = trimmed.replace(/\D/g, "");
  return digits.length >= PHONE_DIGIT_MIN;
}

export function isValidEmail(value: string | null | undefined): boolean {
  if (!value) return false;
  return EMAIL_REGEX.test(value.trim());
}

/** Normalize to E.164 (+94…) — mirrors backend + web store. */
export function normalizePhoneE164(phone: string): string {
  let cleaned = phone.replace(/[^\d+]/g, "");
  if (!cleaned.startsWith("+")) {
    if (cleaned.startsWith("94")) {
      cleaned = `+${cleaned}`;
    } else if (cleaned.startsWith("0")) {
      cleaned = `+94${cleaned.slice(1)}`;
    } else {
      cleaned = `+94${cleaned}`;
    }
  }
  return cleaned;
}