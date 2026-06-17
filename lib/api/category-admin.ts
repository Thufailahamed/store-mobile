import { supabase } from "@/lib/supabase/client";
import type { Category } from "@/lib/types";
import {
  validateCategoryDelete,
  type CategoryDeleteImpact,
  type CategoryDeleteOptions,
} from "@/lib/utils/category-admin";

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };
const ok = <T>(data: T): Result<T> => ({ ok: true, data });
const fail = (e: string): Result<never> => ({ ok: false, error: e });

export type AdminCategory = Category & {
  product_count: number;
  child_count: number;
};

async function logCategoryAudit(
  action: string,
  targetId?: string,
  diff?: Record<string, unknown>,
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("admin_audit_log").insert({
      actor_id: user.id,
      action,
      target_type: "category",
      target_id: targetId ?? null,
      diff: diff ?? null,
    });
  } catch {
    // best-effort
  }
}

function parseImpact(data: unknown): CategoryDeleteImpact {
  const row = data as Record<string, number> | null;
  return {
    productCount: Number(row?.productCount ?? 0),
    childCount: Number(row?.childCount ?? 0),
    couponCount: Number(row?.couponCount ?? 0),
  };
}

export async function getCategoryDeleteImpact(id: string): Promise<Result<CategoryDeleteImpact>> {
  try {
    const { data, error } = await supabase.rpc("get_category_delete_impact", {
      p_category_id: id,
    });
    if (error) return fail(error.message);
    return ok(parseImpact(data));
  } catch (e: any) {
    return fail(e?.message ?? "Failed to load delete impact");
  }
}

export async function getAdminCategoriesEnriched(): Promise<Result<AdminCategory[]>> {
  try {
    const { data, error } = await supabase.rpc("get_admin_categories_enriched");
    if (error) return fail(error.message);
    const rows = (data as AdminCategory[]) ?? [];
    return ok(
      rows.map((c) => ({
        ...c,
        product_count: Number(c.product_count ?? 0),
        child_count: Number(c.child_count ?? 0),
      })),
    );
  } catch (e: any) {
    return fail(e?.message ?? "Failed to fetch categories");
  }
}

export async function createCategory(c: Partial<Category>): Promise<Result<Category>> {
  try {
    const { data, error } = await supabase.from("categories").insert(c).select().single();
    if (error) return fail(error.message);
    const row = data as Category;
    await logCategoryAudit("categories.create", row.id, c as Record<string, unknown>);
    return ok(row);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to create category");
  }
}

export async function updateCategory(id: string, patch: Partial<Category>): Promise<Result<Category>> {
  try {
    const { data, error } = await supabase.from("categories").update(patch).eq("id", id).select().single();
    if (error) return fail(error.message);
    const row = data as Category;
    await logCategoryAudit("categories.update", id, patch as Record<string, unknown>);
    return ok(row);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to update category");
  }
}

export async function deleteCategoryWithOptions(
  id: string,
  options: CategoryDeleteOptions,
  allCategories: Pick<Category, "id" | "parent_id">[],
  impact?: CategoryDeleteImpact,
): Promise<Result<void>> {
  const resolvedImpact = impact ?? (await getCategoryDeleteImpact(id));
  if (!resolvedImpact.ok) return resolvedImpact;

  const validationError = validateCategoryDelete(id, resolvedImpact.data, options, allCategories);
  if (validationError) return fail(validationError);

  try {
    const { error } = await supabase.rpc("delete_category_with_options", {
      p_category_id: id,
      p_product_action: options.productAction,
      p_product_reassign_id: options.productReassignId ?? null,
      p_child_action: options.childAction,
      p_child_reassign_parent_id: options.childReassignParentId ?? null,
    });
    if (error) return fail(error.message);
    await logCategoryAudit("categories.delete", id, options as unknown as Record<string, unknown>);
    return ok(undefined);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to delete category");
  }
}

export async function deleteCategory(id: string): Promise<Result<void>> {
  return deleteCategoryWithOptions(
    id,
    { productAction: "unset", childAction: "detach" },
    [],
  );
}
