export type DeliveryCompanyAccessInput = {
  status?: string | null;
};

export interface DeliveryCompanyAccessState {
  hasCompany: boolean;
  status: string | null;
  isActive: boolean;
  isPendingReview: boolean;
  isRejected: boolean;
  isSuspended: boolean;
  canUseCompanyTools: boolean;
  canSetupCompany: boolean;
  lockReason: string | null;
}

export function isCompanyOperationalStatus(status: string | null | undefined): boolean {
  return String(status ?? "").toLowerCase() === "active";
}

export function canAutoAssignLastMileOnReceive(
  company:
    | (DeliveryCompanyAccessInput & { auto_assign_last_mile_on_receive?: boolean | null })
    | null
    | undefined
): boolean {
  return (
    isCompanyOperationalStatus(company?.status) &&
    company?.auto_assign_last_mile_on_receive === true
  );
}

export function shouldClearStoreDeliveryCompanyOnStatusChange(
  nextStatus: string | undefined | null
): boolean {
  if (!nextStatus) return false;
  const status = String(nextStatus).toLowerCase();
  return status === "suspended" || status === "rejected";
}

export function validateStoreDeliveryCompanyAssignment(
  deliveryCompanyId: string | null | undefined,
  companyStatus: string | null | undefined
): { ok: true } | { ok: false; error: string } {
  if (!deliveryCompanyId) return { ok: true };
  if (!isCompanyOperationalStatus(companyStatus)) {
    return { ok: false, error: "Only active delivery companies can be linked to stores." };
  }
  return { ok: true };
}

export function shouldApplyDeliveryCompanyOperationsGuard(role: string): boolean {
  return role === "delivery_company";
}

export type MoreMenuItemKind = "recovery" | "setup" | "operations" | "read";

export function isMoreMenuItemAccessible(
  kind: MoreMenuItemKind,
  access: Pick<DeliveryCompanyAccessState, "hasCompany" | "canSetupCompany" | "canUseCompanyTools">
): boolean {
  if (kind === "recovery" || kind === "read") return access.hasCompany;
  if (kind === "setup") return access.canSetupCompany;
  return access.canUseCompanyTools;
}

export function getDeliveryCompanyAccessState(
  company: DeliveryCompanyAccessInput | null | undefined
): DeliveryCompanyAccessState {
  if (!company) {
    return {
      hasCompany: false,
      status: null,
      isActive: false,
      isPendingReview: false,
      isRejected: false,
      isSuspended: false,
      canUseCompanyTools: false,
      canSetupCompany: false,
      lockReason: "Create your delivery company profile to continue.",
    };
  }

  const status = String(company.status ?? "").toLowerCase();
  const isActive = status === "active";
  const isPendingReview = status === "pending";
  const isRejected = status === "rejected";
  const isSuspended = status === "suspended";

  const canUseCompanyTools = isActive;
  const canSetupCompany = isActive || isPendingReview;

  let lockReason: string | null = null;
  if (isSuspended) {
    lockReason = "Your delivery company is suspended. Contact support to reactivate.";
  } else if (isRejected) {
    lockReason =
      "Your delivery company application was rejected. Contact support if you believe this is an error.";
  } else if (isPendingReview) {
    lockReason =
      "Your company is pending admin approval. Assignments and order intake are locked until approved.";
  } else if (!isActive) {
    lockReason = "Your delivery company is not active yet.";
  }

  return {
    hasCompany: true,
    status: status || null,
    isActive,
    isPendingReview,
    isRejected,
    isSuspended,
    canUseCompanyTools,
    canSetupCompany,
    lockReason,
  };
}

export const DELIVERY_COMPANY_RECOVERY_SEGMENTS = new Set([
  "onboarding",
  "accept",
  "settings",
]);

export const DELIVERY_COMPANY_SETUP_SEGMENTS = new Set([
  "drivers",
  "warehouses",
  "team",
  "more",
]);

export function isDeliveryCompanyRecoveryRoute(segments: string[]): boolean {
  return segments.some((s) => DELIVERY_COMPANY_RECOVERY_SEGMENTS.has(s));
}

export function isDeliveryCompanySetupRoute(segments: string[]): boolean {
  return segments.some((s) => DELIVERY_COMPANY_SETUP_SEGMENTS.has(s));
}

export function isDeliveryCompanyAccessibleRoute(
  segments: string[],
  access: Pick<DeliveryCompanyAccessState, "canSetupCompany" | "canUseCompanyTools">
): boolean {
  if (access.canUseCompanyTools) return true;
  if (isDeliveryCompanyRecoveryRoute(segments)) return true;
  if (access.canSetupCompany && isDeliveryCompanySetupRoute(segments)) return true;
  return false;
}
