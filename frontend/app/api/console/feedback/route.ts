import { NextRequest, NextResponse } from "next/server";
import { agentFetch, issueFrom } from "@/src/server/agentApi";
import type { AgentFeedback, FeedbackSearchResponse, FeedbackSummary } from "@/src/shared/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const limit = searchParams.get("limit") ?? "50";
  const order = searchParams.get("order") === "asc" ? "asc" : "desc";
  const query = {
    conversation_id: searchParams.get("conversationId"),
    run_id: searchParams.get("runId"),
    user_id: searchParams.get("userId"),
    rating: searchParams.get("rating"),
    created_after: searchParams.get("createdAfter"),
    created_before: searchParams.get("createdBefore"),
    limit,
    order
  };

  try {
    const [items, summary] = await Promise.all([
      agentFetch<AgentFeedback[]>("/api/v1/admin/feedback", { query }),
      agentFetch<FeedbackSummary>("/api/v1/admin/feedback/summary", { query })
    ]);
    const response: FeedbackSearchResponse = {
      items,
      summary,
      limit: Number(limit) || 50,
      order
    };
    return NextResponse.json(response);
  } catch (error) {
    const issue = issueFrom(error);
    return NextResponse.json({ detail: issue.detail }, { status: issue.status });
  }
}
