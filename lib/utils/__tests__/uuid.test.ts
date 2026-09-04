import { describe, it, expect, vi } from "vitest";
import { uuidv4 } from "../uuid";

describe("uuidv4", () => {
  it("generates a valid RFC 4122 v4 UUID string", () => {
    const id = uuidv4();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it("generates unique UUIDs across multiple invocations", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(uuidv4());
    }
    expect(ids.size).toBe(100);
  });

  it("works when crypto is undefined (React Native / Hermes environment)", () => {
    const originalCrypto = globalThis.crypto;
    try {
      // @ts-expect-error - simulating React Native environment without crypto
      delete globalThis.crypto;
      const id = uuidv4();
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    } finally {
      globalThis.crypto = originalCrypto;
    }
  });

  it("uses crypto.randomUUID when available", () => {
    const mockUuid = "12345678-1234-4234-8234-123456789abc";
    const originalCrypto = globalThis.crypto;
    try {
      globalThis.crypto = {
        ...originalCrypto,
        randomUUID: vi.fn(() => mockUuid),
      } as unknown as Crypto;

      expect(uuidv4()).toBe(mockUuid);
    } finally {
      globalThis.crypto = originalCrypto;
    }
  });
});
