import { describe, it, expect } from "vitest";
import {
  isValidPhone,
  isValidEmail,
  PHONE_DIGIT_MIN,
  EMAIL_REGEX,
} from "@/lib/contact-validation";

describe("isValidPhone (mobile mirror)", () => {
  it("accepts a local Sri Lankan number", () => {
    expect(isValidPhone("0771234567")).toBe(true);
  });
  it("accepts a number with country code and spaces", () => {
    expect(isValidPhone("+94 77 123 4567")).toBe(true);
  });
  it("accepts a number with dashes and parentheses", () => {
    expect(isValidPhone("+1 (415) 555-0100")).toBe(true);
  });
  it("rejects strings with no digits", () => {
    expect(isValidPhone("---")).toBe(false);
    expect(isValidPhone("abc")).toBe(false);
  });
  it("rejects strings with letters mixed in", () => {
    expect(isValidPhone("+94 77 abc 4567")).toBe(false);
  });
  it("rejects phones that are too short", () => {
    expect(isValidPhone("12345")).toBe(false);
    expect(isValidPhone("123456")).toBe(false);
  });
  it("accepts a phone exactly at PHONE_DIGIT_MIN digits", () => {
    const exact = "1".repeat(PHONE_DIGIT_MIN);
    expect(isValidPhone(exact)).toBe(true);
  });
  it("rejects empty / null / undefined", () => {
    expect(isValidPhone("")).toBe(false);
    expect(isValidPhone(null)).toBe(false);
    expect(isValidPhone(undefined)).toBe(false);
  });
});

describe("isValidEmail (mobile mirror)", () => {
  it("accepts standard addresses", () => {
    expect(isValidEmail("user@example.com")).toBe(true);
  });
  it("rejects garbage that the old `email.includes('@')` accepted", () => {
    // The previous gate was `email.includes("@")` which let through
    // "@b", "a@", " @ ". Make sure none of those pass now.
    expect(isValidEmail("@b")).toBe(false);
    expect(isValidEmail("a@")).toBe(false);
    expect(isValidEmail(" @ ")).toBe(false);
    expect(isValidEmail("a@b")).toBe(false); // no TLD
  });
  it("rejects empty / null / undefined", () => {
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail(null)).toBe(false);
    expect(isValidEmail(undefined)).toBe(false);
  });
});

describe("EMAIL_REGEX", () => {
  it("matches simple addresses", () => {
    expect(EMAIL_REGEX.test("a@b.co")).toBe(true);
  });
  it("rejects a single @ with empty sides", () => {
    expect(EMAIL_REGEX.test("@b.c")).toBe(false);
    expect(EMAIL_REGEX.test("a@.c")).toBe(false);
  });
});