import { NextRequest, NextResponse } from "next/server";
import { agentFetch, issueFrom } from "@/src/server/agentApi";
import type { AlertWebhookReceiptRecord } from "@/src/shared/types";

export const dynamic = "force-dynamic";

type BackendAlertWebhookReceiptRecord = AlertWebhookReceiptRecord & {
  tenant_id: string;
  signature_hash: string;
  source_hash: string | null;
  user_agent_hash: string | null;
};

export async function GET(request: NextRequest) {
  try {
    const order = request.nextUrl.searchParams.get("order") ?? "desc";
    if (order !== "asc" && order !== "desc") {
      return NextResponse.json({ detail: "order must be asc or desc" }, { status: 400 });
    }

    const receipts = await agentFetch<BackendAlertWebhookReceiptRecord[]>(
      "/api/v1/admin/monitor/alert-webhook-receipts",
      {
        query: {
          alert_key: normalizedParam(request, "alertKey"),
          delivery_id: normalizedParam(request, "deliveryId"),
          limit: boundedLimit(request.nextUrl.searchParams.get("limit")),
          order
        }
      }
    );
    return NextResponse.json(receipts.map(toConsoleReceipt));
  } catch (error) {
    const issue = issueFrom(error);
    return NextResponse.json({ detail: issue.detail }, { status: issue.status });
  }
}

function toConsoleReceipt(record: BackendAlertWebhookReceiptRecord): AlertWebhookReceiptRecord {
  return {
    delivery_id: record.delivery_id,
    alert_key: record.alert_key,
    severity: record.severity,
    body_hash: record.body_hash,
    alert_count: record.alert_count,
    sample_event_count: record.sample_event_count,
    sample_run_count: record.sample_run_count,
    duplicate_count: record.duplicate_count,
    first_received_at: record.first_received_at,
    last_received_at: record.last_received_at,
    created_at: record.created_at,
    updated_at: record.updated_at
  };
}

function normalizedParam(request: NextRequest, name: string) {
  const value = request.nextUrl.searchParams.get(name)?.trim();
  return value ? value : null;
}

function boundedLimit(value: string | null) {
  const parsed = value ? Number.parseInt(value, 10) : 50;
  if (!Number.isFinite(parsed)) {
    return 50;
  }
  return Math.min(200, Math.max(1, parsed));
}
