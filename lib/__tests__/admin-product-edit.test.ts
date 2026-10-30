import { describe, it, expect } from "vitest";
import { fromProduct, productEditPatch } from "@/lib/admin/product-edit";

const product = {
  id: "p1",
  name: "Linen Shirt",
  slug: "linen-shirt",
  status: "pending",
  price: 4500,
  mrp: 5000,
  tags: ["linen"],
  category_id: "c1",
  brand_id: null,
  gender: null,
  material: "Linen",
  description: "Breathable.",
  is_active: true,
};

describe("admin product edit form", () => {
  it("round-trips without changes", () => {
    const form = fromProduct(product);
    expect(productEditPatch(form, form)).toEqual({});
  });

  it("sends only changed fields in the backend's shapes", () => {
    const initial = fromProduct(product);
    const form = {
      ...initial,
      name: "  Linen Overshirt ",
      price: "4200",
      category_id: "c2",
      brand_id: "b9",
      gender: "men",
      material: "",
      tags: ["linen", "summer"],
      status: "active",
    };
    expect(productEditPatch(form, initial)).toEqual({
      name: "Linen Overshirt",
      price: 4200,
      category_id: "c2",
      brand_id: "b9",
      gender: "men",
      material: null,
      tags: ["linen", "summer"],
      status: "active",
    });
  });

  it("clears category and brand to null", () => {
    const initial = fromProduct({ ...product, brand_id: "b1" });
    const form = { ...initial, category_id: "", brand_id: "" };
    expect(productEditPatch(form, initial)).toEqual({ category_id: null, brand_id: null });
  });
});
