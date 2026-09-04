import { describe, it, expect } from "vitest";
import { checkServiceability, formatEta } from "@/lib/serviceability";

describe("checkServiceability", () => {
  it("maps Colombo Fort prefixes to a 1-2 day window", () => {
    const r = checkServiceability("00100");
    expect(r).toEqual({ city: "Colombo Fort", eta: "1-2 days", postal: "00100" });
  });

  it("rejects non-5-digit input", () => {
    expect(checkServiceability("12")).toEqual({ error: "invalid" });
    expect(checkServiceability("abcde")).toEqual({ error: "invalid" });
  });

  it("falls back for unknown prefixes", () => {
    const r = checkServiceability("55555");
    expect("error" in r).toBe(false);
    if ("error" in r) return;
    expect(r.city).toContain("Sri Lanka");
    expect(r.eta).toBe("4-7 days");
  });

  it("formats an ETA chip", () => {
    expect(formatEta({ city: "Kandy", eta: "3-5 days", postal: "20000" })).toBe(
      "Delivery to Kandy (20000) in 3-5 days",
    );
  });
});
