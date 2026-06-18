import { describe, it, expect } from "vitest";
import {
  ISSUE_REASONS,
  ISSUE_REASON_BY_VALUE,
  ISSUE_REASON_VALUES,
  isRecoverableReason,
} from "@/lib/utils/delivery-format";
import {
  MAX_DELIVERY_ATTEMPTS,
  MAX_PICKUP_ATTEMPTS,
  attemptCount,
  canReassign,
  canReschedule,
  isFailureEvidenceRequired,
  isRetryAllowed,
  targetStatusForReason,
  type DeliveryFailureContext,
} from "@/lib/delivery-workflow";

describe("delivery-failure — taxonomy integrity", () => {
  it("ISSUE_REASONS covers every IssueReason value", () => {
    expect(ISSUE_REASONS.length).toBe(ISSUE_REASON_VALUES.length);
    for (const v of ISSUE_REASON_VALUES) {
      expect(ISSUE_REASON_BY_VALUE[v].value).toBe(v);
    }
  });

  it("every IssueReason has a non-empty label and valid targetStatus", () => {
    for (const r of ISSUE_REASONS) {
      expect(r.label.length).toBeGreaterThan(0);
      expect(["returned", "cancelled"]).toContain(r.targetStatus);
      expect(["recoverable", "terminal", "claim"]).toContain(r.severity);
    }
  });

  it("every recoverable reason targets `returned`", () => {
    for (const r of ISSUE_REASONS.filter((x) => x.severity === "recoverable")) {
      expect(r.targetStatus).toBe("returned");
      expect(r.retryEligible).toBe(true);
    }
  });

  it("terminal reasons are not retry-eligible", () => {
    for (const r of ISSUE_REASONS.filter((x) => x.severity === "terminal")) {
      expect(r.retryEligible).toBe(false);
    }
  });

  it("claim reasons go to cancelled and are not retry-eligible", () => {
    for (const r of ISSUE_REASONS.filter((x) => x.severity === "claim")) {
      expect(r.targetStatus).toBe("cancelled");
      expect(r.retryEligible).toBe(false);
    }
  });

  it("targetStatusForReason matches ISSUE_REASON_BY_VALUE.targetStatus", () => {
    for (const r of ISSUE_REASONS) {
      expect(targetStatusForReason(r.value)).toBe(r.targetStatus);
    }
  });

  it("isRecoverableReason matches severity field", () => {
    for (const r of ISSUE_REASONS) {
      expect(isRecoverableReason(r.value)).toBe(r.severity === "recoverable");
    }
    expect(isRecoverableReason(null)).toBe(false);
    expect(isRecoverableReason(undefined)).toBe(false);
  });
});

describe("delivery-failure — attempt cap matrix", () => {
  const baseCtx = (over: Partial<DeliveryFailureContext> = {}): DeliveryFailureContext => ({
    attemptCount: 0,
    ...over,
  });

  it("isRetryAllowed is true under cap, false at or above", () => {
    expect(isRetryAllowed({ status: "returned" }, baseCtx({ attemptCount: 0 }))).toBe(true);
    expect(isRetryAllowed({ status: "returned" }, baseCtx({ attemptCount: MAX_DELIVERY_ATTEMPTS - 1 }))).toBe(true);
    expect(isRetryAllowed({ status: "returned" }, baseCtx({ attemptCount: MAX_DELIVERY_ATTEMPTS }))).toBe(false);
    expect(isRetryAllowed({ status: "returned" }, baseCtx({ attemptCount: MAX_DELIVERY_ATTEMPTS + 5 }))).toBe(false);
  });

  it("isRetryAllowed is false for delivered / cancelled / shipped", () => {
    expect(isRetryAllowed({ status: "delivered" }, baseCtx())).toBe(false);
    expect(isRetryAllowed({ status: "cancelled" }, baseCtx())).toBe(false);
    expect(isRetryAllowed({ status: "shipped" }, baseCtx())).toBe(false);
  });

  it("canReschedule is true only for recoverable reasons on recoverable statuses", () => {
    expect(canReschedule({ status: "returned" }, "customer_absent")).toBe(true);
    expect(canReschedule({ status: "out_for_delivery" }, "wrong_address")).toBe(true);
    expect(canReschedule({ status: "returned" }, "vehicle_breakdown")).toBe(true);
    expect(canReschedule({ status: "returned" }, "refused")).toBe(false);
    expect(canReschedule({ status: "returned" }, "damaged")).toBe(false);
    expect(canReschedule({ status: "delivered" }, "customer_absent")).toBe(false);
  });
});

describe("delivery-failure — reassignment gates", () => {
  it("canReassign requires reassignAvailable === true", () => {
    expect(
      canReassign(
        { status: "shipped", delivery_person_id: "r1" },
        { attemptCount: 1, reassignAvailable: true },
      ),
    ).toBe(true);
    expect(
      canReassign(
        { status: "shipped", delivery_person_id: "r1" },
        { attemptCount: 1 }, // reassignAvailable missing
      ),
    ).toBe(false);
    expect(
      canReassign(
        { status: "shipped", delivery_person_id: "r1" },
        { attemptCount: 1, reassignAvailable: false },
      ),
    ).toBe(false);
  });

  it("canReassign requires at least one failure on the order", () => {
    expect(
      canReassign(
        { status: "shipped", delivery_person_id: "r1" },
        { attemptCount: 0, reassignAvailable: true },
      ),
    ).toBe(false);
  });

  it("canReassign requires a prior rider", () => {
    expect(
      canReassign(
        { status: "shipped", delivery_person_id: null },
        { attemptCount: 1, reassignAvailable: true },
      ),
    ).toBe(false);
  });

  it("canReassign blocks for terminal statuses", () => {
    for (const status of ["delivered", "cancelled", "refunded", "pending", "confirmed", "processing"]) {
      expect(
        canReassign(
          { status, delivery_person_id: "r1" },
          { attemptCount: 1, reassignAvailable: true },
        ),
      ).toBe(false);
    }
  });
});

describe("delivery-failure — attemptCount parsing", () => {
  it("prefers attempt_count column over notes marker", () => {
    expect(attemptCount({ attempt_count: 5, notes: "[attempts:2]" })).toBe(5);
  });

  it("falls back to legacy [attempts:N] notes marker", () => {
    expect(attemptCount({ notes: "[attempts:2] — buyer absent" })).toBe(2);
    expect(attemptCount({ notes: "no marker" })).toBe(0);
  });

  it("handles missing / null / undefined fields", () => {
    expect(attemptCount({})).toBe(0);
    expect(attemptCount({ notes: null })).toBe(0);
    expect(attemptCount({ attempt_count: null })).toBe(0);
    expect(attemptCount({ attempt_count: 0 })).toBe(0);
  });

  it("ignores malformed markers without throwing", () => {
    // Number("abc") → NaN; Number("") → 0. Both are acceptable defensive
    // outcomes — what matters is that the call doesn't throw and the
    // caller can detect "no usable count" without crashing.
    const a = attemptCount({ notes: "[attempts:abc]" });
    expect(Number.isNaN(a) || a === 0).toBe(true);
    const b = attemptCount({ notes: "[attempts:]" });
    expect(Number.isNaN(b) || b === 0).toBe(true);
  });
});

describe("delivery-failure — evidence gating", () => {
  it("isFailureEvidenceRequired only true for fail_delivery", () => {
    expect(isFailureEvidenceRequired("fail_delivery")).toBe(true);
    expect(isFailureEvidenceRequired("verify_otp")).toBe(false);
    expect(isFailureEvidenceRequired("start_delivery")).toBe(false);
    expect(isFailureEvidenceRequired("cancel")).toBe(false);
    expect(isFailureEvidenceRequired("pack")).toBe(false);
  });

  it("exposes MAX_PICKUP_ATTEMPTS as a positive integer", () => {
    expect(MAX_PICKUP_ATTEMPTS).toBe(2);
    expect(Number.isInteger(MAX_PICKUP_ATTEMPTS)).toBe(true);
  });
});

describe("delivery-failure — legacy string reason compatibility", () => {
  it("'customer_absent' is recoverable (legacy callers)", () => {
    expect(targetStatusForReason("customer_absent")).toBe("returned");
  });

  it("'wrong_address' is recoverable (legacy callers)", () => {
    expect(targetStatusForReason("wrong_address")).toBe("returned");
  });

  it("'refused' goes to cancelled (legacy callers)", () => {
    expect(targetStatusForReason("refused")).toBe("cancelled");
  });
});
