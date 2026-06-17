import type { Store } from "@/lib/types";

export interface SellerPayoutCompliance {
  bank_name?: string | null;
  account_name?: string | null;
  account_number_last4?: string | null;
  tax_form_submitted?: boolean;
}

type StoreLike = Partial<Store> & Record<string, unknown>;

export interface SellerAccessState {
  hasStore: boolean;
  status: string | null;
  isApproved: boolean;
  isPendingReview: boolean;
  isSuspended: boolean;
  missingComplianceFields: string[];
  canAccessSellerTools: boolean;
  lockReason: string | null;
}

const STORE_FIELDS: { key: string; label: string }[] = [
  { key: "legal_name", label: "legal name" },
  { key: "tax_id", label: "tax ID" },
];

const BANK_FIELDS: { key: keyof SellerPayoutCompliance; label: string }[] = [
  { key: "bank_name", label: "bank name" },
  { key: "account_name", label: "bank account holder" },
  { key: "account_number_last4", label: "bank account details" },
];

function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as object).length > 0;
  return true;
}

export function getSellerAccessState(
  store: StoreLike | null,
  payout?: SellerPayoutCompliance | null
): SellerAccessState {
  if (!store) {
    return {
      hasStore: false,
      status: null,
      isApproved: false,
      isPendingReview: false,
      isSuspended: false,
      missingComplianceFields: [],
      canAccessSellerTools: false,
      lockReason: "Create your store profile to continue.",
    };
  }

  const status = String(store.status ?? "").toLowerCase();
  const isApproved = status === "approved" || status === "active";
  const isPendingReview = status === "pending" || status === "draft";
  const isSuspended = status === "rejected" || status === "suspended" || status === "banned";

  const missingComplianceFields = [
    ...STORE_FIELDS.filter((field) => !hasValue(store[field.key])).map((field) => field.label),
    ...BANK_FIELDS.filter((field) => !hasValue(payout?.[field.key])).map((field) => field.label),
  ];

  if (!hasValue(payout?.tax_form_submitted)) {
    missingComplianceFields.push("tax declaration");
  }

  const canAccessSellerTools =
    isApproved && !isSuspended && missingComplianceFields.length === 0;

  let lockReason: string | null = null;
  if (isSuspended) {
    lockReason = "Your seller account is suspended. Contact support to reactivate.";
  } else if (isPendingReview) {
    lockReason = "Your store is pending admin approval.";
  } else if (!isApproved) {
    lockReason = "Your store is not active yet.";
  } else if (missingComplianceFields.length > 0) {
    lockReason = `Complete compliance details: ${missingComplianceFields.join(", ")}.`;
  }

  return {
    hasStore: true,
    status: status || null,
    isApproved,
    isPendingReview,
    isSuspended,
    missingComplianceFields,
    canAccessSellerTools,
    lockReason,
  };
}

export function getSellerComplianceGaps(
  store: StoreLike | null,
  payout?: SellerPayoutCompliance | null
): string[] {
  if (!store) return [];
  return getSellerAccessState({ ...store, status: "approved" }, payout).missingComplianceFields;
}
