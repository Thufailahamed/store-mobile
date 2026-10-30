import { describe, it, expect } from "vitest";
import {
  coercePayoutSettings,
  isPayoutKycError,
  mergePayoutSettings,
  normalizeAccountLast4,
  payoutKycUserMessage,
  toPayoutPayload,
  validatePayoutDraft,
  withPayoutDefaults,
} from "@/lib/payouts/settings";

describe("normalizeAccountLast4", () => {
  it("keeps a real last-4", () => {
    expect(normalizeAccountLast4("4821")).toBe("4821");
  });

  it("takes last 4 from a full account number", () => {
    expect(normalizeAccountLast4("123456789012")).toBe("9012");
  });

  it("treats all-zero placeholders as missing", () => {
    expect(normalizeAccountLast4("0000")).toBeNull();
    expect(normalizeAccountLast4("00-00")).toBeNull();
  });
});

describe("coercePayoutSettings", () => {
  it("strips grandfathered seed bank details", () => {
    const row = coercePayoutSettings({
      method: "bank",
      schedule: "weekly",
      bank_name: "Grandfathered Bank",
      account_name: "Aura Boutique",
      account_number_last4: "0000",
    });
    expect(row.bank_name).toBeNull();
    expect(row.account_number_last4).toBeNull();
    expect(row.account_name).toBe("Aura Boutique");
    expect(row.method).toBe("bank");
  });

  it("drops legacy UPI, PayPal and Stripe methods back to bank", () => {
    expect(coercePayoutSettings({ method: "upi", upi: "store@bank" }).method).toBeUndefined();
    expect(coercePayoutSettings({ method: "stripe_connect" }).method).toBeUndefined();
  });
});

describe("mergePayoutSettings", () => {
  it("lets /settings win over the payouts list payload", () => {
    const merged = mergePayoutSettings(
      { method: "bank", bank_name: "Commercial Bank", account_number_last4: "7712" },
      { method: "bank", bank_name: "Grandfathered Bank", account_number_last4: "0000" },
    );
    expect(merged.bank_name).toBe("Commercial Bank");
    expect(merged.account_number_last4).toBe("7712");
  });
});

describe("validatePayoutDraft", () => {
  it("requires the bank name", () => {
    expect(validatePayoutDraft({})).toMatch(/bank name/i);
  });

  it("rejects placeholder bank details", () => {
    expect(
      validatePayoutDraft({
        method: "bank",
        bank_name: "Grandfathered Bank",
        account_name: "Aura",
        account_number_last4: "1234",
      }),
    ).toMatch(/real bank name/i);
  });

  it("accepts a Sri Lankan bank payout with a saved account", () => {
    expect(
      validatePayoutDraft({
        method: "bank",
        bank_name: "Commercial Bank of Ceylon",
        account_name: "Aura Boutique",
        account_number_last4: "4821",
      }),
    ).toBeNull();
  });

  it("requires the full account number when none is saved yet", () => {
    expect(
      validatePayoutDraft({
        method: "bank",
        bank_name: "Sampath Bank",
        account_name: "Aura Boutique",
      }),
    ).toMatch(/full account number/i);
  });

  it("rejects a typed account number outside 6 to 20 digits", () => {
    expect(
      validatePayoutDraft({
        method: "bank",
        bank_name: "Sampath Bank",
        account_name: "Aura Boutique",
        account_number: "12345",
        account_number_last4: "4821",
      }),
    ).toMatch(/6 to 20 digits/i);
  });
});

describe("withPayoutDefaults", () => {
  it("matches the website empty form", () => {
    const row = withPayoutDefaults({});
    expect(row.method).toBe("bank");
    expect(row.schedule).toBe("weekly");
    expect(row.bank_name).toBe("Commercial Bank of Ceylon");
    expect(row.tax_form_submitted).toBe(true);
  });
});

describe("isPayoutKycError", () => {
  it("detects backend gate codes", () => {
    expect(isPayoutKycError("kyc_required: Identity verification required before payouts.")).toBe(true);
    expect(isPayoutKycError("kyc_pending: Your KYC submission is under review.")).toBe(true);
    expect(payoutKycUserMessage("kyc_rejected: Your KYC was rejected. Please resubmit.")).toBe(
      "Your KYC was rejected. Please resubmit.",
    );
    expect(isPayoutKycError("Connect failed")).toBe(false);
  });
});

describe("toPayoutPayload", () => {
  it("sends the full account number only when the seller typed one", () => {
    const payload = toPayoutPayload({
      method: "bank",
      schedule: "weekly",
      bank_name: "HNB",
      account_name: "Aura Boutique",
      account_number: "1234567890",
    });
    expect(payload.account_number).toBe("1234567890");
    expect(payload.tax_form_submitted).toBe(true);
    expect(payload.schedule).toBe("weekly");
  });

  it("leaves the saved account number alone when nothing was typed", () => {
    const payload = toPayoutPayload({
      method: "bank",
      bank_name: "HNB",
      account_name: "Aura Boutique",
      account_number_last4: "7890",
    });
    expect("account_number" in payload).toBe(false);
    expect("account_number_last4" in payload).toBe(false);
  });
});
