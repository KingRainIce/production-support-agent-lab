import { NextRequest, NextResponse } from "next/server";
import { agentFetch, issueFrom } from "@/src/server/agentApi";
import type { IncidentBriefResponse } from "@/src/shared/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const runId = request.nextUrl.searchParams.get("runId")?.trim();
  if (!runId) {
    return NextResponse.json({ detail: "runId is required" }, { status: 400 });
  }
  const includeMemory = request.nextUrl.searchParams.get("include_memory") !== "false";
  const limit = clampNumber(request.nextUrl.searchParams.get("limit"), 1, 1000, 500);
  try {
    const brief = await agentFetch<IncidentBriefResponse>(
      `/api/v1/admin/incidents/runs/${encodeURIComponent(runId)}/brief`,
      {
        query: {
          include_memory: includeMemory,
          limit
        }
      }
    );
    return NextResponse.json(brief);
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
