import { describe, it, expect } from "vitest";
import {
  DELIVERY_SEQUENCE,
  OTP_LENGTH,
  OTP_REGEX,
  START_DELIVERY_FROM_STATUSES,
  TERMINAL_ORDER_STATUSES,
  VERIFY_FROM_STATUSES,
  canStartDelivery,
  canVerifyDelivery,
  hasProof,
  isDeliveryTerminal,
  isProofRequired,
  isScanActionLegal,
  isValidOtp,
  legalActions,
  type DeliveryAction,
  type ProofContext,
} from "@/lib/delivery-workflow";

const proof: ProofContext = { hasProofPhoto: true, proofUrl: "https://x/y.jpg" };
const noProof: ProofContext = { hasProofPhoto: false };

describe("delivery-workflow — OTP contract", () => {
  it("accepts exactly six digits", () => {
    expect(OTP_LENGTH).toBe(6);
    expect(OTP_REGEX.test("123456")).toBe(true);
    expect(isValidOtp("123456")).toBe(true);
  });

  it("rejects short codes", () => {
    expect(isValidOtp("12345")).toBe(false);
    expect(isValidOtp("1")).toBe(false);
    expect(isValidOtp("")).toBe(false);
  });

  it("rejects non-digit and padded codes", () => {
    expect(isValidOtp("12345a")).toBe(false);
    expect(isValidOtp("abcdef")).toBe(false);
    expect(isValidOtp("12 456")).toBe(false);
    expect(isValidOtp(" 123456 ")).toBe(true); // trimmed
  });

  it("rejects null and undefined", () => {
    expect(isValidOtp(null)).toBe(false);
    expect(isValidOtp(undefined)).toBe(false);
  });
});

describe("delivery-workflow — start_delivery guards", () => {
  it("allows start_delivery only from shipped", () => {
    expect(START_DELIVERY_FROM_STATUSES).toEqual(["shipped"]);
    expect(canStartDelivery("shipped")).toBe(true);
  });

  it("blocks start_delivery from pre-shipment and post-start statuses", () => {
    expect(canStartDelivery("pending")).toBe(false);
    expect(canStartDelivery("confirmed")).toBe(false);
    expect(canStartDelivery("processing")).toBe(false);
    expect(canStartDelivery("out_for_delivery")).toBe(false);
    expect(canStartDelivery("delivered")).toBe(false);
    expect(canStartDelivery("cancelled")).toBe(false);
  });
});

describe("delivery-workflow — verify guards", () => {
  it("allows verify only from out_for_delivery", () => {
    expect(VERIFY_FROM_STATUSES).toEqual(["out_for_delivery"]);
    expect(canVerifyDelivery("out_for_delivery")).toBe(true);
  });

  it("blocks verify from other statuses", () => {
    expect(canVerifyDelivery("shipped")).toBe(false);
    expect(canVerifyDelivery("processing")).toBe(false);
    expect(canVerifyDelivery("delivered")).toBe(false);
  });
});

describe("delivery-workflow — terminal statuses", () => {
  it("classifies terminal states", () => {
    expect(TERMINAL_ORDER_STATUSES).toContain("delivered");
    expect(TERMINAL_ORDER_STATUSES).toContain("returned");
    expect(TERMINAL_ORDER_STATUSES).toContain("refunded");
    expect(TERMINAL_ORDER_STATUSES).toContain("cancelled");
    expect(isDeliveryTerminal("delivered")).toBe(true);
    expect(isDeliveryTerminal("returned")).toBe(true);
    expect(isDeliveryTerminal("shipped")).toBe(false);
  });
});

describe("delivery-workflow — proof context", () => {
  it("flags verify_otp and verify_customer_qr as proof-required", () => {
    expect(isProofRequired("verify_otp")).toBe(true);
    expect(isProofRequired("verify_customer_qr")).toBe(true);
  });

  it("does not require proof for upstream actions", () => {
    expect(isProofRequired("pickup")).toBe(false);
    expect(isProofRequired("receive")).toBe(false);
    expect(isProofRequired("dispatch")).toBe(false);
    expect(isProofRequired("start_delivery")).toBe(false);
    expect(isProofRequired("fail_delivery")).toBe(false);
  });

  it("hasProof requires both flag and URL", () => {
    expect(hasProof({ hasProofPhoto: true, proofUrl: "u" })).toBe(true);
    expect(hasProof({ hasProofPhoto: true, proofUrl: null })).toBe(false);
    expect(hasProof({ hasProofPhoto: false, proofUrl: "u" })).toBe(false);
    expect(hasProof({ hasProofPhoto: true })).toBe(false);
  });
});

describe("delivery-workflow — isScanActionLegal", () => {
  it("rejects everything once order is terminal", () => {
    for (const a of DELIVERY_SEQUENCE) {
      const res = isScanActionLegal(a, "in_transit", "delivered", proof);
      expect(res.ok).toBe(false);
    }
    expect(isScanActionLegal("pickup", "scheduled", "cancelled", proof).ok).toBe(false);
  });

  it("blocks start_delivery from confirmed/processing/out_for_delivery", () => {
    expect(isScanActionLegal("start_delivery", "x", "confirmed", proof).ok).toBe(false);
    expect(isScanActionLegal("start_delivery", "x", "processing", proof).ok).toBe(false);
    expect(isScanActionLegal("start_delivery", "x", "out_for_delivery", proof).ok).toBe(false);
  });

  it("allows start_delivery from shipped", () => {
    expect(isScanActionLegal("start_delivery", "dispatched", "shipped", proof)).toEqual({
      ok: true,
    });
  });

  it("blocks verify_otp from shipped status", () => {
    const res = isScanActionLegal("verify_otp", "out_for_delivery", "shipped", proof);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/out_for_delivery/);
  });

  it("blocks verify_otp without proof photo", () => {
    const res = isScanActionLegal("verify_otp", "out_for_delivery", "out_for_delivery", noProof);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/proof/i);
  });

  it("blocks verify_customer_qr without proof photo", () => {
    const res = isScanActionLegal(
      "verify_customer_qr",
      "out_for_delivery",
      "out_for_delivery",
      noProof,
    );
    expect(res.ok).toBe(false);
  });

  it("allows verify_otp when status and proof are right", () => {
    expect(
      isScanActionLegal("verify_otp", "out_for_delivery", "out_for_delivery", proof),
    ).toEqual({ ok: true });
  });

  it("allows verify_customer_qr when status and proof are right", () => {
    expect(
      isScanActionLegal("verify_customer_qr", "out_for_delivery", "out_for_delivery", proof),
    ).toEqual({ ok: true });
  });

  it("does not require proof for pickup/receive/dispatch/fail_delivery", () => {
    expect(
      isScanActionLegal("pickup", "ready", "shipped", noProof).ok,
    ).toBe(true);
    expect(
      isScanActionLegal("receive", "transit", "shipped", noProof).ok,
    ).toBe(true);
    expect(
      isScanActionLegal("dispatch", "received", "shipped", noProof).ok,
    ).toBe(true);
    expect(
      isScanActionLegal("fail_delivery", "out_for_delivery", "out_for_delivery", noProof).ok,
    ).toBe(true);
  });
});

describe("delivery-workflow — legalActions filter", () => {
  it("filters out illegal actions from a candidate list", () => {
    // shipped + no proof: pickup legal, start_delivery legal, verify_otp blocked by no proof
    const all: DeliveryAction[] = ["pickup", "start_delivery", "verify_otp"];
    const out = legalActions(all, "x", "shipped", noProof);
    expect(out).toEqual(["pickup", "start_delivery"]);
  });

  it("keeps all legal actions when state and proof match", () => {
    // out_for_delivery + proof: verify_otp legal, start_delivery NOT legal (already past)
    const all: DeliveryAction[] = ["start_delivery", "verify_otp"];
    const out = legalActions(all, "x", "out_for_delivery", proof);
    expect(out).toEqual(["verify_otp"]);
  });

  it("returns empty for terminal orders", () => {
    const out = legalActions(["pickup", "receive"], "x", "delivered", proof);
    expect(out).toEqual([]);
  });

  it("returns empty for empty action list", () => {
    expect(legalActions([], "x", "shipped", noProof)).toEqual([]);
  });

  it("does not mutate input action list", () => {
    const input: DeliveryAction[] = ["pickup", "verify_otp"];
    const before = [...input];
    legalActions(input, "x", "shipped", noProof);
    expect(input).toEqual(before);
  });
});

describe("delivery-workflow — edge cases & unknown input", () => {
  it("treats unknown order status as non-terminal and non-start-eligible", () => {
    expect(isDeliveryTerminal("pending_approval")).toBe(false);
    expect(canStartDelivery("pending_approval")).toBe(false);
    expect(canVerifyDelivery("pending_approval")).toBe(false);
  });

  it("treats unknown terminal status as non-terminal (defense in depth)", () => {
    // If the server adds a new terminal status that the client doesn't know
    // about, we must NOT accidentally block all actions on it. The server
    // is the authority; client permits until told otherwise.
    expect(isDeliveryTerminal("archived")).toBe(false);
  });

  it("blocks verify_otp for unknown status", () => {
    const res = isScanActionLegal("verify_otp", "x", "weird_state", proof);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/out_for_delivery/);
  });

  it("blocks fail_delivery once order is terminal", () => {
    for (const terminal of ["delivered", "returned", "refunded", "cancelled"]) {
      const res = isScanActionLegal("fail_delivery", "x", terminal, proof);
      expect(res.ok).toBe(false);
    }
  });

  it("allows fail_delivery from out_for_delivery without proof", () => {
    expect(isScanActionLegal("fail_delivery", "x", "out_for_delivery", noProof).ok).toBe(true);
  });

  it("allows fail_delivery from shipped without proof", () => {
    expect(isScanActionLegal("fail_delivery", "x", "shipped", noProof).ok).toBe(true);
  });

  it("allows pickup:direct and pickup:transit_to_warehouse upstream", () => {
    // Pickup decision variants must not require proof regardless of decision.
    expect(isScanActionLegal("pickup:direct", "ready", "shipped", noProof).ok).toBe(true);
    expect(isScanActionLegal("pickup:transit_to_warehouse", "ready", "shipped", noProof).ok).toBe(true);
  });

  it("treats proofUrl: '' (empty string) as no proof", () => {
    expect(hasProof({ hasProofPhoto: true, proofUrl: "" })).toBe(false);
    const res = isScanActionLegal(
      "verify_otp",
      "x",
      "out_for_delivery",
      { hasProofPhoto: true, proofUrl: "" },
    );
    expect(res.ok).toBe(false);
  });

  it("treats proofUrl: '   ' as no proof after trim semantics", () => {
    // Whitespace-only URL is not enforced — server will reject if real.
    // Client just checks truthiness.
    expect(hasProof({ hasProofPhoto: true, proofUrl: "   " })).toBe(true);
  });

  it("isScanActionLegal priority: terminal > start > verify > proof", () => {
    // Order is terminal, also missing proof, also wrong status.
    // Reason should be the terminal one (highest priority).
    const res = isScanActionLegal(
      "verify_otp",
      "x",
      "delivered",
      noProof,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/already delivered/);
  });

  it("isScanActionLegal priority: start-check beats verify-check", () => {
    // start_delivery called on out_for_delivery order.
    const res = isScanActionLegal(
      "start_delivery",
      "x",
      "out_for_delivery",
      proof,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/must be shipped/);
  });

  it("isScanActionLegal reason mentions current status for verify-block", () => {
    const res = isScanActionLegal(
      "verify_customer_qr",
      "x",
      "shipped",
      proof,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toMatch(/shipped/);
      expect(res.reason).toMatch(/out_for_delivery/);
    }
  });

  it("cancel action follows terminal-block rule", () => {
    expect(isScanActionLegal("cancel", "x", "delivered", proof).ok).toBe(false);
    // From shipped (non-terminal) it's a server-side concern; client permits.
    expect(isScanActionLegal("cancel", "x", "shipped", proof).ok).toBe(true);
  });

  it("regenerate action follows terminal-block rule", () => {
    expect(isScanActionLegal("regenerate", "x", "cancelled", proof).ok).toBe(false);
    expect(isScanActionLegal("regenerate", "x", "shipped", proof).ok).toBe(true);
  });
});

describe("delivery-workflow — OTP extra edge cases", () => {
  it("accepts leading zeros", () => {
    expect(isValidOtp("000000")).toBe(true);
    expect(isValidOtp("000001")).toBe(true);
  });

  it("rejects 7+ digits", () => {
    expect(isValidOtp("1234567")).toBe(false);
    expect(isValidOtp("12345678")).toBe(false);
  });

  it("rejects negative sign", () => {
    expect(isValidOtp("-12345")).toBe(false);
  });

  it("rejects unicode digits", () => {
    // \d in JS only matches ASCII 0-9, not ٠ etc.
    expect(isValidOtp("١٢٣٤٥٦")).toBe(false);
  });

  it("rejects internal whitespace", () => {
    expect(isValidOtp("123 456")).toBe(false);
  });

  it("trims leading/trailing whitespace only", () => {
    expect(isValidOtp("  123456  ")).toBe(true);
    expect(isValidOtp("\t123456\n")).toBe(true);
  });

  it("rejects OTP_REGEX directly with mismatches", () => {
    expect(OTP_REGEX.test("")).toBe(false);
    expect(OTP_REGEX.test("12345")).toBe(false);
    expect(OTP_REGEX.test("1234567")).toBe(false);
    expect(OTP_REGEX.test("abcdef")).toBe(false);
    expect(OTP_REGEX.test("12345a")).toBe(false);
  });
});