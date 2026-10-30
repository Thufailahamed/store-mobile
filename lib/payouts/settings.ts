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
  const scheduleRaw = pickStr(rec.schedule);
  const schedule = scheduleRaw && SCHEDULES.has(scheduleRaw as NonNullable<PayoutSettings["schedule"]>)
    ? (scheduleRaw as NonNullable<PayoutSettings["schedule"]>)
    : undefined;
  const bankName = pickStr(rec.bank_name, rec.bank);
  const last4 = normalizeAccountLast4(
    pickStr(rec.account_number_last4, rec.last4, rec.account_last4),
  );
  return {
    id: pickStr(rec.id) ?? undefined,
    store_id: pickStr(rec.store_id) ?? undefined,
    method: pickStr(rec.method) === "bank" ? "bank" : undefined,
    schedule,
    bank_name: isPlaceholderBankName(bankName) ? null : bankName,
    account_name: pickStr(rec.account_name, rec.account_holder),
    account_number_last4: last4,
    ifsc: pickStr(rec.ifsc, rec.branch, rec.sort_code, rec.bank_code),
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
    tax_form_submitted: b.tax_form_submitted ?? a.tax_form_submitted,
    method: "bank",
    schedule: b.schedule ?? a.schedule,
  };
}

/** Full account number is required once; after that the saved last 4 is enough. */
export function validatePayoutDraft(draft: PayoutSettings): string | null {
  if (!draft.bank_name?.trim()) return "Enter the bank name.";
  if (isPlaceholderBankName(draft.bank_name.trim())) return "Enter your real bank name.";
  if (!draft.account_name?.trim()) return "Enter the account holder name.";
  const typed = draft.account_number?.trim() ?? "";
  if (typed) {
    if (!/^\d{6,20}$/.test(typed)) return "Account number must be 6 to 20 digits.";
  } else if (!normalizeAccountLast4(draft.account_number_last4)) {
    return "Enter your full account number.";
  }
  return null;
}

export const WEBSITE_PAYOUT_DEFAULTS: PayoutSettings = {
  method: "bank",
  schedule: "weekly",
  bank_name: "Commercial Bank of Ceylon",
  tax_form_submitted: true,
};

const KYC_BLOCK_CODES = ["kyc_required", "kyc_pending", "kyc_rejected"] as const;

/** Withdraw errors from the backend KYC gate that match store/src/app/seller/payouts. */
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
    method: "bank",
    schedule: row.schedule ?? "weekly",
    bank_name: row.bank_name ?? WEBSITE_PAYOUT_DEFAULTS.bank_name,
    tax_form_submitted: row.tax_form_submitted ?? true,
  };
}

/** Sent to PATCH /api/seller/payouts. The full number is included only when typed. */
export function toPayoutPayload(draft: PayoutSettings): Partial<PayoutSettings> {
  const typed = draft.account_number?.trim();
  return {
    method: "bank",
    schedule: draft.schedule ?? "weekly",
    tax_form_submitted: draft.tax_form_submitted ?? true,
    bank_name: draft.bank_name?.trim() || null,
    account_name: draft.account_name?.trim() || null,
    ifsc: draft.ifsc?.trim()?.toUpperCase() || null,
    ...(typed ? { account_number: typed } : {}),
  };
}
