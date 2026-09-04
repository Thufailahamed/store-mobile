/**
 * RFC 4122 v4 UUID generator safe for React Native (Hermes / JSC / web).
 * Falls back to Math.random-based byte generation when global crypto is unavailable.
 */
export function uuidv4(): string {
  try {
    if (
      typeof crypto !== "undefined" &&
      typeof (crypto as { randomUUID?: () => string }).randomUUID === "function"
    ) {
      return (crypto as { randomUUID: () => string }).randomUUID();
    }
  } catch {
    // fall through
  }

  // RFC4122 v4 fallback
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx

  const hex: string[] = [];
  for (let i = 0; i < 16; i++) {
    hex.push(bytes[i].toString(16).padStart(2, "0"));
  }

  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
}
