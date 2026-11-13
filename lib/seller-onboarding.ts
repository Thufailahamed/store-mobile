import AsyncStorage from "@react-native-async-storage/async-storage";
import { updateSellerStore } from "@/lib/api";
import type { Store } from "@/lib/types";

/**
 * Seller onboarding (store info → branding → legal & tax) runs once after
 * sign-up. Completion is remembered per user on this device; a store that
 * already has a logo or description is treated as set up, so sellers who
 * onboarded on the web are never sent through it again.
 */
const key = (userId: string) => `vestara_seller_onboarding_done:${userId}`;

export async function hasCompletedSellerOnboarding(userId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(key(userId))) === "true";
  } catch {
    return false;
  }
}

export async function markSellerOnboardingComplete(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key(userId), "true");
  } catch {
    // non-fatal: worst case the seller sees onboarding again
  }
}

export function storeLooksSetUp(store: Pick<Store, "logo_url" | "description"> | null): boolean {
  return Boolean(store && (store.logo_url || store.description?.trim()));
}

type AccountLike = {
  phone?: string | null;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

/** Sign-up phone (+E.164) and contact email, from the auth account. */
export function accountContact(user: AccountLike | null | undefined): { phone: string | null; email: string | null } {
  if (!user) return { phone: null, email: null };
  const meta = user.user_metadata ?? {};
  const rawPhone = (typeof meta.phone === "string" && meta.phone) || user.phone || "";
  const phone = rawPhone ? (rawPhone.startsWith("+") ? rawPhone : `+${rawPhone}`) : null;
  const email = (typeof meta.email === "string" && meta.email.trim()) || user.email?.trim() || null;
  return { phone, email };
}

/**
 * Sellers give their phone + email at sign-up; copy them onto the store's
 * public contact (stores.phone / stores.email) when those are still empty,
 * so Store settings doesn't ask for them again. Returns the patch applied,
 * or null when nothing was missing.
 */
export async function seedStoreContactFromAccount(
  store: (Store & { phone?: string | null; email?: string | null }) | null,
  user: AccountLike | null | undefined,
): Promise<{ phone?: string; email?: string } | null> {
  if (!store) return null;
  const account = accountContact(user);
  const patch: { phone?: string; email?: string } = {};
  if (!(store.contact_phone || store.phone) && account.phone) patch.phone = account.phone;
  if (!(store.contact_email || store.email) && account.email) patch.email = account.email;
  if (!patch.phone && !patch.email) return null;
  const res = await updateSellerStore(store.id, patch as Partial<Store>);
  return res.ok ? patch : null;
}
