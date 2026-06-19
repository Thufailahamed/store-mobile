import { describe, it, expect } from "vitest";
import {
  validateCheckoutAddress,
  checkoutAddressFieldLabel,
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
