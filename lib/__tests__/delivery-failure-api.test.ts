/**
 * Body-shape contract tests for the Phase 14 failure API surface.
 *
 * These tests do not hit a real server. They mock `storeApiFetch` and assert
 * that callers package the new failure_* fields into the JSON body so the
 * store-api can persist them.
 *
 * Risk #1 from the plan ("server may reject unknown body keys") is covered
 * separately by `deliveryTransition` itself, which retries with the legacy
 * 3-field body on a 4xx whose error string looks like an unknown-field
 * rejection.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// EXPO_PUBLIC_STORE_API_URL must be set BEFORE the delivery-api module
// evaluates its top-level constant. vi.hoisted runs before module import.
vi.hoisted(() => {
  process.env.EXPO_PUBLIC_STORE_API_URL =
    process.env.EXPO_PUBLIC_STORE_API_URL ?? "http://localhost:0";
});

// Mock supabase client so getAccessToken() returns a stable token and
// storeApiFetch can actually reach fetch().
vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: "test-token" } },
      }),
    },
  },
}));

const fetchMock = vi.fn();

// Import after the mock is registered and the env var is set.
import * as deliveryApi from "@/lib/api/delivery-api";
import { __resetReassignProbeForTests } from "@/lib/api/delivery-api";

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  __resetReassignProbeForTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

interface FetchCall {
  url: string;
  init: RequestInit;
}

function lastCall(): FetchCall {
  expect(fetchMock).toHaveBeenCalled();
  const [url, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
  return { url, init };
}

function parseBody(init: RequestInit): Record<string, unknown> {
  return JSON.parse((init.body as string) ?? "{}");
}

function okResponse(): Response {
  return new Response(JSON.stringify({ ok: true, status: "returned" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function errResponse(message: string, status = 400): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("deliveryTransition — body shape", () => {
  it("threads failure_reason, failure_notes, failure_evidence_url, attempt_count, next_retry_at", async () => {
    fetchMock.mockResolvedValueOnce(okResponse());
    await deliveryApi.deliveryTransition(
      "order-1",
      "returned",
      "Customer absent — gate locked",
      {
        failure_reason: "customer_absent",
        failure_notes: "Gate locked, no contact.",
        failure_evidence_url: "https://x/y.jpg",
        attempt_count: 2,
        next_retry_at: "2026-06-20T10:00:00Z",
      },
    );
    const { url, init } = lastCall();
    expect(url).toContain("/api/delivery/transition");
    expect(init.method).toBe("POST");
    const body = parseBody(init);
    expect(body).toMatchObject({
      order_id: "order-1",
      status: "returned",
      reason: "Customer absent — gate locked",
      failure_reason: "customer_absent",
      failure_notes: "Gate locked, no contact.",
      failure_evidence_url: "https://x/y.jpg",
      attempt_count: 2,
      next_retry_at: "2026-06-20T10:00:00Z",
    });
  });

  it("falls back to legacy 3-field body when server rejects unknown fields", async () => {
    fetchMock
      .mockResolvedValueOnce(errResponse("Unexpected field: failure_reason"))
      .mockResolvedValueOnce(okResponse());
    const res = await deliveryApi.deliveryTransition("order-2", "returned", "Customer absent", {
      failure_reason: "customer_absent",
      attempt_count: 1,
    });
    expect(res.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const retryInit = fetchMock.mock.calls[1][1] as RequestInit;
    const retryBody = parseBody(retryInit);
    expect(retryBody).toEqual({
      order_id: "order-2",
      status: "returned",
      reason: "Customer absent",
    });
  });

  it("does NOT retry when rejection message doesn't look like unknown-field", async () => {
    fetchMock.mockResolvedValueOnce(errResponse("Order not found", 404));
    const res = await deliveryApi.deliveryTransition("order-3", "returned", "x", {
      failure_reason: "refused",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("Order not found");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does NOT retry when opts has no failure fields", async () => {
    fetchMock.mockResolvedValueOnce(errResponse("Server down"));
    await deliveryApi.deliveryTransition("order-4", "out_for_delivery");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("scanPackage — fail_delivery body shape", () => {
  it("threads failure_reason + failure_evidence_url on fail_delivery", async () => {
    fetchMock.mockResolvedValueOnce(okResponse());
    await deliveryApi.scanPackage("pkg-tok", "fail_delivery", {
      failure_reason: "damaged",
      failure_evidence_url: "https://x/y.jpg",
      notes: "Package dented",
    });
    const body = parseBody(lastCall().init);
    expect(body).toMatchObject({
      action: "fail_delivery",
      failure_reason: "damaged",
      failure_evidence_url: "https://x/y.jpg",
      notes: "Package dented",
    });
  });

  it("omits failure_* keys when action is not fail_delivery", async () => {
    fetchMock.mockResolvedValueOnce(okResponse());
    await deliveryApi.scanPackage("pkg-tok", "start_delivery", {
      notes: "On the way",
    });
    const body = parseBody(lastCall().init);
    expect(body.action).toBe("start_delivery");
    expect(body.failure_reason).toBeUndefined();
    expect(body.failure_evidence_url).toBeUndefined();
  });
});

describe("deliveryPickupVerify — fail body shape", () => {
  it("threads failure_reason + failure_evidence_url on action=fail", async () => {
    fetchMock.mockResolvedValueOnce(okResponse());
    await deliveryApi.deliveryPickupVerify("pickup-1", "fail", {
      reason: "Store closed",
      photo_url: "https://x/y.jpg",
      notes: "Sign on door",
      failure_reason: "store_closed",
      failure_evidence_url: "https://x/y.jpg",
    });
    const body = parseBody(lastCall().init);
    expect(body).toMatchObject({
      pickup_id: "pickup-1",
      action: "fail",
      reason: "Store closed",
      failure_reason: "store_closed",
      failure_evidence_url: "https://x/y.jpg",
    });
  });
});

describe("reassignDelivery — body shape", () => {
  it("sends {order_id, to_rider_id} and returns ok on 2xx", async () => {
    // First call is the OPTIONS probe (responds 2xx → supported).
    // Second call is the POST /api/delivery/reassign.
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    fetchMock.mockResolvedValueOnce(okResponse());
    const res = await deliveryApi.reassignDelivery("order-9", "rider-7");
    expect(res.ok).toBe(true);
    const body = parseBody(lastCall().init);
    expect(body).toEqual({ order_id: "order-9", to_rider_id: "rider-7" });
  });

  it("returns reassign-not-supported on 404", async () => {
    fetchMock.mockResolvedValueOnce(errResponse("Not Found", 404));
    const res = await deliveryApi.reassignDelivery("order-9", "rider-7");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("reassign-not-supported");
  });
});

describe("isReassignAvailable — probe", () => {
  it("returns true on 2xx and caches result", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    const a = await deliveryApi.isReassignAvailable();
    const b = await deliveryApi.isReassignAvailable();
    expect(a).toBe(true);
    expect(b).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const probe = lastCall();
    expect(probe.init.method).toBe("OPTIONS");
  });

  it("returns false on 404 and caches result", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));
    const a = await deliveryApi.isReassignAvailable();
    const b = await deliveryApi.isReassignAvailable();
    expect(a).toBe(false);
    expect(b).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("treats 405 (Method Not Allowed) as supported", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 405 }));
    const ok = await deliveryApi.isReassignAvailable();
    expect(ok).toBe(true);
  });
});