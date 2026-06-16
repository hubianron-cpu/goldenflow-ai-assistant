import { createAuditLog } from "@/lib/audit/audit-log";
import { checkCanSend } from "@/lib/pilot/guards";
import { getPilotState, savePilotState } from "@/lib/pilot/server-store";
import { getWhatsAppProvider } from "@/services/messaging/whatsapp";
import type { OutboundMessageAttempt } from "@/lib/store/types";

function uid(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export async function approveDraftAndSend(input: { draftId: string; actorId: string; editedText?: string }) {
  let state = getPilotState();
  const business = state.business;
  if (!business) throw new Error("Missing business.");
  const draft = state.outboundDrafts.find((item) => item.id === input.draftId);
  if (!draft) return { ok: false, status: "blocked", reason: "draft not found" };
  if (["sent", "approved"].includes(draft.status)) return { ok: false, status: "duplicate", reason: "draft already approved or sent" };
  const lead = state.leads.find((item) => item.id === draft.leadId);
  const conversation = state.conversations.find((item) => item.id === draft.conversationId);
  if (!lead || !conversation) return { ok: false, status: "blocked", reason: "lead or conversation not found" };
  const latestMessageIds = state.messages.filter((message) => message.conversationId === conversation.id && message.sender === "lead").map((message) => message.id);
  const sendGuard = checkCanSend({ business, lead, conversation, latestMessageIds, draftSourceMessageIds: draft.sourceMessageIds });
  const now = new Date().toISOString();
  const updatedDraft = {
    ...draft,
    draftMessage: input.editedText ?? draft.draftMessage,
    status: sendGuard.allowed ? "approved" as const : "blocked" as const,
    blockReason: sendGuard.allowed ? null : sendGuard.reason,
    approvedBy: sendGuard.allowed ? input.actorId : null,
    approvedAt: sendGuard.allowed ? now : null,
    editedAt: input.editedText && input.editedText !== draft.draftMessage ? now : draft.editedAt,
    updatedAt: now
  };

  if (!sendGuard.allowed) {
    state = {
      ...state,
      outboundDrafts: state.outboundDrafts.map((item) => (item.id === draft.id ? updatedDraft : item)),
      auditLogs: [
        createAuditLog({
          businessId: business.id,
          actorType: "user",
          actorId: input.actorId,
          action: "draft_send_blocked",
          entityType: "outbound_draft",
          entityId: draft.id,
          result: "blocked",
          metadata: { reason: sendGuard.reason }
        }),
        ...state.auditLogs
      ]
    };
    savePilotState(state);
    return { ok: false, status: "blocked", reason: sendGuard.reason };
  }

  const idempotencyKey = `${business.id}:${draft.id}:send`;
  const existingAttempt = state.outboundMessageAttempts.find((attempt) => attempt.idempotencyKey === idempotencyKey && ["sent", "queued"].includes(attempt.status));
  if (existingAttempt) {
    return { ok: false, status: "duplicate", reason: "send attempt already exists" };
  }
  const provider = getWhatsAppProvider();
  const sendResult = await provider.sendTextMessage(lead.normalizedPhone || lead.phone, updatedDraft.draftMessage, idempotencyKey);
  const attempt: OutboundMessageAttempt = {
    id: uid("send"),
    businessId: business.id,
    draftId: draft.id,
    conversationId: conversation.id,
    leadId: lead.id,
    provider: sendResult.provider,
    status: sendResult.status,
    idempotencyKey,
    externalMessageId: sendResult.externalMessageId,
    attemptCount: 1,
    maxAttempts: 3,
    lastError: sendResult.error ?? null,
    createdAt: now,
    sentAt: sendResult.ok ? now : null,
    updatedAt: now
  };

  state = {
    ...state,
    outboundDrafts: state.outboundDrafts.map((item) => (item.id === draft.id ? { ...updatedDraft, status: sendResult.ok ? "sent" : "blocked" } : item)),
    outboundMessageAttempts: [attempt, ...state.outboundMessageAttempts],
    auditLogs: [
      createAuditLog({
        businessId: business.id,
        actorType: "user",
        actorId: input.actorId,
        action: sendResult.ok ? "whatsapp_message_sent" : "whatsapp_send_failed",
        entityType: "outbound_draft",
        entityId: draft.id,
        result: sendResult.ok ? "success" : "failed",
        metadata: { status: sendResult.status, error: sendResult.error ?? null }
      }),
      ...state.auditLogs
    ],
    pilotUsageCounters: {
      ...state.pilotUsageCounters,
      draftsApproved: state.pilotUsageCounters.draftsApproved + 1,
      draftsEdited: input.editedText && input.editedText !== draft.draftMessage ? state.pilotUsageCounters.draftsEdited + 1 : state.pilotUsageCounters.draftsEdited,
      outgoingMessagesCount: sendResult.ok ? state.pilotUsageCounters.outgoingMessagesCount + 1 : state.pilotUsageCounters.outgoingMessagesCount,
      whatsappSendFailures: sendResult.ok ? state.pilotUsageCounters.whatsappSendFailures : state.pilotUsageCounters.whatsappSendFailures + 1
    }
  };
  savePilotState(state);
  return { ok: sendResult.ok, status: sendResult.status, reason: sendResult.error ?? "sent" };
}
