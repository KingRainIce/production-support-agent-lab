import type { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "../app/api/console/incidents/brief/route";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  vi.restoreAllMocks();
  process.env = { ...ORIGINAL_ENV };
});

describe("incident brief BFF route", () => {
  it("proxies backend-generated sanitized incident briefs", async () => {
    process.env.AGENT_API_BASE_URL = "http://agent.internal";
    process.env.FRONTEND_AUTH_MODE = "demo";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        schema_version: "incident_brief.v1",
        generated_at: "2026-07-05T00:00:00.000Z",
        title: "TIMEOUT clustered across 1 event(s)",
        risk_label: "P1",
        summary: "Run run_1 handled order_status via order_agent.",
        run_id: "run_1",
        conversation_id: "conv_1",
        run_source: "event_store",
        alert_key: "agent:order:TIMEOUT",
        recommended_actions: ["Inspect tool audit."],
        evidence: {},
        redactions: ["message_content"],
        markdown: "# PSA Lab Incident Brief"
      })
    );

    const response = await GET(
      getRequest("/api/console/incidents/brief?runId=run_1&include_memory=false&limit=999999")
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.schema_version).toBe("incident_brief.v1");
    const [target] = fetchMock.mock.calls[0];
    const url = new URL(String(target));
    expect(url.pathname).toBe("/api/v1/admin/incidents/runs/run_1/brief");
    expect(url.searchParams.get("include_memory")).toBe("false");
    expect(url.searchParams.get("limit")).toBe("1000");
  });

  it("requires a run id", async () => {
    const response = await GET(getRequest("/api/console/incidents/brief"));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ detail: "runId is required" });
  });
});

function getRequest(path: string) {
  return { nextUrl: new URL(`http://console.local${path}`) } as unknown as NextRequest;
}
