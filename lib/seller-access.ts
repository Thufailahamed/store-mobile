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

export const REQUIRED_COMPLIANCE_DOC_TYPES: { type: ComplianceDocType; label: string }[] = [
  { type: "business_registration", label: "business registration document" },
  { type: "tax_certificate", label: "tax certificate" },
];

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

export function isComplianceDocumentApproved(
  doc: SellerComplianceDocument | undefined
): boolean {
  return Boolean(doc?.file_url?.trim()) && String(doc?.status ?? "").toLowerCase() === "approved";
}

function complianceDocumentGap(
  doc: SellerComplianceDocument | undefined,
  label: string
): string | null {
  if (!doc?.file_url?.trim()) return label;
  const status = String(doc.status ?? "pending").toLowerCase();
  if (status === "rejected") return `${label} (rejected — re-upload required)`;
  if (status !== "approved") return `${label} (pending admin review)`;
  return null;
}

export function collectComplianceGaps(
  store: StoreLike | null | undefined,
  payout?: SellerPayoutCompliance | null,
  docs?: SellerComplianceDocument[] | null
): string[] {
  if (!store) return [];

  const missing: string[] = [
    ...STORE_FIELDS.filter((field) => !hasValue(store[field.key])).map((field) => field.label),
    ...BANK_FIELDS.filter((field) => !hasValue(payout?.[field.key])).map((field) => field.label),
  ];

  if (!hasValue(payout?.tax_form_submitted)) {
    missing.push("tax declaration");
  }

  const docByType = new Map((docs ?? []).map((d) => [d.doc_type, d]));
  for (const required of REQUIRED_COMPLIANCE_DOC_TYPES) {
    const gap = complianceDocumentGap(docByType.get(required.type), required.label);
    if (gap) missing.push(gap);
  }

  return missing;
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

  const missingComplianceFields = collectComplianceGaps(store, payout, docs);

  const canAccessSellerTools =
    isApproved && !isRejected && !isSuspended && missingComplianceFields.length === 0;

  let lockReason: string | null = null;
  if (isSuspended) {
    lockReason = "Your seller account is suspended. Contact support to reactivate.";
  } else if (isRejected) {
    lockReason = "Your store application was rejected. Contact support if you believe this is an error.";
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
  return collectComplianceGaps({ ...store, status: "approved" }, payout, docs);
}
