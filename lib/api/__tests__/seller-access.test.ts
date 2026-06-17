import { describe, it, expect } from "vitest";
import {
  getSellerAccessState,
  getSellerComplianceGaps,
  collectComplianceGaps,
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

const baseDocs = [
  { doc_type: "business_registration", file_url: "store-1/business.jpg", status: "pending" },
  { doc_type: "tax_certificate", file_url: "store-1/tax.jpg", status: "pending" },
];

describe("seller-access", () => {
  it("allows access when store is approved and compliance is complete", () => {
    const access = getSellerAccessState(baseStore, basePayout, baseDocs);
    expect(access.canAccessSellerTools).toBe(true);
    expect(access.missingComplianceFields).toEqual([]);
  });

  it("blocks suspended stores separately from rejected applications", () => {
    const suspended = getSellerAccessState({ ...baseStore, status: "suspended" }, basePayout, baseDocs);
    const rejected = getSellerAccessState({ ...baseStore, status: "rejected" }, basePayout, baseDocs);

    expect(suspended.isSuspended).toBe(true);
    expect(suspended.isRejected).toBe(false);
    expect(rejected.isRejected).toBe(true);
    expect(rejected.isSuspended).toBe(false);
    expect(suspended.lockReason).toMatch(/suspended/i);
    expect(rejected.lockReason).toMatch(/rejected/i);
  });

  it("reports missing business documents in compliance gaps", () => {
    const gaps = getSellerComplianceGaps(baseStore, basePayout, [
      { doc_type: "business_registration", file_url: "path" },
    ]);
    expect(gaps).toContain("tax certificate");
  });

  it("reports missing banking and tax declaration fields", () => {
    const gaps = collectComplianceGaps(baseStore, { ...basePayout, tax_form_submitted: false }, baseDocs);
    expect(gaps).toContain("tax declaration");
  });

  it("ignores store status when checking compliance-only gaps", () => {
    const gaps = getSellerComplianceGaps({ ...baseStore, status: "pending" }, basePayout, baseDocs);
    expect(gaps).toEqual([]);
  });
});
