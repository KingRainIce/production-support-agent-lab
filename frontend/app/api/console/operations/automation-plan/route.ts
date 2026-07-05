import { NextRequest, NextResponse } from "next/server";
import { agentFetch, issueFrom } from "@/src/server/agentApi";
import type { OperationsAutomationPlan } from "@/src/shared/types";

export const dynamic = "force-dynamic";

const SOURCES = new Set(["event_store", "live"]);

export async function GET(request: NextRequest) {
  const sourceParam = request.nextUrl.searchParams.get("source");
  const source = sourceParam && SOURCES.has(sourceParam) ? sourceParam : "event_store";
  const deep = request.nextUrl.searchParams.get("deep") === "true";
  const windowHours = clampNumber(request.nextUrl.searchParams.get("window_hours"), 1, 168, 24);
  const limit = clampNumber(request.nextUrl.searchParams.get("limit"), 1, 1000, 500);
  const staleAfterMinutes = clampNumber(request.nextUrl.searchParams.get("stale_after_minutes"), 1, 1440, 60);
  const maxActiveP0P1Alerts = clampNumber(request.nextUrl.searchParams.get("max_active_p0p1_alerts"), 0, 100, 0);
  const maxActiveAlerts = clampNumber(request.nextUrl.searchParams.get("max_active_alerts"), 0, 1000, 10);
  const maxToolFailureRate = clampFloat(request.nextUrl.searchParams.get("max_tool_failure_rate"), 0, 1, 0.05);
  const maxFeedbackNegativeRate = clampFloat(
    request.nextUrl.searchParams.get("max_feedback_negative_rate"),
    0,
    1,
    0.4
  );
  const maxEvalAgeHours = clampNumber(request.nextUrl.searchParams.get("max_eval_age_hours"), 1, 720, 24);
  const minToolCalls = clampNumber(request.nextUrl.searchParams.get("min_tool_calls"), 0, 10000, 1);
  const minFeedbackCount = clampNumber(request.nextUrl.searchParams.get("min_feedback_count"), 0, 10000, 5);
  try {
    const plan = await agentFetch<OperationsAutomationPlan>(
      "/api/v1/admin/operations/automation-plan",
      {
        query: {
          source,
          deep,
          window_hours: windowHours,
          limit,
          stale_after_minutes: staleAfterMinutes,
          max_active_p0p1_alerts: maxActiveP0P1Alerts,
          max_active_alerts: maxActiveAlerts,
          max_tool_failure_rate: maxToolFailureRate,
          max_feedback_negative_rate: maxFeedbackNegativeRate,
          max_eval_age_hours: maxEvalAgeHours,
          min_tool_calls: minToolCalls,
          min_feedback_count: minFeedbackCount
        }
      }
    );
    return NextResponse.json(plan);
  } catch (error) {
    const issue = issueFrom(error);
    return NextResponse.json({ detail: issue.detail }, { status: issue.status });
  }
}

function clampNumber(value: string | null, min: number, max: number, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

function clampFloat(value: string | null, min: number, max: number, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, parsed));
}
