/**
 * replyToReviewBackend — POST /api/reviews/:id/reply (v2 seller/brand reply).
 * The mobile facade wraps backend.ts and exposes the same shape via Result<T>.
 */

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: { access_token: "t" } }, error: null }) },
  },
}));

vi.mock("@/lib/api/_fetch", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/_fetch")>("@/lib/api/_fetch");
  return {
    ...actual,
    fetchJson: vi.fn(),
  };
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchJson } from "@/lib/api/_fetch";
import { replyToReviewBackend } from "../index";

const fetchJsonMock = vi.mocked(fetchJson);

describe("replyToReviewBackend", () => {
  beforeEach(() => fetchJsonMock.mockReset());

  it("POSTs to /api/reviews/:id/reply with { body }", async () => {
    fetchJsonMock.mockResolvedValue({
      ok: true,
      data: { reply: { review_id: "r1", body: "thanks", created_at: "2026-08-31" } },
    });
    await replyToReviewBackend("r1", "thanks");
    expect(fetchJsonMock).toHaveBeenCalledWith(
      "/api/reviews/r1/reply",
      expect.objectContaining({ method: "POST", body: { body: "thanks" } }),
    );
  });

  it("returns the server reply on success", async () => {
    fetchJsonMock.mockResolvedValue({
      ok: true,
      data: { reply: { review_id: "r1", body: "thanks" } },
    });
    const res = await replyToReviewBackend("r1", "thanks");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.reply.body).toBe("thanks");
  });

  it("propagates failure shape", async () => {
    fetchJsonMock.mockResolvedValue({ ok: false, error: "forbidden" });
    const res = await replyToReviewBackend("r1", "x");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("forbidden");
  });
});
