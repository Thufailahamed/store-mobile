import type { ProductStatus } from "@/lib/types";

const SELLER_SETTABLE: ProductStatus[] = ["draft", "pending", "archived"];

/** Sellers cannot self-publish; active requests become pending unless already live. */
export function coerceSellerProductStatus(
  requested: ProductStatus | undefined,
  existingStatus?: ProductStatus | null,
): ProductStatus {
  const next = requested ?? existingStatus ?? "draft";

  if (next === "active") {
    return existingStatus === "active" ? "active" : "pending";
  }

  if (next === "rejected") {
    return existingStatus ?? "pending";
  }

  if (SELLER_SETTABLE.includes(next)) {
    return next;
  }

  return existingStatus ?? "draft";
}

export function resolveProductType(variantCount: number): "simple" | "variable" {
  return variantCount > 0 ? "variable" : "simple";
}

export function statusToIsActive(status: ProductStatus): boolean {
  return status === "active";
}
