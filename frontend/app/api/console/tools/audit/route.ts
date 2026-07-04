import { NextRequest, NextResponse } from "next/server";
import { agentFetch, issueFrom } from "@/src/server/agentApi";
import type { ToolAuditRecord, ToolAuditSearchResponse, ToolAuditSummary } from "@/src/shared/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const limit = searchParams.get("limit") ?? "50";
  const order = searchParams.get("order") ?? "desc";
  const query = {
    tool_name: searchParams.get("toolName"),
    actor_user_id: searchParams.get("actorUserId"),
    trace_id: searchParams.get("traceId"),
    request_id: searchParams.get("requestId"),
    status: searchParams.get("status"),
    error_code: searchParams.get("errorCode"),
    replayed: searchParams.get("replayed"),
    created_after: searchParams.get("createdAfter"),
    created_before: searchParams.get("createdBefore")
  };

  try {
    const [records, summary] = await Promise.all([
      agentFetch<ToolAuditRecord[]>("/api/v1/admin/tools/audit", {
        query: {
          ...query,
          limit,
          order
        }
      }),
      agentFetch<ToolAuditSummary>("/api/v1/admin/tools/audit/summary", {
        query
      })
    ]);
    const response: ToolAuditSearchResponse = {
      records,
      summary,
      limit: Number(limit),
      order: order === "asc" ? "asc" : "desc"
    };
    return NextResponse.json(response);
  } catch (error) {
    const issue = issueFrom(error);
    return NextResponse.json({ detail: issue.detail }, { status: issue.status });
  }
}
