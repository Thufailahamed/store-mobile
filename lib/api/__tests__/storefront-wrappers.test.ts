import { describe, it, expect, beforeEach, vi } from "vitest";

const fetchJsonMock = vi.fn();

vi.mock("@/lib/api/_fetch", () => ({
  fetchJson: (...args: unknown[]) => fetchJsonMock(...args),
}));

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "tok" } } }) },
    rpc: vi.fn(),
    from: vi.fn(),
  },
}));

import {
  getStorefrontBackend,
  saveStorefrontDraftBackend,
  publishStorefrontBackend,
  createStorefrontPreviewTokenBackend,
  listStorefrontPreviewTokensBackend,
  revokeStorefrontPreviewTokenBackend,
  regenerateStorefrontSectionBackend,
} from "@/lib/api/backend";

beforeEach(() => fetchJsonMock.mockReset());

describe("storefront wrappers", () => {
  it("getStorefrontBackend passes channel param", async () => {
    fetchJsonMock.mockResolvedValue({ ok: true, status: 200, data: { storeId: "s1", channel: "web", config: { templateSlug: "editorial", sections: [] }, publishedAt: null, draftUpdatedAt: null, templateSlug: "editorial" } });
    await getStorefrontBackend("web");
    expect(fetchJsonMock).toHaveBeenCalledWith("/api/seller/storefront", { query: { channel: "web" } });
  });

  it("saveStorefrontDraftBackend patches config", async () => {
    fetchJsonMock.mockResolvedValue({ ok: true, status: 200, data: { ok: true } });
    await saveStorefrontDraftBackend("web", { templateSlug: "editorial", sections: [] });
    expect(fetchJsonMock).toHaveBeenCalledWith("/api/seller/storefront/draft", { method: "PATCH", query: { channel: "web" }, body: { templateSlug: "editorial", sections: [] } });
  });

  it("publishStorefrontBackend posts channel", async () => {
    fetchJsonMock.mockResolvedValue({ ok: true, status: 200, data: { publishedAt: "2026-08-28T00:00:00Z" } });
    await publishStorefrontBackend({ channel: "both", version: 2 });
    expect(fetchJsonMock).toHaveBeenCalledWith("/api/seller/storefront/publish", { method: "POST", body: { channel: "both", version: 2 } });
  });

  it("createStorefrontPreviewTokenBackend posts channel", async () => {
    fetchJsonMock.mockResolvedValue({ ok: true, status: 200, data: { token: "abc", channel: "app", expiresAt: "2026-09-11", createdAt: "2026-08-28" } });
    await createStorefrontPreviewTokenBackend({ channel: "app", ttlHours: 24 });
    expect(fetchJsonMock).toHaveBeenCalledWith("/api/seller/storefront/share/preview", { method: "POST", body: { channel: "app", ttlHours: 24 } });
  });

  it("listStorefrontPreviewTokensBackend gets tokens", async () => {
    fetchJsonMock.mockResolvedValue({ ok: true, status: 200, data: { tokens: [] } });
    await listStorefrontPreviewTokensBackend();
    expect(fetchJsonMock).toHaveBeenCalledWith("/api/seller/storefront/share/preview", { method: "GET" });
  });

  it("revokeStorefrontPreviewTokenBackend deletes by token", async () => {
    fetchJsonMock.mockResolvedValue({ ok: true, status: 200, data: { revoked: true } });
    await revokeStorefrontPreviewTokenBackend("abc");
    expect(fetchJsonMock).toHaveBeenCalledWith("/api/seller/storefront/share/preview/abc", { method: "DELETE" });
  });

  it("regenerateStorefrontSectionBackend posts section id", async () => {
    fetchJsonMock.mockResolvedValue({ ok: true, status: 200, data: { proposed: { headline: "x" } } });
    await regenerateStorefrontSectionBackend({ sectionId: "hero-1", sectionType: "hero", currentContent: {} });
    expect(fetchJsonMock).toHaveBeenCalledWith("/api/seller/storefront/ai/edit", { method: "POST", body: { sectionId: "hero-1", sectionType: "hero", currentContent: {} } });
  });
});
