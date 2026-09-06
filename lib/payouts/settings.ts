import type { PayoutSettings } from "@/lib/api/backend";

const PLACEHOLDER_BANK_NAMES = new Set([
  "grandfathered bank",
  "test bank",
  "dummy bank",
  "n/a",
  "na",
  "none",
  "-",
]);

const METHODS = new Set<NonNullable<PayoutSettings["method"]>>([
  "bank",
  "upi",
  "paypal",
  "stripe_connect",
]);

const SCHEDULES = new Set<NonNullable<PayoutSettings["schedule"]>>([
  "daily",
  "weekly",
  "biweekly",
  "monthly",
]);

function pickStr(...vals: unknown[]): string | null {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function isPlaceholderBankName(value: string | null): boolean {
  if (!value) return true;
  return PLACEHOLDER_BANK_NAMES.has(value.toLowerCase());
}

export function normalizeAccountLast4(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length < 4) return digits.length ? digits : null;
  const last4 = digits.slice(-4);
  if (/^0+$/.test(last4)) return null;
  return last4;
}

export function coercePayoutSettings(row: Record<string, unknown> | PayoutSettings | null | undefined): PayoutSettings {
  if (!row) return {};
  const rec = row as Record<string, unknown>;
  const methodRaw = pickStr(rec.method);
  const scheduleRaw = pickStr(rec.schedule);
  const method = methodRaw && METHODS.has(methodRaw as NonNullable<PayoutSettings["method"]>)
    ? (methodRaw as NonNullable<PayoutSettings["method"]>)
    : undefined;
  const schedule = scheduleRaw && SCHEDULES.has(scheduleRaw as NonNullable<PayoutSettings["schedule"]>)
    ? (scheduleRaw as NonNullable<PayoutSettings["schedule"]>)
    : undefined;
  const bankName = pickStr(rec.bank_name, rec.bank);
  const last4 = normalizeAccountLast4(
    pickStr(rec.account_number_last4, rec.last4, rec.account_last4, rec.account_number),
  );
  return {
    id: pickStr(rec.id) ?? undefined,
    store_id: pickStr(rec.store_id) ?? undefined,
    method,
    schedule,
    bank_name: isPlaceholderBankName(bankName) ? null : bankName,
    account_name: pickStr(rec.account_name, rec.account_holder),
    account_number_last4: last4,
    ifsc: pickStr(rec.ifsc, rec.branch, rec.sort_code, rec.bank_code),
    upi: pickStr(rec.upi, rec.upi_id),
    paypal: pickStr(rec.paypal, rec.paypal_email),
    stripe_account_id: pickStr(rec.stripe_account_id, rec.stripe_account),
    tax_form_submitted: typeof rec.tax_form_submitted === "boolean" ? rec.tax_form_submitted : undefined,
  };
}

export function mergePayoutSettings(
  settings: Record<string, unknown> | PayoutSettings | null | undefined,
  fromList: PayoutSettings | null | undefined,
): PayoutSettings {
  const a = coercePayoutSettings(fromList);
  const b = coercePayoutSettings(settings);
  return {
    ...a,
    ...b,
    bank_name: b.bank_name ?? a.bank_name ?? null,
    account_name: b.account_name ?? a.account_name ?? null,
    account_number_last4: b.account_number_last4 ?? a.account_number_last4 ?? null,
    ifsc: b.ifsc ?? a.ifsc ?? null,
    upi: b.upi ?? a.upi ?? null,
    paypal: b.paypal ?? a.paypal ?? null,
    stripe_account_id: b.stripe_account_id ?? a.stripe_account_id ?? null,
    tax_form_submitted: b.tax_form_submitted ?? a.tax_form_submitted,
    method: b.method ?? a.method,
    schedule: b.schedule ?? a.schedule,
  };
}

export function validatePayoutDraft(draft: PayoutSettings): string | null {
  const method = draft.method;
  if (!method) return "Choose how you want to get paid.";
  if (method === "bank") {
    if (!draft.bank_name?.trim()) return "Enter the bank name.";
    if (isPlaceholderBankName(draft.bank_name.trim())) return "Enter your real bank name.";
    if (!draft.account_name?.trim()) return "Enter the account holder name.";
    const last4 = normalizeAccountLast4(draft.account_number_last4);
    if (!last4 || !/^\d{4}$/.test(last4)) return "Last 4 digits must be 4 numbers.";
  }
  if (method === "upi") {
    const upi = draft.upi?.trim() ?? "";
    if (!upi.includes("@")) return "Enter a valid UPI ID (name@bank).";
  }
  if (method === "paypal") {
    const email = draft.paypal?.trim() ?? "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Enter a valid PayPal email.";
  }
  return null;
}

/** Same Sri Lankan bank list as store/src/app/seller/payouts/page.tsx */
export const POPULAR_BANKS = [
  "Commercial Bank of Ceylon",
  "Sampath Bank",
  "Hatton National Bank (HNB)",
  "Nations Trust Bank",
  "Bank of Ceylon",
  "Seylan Bank",
] as const;

export const WEBSITE_PAYOUT_DEFAULTS: PayoutSettings = {
  method: "bank",
  schedule: "weekly",
  bank_name: "Commercial Bank of Ceylon",
  tax_form_submitted: true,
};

const KYC_BLOCK_CODES = ["kyc_required", "kyc_pending", "kyc_rejected"] as const;

/** Stripe Connect / withdraw errors that match store/src/app/seller/payouts. */
export function isPayoutKycError(error: string | null | undefined): boolean {
  if (!error) return false;
  const hay = error.toLowerCase();
  return KYC_BLOCK_CODES.some((code) => hay.includes(code));
}

export function payoutKycUserMessage(error: string): string {
  return error.replace(/^kyc_(required|pending|rejected):\s*/i, "");
}

export function withPayoutDefaults(row: PayoutSettings): PayoutSettings {
  return {
    ...WEBSITE_PAYOUT_DEFAULTS,
    ...row,
    method: row.method ?? "bank",
    schedule: row.schedule ?? "weekly",
    bank_name: row.bank_name ?? WEBSITE_PAYOUT_DEFAULTS.bank_name,
    tax_form_submitted: row.tax_form_submitted ?? true,
  };
}

export function toPayoutPayload(draft: PayoutSettings): Partial<PayoutSettings> {
  const method = draft.method;
  const payload: Partial<PayoutSettings> = {
    method,
    schedule: draft.schedule ?? "weekly",
    tax_form_submitted: draft.tax_form_submitted ?? true,
  };
  if (method === "bank") {
    payload.bank_name = draft.bank_name?.trim() || null;
    payload.account_name = draft.account_name?.trim() || null;
    payload.account_number_last4 = normalizeAccountLast4(draft.account_number_last4);
    payload.ifsc = draft.ifsc?.trim()?.toUpperCase() || null;
  } else if (method === "upi") {
    payload.upi = draft.upi?.trim() || null;
  } else if (method === "paypal") {
    payload.paypal = draft.paypal?.trim() || null;
  }
  return payload;
}
