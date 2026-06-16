import { NextRequest, NextResponse } from "next/server";
import { businessId } from "@/lib/store/demo-data";
import { getPilotState, savePilotState } from "@/lib/pilot/server-store";
import { processNormalizedIncomingMessage } from "@/lib/pilot/webhook-processor";
import { createAuditLog } from "@/lib/audit/audit-log";
import { getWhatsAppProvider } from "@/services/messaging/whatsapp";

export async function GET(request: NextRequest) {
  const provider = getWhatsAppProvider();
  const challenge = provider.verifyWebhookChallenge({
    mode: request.nextUrl.searchParams.get("hub.mode"),
    token: request.nextUrl.searchParams.get("hub.verify_token"),
    challenge: request.nextUrl.searchParams.get("hub.challenge")
  });
  if (!challenge) {
    return NextResponse.json({ ok: false, error: "webhook verification failed" }, { status: 403 });
  }
  return new NextResponse(challenge, { status: 200 });
}

export async function POST(request: NextRequest) {
  const provider = getWhatsAppProvider();
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  const validSignature = provider.validateWebhookSignature(rawBody, signature);
  if (!validSignature) {
    return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const stateBefore = getPilotState();
  const events = provider.parseIncomingWebhook(payload);
  const normalized = events.map((event) => provider.normalizeIncomingMessage(event, stateBefore.business?.id ?? businessId));
  const results = normalized.map((message) => processNormalizedIncomingMessage(message).status);
  let state = getPilotState();
  state = {
    ...state,
    whatsappConnections: state.whatsappConnections.map((connection) =>
      connection.businessId === (state.business?.id ?? businessId)
        ? { ...connection, lastWebhookAt: new Date().toISOString(), lastMessageAt: normalized.length ? new Date().toISOString() : connection.lastMessageAt, updatedAt: new Date().toISOString() }
        : connection
    ),
    auditLogs: [
      createAuditLog({
        businessId: state.business?.id ?? businessId,
        actorType: "webhook",
        actorId: null,
        action: "whatsapp_webhook_received",
        entityType: "webhook",
        entityId: normalized[0]?.externalEventId ?? "status_update",
        result: "success",
        metadata: { events: normalized.length }
      }),
      ...state.auditLogs
    ]
  };
  savePilotState(state);

  return NextResponse.json({ ok: true, accepted: results.filter((result) => result === "accepted").length, blocked: results.filter((result) => result === "blocked").length, duplicates: results.filter((result) => result === "duplicate").length });
}
