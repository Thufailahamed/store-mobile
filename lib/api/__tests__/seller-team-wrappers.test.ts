import { describe, it, expect, vi, beforeEach } from "vitest";

const fetchJsonMock = vi.fn();
vi.mock("@/lib/api/_fetch", () => ({
  fetchJson: (...args: unknown[]) => fetchJsonMock(...args),
}));

import {
  getSellerTeamBackend,
  inviteSellerTeamBackend,
  resendSellerTeamInviteBackend,
  removeSellerTeamMemberBackend,
} from "@/lib/api/backend";

beforeEach(() => {
  fetchJsonMock.mockReset();
});

describe("seller team wrappers", () => {
  it("getSellerTeamBackend hits GET /api/seller/team", async () => {
    fetchJsonMock.mockResolvedValueOnce({ ok: true, data: { members: [], invites: [] } });
    await getSellerTeamBackend();
    expect(fetchJsonMock).toHaveBeenCalledWith("/api/seller/team");
  });

  it("inviteSellerTeamBackend POSTs email + role", async () => {
    fetchJsonMock.mockResolvedValueOnce({ ok: true, data: { invite: { id: "i1" } } });
    await inviteSellerTeamBackend({ email: "a@b.c", role: "staff" });
    expect(fetchJsonMock).toHaveBeenCalledWith("/api/seller/team/invites", {
      method: "POST",
      body: { email: "a@b.c", role: "staff" },
    });
  });

  it("resendSellerTeamInviteBackend POSTs to /:id/resend", async () => {
    fetchJsonMock.mockResolvedValueOnce({ ok: true, data: { invite: { id: "i1" } } });
    await resendSellerTeamInviteBackend("i1");
    expect(fetchJsonMock).toHaveBeenCalledWith("/api/seller/team/invites/i1/resend", { method: "POST" });
  });

  it("removeSellerTeamMemberBackend DELETEs /members/:id", async () => {
    fetchJsonMock.mockResolvedValueOnce({ ok: true, data: { removed: true } });
    await removeSellerTeamMemberBackend("m1");
    expect(fetchJsonMock).toHaveBeenCalledWith("/api/seller/team/members/m1", { method: "DELETE" });
  });
});
