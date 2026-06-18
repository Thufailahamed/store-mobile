import {
  getDeliveryCompanyAccessState,
  type DeliveryCompanyAccessState,
} from "@/lib/delivery-company-access";
import { getDeliveryCompanyMe, type DeliveryCompany, type DcApiResult } from "@/lib/api/delivery-company-api";

type ServerAccess = Partial<DeliveryCompanyAccessState> & {
  reason?: string | null;
};

export function normalizeDeliveryCompanyAccess(
  access: ServerAccess | null | undefined,
  company: DeliveryCompany | null | undefined
): DeliveryCompanyAccessState {
  if (access && typeof access.canUseCompanyTools === "boolean") {
    return {
      hasCompany: access.hasCompany ?? !!company,
      status: access.status ?? company?.status ?? null,
      isActive: access.isActive ?? company?.status === "active",
      isPendingReview: access.isPendingReview ?? company?.status === "pending",
      isRejected: access.isRejected ?? company?.status === "rejected",
      isSuspended: access.isSuspended ?? company?.status === "suspended",
      canUseCompanyTools: access.canUseCompanyTools,
      canSetupCompany: access.canSetupCompany ?? false,
      lockReason: access.lockReason ?? access.reason ?? null,
    };
  }
  return getDeliveryCompanyAccessState(company);
}

async function loadAccessContext(): Promise<
  DcApiResult<{ company: DeliveryCompany; access: DeliveryCompanyAccessState }>
> {
  const me = await getDeliveryCompanyMe();
  if (!me.ok) return me;
  return {
    ok: true,
    data: {
      company: me.data.company,
      access: normalizeDeliveryCompanyAccess(
        (me.data as { access?: ServerAccess }).access,
        me.data.company
      ),
    },
  };
}

export async function assertDeliveryCompanySetup(): Promise<DcApiResult<DeliveryCompany>> {
  const ctx = await loadAccessContext();
  if (!ctx.ok) return ctx;
  if (!ctx.data.access.canSetupCompany) {
    return { ok: false, error: ctx.data.access.lockReason ?? "Delivery company cannot be modified." };
  }
  return { ok: true, data: ctx.data.company };
}

export async function assertDeliveryCompanyOperations(): Promise<DcApiResult<DeliveryCompany>> {
  const ctx = await loadAccessContext();
  if (!ctx.ok) return ctx;
  if (!ctx.data.access.canUseCompanyTools) {
    return { ok: false, error: ctx.data.access.lockReason ?? "Delivery company is not active." };
  }
  return { ok: true, data: ctx.data.company };
}
