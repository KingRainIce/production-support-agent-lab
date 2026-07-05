import { NextRequest, NextResponse } from "next/server";
import { agentFetch, issueFrom } from "@/src/server/agentApi";
import type { MemoryReplayResult } from "@/src/shared/types";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json().catch(() => ({}));
    const conversationId = typeof payload.conversationId === "string" ? payload.conversationId.trim() : "";
    if (!conversationId) {
      return NextResponse.json({ detail: "conversationId is required" }, { status: 400 });
    }
    const limit = clampNumber(payload.limit, 0, 20000, 0);
    const query = limit > 0 ? { limit } : undefined;
    const replay = await agentFetch<MemoryReplayResult>(
      `/api/v1/admin/conversations/${encodeURIComponent(conversationId)}/memory/replay`,
      {
        query
      }
    );
    return NextResponse.json(replay);
  } catch (error) {
    const issue = issueFrom(error);
    return NextResponse.json({ detail: issue.detail }, { status: issue.status });
  }
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(Math.trunc(parsed), min), max);
}
