import type { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "../app/api/console/memory/replay/route";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  vi.restoreAllMocks();
  process.env = { ...ORIGINAL_ENV };
});

describe("memory replay BFF route", () => {
  it("requires a conversation id before calling the backend", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    const response = await POST(jsonRequest({ conversationId: "   " }));

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({ detail: "conversationId is required" });
  });

  it("encodes conversation ids and clamps replay limits", async () => {
    process.env.AGENT_API_BASE_URL = "http://agent.internal";
    process.env.FRONTEND_AUTH_MODE = "demo";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(memoryReplayFixture), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );

    const response = await POST(
      jsonRequest({
        conversationId: " conv/with space ",
        limit: 99999
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(memoryReplayFixture);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [target, init] = fetchMock.mock.calls[0];
    const url = new URL(String(target));
    expect(init?.method).toBe("GET");
    expect(url.origin).toBe("http://agent.internal");
    expect(url.pathname).toBe("/api/v1/admin/conversations/conv%2Fwith%20space/memory/replay");
    expect(url.searchParams.get("limit")).toBe("20000");
  });

  it("omits zero limits so mixed-version backends can use their default", async () => {
    process.env.AGENT_API_BASE_URL = "http://agent.internal";
    process.env.FRONTEND_AUTH_MODE = "demo";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(memoryReplayFixture), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );

    const response = await POST(
      jsonRequest({
        conversationId: "conv_monitor_pii_leak",
        limit: 0
      })
    );

    expect(response.status).toBe(200);
    const [target] = fetchMock.mock.calls[0];
    const url = new URL(String(target));
    expect(url.pathname).toBe("/api/v1/admin/conversations/conv_monitor_pii_leak/memory/replay");
    expect(url.searchParams.has("limit")).toBe(false);
  });
});

function jsonRequest(body: unknown) {
  return new Request("http://console.local/api/console/memory/replay", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }) as unknown as NextRequest;
}

const memoryReplayFixture = {
  conversation_id: "conv/with space",
  state: {
    tenant_id: "demo_tenant",
    conversation_id: "conv/with space",
    user_id: "user_demo",
    messages: [
      {
        id: "msg_1",
        tenant_id: "demo_tenant",
        conversation_id: "conv/with space",
        user_id: "user_demo",
        role: "user",
        content: "My order A1001 arrived broken.",
        created_at: "2026-07-05T00:00:00Z",
        metadata: {}
      }
    ],
    facts: {
      order_id: "A1001"
    },
    working_summary: "User needs help with a damaged order.",
    open_questions: [],
    last_intent: "refund_or_return",
    updated_at: "2026-07-05T00:00:01Z"
  },
  event_count: 3,
  replayed_message_count: 1,
  replayed_run_count: 1,
  ignored_event_count: 1
};
