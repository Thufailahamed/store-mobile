import { describe, it, expect, beforeEach, vi } from "vitest";

const h = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  server: {} as Record<string, boolean>,
  list: vi.fn(),
  add: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (k: string) => h.storage.get(k) ?? null,
    setItem: async (k: string, v: string) => {
      h.storage.set(k, v);
    },
    removeItem: async (k: string) => {
      h.storage.delete(k);
    },
  },
}));

vi.mock("@/lib/api/backend", () => ({
  listWishlistBackend: h.list,
  addWishlistBackend: h.add,
  removeWishlistBackend: h.remove,
}));

async function freshStore() {
  vi.resetModules();
  const mod = await import("@/lib/stores/wishlist-store");
  await new Promise((r) => setTimeout(r, 30));
  return mod.useWishlist;
}

beforeEach(() => {
  h.storage.clear();
  h.server = {};
  h.list.mockReset();
  h.add.mockReset();
  h.remove.mockReset();
  h.list.mockImplementation(async () => ({
    ok: true,
    data: { items: Object.keys(h.server).map((id) => ({ product_id: id })) },
  }));
  h.add.mockImplementation(async (id: string) => {
    h.server[id] = true;
    return { ok: true, data: { added: true } };
  });
  h.remove.mockImplementation(async (id: string) => {
    delete h.server[id];
    return { ok: true, data: { removed: true } };
  });
});

describe("mobile wishlist persistence", () => {
  it("guest add survives an app restart", async () => {
    const first = await freshStore();
    first.getState().toggle("p-guest");
    await new Promise((r) => setTimeout(r, 30));
    expect(Object.keys(first.getState().items)).toEqual(["p-guest"]);

    const second = await freshStore();
    expect(Object.keys(second.getState().items)).toEqual(["p-guest"]);
  });

  it("guest add survives login (server push) and restart", async () => {
    const first = await freshStore();
    first.getState().toggle("p-guest");
    await new Promise((r) => setTimeout(r, 30));

    await first.getState().loadFromServer("u1");
    expect(Object.keys(first.getState().items)).toContain("p-guest");

    await first.getState().syncToServer("u1");
    expect(h.server["p-guest"]).toBe(true);

    const second = await freshStore();
    await second.getState().loadFromServer("u1");
    expect(Object.keys(second.getState().items)).toContain("p-guest");
  });

  it("logout clears local state and re-login restores from the server", async () => {
    h.server = { "p-server": true };
    const first = await freshStore();
    await first.getState().loadFromServer("u1");
    expect(Object.keys(first.getState().items)).toContain("p-server");

    first.getState().clear();
    first.persist.clearStorage();
    await new Promise((r) => setTimeout(r, 30));
    expect(Object.keys(first.getState().items)).toEqual([]);

    const second = await freshStore();
    await second.getState().loadFromServer("u1");
    expect(Object.keys(second.getState().items)).toContain("p-server");
  });

  it("does not drop an add when pending clears while a stale server read is in flight", async () => {
    const store = await freshStore();
    await store.getState().loadFromServer("u1");

    store.getState().toggle("p-race");
    expect(Object.keys(store.getState().items)).toContain("p-race");

    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    // The GET was issued before the POST committed, so its payload does not
    // contain p-race. The POST completes (pending cleared) while the GET is
    // still in flight.
    h.list.mockImplementationOnce(async () => {
      await gate;
      return { ok: true, data: { items: [] } };
    });

    const refresh = store.getState().refreshFromServer("u1");
    store.setState({ pending: {} });
    release();
    await refresh;

    expect(Object.keys(store.getState().items)).toContain("p-race");
  });

  it("replays opposite ops in issue order — a slow add can't resurrect after its remove", async () => {
    const store = await freshStore();
    await store.getState().loadFromServer("u1");

    // The add POST resolves slowly, after the remove DELETE has landed.
    h.add.mockImplementation(async (id: string) => {
      await new Promise((r) => setTimeout(r, 40));
      h.server[id] = true;
      return { ok: true, data: { added: true } };
    });

    store.getState().toggle("p-race");
    const first = store.getState().syncToServer("u1"); // replays ADD (slow)
    store.getState().toggle("p-race");
    const second = store.getState().syncToServer("u1"); // replays REMOVE
    await Promise.all([first, second]);

    // Overlapping replays would let the late ADD land after the REMOVE and
    // resurrect the item on the server.
    expect(h.server["p-race"]).toBeUndefined();
  });
});
