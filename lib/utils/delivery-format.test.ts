import { describe, it, expect } from "vitest";
import {
  formatPrice,
  formatRelative,
  formatShiftElapsed,
  urgencyLabel,
  isCompleted,
} from "./delivery-format";

describe("formatPrice", () => {
  it("formats with currency prefix and locale grouping", () => {
    expect(formatPrice(0)).toBe("Rs. 0");
    expect(formatPrice(1500)).toBe("Rs. 1,500");
    expect(formatPrice(1234567)).toBe("Rs. 1,234,567");
  });
});

describe("formatRelative", () => {
  it("returns empty for invalid dates", () => {
    expect(formatRelative("not-a-date")).toBe("");
  });

  it("returns 'just now' for under a minute", () => {
    const now = new Date().toISOString();
    expect(formatRelative(now)).toBe("just now");
  });

  it("returns minutes for under an hour", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString();
    expect(formatRelative(fiveMinAgo)).toBe("5m ago");
  });

  it("returns hours for under a day", () => {
    const threeHrsAgo = new Date(Date.now() - 3 * 60 * 60_000).toISOString();
    expect(formatRelative(threeHrsAgo)).toBe("3h ago");
  });

  it("returns days for over a day", () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60_000).toISOString();
    expect(formatRelative(twoDaysAgo)).toBe("2d ago");
  });
});

describe("formatShiftElapsed", () => {
  it("returns 00:00 for null", () => {
    expect(formatShiftElapsed(null)).toBe("00:00");
  });

  it("returns 00:00 for future start", () => {
    expect(formatShiftElapsed(new Date(Date.now() + 60_000).toISOString())).toBe("00:00");
  });

  it("formats hours and minutes", () => {
    const started = new Date(Date.now() - (2 * 3600 + 17 * 60) * 1000).toISOString();
    expect(formatShiftElapsed(started)).toBe("02:17");
  });
});

describe("urgencyLabel", () => {
  it("Fresh under 30m", () => {
    expect(urgencyLabel(5 * 60_000).label).toBe("Fresh");
  });
  it("On time 30-90m", () => {
    expect(urgencyLabel(45 * 60_000).label).toBe("On time");
  });
  it("Aging 90-180m", () => {
    expect(urgencyLabel(120 * 60_000).label).toBe("Aging");
  });
  it("Late over 180m", () => {
    expect(urgencyLabel(6 * 60 * 60_000).label).toBe("Late");
  });
});

describe("isCompleted", () => {
  it.each([
    ["delivered", true],
    ["returned", true],
    ["refunded", true],
    ["cancelled", true],
    ["out_for_delivery", false],
    ["processing", false],
    ["shipped", false],
    ["pending", false],
  ])("isCompleted(%s) === %s", (status, expected) => {
    expect(isCompleted(status)).toBe(expected);
  });
});
