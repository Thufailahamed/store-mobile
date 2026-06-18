import { describe, it, expect } from "vitest";
import { friendlyReviewError, formatReviewDate } from "@/lib/review-error";

describe("friendlyReviewError", () => {
  it("maps product_id/order_item mismatch to a helpful message", () => {
    const out = friendlyReviewError(
      "product_id 11111111-2222-3333-4444-555555555555 does not match order_item 66666666-...",
    );
    expect(out).toMatch(/different product/i);
  });

  it("maps ownership mismatch to a helpful message", () => {
    const out = friendlyReviewError("order_item 999... does not belong to current user");
    expect(out).toMatch(/isn't yours/i);
  });

  it("maps missing order_item to a helpful message", () => {
    const out = friendlyReviewError("order_item_id 999... does not exist");
    expect(out).toMatch(/no longer available/i);
  });

  it("maps auth mismatch to sign-in prompt", () => {
    const out = friendlyReviewError("reviews.user_id must equal auth.uid()");
    expect(out).toMatch(/sign in again/i);
  });

  it("returns raw text for unknown errors", () => {
    const raw = "Network connection lost";
    expect(friendlyReviewError(raw)).toBe(raw);
  });

  it("handles null / undefined / empty input gracefully", () => {
    expect(friendlyReviewError(null)).toMatch(/could not save/i);
    expect(friendlyReviewError(undefined)).toMatch(/could not save/i);
    expect(friendlyReviewError("")).toMatch(/could not save/i);
  });
});

describe("formatReviewDate", () => {
  it("formats ISO date to a readable string", () => {
    const out = formatReviewDate("2026-05-01T12:00:00Z");
    expect(out).toMatch(/2026/);
    expect(out).toMatch(/May/);
  });

  it("returns empty string for null / undefined / empty", () => {
    expect(formatReviewDate(null)).toBe("");
    expect(formatReviewDate(undefined)).toBe("");
    expect(formatReviewDate("")).toBe("");
  });

  it("returns empty string for invalid date", () => {
    expect(formatReviewDate("not-a-date")).toBe("");
  });
});
