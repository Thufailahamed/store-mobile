import { supabase } from "@/lib/supabase/client";

export type DeliveryHomeRoute = "/(delivery)" | "/(delivery-company)";

export type CompanyMembershipRole = "owner" | "manager" | "driver" | null;

/** Where a logistics user should land: driver app vs company HQ. */
export async function resolveDeliveryHomeRoute(
  userId: string,
  platformRole: string | null | undefined,
): Promise<DeliveryHomeRoute> {
  if (platformRole === "delivery") return "/(delivery)";

  if (platformRole !== "delivery_company") {
    return "/(delivery)";
  }

  const { data: owned } = await supabase
    .from("delivery_companies")
    .select("id")
    .eq("owner_id", userId)
    .maybeSingle();
  if (owned) return "/(delivery-company)";

  const { data: member } = await supabase
    .from("delivery_company_members")
    .select("company_role")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (!member) return "/(delivery-company)";

  const role = (member as { company_role: string }).company_role;
  if (role === "driver") return "/(delivery)";
  return "/(delivery-company)";
}

export async function getCompanyMembershipRole(userId: string): Promise<CompanyMembershipRole> {
  const { data: owned } = await supabase
    .from("delivery_companies")
    .select("id")
    .eq("owner_id", userId)
    .maybeSingle();
  if (owned) return "owner";

  const { data: member } = await supabase
    .from("delivery_company_members")
    .select("company_role")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (!member) return null;
  const role = (member as { company_role: string }).company_role;
  if (role === "owner" || role === "manager" || role === "driver") return role;
  return null;
}

export function isCompanyOperator(role: CompanyMembershipRole): boolean {
  return role === "owner" || role === "manager";
}
