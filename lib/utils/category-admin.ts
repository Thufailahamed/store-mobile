export interface CategoryNode {
  id: string;
  parent_id?: string | null;
  name: string;
  slug: string;
}

export interface CategoryDeleteImpact {
  productCount: number;
  childCount: number;
  couponCount: number;
}

export type ProductDeleteAction = "unset" | "reassign";
export type ChildDeleteAction = "detach" | "reassign";

export interface CategoryDeleteOptions {
  productAction: ProductDeleteAction;
  productReassignId?: string | null;
  childAction: ChildDeleteAction;
  childReassignParentId?: string | null;
}

export function slugifyCategoryName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function isCategoryDescendant(
  categoryId: string,
  ancestorId: string,
  categories: Pick<CategoryNode, "id" | "parent_id">[],
): boolean {
  const byId = new Map(categories.map((c) => [c.id, c]));
  let current = byId.get(categoryId);
  while (current?.parent_id) {
    if (current.parent_id === ancestorId) return true;
    current = byId.get(current.parent_id);
  }
  return false;
}

export function getDescendantIds(
  categoryId: string,
  categories: Pick<CategoryNode, "id" | "parent_id">[],
): Set<string> {
  const result = new Set<string>();
  const queue = [categoryId];
  while (queue.length) {
    const id = queue.pop()!;
    for (const c of categories) {
      if (c.parent_id === id && !result.has(c.id)) {
        result.add(c.id);
        queue.push(c.id);
      }
    }
  }
  return result;
}

export function validateCategoryDelete(
  categoryId: string,
  impact: CategoryDeleteImpact,
  options: CategoryDeleteOptions,
  categories: Pick<CategoryNode, "id" | "parent_id">[],
): string | null {
  if (impact.productCount > 0 && options.productAction === "reassign") {
    if (!options.productReassignId) return "Choose a category to reassign products to";
    if (options.productReassignId === categoryId) return "Cannot reassign products to the same category";
    if (isCategoryDescendant(options.productReassignId, categoryId, categories)) {
      return "Cannot reassign products to a subcategory of this category";
    }
  }

  if (impact.childCount > 0 && options.childAction === "reassign") {
    if (options.childReassignParentId === categoryId) {
      return "Cannot move subcategories under themselves";
    }
    if (
      options.childReassignParentId &&
      isCategoryDescendant(options.childReassignParentId, categoryId, categories)
    ) {
      return "Cannot move subcategories under a descendant";
    }
  }

  return null;
}

export function validateCategoryParent(
  categoryId: string | null | undefined,
  parentId: string | null | undefined,
  categories: Pick<CategoryNode, "id" | "parent_id">[],
): string | null {
  if (!parentId) return null;
  if (categoryId && parentId === categoryId) return "A category cannot be its own parent";
  if (categoryId && isCategoryDescendant(parentId, categoryId, categories)) {
    return "Cannot set parent to a descendant category";
  }
  return null;
}

export function getValidParentOptions<T extends CategoryNode>(
  categoryId: string | null | undefined,
  categories: T[],
): T[] {
  if (!categoryId) return categories;
  const blocked = getDescendantIds(categoryId, categories);
  blocked.add(categoryId);
  return categories.filter((c) => !blocked.has(c.id));
}

export function buildCategoryTree<T extends CategoryNode>(
  rows: T[],
): (T & { children: (T & { children: unknown[] })[] })[] {
  const map = new Map<string, T & { children: (T & { children: unknown[] })[] }>();
  for (const row of rows) map.set(row.id, { ...row, children: [] });
  const roots: (T & { children: (T & { children: unknown[] })[] })[] = [];
  for (const row of rows) {
    const node = map.get(row.id)!;
    if (row.parent_id && map.has(row.parent_id)) {
      map.get(row.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

export function flattenCategoryTree<T extends CategoryNode & { children?: T[] }>(
  nodes: T[],
  depth = 0,
): (T & { depth: number })[] {
  const out: (T & { depth: number })[] = [];
  for (const node of nodes) {
    out.push({ ...node, depth });
    if (node.children?.length) {
      out.push(...flattenCategoryTree(node.children, depth + 1));
    }
  }
  return out;
}
