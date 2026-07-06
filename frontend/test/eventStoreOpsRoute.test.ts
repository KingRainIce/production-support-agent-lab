import type { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as backupPost } from "../app/api/console/event-store/backups/route";
import { POST as retentionPost } from "../app/api/console/event-store/retention/route";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  vi.restoreAllMocks();
  process.env = { ...ORIGINAL_ENV };
});

describe("event-store operations BFF routes", () => {
  it("creates verified backups without forwarding arbitrary paths", async () => {
    process.env.AGENT_API_BASE_URL = "http://agent.internal";
    process.env.FRONTEND_AUTH_MODE = "demo";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        source_path: "events.db",
        backup_path: "backups/support-agent-lab-demo.db",
        size_bytes: 4096,
        page_count: 1,
        started_at: "2026-07-05T00:00:00Z",
        completed_at: "2026-07-05T00:00:01Z",
        verified: true,
        verification_detail: "quick_check=ok",
        backup_token: "backup.token"
      })
    );

    const response = await backupPost(
      jsonRequest("/api/console/event-store/backups", {
        label: "../../release",
        path: "C:/should/not/forward.db",
        overwrite: true,
        verify: false
      })
    );

    expect(response.status).toBe(200);
    const [target, init] = fetchMock.mock.calls[0];
    expect(String(target)).toBe("http://agent.internal/api/v1/admin/event-store/backups");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({
      label: "../../release",
      overwrite: false,
      verify: true
    });
  });

  it("clamps retention day fields and defaults to dry-run", async () => {
    process.env.AGENT_API_BASE_URL = "http://agent.internal";
    process.env.FRONTEND_AUTH_MODE = "demo";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        tenant_id: "demo_tenant",
        dry_run: true,
        include_events: false,
        vacuum_requested: false,
        vacuum_performed: false,
        started_at: "2026-07-05T00:00:00Z",
        completed_at: "2026-07-05T00:00:01Z",
        tables: [],
        total_candidates: 0,
        total_deleted: 0,
        preview_token: "preview.token"
      })
    );

    const response = await retentionPost(
      jsonRequest("/api/console/event-store/retention", {
        dry_run: "please apply",
        include_events: true,
        vacuum: true,
        event_retention_days: 1,
        tool_audit_retention_days: 9999,
        idempotency_retention_days: -5,
        alert_delivery_retention_days: 3
      })
    );

    expect(response.status).toBe(200);
    const [target, init] = fetchMock.mock.calls[0];
    expect(String(target)).toBe("http://agent.internal/api/v1/admin/event-store/retention");
    expect(JSON.parse(String(init?.body))).toEqual({
      dry_run: true,
      include_events: true,
      vacuum: true,
      event_retention_days: 30,
      tool_audit_retention_days: 3650,
      idempotency_retention_days: 1,
      alert_delivery_retention_days: 7
    });
  });

  it("rejects retention apply without server-issued gate tokens", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    const response = await retentionPost(
      jsonRequest("/api/console/event-store/retention", {
        dry_run: false,
        include_events: true,
        apply_confirmed: true
      })
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      detail: "Verified backup token, preview token, and confirmation are required."
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards retention apply only with backup and preview tokens", async () => {
    process.env.AGENT_API_BASE_URL = "http://agent.internal";
    process.env.FRONTEND_AUTH_MODE = "demo";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        tenant_id: "demo_tenant",
        dry_run: false,
        include_events: true,
        vacuum_requested: true,
        vacuum_performed: false,
        started_at: "2026-07-05T00:00:00Z",
        completed_at: "2026-07-05T00:00:01Z",
        tables: [],
        total_candidates: 4,
        total_deleted: 4,
        preview_token: null
      })
    );

    const response = await retentionPost(
      jsonRequest("/api/console/event-store/retention", {
        dry_run: false,
        include_events: true,
        vacuum: true,
        event_retention_days: 365,
        backup_token: "backup.token",
        preview_token: "preview.token",
        apply_confirmed: true
      })
    );

    expect(response.status).toBe(200);
    const [target, init] = fetchMock.mock.calls[0];
    expect(String(target)).toBe("http://agent.internal/api/v1/admin/event-store/retention");
    expect(JSON.parse(String(init?.body))).toEqual({
      dry_run: false,
      include_events: true,
      vacuum: true,
      event_retention_days: 365,
      backup_token: "backup.token",
      preview_token: "preview.token",
      apply_confirmed: true
    });
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
