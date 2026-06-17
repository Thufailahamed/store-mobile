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
  it("blocks seller tools until documents are admin-approved", () => {
    const pending = getSellerAccessState(baseStore, basePayout, [
      { doc_type: "business_registration", file_url: "path", status: "pending" },
      approvedDocs[1],
    ]);
    expect(pending.canAccessSellerTools).toBe(false);

    const approved = getSellerAccessState(baseStore, basePayout, approvedDocs);
    expect(approved.canAccessSellerTools).toBe(true);
  });

  it("allows admin approval only when compliance gaps are empty", () => {
    const gapsBefore = getSellerComplianceGaps(baseStore, basePayout, [
      { doc_type: "business_registration", file_url: "path", status: "pending" },
      approvedDocs[1],
    ]);
    expect(gapsBefore.length).toBeGreaterThan(0);

    const gapsAfter = getSellerComplianceGaps(baseStore, basePayout, approvedDocs);
    expect(gapsAfter).toEqual([]);
  });

  it("requires re-upload after document rejection", () => {
    const gaps = getSellerComplianceGaps(baseStore, basePayout, [
      { doc_type: "business_registration", file_url: "path", status: "rejected" },
      approvedDocs[1],
    ]);
    expect(gaps.some((g) => g.includes("rejected"))).toBe(true);
    expect(isComplianceDocumentApproved({ doc_type: "x", file_url: "p", status: "rejected" })).toBe(
      false
    );
  });

  it("hides lapsed stores from public catalog", () => {
    const visible = new Set(["store-1"]);
    expect(
      isStoreCatalogVisible(baseStore, basePayout, approvedDocs)
    ).toBe(true);
    expect(
      isStoreCatalogVisible(baseStore, basePayout, [
        { doc_type: "business_registration", file_url: "path", status: "rejected" },
        approvedDocs[1],
      ])
    ).toBe(false);
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
});
