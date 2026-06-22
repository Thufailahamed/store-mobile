import { describe, it, expect } from "vitest";
import {
  getSellerAccessState,
  getSellerComplianceGaps,
  collectComplianceGaps,
  isComplianceDocumentApproved,
} from "@/lib/seller-access";

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

describe("seller-access", () => {
  it("allows access when store is approved regardless of bank details", () => {
    const access = getSellerAccessState(baseStore, basePayout, approvedDocs);
    expect(access.canAccessSellerTools).toBe(true);
    expect(access.missingComplianceFields).toEqual([]);
  });

  it("does not block access when optional documents are pending admin review", () => {
    const access = getSellerAccessState(baseStore, basePayout, [
      { doc_type: "business_registration", file_url: "path", status: "pending" },
      { doc_type: "tax_certificate", file_url: "path2", status: "approved" },
    ]);
    expect(access.canAccessSellerTools).toBe(true);
  });

  it("does not block access when bank details are missing", () => {
    const access = getSellerAccessState(baseStore, { ...basePayout, bank_name: null }, approvedDocs);
    expect(access.canAccessSellerTools).toBe(true);
    expect(access.missingComplianceFields).toContain("bank name");
  });

  it("blocks suspended stores separately from rejected applications", () => {
    const suspended = getSellerAccessState({ ...baseStore, status: "suspended" }, basePayout, approvedDocs);
    const rejected = getSellerAccessState({ ...baseStore, status: "rejected" }, basePayout, approvedDocs);

    expect(suspended.isSuspended).toBe(true);
    expect(suspended.isRejected).toBe(false);
    expect(rejected.isRejected).toBe(true);
    expect(rejected.isSuspended).toBe(false);
    expect(suspended.lockReason).toMatch(/suspended/i);
    expect(rejected.lockReason).toMatch(/rejected/i);
  });

  it("requires approved document status for optional checklist items", () => {
    expect(
      isComplianceDocumentApproved({ doc_type: "tax_certificate", file_url: "x", status: "pending" })
    ).toBe(false);
    expect(
      isComplianceDocumentApproved({ doc_type: "tax_certificate", file_url: "x", status: "approved" })
    ).toBe(true);
  });

  it("does not treat missing optional documents as mandatory gaps", () => {
    const gaps = getSellerComplianceGaps(baseStore, basePayout, [
      { doc_type: "business_registration", file_url: "path", status: "approved" },
    ]);
    expect(gaps).toEqual([]);
  });

  it("does not treat rejected optional documents as mandatory gaps", () => {
    const gaps = collectComplianceGaps(baseStore, basePayout, [
      { doc_type: "business_registration", file_url: "path", status: "rejected" },
      ...approvedDocs.slice(1),
    ]);
    expect(gaps).toEqual([]);
  });

  it("ignores store status when checking compliance-only gaps", () => {
    const gaps = getSellerComplianceGaps({ ...baseStore, status: "pending" }, basePayout, approvedDocs);
    expect(gaps).toEqual([]);
  });

  it("reports missing bank details as optional gaps", () => {
    const gaps = getSellerComplianceGaps(baseStore, { ...basePayout, bank_name: null }, approvedDocs);
    expect(gaps).toContain("bank name");
  });
});
