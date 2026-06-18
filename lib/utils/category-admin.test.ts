import { describe, it, expect } from "vitest";
import {
  buildCategoryTree,
  flattenCategoryTree,
  isCategoryDescendant,
  validateCategoryDelete,
  validateCategoryParent,
  getValidParentOptions,
  slugifyCategoryName,
  getDescendantIds,
} from "@/lib/utils/category-admin";

const categories = [
  { id: "root", parent_id: null, name: "Root", slug: "root" },
  { id: "child", parent_id: "root", name: "Child", slug: "child" },
  { id: "grand", parent_id: "child", name: "Grand", slug: "grand" },
  { id: "other", parent_id: null, name: "Other", slug: "other" },
];

describe("slugifyCategoryName", () => {
  it("lowercases and hyphenates", () => {
    expect(slugifyCategoryName("  Hello World! ")).toBe("hello-world");
  });
});

describe("buildCategoryTree", () => {
  it("nests children under parents", () => {
    const tree = buildCategoryTree(categories);
    expect(tree).toHaveLength(2);
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].children).toHaveLength(1);
  });
});

describe("flattenCategoryTree", () => {
  it("preserves depth", () => {
    const tree = buildCategoryTree(categories as Parameters<typeof buildCategoryTree>[0]);
    const flat = flattenCategoryTree(tree as Parameters<typeof flattenCategoryTree>[0]);
    expect(flat.map((n) => n.depth)).toEqual([0, 1, 2, 0]);
  });
});

describe("isCategoryDescendant", () => {
  it("detects descendants", () => {
    expect(isCategoryDescendant("grand", "root", categories)).toBe(true);
    expect(isCategoryDescendant("other", "root", categories)).toBe(false);
  });
});

describe("getDescendantIds", () => {
  it("returns all nested ids", () => {
    expect([...getDescendantIds("root", categories)].sort()).toEqual(["child", "grand"]);
  });
});

describe("validateCategoryParent", () => {
  it("blocks self parent", () => {
    expect(validateCategoryParent("root", "root", categories)).toContain("own parent");
  });

  it("blocks descendant parent", () => {
    expect(validateCategoryParent("root", "child", categories)).toContain("descendant");
  });

  it("allows valid parent", () => {
    expect(validateCategoryParent("child", "root", categories)).toBeNull();
  });
});

describe("getValidParentOptions", () => {
  it("excludes self and descendants", () => {
    const options = getValidParentOptions("root", categories);
    expect(options.map((c) => c.id)).toEqual(["other"]);
  });
});

describe("validateCategoryDelete", () => {
  const impact = { productCount: 2, childCount: 1, couponCount: 0 };

  it("requires reassignment target for products", () => {
    expect(
      validateCategoryDelete("root", impact, { productAction: "reassign", childAction: "detach" }, categories),
    ).toBe("Choose a category to reassign products to");
  });

  it("blocks reassignment to self", () => {
    expect(
      validateCategoryDelete(
        "root",
        impact,
        { productAction: "reassign", productReassignId: "root", childAction: "detach" },
        categories,
      ),
    ).toBe("Cannot reassign products to the same category");
  });

  it("blocks reassignment to descendant", () => {
    expect(
      validateCategoryDelete(
        "root",
        impact,
        { productAction: "reassign", productReassignId: "child", childAction: "detach" },
        categories,
      ),
    ).toBe("Cannot reassign products to a subcategory of this category");
  });

  it("blocks moving children under self", () => {
    expect(
      validateCategoryDelete(
        "root",
        impact,
        { productAction: "unset", childAction: "reassign", childReassignParentId: "root" },
        categories,
      ),
    ).toBe("Cannot move subcategories under themselves");
  });

  it("passes valid unset/detach", () => {
    expect(
      validateCategoryDelete(
        "root",
        impact,
        { productAction: "unset", childAction: "detach" },
        categories,
      ),
    ).toBeNull();
  });
});
