/**
 * Driver self-service API wrappers.
 * Reuses existing /api/delivery-company/drivers endpoint (admin-scoped, but a
 * driver is also a member of the company so they can list their own row).
 * No new server routes needed.
 */

import {
  getDeliveryCompanyDrivers,
  getDeliveryCompanyMe,
  updateDriverMember,
} from "@/lib/api/delivery-company-api";
import { hasStoreApi } from "@/lib/api/delivery-api";
import { supabase } from "@/lib/supabase/client";
import type { DriverProfile } from "@/lib/types";

export type ProfilePatch = {
  capacity_max?: number;
  driver_type?: "pickup" | "last_mile" | "both";
  is_active?: boolean;
};

/**
 * Fetch the signed-in driver's own member row.
 * Falls back to direct Supabase when the store API is not configured
 * (dev / preview) so screens still work.
 */
export async function getDriverSelf(): Promise<
  { ok: true; data: DriverProfile } | { ok: false; error: string }
> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { ok: false, error: "Not signed in" };

  // Try store API first (richer shape + company context).
  if (hasStoreApi()) {
    const [me, drivers] = await Promise.all([
      getDeliveryCompanyMe(),
      getDeliveryCompanyDrivers(),
    ]);
    if (me.ok && drivers.ok) {
      const self = drivers.data.members.find((m) => m.user_id === userId);
      if (!self) return { ok: false, error: "No driver record found" };
      return {
        ok: true,
        data: {
          member_id: self.id,
          user_id: self.user_id,
          full_name: self.user?.full_name ?? null,
          email: self.user?.email ?? null,
          phone: self.user?.phone ?? null,
          avatar_url: self.user?.avatar_url ?? null,
          company_role: (self.company_role as DriverProfile["company_role"]) ?? "driver",
          driver_type: (self.driver_type ?? "both") as DriverProfile["driver_type"],
          vehicle_type: (self as { vehicle_type?: string | null }).vehicle_type ?? null,
          capacity_max: self.capacity_max ?? 10,
          is_active: self.is_active ?? true,
          joined_at: null,
          last_known_lat: null,
          last_known_lng: null,
          last_ping_at: null,
          serviceable_postal_codes: [],
          home_warehouse_id: null,
          home_warehouse: self.home_warehouse ?? null,
          company: {
            id: me.data.company.id,
            name: me.data.company.name,
            slug: me.data.company.slug,
            status: me.data.company.status,
          },
        },
      };
    }
  }

  // Fallback: query Supabase directly. RLS allows self-row read for members.
  const { data: member, error: mErr } = await supabase
    .from("delivery_company_members")
    .select(
      "id, user_id, company_role, driver_type, capacity_max, is_active, home_warehouse_id, home_warehouse:warehouses(id,name)",
    )
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();
  if (mErr) return { ok: false, error: mErr.message };
  if (!member) return { ok: false, error: "No driver record found" };

  const { data: user } = await supabase
    .from("users")
    .select("full_name, email, phone, avatar_url")
    .eq("id", userId)
    .maybeSingle();

  const m = member as {
    id: string;
    company_role?: string;
    driver_type?: string;
    capacity_max?: number;
    is_active?: boolean;
    home_warehouse_id?: string | null;
    home_warehouse?: { id: string; name: string } | { id: string; name: string }[] | null;
  };
  const wh = Array.isArray(m.home_warehouse) ? m.home_warehouse[0] : m.home_warehouse;

  return {
    ok: true,
    data: {
      member_id: m.id,
      user_id: userId,
      full_name: (user as { full_name?: string | null } | null)?.full_name ?? null,
      email: (user as { email?: string | null } | null)?.email ?? null,
      phone: (user as { phone?: string | null } | null)?.phone ?? null,
      avatar_url: (user as { avatar_url?: string | null } | null)?.avatar_url ?? null,
      company_role: (m.company_role ?? "driver") as DriverProfile["company_role"],
      driver_type: (m.driver_type ?? "both") as DriverProfile["driver_type"],
      vehicle_type: null,
      capacity_max: m.capacity_max ?? 10,
      is_active: m.is_active ?? true,
      joined_at: null,
      last_known_lat: null,
      last_known_lng: null,
      last_ping_at: null,
      serviceable_postal_codes: [],
      home_warehouse_id: m.home_warehouse_id ?? null,
      home_warehouse: wh ?? null,
      company: null,
    },
  };
}

export async function updateDriverSelf(
  patch: ProfilePatch,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const self = await getDriverSelf();
  if (!self.ok) return self;
  if (!hasStoreApi()) return { ok: false, error: "Store API not configured" };
  const res = await updateDriverMember(self.data.member_id, patch);
  if (!res.ok) return res;
  return { ok: true };
}
