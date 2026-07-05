import type { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "../app/api/console/operations/automation-plan/route";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  vi.restoreAllMocks();
  process.env = { ...ORIGINAL_ENV };
});

describe("operations automation plan BFF route", () => {
  it("proxies the backend automation plan with bounded query parameters", async () => {
    process.env.AGENT_API_BASE_URL = "http://agent.internal";
    process.env.FRONTEND_AUTH_MODE = "demo";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        schema_version: "ops_automation.v1",
        generated_at: "2026-07-05T00:00:00.000Z",
        environment: "development",
        source: "event_store",
        window_hours: 24,
        health_status: "degraded",
        action_count: 1,
        auto_executable_count: 1,
        actions: [
          {
            id: "ops_generate_incident_brief_abc",
            kind: "generate_incident_brief",
            priority: "P1",
            title: "Generate sanitized incident brief",
            detail: "Prepare an operator-safe brief.",
            safe_to_auto_execute: true,
            required_scopes: ["events:read", "monitor:read"],
            command: {
              method: "GET",
              path: "/api/v1/admin/incidents/runs/run_1/brief",
              query: { include_memory: true },
              body: {}
            },
            evidence: {}
          }
        ],
        evidence: {},
        guardrails: ["Read-only plan."]
      })
    );

    const response = await GET(
      getRequest(
        "/api/console/operations/automation-plan?source=live&deep=true&window_hours=999&limit=0&stale_after_minutes=2000&max_tool_failure_rate=0.25"
      )
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.schema_version).toBe("ops_automation.v1");
    const [target] = fetchMock.mock.calls[0];
    const url = new URL(String(target));
    expect(url.pathname).toBe("/api/v1/admin/operations/automation-plan");
    expect(url.searchParams.get("source")).toBe("live");
    expect(url.searchParams.get("deep")).toBe("true");
    expect(url.searchParams.get("window_hours")).toBe("168");
    expect(url.searchParams.get("limit")).toBe("1");
    expect(url.searchParams.get("stale_after_minutes")).toBe("1440");
    expect(url.searchParams.get("max_tool_failure_rate")).toBe("0.25");
  });
});

function getRequest(path: string) {
  return { nextUrl: new URL(`http://console.local${path}`) } as unknown as NextRequest;
}
