import { describe, it, expect } from "vitest";
import {
  DELIVERY_SEQUENCE,
  MAX_DELIVERY_ATTEMPTS,
  MAX_PICKUP_ATTEMPTS,
  OTP_LENGTH,
  OTP_REGEX,
  START_DELIVERY_FROM_STATUSES,
  TERMINAL_ORDER_STATUSES,
  VERIFY_FROM_STATUSES,
  attemptCount,
  canReassign,
  canReschedule,
  canStartDelivery,
  canVerifyDelivery,
  hasFailureEvidence,
  hasProof,
  hasSignature,
  isDeliveryTerminal,
  isFailureEvidenceRequired,
  isProofRequired,
  isRetryAllowed,
  isScanActionLegal,
  isSignatureRequired,
  isValidOtp,
  legalActions,
  targetStatusForReason,
  type DeliveryAction,
  type DeliveryFailureContext,
  type ProofContext,
} from "@/lib/delivery-workflow";
import {
  ISSUE_REASONS,
  ISSUE_REASON_BY_VALUE,
  ISSUE_REASON_VALUES,
  isRecoverableReason,
} from "@/lib/utils/delivery-format";

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
describe("delivery-workflow — signature context", () => {
  it("isSignatureRequired only for verify_* actions", () => {
    expect(isSignatureRequired("verify_otp")).toBe(true);
    expect(isSignatureRequired("verify_customer_qr")).toBe(true);
    expect(isSignatureRequired("start_delivery")).toBe(false);
    expect(isSignatureRequired("pack")).toBe(false);
    expect(isSignatureRequired("pickup")).toBe(false);
    expect(isSignatureRequired("fail_delivery")).toBe(false);
  });

  it("hasSignature requires both flag and URL", () => {
    expect(hasSignature({ hasSignature: true, signatureUrl: "https://x/y.png" })).toBe(true);
    expect(hasSignature({ hasSignature: true, signatureUrl: null })).toBe(false);
    expect(hasSignature({ hasSignature: true, signatureUrl: "" })).toBe(false);
    expect(hasSignature({ hasSignature: false })).toBe(false);
    expect(hasSignature({ hasSignature: false, signatureUrl: "https://x/y.png" })).toBe(false);
  });

  it("isScanActionLegal passes verify_* with full proof+signature context", () => {
    const ctx: ProofContext = {
      hasProofPhoto: true,
      proofUrl: "https://x/y.jpg",
      hasSignature: true,
      signatureUrl: "https://x/sig.png",
    };
    expect(isScanActionLegal("verify_otp", "out_for_delivery", "out_for_delivery", ctx)).toEqual({ ok: true });
    expect(isScanActionLegal("verify_customer_qr", "out_for_delivery", "out_for_delivery", ctx)).toEqual({ ok: true });
  });

  it("isScanActionLegal rejects verify_* when signature flag true but URL missing", () => {
    const ctx: ProofContext = {
      hasProofPhoto: true,
      proofUrl: "https://x/y.jpg",
      hasSignature: true,
      signatureUrl: null,
    };
    const result = isScanActionLegal("verify_otp", "out_for_delivery", "out_for_delivery", ctx);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/signature/i);
  });

  it("isScanActionLegal accepts verify_* when signature not yet attempted (undefined)", () => {
    // The signature is recommended, not server-enforced. If the rider never
    // touched the pad (hasSignature === undefined), the action stays legal.
    const ctx: ProofContext = {
      hasProofPhoto: true,
      proofUrl: "https://x/y.jpg",
    };
    expect(isScanActionLegal("verify_otp", "out_for_delivery", "out_for_delivery", ctx).ok).toBe(true);
  });

  it("legalActions filters verify_* when signature incomplete", () => {
    const fullCtx: ProofContext = {
      hasProofPhoto: true,
      proofUrl: "https://x/y.jpg",
      hasSignature: true,
      signatureUrl: "https://x/sig.png",
    };
    const partialCtx: ProofContext = {
      hasProofPhoto: true,
      proofUrl: "https://x/y.jpg",
      hasSignature: true,
      signatureUrl: null,
    };
    const actions: DeliveryAction[] = ["verify_otp", "fail_delivery", "start_delivery"];

    expect(legalActions(actions, "out_for_delivery", "out_for_delivery", fullCtx))
      .toEqual(["verify_otp", "fail_delivery"]);

    expect(legalActions(actions, "out_for_delivery", "out_for_delivery", partialCtx))
      .toEqual(["fail_delivery"]);
  });
});

/* ------------------------------------------------------------------ */
/*  Phase 14 — failure recovery policy                                 */
/* ------------------------------------------------------------------ */

describe("delivery-workflow — failure recovery policy", () => {
  it("exposes the attempt caps as exported constants", () => {
    expect(MAX_DELIVERY_ATTEMPTS).toBe(3);
    expect(MAX_PICKUP_ATTEMPTS).toBe(2);
  });

  it("targetStatusForReason routes recoverable reasons to returned", () => {
    expect(targetStatusForReason("customer_absent")).toBe("returned");
    expect(targetStatusForReason("wrong_address")).toBe("returned");
    expect(targetStatusForReason("no_safe_location")).toBe("returned");
    expect(targetStatusForReason("vehicle_breakdown")).toBe("returned");
    expect(targetStatusForReason("weather_hazard")).toBe("returned");
    expect(targetStatusForReason("store_closed")).toBe("returned");
  });

  it("targetStatusForReason routes terminal / claim reasons to cancelled", () => {
    expect(targetStatusForReason("refused")).toBe("cancelled");
    expect(targetStatusForReason("damaged")).toBe("cancelled");
    expect(targetStatusForReason("lost_in_transit")).toBe("cancelled");
    expect(targetStatusForReason("security_incident")).toBe("cancelled");
    expect(targetStatusForReason("other")).toBe("cancelled");
  });

  it("canReschedule allows recoverable reasons from returned", () => {
    expect(canReschedule({ status: "returned" }, "wrong_address")).toBe(true);
    expect(canReschedule({ status: "returned" }, "customer_absent")).toBe(true);
    expect(canReschedule({ status: "out_for_delivery" }, "vehicle_breakdown")).toBe(true);
  });

  it("canReschedule blocks non-retry-eligible reasons", () => {
    expect(canReschedule({ status: "returned" }, "refused")).toBe(false);
    expect(canReschedule({ status: "returned" }, "damaged")).toBe(false);
    expect(canReschedule({ status: "returned" }, "lost_in_transit")).toBe(false);
    expect(canReschedule({ status: "returned" }, "security_incident")).toBe(false);
    expect(canReschedule({ status: "returned" }, "other")).toBe(false);
  });

  it("canReschedule blocks when order is not in recoverable status", () => {
    expect(canReschedule({ status: "delivered" }, "customer_absent")).toBe(false);
    expect(canReschedule({ status: "shipped" }, "wrong_address")).toBe(false);
    expect(canReschedule({ status: "cancelled" }, "customer_absent")).toBe(false);
  });

  it("canReschedule is false when reason is null", () => {
    expect(canReschedule({ status: "returned" }, null)).toBe(false);
  });

  it("isRetryAllowed blocks when attemptCount reaches the cap", () => {
    expect(isRetryAllowed({ status: "returned" }, { attemptCount: 0 })).toBe(true);
    expect(isRetryAllowed({ status: "returned" }, { attemptCount: 2 })).toBe(true);
    expect(isRetryAllowed({ status: "returned" }, { attemptCount: 3 })).toBe(false);
    expect(isRetryAllowed({ status: "returned" }, { attemptCount: 5 })).toBe(false);
  });

  it("isRetryAllowed blocks when status is not recoverable", () => {
    expect(isRetryAllowed({ status: "delivered" }, { attemptCount: 0 })).toBe(false);
    expect(isRetryAllowed({ status: "shipped" }, { attemptCount: 0 })).toBe(false);
    expect(isRetryAllowed({ status: "cancelled" }, { attemptCount: 0 })).toBe(false);
  });

  it("canReassign requires prior rider, recoverable status, attempts, and reassignAvailable", () => {
    const baseCtx: DeliveryFailureContext = { attemptCount: 1, reassignAvailable: true };
    expect(
      canReassign({ status: "shipped", delivery_person_id: "r1" }, baseCtx),
    ).toBe(true);
    expect(
      canReassign({ status: "out_for_delivery", delivery_person_id: "r1" }, baseCtx),
    ).toBe(true);
    expect(
      canReassign({ status: "returned", delivery_person_id: "r1" }, baseCtx),
    ).toBe(true);
  });

  it("canReassign blocks when reassignAvailable is missing or false", () => {
    expect(
      canReassign({ status: "shipped", delivery_person_id: "r1" }, { attemptCount: 1 }),
    ).toBe(false);
    expect(
      canReassign(
        { status: "shipped", delivery_person_id: "r1" },
        { attemptCount: 1, reassignAvailable: false },
      ),
    ).toBe(false);
  });

  it("canReassign blocks when no prior rider is set", () => {
    expect(
      canReassign(
        { status: "shipped", delivery_person_id: null },
        { attemptCount: 1, reassignAvailable: true },
      ),
    ).toBe(false);
  });

  it("canReassign blocks for non-recoverable statuses", () => {
    expect(
      canReassign(
        { status: "pending", delivery_person_id: "r1" },
        { attemptCount: 1, reassignAvailable: true },
      ),
    ).toBe(false);
    expect(
      canReassign(
        { status: "delivered", delivery_person_id: "r1" },
        { attemptCount: 1, reassignAvailable: true },
      ),
    ).toBe(false);
  });

  it("canReassign blocks when no failure has been recorded", () => {
    expect(
      canReassign(
        { status: "shipped", delivery_person_id: "r1" },
        { attemptCount: 0, reassignAvailable: true },
      ),
    ).toBe(false);
  });

  it("isFailureEvidenceRequired only true for fail_delivery", () => {
    expect(isFailureEvidenceRequired("fail_delivery")).toBe(true);
    expect(isFailureEvidenceRequired("verify_otp")).toBe(false);
    expect(isFailureEvidenceRequired("start_delivery")).toBe(false);
    expect(isFailureEvidenceRequired("pickup")).toBe(false);
    expect(isFailureEvidenceRequired("cancel")).toBe(false);
  });

  it("hasFailureEvidence requires a non-empty URL", () => {
    expect(hasFailureEvidence({ attemptCount: 0, failureEvidenceUrl: "https://x/y.jpg" })).toBe(true);
    expect(hasFailureEvidence({ attemptCount: 0, failureEvidenceUrl: null })).toBe(false);
    expect(hasFailureEvidence({ attemptCount: 0, failureEvidenceUrl: "" })).toBe(false);
    expect(hasFailureEvidence({ attemptCount: 0, failureEvidenceUrl: "   " })).toBe(false);
    expect(hasFailureEvidence({ attemptCount: 0 })).toBe(false);
  });

  it("isScanActionLegal blocks fail_delivery after MAX_DELIVERY_ATTEMPTS", () => {
    const ctx: ProofContext = { hasProofPhoto: true, proofUrl: "u" };
    const res = isScanActionLegal(
      "fail_delivery",
      "out_for_delivery",
      "out_for_delivery",
      ctx,
      { attemptCount: MAX_DELIVERY_ATTEMPTS },
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/Maximum delivery attempts/i);
  });

  it("isScanActionLegal allows fail_delivery below the attempt cap", () => {
    const ctx: ProofContext = { hasProofPhoto: true, proofUrl: "u" };
    const res = isScanActionLegal(
      "fail_delivery",
      "out_for_delivery",
      "out_for_delivery",
      ctx,
      { attemptCount: MAX_DELIVERY_ATTEMPTS - 1 },
    );
    expect(res.ok).toBe(true);
  });

  it("isScanActionLegal allows fail_delivery without an evidence photo (soft requirement)", () => {
    const noProof: ProofContext = { hasProofPhoto: false };
    const res = isScanActionLegal(
      "fail_delivery",
      "out_for_delivery",
      "out_for_delivery",
      noProof,
      { attemptCount: 0 },
    );
    expect(res.ok).toBe(true);
  });

  it("isScanActionLegal priority: terminal > max-attempts > start > verify > proof", () => {
    const ctx: ProofContext = { hasProofPhoto: true, proofUrl: "u" };
    // Order is delivered AND over the attempt cap — terminal wins.
    const res = isScanActionLegal(
      "fail_delivery",
      "x",
      "delivered",
      ctx,
      { attemptCount: MAX_DELIVERY_ATTEMPTS },
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/already delivered/);
  });

  it("isScanActionLegal keeps the existing verify_otp behavior with default failure ctx", () => {
    // Backward-compat: callers that don't pass a failure ctx should see no
    // change in behavior for non-fail_delivery actions.
    const proof: ProofContext = { hasProofPhoto: true, proofUrl: "u" };
    expect(
      isScanActionLegal("verify_otp", "out_for_delivery", "out_for_delivery", proof),
    ).toEqual({ ok: true });
    expect(
      isScanActionLegal(
        "verify_otp",
        "out_for_delivery",
        "shipped",
        proof,
        { attemptCount: MAX_DELIVERY_ATTEMPTS },
      ).ok,
    ).toBe(false);
  });

  it("legalActions forwards the failure context to isScanActionLegal", () => {
    const actions: DeliveryAction[] = ["fail_delivery", "start_delivery"];
    const proof: ProofContext = { hasProofPhoto: true, proofUrl: "u" };
    const under: DeliveryAction[] = legalActions(
      actions,
      "out_for_delivery",
      "out_for_delivery",
      proof,
      { attemptCount: 1 },
    );
    expect(under).toContain("fail_delivery");

    const over: DeliveryAction[] = legalActions(
      actions,
      "out_for_delivery",
      "out_for_delivery",
      proof,
      { attemptCount: MAX_DELIVERY_ATTEMPTS },
    );
    expect(over).not.toContain("fail_delivery");
  });

  it("attemptCount prefers the attempt_count column over the notes marker", () => {
    expect(attemptCount({ attempt_count: 5, notes: "[attempts:2]" })).toBe(5);
  });

  it("attemptCount falls back to the legacy notes marker", () => {
    expect(attemptCount({ notes: "[attempts:2] — buyer absent" })).toBe(2);
    expect(attemptCount({ notes: "no marker here" })).toBe(0);
    expect(attemptCount({})).toBe(0);
    expect(attemptCount({ notes: null })).toBe(0);
  });

  it("attemptCount returns 0 for null attempt_count and falls through", () => {
    expect(attemptCount({ attempt_count: null, notes: "x" })).toBe(0);
    expect(attemptCount({ attempt_count: 0, notes: "x" })).toBe(0);
  });

  it("ISSUE_REASONS covers every IssueReason value with no duplicates", () => {
    expect(ISSUE_REASONS.length).toBe(ISSUE_REASON_VALUES.length);
    const seen = new Set<string>();
    for (const r of ISSUE_REASONS) {
      expect(seen.has(r.value)).toBe(false);
      seen.add(r.value);
      expect(r.label.length).toBeGreaterThan(0);
      expect(["returned", "cancelled"]).toContain(r.targetStatus);
    }
    for (const v of ISSUE_REASON_VALUES) {
      expect(ISSUE_REASON_BY_VALUE[v].value).toBe(v);
    }
  });

  it("isRecoverableReason matches the severity field", () => {
    expect(isRecoverableReason("customer_absent")).toBe(true);
    expect(isRecoverableReason("wrong_address")).toBe(true);
    expect(isRecoverableReason("refused")).toBe(false);
    expect(isRecoverableReason("damaged")).toBe(false);
    expect(isRecoverableReason(null)).toBe(false);
    expect(isRecoverableReason(undefined)).toBe(false);
  });
});

describe("delivery-workflow — OTP contract (audit gap fix)", () => {
  it("OTP_LENGTH is 6", () => {
    expect(OTP_LENGTH).toBe(6);
  });

  it("OTP_REGEX accepts a 6-digit string", () => {
    expect(OTP_REGEX.test("123456")).toBe(true);
    expect(OTP_REGEX.test("000000")).toBe(true);
    expect(OTP_REGEX.test("999999")).toBe(true);
  });

  it("OTP_REGEX rejects 5 / 7 digit strings", () => {
    expect(OTP_REGEX.test("12345")).toBe(false);
    expect(OTP_REGEX.test("1234567")).toBe(false);
  });

  it("OTP_REGEX rejects non-digits (letters, whitespace, dashes)", () => {
    expect(OTP_REGEX.test("12345a")).toBe(false);
    expect(OTP_REGEX.test("123 456")).toBe(false);
    expect(OTP_REGEX.test("123-456")).toBe(false);
    expect(OTP_REGEX.test("abcdef")).toBe(false);
  });

  it("isValidOtp accepts a 6-digit OTP", () => {
    expect(isValidOtp("123456")).toBe(true);
  });

  it("isValidOtp trims before checking", () => {
    expect(isValidOtp("  123456  ")).toBe(true);
  });

  it("isValidOtp rejects empty / null / undefined", () => {
    expect(isValidOtp("")).toBe(false);
    expect(isValidOtp("   ")).toBe(false);
    expect(isValidOtp(null)).toBe(false);
    expect(isValidOtp(undefined)).toBe(false);
  });

  it("isValidOtp rejects a phone-shaped OTP with letters", () => {
    expect(isValidOtp("12ab56")).toBe(false);
  });
});

describe("delivery-workflow — scan-action legality (audit parity)", () => {
  const emptyProof: ProofContext = { hasProofPhoto: false, proofUrl: null };
  const withProof: ProofContext = { hasProofPhoto: true, proofUrl: "https://x/y.jpg" };

  it("rejects any action on a terminal order", () => {
    for (const status of TERMINAL_ORDER_STATUSES) {
      const r = isScanActionLegal("pack", "warehouse", status, emptyProof);
      expect(r.ok, `expected reject for status=${status}`).toBe(false);
    }
  });

  it("rejects start_delivery when order is not shipped", () => {
    const r = isScanActionLegal("start_delivery", "in_transit", "pending", withProof);
    expect(r.ok).toBe(false);
  });

  it("accepts start_delivery once status is shipped", () => {
    const r = isScanActionLegal("start_delivery", "in_transit", "shipped", withProof);
    expect(r.ok).toBe(true);
  });

  it("rejects verify_otp before out_for_delivery", () => {
    const r = isScanActionLegal("verify_otp", "in_transit", "shipped", withProof);
    expect(r.ok).toBe(false);
  });

  it("accepts verify_otp with proof + out_for_delivery", () => {
    const r = isScanActionLegal(
      "verify_otp",
      "in_transit",
      "out_for_delivery",
      withProof,
    );
    expect(r.ok).toBe(true);
  });

  it("rejects verify_otp when proof is missing", () => {
    const r = isScanActionLegal(
      "verify_otp",
      "in_transit",
      "out_for_delivery",
      emptyProof,
    );
    expect(r.ok).toBe(false);
  });

  it("rejects fail_delivery after MAX_DELIVERY_ATTEMPTS", () => {
    const r = isScanActionLegal(
      "fail_delivery",
      "in_transit",
      "out_for_delivery",
      emptyProof,
      { attemptCount: MAX_DELIVERY_ATTEMPTS },
    );
    expect(r.ok).toBe(false);
  });

  it("isProofRequired true only for verify_*", () => {
    expect(isProofRequired("verify_otp")).toBe(true);
    expect(isProofRequired("verify_customer_qr")).toBe(true);
    expect(isProofRequired("pack")).toBe(false);
    expect(isProofRequired("fail_delivery")).toBe(false);
  });

  it("isSignatureRequired mirrors isProofRequired for the verify_* actions", () => {
    expect(isSignatureRequired("verify_otp")).toBe(true);
    expect(isSignatureRequired("verify_customer_qr")).toBe(true);
    expect(isSignatureRequired("pack")).toBe(false);
  });

  it("legalActions drops illegal actions from a candidate list", () => {
    const candidates = ["pack", "verify_otp"] as const;
    const legal = legalActions(
      candidates as unknown as Parameters<typeof legalActions>[0],
      "warehouse",
      "shipped",
      withProof,
    );
    // verify_otp is illegal here because order is shipped, not out_for_delivery
    expect(legal).toEqual(["pack"]);
  });

  it("canStartDelivery true only for shipped", () => {
    expect(canStartDelivery("shipped")).toBe(true);
    expect(canStartDelivery("pending")).toBe(false);
    expect(canStartDelivery("out_for_delivery")).toBe(false);
  });

  it("canVerifyDelivery true only for out_for_delivery", () => {
    expect(canVerifyDelivery("out_for_delivery")).toBe(true);
    expect(canVerifyDelivery("shipped")).toBe(false);
    expect(canVerifyDelivery("pending")).toBe(false);
  });

  it("isDeliveryTerminal matches TERMINAL_ORDER_STATUSES", () => {
    for (const s of TERMINAL_ORDER_STATUSES) {
      expect(isDeliveryTerminal(s)).toBe(true);
    }
    expect(isDeliveryTerminal("shipped")).toBe(false);
    expect(isDeliveryTerminal("pending")).toBe(false);
  });
});

describe("delivery-workflow — sequence + status set exports", () => {
  it("DELIVERY_SEQUENCE is the documented happy-path", () => {
    expect(DELIVERY_SEQUENCE).toEqual([
      "pack",
      "pickup",
      "receive",
      "dispatch",
      "start_delivery",
      "verify_otp",
    ]);
  });
});
