import { describe, it, expect, beforeEach, vi } from "vitest";

const { storageState, AsyncStorageMock, saveStorefrontDraftBackendMock } = vi.hoisted(() => {
  const state: Record<string, string> = {};
  const AsyncStorageMock = {
    getItem: vi.fn(async (k: string) => state[k] ?? null),
    setItem: vi.fn(async (k: string, v: string) => { state[k] = v; }),
    removeItem: vi.fn(async (k: string) => { delete state[k]; }),
    getAllKeys: vi.fn(async () => Object.keys(state)),
  };
  const saveStorefrontDraftBackendMock = vi.fn();
  return { storageState: state, AsyncStorageMock, saveStorefrontDraftBackendMock };
});

vi.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: AsyncStorageMock,
}));

vi.mock("@/lib/api/backend", () => ({
  saveStorefrontDraftBackend: (...args: unknown[]) => saveStorefrontDraftBackendMock(...args),
}));

import { loadDraft, saveDraft, clearDraft, flushAllOnOnline } from "@/lib/storefront/draft-cache";

const key = (s: string, c: string) => `storefront-draft:${s}:${c}`;

beforeEach(() => {
  Object.keys(storageState).forEach((k) => delete storageState[k]);
  AsyncStorageMock.getItem.mockClear();
  AsyncStorageMock.setItem.mockClear();
  AsyncStorageMock.removeItem.mockClear();
  AsyncStorageMock.getAllKeys.mockClear();
  saveStorefrontDraftBackendMock.mockReset();
});

describe("draft-cache", () => {
  it("loadDraft returns null when missing", async () => {
    expect(await loadDraft("s1", "web")).toBeNull();
  });

  it("saveDraft writes JSON to AsyncStorage", async () => {
    await saveDraft("s1", "web", { templateSlug: "editorial", sections: [] });
    expect(AsyncStorageMock.setItem).toHaveBeenCalledWith(
      key("s1", "web"),
      JSON.stringify({ templateSlug: "editorial", sections: [] }),
    );
    expect(storageState[key("s1", "web")]).toBe(JSON.stringify({ templateSlug: "editorial", sections: [] }));
  });

  it("clearDraft removes key", async () => {
    await clearDraft("s1", "web");
    expect(AsyncStorageMock.removeItem).toHaveBeenCalledWith(key("s1", "web"));
  });

  it("flushAllOnOnline sends all drafts", async () => {
    storageState[key("s1", "web")] = JSON.stringify({ templateSlug: "t1", sections: [] });
    storageState[key("s2", "app")] = JSON.stringify({ templateSlug: "t2", sections: [] });
    saveStorefrontDraftBackendMock.mockResolvedValue({ ok: true, status: 200, data: { ok: true } });

    const result = await flushAllOnOnline();

    expect(saveStorefrontDraftBackendMock).toHaveBeenCalledTimes(2);
    expect(saveStorefrontDraftBackendMock).toHaveBeenNthCalledWith(1, "web", { templateSlug: "t1", sections: [] });
    expect(saveStorefrontDraftBackendMock).toHaveBeenNthCalledWith(2, "app", { templateSlug: "t2", sections: [] });
    expect(result).toEqual({ flushed: 2, errors: 0 });
  });
});
