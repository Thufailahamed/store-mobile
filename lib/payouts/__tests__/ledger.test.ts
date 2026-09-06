import { describe, it, expect } from "vitest";
import { formatPayoutStatus, isPayoutId, payoutUserMessage } from "@/lib/payouts/ledger";

describe("isPayoutId", () => {
  it("rejects reserved path segments like balance", () => {
    expect(isPayoutId("balance")).toBe(false);
    expect(isPayoutId("withdraw")).toBe(false);
    expect(isPayoutId("settings")).toBe(false);
    expect(isPayoutId("not-a-uuid")).toBe(false);
  });

  it("accepts a uuid", () => {
    expect(isPayoutId("a1b2c3d4-e5f6-7890-abcd-ef1234567890")).toBe(true);
  });
});

describe("formatPayoutStatus", () => {
  it("uses atelier labels", () => {
    expect(formatPayoutStatus("pending")).toBe("Pending");
    expect(formatPayoutStatus("processing")).toBe("Processing");
    expect(formatPayoutStatus("paid")).toBe("Paid");
    expect(formatPayoutStatus("failed")).toBe("Failed");
    expect(formatPayoutStatus("cancelled")).toBe("Cancelled");
  });

  it("does not invent a status", () => {
    expect(formatPayoutStatus(undefined)).toBe("—");
  });
});

describe("payoutUserMessage", () => {
  it("hides postgres uuid syntax errors from the seller", () => {
    expect(
      payoutUserMessage(
        'invalid input syntax for type uuid: "balance"',
        "Couldn’t load balance. Pull to retry.",
      ),
    ).toBe("Couldn’t load balance. Pull to retry.");
  });

  it("keeps a real API message", () => {
    expect(payoutUserMessage("Store not found", "fallback")).toBe("Store not found");
  });
});
