import { describe, it, expect, vi, beforeEach } from "vitest";

const fetchJsonMock = vi.fn();
vi.mock("@/lib/api/_fetch", () => ({
  fetchJson: (...args: unknown[]) => fetchJsonMock(...args),
}));

import { getSellerAuditLogBackend } from "@/lib/api/backend";

beforeEach(() => {
  fetchJsonMock.mockReset();
});

describe("getSellerAuditLogBackend", () => {
  it("hits /api/seller/audit without params", async () => {
    fetchJsonMock.mockResolvedValueOnce({ ok: true, data: { entries: [], store_id: "s1" } });
    await getSellerAuditLogBackend();
    expect(fetchJsonMock).toHaveBeenCalledWith("/api/seller/audit");
  });

  it("passes entity_type and limit", async () => {
    fetchJsonMock.mockResolvedValueOnce({ ok: true, data: { entries: [] } });
    await getSellerAuditLogBackend({ entityType: "product", limit: 50 });
    expect(fetchJsonMock).toHaveBeenCalledWith("/api/seller/audit?entity_type=product&limit=50");
  });
});
