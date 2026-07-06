import { NextRequest, NextResponse } from "next/server";
import { agentFetch, issueFrom } from "@/src/server/agentApi";
import type { MonitorAlertTriageEvent } from "@/src/shared/types";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const alertKey = typeof payload.alertKey === "string" ? payload.alertKey : "";
    if (!alertKey) {
      return NextResponse.json({ detail: "alertKey is required" }, { status: 400 });
    }

    const event = await agentFetch<MonitorAlertTriageEvent>(
      `/api/v1/admin/monitor/alerts/${encodeURIComponent(alertKey)}/triage`,
      {
        method: "POST",
        body: {
          status: payload.status ?? null,
          assignee_user_id: payload.assigneeUserId ?? null,
          note: typeof payload.note === "string" ? payload.note : "",
          expected_alert: expectedAlertPayload(payload.expectedAlert)
        }
      }
    );
    return NextResponse.json(event);
  } catch (error) {
    const issue = issueFrom(error);
    return NextResponse.json({ detail: issue.detail }, { status: issue.status });
  }
}

function expectedAlertPayload(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.status !== "string" ||
    typeof record.count !== "number" ||
    typeof record.lastSeenAt !== "string" ||
    typeof record.newEventsSinceTriage !== "boolean"
  ) {
    return null;
  }
  return {
    status: record.status,
    assignee_user_id:
      typeof record.assigneeUserId === "string" ? record.assigneeUserId : null,
    count: record.count,
    last_seen_at: record.lastSeenAt,
    last_triage_event_id:
      typeof record.lastTriageEventId === "string" ? record.lastTriageEventId : null,
    new_events_since_triage: record.newEventsSinceTriage
  };
}
