/**
 * Mobile admin product editor (app/(admin)/products/edit/[id].tsx): form
 * state <-> PATCH /api/admin/catalog/products/:id payload. Value shapes
 * match the web editor (store/src/components/admin/catalog/product-editor.tsx).
 */
import type { AdminEditableProduct } from "@/lib/api/backend";

export const NONE = "";

export const STATUSES = ["active", "pending", "draft", "rejected", "archived"] as const;
export const GENDERS = ["women", "men", "kids", "unisex"] as const;
export const TEXT_KEYS = [
  "name", "sku", "short_description", "description",
  "material", "pattern", "fit", "sleeve", "occasion", "season", "care_instructions",
] as const;
export const STYLE_FIELDS: Array<[(typeof TEXT_KEYS)[number], string]> = [
  ["material", "Material"], ["pattern", "Pattern"], ["fit", "Fit"],
  ["sleeve", "Sleeve"], ["occasion", "Occasion"], ["season", "Season"],
];

export type ProductEditForm = {
  [K in (typeof TEXT_KEYS)[number]]: string;
} & {
  mrp: string;
  price: string;
  status: string;
  gender: string;
  category_id: string;
  brand_id: string;
  tags: string[];
  is_active: boolean;
  is_featured: boolean;
};

export function fromProduct(p: AdminEditableProduct): ProductEditForm {
  const str = (k: string) => (typeof p[k] === "string" ? (p[k] as string) : "");
  const f = Object.fromEntries(TEXT_KEYS.map((k) => [k, str(k)])) as unknown as ProductEditForm;
  f.mrp = p.mrp != null ? String(p.mrp) : "";
  f.price = p.price != null ? String(p.price) : "";
  f.status = str("status") || "draft";
  f.gender = str("gender");
  f.category_id = str("category_id");
  f.brand_id = str("brand_id");
  f.tags = Array.isArray(p.tags) ? [...p.tags] : [];
  f.is_active = p.is_active !== false;
  f.is_featured = p.is_featured === true;
  return f;
}

/** Same value shapes the web admin editor sends to PATCH /api/admin/catalog/products/:id. */
export function toPatchValue(k: keyof ProductEditForm, v: ProductEditForm[keyof ProductEditForm]): unknown {
  if (k === "mrp" || k === "price") return v === "" ? 0 : Number(v);
  if (k === "gender" || k === "category_id" || k === "brand_id") return v === NONE ? null : v;
  if (k === "name") return String(v).trim();
  if (typeof v === "string") return v.trim() === "" ? null : v.trim();
  return v;
}


/** Changed fields only, ready to PATCH. */
export function productEditPatch(form: ProductEditForm, initial: ProductEditForm): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(form) as Array<keyof ProductEditForm>) {
    const a = toPatchValue(k, form[k]);
    if (JSON.stringify(a) !== JSON.stringify(toPatchValue(k, initial[k]))) out[k] = a;
  }
  return out;
}
