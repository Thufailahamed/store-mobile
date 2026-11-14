import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/_fetch", () => ({
  fetchJson: vi.fn(),
  getStoreApiUrl: () => "https://api.test",
}));

vi.mock("@/lib/posts/viewer", () => ({
  getPostViewerId: async () => "viewer-123",
}));

const { publicPostsApi } = await import("@/lib/posts/api");
const { fetchJson } = await import("@/lib/api/_fetch");

describe("public posts feed API", () => {
  it("sends the ranked cursor, viewer id and optional auth", async () => {
    (fetchJson as any).mockResolvedValue({
      ok: true,
      data: { items: [], next_offset: 16, suggested_stores: [] },
    });

    const page = await publicPostsApi.feed({ offset: 8, limit: 8, kind: "all" });

    expect(fetchJson).toHaveBeenCalledWith("/api/catalog/posts/feed", {
      requireAuth: false,
      optionalAuth: true,
      query: { offset: 8, limit: 8, kind: "all", viewer_id: "viewer-123" },
    });
    expect(page.next_offset).toBe(16);
  });

  it("treats a missing cursor from an older backend as the last page", async () => {
    (fetchJson as any).mockResolvedValue({
      ok: true,
      data: { items: [], suggested_stores: [] },
    });

    const page = await publicPostsApi.feed();

    expect(page.next_offset).toBeNull();
  });
});
