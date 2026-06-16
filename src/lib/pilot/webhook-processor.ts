import { businessId } from "@/lib/store/demo-data";
import { createAuditLog } from "@/lib/audit/audit-log";
import { createEmptyStructuredMemory, buildMemorySummary } from "@/lib/conversation/memory";
import { checkMessageSupported, checkPhoneAllowlist, checkPilotCanReceive, isOptOutText } from "@/lib/pilot/guards";
import { createBackgroundJob, createOrUpdateMessageBatch } from "@/lib/jobs/job-store";
import { getPilotState, savePilotState } from "@/lib/pilot/server-store";
import type { AppState, Conversation, Lead, Message, NormalizedIncomingMessage } from "@/lib/store/types";

function nowIso() {
  return new Date().toISOString();
}

function uid(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function findOrCreateLead(state: AppState, incoming: NormalizedIncomingMessage): { state: AppState; lead: Lead; created: boolean } {
  const existing = state.leads.find((lead) => lead.businessId === incoming.businessId && lead.normalizedPhone === incoming.normalizedSenderPhone);
  if (existing) return { state, lead: existing, created: false };
  const timestamp = nowIso();
  const lead: Lead = {
    id: uid("lead"),
    businessId: incoming.businessId,
    name: incoming.senderPhone,
    phone: incoming.senderPhone,
    normalizedPhone: incoming.normalizedSenderPhone,
    source: "WhatsApp",
    status: "פתוחה",
    heat: "קר",
    leadTemperature: "cold",
    leadScore: 0,
    intentScore: 0,
    engagementScore: 0,
    bookingProbability: 0,
    lastScoreReason: "נוצר מהודעת WhatsApp נכנסת",
    needSummary: "נוצר מפיילוט WhatsApp.",
    nextAction: "להמתין לעיבוד ראשוני",
    nextRecommendedAction: "wait",
    followUpAt: timestamp,
    externalLeadId: `wa_${incoming.normalizedSenderPhone}`,
    doNotContact: false,
    doNotContactAt: null,
    optOutReason: null,
    updatedAt: timestamp
  };
  return { state: { ...state, leads: [lead, ...state.leads] }, lead, created: true };
}

function findOrCreateConversation(state: AppState, incoming: NormalizedIncomingMessage, lead: Lead): { state: AppState; conversation: Conversation; created: boolean } {
  const existing = state.conversations.find((conversation) => conversation.businessId === incoming.businessId && conversation.leadId === lead.id);
  if (existing) return { state, conversation: existing, created: false };
  const timestamp = nowIso();
  const memory = {
    ...createEmptyStructuredMemory(),
    phone: incoming.senderPhone,
    lead_source: "WhatsApp"
  };
  const conversation: Conversation = {
    id: uid("conv"),
    businessId: incoming.businessId,
    leadId: lead.id,
    leadName: lead.name,
    leadPhone: lead.phone,
    lastMessage: incoming.text || `[${incoming.messageType}]`,
    heat: "קר",
    leadTemperature: "cold",
    leadScore: 0,
    intentScore: 0,
    engagementScore: 0,
    bookingProbability: 0,
    status: "פתוחה",
    conversationState: "new_lead",
    aiMode: "active",
    needsHuman: false,
    requiresOwnerAttention: false,
    takeoverReason: null,
    whatsappConnectionId: "wa_mock_connection",
    processingLockAt: null,
    processingLockExpiresAt: null,
    summary: "שיחה חדשה מ-WhatsApp.",
    summaryDetails: {
      shortSummary: "שיחה חדשה מ-WhatsApp.",
      painPoints: [],
      objections: [],
      buyingSignals: [],
      qualificationStatus: "not_started",
      collectedInformation: {},
      missingInformation: [],
      currentState: "new_lead",
      nextRecommendedAction: "wait",
      ownerAttentionRequired: false
    },
    structuredMemory: memory,
    memorySummary: buildMemorySummary(memory),
    lastMemoryUpdateAt: timestamp,
    nextAction: "להמתין לעיבוד ראשוני",
    nextRecommendedAction: "wait",
    externalConversationId: incoming.externalConversationId,
    updatedAt: timestamp
  };
  return { state: { ...state, conversations: [conversation, ...state.conversations] }, conversation, created: true };
}

export function processNormalizedIncomingMessage(incoming: NormalizedIncomingMessage) {
  let state = getPilotState();
  const business = state.business;
  if (!business) throw new Error("Missing pilot business configuration.");
  const receiveGuard = checkPilotCanReceive(business.pilotSettings);
  const allowlistGuard = checkPhoneAllowlist(business.pilotSettings, state.phoneAllowlist, incoming.normalizedSenderPhone);
  const supportGuard = checkMessageSupported(incoming);
  const existingEvent = state.integrationEvents.find((event) => event.businessId === incoming.businessId && event.idempotencyKey === incoming.externalEventId);

  if (existingEvent) {
    state = {
      ...state,
      auditLogs: [
        createAuditLog({
          businessId: incoming.businessId,
          actorType: "webhook",
          actorId: null,
          action: "duplicate_webhook_ignored",
          entityType: "integration_event",
          entityId: existingEvent.id,
          result: "duplicate",
          metadata: { externalMessageId: incoming.externalMessageId }
        }),
        ...state.auditLogs
      ],
      pilotUsageCounters: {
        ...state.pilotUsageCounters,
        duplicateEventsIgnored: state.pilotUsageCounters.duplicateEventsIgnored + 1
      }
    };
    savePilotState(state);
    return { status: "duplicate" as const, state };
  }

  const integrationEvent = {
    id: uid("integration"),
    businessId: incoming.businessId,
    provider: incoming.provider,
    eventType: "whatsapp_incoming_message",
    externalEventId: incoming.externalEventId,
    idempotencyKey: incoming.externalEventId,
    payload: {
      externalMessageId: incoming.externalMessageId,
      messageType: incoming.messageType,
      rawPayloadReference: incoming.rawPayloadReference
    },
    status: "pending" as const,
    attemptCount: 0,
    lastError: null,
    createdAt: nowIso(),
    processedAt: null
  };

  const leadResult = findOrCreateLead(state, incoming);
  state = leadResult.state;
  const conversationResult = findOrCreateConversation(state, incoming, leadResult.lead);
  state = conversationResult.state;
  const message: Message = {
    id: uid("msg"),
    conversationId: conversationResult.conversation.id,
    businessId: incoming.businessId,
    externalMessageId: incoming.externalMessageId,
    externalEventId: incoming.externalEventId,
    provider: incoming.provider,
    messageType: incoming.messageType,
    deliveryStatus: "delivered",
    idempotencyKey: incoming.externalMessageId,
    sender: "lead",
    body: incoming.text || `[${incoming.messageType}]`,
    rawPayloadReference: incoming.rawPayloadReference,
    createdAt: incoming.receivedAt
  };
  const duplicateMessage = state.messages.some((item) => item.businessId === incoming.businessId && item.idempotencyKey === message.idempotencyKey);
  if (duplicateMessage) {
    state = {
      ...state,
      integrationEvents: [{ ...integrationEvent, status: "ignored_duplicate" }, ...state.integrationEvents],
      auditLogs: [
        createAuditLog({
          businessId: incoming.businessId,
          actorType: "webhook",
          actorId: null,
          action: "duplicate_message_ignored",
          entityType: "message",
          entityId: incoming.externalMessageId,
          result: "duplicate",
          metadata: {}
        }),
        ...state.auditLogs
      ]
    };
    savePilotState(state);
    return { status: "duplicate" as const, state };
  }

  let updatedLead = leadResult.lead;
  let updatedConversation = conversationResult.conversation;
  const blockedReason = !receiveGuard.allowed ? receiveGuard.reason : !allowlistGuard.allowed ? allowlistGuard.reason : !supportGuard.allowed ? supportGuard.reason : null;
  if (isOptOutText(message.body)) {
    updatedLead = { ...updatedLead, doNotContact: true, doNotContactAt: nowIso(), optOutReason: "Opt-out detected from inbound text" };
    updatedConversation = {
      ...updatedConversation,
      conversationState: "waiting_for_owner",
      aiMode: "paused_by_owner",
      requiresOwnerAttention: true,
      needsHuman: true,
      takeoverReason: "Opt-out detected",
      nextAction: "לא לשלוח הודעות נוספות לפני בדיקה"
    };
  } else if (blockedReason) {
    updatedConversation = {
      ...updatedConversation,
      conversationState: "waiting_for_owner",
      aiMode: "waiting_for_owner",
      requiresOwnerAttention: true,
      needsHuman: true,
      takeoverReason: blockedReason,
      nextAction: "נדרשת בדיקת בעל העסק"
    };
  }

  const batch = createOrUpdateMessageBatch({
    existing: state.messageProcessingBatches.find((item) => item.conversationId === updatedConversation.id && item.status === "pending"),
    businessId: incoming.businessId,
    conversationId: updatedConversation.id,
    messageId: message.id,
    messageCreatedAt: message.createdAt,
    debounceWindowSeconds: business.pilotSettings.debounceWindowSeconds
  });
  const job = blockedReason || updatedLead.doNotContact
    ? null
    : createBackgroundJob({ businessId: incoming.businessId, jobType: "process_incoming_message", entityId: batch.id, scheduledFor: batch.processAfter });

  state = {
    ...state,
    leads: state.leads.map((lead) => (lead.id === updatedLead.id ? updatedLead : lead)),
    conversations: state.conversations.map((conversation) => (conversation.id === updatedConversation.id ? { ...updatedConversation, lastMessage: message.body, updatedAt: nowIso() } : conversation)),
    messages: [message, ...state.messages],
    integrationEvents: [integrationEvent, ...state.integrationEvents],
    messageProcessingBatches: [batch, ...state.messageProcessingBatches.filter((item) => item.id !== batch.id)],
    backgroundJobs: job ? [job, ...state.backgroundJobs] : state.backgroundJobs,
    auditLogs: [
      createAuditLog({
        businessId: incoming.businessId,
        actorType: "webhook",
        actorId: null,
        action: "incoming_message_saved",
        entityType: "message",
        entityId: message.id,
        result: blockedReason ? "blocked" : "success",
        metadata: { blockedReason, externalMessageId: incoming.externalMessageId, messageType: incoming.messageType }
      }),
      ...state.auditLogs
    ],
    notifications: blockedReason
      ? [
          {
            id: uid("note"),
            businessId: incoming.businessId,
            type: incoming.isSupported ? "conversation_waiting" : "unsupported_media",
            title: incoming.isSupported ? "הודעה ממתינה לבעל העסק" : "התקבלה מדיה לא נתמכת",
            body: blockedReason,
            entityId: updatedConversation.id,
            read: false,
            createdAt: nowIso()
          },
          ...state.notifications
        ]
      : state.notifications,
    pilotUsageCounters: {
      ...state.pilotUsageCounters,
      incomingMessagesCount: state.pilotUsageCounters.incomingMessagesCount + 1,
      optOutCount: updatedLead.doNotContact ? state.pilotUsageCounters.optOutCount + 1 : state.pilotUsageCounters.optOutCount
    }
  };
  savePilotState(state);
  return { status: blockedReason ? "blocked" as const : "accepted" as const, state };
}

export function parseWebhookWithProvider(payload: unknown, business = businessId) {
  return { payload, businessId: business };
}
