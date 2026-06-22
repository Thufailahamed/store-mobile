import type { Store } from "@/lib/types";

export interface SellerPayoutCompliance {
  bank_name?: string | null;
  account_name?: string | null;
  account_number_last4?: string | null;
  tax_form_submitted?: boolean;
}

export type ComplianceDocType = "business_registration" | "tax_certificate";

export interface SellerComplianceDocument {
  doc_type: ComplianceDocType | string;
  file_url: string;
  file_name?: string | null;
  status?: "pending" | "approved" | "rejected" | string;
}

export const OPTIONAL_COMPLIANCE_DOC_TYPES: { type: ComplianceDocType; label: string }[] = [
  { type: "business_registration", label: "business registration document" },
  { type: "tax_certificate", label: "tax certificate" },
];

/** @deprecated Use OPTIONAL_COMPLIANCE_DOC_TYPES */
export const REQUIRED_COMPLIANCE_DOC_TYPES = OPTIONAL_COMPLIANCE_DOC_TYPES;

type StoreLike = Partial<Store> & Record<string, unknown>;

export interface SellerAccessState {
  hasStore: boolean;
  status: string | null;
  isApproved: boolean;
  isPendingReview: boolean;
  isRejected: boolean;
  isSuspended: boolean;
  missingComplianceFields: string[];
  canAccessSellerTools: boolean;
  lockReason: string | null;
}

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

export function isComplianceDocumentApproved(
  doc: SellerComplianceDocument | undefined
): boolean {
  return Boolean(doc?.file_url?.trim()) && String(doc?.status ?? "").toLowerCase() === "approved";
}

/** Blocking gaps — none; compliance never gates seller tools or catalog. */
export function collectComplianceGaps(
  _store?: StoreLike | null | undefined,
  _payout?: SellerPayoutCompliance | null,
  _docs?: SellerComplianceDocument[] | null
): string[] {
  return [];
}

/** Informational gaps for admin/onboarding — all fields are optional. */
export function collectOptionalComplianceGaps(
  store: StoreLike | null | undefined,
  payout?: SellerPayoutCompliance | null,
  _docs?: SellerComplianceDocument[] | null
): string[] {
  if (!store) return [];
  return BANK_FIELDS.filter((field) => !hasValue(payout?.[field.key])).map((field) => field.label);
}

export function getSellerAccessState(
  store: StoreLike | null,
  payout?: SellerPayoutCompliance | null,
  docs?: SellerComplianceDocument[] | null
): SellerAccessState {
  if (!store) {
    return {
      hasStore: false,
      status: null,
      isApproved: false,
      isPendingReview: false,
      isRejected: false,
      isSuspended: false,
      missingComplianceFields: [],
      canAccessSellerTools: false,
      lockReason: "Create your store profile to continue.",
    };
  }

  const status = String(store.status ?? "").toLowerCase();
  const isApproved = status === "approved" || status === "active";
  const isPendingReview = status === "pending" || status === "draft";
  const isRejected = status === "rejected";
  const isSuspended = status === "suspended" || status === "banned";

  const missingComplianceFields = collectOptionalComplianceGaps(store, payout, docs);

  const canAccessSellerTools = isApproved && !isRejected && !isSuspended;

  let lockReason: string | null = null;
  if (isSuspended) {
    lockReason = "Your seller account is suspended. Contact support to reactivate.";
  } else if (isRejected) {
    lockReason = "Your store application was rejected. Contact support if you believe this is an error.";
  } else if (isPendingReview) {
    lockReason = "Your store is pending admin approval.";
  } else if (!isApproved) {
    lockReason = "Your store is not active yet.";
  }

  return {
    hasStore: true,
    status: status || null,
    isApproved,
    isPendingReview,
    isRejected,
    isSuspended,
    missingComplianceFields,
    canAccessSellerTools,
    lockReason,
  };
}

export function getSellerComplianceGaps(
  store: StoreLike | null,
  payout?: SellerPayoutCompliance | null,
  docs?: SellerComplianceDocument[] | null
): string[] {
  if (!store) return [];
  return collectOptionalComplianceGaps({ ...store, status: "approved" }, payout, docs);
}
