import { describe, it, expect } from "vitest";
import {
  getSellerAccessState,
  getSellerComplianceGaps,
  isComplianceDocumentApproved,
} from "@/lib/seller-access";
import { isStoreCatalogVisible, isPublicCatalogProduct } from "@/lib/catalog-visibility";

const baseStore = {
  id: "store-1",
  legal_name: "Acme LLC",
  tax_id: "TIN-12345",
  status: "approved",
};

const basePayout = {
  bank_name: "Test Bank",
  account_name: "Acme LLC",
  account_number_last4: "1234",
  tax_form_submitted: true,
};

const approvedDocs = [
  { doc_type: "business_registration", file_url: "store-1/business.jpg", status: "approved" },
  { doc_type: "tax_certificate", file_url: "store-1/tax.jpg", status: "approved" },
];

describe("seller compliance flow", () => {
  it("unlocks seller tools for approved stores even when documents are pending", () => {
    const pending = getSellerAccessState(baseStore, basePayout, [
      { doc_type: "business_registration", file_url: "path", status: "pending" },
      approvedDocs[1],
    ]);
    expect(pending.canAccessSellerTools).toBe(true);

    const approved = getSellerAccessState(baseStore, basePayout, approvedDocs);
    expect(approved.canAccessSellerTools).toBe(true);
  });

  it("tracks optional compliance gaps without blocking access", () => {
    const gapsBefore = getSellerComplianceGaps(baseStore, { ...basePayout, bank_name: null }, approvedDocs);
    expect(gapsBefore).toContain("bank name");

    const gapsAfter = getSellerComplianceGaps(baseStore, basePayout, approvedDocs);
    expect(gapsAfter).toEqual([]);
  });

  it("does not treat rejected optional documents as blocking gaps", () => {
    const gaps = getSellerComplianceGaps(baseStore, basePayout, [
      { doc_type: "business_registration", file_url: "path", status: "rejected" },
      approvedDocs[1],
    ]);
    expect(gaps.some((g) => g.includes("rejected"))).toBe(false);
    expect(isComplianceDocumentApproved({ doc_type: "x", file_url: "p", status: "rejected" })).toBe(
      false
    );
  });

  it("keeps approved stores visible in public catalog regardless of compliance", () => {
    const visible = new Set(["store-1"]);
    expect(isStoreCatalogVisible(baseStore, basePayout, approvedDocs)).toBe(true);
    expect(
      isStoreCatalogVisible(baseStore, { ...basePayout, bank_name: null }, [
        { doc_type: "business_registration", file_url: "path", status: "rejected" },
        approvedDocs[1],
      ])
    ).toBe(true);
    expect(
      isPublicCatalogProduct(
        { store_id: "store-1", store: { status: "approved" }, status: "active", is_active: true },
        visible
      )
    ).toBe(true);
    expect(
      isPublicCatalogProduct(
        { store_id: "store-2", store: { status: "approved" }, status: "active", is_active: true },
        visible
      )
    ).toBe(false);
  });

  it("browse visibility is wider than checkout compliance", () => {
    const browsable = new Set(["store-pending-compliance"]);
    const checkout = new Set<string>();
    const product = {
      store_id: "store-pending-compliance",
      store: { status: "approved" },
      status: "active",
      is_active: true,
    };
    expect(isPublicCatalogProduct(product, browsable)).toBe(true);
    expect(isPublicCatalogProduct(product, checkout)).toBe(false);
  });
});
