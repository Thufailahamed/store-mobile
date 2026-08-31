/**
 * voteReviewHelpfulBackend — facade wrapper around the existing backend fn
 * (POST /api/reviews/:id/vote). The backend fn already exists; this test
 * pins the facade exposure so consumers can `import { voteReviewHelpfulBackend }`.
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

import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchJson } from "@/lib/api/_fetch";
import { voteReviewHelpfulBackend } from "../index";

const fetchJsonMock = vi.mocked(fetchJson);

describe("voteReviewHelpfulBackend facade", () => {
  beforeEach(() => fetchJsonMock.mockReset());

  it("delegates to backend.ts voteReviewHelpfulBackend with review id", async () => {
    fetchJsonMock.mockResolvedValue({ ok: true, data: { voted: true, helpful_count: 4 } });
    const res = await voteReviewHelpfulBackend("r-99");
    expect(fetchJsonMock).toHaveBeenCalledWith(
      "/api/reviews/r-99/vote",
      expect.objectContaining({ method: "POST" }),
    );
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.helpful_count).toBe(4);
  });

  it("propagates failures", async () => {
    fetchJsonMock.mockResolvedValue({ ok: false, error: "rate_limited" });
    const res = await voteReviewHelpfulBackend("r-1");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("rate_limited");
  });
});
