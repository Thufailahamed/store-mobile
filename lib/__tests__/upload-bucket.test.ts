/**
 * uploadReviewPhoto bucket contract — targets the `reviews` bucket (not
 * the legacy `review-media` from migration 0004). Path uses
 * <userId>/<reviewId>/<idx>.<ext> per migration 0273 convention.
 */

// All vi.mock calls are hoisted to the top of the module BEFORE imports
// by vitest — order in source doesn't matter, only that they're at the
// module top level.
vi.mock("react-native", () => ({
  Platform: { OS: "ios", select: (obj: any) => obj.ios ?? obj.default },
  Alert: { alert: () => undefined },
}));

vi.mock("expo-file-system", () => ({
  readAsStringAsync: async () => "AA==",
  copyAsync: async () => undefined,
  EncodingType: { Base64: "base64" },
  cacheDirectory: "/tmp/",
}));

vi.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: async () => ({ status: "granted" }),
  requestCameraPermissionsAsync: async () => ({ status: "granted" }),
  launchImageLibraryAsync: async () => ({ canceled: true }),
  launchCameraAsync: async () => ({ canceled: true }),
}));

vi.mock("expo-document-picker", () => ({
  getDocumentAsync: async () => ({ canceled: true }),
}));

vi.mock("expo-constants", () => ({
  default: { expoConfig: { extra: { storeApiUrl: "https://api.test" } } },
}));

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    rpc: async () => ({ data: null, error: null }),
    from: () => ({}),
    auth: { getSession: async () => ({ data: { session: { access_token: "t" } }, error: null }) },
  },
}));

vi.mock("@/lib/api", () => ({
  assertSellerCanOperate: async () => ({ ok: true }),
}));

vi.mock("@/lib/api/backend", () => ({
  addProductImageBackend: async () => ({ ok: true }),
}));

vi.mock("@/lib/seller-access", () => ({}));

import { describe, it, expect, vi, beforeEach } from "vitest";
import { uploadReviewPhoto } from "../upload";

// atob polyfill (node < 16 may lack it)
if (typeof globalThis.atob !== "function") {
  // @ts-expect-error test shim
  globalThis.atob = (s: string) => Buffer.from(s, "base64").toString("binary");
}

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

describe("uploadReviewPhoto", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ uploadUrl: "https://r2/upload", publicUrl: "https://cdn/photo.jpg" }),
      })
      .mockResolvedValueOnce({ ok: true });
  });

  it("targets the 'reviews' bucket, not 'review-media'", async () => {
    await uploadReviewPhoto("user-1", "review-1", "file:///tmp/photo.jpg");
    const presignCall = fetchMock.mock.calls[0];
    const body = JSON.parse(presignCall[1].body as string);
    expect(body.bucket).toBe("reviews");
    expect(body.bucket).not.toBe("review-media");
  });

  it("forwards a prefix scoped under <userId>/<reviewId>/ so R2 keys are user-scoped", async () => {
    await uploadReviewPhoto("user-1", "review-1", "file:///tmp/photo.jpg", { index: 2 });
    const presignCall = fetchMock.mock.calls[0];
    const body = JSON.parse(presignCall[1].body as string);
    expect(body.prefix).toBe("user-1/review-1");
    expect(body.filename).toMatch(/^2\./);
  });
});
