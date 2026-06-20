import { describe, it, expect } from "vitest";
import {
  validateCheckoutAddress,
  checkoutAddressFieldLabel,
  checkoutAddressInvalidLabel,
} from "@/lib/checkout-validation";

const complete = {
  full_name: "Anya Perera",
  phone: "+94 77 123 4567",
  line1: "12 Galle Road",
  city: "Colombo",
  state: "Western",
  postal_code: "00300",
};

describe("validateCheckoutAddress", () => {
  it("accepts an address with every required field filled", () => {
    expect(validateCheckoutAddress(complete)).toEqual({ ok: true });
  });

  it("accepts an address even when line2 is omitted", () => {
    expect(validateCheckoutAddress({ ...complete, line2: undefined })).toEqual({
      ok: true,
    });
  });

  it("flags every missing required field, including state and postal_code", () => {
    const result = validateCheckoutAddress({});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.missing.sort()).toEqual(
      ["city", "full_name", "line1", "phone", "postal_code", "state"].sort(),
    );
    expect(result.invalid).toEqual([]);
  });

  it("treats whitespace-only fields as missing", () => {
    const result = validateCheckoutAddress({
      ...complete,
      state: "   ",
      postal_code: "",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.missing.sort()).toEqual(["postal_code", "state"].sort());
  });

  it("reports only the fields the caller left blank", () => {
    const result = validateCheckoutAddress({
      ...complete,
      state: "",
      postal_code: "",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.missing.sort()).toEqual(["postal_code", "state"].sort());
  });

  it("rejects a phone with no digits", () => {
    const result = validateCheckoutAddress({ ...complete, phone: "---" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.missing).toEqual([]);
    expect(result.invalid).toContain("phone");
  });

  it("rejects a phone that is too short", () => {
    const result = validateCheckoutAddress({ ...complete, phone: "12345" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.invalid).toContain("phone");
  });

  it("rejects a phone with letters mixed in", () => {
    // Audit gap: the AddressFormSheet `validate()` only checked `.trim()`
    // and accepted "abc" / "+94 77 abc 4567" as a phone. After the fix
    // the shared validator must reject letters the same as the web does.
    const result = validateCheckoutAddress({
      ...complete,
      phone: "+94 77 abc 4567",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.missing).toEqual([]);
    expect(result.invalid).toContain("phone");
  });

  it("accepts a phone in the local 07x format", () => {
    expect(validateCheckoutAddress({ ...complete, phone: "0771234567" })).toEqual({
      ok: true,
    });
  });
});

describe("checkoutAddressFieldLabel", () => {
  it("maps field keys to friendly labels", () => {
    expect(checkoutAddressFieldLabel("full_name")).toBe("full name");
    expect(checkoutAddressFieldLabel("line1")).toBe("address");
    expect(checkoutAddressFieldLabel("postal_code")).toBe("postal code");
    expect(checkoutAddressFieldLabel("city")).toBe("city");
    expect(checkoutAddressFieldLabel("state")).toBe("state");
    expect(checkoutAddressFieldLabel("phone")).toBe("phone");
  });
});

describe("checkoutAddressInvalidLabel", () => {
  it("uses a phone-specific message", () => {
    expect(checkoutAddressInvalidLabel("phone")).toBe("phone number looks invalid");
  });

  it("falls back to the friendly missing label", () => {
    expect(checkoutAddressInvalidLabel("state")).toBe("state looks invalid");
  });
});
