import { fetchJson } from "@/lib/api/backend";
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

function parseImpact(data: unknown): CategoryDeleteImpact {
  const row = data as Record<string, number> | null;
  return {
    productCount: Number(row?.productCount ?? row?.product_count ?? 0),
    childCount: Number(row?.childCount ?? row?.child_count ?? 0),
    couponCount: Number(row?.couponCount ?? row?.coupon_count ?? 0),
  };
}

export async function getCategoryDeleteImpact(id: string): Promise<Result<CategoryDeleteImpact>> {
  const res = await fetchJson<{ impact: { productCount?: number; childCount?: number; couponCount?: number; product_count?: number; child_count?: number; coupon_count?: number } }>(
    `/api/admin/categories/${id}/delete-impact`,
  );
  if (!res.ok) return fail(res.error);
  return ok(parseImpact(res.data.impact));
}

export async function getAdminCategoriesEnriched(): Promise<Result<AdminCategory[]>> {
  const res = await fetchJson<{ categories: AdminCategory[] }>(
    "/api/admin/categories",
  );
  if (!res.ok) return fail(res.error);
  const rows = res.data.categories ?? [];
  return ok(
    rows.map((c) => ({
      ...c,
      product_count: Number(c.product_count ?? 0),
      child_count: Number(c.child_count ?? 0),
    })),
  );
}

export async function createCategory(c: Partial<Category>): Promise<Result<Category>> {
  const res = await fetchJson<{ category: Category }>(
    "/api/admin/categories",
    { method: "POST", body: c },
  );
  if (!res.ok) return fail(res.error);
  return ok(res.data.category);
}

export async function updateCategory(id: string, patch: Partial<Category>): Promise<Result<Category>> {
  const res = await fetchJson<{ category: Category }>(
    `/api/admin/categories/${id}`,
    { method: "PATCH", body: patch },
  );
  if (!res.ok) return fail(res.error);
  return ok(res.data.category);
}

export async function deleteCategoryWithOptions(
  id: string,
  options: CategoryDeleteOptions,
  allCategories: Pick<Category, "id" | "parent_id">[],
  impact?: CategoryDeleteImpact,
): Promise<Result<void>> {
  let resolvedImpact: CategoryDeleteImpact;
  if (impact) {
    resolvedImpact = impact;
  } else {
    const fetched = await getCategoryDeleteImpact(id);
    if (!fetched.ok) return fetched;
    resolvedImpact = fetched.data;
  }

  const validationError = validateCategoryDelete(id, resolvedImpact, options, allCategories);
  if (validationError) return fail(validationError);

  const res = await fetchJson<{ result: unknown }>(
    `/api/admin/categories/${id}`,
    {
      method: "DELETE",
      body: {
        productAction: options.productAction,
        productReassignId: options.productReassignId ?? null,
        childAction: options.childAction,
        childReassignParentId: options.childReassignParentId ?? null,
      },
    },
  );
  if (!res.ok) return fail(res.error);
  return ok(undefined);
}

export async function deleteCategory(id: string): Promise<Result<void>> {
  return deleteCategoryWithOptions(
    id,
    { productAction: "unset", childAction: "detach" },
    [],
  );
}
