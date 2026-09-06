/**
 * replyToSellerReview — POST /api/seller/reviews/:id/reply.
 *
 * This is the seller-scoped route that persists the `seller_reply` /
 * `seller_replied_at` columns the seller reviews list reads back. The
 * generic /api/reviews/:id/reply router is mounted at the app root, so it
 * is not reachable under that prefix.
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
import { replyToSellerReview } from "../index";

const fetchJsonMock = vi.mocked(fetchJson);

describe("replyToSellerReview", () => {
  beforeEach(() => fetchJsonMock.mockReset());

  it("POSTs to /api/seller/reviews/:id/reply with { reply }", async () => {
    fetchJsonMock.mockResolvedValue({
      ok: true,
      data: { review: { id: "r1", seller_reply: "thanks", seller_replied_at: "2026-08-31" } },
    });
    await replyToSellerReview("r1", "thanks");
    expect(fetchJsonMock).toHaveBeenCalledWith(
      "/api/seller/reviews/r1/reply",
      expect.objectContaining({ method: "POST", body: { reply: "thanks" } }),
    );
  });

  it("returns the persisted reply from the updated review", async () => {
    fetchJsonMock.mockResolvedValue({
      ok: true,
      data: {
        review: { id: "r1", seller_reply: "thanks", seller_replied_at: "2026-08-31T00:00:00Z" },
      },
    });
    const res = await replyToSellerReview("r1", "thanks");
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.reply.body).toBe("thanks");
      expect(res.data.reply.created_at).toBe("2026-08-31T00:00:00Z");
    }
  });

  it("falls back to the submitted body when the server omits the review", async () => {
    fetchJsonMock.mockResolvedValue({ ok: true, data: { review: null } });
    const res = await replyToSellerReview("r1", "thanks");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.reply.body).toBe("thanks");
  });

  it("propagates failure shape", async () => {
    fetchJsonMock.mockResolvedValue({ ok: false, error: "forbidden" });
    const res = await replyToSellerReview("r1", "x");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("forbidden");
  });
});
