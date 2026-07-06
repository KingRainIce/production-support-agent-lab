import type { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "../app/api/console/triage/route";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  vi.restoreAllMocks();
  process.env = { ...ORIGINAL_ENV };
});

describe("triage BFF route", () => {
  it("forwards guarded triage writes with an expected alert fingerprint", async () => {
    process.env.AGENT_API_BASE_URL = "http://agent.internal";
    process.env.FRONTEND_AUTH_MODE = "demo";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        id: "triage_1",
        alert_key: "agent:order:TIMEOUT",
        status: "acknowledged",
        assignee_user_id: "ops",
        actor_user_id: "console",
        note: "ack",
        created_at: "2026-07-06T00:00:00Z"
      })
    );

    const response = await POST(
      jsonRequest("/api/console/triage", {
        alertKey: "agent:order:TIMEOUT",
        status: "acknowledged",
        assigneeUserId: "ops",
        note: "ack",
        expectedAlert: {
          status: "open",
          assigneeUserId: null,
          count: 2,
          lastSeenAt: "2026-07-06T00:00:00.000Z",
          lastTriageEventId: null,
          newEventsSinceTriage: false
        }
      })
    );

    expect(response.status).toBe(200);
    const [target, init] = fetchMock.mock.calls[0];
    expect(String(target)).toBe(
      "http://agent.internal/api/v1/admin/monitor/alerts/agent%3Aorder%3ATIMEOUT/triage"
    );
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({
      status: "acknowledged",
      assignee_user_id: "ops",
      note: "ack",
      expected_alert: {
        status: "open",
        assignee_user_id: null,
        count: 2,
        last_seen_at: "2026-07-06T00:00:00.000Z",
        last_triage_event_id: null,
        new_events_since_triage: false
      }
    });
  });

  it("passes backend stale snapshot conflicts back to the console", async () => {
    process.env.AGENT_API_BASE_URL = "http://agent.internal";
    process.env.FRONTEND_AUTH_MODE = "demo";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(
        {
          detail:
            "Monitor alert changed since the console snapshot; refresh before triage (status)."
        },
        409
      )
    );

    const response = await POST(
      jsonRequest("/api/console/triage", {
        alertKey: "agent:order:TIMEOUT",
        status: "resolved",
        expectedAlert: {
          status: "open",
          assigneeUserId: null,
          count: 1,
          lastSeenAt: "2026-07-06T00:00:00.000Z",
          lastTriageEventId: null,
          newEventsSinceTriage: false
        }
      })
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      detail: "Monitor alert changed since the console snapshot; refresh before triage (status)."
    });
  });

  it("rejects missing alert keys before proxying", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    const response = await POST(jsonRequest("/api/console/triage", { status: "acknowledged" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ detail: "alertKey is required" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

function jsonRequest(path: string, body: unknown) {
  return new Request(`http://console.local${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }) as unknown as NextRequest;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
