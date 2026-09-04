/**
 * decideSellerReturn — PATCH /api/seller/returns facade (decide_return RPC).
 * Pinned so mobile return detail screen can rely on shape + error handling.
 */

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: { access_token: "t" } }, error: null }) },
  },
}));

vi.mock("@/lib/api/_fetch", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/_fetch")>("@/lib/api/_fetch");
  return { ...actual, fetchJson: vi.fn() };
});

vi.mock("@/lib/api/backend", () => ({
  decideSellerReturnBackend: vi.fn(),
}));

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as backend from "@/lib/api/backend";
import { decideSellerReturn } from "../index";

const decideMock = vi.mocked(backend.decideSellerReturnBackend);

describe("decideSellerReturn", () => {
  beforeEach(() => decideMock.mockReset());

  it("approve sends action: approve", async () => {
    decideMock.mockResolvedValue({ ok: true, data: { return: { id: "rt1", status: "approved" } } });
    const res = await decideSellerReturn("u1", "rt1", "approve");
    expect(res.ok).toBe(true);
    expect(decideMock).toHaveBeenCalledWith("rt1", "approve", undefined);
  });

  it("reject sends action: reject with note", async () => {
    decideMock.mockResolvedValue({ ok: true, data: { return: { id: "rt2", status: "rejected" } } });
    await decideSellerReturn("u1", "rt2", "reject", { note: "damaged" });
    expect(decideMock).toHaveBeenCalledWith("rt2", "reject", "damaged");
  });

  it("propagates failure", async () => {
    decideMock.mockResolvedValue({ ok: false, error: "not_owner" });
    const res = await decideSellerReturn("u1", "rt3", "approve");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("not_owner");
  });
});
